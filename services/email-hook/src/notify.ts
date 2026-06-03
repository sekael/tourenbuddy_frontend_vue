import type { Env } from './config'
import { verifySupabaseJwt } from './auth'
import { jsonResponse, resolveLocale } from './config'
import { sendFriendNotificationEmail, sendTourNotificationEmail } from './email'
import { dispatchPushToUser } from './push'

interface FriendRequestRow {
  id: string
  from_user_id: string
  to_user_id: string
}

interface UserProfileRow {
  id: string
  notif_push_enabled: boolean
  notif_email_enabled: boolean
  notif_muted_types: string[]
  locale: string | null
}

interface AuthUserRow {
  id: string
  email: string
}

async function fetchFriendRequest(requestId: string, env: Env): Promise<FriendRequestRow | null> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/friend_requests?id=eq.${encodeURIComponent(requestId)}&select=id,from_user_id,to_user_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return null
  const rows = (await res.json()) as FriendRequestRow[]
  return rows[0] ?? null
}

async function fetchUserProfile(userId: string, env: Env): Promise<UserProfileRow | null> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_profile?id=eq.${encodeURIComponent(userId)}&select=id,notif_push_enabled,notif_email_enabled,notif_muted_types,locale`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return null
  const rows = (await res.json()) as UserProfileRow[]
  return rows[0] ?? null
}

async function fetchUserEmail(userId: string, env: Env): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok)
    return null
  const user = (await res.json()) as AuthUserRow
  return user.email ?? null
}

async function fetchActorDisplayName(actorId: string, env: Env): Promise<string> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_profile?id=eq.${encodeURIComponent(actorId)}&select=first_name,last_name`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return 'Someone'
  const rows = (await res.json()) as Array<{ first_name: string | null, last_name: string | null }>
  const row = rows[0]
  if (!row)
    return 'Someone'
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ')
  return name || 'Someone'
}

const DEFAULT_APP_URL = 'https://test.tourenbuddy.ch'
const FRIEND_REQUESTS_MUTE_TYPE = 'friend_requests'

function pushTitleFor(event: 'received' | 'responded', locale: 'en' | 'de'): string {
  if (locale === 'de')
    return event === 'received' ? 'Neue Freundschaftsanfrage' : 'Antwort auf Freundschaftsanfrage'
  return event === 'received' ? 'New friend request' : 'Friend request update'
}

function pushBodyFor(
  event: 'received' | 'responded',
  locale: 'en' | 'de',
  actorName: string,
): string {
  if (locale === 'de') {
    return event === 'received'
      ? `${actorName} möchte sich mit dir verbinden.`
      : `${actorName} hat auf deine Anfrage geantwortet.`
  }
  return event === 'received'
    ? `${actorName} wants to connect.`
    : `${actorName} responded to your request.`
}

async function dispatchToRecipient(
  recipientId: string,
  actorId: string,
  event: 'received' | 'responded',
  env: Env,
): Promise<void> {
  const [recipientProfile, actorName, recipientEmail] = await Promise.all([
    fetchUserProfile(recipientId, env),
    fetchActorDisplayName(actorId, env),
    fetchUserEmail(recipientId, env),
  ])

  if (!recipientProfile)
    return

  const appUrl = env.APP_URL || DEFAULT_APP_URL

  // Check if type is muted
  if (recipientProfile.notif_muted_types.includes(FRIEND_REQUESTS_MUTE_TYPE))
    return

  const locale = resolveLocale(recipientProfile.locale)
  const pushTitle = pushTitleFor(event, locale)
  const pushBody = pushBodyFor(event, locale, actorName)

  const dispatchTasks: Promise<void>[] = []

  if (recipientProfile.notif_push_enabled) {
    dispatchTasks.push(
      dispatchPushToUser(
        recipientId,
        { title: pushTitle, body: pushBody, url: `${appUrl}/?friendRequests=1` },
        env,
      ),
    )
  }

  if (recipientProfile.notif_email_enabled && recipientEmail) {
    dispatchTasks.push(
      sendFriendNotificationEmail(
        {
          toEmail: recipientEmail,
          locale: recipientProfile.locale,
          actorName,
          appUrl,
          event,
        },
        env,
      ),
    )
  }

  await Promise.all(dispatchTasks)
}

