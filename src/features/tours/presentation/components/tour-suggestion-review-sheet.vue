<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { TourSuggestion } from '@/features/tours/domain/entities/tour-suggestion'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
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

const attachments = computed(() => attachmentsStore.attachmentsByTour[props.tour.id] ?? [])

const capFull = computed(() => attachments.value.length >= MAX_ATTACHMENTS_PER_TOUR)

/**
 * The attachment count this batch would leave behind (D10: the cap is checked on the END
 * state). A pending removal only counts once — a removal the owner already declined is no
 * longer in `batch.rows`, which is exactly the case that used to let accept-all through
 * and fail server-side: 5 attachments, an add whose paired removal is gone.
 */
function projectedCount(rows: TourSuggestion[]): number {
  const live = new Set(attachments.value.map(a => a.id))
  let count = attachments.value.length
  for (const row of rows) {
    if (row.field === 'attachment_add')
      count += 1
    // A removal whose target is already gone frees nothing (D3) — it resolves as a no-op.
    else if (row.field === 'attachment_remove' && row.targetId && live.has(row.targetId))
      count -= 1
  }
  return count
}

/** Accept-all is refused for exactly the reason the server would refuse it. */
function batchOverflows(rows: TourSuggestion[]): boolean {
  return projectedCount(rows) > MAX_ATTACHMENTS_PER_TOUR
}

// The attachment list is what every cap decision below is computed from, and the strip
// that normally keeps it fresh is unmounted while this sheet is up (its `clearCurrent`
// also mutes the store's realtime refetch). Load on entry, and again after each verdict:
// declining a removal changes what accept-all may still do.
onMounted(() => void attachmentsStore.load(props.tour.id))

async function run(action: () => Promise<unknown>) {
  busy.value = true
  try {
    await action()
    await attachmentsStore.load(props.tour.id)
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
        :cap-full="capFull" :cap-relief="!batchOverflows(batch.rows)" :busy="busy"
        @accept="accept" @decline="decline" @withdraw="withdraw"
      />

      <div class="batch-actions">
        <p v-if="mode === 'owner' && batchOverflows(batch.rows)" class="batch-hint" data-testid="accept-all-hint">
          {{ t('tours.suggestions.capHintBatch', { max: MAX_ATTACHMENTS_PER_TOUR }) }}
        </p>
        <BaseButton
          v-if="mode === 'owner'" type="button" variant="primary" size="sm"
          :disabled="busy || batchOverflows(batch.rows)"
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
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
}

.batch-hint {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
</style>
