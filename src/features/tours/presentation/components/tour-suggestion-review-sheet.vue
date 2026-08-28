<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { TourSuggestion } from '@/features/tours/domain/entities/tour-suggestion'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { MAX_ATTACHMENTS_PER_TOUR } from '@/features/tours/data/models/tour-attachment'
import TourSuggestionRow from '@/features/tours/presentation/components/tour-suggestion-row.vue'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'

const props = defineProps<{
  tour: Tour
  /**
   * ONE sheet, two modes. The owner adjudicates per row plus accept-all; the author sees
   * the same layout with Withdraw and a route back into the form to revise, and never an
   * accept or decline action (design D12).
   */
  mode: 'owner' | 'author'
}>()

const emit = defineEmits<{
  /** Author mode: reopen the form seeded with this batch's pending values. */
  revise: [batchId: string]
}>()

const { t } = useI18n({ useScope: 'global' })

const suggestionsStore = useTourSuggestionsStore()
const attachmentsStore = useTourAttachmentsStore()
const { error } = storeToRefs(suggestionsStore)

const busy = ref(false)

const batches = computed(() => suggestionsStore.pendingBatchesFor(props.tour.id))

const capFull = computed(
  () =>
    (attachmentsStore.attachmentsByTour[props.tour.id] ?? []).length >= MAX_ATTACHMENTS_PER_TOUR,
)

async function run(action: () => Promise<unknown>) {
  busy.value = true
  try {
    await action()
  }
  catch {
    // The store already recorded the message in `error`; the banner renders it. A failed
    // accept-all rolls back server-side (one transaction, D10), so every row stays pending.
  }
  finally {
    busy.value = false
  }
}

function accept(suggestion: TourSuggestion) {
  return run(() => suggestionsStore.accept(suggestion))
}

function decline(suggestion: TourSuggestion) {
  return run(() => suggestionsStore.decline(suggestion.id))
}

function withdraw(suggestion: TourSuggestion) {
  return run(() => suggestionsStore.withdraw(suggestion.id))
}

function acceptAll(batchId: string) {
  return run(() => suggestionsStore.acceptBatch(batchId))
}
</script>

<template>
  <section class="review">
    <p v-if="error" class="review-error">
      {{ error }}
    </p>

    <p v-if="batches.length === 0" class="empty" data-testid="review-empty">
      {{ mode === 'owner' ? t('tours.suggestions.emptyOwner') : t('tours.suggestions.emptyAuthor') }}
    </p>

    <article v-for="batch in batches" :key="batch.batchId" class="batch">
      <header class="batch-head">
        <BaseIcon name="feedback" />
        <span class="batch-author">
          {{ mode === 'owner'
            ? t('tours.suggestions.byAuthor', { name: batch.suggesterName ?? t('tours.suggestions.aPartner') })
            : t('tours.suggestions.yourProposal') }}
        </span>
        <span class="batch-count">{{ t('tours.suggestions.fieldCount', { count: batch.rows.length }) }}</span>
      </header>

      <TourSuggestionRow
        v-for="row in batch.rows" :key="row.id" :suggestion="row" :mode="mode"
        :cap-full="capFull" :busy="busy"
        @accept="accept" @decline="decline" @withdraw="withdraw"
      />

      <div class="batch-actions">
        <BaseButton
          v-if="mode === 'owner'" type="button" variant="primary" size="sm" :disabled="busy"
          data-testid="accept-all-btn" @click="acceptAll(batch.batchId)"
        >
          <BaseIcon name="check" />
          {{ t('tours.suggestions.acceptAllBtn') }}
        </BaseButton>
        <BaseButton
          v-else type="button" variant="secondary" size="sm" :disabled="busy"
          data-testid="revise-btn" @click="emit('revise', batch.batchId)"
        >
          <BaseIcon name="edit" />
          {{ t('tours.suggestions.reviseBtn') }}
        </BaseButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.review-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
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

.batch-count {
  font-size: var(--font-size-sm);
  opacity: 0.7;
}

.batch-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-sm);
}
</style>
