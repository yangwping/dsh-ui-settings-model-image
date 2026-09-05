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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, IconChevronDownOutline14, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the provider-card slot declaration and its owner-prop vocabulary.
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { POLICY_FIELDS, buildSaveOps, emptyStaged, formatPolicyValue, stagedDirty } from './profile.ts'
import type { Modality, PathOp, PolicyField, RouteFacts, StagedModel } from './profile.ts'
import { ensureStyles } from './styles.ts'

/** What one save answered. */
export type SaveAnswer =
  | { kind: 'written' }
  | { kind: 'conflict' }
  | { kind: 'refused', message: string }

/** The face the apply world injects under this card. */
export interface ImageInputFace {
  /**
   * Read one route's image facts from the pi-ai namespace.
   * @param settingsPath - path from the section root to the profile.
   * @returns the facts, or `undefined` when the read or the profile is absent.
   */
  read(settingsPath: readonly string[]): Promise<RouteFacts | undefined>
  /**
   * Write path ops fenced at the read revision.
   * @param ops - the ordered edits against the stored section.
   * @param expectedRevision - revision the card read at.
   * @returns the outcome the card renders from.
   */
  save(ops: readonly PathOp[], expectedRevision: number | undefined): Promise<SaveAnswer>
  /**
   * Subscribe to pushed settings invalidations.
   * @param listener - invoked after any settings document commit.
   * @returns the disposer.
   */
  subscribeUpdates(listener: () => void): () => void
}

/** Props the renderer binds for this card. */
export type ImageInputCardProps =
  & PropsRuntime<'settings.models.provider-card'>
  & PropsLocale<'settings.models.imageInput'>
  & InjectFace<ImageInputFace>

/**
 * Render the image-input companion panel.
 * @param props - locale copy, the row's owner facts, and the injected face.
 * @returns the panel, or nothing on an unconfigured row.
 */
