<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import TourSuggestionRow from '@/features/tours/presentation/components/tour-suggestion-row.vue'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'

const props = defineProps<{
  tour: Tour
  mode: 'owner' | 'author'
}>()

const { t, locale } = useI18n({ useScope: 'global' })

const suggestionsStore = useTourSuggestionsStore()
const authStore = useAuthStore()

/**
 * The view resolves a suggester's name for the OWNER; a partner reading their own history
 * sees the generic fallback instead, which reads as if a stranger wrote it. Name the author
 * from the reader's side rather than leaning on the resolved name.
 */
function authorLabel(suggesterId: string, suggesterName: string | null): string {
  if (suggesterId === authStore.currentUser?.id)
    return t('tours.suggestions.byYou')
  return t('tours.suggestions.byAuthor', {
    name: suggesterName ?? t('tours.suggestions.aPartner'),
  })
}

// Resolved rows are retained forever — they ARE the record of what was proposed and how
// it was decided. Unbounded by design; a retention sweep is additive if it ever matters.
const batches = computed(() => suggestionsStore.resolvedBatchesFor(props.tour.id))

function formatResolvedAt(date: Date | null): string {
  if (!date)
    return ''
  return date.toLocaleDateString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<template>
  <section class="history">
    <p v-if="batches.length === 0" class="empty" data-testid="history-empty">
      {{ t('tours.suggestions.historyEmpty') }}
    </p>

    <article v-for="batch in batches" :key="batch.batchId" class="batch">
      <header class="batch-head">
        <span class="batch-author">
          {{ authorLabel(batch.suggesterId, batch.suggesterName) }}
        </span>
        <span class="batch-date">{{ formatResolvedAt(batch.rows[0]?.resolvedAt ?? null) }}</span>
      </header>

      <TourSuggestionRow
        v-for="row in batch.rows" :key="row.id" :suggestion="row" :mode="mode"
      />
    </article>
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.empty {
  opacity: 0.7;
}

.batch {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
}

.batch-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-xs);
}

.batch-author {
  font-weight: 600;
  flex: 1;
}

.batch-date {
  font-size: var(--font-size-sm);
  opacity: 0.7;
}
</style>
