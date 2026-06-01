<script setup lang="ts">
import type { BackfillCollisionPair } from '@/features/tour-links/domain/entities/tour-link'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLogger } from '@/core/logging/use-logger'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { TourLinksRepositoryImpl } from '@/features/tour-links/data/repositories/tour-links-repository-impl'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'

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
const friendshipsStore = useFriendshipsStore()
const repository = new TourLinksRepositoryImpl()

const loading = ref(true)
const error = ref<string | null>(null)
const pairs = ref<BackfillCollisionPair[]>([])
const submitting = ref<string | null>(null)

const isAllMode = computed(() => props.mode === 'all')

async function load() {
  loading.value = true
  error.value = null
  try {
    if (props.mode === 'all') {
      pairs.value = await repository.listAllBackfillCollisions()
      const ownerIds = [...new Set(pairs.value.map(p => p.friendUserId))]
        .filter(id => !friendshipsStore.userIdToNamesMap.has(id))
      if (ownerIds.length > 0)
        await friendshipsStore.getNamesByUserIds(ownerIds)
    }
    else {
      const friendshipId = String(route.params.friendshipId ?? '')
      if (!friendshipId) {
        error.value = 'missing friendshipId'
        return
      }
      pairs.value = await repository.listBackfillCollisionsForFriendship(friendshipId)
    }
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
  const entry = friendshipsStore.userIdToNamesMap.get(pair.friendUserId)
  if (!entry)
    return ''
  return [entry.firstName, entry.lastName].filter(Boolean).join(' ')
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

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="handleBack">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h1>{{ t('tourLinks.backfillPageTitle') }}</h1>
    </header>

    <div v-if="loading" class="state">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="error" class="state state--error">
      {{ error }}
    </div>
    <div v-else-if="pairs.length === 0" class="state">
      {{ isAllMode ? t('tourLinks.backfillAllEmpty') : t('tourLinks.backfillEmpty') }}
    </div>

    <ul v-else class="list">
      <li v-for="pair in pairs" :key="`${pair.yourTourId}-${pair.friendTourId}`" class="row">
        <dl class="fields">
          <div class="field">
            <dt class="field-label">
              {{ t('tourLinks.backfillYourTourLabel') }}
            </dt>
            <dd class="field-value">
              {{ pair.yourTourName ?? t('tours.infoSheet.unnamedTour') }}
            </dd>
          </div>
          <div v-if="isAllMode && friendNameOf(pair)" class="field">
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
        <button
          type="button"
          class="btn"
          :disabled="submitting !== null"
          @click="requestLink(pair)"
        >
          {{
            submitting === pair.yourTourId
              ? t('tourLinks.requestingBtn')
              : t('tourLinks.requestToLinkShortBtn')
          }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page {
  padding: var(--spacing-md);
  max-width: 640px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.back-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: var(--spacing-xs);
}

h1 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.state {
  padding: var(--spacing-lg) 0;
  text-align: center;
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
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
