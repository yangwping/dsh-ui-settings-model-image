/** Copy dictionaries for the model image-input companion card. */
/** English strings (the key-set source of truth for this pair). */
export declare const en: {
    readonly title: "Image input";
    readonly titleHint: "Per-model input modalities and the request image policy";
    readonly modalityHeading: "Model input modalities";
    readonly modalityHint: "Tick what each model accepts; a model with neither box ticked inherits the route default (text only).";
    readonly modalityText: "Text";
    readonly modalityImage: "Image";
    readonly overridesHeading: "Catalog model overrides";
    readonly overridesHint: "This route serves the installed catalog. Name a model id to override its input modalities.";
    readonly overrideIdPlaceholder: "Model ID";
    readonly addOverride: "Add";
    readonly removeOverride: "Remove";
    readonly overrideIdDuplicate: "This model already has an override.";
    readonly overrideIdRequired: "Enter a model id first.";
    readonly compositionBase: "The model list is declared by the deployment composition layer; edit it there.";
    readonly policyHeading: "Request image policy";
    readonly policyHint: "Optional per-provider overrides applied to every request. A blank field keeps the default.";
    readonly maxRequestImageBytes: "Durable image cap (maxRequestImageBytes)";
    readonly requestImagePixelBudget: "Request pixel budget (requestImagePixelBudget)";
    readonly requestImageMaxBytes: "Per-image encoded cap (requestImageMaxBytes)";
    readonly defaultIs: "default";
    readonly save: "Save";
    readonly saving: "Saving…";
    readonly discard: "Discard";
    readonly saved: "Saved.";
    readonly conflict: "These settings changed elsewhere. Apply again.";
    readonly invalidNumber: "Must be a positive integer.";
    readonly loadFailed: "Reading this provider failed";
    readonly readOnly: "The settings document is read-only in this deployment.";
};
export type ImageInputKey = keyof typeof en;
/** Chinese strings, keyed one-to-one with the English source. */
export declare const zh: Record<ImageInputKey, string>;
//# sourceMappingURL=locales.d.ts.map