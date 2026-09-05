/**
 * Reading the pi-ai route facts this card edits and turning staged edits into
 * settings path ops. Pure JSON in, pure data out — no React and no Remotes —
 * so the read / diff / write contract stays testable without a browser.
 *
 * Write targets follow the adapter's own resolution rules: a route whose user
 * layer declares a `models` list owns the served catalog, so a modality edit
 * rewrites that array in place; a route serving the installed catalog takes a
 * `modelOverrides.<id>` entry instead, which the adapter folds over the
 * catalog model. The policy fields are plain profile fields either way.
 */
/** The request-image policy fields a pi-ai profile may override. */
export const POLICY_FIELDS = ['maxRequestImageBytes', 'requestImagePixelBudget', 'requestImageMaxBytes'];
/** Schema defaults for the policy fields, used when the profile stores none. */
const POLICY_DEFAULTS = {
    maxRequestImageBytes: 20 * 1024 * 1024,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
};
/**
 * Read one route's image facts out of one `llm-pi-ai` namespace view.
 * @param view - the namespace view (resolved, user, and base layers).
 * @param settingsPath - path from the section root to the profile.
 * @param writable - whether the settings provider accepts writes.
 * @returns the facts, or `undefined` when no profile resolves at the path.
 */
export function readRouteFacts(view, settingsPath, writable) {
    const profile = objectAt(view.value, settingsPath);
    if (profile === undefined)
        return undefined;
    const userProfile = objectAt(view.user, settingsPath);
    const baseProfile = objectAt(view.base, settingsPath);
    const userModels = arrayOf(userProfile, 'models');
    const baseModels = arrayOf(baseProfile, 'models');
    const resolvedRows = arrayOf(profile, 'models') ?? [];
    const userOwnsModels = userModels !== undefined && userModels.length > 0;
    const modelsFromComposition = !userOwnsModels && baseModels !== undefined && baseModels.length > 0;
    const rawDefault = modalitiesOf(profile);
    const storedPolicy = {};
    const policy = {};
    for (const field of POLICY_FIELDS) {
        storedPolicy[field] = numberAt(userProfile, field);
        policy[field] = numberAt(profile, field) ?? POLICY_DEFAULTS[field];
    }
    return {
        writable,
        revision: view.revision,
        defaultInput: rawDefault ?? ['text'],
        policy,
        storedPolicy,
        declaredRows: resolvedRows.flatMap((row) => {
            if (typeof row !== 'object' || row === null)
                return [];
            const record = row;
            const id = record.id;
            if (typeof id !== 'string' || id.length === 0)
                return [];
            const name = typeof record.name === 'string' && record.name.length > 0 ? record.name : undefined;
            return [{ id, name, raw: sanitizeRow(record), input: modalitiesOf(record) }];
        }),
        userOwnsModels,
        modelsFromComposition,
        overrides: Object.entries(objectAt(userProfile, ['modelOverrides']) ?? {}).flatMap(([id, value]) => {
            if (typeof value !== 'object' || value === null)
                return [];
            const record = value;
            const raw = sanitizeRow(record);
            delete raw.id;
            return [{ id, raw, input: modalitiesOf(record) }];
        }),
    };
}
/** Build the clean staged model one read starts from. */
export function emptyStaged(facts) {
    return {
        rows: facts.declaredRows.map(row => ({ input: row.input === undefined ? [] : [...row.input] })),
        overrides: facts.overrides.map(row => ({
            id: row.id,
            raw: row.raw,
            input: row.input === undefined ? [] : [...row.input],
        })),
        policy: {
            maxRequestImageBytes: policySpelling(facts.storedPolicy.maxRequestImageBytes),
            requestImagePixelBudget: policySpelling(facts.storedPolicy.requestImagePixelBudget),
            requestImageMaxBytes: policySpelling(facts.storedPolicy.requestImageMaxBytes),
        },
    };
}
/** Whether the staged model differs from what the read answered. */
export function stagedDirty(facts, staged) {
    if (POLICY_FIELDS.some(field => staged.policy[field] !== policySpelling(facts.storedPolicy[field])))
        return true;
    if (staged.rows.some((row, index) => !sameInput(row.input, facts.declaredRows[index]?.input)))
        return true;
    if (staged.overrides.length !== facts.overrides.length)
        return true;
    if (staged.overrides.some((row, index) => {
        const read = facts.overrides[index];
        return read === undefined || read.id !== row.id || !sameInput(row.input, read.input);
    }))
        return true;
    return false;
}
/**
 * Diff the staged model against the read facts into path ops.
 * @param facts - what the read answered (the diff baseline).
 * @param staged - the staged edits.
 * @param settingsPath - path from the section root to the profile.
 * @returns the ordered ops; empty when nothing differs. The card blocks a
 * save whose policy drafts do not parse, so the number branches below only
 * ever see validated text.
 */