export function ImageInputCard(props: ImageInputCardProps): ReactNode {
  const { t, provider, configured, read, save, subscribeUpdates } = props
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [facts, setFacts] = useState<RouteFacts | undefined>(undefined)
  const [staged, setStaged] = useState<StagedModel | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error', text: string } | undefined>(undefined)
  const [draftId, setDraftId] = useState('')
  const [overrideNotice, setOverrideNotice] = useState<string | undefined>(undefined)

  useEffect(ensureStyles, [])

  const load = useCallback(async (): Promise<void> => {
    const next = await read(provider.settingsPath)
    if (next === undefined) {
      setStatus('failed')
      return
    }
    setFacts(next)
    setStaged(emptyStaged(next))
    setStatus('ready')
    setNotice(undefined)
    setOverrideNotice(undefined)
  }, [read, provider.settingsPath])

  // One load per route identity, on first open: the card remounts per row, so
  // a re-running effect could only clobber staged edits, and a closed fold
  // needs no read at all.
  const loadedFor = useRef('')
  useEffect(() => {
    const identity = configured && open ? provider.provider : ''
    if (identity === '' || loadedFor.current === identity) return
    loadedFor.current = identity
    void load()
  }, [load, configured, open, provider.provider])

  // Pushed invalidations converge a clean draft; a dirty one keeps its edits.
  const dirty = facts !== undefined && staged !== undefined && stagedDirty(facts, staged)
  const dirtyRef = useRef(false)
  useEffect(() => { dirtyRef.current = dirty })
  useEffect(() => subscribeUpdates(() => { if (!dirtyRef.current) void load() }), [subscribeUpdates, load])

  if (!configured) return null

  const disabled = facts?.writable === false || busy
  const invalidFields = new Set(POLICY_FIELDS.filter(field => {
    const draft = staged?.policy[field].trim() ?? ''
    return draft !== '' && !/^[1-9][0-9]*$/.test(draft)
  }))
  const blocked = invalidFields.size > 0

  /**
   * Patch one declared row's staged modalities. Toggling works on the
   * EFFECTIVE list — an inheriting row displays the route default, so ticking
   * a box must start from that default, or the default text would be lost.
   * @param index - the row's position in the staged model.
   * @param modality - the box the user toggled.
   */
  const toggleDeclared = (index: number, modality: Modality): void => {
    if (staged === undefined) return
    const fallback = facts?.defaultInput ?? ['text']
    setStaged({
      ...staged,
      rows: staged.rows.map((row, at) => {
        if (at !== index) return row
        const effective = row.input.length > 0 ? row.input : fallback
        const input = effective.includes(modality)
          ? effective.filter(entry => entry !== modality)
          : [...effective, modality]
        return { ...row, input }
      }),
    })
    setNotice(undefined)
  }

  /**
   * Patch one override row's staged modalities, on the effective list for the
   * same reason as {@link toggleDeclared}.
   * @param id - the override's model id.
   * @param modality - the box the user toggled.
   */
  const toggleOverride = (id: string, modality: Modality): void => {
    if (staged === undefined) return
    const fallback = facts?.defaultInput ?? ['text']
    setStaged({
      ...staged,
      overrides: staged.overrides.map(row => {
        if (row.id !== id) return row
        const effective = row.input.length > 0 ? row.input : fallback
        const input = effective.includes(modality)
          ? effective.filter(entry => entry !== modality)
          : [...effective, modality]
        return { ...row, input }
      }),
    })
    setNotice(undefined)
  }

  /** Add an override row for a catalog model id. */
  const addOverride = (): void => {
    if (staged === undefined) return
    const id = draftId.trim()
    if (id.length === 0) {
      setOverrideNotice(t('overrideIdRequired'))
      return
    }
    if (staged.overrides.some(row => row.id === id) || facts?.declaredRows.some(row => row.id === id)) {
      setOverrideNotice(t('overrideIdDuplicate'))
      return
    }
    setStaged({ ...staged, overrides: [...staged.overrides, { id, raw: {}, input: ['text'] }] })
    setDraftId('')
    setOverrideNotice(undefined)
  }

  /** Drop one staged override row. */
  const removeOverride = (id: string): void => {
    if (staged === undefined) return
    setStaged({ ...staged, overrides: staged.overrides.filter(row => row.id !== id) })
    setNotice(undefined)
  }

  /** Revert the staged model to what the read answered. */
  const discard = (): void => {
    if (facts === undefined) return
    setStaged(emptyStaged(facts))
    setDraftId('')
    setNotice(undefined)
    setOverrideNotice(undefined)
  }

  /** Diff and write the staged model, then re-read the written facts. */
  const save0 = async (): Promise<void> => {
    if (facts === undefined || staged === undefined) return
    const ops = buildSaveOps(facts, staged, provider.settingsPath)
    setBusy(true)
    try {
      if (ops.length === 0) {
        setNotice({ kind: 'ok', text: t('saved') })
        return
      }
      const answer = await save(ops, facts.revision)
      if (answer.kind === 'conflict') {
        setNotice({ kind: 'error', text: t('conflict') })
        return
      }
      if (answer.kind === 'refused') {
        setNotice({ kind: 'error', text: answer.message })
        return
      }
      await load()
      setNotice({ kind: 'ok', text: t('saved') })
    } finally {
      setBusy(false)
    }
  }

  /** One modality checkbox pair for a staged row. */
  const modalityChecks = (input: readonly Modality[], effective: readonly Modality[], onToggle: (m: Modality) => void): ReactNode => (
    <>
      <label className="dsmi-check">
        <input
          type="checkbox"
          checked={effective.includes('text')}
          disabled={disabled}
          onChange={() => onToggle('text')}
        />
        {t('modalityText')}
      </label>
      <label className="dsmi-check">
        <input
          type="checkbox"
          checked={effective.includes('image')}
          disabled={disabled}
          onChange={() => onToggle('image')}
        />
        {t('modalityImage')}
      </label>
      {/* `input` is read for staging; `effective` drives the boxes. */}
      <span hidden>{input.length}</span>
    </>
  )

  const policyField = (field: PolicyField): ReactNode => {
    if (facts === undefined || staged === undefined) return null
    const invalid = invalidFields.has(field)
    return (
      <div key={field} className={invalid ? 'dsmi-field dsmi-invalid' : 'dsmi-field'}>
        <label className="dsmi-fieldLabel" htmlFor={`dsmi-policy-${field}`}>{t(field)}</label>
        <Input
          className="dsmi-inputWrap"
          id={`dsmi-policy-${field}`}
          value={staged.policy[field]}
          placeholder={`${t('defaultIs')} ${formatPolicyValue(field, facts.policy[field])}`}
          disabled={disabled}
          inputMode="numeric"
          aria-invalid={invalid}
          onChange={event => {
            const text = event.target.value
            setStaged({ ...staged, policy: { ...staged.policy, [field]: text } })
            setNotice(undefined)
          }}
        />
        {invalid ? <span className="dsmi-error">{t('invalidNumber')}</span> : null}
      </div>
    )
  }

  return (
    <div className="dsmi-root">
      <button
        type="button"
        className="dsmi-summary"
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <IconChevronDownOutline14
          size={12}
          className={open ? 'dsmi-chevron dsmi-chevronOpen' : 'dsmi-chevron'}
        />
        <span>{t('title')}</span>
        <span className="dsmi-summaryHint">{t('titleHint')}</span>
      </button>
      {!open ? null : (
        <div className="dsmi-card">
          {status === 'loading' ? null : (
            <>
              {status === 'failed' ? <p className="dsmi-error">{t('loadFailed')}</p> : null}
              {status === 'ready' && facts !== undefined && staged !== undefined ? (
            <>
              {facts.writable ? null : <p className="dsmi-warn">{t('readOnly')}</p>}
              {facts.userOwnsModels ? (
                <section className="dsmi-group">
                  <div className="dsmi-groupTitle">{t('modalityHeading')}</div>
                  <p className="dsmi-hint">{t('modalityHint')}</p>
                  <ul className="dsmi-modelList">
                    {facts.declaredRows.map((row, index) => {
                      const stagedRow = staged.rows[index]
                      if (stagedRow === undefined) return null
                      const effective = stagedRow.input.length > 0 ? stagedRow.input : facts.defaultInput
                      return (
                        <li key={row.id} className="dsmi-modelEntry">
                          <div className="dsmi-modelRow">
                            <span className="dsmi-modelId">{row.name ?? row.id}</span>
                            {modalityChecks(stagedRow.input, effective, modality => { toggleDeclared(index, modality) })}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : facts.modelsFromComposition ? (
                <section className="dsmi-group">
                  <div className="dsmi-groupTitle">{t('modalityHeading')}</div>
                  <p className="dsmi-hint">{t('compositionBase')}</p>
                </section>
              ) : (
                <section className="dsmi-group">
                  <div className="dsmi-groupTitle">{t('overridesHeading')}</div>
                  <p className="dsmi-hint">{t('overridesHint')}</p>
                  <ul className="dsmi-modelList">
                    {staged.overrides.map(row => {
                      const effective = row.input.length > 0 ? row.input : facts.defaultInput
                      return (
                        <li key={row.id} className="dsmi-modelEntry">
                          <div className="dsmi-modelRow">
                            <span className="dsmi-modelId">{row.id}</span>
                            {modalityChecks(row.input, effective, modality => { toggleOverride(row.id, modality) })}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={disabled}
                              onClick={() => { removeOverride(row.id) }}
                            >
                              {t('removeOverride')}
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="dsmi-addRow">
                    <Input
                      className="dsmi-inputWrap"
                      value={draftId}
                      placeholder={t('overrideIdPlaceholder')}
                      disabled={disabled}
                      onChange={event => { setDraftId(event.target.value) }}
                    />
                    <Button variant="outline" size="sm" disabled={disabled} onClick={() => { addOverride() }}>
                      {t('addOverride')}
                    </Button>
                  </div>
                  {overrideNotice === undefined ? null : <p className="dsmi-error">{overrideNotice}</p>}
                </section>
              )}
              <section className="dsmi-group">
                <div className="dsmi-groupTitle">{t('policyHeading')}</div>
                <p className="dsmi-hint">{t('policyHint')}</p>
                <div className="dsmi-policyGrid">
                  {POLICY_FIELDS.map(field => policyField(field))}
                </div>
              </section>
              <div className="dsmi-actionsBar">
                {notice === undefined ? <span /> : (
                  <span role="status" className={notice.kind === 'ok' ? 'dsmi-saved' : 'dsmi-error'}>
                    {notice.text}
                  </span>
                )}
                <div className="dsmi-actions">
                  <Button variant="outline" size="md" disabled={disabled || !dirty || busy} onClick={discard}>
                    {t('discard')}
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={disabled || !dirty || blocked}
                    onClick={() => { void save0() }}
                  >
                    {busy ? t('saving') : t('save')}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}