function missingConfigKeys(env: Env): string[] {
  const required: Array<keyof Env> = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
  ]
  return required.filter(k => !env[k])
}

async function handle(
  request: Request,
  env: Env,
  event: 'received' | 'responded',
): Promise<Response> {
  const missing = missingConfigKeys(env)
  if (missing.length > 0) {
    console.error(`[notify/${event}] missing config:`, missing)
    return jsonResponse(500, { error: 'missing_configuration', missing })
  }

  const callerId = await verifySupabaseJwt(request, env)
  if (!callerId)
    return jsonResponse(401, { error: 'unauthorized' })

  let body: { friendshipId?: string }
  try {
    body = (await request.json()) as { friendshipId?: string }
  }
  catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  const requestId = body.friendshipId
  if (!requestId)
    return jsonResponse(400, { error: 'missing_request_id' })

  const friendRequest = await fetchFriendRequest(requestId, env)
  if (!friendRequest)
    return jsonResponse(404, { error: 'friend_request_not_found' })

  const expectedCaller
    = event === 'received' ? friendRequest.from_user_id : friendRequest.to_user_id
  if (expectedCaller !== callerId)
    return jsonResponse(403, { error: 'forbidden' })

  const recipientId = event === 'received' ? friendRequest.to_user_id : friendRequest.from_user_id

  // Sub-routine A: the existing per-event responded/received notification.
  try {
    await dispatchToRecipient(recipientId, callerId, event, env)
  }
  catch (err) {
    console.error(`[notify/${event}] dispatch failed:`, err)
    // Don't return — sub-routine B must still run independently.
  }

  // Sub-routine B: friendship-accept backfill digest (responded path only).
  if (event === 'responded') {
    try {
      await dispatchBackfillDigest(friendRequest, env)
    }
    catch (err) {
      console.error('[notify/responded] backfill digest failed:', err)
    }
  }

  return jsonResponse(200)
}

export async function handleFriendRequestReceived(request: Request, env: Env): Promise<Response> {
  return handle(request, env, 'received')
}

export async function handleFriendRequestResponded(request: Request, env: Env): Promise<Response> {
  return handle(request, env, 'responded')
}

// ── Shared-tour notifications ────────────────────────────────────────────────

interface TourRow {
  id: string
  user_id: string
  visibility: string
  name: string | null
}

type TourChangeAction = 'created' | 'updated' | 'deleted'

async function fetchTour(tourId: string, env: Env): Promise<TourRow | null> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tours?id=eq.${encodeURIComponent(tourId)}&select=id,user_id,visibility,name`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return null
  const rows = (await res.json()) as TourRow[]
  return rows[0] ?? null
}

/** Resolve the tour's partner contacts to registered user ids via the DB helper. */
async function resolveTourPartnerUserIds(tourId: string, env: Env): Promise<string[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/tour_partner_user_ids`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tour_id: tourId }),
  })
  if (!res.ok)
    return []
  return (await res.json()) as string[]
}

/**
 * Resolve cached partner contact ids to registered user ids via the contact-rooted
 * helper (used by the 'deleted' path, where the tour row no longer exists). Mirrors
 * resolveTourPartnerUserIds but keyed on contact ids that outlive the tour.
 */
