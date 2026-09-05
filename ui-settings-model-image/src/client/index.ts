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
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls ctx.remote, the forwarded-event key face, and the settings
// Remote vocabulary into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the provider-card slot declaration and its owner-prop
// vocabulary. The slot is DECLARED by the Models section at runtime; this
// plugin only registers into it.
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
// Type-only: pulls the ctx.slots Context merge (SlotRegistry).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { ImageInputCard } from './card.tsx'
import type { ImageInputFace, SaveAnswer } from './card.tsx'
import { readRouteFacts } from './profile.ts'
import type { PathOp } from './profile.ts'
import { en, zh, type ImageInputKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The image-input companion card's copy. */
    'settings.models.imageInput': ImageInputKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.models.imageInput'

/** The adapter family whose provider cards this plugin extends. */
const PI_AI_NS = 'llm-pi-ai'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.settings']

/**
 * Register the companion card on the Models page's provider-card seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-model-image: copy dictionaries')

  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card',
    key: PI_AI_NS,
    locale: NS,
    inject: (): ImageInputFace => ({
      read: async (settingsPath) => {
        const response = await ctx.remote.settings.describe()
        if (!response.ok) return undefined
        const view = response.value.namespaces.find(candidate => candidate.ns === PI_AI_NS)
        if (view === undefined) return undefined
        return readRouteFacts(view, settingsPath, response.value.writable)
      },
      save: async (ops: readonly PathOp[], expectedRevision: number | undefined): Promise<SaveAnswer> => {
        // The card's op vocabulary mirrors the wire shape; the value seat is
        // `unknown` on this side and JSON on the wire, so the narrowing cast
        // lives here and nowhere else.
        const wire = ops as SettingsPathOpView[]
        const response = await ctx.remote.settings.mutate(PI_AI_NS, wire, expectedRevision)
        if (response.ok) return { kind: 'written' }
        const { code, message } = response.error
        return code === 'settings/conflict' ? { kind: 'conflict' } : { kind: 'refused', message }
      },
      subscribeUpdates: listener => ctx.remote.$on('settings/document-updated', listener),
    }),
  }, ImageInputCard))
}

export type { ImageInputCardProps, SaveAnswer } from './card.tsx'
export type { RouteFacts, StagedModel } from './profile.ts'
