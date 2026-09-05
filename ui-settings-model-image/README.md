---
description: "Models-page companion plugin for pi-ai routes: per-model input modalities and the request image policy"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-model-image

A companion plugin for the dsh web client's Models settings page. It registers
into the `settings.models.provider-card` keyed seat under the `llm-pi-ai`
namespace, so every card of that adapter family — hand-declared routes
included — gains a folded **Image input** panel:

- **Model input modalities** — one text/image checkbox pair per declared model
  row. A route serving the installed catalog instead edits
  `modelOverrides.<id>` entries, following the adapter's own resolution rules.
- **Request image policy** — the optional `maxRequestImageBytes`,
  `requestImagePixelBudget`, and `requestImageMaxBytes` profile fields, with
  the effective defaults shown as placeholders and a blank field meaning
  "keep the default".

All edits stage locally and save as revision-fenced `settings.mutate` path
ops, so a concurrent editor is a visible refusal rather than a silent
overwrite. Pushed `settings/document-updated` events converge a clean draft
and leave a dirty one alone.
