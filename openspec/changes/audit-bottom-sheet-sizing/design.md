## Context

`BottomSheet` supports two sizing modes: **snap** (default — opens at natural height, drags between peek/40vh/60vh) and **`fitContent`** (sizes to `min(content, 60vh)`, refits on resize). Only `link-edit-warning-dialog` opts into `fitContent` today; every other mobile sheet uses snap by default rather than by decision.

Mobile sheets reach `BottomSheet` three ways:
1. **Direct** — `contact-action-menu`, `contact-creation-dialog`, `link-edit-warning-dialog` render `<BottomSheet>` themselves.
2. **Dynamic `:is`** — `tour-list-sheet`, `tour-info-sheet` render `SideDrawer` (desktop) or `BottomSheet` (mobile).
3. **Via `adaptive-overlay`** — `feedback-sheet`, `tour-creation-dialog`, `contacts-list-sheet`, `phone-verification-dialog`, `user-profile-sheet`, `phone-verification-notice`, `friend-requests-sheet` render `DialogWindow` (desktop) or `BottomSheet` (mobile).

`adaptive-overlay` currently has **no `fitContent` prop**, so route-3 sheets cannot be sized intentionally without a wrapper change. The header (close button + title) is `flex-shrink: 0` and sits outside the scrolling `.content` region, so the close control is already pinned — but no spec guarantees it stays that way.

## Goals / Non-Goals

**Goals:**
- Mobile sheets default to fit-content (fully visible); snap is the deliberate exception.
- `tour-list-sheet` and `tour-info-sheet` keep snap so the map behind a partial-height sheet stays usable.
- Every interactive sheet keeps an always-reachable close control.
- Document `fitContent` and the close guarantee in the spec.

**Non-Goals:**
- No change to `BottomSheet`'s sizing *implementation* — both modes already exist.
- No inversion of `BottomSheet`'s own primitive default (it stays snap); the fit-content default is applied at the app-convention layer (the `adaptive-overlay` wrapper + explicit props on direct consumers).
- No desktop (`SideDrawer` / `DialogWindow`) sizing changes.

## Decisions

**1. Default fit-content, snap only for the two tour sheets.**

| Sheet | Route | Mode | How |
|---|---|---|---|
| tour-list-sheet | `:is` | **snap** | no prop |
| tour-info-sheet | `:is` | **snap** | no prop (map view behind benefits from partial height) |
| feedback-sheet | adaptive | fitContent | wrapper default |
| tour-creation-dialog | adaptive | fitContent | wrapper default |
| contacts-list-sheet | adaptive | fitContent | wrapper default |
| phone-verification-dialog | adaptive | fitContent | wrapper default |
| user-profile-sheet | adaptive | fitContent | wrapper default |
| phone-verification-notice | adaptive | fitContent | wrapper default |
| friend-requests-sheet | adaptive | fitContent | wrapper default |
| contact-action-menu | direct | fitContent | explicit `fit-content` |
| contact-creation-dialog | direct | fitContent | explicit `fit-content` |
| link-edit-warning-dialog | direct | fitContent | already set |

Lists/long forms in fit-content mode simply cap at the 60vh ceiling and scroll inside it — never worse than snap for reachability, and the pinned close button stays visible.

**2. Apply the default at the `adaptive-overlay` wrapper, not by flipping `BottomSheet`'s primitive default.**
`adaptive-overlay` gets `fitContent?: boolean` via `withDefaults(..., { fitContent: true })`, forwarded only to the mobile `BottomSheet` arm.
- Alternative considered: invert `BottomSheet`'s own default to fit-content and have `tour-list`/`tour-info` opt out. Rejected — that changes the primitive's documented contract and silently affects any future direct `BottomSheet` consumer. Keeping the primitive default at snap and layering the convention in the wrapper contains the blast radius; the two snap sheets (`:is`, not wrapped) keep working with no prop.
- `DialogWindow` (desktop arm) ignores `fitContent` — it already sizes to content.

**3. Formalize the always-accessible close control.**
The close button is already pinned (header is `flex-shrink: 0`, outside `.content`). We add a spec requirement so it can't regress, and audit each consumer to confirm none hides it or relies solely on backdrop-tap. Collapsed (peek) sheets intentionally hide it — that state is non-interactive content and out of scope.

## Risks / Trade-offs

- **Tall forms/lists now open at 60vh** (contact-creation, contacts-list, friend-requests, etc.) → caps at 60vh and scrolls; close button pinned, so still dismissible. Verify on device that the keyboard doesn't cause refit thrash on the form sheets.
- **`adaptive-overlay` default flips 7 sheets at once** → intentional and central; if any single sheet should stay snap later, pass `:fit-content="false"`.
- **happy-dom can't assert real sizing** → component tests cover prop *forwarding* and close-button presence; visual correctness verified manually on the preview.

## Migration Plan

Pure presentation, no migration. Rollback = revert the prop additions; no data or schema touched.

## Open Questions

_None._
