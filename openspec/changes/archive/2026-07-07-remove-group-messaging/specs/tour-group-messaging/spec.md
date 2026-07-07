## REMOVED Requirements

### Requirement: Group SMS row on tour info sheet

**Reason**: Multi-recipient messaging cannot be delivered reliably from a PWA. The `sms:` multi-recipient separator is platform-dependent and many handlers drop all recipients after the first, and no messaging app exposes a reliable multi-recipient compose deep-link. The affordance never worked as intended (GitHub issue #200).

**Migration**: None. Users message tour partners one at a time via the contact chip → contact action menu (call / WhatsApp), which is unchanged.

### Requirement: Group SMS confirmation dialog

**Reason**: The confirmation dialog exists only to launch a multi-recipient `sms:` URI, which cannot deliver to more than the first recipient. Removed together with the group SMS row.

**Migration**: None. No replacement dialog; single-recipient actions remain on the contact action menu.

### Requirement: Group SMS launch target

**Reason**: Navigating to `sms:<n1>,<n2>,…` opens a 1:1 conversation with only the first number on most OS/handlers. The behavior is unfixable at the URI level, so the launch path is removed.

**Migration**: None. Single-recipient `tel:` / WhatsApp links from the contact action menu continue to work.
