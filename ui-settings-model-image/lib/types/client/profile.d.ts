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
/** One input modality a pi-ai model may accept. */
export type Modality = 'text' | 'image';
/** The request-image policy fields a pi-ai profile may override. */
export declare const POLICY_FIELDS: readonly ["maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes"];
/** One {@link POLICY_FIELDS} member. */
export type PolicyField = typeof POLICY_FIELDS[number];
/** One path operation against the stored settings section. */
export type PathOp = {
    op: 'set';
    path: string[];
    value: unknown;
} | {
    op: 'unset';
    path: string[];
};
/** One declared model row as the route's models array stores it. */
export interface DeclaredRow {
    id: string;
    name: string | undefined;
    /** The stored row as resolved, extra fields preserved verbatim. */
    raw: Record<string, unknown>;
    /** Declared modalities; `undefined` inherits the route default. */
    input: Modality[] | undefined;
}
/** One `modelOverrides` entry as the user layer stores it. */
export interface OverrideRow {
    id: string;
    /** The stored override value sans its `id` key, extras preserved. */
    raw: Record<string, unknown>;
    /** Declared modalities; `undefined` inherits the route default. */
    input: Modality[] | undefined;
}
/** What one read answers for one provider route. */
export interface RouteFacts {
    /** Whether the settings provider accepts writes. */
    writable: boolean;
    /** Revision fencing this card's writes. */
    revision: number;
    /** Route default modalities for rows declaring none. */
    defaultInput: Modality[];
    /** Effective policy values, schema defaults included. */
    policy: Record<PolicyField, number>;
    /** User-layer policy values; `undefined` inherits the default. */
    storedPolicy: Record<PolicyField, number | undefined>;
    /** Declared rows in stored order; empty when the route serves the catalog. */
    declaredRows: DeclaredRow[];
    /** Whether the user layer itself carries the models array. */
    userOwnsModels: boolean;
    /** Whether a models array exists only in the composition base layer. */
    modelsFromComposition: boolean;
    /** User-layer modelOverrides entries, stored order preserved. */
    overrides: OverrideRow[];
}
/** The card's staged edit model; empty modality lists mean "inherit". */
export interface StagedModel {
    /** Parallel to {@link RouteFacts.declaredRows}. */
    rows: {
        input: Modality[];
    }[];
    overrides: {
        id: string;
        raw: Record<string, unknown>;
        input: Modality[];
    }[];
    policy: Record<PolicyField, string>;
}
/** Structural slice of the settings namespace view this module reads. */
export interface NamespaceViewShape {
    revision: number;
    value: unknown;
    user?: unknown;
    base?: unknown;
}
/**
 * Read one route's image facts out of one `llm-pi-ai` namespace view.
 * @param view - the namespace view (resolved, user, and base layers).
 * @param settingsPath - path from the section root to the profile.
 * @param writable - whether the settings provider accepts writes.
 * @returns the facts, or `undefined` when no profile resolves at the path.
 */
export declare function readRouteFacts(view: NamespaceViewShape, settingsPath: readonly string[], writable: boolean): RouteFacts | undefined;
/** Build the clean staged model one read starts from. */
export declare function emptyStaged(facts: RouteFacts): StagedModel;
/** Whether the staged model differs from what the read answered. */
export declare function stagedDirty(facts: RouteFacts, staged: StagedModel): boolean;
/**
 * Diff the staged model against the read facts into path ops.
 * @param facts - what the read answered (the diff baseline).
 * @param staged - the staged edits.
 * @param settingsPath - path from the section root to the profile.
 * @returns the ordered ops; empty when nothing differs. The card blocks a
 * save whose policy drafts do not parse, so the number branches below only
 * ever see validated text.
 */
export declare function buildSaveOps(facts: RouteFacts, staged: StagedModel, settingsPath: readonly string[]): PathOp[];
/**
 * Spell a policy default for a field placeholder.
 * @param field - the policy field the value belongs to.
 * @param value - the effective default.
 * @returns a human spelling such as `20 MB` or `2048×2048 (4194304)`.
 */
export declare function formatPolicyValue(field: PolicyField, value: number): string;
//# sourceMappingURL=profile.d.ts.map