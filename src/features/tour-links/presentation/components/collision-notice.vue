<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
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
const { requestsByTourId, groupIdByTourId } = storeToRefs(tourLinksStore)
const { userIdToNamesMap } = storeToRefs(friendshipsStore)

// Defensive: friend-tours has no realtime sub yet (#198). Refresh on mount so
// a freshly-saved owner-tour can see colliding friend tours without page reload.
toursStore.loadFriendTours()

const submitting = ref<string | null>(null)
const submitError = ref<string | null>(null)

/**
 * Eligible friend tours for linking: same goal within 100 m, same non-null
 * tour_type, both friends-visible, AND not already linked / pending with us.
 * We don't check friendship here — `friendTours` is already RLS-scoped to friends.
 */
const candidates = computed(() => {
  const own = tours.value.find(t => t.id === props.ownTourId)
  if (!own || own.visibility !== 'friends' || !own.tourType)
    return []

  const myGroupId = groupIdByTourId.value.get(props.ownTourId)
  const myPendings = requestsByTourId.value.get(props.ownTourId) ?? []
  const pendingFriendTourIds = new Set(
    myPendings.flatMap(r => [r.initiatorTourId, r.targetTourId]).filter(id => id !== props.ownTourId),
  )

  return friendTours.value.filter((f) => {
    if (f.tourType !== own.tourType)
      return false
    if (f.visibility !== 'friends')
      return false
    if (!sameGoalWithin100m(own.goal, f.goal))
      return false
    // Already linked with us?
    const friendGroupId = groupIdByTourId.value.get(f.id)
    if (myGroupId && friendGroupId && myGroupId === friendGroupId)
      return false
    if (pendingFriendTourIds.has(f.id))
      return false
    return true
  })
})

// Owner name comes from friendships store (userId → profile name map).
// `partnerNames` on a friend tour holds the tour's PARTNERS, never the owner.
const candidateNames = computed(() =>
  candidates.value.map((f) => {
    const name = userIdToNamesMap.value.get(f.userId)
    return [name?.firstName, name?.lastName].filter(Boolean).join(' ') || t('tours.infoSheet.unnamedTour')
  }),
)

// Ensure owner profile names are resolved for each candidate.
watch(
  candidates,
  (list) => {
    const missing = [...new Set(list.map(f => f.userId))].filter(
      id => !userIdToNamesMap.value.has(id),
    )
    if (missing.length > 0)
      friendshipsStore.getNamesByUserIds(missing)
  },
  { immediate: true },
)

function sameGoalWithin100m(a: { lng: number, lat: number }, b: { lng: number, lat: number }): boolean {
  // Reuse haversine-equivalent via the existing isSameGoal helper.
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s
    = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  const d = 2 * R * Math.asin(Math.sqrt(s))
  return d <= 100
}

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
</script>

<template>
  <section v-if="candidates.length > 0" class="collision-notice">
    <div class="header">
      <span class="material-symbols-outlined icon">link</span>
      <span class="title">{{ t('tourLinks.collisionNoticeTitle') }}</span>
    </div>
    <p class="body">
      {{ t('tourLinks.collisionNoticeBody', { names: candidateNames.join(', ') }) }}
    </p>
    <div class="actions">
      <button
        v-for="(f, idx) in candidates"
        :key="f.id"
        type="button"
        class="link-btn"
        :disabled="submitting !== null"
        @click="requestLink(f.id)"
      >
        {{
          submitting === f.id
            ? t('tourLinks.requestingBtn')
            : t('tourLinks.requestToLinkBtn', { name: candidateNames[idx] })
        }}
      </button>
    </div>
    <p v-if="submitError" class="error">
      {{ submitError }}
    </p>
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

.link-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.link-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.link-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
}
</style>
