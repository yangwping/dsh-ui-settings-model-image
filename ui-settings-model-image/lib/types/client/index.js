import { ImageInputCard } from "./card.js";
import { readRouteFacts } from "./profile.js";
import { en, zh } from "./locales.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'settings.models.imageInput';
/** The adapter family whose provider cards this plugin extends. */
const PI_AI_NS = 'llm-pi-ai';
/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.settings'];
/**
 * Register the companion card on the Models page's provider-card seat.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-model-image: copy dictionaries');
    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
        name: 'settings.models.provider-card',
        key: PI_AI_NS,
        locale: NS,
        inject: () => ({
            read: async (settingsPath) => {
                const response = await ctx.remote.settings.describe();
                if (!response.ok)
                    return undefined;
                const view = response.value.namespaces.find(candidate => candidate.ns === PI_AI_NS);
                if (view === undefined)
                    return undefined;
                return readRouteFacts(view, settingsPath, response.value.writable);
            },
            save: async (ops, expectedRevision) => {
                // The card's op vocabulary mirrors the wire shape; the value seat is
                // `unknown` on this side and JSON on the wire, so the narrowing cast
                // lives here and nowhere else.
                const wire = ops;
                const response = await ctx.remote.settings.mutate(PI_AI_NS, wire, expectedRevision);
                if (response.ok)
                    return { kind: 'written' };
                const { code, message } = response.error;
                return code === 'settings/conflict' ? { kind: 'conflict' } : { kind: 'refused', message };
            },
            subscribeUpdates: listener => ctx.remote.$on('settings/document-updated', listener),
        }),
    }, ImageInputCard));
}
//# sourceMappingURL=index.js.map