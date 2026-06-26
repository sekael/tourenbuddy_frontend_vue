<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useLogger } from '@/core/logging/use-logger'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { COLLISION_RADIUS_M } from '@/features/tours/domain/collision'
import { isSameGoal } from '@/features/tours/domain/distance'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{
  /** The currently open tour (caller-owned). */
  ownTourId: string
}>()

const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('collision-notice')
const toursStore = useToursStore()
const tourLinksStore = useTourLinksStore()
const friendshipsStore = useFriendshipsStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { requestsByTourId, groupIdByTourId, members, pendingRequests } = storeToRefs(tourLinksStore)
const { userIdToNamesMap, friendUserIds } = storeToRefs(friendshipsStore)

// Defensive: friend-tours has no realtime sub yet (#198). Refresh on mount so
// a freshly-saved owner-tour can see colliding friend tours without page reload.
toursStore.loadFriendTours()

// Realtime gap: RLS on tour_link_member hides rows for groups the viewer has
// no tour in. So when two friends form a group between themselves, Postgres
// realtime never delivers that INSERT to this user — the merge-blocked
// disclaimer would stay stale until reload. Refetching tour-links on mount
// and on tour switch reconciles the friend-group map opportunistically.
tourLinksStore.fetchAll()
watch(
  () => props.ownTourId,
  () => {
    tourLinksStore.fetchAll()
    toursStore.loadFriendTours()
  },
)

// When the tour-links state shifts (link request created/accepted/declined,
// member added/removed, group dissolved), the friend's own tour visibility may
// have flipped to private as part of the same server-side transition (e.g.
// fn_evict_member_on_tour_change runs because A flipped friends→private). The
// tour_link_member DELETE event delivered to this client doesn't carry the new
// visibility, and an UPDATE on tours with NEW=private is not delivered (RLS
// blocks select on private friend tour). So piggyback a friend-tours refresh
// here to make sure the link button never lingers for a now-private tour.
watch(
  [members, pendingRequests],
  () => { toursStore.loadFriendTours() },
)

const submitting = ref<string | null>(null)
const submitError = ref<string | null>(null)

// Persistence keys for the merge-blocked disclaimer.
const FOREVER_HIDE_KEY = 'tourLinks.mergeBlockedDisclaimer.hide'
const sessionHideKey = (tourId: string) => `tourLinks.mergeBlockedDisclaimer.dismissed.${tourId}`

const foreverHidden = ref(safeLocalGet(FOREVER_HIDE_KEY) === '1')
const sessionDismissed = ref(safeSessionGet(sessionHideKey(props.ownTourId)) === '1')
const doNotShowAgain = ref(false)

// Tour switch inside same sheet instance → re-evaluate dismissal for new id.
watch(
  () => props.ownTourId,
  (id) => {
    sessionDismissed.value = safeSessionGet(sessionHideKey(id)) === '1'
    doNotShowAgain.value = false
  },
)

/**
 * Eligible friend tours partition into two buckets:
 *  - linkable: no group conflict (friend ungrouped OR same group as caller)
 *  - blocked: both tours sit in DIFFERENT groups → DB rejects merge (`tour_link.merge_forbidden`)
 * `friendTours` is already RLS-scoped to friends, so no friendship check here.
 */
const partitioned = computed(() => {
  const own = tours.value.find(t => t.id === props.ownTourId)
  const empty = { linkable: [], blocked: [] } as { linkable: typeof friendTours.value, blocked: typeof friendTours.value }
  if (!own || own.visibility !== 'friends' || !own.tourType)
    return empty

  const myGroupId = groupIdByTourId.value.get(props.ownTourId)
  const myPendings = requestsByTourId.value.get(props.ownTourId) ?? []
  const pendingFriendTourIds = new Set(
    myPendings.flatMap(r => [r.initiatorTourId, r.targetTourId]).filter(id => id !== props.ownTourId),
  )

  const linkable: typeof friendTours.value = []
  const blocked: typeof friendTours.value = []
  for (const f of friendTours.value) {
    if (f.tourType !== own.tourType)
      continue
    // Belt-and-suspenders: friend_tours_view already filters by visibility
    // 'friends' AND an active friendship row; re-check client-side so a
    // momentarily stale cache (post visibility-flip, pre next loadFriendTours)
    // never offers a link to a now-private or now-ex-friend tour.
    if (f.visibility !== 'friends')
      continue
    if (!friendUserIds.value.has(f.userId))
      continue
    if (!isSameGoal(own.goal, f.goal, COLLISION_RADIUS_M))
      continue
    if (pendingFriendTourIds.has(f.id))
      continue

    // Merge-forbidden is the ONLY group-related blocker. It requires BOTH tours
    // to sit in groups AND the groups to differ. Every other shape (own
    // ungrouped, friend ungrouped, both ungrouped, both in same group) is fine
    // for the DB — either it adds the loner to the existing group, or creates
    // a fresh one. Same-group is "already linked" not "blocked" — skip silently.
    if (!myGroupId) {
      linkable.push(f)
      continue
    }
    const friendGroupId = groupIdByTourId.value.get(f.id)
    if (!friendGroupId) {
      linkable.push(f)
      continue
    }
    if (friendGroupId === myGroupId)
      continue
    blocked.push(f)
  }
  return { linkable, blocked }
})

