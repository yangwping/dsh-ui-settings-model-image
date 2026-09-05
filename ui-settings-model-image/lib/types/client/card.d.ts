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
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PathOp, RouteFacts } from './profile.ts';
/** What one save answered. */
export type SaveAnswer = {
    kind: 'written';
} | {
    kind: 'conflict';
} | {
    kind: 'refused';
    message: string;
};
/** The face the apply world injects under this card. */
export interface ImageInputFace {
    /**
     * Read one route's image facts from the pi-ai namespace.
     * @param settingsPath - path from the section root to the profile.
     * @returns the facts, or `undefined` when the read or the profile is absent.
     */
    read(settingsPath: readonly string[]): Promise<RouteFacts | undefined>;
    /**
     * Write path ops fenced at the read revision.
     * @param ops - the ordered edits against the stored section.
     * @param expectedRevision - revision the card read at.
     * @returns the outcome the card renders from.
     */
    save(ops: readonly PathOp[], expectedRevision: number | undefined): Promise<SaveAnswer>;
    /**
     * Subscribe to pushed settings invalidations.
     * @param listener - invoked after any settings document commit.
     * @returns the disposer.
     */
    subscribeUpdates(listener: () => void): () => void;
}
/** Props the renderer binds for this card. */
export type ImageInputCardProps = PropsRuntime<'settings.models.provider-card'> & PropsLocale<'settings.models.imageInput'> & InjectFace<ImageInputFace>;
/**
 * Render the image-input companion panel.
 * @param props - locale copy, the row's owner facts, and the injected face.
 * @returns the panel, or nothing on an unconfigured row.
 */
export declare function ImageInputCard(props: ImageInputCardProps): ReactNode;
//# sourceMappingURL=card.d.ts.map