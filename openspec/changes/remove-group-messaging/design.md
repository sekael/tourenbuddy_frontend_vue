## Context

The tour info sheet renders a "Message all" button when a tour has more than one partner. It opens `GroupSmsConfirmDialog`, which navigates to a comma-separated `sms:` URI. GitHub issue #200 reports that only the first recipient's conversation opens. Investigation shows this is a platform limitation, not a code defect.

## Goals / Non-Goals

**Goals**
- Remove the group messaging affordance and all code that exists solely to support it.
- Leave single-recipient messaging (contact chip → `ContactActionMenu`, call / WhatsApp) fully intact.

**Non-Goals**
- Building a reliable group messaging channel (server-fanned SMS, group-chat integration). Out of scope; not planned.
- Touching `buildContactActions` or any per-contact action.

## Decisions

**Decision: Delete the feature instead of fixing the separator.**
The `sms:` multi-recipient separator differs by OS (Android `;`, iOS `,`) and many handlers ignore everything after the first recipient regardless. No PWA-reachable messaging app (SMS, WhatsApp, Telegram, Signal) offers a reliable multi-recipient compose deep-link. A separator swap would still silently drop recipients on affected handlers, so there is no fix that yields a trustworthy UX.
- *Alternative — platform-correct separator*: rejected; still broken on the common Android handlers that motivated the report.
- *Alternative — copy-numbers / sequential-send fallback*: rejected; adds UI and per-platform branching for a workflow users can already do via the per-contact menu, without a clear demand signal.

**Decision: Remove `buildGroupSmsRecipients` / `GroupSmsResult`, keep `buildContactActions`.**
The include/exclude split exists only to feed the group dialog. Once the dialog is gone it has no caller. `buildContactActions` is independent and still powers the single-recipient menu.

## Risks / Trade-offs

- **Users lose a shortcut** → Mitigation: the per-contact menu already provides call and WhatsApp; messaging partners individually is the documented path.
- **Dead i18n / CSS left behind** → Mitigation: task list explicitly removes `contacts.groupSms`, `tours.infoSheet.messageAll`, and `.group-sms-btn`; `npx eslint` + `type-check` catch stragglers.

## Migration Plan

Pure removal; no data or schema impact. Deploy is the standard frontend release. Rollback = revert the commit. The `tour-group-messaging` spec is retired at archive time.

## Open Questions

None — scope confirmed with the user (remove entirely, keep single-recipient only).