async function resolveUsersByContactIds(contactIds: string[], env: Env): Promise<string[]> {
  if (contactIds.length === 0)
    return []
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/users_by_contact_ids`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_contact_ids: contactIds }),
  })
  if (!res.ok)
    return []
  return (await res.json()) as string[]
}

/** The set of user ids the given user has an accepted friendship with. */
async function fetchFriendUserIds(userId: string, env: Env): Promise<Set<string>> {
  const enc = encodeURIComponent(userId)
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/friendships?or=(request_user_id.eq.${enc},response_user_id.eq.${enc})&select=request_user_id,response_user_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return new Set()
  const rows = (await res.json()) as Array<{ request_user_id: string, response_user_id: string }>
  const ids = new Set<string>()
  for (const r of rows)
    ids.add(r.request_user_id === userId ? r.response_user_id : r.request_user_id)
  return ids
}

function tourPushTitle(
  type: 'tour_updates' | 'tour_interest',
  action: string,
  locale: 'en' | 'de',
): string {
  if (type === 'tour_interest') {
    if (locale === 'de') {
      switch (action) {
        case 'collision': return 'Gleiche Tour geplant'
        case 'link_created': return 'Verknüpfungsanfrage erhalten'
        case 'link_accepted': return 'Tour verknüpft'
        case 'link_declined': return 'Verknüpfung abgelehnt'
        case 'group_joined': return 'Neue Tour in deiner Verknüpfung'
        case 'group_evicted_external': return 'Tour aus Verknüpfung entfernt'
        case 'group_dissolved': return 'Verknüpfung aufgelöst'
        default: return 'Update zu deiner Tour'
      }
    }
    switch (action) {
      case 'collision': return 'Same tour planned'
      case 'link_created': return 'Link request received'
      case 'link_accepted': return 'Tour linked'
      case 'link_declined': return 'Link request declined'
      case 'group_joined': return 'New tour in your link'
      case 'group_evicted_external': return 'Tour removed from link'
      case 'group_dissolved': return 'Tour link dissolved'
      default: return 'Update on your tour'
    }
  }
  if (locale === 'de') {
    return action === 'created'
      ? 'Neue geteilte Tour'
      : action === 'deleted'
        ? 'Geteilte Tour entfernt'
        : 'Geteilte Tour aktualisiert'
  }
  return action === 'created'
    ? 'New shared tour'
    : action === 'deleted'
      ? 'Shared tour removed'
      : 'Shared tour updated'
}

function tourPushBody(
  type: 'tour_updates' | 'tour_interest',
  action: string,
  locale: 'en' | 'de',
  actorName: string,
  tourName: string,
): string {
  const tour = tourName || (locale === 'de' ? 'eine Tour' : 'a tour')
  if (type === 'tour_interest') {
    if (locale === 'de') {
      switch (action) {
        case 'collision': return `${actorName} hat dieselbe Tour wie «${tour}» geplant.`
        case 'link_created': return `${actorName} möchte «${tour}» mit dir verknüpfen.`
        case 'link_accepted': return `${actorName} hat deine Verknüpfungsanfrage für «${tour}» angenommen.`
        case 'link_declined': return `${actorName} hat deine Verknüpfungsanfrage für «${tour}» abgelehnt.`
        case 'group_joined': return `${actorName} hat eine Tour zur Verknüpfung mit «${tour}» hinzugefügt.`
        case 'group_evicted_external': return `Eine Tour wurde aus der Verknüpfung mit «${tour}» entfernt.`
        case 'group_dissolved': return `Die Verknüpfung für «${tour}» wurde aufgelöst.`
        default: return `${actorName} hat «${tour}» aktualisiert.`
      }
    }
    switch (action) {
      case 'collision': return `${actorName} planned the same tour as “${tour}”.`
      case 'link_created': return `${actorName} wants to link “${tour}” with their tour.`
      case 'link_accepted': return `${actorName} accepted your link request for “${tour}”.`
      case 'link_declined': return `${actorName} declined your link request for “${tour}”.`
      case 'group_joined': return `${actorName} added a tour to your link for “${tour}”.`
      case 'group_evicted_external': return `A tour was removed from the link for “${tour}”.`
      case 'group_dissolved': return `The link for “${tour}” was dissolved.`
      default: return `${actorName} updated “${tour}”.`
    }
  }
  if (locale === 'de') {
    return action === 'created'
      ? `${actorName} hat «${tour}» mit dir geteilt.`
      : action === 'deleted'
        ? `${actorName} hat «${tour}» entfernt.`
        : `${actorName} hat «${tour}» aktualisiert.`
  }
  return action === 'created'
    ? `${actorName} shared “${tour}” with you.`
    : action === 'deleted'
      ? `${actorName} removed “${tour}”.`
      : `${actorName} updated “${tour}”.`
}

async function dispatchTourNotification(
  recipientId: string,
  actorId: string,
  opts: { type: 'tour_updates' | 'tour_interest', action: string, tourName: string },
  env: Env,
): Promise<void> {
  const [recipientProfile, actorName, recipientEmail] = await Promise.all([
    fetchUserProfile(recipientId, env),
    fetchActorDisplayName(actorId, env),
    fetchUserEmail(recipientId, env),
  ])

  if (!recipientProfile)
    return
  if (recipientProfile.notif_muted_types.includes(opts.type))
    return

  const appUrl = env.APP_URL || DEFAULT_APP_URL
  const locale = resolveLocale(recipientProfile.locale)
  const pushTitle = tourPushTitle(opts.type, opts.action, locale)
  const pushBody = tourPushBody(opts.type, opts.action, locale, actorName, opts.tourName)

  const tasks: Promise<void>[] = []

  if (recipientProfile.notif_push_enabled) {
    tasks.push(
      dispatchPushToUser(
        recipientId,
        { title: pushTitle, body: pushBody, url: `${appUrl}/?tours=1` },
        env,
      ),
    )
  }

  if (recipientProfile.notif_email_enabled && recipientEmail) {
    tasks.push(
      sendTourNotificationEmail(
        {
          toEmail: recipientEmail,
          locale: recipientProfile.locale,
          type: opts.type,
          action: opts.action,
          actorName,
          tourName: opts.tourName,
          appUrl,
        },
        env,
      ),
    )
  }

  await Promise.all(tasks)
}

/**
 * Notify friend partners that a shared tour changed. Caller MUST be the tour owner.
 * Recipients = tour partner users ∩ owner's friends, minus the actor. Private tours
 * notify no one. Note: for 'deleted', resolution is best-effort — the client fires
 * before deleting the row, but the row may already be gone (returns 404).
 */
export async function handleTourChanged(request: Request, env: Env): Promise<Response> {
  const missing = missingConfigKeys(env)
  if (missing.length > 0)
    return jsonResponse(500, { error: 'missing_configuration', missing })

  const callerId = await verifySupabaseJwt(request, env)
  if (!callerId)
    return jsonResponse(401, { error: 'unauthorized' })

  let body: {
    tourId?: string
    action?: TourChangeAction
    partnerContactIds?: string[]
    tourName?: string
  }
  try {
    body = (await request.json()) as typeof body
  }
  catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  if (!body.action)
    return jsonResponse(400, { error: 'missing_fields' })

  // 'deleted' can't read the tour (it's gone) — resolve from the cached partner
  // contact ids the client sent. Created/updated still resolve off the live row.
  if (body.action === 'deleted')
    return handleTourDeleted(body, callerId, env)

  if (!body.tourId)
    return jsonResponse(400, { error: 'missing_fields' })

  const tour = await fetchTour(body.tourId, env)
  if (!tour)
    return jsonResponse(404, { error: 'tour_not_found' })
  if (tour.user_id !== callerId)
    return jsonResponse(403, { error: 'forbidden' })
  if (tour.visibility !== 'friends')
    return jsonResponse(200, { skipped: 'private' })

  const [partnerIds, friendIds] = await Promise.all([
    resolveTourPartnerUserIds(tour.id, env),
    fetchFriendUserIds(tour.user_id, env),
  ])
  const recipients = partnerIds.filter(id => friendIds.has(id) && id !== callerId)

  try {
    await Promise.all(
      recipients.map(r =>
        dispatchTourNotification(
          r,
          callerId,
          { type: 'tour_updates', action: body.action!, tourName: tour.name ?? '' },
          env,
        ),
      ),
    )
  }
  catch (err) {
    console.error('[notify/tour-changed] dispatch failed:', err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200, { notified: recipients.length })
}

/**
 * Resolve + dispatch for the 'deleted' action, where the tour row is already gone.
 * Recipients are re-resolved server-side from the cached partner contact ids
 * (contact_methods/friendships outlive the tour), so authorization stays off the
 * client: the blast radius is bounded by the caller's own friendships.
 */
async function handleTourDeleted(
  body: { partnerContactIds?: string[], tourName?: string },
  callerId: string,
  env: Env,
): Promise<Response> {
  if (!body.partnerContactIds || body.partnerContactIds.length === 0) {
    return jsonResponse(200, { skipped: 'no_partners' })
  }

  const [partnerIds, friendIds] = await Promise.all([
    resolveUsersByContactIds(body.partnerContactIds, env),
    fetchFriendUserIds(callerId, env),
  ])

  const recipients = partnerIds.filter(id => friendIds.has(id) && id !== callerId)

  try {
    await Promise.all(
      recipients.map(r =>
        dispatchTourNotification(
          r,
          callerId,
          { type: 'tour_updates', action: 'deleted', tourName: body.tourName ?? '' },
          env,
        ),
      ),
    )
  }
  catch (err) {
    console.error('[notify/tour-changed] dispatch failed:', err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200, { notified: recipients.length })
}

// ── Collision-detected scan (post-save) ──────────────────────────────────────

interface CollisionRow {
  other_tour_id: string
  other_user_id: string
  other_tour_name: string | null
}

async function scanCollisionsForTour(tourId: string, env: Env): Promise<CollisionRow[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/fn_scan_collisions_for_tour`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tour_id: tourId }),
  })
  if (!res.ok)
    return []
  return (await res.json()) as CollisionRow[]
}

