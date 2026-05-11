import type { Env } from './config'
import { verifySupabaseJwt } from './auth'
import { jsonResponse, resolveLocale } from './config'
import { sendFriendNotificationEmail } from './email'
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
  const res = await fetch(
    `${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
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

function pushBodyFor(event: 'received' | 'responded', locale: 'en' | 'de', actorName: string): string {
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
      dispatchPushToUser(recipientId, { title: pushTitle, body: pushBody, url: `${appUrl}/?friendRequests=1` }, env),
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

  const expectedCaller = event === 'received' ? friendRequest.from_user_id : friendRequest.to_user_id
  if (expectedCaller !== callerId)
    return jsonResponse(403, { error: 'forbidden' })

  const recipientId = event === 'received' ? friendRequest.to_user_id : friendRequest.from_user_id

  try {
    await dispatchToRecipient(recipientId, callerId, event, env)
  }
  catch (err) {
    console.error(`[notify/${event}] dispatch failed:`, err)
    return jsonResponse(500, { error: 'dispatch_failed', message: (err as Error).message })
  }

  return jsonResponse(200)
}

export async function handleFriendRequestReceived(request: Request, env: Env): Promise<Response> {
  return handle(request, env, 'received')
}

export async function handleFriendRequestResponded(request: Request, env: Env): Promise<Response> {
  return handle(request, env, 'responded')
}