export function buildSaveOps(facts, staged, settingsPath) {
    const ops = [];
    if (facts.userOwnsModels) {
        const changed = staged.rows.some((row, index) => !sameInput(row.input, facts.declaredRows[index]?.input));
        if (changed) {
            // The models array is replace-by-value: every stored row travels, each
            // with its staged modalities. An empty staged list drops the field so
            // the row keeps inheriting the route default.
            ops.push({
                op: 'set',
                path: [...settingsPath, 'models'],
                value: staged.rows.map((row, index) => {
                    const raw = sanitizeRow(facts.declaredRows[index]?.raw ?? {});
                    return row.input.length > 0 ? { ...raw, input: [...row.input] } : raw;
                }),
            });
        }
    }
    else if (!facts.modelsFromComposition) {
        const keptIds = new Set(staged.overrides.map(row => row.id));
        for (const read of facts.overrides) {
            if (!keptIds.has(read.id))
                ops.push({ op: 'unset', path: [...settingsPath, 'modelOverrides', read.id] });
        }
        for (const row of staged.overrides) {
            const read = facts.overrides.find(candidate => candidate.id === row.id);
            if (read !== undefined && sameInput(row.input, read.input))
                continue;
            const body = sanitizeRow(row.raw);
            if (row.input.length === 0 && Object.keys(body).length === 0) {
                // An override that would carry nothing at all is a removal.
                ops.push({ op: 'unset', path: [...settingsPath, 'modelOverrides', row.id] });
                continue;
            }
            ops.push({
                op: 'set',
                path: [...settingsPath, 'modelOverrides', row.id],
                value: row.input.length > 0 ? { ...body, input: [...row.input] } : body,
            });
        }
    }
    for (const field of POLICY_FIELDS) {
        const draft = staged.policy[field].trim();
        const stored = facts.storedPolicy[field];
        if (draft === '') {
            if (stored !== undefined)
                ops.push({ op: 'unset', path: [...settingsPath, field] });
            continue;
        }
        const value = Number(draft);
        if (!Number.isInteger(value) || value <= 0)
            continue;
        if (value !== stored)
            ops.push({ op: 'set', path: [...settingsPath, field], value });
    }
    return ops;
}
/**
 * Spell a policy default for a field placeholder.
 * @param field - the policy field the value belongs to.
 * @param value - the effective default.
 * @returns a human spelling such as `20 MB` or `2048×2048 (4194304)`.
 */
export function formatPolicyValue(field, value) {
    if (field === 'requestImagePixelBudget') {
        const side = Math.sqrt(value);
        return Number.isInteger(side) ? `${side}×${side} (${String(value)})` : String(value);
    }
    if (value % (1024 * 1024) === 0)
        return `${value / (1024 * 1024)} MB`;
    if (value % 1024 === 0)
        return `${value / 1024} KB`;
    return String(value);
}
/** Whether a staged modality list means the same thing as a stored one. */
function sameInput(staged, read) {
    const normalized = staged.length > 0 ? [...staged].sort() : undefined;
    const other = read === undefined ? undefined : [...read].sort();
    return JSON.stringify(normalized) === JSON.stringify(other);
}
/** A stored row's declared modalities; absent or empty means "inherit". */
function modalitiesOf(row) {
    const value = row.input;
    if (!Array.isArray(value))
        return undefined;
    const list = value.filter((entry) => entry === 'text' || entry === 'image');
    return list.length > 0 ? list : undefined;
}
/** Copy a stored row, dropping the fields schema materialization added. */
function sanitizeRow(raw) {
    const next = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value === undefined)
            continue;
        if (typeof value === 'object' && value !== null && Object.keys(value).length === 0)
            continue;
        next[key] = value;
    }
    return next;
}
function policySpelling(value) {
    return value === undefined ? '' : String(value);
}
function objectAt(value, path) {
    let current = value;
    for (const key of path) {
        if (typeof current !== 'object' || current === null)
            return undefined;
        current = current[key];
    }
    return typeof current === 'object' && current !== null ? current : undefined;
}
function arrayOf(profile, key) {
    const value = profile?.[key];
    return Array.isArray(value) ? value : undefined;
}
function numberAt(profile, key) {
    const value = profile?.[key];
    return typeof value === 'number' ? value : undefined;
}
//# sourceMappingURL=profile.js.map