/**
 * Scan for friend-owned tours colliding with the just-saved tour, dispatch a
 * tour_interest notification to each colliding owner. Replaces the legacy
 * "decline duplicate → signal interest" flow. Authorized: caller must own the tour.
 */
export async function handleTourInterest(request: Request, env: Env): Promise<Response> {
  const missing = missingConfigKeys(env)
  if (missing.length > 0)
    return jsonResponse(500, { error: 'missing_configuration', missing })

  const callerId = await verifySupabaseJwt(request, env)
  if (!callerId)
    return jsonResponse(401, { error: 'unauthorized' })

  let body: { tourId?: string }
  try {
    body = (await request.json()) as { tourId?: string }
  }
  catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  if (!body.tourId)
    return jsonResponse(400, { error: 'missing_fields' })

  const tour = await fetchTour(body.tourId, env)
  if (!tour)
    return jsonResponse(404, { error: 'tour_not_found' })
  if (tour.user_id !== callerId)
    return jsonResponse(403, { error: 'forbidden' })
  if (tour.visibility !== 'friends')
    return jsonResponse(200, { skipped: 'private', notified: 0 })

  const collisions = await scanCollisionsForTour(tour.id, env)
  if (collisions.length === 0)
    return jsonResponse(200, { notified: 0 })

  try {
    await Promise.all(
      collisions.map(c =>
        dispatchTourNotification(
          c.other_user_id,
          callerId,
          { type: 'tour_interest', action: 'collision', tourName: tour.name ?? '' },
          env,
        ),
      ),
    )
  }
  catch (err) {
    console.error('[notify/tour-interest] dispatch failed:', err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200, { notified: collisions.length })
}

// ── Friendship-accept backfill digest ────────────────────────────────────────

async function scanBackfillCollisions(
  userA: string,
  userB: string,
  env: Env,
): Promise<Array<{ a_tour_id: string, b_tour_id: string }>> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/fn_scan_backfill_collisions`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_a: userA, p_user_b: userB }),
  })
  if (!res.ok)
    return []
  return (await res.json()) as Array<{ a_tour_id: string, b_tour_id: string }>
}

async function dispatchBackfillDigestTo(
  recipientId: string,
  friendId: string,
  friendshipId: string,
  collisionCount: number,
  env: Env,
): Promise<void> {
  const [recipientProfile, friendName, recipientEmail] = await Promise.all([
    fetchUserProfile(recipientId, env),
    fetchActorDisplayName(friendId, env),
    fetchUserEmail(recipientId, env),
  ])

  if (!recipientProfile)
    return
  if (recipientProfile.notif_muted_types.includes('tour_interest'))
    return

  const appUrl = env.APP_URL || DEFAULT_APP_URL
  const locale = resolveLocale(recipientProfile.locale)
  const title = locale === 'de'
    ? 'Gemeinsame Touren mit neuem Freund'
    : 'Shared tours with new friend'
  const bodyText = locale === 'de'
    ? `${collisionCount} deiner Touren überschneiden sich mit Touren von ${friendName}.`
    : `${collisionCount} of your tours overlap with ${friendName}'s tours.`
  const url = `${appUrl}/friends/${friendshipId}/backfill-collisions`

  const tasks: Promise<void>[] = []
  if (recipientProfile.notif_push_enabled)
    tasks.push(dispatchPushToUser(recipientId, { title, body: bodyText, url }, env))

  if (recipientProfile.notif_email_enabled && recipientEmail) {
    tasks.push(
      sendTourNotificationEmail(
        {
          toEmail: recipientEmail,
          locale: recipientProfile.locale,
          type: 'tour_interest',
          action: 'backfill_digest',
          actorName: friendName,
          tourName: String(collisionCount),
          appUrl: url,
        },
        env,
      ),
    )
  }

  await Promise.all(tasks)
}