const linkableCandidates = computed(() => partitioned.value.linkable)
const blockedCandidates = computed(() => partitioned.value.blocked)

const showBlockedDisclaimer = computed(() =>
  blockedCandidates.value.length > 0 && !foreverHidden.value && !sessionDismissed.value,
)

function nameFor(userId: string): string {
  const name = userIdToNamesMap.value.get(userId)
  return [name?.firstName, name?.lastName].filter(Boolean).join(' ') || t('tours.infoSheet.unnamedTour')
}

const linkableNames = computed(() => linkableCandidates.value.map(f => nameFor(f.userId)))
const blockedNames = computed(() => blockedCandidates.value.map(f => nameFor(f.userId)))

// Ensure owner profile names are resolved for each candidate (linkable + blocked).
watch(
  () => [...linkableCandidates.value, ...blockedCandidates.value],
  (list) => {
    const missing = [...new Set(list.map(f => f.userId))].filter(
      id => !userIdToNamesMap.value.has(id),
    )
    if (missing.length > 0)
      friendshipsStore.getNamesByUserIds(missing)
  },
  { immediate: true },
)

async function requestLink(friendTourId: string) {
  submitting.value = friendTourId
  submitError.value = null
  try {
    await tourLinksStore.createRequest(props.ownTourId, friendTourId)
  }
  catch (err) {
    logger.error('createRequest failed', err)
    submitError.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    submitting.value = null
  }
}

function dismissBlocked() {
  if (doNotShowAgain.value) {
    safeLocalSet(FOREVER_HIDE_KEY, '1')
    foreverHidden.value = true
  }
  else {
    safeSessionSet(sessionHideKey(props.ownTourId), '1')
    sessionDismissed.value = true
  }
}

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}
function safeLocalSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val)
  }
  catch {
    // ignore quota / privacy mode
  }
}
function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    return null
  }
}
function safeSessionSet(key: string, val: string) {
  try {
    sessionStorage.setItem(key, val)
  }
  catch {
    // ignore
  }
}
</script>

<template>
  <section v-if="linkableCandidates.length > 0" class="collision-notice">
    <div class="header">
      <BaseIcon name="link" class="icon" />
      <span class="title">{{ t('tourLinks.collisionNoticeTitle') }}</span>
    </div>
    <p class="body">
      {{ t('tourLinks.collisionNoticeBody', { names: linkableNames.join(', ') }) }}
    </p>
    <div class="actions">
      <BaseButton
        v-for="(f, idx) in linkableCandidates"
        :key="f.id"
        variant="primary-outline"
        size="sm"
        :disabled="submitting !== null"
        @click="requestLink(f.id)"
      >
        {{
          submitting === f.id
            ? t('tourLinks.requestingBtn')
            : t('tourLinks.requestToLinkBtn', { name: linkableNames[idx] })
        }}
      </BaseButton>
    </div>
    <p v-if="submitError" class="error">
      {{ submitError }}
    </p>
  </section>

  <section v-if="showBlockedDisclaimer" class="collision-notice collision-notice--blocked">
    <div class="header">
      <BaseIcon name="info" class="icon" />
      <span class="title">{{ t('tourLinks.mergeBlockedTitle') }}</span>
    </div>
    <p class="body">
      {{ t('tourLinks.mergeBlockedBody', { names: blockedNames.join(', ') }) }}
    </p>
    <label class="dont-show">
      <input v-model="doNotShowAgain" type="checkbox">
      <span>{{ t('tourLinks.doNotShowAgain') }}</span>
    </label>
    <div class="actions">
      <BaseButton variant="primary-outline" size="sm" @click="dismissBlocked">
        {{ t('tourLinks.dismissBtn') }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.collision-notice {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

.collision-notice--blocked {
  border-left-color: var(--color-on-surface-variant);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.icon {
  font-size: 18px;
}

.title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.body {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.dont-show {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
}
</style>
