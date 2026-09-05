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
`

/** Install the panel stylesheet once per document. */
export function ensureStyles(): void {
  if (document.getElementById('dsmi-styles') !== null) return
  const element = document.createElement('style')
  element.id = 'dsmi-styles'
  element.textContent = CSS
  document.head.append(element)
}