async function dispatchBackfillDigest(
  friendRequest: FriendRequestRow,
  env: Env,
): Promise<void> {
  const collisions = await scanBackfillCollisions(
    friendRequest.from_user_id,
    friendRequest.to_user_id,
    env,
  )
  if (collisions.length === 0)
    return

  // Per-side counts (a_tour_id always belongs to from_user_id by RPC contract).
  const countForFrom = collisions.length
  const countForTo = collisions.length

  await Promise.all([
    dispatchBackfillDigestTo(
      friendRequest.from_user_id,
      friendRequest.to_user_id,
      friendRequest.id,
      countForFrom,
      env,
    ),
    dispatchBackfillDigestTo(
      friendRequest.to_user_id,
      friendRequest.from_user_id,
      friendRequest.id,
      countForTo,
      env,
    ),
  ])
}

// ── Link-request lifecycle ────────────────────────────────────────────────────

interface LinkRequestRow {
  id: string
  initiator_tour_id: string
  target_tour_id: string
  status: string
}

async function fetchLinkRequest(id: string, env: Env): Promise<LinkRequestRow | null> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tour_link_request?id=eq.${encodeURIComponent(id)}&select=id,initiator_tour_id,target_tour_id,status`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return null
  const rows = (await res.json()) as LinkRequestRow[]
  return rows[0] ?? null
}

/**
 * Dispatch a tour_interest notification for a link-request lifecycle event.
 * Authorized by JWT subject matching the event actor (initiator for `created`,
 * target for `accepted`/`declined`). Withdraws SHALL NOT trigger dispatch.
 */
export async function handleLinkRequestEvent(request: Request, env: Env): Promise<Response> {
  const missing = missingConfigKeys(env)
  if (missing.length > 0)
    return jsonResponse(500, { error: 'missing_configuration', missing })

  const callerId = await verifySupabaseJwt(request, env)
  if (!callerId)
    return jsonResponse(401, { error: 'unauthorized' })

  let body: { requestId?: string, event?: 'created' | 'accepted' | 'declined' }
  try {
    body = (await request.json()) as typeof body
  }
  catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  if (!body.requestId || !body.event)
    return jsonResponse(400, { error: 'missing_fields' })
  if (!['created', 'accepted', 'declined'].includes(body.event))
    return jsonResponse(400, { error: 'invalid_event' })

  const req = await fetchLinkRequest(body.requestId, env)
  if (!req)
    return jsonResponse(404, { error: 'request_not_found' })

  const [initiator, target] = await Promise.all([
    fetchTour(req.initiator_tour_id, env),
    fetchTour(req.target_tour_id, env),
  ])
  if (!initiator || !target)
    return jsonResponse(404, { error: 'tour_not_found' })

  // Authorize and pick recipient.
  let recipientId: string
  let actorId: string
  let targetTourName: string
  if (body.event === 'created') {
    if (initiator.user_id !== callerId)
      return jsonResponse(403, { error: 'forbidden' })
    recipientId = target.user_id
    actorId = initiator.user_id
    targetTourName = target.name ?? ''
  }
  else {
    if (target.user_id !== callerId)
      return jsonResponse(403, { error: 'forbidden' })
    recipientId = initiator.user_id
    actorId = target.user_id
    targetTourName = initiator.name ?? ''
  }

  try {
    await dispatchTourNotification(
      recipientId,
      actorId,
      { type: 'tour_interest', action: `link_${body.event}`, tourName: targetTourName },
      env,
    )
  }
  catch (err) {
    console.error('[notify/link-request-event] dispatch failed:', err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200)
}

// ── Group membership change ──────────────────────────────────────────────────

interface GroupMemberRow {
  tour_id: string
  user_id: string
}

async function fetchGroupMembers(groupId: string, env: Env): Promise<GroupMemberRow[]> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tour_link_member?group_id=eq.${encodeURIComponent(groupId)}&select=tour_id,tours!inner(user_id)`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok)
    return []
  const rows = (await res.json()) as Array<{ tour_id: string, tours: { user_id: string } }>
  return rows.map(r => ({ tour_id: r.tour_id, user_id: r.tours.user_id }))
}

