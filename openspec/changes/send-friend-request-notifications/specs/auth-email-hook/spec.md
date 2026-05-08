## ADDED Requirements

### Requirement: Notification dispatch routes
The Worker SHALL expose two additional routes that send friend-request notifications via Brevo email and Web Push, in addition to the existing Supabase email hook.

#### Scenario: Friend request received route
- **WHEN** an authenticated `POST /notify/friend-request-received` arrives with `{ friendshipId }`
- **THEN** the Worker resolves the recipient profile, applies their preferences, sends localized email via Brevo when email is enabled, and sends Web Push to every active subscription when push is enabled

#### Scenario: Friend request responded route
- **WHEN** an authenticated `POST /notify/friend-request-responded` arrives with `{ friendshipId }`
- **THEN** the Worker resolves the original requester profile, applies their preferences, dispatches notifications, and never reveals accept/decline outcome in the message body

### Requirement: VAPID and service-role secrets
The Worker SHALL use Supabase service-role credentials to read profiles and push subscriptions, and SHALL use VAPID credentials to sign Web Push requests.

#### Scenario: Missing required secret
- **WHEN** any of `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, or any of the four `BREVO_TEMPLATE_FRIEND_*` IDs is missing at startup
- **THEN** the Worker rejects notification requests with 500 and logs a configuration error

### Requirement: Stale endpoint pruning
The Worker SHALL delete `push_subscriptions` rows when the Web Push service returns 404 or 410 for that endpoint.

#### Scenario: Push returns 410
- **WHEN** dispatching to a stored endpoint returns HTTP 410
- **THEN** the row identified by that endpoint is deleted before the Worker returns
