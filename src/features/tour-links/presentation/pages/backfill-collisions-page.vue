<script setup lang="ts">
import type { BackfillCollisionPair } from '@/features/tour-links/domain/entities/tour-link'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLogger } from '@/core/logging/use-logger'
import { TourLinksRepositoryImpl } from '@/features/tour-links/data/repositories/tour-links-repository-impl'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('backfill-collisions-page')
const tourLinksStore = useTourLinksStore()
const repository = new TourLinksRepositoryImpl()

const loading = ref(true)
const error = ref<string | null>(null)
const pairs = ref<BackfillCollisionPair[]>([])
const submitting = ref<string | null>(null)

async function load() {
  const friendshipId = String(route.params.friendshipId ?? '')
  if (!friendshipId) {
    error.value = 'missing friendshipId'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    pairs.value = await repository.listBackfillCollisionsForFriendship(friendshipId)
  }
  catch (err) {
    logger.error('list backfill failed', err)
    error.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    loading.value = false
  }
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

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.back()">
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
      {{ t('tourLinks.backfillEmpty') }}
    </div>

    <ul v-else class="list">
      <li v-for="pair in pairs" :key="`${pair.yourTourId}-${pair.friendTourId}`" class="row">
        <div class="pair">
          <span class="tour-name">{{ pair.yourTourName ?? t('tours.infoSheet.unnamedTour') }}</span>
          <span class="material-symbols-outlined connector">sync_alt</span>
          <span class="tour-name">{{ pair.friendTourName ?? t('tours.infoSheet.unnamedTour') }}</span>
        </div>
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
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  gap: var(--spacing-sm);
}

.pair {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
}

.tour-name {
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connector {
  color: var(--color-on-surface-variant);
  font-size: 18px;
}

.btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  flex-shrink: 0;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
