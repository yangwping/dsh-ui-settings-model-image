import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The provider-card companion body: a folded panel editing this route's
 * per-model input modalities and its request image policy. Every edit stages
 * locally; Save diffs the staged model against the read facts into path ops
 * and writes them revision-fenced, so a concurrent editor is a visible
 * refusal instead of a silent overwrite.
 *
 * The panel stays collapsed until the user opens it — the slot owner renders
 * it on every configured row, and an always-expanded card would clutter rows
 * the user never intends to tune. Opening reads the route once; staged edits
 * survive a close/open round trip.
 *
 * Presentation reuses the official `ui-primitives` atoms (Button, Input, the
 * shared chevron icon) so their styles track every reskin; `./styles.ts` only
 * lays out the fold and card skeleton, colored through `--dsw-alias-*` tokens.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, IconChevronDownOutline14, Input } from '@deepseek-ai/dsh-client-ui-primitives';
import { POLICY_FIELDS, buildSaveOps, emptyStaged, formatPolicyValue, stagedDirty } from "./profile.js";
import { ensureStyles } from "./styles.js";
/**
 * Render the image-input companion panel.
 * @param props - locale copy, the row's owner facts, and the injected face.
 * @returns the panel, or nothing on an unconfigured row.
 */
export function ImageInputCard(props) {
    const { t, provider, configured, read, save, subscribeUpdates } = props;
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('loading');
    const [facts, setFacts] = useState(undefined);
    const [staged, setStaged] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(undefined);
    const [draftId, setDraftId] = useState('');
    const [overrideNotice, setOverrideNotice] = useState(undefined);
    useEffect(ensureStyles, []);
    const load = useCallback(async () => {
        const next = await read(provider.settingsPath);
        if (next === undefined) {
            setStatus('failed');
            return;
        }
        setFacts(next);
        setStaged(emptyStaged(next));
        setStatus('ready');
        setNotice(undefined);
        setOverrideNotice(undefined);
    }, [read, provider.settingsPath]);
    // One load per route identity, on first open: the card remounts per row, so
    // a re-running effect could only clobber staged edits, and a closed fold
    // needs no read at all.
    const loadedFor = useRef('');
    useEffect(() => {
        const identity = configured && open ? provider.provider : '';
        if (identity === '' || loadedFor.current === identity)
            return;
        loadedFor.current = identity;
        void load();
    }, [load, configured, open, provider.provider]);
    // Pushed invalidations converge a clean draft; a dirty one keeps its edits.
    const dirty = facts !== undefined && staged !== undefined && stagedDirty(facts, staged);
    const dirtyRef = useRef(false);
    useEffect(() => { dirtyRef.current = dirty; });
    useEffect(() => subscribeUpdates(() => { if (!dirtyRef.current)
        void load(); }), [subscribeUpdates, load]);
    if (!configured)
        return null;
    const disabled = facts?.writable === false || busy;
    const invalidFields = new Set(POLICY_FIELDS.filter(field => {
        const draft = staged?.policy[field].trim() ?? '';
        return draft !== '' && !/^[1-9][0-9]*$/.test(draft);
    }));
    const blocked = invalidFields.size > 0;
    /**
     * Patch one declared row's staged modalities. Toggling works on the
     * EFFECTIVE list — an inheriting row displays the route default, so ticking
     * a box must start from that default, or the default text would be lost.
     * @param index - the row's position in the staged model.
     * @param modality - the box the user toggled.
     */
    const toggleDeclared = (index, modality) => {
        if (staged === undefined)
            return;
        const fallback = facts?.defaultInput ?? ['text'];
        setStaged({
            ...staged,
            rows: staged.rows.map((row, at) => {
                if (at !== index)
                    return row;
                const effective = row.input.length > 0 ? row.input : fallback;
                const input = effective.includes(modality)
                    ? effective.filter(entry => entry !== modality)
                    : [...effective, modality];
                return { ...row, input };
            }),
        });
        setNotice(undefined);
    };
    /**
     * Patch one override row's staged modalities, on the effective list for the
     * same reason as {@link toggleDeclared}.
     * @param id - the override's model id.
     * @param modality - the box the user toggled.
     */
    const toggleOverride = (id, modality) => {
        if (staged === undefined)
            return;
        const fallback = facts?.defaultInput ?? ['text'];
        setStaged({
            ...staged,
            overrides: staged.overrides.map(row => {
                if (row.id !== id)
                    return row;
                const effective = row.input.length > 0 ? row.input : fallback;
                const input = effective.includes(modality)
                    ? effective.filter(entry => entry !== modality)
                    : [...effective, modality];
                return { ...row, input };
            }),
        });
        setNotice(undefined);
    };
    /** Add an override row for a catalog model id. */
    const addOverride = () => {
        if (staged === undefined)
            return;
        const id = draftId.trim();
        if (id.length === 0) {
            setOverrideNotice(t('overrideIdRequired'));
            return;
        }
        if (staged.overrides.some(row => row.id === id) || facts?.declaredRows.some(row => row.id === id)) {
            setOverrideNotice(t('overrideIdDuplicate'));
            return;
        }
        setStaged({ ...staged, overrides: [...staged.overrides, { id, raw: {}, input: ['text'] }] });
        setDraftId('');
        setOverrideNotice(undefined);
    };
    /** Drop one staged override row. */
    const removeOverride = (id) => {
        if (staged === undefined)
            return;
        setStaged({ ...staged, overrides: staged.overrides.filter(row => row.id !== id) });
        setNotice(undefined);
    };
    /** Revert the staged model to what the read answered. */
    const discard = () => {
        if (facts === undefined)
            return;
        setStaged(emptyStaged(facts));
        setDraftId('');
        setNotice(undefined);
        setOverrideNotice(undefined);
    };
    /** Diff and write the staged model, then re-read the written facts. */
    const save0 = async () => {
        if (facts === undefined || staged === undefined)
            return;
        const ops = buildSaveOps(facts, staged, provider.settingsPath);
        setBusy(true);
        try {
            if (ops.length === 0) {
                setNotice({ kind: 'ok', text: t('saved') });
                return;
            }
            const answer = await save(ops, facts.revision);
            if (answer.kind === 'conflict') {
                setNotice({ kind: 'error', text: t('conflict') });
                return;
            }
            if (answer.kind === 'refused') {
                setNotice({ kind: 'error', text: answer.message });
                return;
            }
            await load();
            setNotice({ kind: 'ok', text: t('saved') });
        }
        finally {
            setBusy(false);
        }
    };
    /** One modality checkbox pair for a staged row. */
    const modalityChecks = (input, effective, onToggle) => (_jsxs(_Fragment, { children: [_jsxs("label", { className: "dsmi-check", children: [_jsx("input", { type: "checkbox", checked: effective.includes('text'), disabled: disabled, onChange: () => onToggle('text') }), t('modalityText')] }), _jsxs("label", { className: "dsmi-check", children: [_jsx("input", { type: "checkbox", checked: effective.includes('image'), disabled: disabled, onChange: () => onToggle('image') }), t('modalityImage')] }), _jsx("span", { hidden: true, children: input.length })] }));
    const policyField = (field) => {
        if (facts === undefined || staged === undefined)
            return null;
        const invalid = invalidFields.has(field);
        return (_jsxs("div", { className: invalid ? 'dsmi-field dsmi-invalid' : 'dsmi-field', children: [_jsx("label", { className: "dsmi-fieldLabel", htmlFor: `dsmi-policy-${field}`, children: t(field) }), _jsx(Input, { className: "dsmi-inputWrap", id: `dsmi-policy-${field}`, value: staged.policy[field], placeholder: `${t('defaultIs')} ${formatPolicyValue(field, facts.policy[field])}`, disabled: disabled, inputMode: "numeric", "aria-invalid": invalid, onChange: event => {
                        const text = event.target.value;
                        setStaged({ ...staged, policy: { ...staged.policy, [field]: text } });
                        setNotice(undefined);
                    } }), invalid ? _jsx("span", { className: "dsmi-error", children: t('invalidNumber') }) : null] }, field));
    };
    return (_jsxs("div", { className: "dsmi-root", children: [_jsxs("button", { type: "button", className: "dsmi-summary", "aria-expanded": open, onClick: () => { setOpen(value => !value); }, children: [_jsx(IconChevronDownOutline14, { size: 12, className: open ? 'dsmi-chevron dsmi-chevronOpen' : 'dsmi-chevron' }), _jsx("span", { children: t('title') }), _jsx("span", { className: "dsmi-summaryHint", children: t('titleHint') })] }), !open ? null : (_jsx("div", { className: "dsmi-card", children: status === 'loading' ? null : (_jsxs(_Fragment, { children: [status === 'failed' ? _jsx("p", { className: "dsmi-error", children: t('loadFailed') }) : null, status === 'ready' && facts !== undefined && staged !== undefined ? (_jsxs(_Fragment, { children: [facts.writable ? null : _jsx("p", { className: "dsmi-warn", children: t('readOnly') }), facts.userOwnsModels ? (_jsxs("section", { className: "dsmi-group", children: [_jsx("div", { className: "dsmi-groupTitle", children: t('modalityHeading') }), _jsx("p", { className: "dsmi-hint", children: t('modalityHint') }), _jsx("ul", { className: "dsmi-modelList", children: facts.declaredRows.map((row, index) => {
                                                const stagedRow = staged.rows[index];
                                                if (stagedRow === undefined)
                                                    return null;
                                                const effective = stagedRow.input.length > 0 ? stagedRow.input : facts.defaultInput;
                                                return (_jsx("li", { className: "dsmi-modelEntry", children: _jsxs("div", { className: "dsmi-modelRow", children: [_jsx("span", { className: "dsmi-modelId", children: row.name ?? row.id }), modalityChecks(stagedRow.input, effective, modality => { toggleDeclared(index, modality); })] }) }, row.id));
                                            }) })] })) : facts.modelsFromComposition ? (_jsxs("section", { className: "dsmi-group", children: [_jsx("div", { className: "dsmi-groupTitle", children: t('modalityHeading') }), _jsx("p", { className: "dsmi-hint", children: t('compositionBase') })] })) : (_jsxs("section", { className: "dsmi-group", children: [_jsx("div", { className: "dsmi-groupTitle", children: t('overridesHeading') }), _jsx("p", { className: "dsmi-hint", children: t('overridesHint') }), _jsx("ul", { className: "dsmi-modelList", children: staged.overrides.map(row => {
                                                const effective = row.input.length > 0 ? row.input : facts.defaultInput;
                                                return (_jsx("li", { className: "dsmi-modelEntry", children: _jsxs("div", { className: "dsmi-modelRow", children: [_jsx("span", { className: "dsmi-modelId", children: row.id }), modalityChecks(row.input, effective, modality => { toggleOverride(row.id, modality); }), _jsx(Button, { variant: "ghost", size: "sm", disabled: disabled, onClick: () => { removeOverride(row.id); }, children: t('removeOverride') })] }) }, row.id));
                                            }) }), _jsxs("div", { className: "dsmi-addRow", children: [_jsx(Input, { className: "dsmi-inputWrap", value: draftId, placeholder: t('overrideIdPlaceholder'), disabled: disabled, onChange: event => { setDraftId(event.target.value); } }), _jsx(Button, { variant: "outline", size: "sm", disabled: disabled, onClick: () => { addOverride(); }, children: t('addOverride') })] }), overrideNotice === undefined ? null : _jsx("p", { className: "dsmi-error", children: overrideNotice })] })), _jsxs("section", { className: "dsmi-group", children: [_jsx("div", { className: "dsmi-groupTitle", children: t('policyHeading') }), _jsx("p", { className: "dsmi-hint", children: t('policyHint') }), _jsx("div", { className: "dsmi-policyGrid", children: POLICY_FIELDS.map(field => policyField(field)) })] }), _jsxs("div", { className: "dsmi-actionsBar", children: [notice === undefined ? _jsx("span", {}) : (_jsx("span", { role: "status", className: notice.kind === 'ok' ? 'dsmi-saved' : 'dsmi-error', children: notice.text })), _jsxs("div", { className: "dsmi-actions", children: [_jsx(Button, { variant: "outline", size: "md", disabled: disabled || !dirty || busy, onClick: discard, children: t('discard') }), _jsx(Button, { variant: "primary", size: "md", disabled: disabled || !dirty || blocked, onClick: () => { void save0(); }, children: busy ? t('saving') : t('save') })] })] })] })) : null] })) }))] }));
}
//# sourceMappingURL=card.js.map