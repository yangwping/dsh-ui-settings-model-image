/** Logic smoke test for the plugin's pure read/diff/write core. */
import {
  POLICY_FIELDS, buildSaveOps, emptyStaged, formatPolicyValue, readRouteFacts, stagedDirty,
} from './ui-settings-model-image/src/client/profile.ts'
import type { NamespaceViewShape, RouteFacts, StagedModel } from './ui-settings-model-image/src/client/profile.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ok  ${label}`)
  else {
    failures += 1
    console.log(`FAIL  ${label}\n      expected ${e}\n      actual   ${a}`)
  }
}

// A namespace view shaped like a volcengine-style pi-ai route after schema
// materialization: rows carry `input: []` (absent → inherit), policy fields
// carry their schema defaults.
const view: NamespaceViewShape = {
  revision: 7,
  value: {
    providers: {
      volcengine: {
        displayName: 'Ark',
        api: 'openai-responses',
        baseURL: 'https://ark.example.com/api/v3',
        defaultInput: ['text'],
        defaultContextWindow: 262144,
        defaultMaxTokens: 32768,
        maxRequestImageBytes: 20971520,
        requestImagePixelBudget: 4194304,
        requestImageMaxBytes: 1048576,
        models: [
          { id: 'glm-5.3', name: 'glm-5.3', contextWindow: 1000000, input: [] },
          { id: 'glm-5.3-flash', name: 'glm-5.3-flash', input: [] },
        ],
      },
    },
  },
  user: {
    providers: {
      volcengine: {
        displayName: 'Ark',
        api: 'openai-responses',
        baseURL: 'https://ark.example.com/api/v3',
        models: [
          { id: 'glm-5.3', name: 'glm-5.3', contextWindow: 1000000 },
          { id: 'glm-5.3-flash', name: 'glm-5.3-flash' },
        ],
      },
    },
  },
}

const path = ['providers', 'volcengine']
const facts: RouteFacts | undefined = readRouteFacts(view, path, true)
check('facts resolve', facts === undefined, false)
if (facts === undefined) throw new Error('facts missing')
check('revision', facts.revision, 7)
check('writable', facts.writable, true)
check('defaultInput', facts.defaultInput, ['text'])
check('policy effective defaults', facts.policy, {
  maxRequestImageBytes: 20971520,
  requestImagePixelBudget: 4194304,
  requestImageMaxBytes: 1048576,
})
check('stored policy all undefined', facts.storedPolicy, {
  maxRequestImageBytes: undefined,
  requestImagePixelBudget: undefined,
  requestImageMaxBytes: undefined,
})
check('declared rows', facts.declaredRows.map(row => [row.id, row.input ?? null]), [
  ['glm-5.3', null],
  ['glm-5.3-flash', null],
])
check('user owns models', facts.userOwnsModels, true)
check('no overrides', facts.overrides, [])
check('raw extras preserved (contextWindow kept, input:[] dropped)',
  facts.declaredRows[0]?.raw, { id: 'glm-5.3', name: 'glm-5.3', contextWindow: 1000000 })

// Fresh staging is clean.
let staged: StagedModel = emptyStaged(facts)
check('fresh staging clean', stagedDirty(facts, staged), false)
check('no ops when clean', buildSaveOps(facts, staged, path), [])

// Tick image on row 1: effective starts at the route default [text], so the
// result must carry text AND image, not lose the default text.
staged = {
  ...staged,
  rows: staged.rows.map((row, index) => index === 1 ? { input: [...(facts.defaultInput), 'image' as const] } : row),
}
check('dirty after tick', stagedDirty(facts, staged), true)
const ops = buildSaveOps(facts, staged, path)
check('one models op', ops.length, 1)
check('models op shape', ops[0]?.op === 'set' && ops[0]?.path, ['providers', 'volcengine', 'models'])
const rows = (ops[0] as { value: Array<Record<string, unknown>> }).value
check('row 0 keeps extras, no input', rows[0], { id: 'glm-5.3', name: 'glm-5.3', contextWindow: 1000000 })
check('row 1 declares text+image', rows[1], { id: 'glm-5.3-flash', name: 'glm-5.3-flash', input: ['text', 'image'] })

// Policy override: pixels 1024*1024, keep others blank. Stored value echo is
// not an op; a changed value is a set; a blank over stored is an unset.
staged = { ...staged, rows: emptyStaged(facts).rows, policy: { ...emptyStaged(facts).policy, requestImagePixelBudget: '1048576' } }
check('policy set op only', buildSaveOps(facts, staged, path), [
  { op: 'set', path: ['providers', 'volcengine', 'requestImagePixelBudget'], value: 1048576 },
])
const withStored: RouteFacts = {
  ...facts,
  storedPolicy: { ...facts.storedPolicy, maxRequestImageBytes: 20971520 },
}
const stagedStored = { ...emptyStaged(withStored), policy: { ...emptyStaged(withStored).policy, maxRequestImageBytes: '20971520', requestImageMaxBytes: '' } }
check('stored echo is clean', stagedDirty(withStored, stagedStored), false)
const stagedCleared = { ...stagedStored, policy: { ...stagedStored.policy, maxRequestImageBytes: '  ' } }
check('blank over stored unsets', buildSaveOps(withStored, stagedCleared, path), [
  { op: 'unset', path: ['providers', 'volcengine', 'maxRequestImageBytes'] },
])

// Catalog route: no user models → overrides path. One override is stored
// (inherit), so the fresh staging carries it and stays clean.
const catalogFacts: RouteFacts = {
  ...facts,
  declaredRows: [],
  userOwnsModels: false,
  modelsFromComposition: false,
  overrides: [{ id: 'glm-5.3-flash', raw: {}, input: undefined }],
}
const catalogStaged = emptyStaged(catalogFacts)
check('stored override staging clean', stagedDirty(catalogFacts, catalogStaged), false)
const ticked: StagedModel = {
  ...catalogStaged,
  overrides: [{ id: 'glm-5.3-flash', raw: {}, input: ['text', 'image'] }],
}
check('override set op', buildSaveOps(catalogFacts, ticked, path), [
  { op: 'set', path: ['providers', 'volcengine', 'modelOverrides', 'glm-5.3-flash'], value: { input: ['text', 'image'] } },
])
const removal: StagedModel = { ...catalogStaged, overrides: [] }
check('override removal op', buildSaveOps(catalogFacts, removal, path), [
  { op: 'unset', path: ['providers', 'volcengine', 'modelOverrides', 'glm-5.3-flash'] },
])

// Composition-owned models: no modality ops, policy still editable.
const compositionFacts: RouteFacts = { ...facts, declaredRows: [], userOwnsModels: false, modelsFromComposition: true }
const compositionStaged = emptyStaged(compositionFacts)
check('composition route: policy-only ops', buildSaveOps(compositionFacts, compositionStaged, path), [])

// Formatting.
check('format MB', formatPolicyValue('maxRequestImageBytes', 20971520), '20 MB')
check('format KB', formatPolicyValue('requestImageMaxBytes', 1048576), '1 MB')
check('format pixels', formatPolicyValue('requestImagePixelBudget', 4194304), '2048×2048 (4194304)')
check('policy fields count', POLICY_FIELDS.length, 3)

if (failures > 0) {
  console.log(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall profile.ts checks passed')
