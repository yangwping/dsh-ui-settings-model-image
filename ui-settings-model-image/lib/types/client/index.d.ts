/**
 * Models-page companion plugin, browser half: the `llm-pi-ai` provider-card
 * extension that edits per-model input modalities (text / image) and the
 * route's request image policy (`maxRequestImageBytes`,
 * `requestImagePixelBudget`, `requestImageMaxBytes`).
 *
 * The card registers into the Models section's `settings.models.provider-card`
 * keyed seat under the pi-ai namespace, so it renders on every card of that
 * family — hand-declared routes included — without the Models page knowing
 * about it. Writes travel as revision-fenced `settings.mutate` path ops, the
 * same wire the page's own editors use, so a concurrent editor is a visible
 * refusal instead of a silent overwrite.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ImageInputKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The image-input companion card's copy. */
        'settings.models.imageInput': ImageInputKey;
    }
}
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Register the companion card on the Models page's provider-card seat.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
export type { ImageInputCardProps, SaveAnswer } from './card.tsx';
export type { RouteFacts, StagedModel } from './profile.ts';
//# sourceMappingURL=index.d.ts.map