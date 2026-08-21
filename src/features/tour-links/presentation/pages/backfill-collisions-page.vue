<script setup lang="ts">
import type { BackfillCollisionPair } from '@/features/tour-links/domain/entities/tour-link'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import { useLogger } from '@/core/logging/use-logger'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { TourLinksRepositoryImpl } from '@/features/tour-links/data/repositories/tour-links-repository-impl'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = withDefaults(defineProps<{
  /** 'friendship' = scoped to route param; 'all' = scan every accepted friendship. */
  mode?: 'friendship' | 'all'
}>(), { mode: 'friendship' })

const emit = defineEmits<{ back: [] }>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('backfill-collisions-page')
const tourLinksStore = useTourLinksStore()
const toursStore = useToursStore()
const friendshipsStore = useFriendshipsStore()
const contactsStore = useContactsStore()
const repository = new TourLinksRepositoryImpl()

const { requestsByTourId, groupIdByTourId } = storeToRefs(tourLinksStore)
const { friendTours } = storeToRefs(toursStore)

const loading = ref(true)
const error = ref<string | null>(null)
const pairs = ref<BackfillCollisionPair[]>([])
const submitting = ref<string | null>(null)

const isAllMode = computed(() => props.mode === 'all')

/**
 * Drop pairs that are no longer actionable:
 *  - a pending link request already exists between the two tours, OR
 *  - both tours now share a group (request was accepted elsewhere), OR
 *  - the friend tour has disappeared from `friendTours` (visibility flipped,
 *    friendship removed, etc.). Belt-and-suspenders against stale rows the
 *    server-side backfill scan didn't refresh.
 */
const visiblePairs = computed<BackfillCollisionPair[]>(() => {
  const friendTourIds = new Set(friendTours.value.map(t => t.id))
  return pairs.value.filter((p) => {
    if (!friendTourIds.has(p.friendTourId))
      return false
    const yg = groupIdByTourId.value.get(p.yourTourId)
    const fg = groupIdByTourId.value.get(p.friendTourId)
    if (yg && fg && yg === fg)
      return false
    const reqs = requestsByTourId.value.get(p.yourTourId) ?? []
    if (reqs.some(r =>
      r.initiatorTourId === p.friendTourId
      || r.targetTourId === p.friendTourId,
    )) {
      return false
    }
    return true
  })
})

async function load() {
  loading.value = true
  error.value = null
  try {
    if (props.mode === 'all') {
      pairs.value = await repository.listAllBackfillCollisions()
    }
    else {
      const friendshipId = String(route.params.friendshipId ?? '')
      if (!friendshipId) {
        error.value = 'missing friendshipId'
        return
      }
      pairs.value = await repository.listBackfillCollisionsForFriendship(friendshipId)
    }
    // One batched lookup for both modes, so a friend is named the same way here as
    // everywhere else the app names them.
    const ownerIds = [...new Set(pairs.value.map(p => p.friendUserId))]
    if (ownerIds.length > 0)
      await friendshipsStore.ensurePhones(ownerIds)
  }
  catch (err) {
    logger.error('list backfill failed', err)
    error.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    loading.value = false
  }
}

function friendNameOf(pair: BackfillCollisionPair): string {
  const name = resolveFriendName(pair.friendUserId, friendshipsStore.userIdToPhoneMap, phone =>
    contactsStore.findContactByMethodValue('phone', phone))
  return name ?? t('tours.list.aFriend')
}

async function requestLink(pair: BackfillCollisionPair) {
  submitting.value = pair.yourTourId
  try {
    await tourLinksStore.createRequest(pair.yourTourId, pair.friendTourId)
    pairs.value = pairs.value.filter(p => !(p.yourTourId === pair.yourTourId && p.friendTourId === pair.friendTourId))
  }
  catch (err) {
    logger.error('createRequest failed', err)
    error.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    submitting.value = null
  }
}

function handleBack() {
  emit('back')
  // Route-mode (digest deeplink) has no parent listener wired — fall through.
  if (props.mode === 'friendship')
    router.back()
}

onMounted(() => {
  // Ensure tour-links store cache reflects current server state before the
  // user acts. Realtime onSubscribed handles steady-state, but on first nav
  // here the store may have been hydrated minutes earlier.
  tourLinksStore.fetchAll()
  load()
})
</script>

<template>
  <div class="page" :class="{ 'page--standalone': !isAllMode }">
    <header class="page-header">
      <BaseIconButton
        name="arrow_back"
        :label="t('core.drawer.back')"
        size="sm"
        @click="handleBack"
      />
      <h1>{{ t('tourLinks.backfillPageTitle') }}</h1>
    </header>

    <div v-if="loading" class="state">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="error" class="state state--error">
      {{ error }}
    </div>
    <div v-else-if="visiblePairs.length === 0" class="state">
      {{ isAllMode ? t('tourLinks.backfillAllEmpty') : t('tourLinks.backfillEmpty') }}
    </div>

    <ul v-else class="list">
      <li v-for="pair in visiblePairs" :key="`${pair.yourTourId}-${pair.friendTourId}`" class="row">
        <dl class="fields">
          <div class="field">
            <dt class="field-label">
              {{ t('tourLinks.backfillYourTourLabel') }}
            </dt>
            <dd class="field-value">
              {{ pair.yourTourName ?? t('tours.infoSheet.unnamedTour') }}
            </dd>
          </div>
          <!-- The name always resolves to something now (contact name or the generic
               fallback), so the row is shown whenever the mode calls for it. -->
          <div v-if="isAllMode" class="field">
            <dt class="field-label">
              {{ t('tourLinks.backfillFriendNameLabel') }}
            </dt>
            <dd class="field-value field-value--muted">
              {{ friendNameOf(pair) }}
            </dd>
          </div>
          <div class="field">
            <dt class="field-label">
              {{ t('tourLinks.backfillFriendTourLabel') }}
            </dt>
            <dd class="field-value">
              {{ pair.friendTourName ?? t('tours.infoSheet.unnamedTour') }}
            </dd>
          </div>
        </dl>
        <BaseButton
          variant="primary-outline"
          size="sm"
          class="btn"
          :disabled="submitting !== null"
          @click="requestLink(pair)"
        >
          {{
            submitting === pair.yourTourId
              ? t('tourLinks.requestingBtn')
              : t('tourLinks.requestToLinkShortBtn')
          }}
        </BaseButton>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
}

/* ponytail: 'all' mode is always sheet-embedded (sheet pads its slot), so the
   page adds none. Only the friendship-mode deeplink renders standalone and
   needs its own padding. Revisit if 'all' ever gets a standalone route. */
/* ponytail: max-width caps this to a centered column on wide/landscape
   screens, so physical L/R edges (and any landscape notch) fall through
   to html's background — fine while both use --color-background. */
.page--standalone {
  max-width: 640px;
  margin: 0 auto;
  min-height: -webkit-fill-available;
  min-height: 100lvh;
  background-color: var(--color-background);
  padding: calc(var(--spacing-md) + var(--safe-top)) var(--spacing-md) calc(var(--spacing-md) + var(--safe-bottom));
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

h1 {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  margin: 0;
}

.state {
  padding: var(--spacing-md) 0;
  color: var(--color-on-surface-variant);
}

.state--error {
  color: var(--color-error);
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  gap: var(--spacing-sm);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: 0;
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.field-label {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: var(--font-weight-medium);
}

.field-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.field-value--muted {
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface-variant);
}

.btn {
  align-self: stretch;
}

@media (min-width: 480px) {
  .row {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .fields {
    flex: 1;
  }

  .btn {
    align-self: center;
    flex-shrink: 0;
  }
}
</style>
