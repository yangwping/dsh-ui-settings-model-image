/**
 * Layout stylesheet for the image-input companion panel. Visual atoms
 * (buttons, inputs, chevron) are the official `ui-primitives` components and
 * carry their own theme-tracked styles; what remains here is only the
 * layout skeleton, and even its colors resolve through the section's
 * `--dsw-alias-*` tokens — never literals — so a reskin or dark mode flows
 * through automatically. Class names carry the `dsmi-` prefix so they can
 * never collide with a hashed module class.
 */
/** Install the panel stylesheet once per document. */
export declare function ensureStyles(): void;
//# sourceMappingURL=styles.d.ts.map