/**
 * Notify members of a group about a membership change.
 * - joined: notify ALL current members (newcomer included) about the new tour;
 *   the actor (acceptor) is dropped via the callerId match.
 * - evicted_external: notify the evicted user + remaining members; self-eviction
 *   (own confirmed edit) suppresses the self-notify via the callerId match.
 * - dissolved: notify the lone remaining member.
 */
export async function handleGroupMembershipEvent(request: Request, env: Env): Promise<Response> {
  const missing = missingConfigKeys(env)
  if (missing.length > 0)
    return jsonResponse(500, { error: 'missing_configuration', missing })

  const callerId = await verifySupabaseJwt(request, env)
  if (!callerId)
    return jsonResponse(401, { error: 'unauthorized' })

  let body: {
    groupId?: string
    event?: 'joined' | 'evicted_external' | 'dissolved'
    actorTourId?: string
    affectedTourId?: string
    affectedUserId?: string
    /**
     * Explicit recipient list. Required for events fired AFTER the group
     * was already cascade-dissolved (friendship-delete trigger path), since
     * a live fetch then returns zero members. When provided, the live fetch
     * is skipped and the membership matrix is bypassed.
     */
    recipients?: string[]
    /**
     * userId → recipient's own tour name in this group; used for the
     * `{tour}` placeholder in push/email copy.
     */
    recipientTourNames?: Record<string, string>
  }
  try {
    body = (await request.json()) as typeof body
  }
  catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  if (!body.groupId || !body.event)
    return jsonResponse(400, { error: 'missing_fields' })

  let recipients: string[] = []
  if (body.recipients && body.recipients.length > 0) {
    recipients = body.recipients
  }
  else {
    const members = await fetchGroupMembers(body.groupId, env)
    if (body.event === 'joined') {
      // All current members, newcomer included. The client fires this only after
      // the join commits, so the live fetch already contains the newcomer. The
      // actor (acceptor) is dropped below by the universal callerId filter.
      recipients = members.map(m => m.user_id)
    }
    else if (body.event === 'evicted_external') {
      recipients = members.map(m => m.user_id)
      if (body.affectedUserId && body.affectedUserId !== callerId)
        recipients.push(body.affectedUserId)
    }
    else if (body.event === 'dissolved') {
      recipients = members.map(m => m.user_id)
    }
  }

  const tourNames = body.recipientTourNames ?? {}

  // Dedupe + drop the actor (their own action).
  recipients = Array.from(new Set(recipients)).filter(id => id !== callerId)
  if (recipients.length === 0)
    return jsonResponse(200, { notified: 0 })

  try {
    await Promise.all(
      recipients.map(r =>
        dispatchTourNotification(
          r,
          callerId,
          { type: 'tour_interest', action: `group_${body.event}`, tourName: tourNames[r] ?? '' },
          env,
        ),
      ),
    )
  }
  catch (err) {
    console.error('[notify/group-membership] dispatch failed:', err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200, { notified: recipients.length })
}
