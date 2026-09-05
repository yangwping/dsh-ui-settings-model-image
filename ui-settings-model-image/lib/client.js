window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-model-image",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/profile.ts
		/** The request-image policy fields a pi-ai profile may override. */
		const POLICY_FIELDS = [
			"maxRequestImageBytes",
			"requestImagePixelBudget",
			"requestImageMaxBytes"
		];
		/** Schema defaults for the policy fields, used when the profile stores none. */
		const POLICY_DEFAULTS = {
			maxRequestImageBytes: 20 * 1024 * 1024,
			requestImagePixelBudget: 2048 * 2048,
			requestImageMaxBytes: 1024 * 1024
		};
		/**
		* Read one route's image facts out of one `llm-pi-ai` namespace view.
		* @param view - the namespace view (resolved, user, and base layers).
		* @param settingsPath - path from the section root to the profile.
		* @param writable - whether the settings provider accepts writes.
		* @returns the facts, or `undefined` when no profile resolves at the path.
		*/
		function readRouteFacts(view, settingsPath, writable) {
			const profile = objectAt(view.value, settingsPath);
			if (profile === void 0) return void 0;
			const userProfile = objectAt(view.user, settingsPath);
			const baseProfile = objectAt(view.base, settingsPath);
			const userModels = arrayOf(userProfile, "models");
			const baseModels = arrayOf(baseProfile, "models");
			const resolvedRows = arrayOf(profile, "models") ?? [];
			const userOwnsModels = userModels !== void 0 && userModels.length > 0;
			const modelsFromComposition = !userOwnsModels && baseModels !== void 0 && baseModels.length > 0;
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
				defaultInput: rawDefault ?? ["text"],
				policy,
				storedPolicy,
				declaredRows: resolvedRows.flatMap((row) => {
					if (typeof row !== "object" || row === null) return [];
					const record = row;
					const id = record.id;
					if (typeof id !== "string" || id.length === 0) return [];
					return [{
						id,
						name: typeof record.name === "string" && record.name.length > 0 ? record.name : void 0,
						raw: sanitizeRow(record),
						input: modalitiesOf(record)
					}];
				}),
				userOwnsModels,
				modelsFromComposition,
				overrides: Object.entries(objectAt(userProfile, ["modelOverrides"]) ?? {}).flatMap(([id, value]) => {
					if (typeof value !== "object" || value === null) return [];
					const record = value;
					const raw = sanitizeRow(record);
					delete raw.id;
					return [{
						id,
						raw,
						input: modalitiesOf(record)
					}];
				})
			};
		}
		/** Build the clean staged model one read starts from. */
		function emptyStaged(facts) {
			return {
				rows: facts.declaredRows.map((row) => ({ input: row.input === void 0 ? [] : [...row.input] })),
				overrides: facts.overrides.map((row) => ({
					id: row.id,
					raw: row.raw,
					input: row.input === void 0 ? [] : [...row.input]
				})),
				policy: {
					maxRequestImageBytes: policySpelling(facts.storedPolicy.maxRequestImageBytes),
					requestImagePixelBudget: policySpelling(facts.storedPolicy.requestImagePixelBudget),
					requestImageMaxBytes: policySpelling(facts.storedPolicy.requestImageMaxBytes)
				}
			};
		}
		/** Whether the staged model differs from what the read answered. */
		function stagedDirty(facts, staged) {
			if (POLICY_FIELDS.some((field) => staged.policy[field] !== policySpelling(facts.storedPolicy[field]))) return true;
			if (staged.rows.some((row, index) => !sameInput(row.input, facts.declaredRows[index]?.input))) return true;
			if (staged.overrides.length !== facts.overrides.length) return true;
			if (staged.overrides.some((row, index) => {
				const read = facts.overrides[index];
				return read === void 0 || read.id !== row.id || !sameInput(row.input, read.input);
			})) return true;
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
		function buildSaveOps(facts, staged, settingsPath) {
			const ops = [];
			if (facts.userOwnsModels) {
				if (staged.rows.some((row, index) => !sameInput(row.input, facts.declaredRows[index]?.input))) ops.push({
					op: "set",
					path: [...settingsPath, "models"],
					value: staged.rows.map((row, index) => {
						const raw = sanitizeRow(facts.declaredRows[index]?.raw ?? {});
						return row.input.length > 0 ? {
							...raw,
							input: [...row.input]
						} : raw;
					})
				});
			} else if (!facts.modelsFromComposition) {
				const keptIds = new Set(staged.overrides.map((row) => row.id));
				for (const read of facts.overrides) if (!keptIds.has(read.id)) ops.push({
					op: "unset",
					path: [
						...settingsPath,
						"modelOverrides",
						read.id
					]
				});
				for (const row of staged.overrides) {
					const read = facts.overrides.find((candidate) => candidate.id === row.id);
					if (read !== void 0 && sameInput(row.input, read.input)) continue;
					const body = sanitizeRow(row.raw);
					if (row.input.length === 0 && Object.keys(body).length === 0) {
						ops.push({
							op: "unset",
							path: [
								...settingsPath,
								"modelOverrides",
								row.id
							]
						});
						continue;
					}
					ops.push({
						op: "set",
						path: [
							...settingsPath,
							"modelOverrides",
							row.id
						],
						value: row.input.length > 0 ? {
							...body,
							input: [...row.input]
						} : body
					});
				}
			}
			for (const field of POLICY_FIELDS) {
				const draft = staged.policy[field].trim();
				const stored = facts.storedPolicy[field];
				if (draft === "") {
					if (stored !== void 0) ops.push({
						op: "unset",
						path: [...settingsPath, field]
					});
					continue;
				}
				const value = Number(draft);
				if (!Number.isInteger(value) || value <= 0) continue;
				if (value !== stored) ops.push({
					op: "set",
					path: [...settingsPath, field],
					value
				});
			}
			return ops;
		}
		/**
		* Spell a policy default for a field placeholder.
		* @param field - the policy field the value belongs to.
		* @param value - the effective default.
		* @returns a human spelling such as `20 MB` or `2048×2048 (4194304)`.
		*/
		function formatPolicyValue(field, value) {
			if (field === "requestImagePixelBudget") {
				const side = Math.sqrt(value);
				return Number.isInteger(side) ? `${side}×${side} (${String(value)})` : String(value);
			}
			if (value % (1024 * 1024) === 0) return `${value / (1024 * 1024)} MB`;
			if (value % 1024 === 0) return `${value / 1024} KB`;
			return String(value);
		}
		/** Whether a staged modality list means the same thing as a stored one. */
		function sameInput(staged, read) {
			const normalized = staged.length > 0 ? [...staged].sort() : void 0;
			const other = read === void 0 ? void 0 : [...read].sort();
			return JSON.stringify(normalized) === JSON.stringify(other);
		}
		/** A stored row's declared modalities; absent or empty means "inherit". */
		function modalitiesOf(row) {
			const value = row.input;
			if (!Array.isArray(value)) return void 0;
			const list = value.filter((entry) => entry === "text" || entry === "image");
			return list.length > 0 ? list : void 0;
		}
		/** Copy a stored row, dropping the fields schema materialization added. */
		function sanitizeRow(raw) {
			const next = {};
			for (const [key, value] of Object.entries(raw)) {
				if (value === void 0) continue;
				if (typeof value === "object" && value !== null && Object.keys(value).length === 0) continue;
				next[key] = value;
			}
			return next;
		}
		function policySpelling(value) {
			return value === void 0 ? "" : String(value);
		}
		function objectAt(value, path) {
			let current = value;
			for (const key of path) {
				if (typeof current !== "object" || current === null) return void 0;
				current = current[key];
			}
			return typeof current === "object" && current !== null ? current : void 0;
		}
		function arrayOf(profile, key) {
			const value = profile?.[key];
			return Array.isArray(value) ? value : void 0;
		}
		function numberAt(profile, key) {
			const value = profile?.[key];
			return typeof value === "number" ? value : void 0;
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* Layout stylesheet for the image-input companion panel. Visual atoms
		* (buttons, inputs, chevron) are the official `ui-primitives` components and
		* carry their own theme-tracked styles; what remains here is only the
		* layout skeleton, and even its colors resolve through the section's
		* `--dsw-alias-*` tokens — never literals — so a reskin or dark mode flows
		* through automatically. Class names carry the `dsmi-` prefix so they can
		* never collide with a hashed module class.
		*/
		const CSS = `
.dsmi-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* The section's disclosure summary: rotating official chevron, caption-size
   label, hint annotation — the customized-fold vocabulary. */
.dsmi-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 2px 4px;
  margin-left: -4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  text-align: left;
  user-select: none;
}

.dsmi-summary:hover {
  color: var(--dsw-alias-label-primary);
}

.dsmi-summary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3);
}

.dsmi-chevron {
  flex: none;
  color: currentcolor;
  transition: transform 120ms ease;
}

.dsmi-chevronOpen {
  transform: rotate(0deg);
}

.dsmi-chevron:not(.dsmi-chevronOpen) {
  transform: rotate(-90deg);
}

.dsmi-summaryHint {
  font-weight: 400;
  color: var(--dsw-alias-label-tertiary);
}

/* The expanded body: a filled module card on the row, matching the provider
   editor card's chrome (radius, fill, padding) so it reads as part of the
   editing surface. */
.dsmi-card {
  border-radius: 12px;
  background: var(--dsw-alias-bg-module-platform);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--dsw-alias-label-primary);
}

.dsmi-hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

.dsmi-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsmi-groupTitle {
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

.dsmi-modelList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* One bordered entry per model, matching the model catalog's entry chrome. */
.dsmi-modelEntry {
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 10px;
  padding: 6px 10px;
}

.dsmi-modelRow {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto auto;
  align-items: center;
  gap: 6px;
}

.dsmi-modelId {
  font-family: var(--ds-font-family-code);
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

.dsmi-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.dsmi-check:hover {
  color: var(--dsw-alias-label-primary);
}

.dsmi-check input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}

.dsmi-check input:disabled {
  cursor: default;
}

.dsmi-addRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* The app has no global border-box reset and the Input atom's wrap does not
   set one: without this, width:100% + its padding + border overshoot the
   field and spill past the card's right padding. */
.dsmi-inputWrap {
  box-sizing: border-box;
}

/* The Input atom's wrapper span sizes to content; field inputs stretch full
   width like the editor's own fields (API key et al). */
.dsmi-field > .dsmi-inputWrap {
  width: 100%;
}

.dsmi-addRow > .dsmi-inputWrap {
  width: 260px;
  max-width: 100%;
}

/* Policy fields stack one per row with the editor's field rhythm — the long
   bilingual labels need the full line, and side-by-side columns read cramped. */
.dsmi-policyGrid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dsmi-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dsmi-fieldLabel {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}

.dsmi-invalid > .dsmi-inputWrap {
  border-color: var(--dsw-alias-state-error-primary);
}

.dsmi-actionsBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dsmi-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsmi-saved {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-success-primary);
}

.dsmi-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-error-primary);
}

.dsmi-warn {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-warn-label);
}

@media (prefers-reduced-motion: reduce) {
  .dsmi-chevron {
    transition: none;
  }
}
`;
		/** Install the panel stylesheet once per document. */
		function ensureStyles() {
			if (document.getElementById("dsmi-styles") !== null) return;
			const element = document.createElement("style");
			element.id = "dsmi-styles";
			element.textContent = CSS;
			document.head.append(element);
		}
		//#endregion
		//#region src/client/card.tsx
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
		/**
		* Render the image-input companion panel.
		* @param props - locale copy, the row's owner facts, and the injected face.
		* @returns the panel, or nothing on an unconfigured row.
		*/
		function ImageInputCard(props) {
			const { t, provider, configured, read, save, subscribeUpdates } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)("loading");
			const [facts, setFacts] = (0, react.useState)(void 0);
			const [staged, setStaged] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const [draftId, setDraftId] = (0, react.useState)("");
			const [overrideNotice, setOverrideNotice] = (0, react.useState)(void 0);
			(0, react.useEffect)(ensureStyles, []);
			const load = (0, react.useCallback)(async () => {
				const next = await read(provider.settingsPath);
				if (next === void 0) {
					setStatus("failed");
					return;
				}
				setFacts(next);
				setStaged(emptyStaged(next));
				setStatus("ready");
				setNotice(void 0);
				setOverrideNotice(void 0);
			}, [read, provider.settingsPath]);
			const loadedFor = (0, react.useRef)("");
			(0, react.useEffect)(() => {
				const identity = configured && open ? provider.provider : "";
				if (identity === "" || loadedFor.current === identity) return;
				loadedFor.current = identity;
				load();
			}, [
				load,
				configured,
				open,
				provider.provider
			]);
			const dirty = facts !== void 0 && staged !== void 0 && stagedDirty(facts, staged);
			const dirtyRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				dirtyRef.current = dirty;
			});
			(0, react.useEffect)(() => subscribeUpdates(() => {
				if (!dirtyRef.current) load();
			}), [subscribeUpdates, load]);
			if (!configured) return null;
			const disabled = facts?.writable === false || busy;
			const invalidFields = new Set(POLICY_FIELDS.filter((field) => {
				const draft = staged?.policy[field].trim() ?? "";
				return draft !== "" && !/^[1-9][0-9]*$/.test(draft);
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
				if (staged === void 0) return;
				const fallback = facts?.defaultInput ?? ["text"];
				setStaged({
					...staged,
					rows: staged.rows.map((row, at) => {
						if (at !== index) return row;
						const effective = row.input.length > 0 ? row.input : fallback;
						const input = effective.includes(modality) ? effective.filter((entry) => entry !== modality) : [...effective, modality];
						return {
							...row,
							input
						};
					})
				});
				setNotice(void 0);
			};
			/**
			* Patch one override row's staged modalities, on the effective list for the
			* same reason as {@link toggleDeclared}.
			* @param id - the override's model id.
			* @param modality - the box the user toggled.
			*/
			const toggleOverride = (id, modality) => {
				if (staged === void 0) return;
				const fallback = facts?.defaultInput ?? ["text"];
				setStaged({
					...staged,
					overrides: staged.overrides.map((row) => {
						if (row.id !== id) return row;
						const effective = row.input.length > 0 ? row.input : fallback;
						const input = effective.includes(modality) ? effective.filter((entry) => entry !== modality) : [...effective, modality];
						return {
							...row,
							input
						};
					})
				});
				setNotice(void 0);
			};
			/** Add an override row for a catalog model id. */
			const addOverride = () => {
				if (staged === void 0) return;
				const id = draftId.trim();
				if (id.length === 0) {
					setOverrideNotice(t("overrideIdRequired"));
					return;
				}
				if (staged.overrides.some((row) => row.id === id) || facts?.declaredRows.some((row) => row.id === id)) {
					setOverrideNotice(t("overrideIdDuplicate"));
					return;
				}
				setStaged({
					...staged,
					overrides: [...staged.overrides, {
						id,
						raw: {},
						input: ["text"]
					}]
				});
				setDraftId("");
				setOverrideNotice(void 0);
			};
			/** Drop one staged override row. */
			const removeOverride = (id) => {
				if (staged === void 0) return;
				setStaged({
					...staged,
					overrides: staged.overrides.filter((row) => row.id !== id)
				});
				setNotice(void 0);
			};
			/** Revert the staged model to what the read answered. */
			const discard = () => {
				if (facts === void 0) return;
				setStaged(emptyStaged(facts));
				setDraftId("");
				setNotice(void 0);
				setOverrideNotice(void 0);
			};
			/** Diff and write the staged model, then re-read the written facts. */
			const save0 = async () => {
				if (facts === void 0 || staged === void 0) return;
				const ops = buildSaveOps(facts, staged, provider.settingsPath);
				setBusy(true);
				try {
					if (ops.length === 0) {
						setNotice({
							kind: "ok",
							text: t("saved")
						});
						return;
					}
					const answer = await save(ops, facts.revision);
					if (answer.kind === "conflict") {
						setNotice({
							kind: "error",
							text: t("conflict")
						});
						return;
					}
					if (answer.kind === "refused") {
						setNotice({
							kind: "error",
							text: answer.message
						});
						return;
					}
					await load();
					setNotice({
						kind: "ok",
						text: t("saved")
					});
				} finally {
					setBusy(false);
				}
			};
			/** One modality checkbox pair for a staged row. */
			const modalityChecks = (input, effective, onToggle) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsmi-check",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: effective.includes("text"),
						disabled,
						onChange: () => onToggle("text")
					}), t("modalityText")]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsmi-check",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: effective.includes("image"),
						disabled,
						onChange: () => onToggle("image")
					}), t("modalityImage")]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					hidden: true,
					children: input.length
				})
			] });
			const policyField = (field) => {
				if (facts === void 0 || staged === void 0) return null;
				const invalid = invalidFields.has(field);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: invalid ? "dsmi-field dsmi-invalid" : "dsmi-field",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: "dsmi-fieldLabel",
							htmlFor: `dsmi-policy-${field}`,
							children: t(field)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							className: "dsmi-inputWrap",
							id: `dsmi-policy-${field}`,
							value: staged.policy[field],
							placeholder: `${t("defaultIs")} ${formatPolicyValue(field, facts.policy[field])}`,
							disabled,
							inputMode: "numeric",
							"aria-invalid": invalid,
							onChange: (event) => {
								const text = event.target.value;
								setStaged({
									...staged,
									policy: {
										...staged.policy,
										[field]: text
									}
								});
								setNotice(void 0);
							}
						}),
						invalid ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsmi-error",
							children: t("invalidNumber")
						}) : null
					]
				}, field);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsmi-root",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsmi-summary",
					"aria-expanded": open,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
							size: 12,
							className: open ? "dsmi-chevron dsmi-chevronOpen" : "dsmi-chevron"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("title") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsmi-summaryHint",
							children: t("titleHint")
						})
					]
				}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsmi-card",
					children: status === "loading" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [status === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsmi-error",
						children: t("loadFailed")
					}) : null, status === "ready" && facts !== void 0 && staged !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						facts.writable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsmi-warn",
							children: t("readOnly")
						}),
						facts.userOwnsModels ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsmi-group",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsmi-groupTitle",
									children: t("modalityHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsmi-hint",
									children: t("modalityHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsmi-modelList",
									children: facts.declaredRows.map((row, index) => {
										const stagedRow = staged.rows[index];
										if (stagedRow === void 0) return null;
										const effective = stagedRow.input.length > 0 ? stagedRow.input : facts.defaultInput;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
											className: "dsmi-modelEntry",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsmi-modelRow",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsmi-modelId",
													children: row.name ?? row.id
												}), modalityChecks(stagedRow.input, effective, (modality) => {
													toggleDeclared(index, modality);
												})]
											})
										}, row.id);
									})
								})
							]
						}) : facts.modelsFromComposition ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsmi-group",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsmi-groupTitle",
								children: t("modalityHeading")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsmi-hint",
								children: t("compositionBase")
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsmi-group",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsmi-groupTitle",
									children: t("overridesHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsmi-hint",
									children: t("overridesHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsmi-modelList",
									children: staged.overrides.map((row) => {
										const effective = row.input.length > 0 ? row.input : facts.defaultInput;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
											className: "dsmi-modelEntry",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsmi-modelRow",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsmi-modelId",
														children: row.id
													}),
													modalityChecks(row.input, effective, (modality) => {
														toggleOverride(row.id, modality);
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "ghost",
														size: "sm",
														disabled,
														onClick: () => {
															removeOverride(row.id);
														},
														children: t("removeOverride")
													})
												]
											})
										}, row.id);
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsmi-addRow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										className: "dsmi-inputWrap",
										value: draftId,
										placeholder: t("overrideIdPlaceholder"),
										disabled,
										onChange: (event) => {
											setDraftId(event.target.value);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled,
										onClick: () => {
											addOverride();
										},
										children: t("addOverride")
									})]
								}),
								overrideNotice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsmi-error",
									children: overrideNotice
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsmi-group",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsmi-groupTitle",
									children: t("policyHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsmi-hint",
									children: t("policyHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsmi-policyGrid",
									children: POLICY_FIELDS.map((field) => policyField(field))
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsmi-actionsBar",
							children: [notice === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								role: "status",
								className: notice.kind === "ok" ? "dsmi-saved" : "dsmi-error",
								children: notice.text
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsmi-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "md",
									disabled: disabled || !dirty || busy,
									onClick: discard,
									children: t("discard")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "md",
									disabled: disabled || !dirty || blocked,
									onClick: () => {
										save0();
									},
									children: busy ? t("saving") : t("save")
								})]
							})]
						})
					] }) : null] })
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Copy dictionaries for the model image-input companion card. */
		/** English strings (the key-set source of truth for this pair). */
		const en = {
			title: "Image input",
			titleHint: "Per-model input modalities and the request image policy",
			modalityHeading: "Model input modalities",
			modalityHint: "Tick what each model accepts; a model with neither box ticked inherits the route default (text only).",
			modalityText: "Text",
			modalityImage: "Image",
			overridesHeading: "Catalog model overrides",
			overridesHint: "This route serves the installed catalog. Name a model id to override its input modalities.",
			overrideIdPlaceholder: "Model ID",
			addOverride: "Add",
			removeOverride: "Remove",
			overrideIdDuplicate: "This model already has an override.",
			overrideIdRequired: "Enter a model id first.",
			compositionBase: "The model list is declared by the deployment composition layer; edit it there.",
			policyHeading: "Request image policy",
			policyHint: "Optional per-provider overrides applied to every request. A blank field keeps the default.",
			maxRequestImageBytes: "Durable image cap (maxRequestImageBytes)",
			requestImagePixelBudget: "Request pixel budget (requestImagePixelBudget)",
			requestImageMaxBytes: "Per-image encoded cap (requestImageMaxBytes)",
			defaultIs: "default",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			saved: "Saved.",
			conflict: "These settings changed elsewhere. Apply again.",
			invalidNumber: "Must be a positive integer.",
			loadFailed: "Reading this provider failed",
			readOnly: "The settings document is read-only in this deployment."
		};
		/** Chinese strings, keyed one-to-one with the English source. */
		const zh = {
			title: "图片输入",
			titleHint: "各模型的输入模态与图片请求策略",
			modalityHeading: "模型输入模态",
			modalityHint: "勾选每个模型接受的输入；两项都不勾表示跟随路由默认（仅文本）。",
			modalityText: "文本",
			modalityImage: "图片",
			overridesHeading: "目录模型覆盖",
			overridesHint: "该路由使用安装目录的模型目录。填写模型 ID 可覆盖其输入模态。",
			overrideIdPlaceholder: "模型 ID",
			addOverride: "添加",
			removeOverride: "移除",
			overrideIdDuplicate: "该模型已有覆盖。",
			overrideIdRequired: "请先填写模型 ID。",
			compositionBase: "模型列表由部署组合层声明，请在其配置中修改。",
			policyHeading: "图片请求策略",
			policyHint: "对该提供方每次请求生效的可选覆盖；留空表示保持默认。",
			maxRequestImageBytes: "图片持久化上限（maxRequestImageBytes）",
			requestImagePixelBudget: "请求像素预算（requestImagePixelBudget）",
			requestImageMaxBytes: "单图编码上限（requestImageMaxBytes）",
			defaultIs: "默认",
			save: "保存",
			saving: "保存中…",
			discard: "放弃更改",
			saved: "已保存。",
			conflict: "配置已在其他位置被修改，请重试。",
			invalidNumber: "必须是正整数。",
			loadFailed: "读取该提供方失败",
			readOnly: "当前部署的设置文档为只读。"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.models.imageInput";
		/** The adapter family whose provider cards this plugin extends. */
		const PI_AI_NS = "llm-pi-ai";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.settings"
		];
		/**
		* Register the companion card on the Models page's provider-card seat.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-model-image: copy dictionaries");
			ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
				name: "settings.models.provider-card",
				key: PI_AI_NS,
				locale: NS,
				inject: () => ({
					read: async (settingsPath) => {
						const response = await ctx.remote.settings.describe();
						if (!response.ok) return void 0;
						const view = response.value.namespaces.find((candidate) => candidate.ns === PI_AI_NS);
						if (view === void 0) return void 0;
						return readRouteFacts(view, settingsPath, response.value.writable);
					},
					save: async (ops, expectedRevision) => {
						const wire = ops;
						const response = await ctx.remote.settings.mutate(PI_AI_NS, wire, expectedRevision);
						if (response.ok) return { kind: "written" };
						const { code, message } = response.error;
						return code === "settings/conflict" ? { kind: "conflict" } : {
							kind: "refused",
							message
						};
					},
					subscribeUpdates: (listener) => ctx.remote.$on("settings/document-updated", listener)
				})
			}, ImageInputCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map