## Context

`ContactDetailView` currently treats every field as an always-on inline editor: `firstName`/`lastName`/`displayName` have a Save button; each `ContactMethod` row owns its own `MethodEditState` (`value`, `label`, `saving`, `error`) and Save; and there is a separate "Add method" sub-form. Sibling components (`tour-info-sheet`) already use the `view/edit` toggle pattern, which is the project convention.

`ConnectPrompt` is a leaf component used in three places (`contact-detail-view` parent, manual add-form, import-results) and today calls `sendRequest` directly inside its own `handleSend`. There is no extension point for callers to interject work before the request is sent. The reported bug (#135) is a direct consequence: the detail-view ConnectPrompt fires the request while the detail view still has dirty inputs that the user assumed would be flushed.

The fix has two coupled parts that should land together:
1. Restructure the detail view to a unified view/edit mode with a single Save/Cancel.
2. Add a generic `beforeSend` extension point on `ConnectPrompt` and wire it from the three callers.

## Goals / Non-Goals

**Goals:**
- Contact detail view matches `tour-info-sheet`'s view/edit ergonomic.
- A user pressing "Send request" never leaves silently-discarded edits behind.
- Save failure does not produce a half-sent state: either the contact persists and the request is sent, or the request is not sent.
- `ConnectPrompt` stays usable in contexts where no pre-send work is needed (import-results) without ceremony.

**Non-Goals:**
- Changing the Supabase / repository layer; no new endpoints, no batching, no transactions.
- Changing `ContactForm` (the manual-add form) in any way beyond exposing a programmatic `submit()` for the connect-prompt gate.
- Changing `ConnectPrompt`'s presentation, security note, or i18n keys.
- Friend-request semantics, retries, or dedup logic.

## Decisions

### D1: `ConnectPrompt` gains optional `beforeSend?: () => Promise<void>` prop

`handleSend` becomes:

```ts
async function handleSend() {
  state.value = 'sending'
  errorMsg.value = null
  try {
    if (props.beforeSend)
      await props.beforeSend()
    await store.sendRequest(props.matchedUserId)
    state.value = 'sent'
    emit('sent')
  }
  catch (err) {
    state.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : t('friendships.sendRequest')
  }
}
```

Rationale: minimal API surface, callers compose freely, no event-based two-phase commit. Alternative considered: emit `beforeSend` and have the parent reply via prop/state — rejected, an async function prop is simpler and unambiguous.

### D2: `ContactDetailView` adopts `mode: 'view' | 'edit'` parallel to `tour-info-sheet`

State retained from today:
- `firstName`, `lastName`, `displayName` refs (rename existing — already exist).
- `methodEdits: Record<string, MethodEditState>` (already exists; per-row inputs).
- `showAddMethod`, `newMethodType`, `newMethodValue`, `newMethodLabel` (already exist).

State added:
- `mode = ref<'view' | 'edit'>('view')`
- `saveError = ref<string | null>(null)` (form-level fallback)
- `isSaving = ref(false)`

New functions:
- `enterEditMode()` — set `mode = 'edit'`, reset transient errors. Inputs are already initialized from `props.contact` via existing watchers.
- `cancelEdit()` — re-seed `firstName`/`lastName`/`displayName` from `props.contact`, drop dirty entries from `methodEdits` by re-running the seeding watcher (e.g. reset each entry to `methodDisplayValue(m)`/`m.label`), close add-method sub-form, set `mode = 'view'`.
- `saveAll()` — sequence: validate name; collect dirty method rows; for each, call existing `saveMethod(method)` (returns void, mutates `edit.error`); if any error remains after the sequence, throw aggregated error and stay in edit mode; if the add-method sub-form has content, call existing `confirmAddMethod()` and surface its error; finally call `saveName()`-equivalent that does NOT `emit('back')` (split current `saveName` into `saveNameInternal` returning void+throws, and the existing emit path is removed); on full success set `mode = 'view'`.

Per-row inline Save / Remove buttons remain in edit mode (consistent with adding/removing methods being one-shot row actions even within edit mode), but the user-visible primary action is the form-level Save which calls them in sequence. The existing per-row buttons act as fine-grained controls in edit mode and are simply not rendered in view mode.

> Practical note: rewiring all per-row saves to a single deferred Save is a larger refactor (each row mutates DB state separately today). To keep this change tractable, the contract is: pressing the form-level **Save** SHALL call the existing per-row save action for every dirty row and the name action, sequentially. Atomicity guarantee is best-effort sequential — a failure mid-sequence leaves earlier writes persisted, the failing row's `edit.error` populated, and the view in edit mode for the user to resolve.

Rationale: avoids inventing a transactional contacts API for a UI-shape change. The user-visible behavior matches expectation: one Save commits everything dirty; on failure, errors are precisely attributed and the user retries.

### D3: `ContactDetailView` exposes `commitPendingEdits()` via `defineExpose`

The detail view exposes:

```ts
defineExpose({
  /**
   * If in view mode: resolves immediately.
   * If in edit mode: runs saveAll(); resolves if every dirty write succeeds and
   * transitions to view mode, rejects otherwise (errors are already attributed
   * to individual rows or the form-level saveError).
   */
  commitPendingEdits: async () => { /* ... */ },
})
```

Parent `contacts-list-sheet.vue` keeps a `ref<InstanceType<typeof ContactDetailView>>()` and passes `() => detailRef.value?.commitPendingEdits() ?? Promise.resolve()` as `beforeSend` to the detail-view `ConnectPrompt`.

Rationale: keeps the detail view as the owner of its dirty state and validation; parent just orchestrates the gate.

### D4: `ContactForm` exposes `submit()` via `defineExpose`

The manual-add `ConnectPrompt` (rendered alongside `ContactForm` in `contacts-list-sheet.vue`) receives `beforeSend: () => formRef.value?.submit() ?? Promise.resolve()`. `ContactForm.submit()` runs the same code path as the form's existing submit button click, resolving when persistence succeeds and rejecting (or never resolving — we will make it reject) on validation/persistence error.

Rationale: `ContactForm` already owns validation. Exposing a thin programmatic trigger keeps the contract explicit.

### D5: Import-results ConnectPrompt passes no `beforeSend`

Import already persists contacts before rendering results. The prompt continues to work unchanged. We deliberately keep `beforeSend` optional so this case requires zero new wiring.

### D6: i18n

Add to `contacts.detailView`:
- `editBtn` — "Edit" / "Bearbeiten"
- `cancelBtn` — "Cancel" / "Abbrechen"
- `saveBtn` — "Save" / "Speichern"
- `saveFailed` — form-level fallback when no row-level error is attributable

Keep existing per-row error keys (`invalidPhone`, `firstNameRequired`, etc.).

## Risks / Trade-offs

- **Best-effort sequential save, not atomic** → A mid-sequence failure leaves earlier rows persisted while later rows error. Mitigation: per-row errors are accurate; user sees exactly which row failed; retrying Save retries only still-dirty rows. Documented in the spec ("Save fails — stay in edit mode" scenario).
- **`defineExpose` couples parent to child internals** → Already used elsewhere (e.g. tour flows), and the exposed surface is minimal (one method each). Acceptable.
- **Behavioral regression for power users** who liked per-row save in view-equivalent state → Per-row save buttons remain *inside edit mode*. Users who never tap Edit lose the inline editing, but the new flow is consistent with tours and (per the issue author) the desired direction.
- **Connect-prompt error UX after a `beforeSend` reject** → The existing `error-text` region surfaces the rejection message; the prompt buttons re-enable (state transitions back to `idle` or `error`). Need to ensure `state` is reset properly in the catch path — already handled by setting `state = 'error'`.

## Migration Plan

None — UI-only change, no DB migration, no public API change. Feature ships in one PR. No flag.

## Open Questions

- Should the primary-phone selector inside edit mode commit to the store on click or be deferred until Save? Spec D2 keeps the existing immediate-commit behavior in edit mode (consistent with current code) but makes the indicator inert in view mode. If we later want a fully deferred Save, the primary toggle joins the dirty-set; out of scope here.
