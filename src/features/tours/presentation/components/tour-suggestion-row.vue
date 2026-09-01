<script setup lang="ts">
import type { TourSuggestion } from '@/features/tours/domain/entities/tour-suggestion'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{
  suggestion: TourSuggestion
  /** Owner adjudicates; the author may only withdraw their own proposal (design D12). */
  mode: 'owner' | 'author'
  /** True when the tour already holds the maximum attachments (D10). */
  capFull?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  accept: [suggestion: TourSuggestion]
  decline: [suggestion: TourSuggestion]
  withdraw: [suggestion: TourSuggestion]
}>()

const { t, locale } = useI18n({ useScope: 'global' })

const attachmentsStore = useTourAttachmentsStore()

const label = computed(() => t(`tours.suggestions.fields.${props.suggestion.field}`))

const isPending = computed(() => props.suggestion.status === 'pending')

/**
 * An `attachment_add` on a full tour can't be applied on its own — the cap trigger would
 * raise. Accept-all is unaffected: it applies removes first, so the cap is evaluated on
 * the END state (D10), which is what makes "swap this photo for that one" work.
 */
const capBlocked = computed(
  () => props.capFull && props.suggestion.field === 'attachment_add' && isPending.value,
)

/**
 * Enumerated fields are stored as their raw token (`climbing`, `summer`) but must never be
 * shown as one — the rest of the app already has display names for both, so reuse those
 * keys rather than a suggestion-local copy that would drift.
 */
function localizedEnum(value: unknown): string | null {
  if (props.suggestion.field === 'tour_type' && typeof value === 'string')
    return t(`tours.type.${value}`)
  if (props.suggestion.field === 'seasons' && Array.isArray(value))
    return value.map(s => t(`tours.season.${s}`)).join(', ')
  return null
}

/**
 * The name of an `attachment_remove` target, which the suggestion row itself never carries —
 * it holds only the id (`target_id`). Resolved against the owner's loaded attachments; a
 * resolved row whose attachment is already gone falls back to the generic noun.
 */
const removedAttachmentName = computed(() => {
  const list = attachmentsStore.attachmentsByTour[props.suggestion.tourId] ?? []
  const hit = list.find(a => a.id === props.suggestion.targetId)
  return hit?.originalFilename ?? t('tours.suggestions.anAttachment')
})

/**
 * Binary fields describe themselves, not their storage. A GPX is "a new track" or "the
 * existing track" — the object key behind it is an implementation detail nobody reviewing a
 * proposal needs, and showing it leaks a UUID into the UI.
 */
function binaryLabel(value: unknown, isSuggested: boolean): string | null {
  if (props.suggestion.field === 'gpx') {
    if (value === null || value === undefined)
      return t('tours.suggestions.emptyValue')
    return isSuggested ? t('tours.suggestions.gpxNew') : t('tours.suggestions.gpxExisting')
  }
  if (props.suggestion.field === 'attachment_remove')
    return isSuggested ? t('tours.suggestions.emptyValue') : removedAttachmentName.value
  return null
}

function formatValue(value: unknown, isSuggested = false): string {
  const binary = binaryLabel(value, isSuggested)
  if (binary !== null)
    return binary

  if (value === null || value === undefined)
    return t('tours.suggestions.emptyValue')

  const enumLabel = localizedEnum(value)
  if (enumLabel !== null)
    return enumLabel

  if (typeof value === 'string' || typeof value === 'number')
    return String(value)

  if (Array.isArray(value))
    return value.join(', ')

  const obj = value as Record<string, unknown>

  if ('plannedDate' in obj) {
    const from = obj.plannedDate ? formatDate(String(obj.plannedDate)) : null
    const to = obj.endDate ? formatDate(String(obj.endDate)) : null
    if (!from)
      return t('tours.suggestions.emptyValue')
    return to ? `${from} – ${to}` : from
  }

  if ('lng' in obj && 'lat' in obj) {
    const coords = `${Number(obj.lat).toFixed(4)}°N, ${Number(obj.lng).toFixed(4)}°E`
    const name = typeof obj.name === 'string' && obj.name ? `${obj.name} · ` : ''
    const elevation = obj.elevation != null ? ` · ${obj.elevation} m` : ''
    return `${name}${coords}${elevation}`
  }

  if ('originalFilename' in obj)
    return String(obj.originalFilename)

  if ('storagePath' in obj)
    return String(obj.storagePath).split('/').pop() ?? ''

  return JSON.stringify(value)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <div class="row" :class="{ 'row--stale': suggestion.isStale && isPending }">
    <div class="row-head">
      <span class="row-label">{{ label }}</span>
      <span v-if="suggestion.isStale && isPending" class="stale-badge">
        <BaseIcon name="warning" />
        {{ t('tours.suggestions.stale') }}
      </span>
      <span v-else-if="!isPending" class="status-badge" :class="`status-badge--${suggestion.status}`">
        {{ t(`tours.suggestions.status.${suggestion.status}`) }}
      </span>
    </div>

    <!--
      Stale rows render THREE columns (design D4): the owner edited this field themselves
      since the proposal was written, so accepting is a deliberate overwrite of their own
      newer value — made with the divergence on screen, never silently.
    -->
    <div class="values" :class="{ 'values--triple': suggestion.isStale && isPending }">
      <div v-if="suggestion.isStale && isPending" class="value-col">
        <span class="value-label">{{ t('tours.suggestions.currentValue') }}</span>
        <span class="value">{{ formatValue(suggestion.currentValue) }}</span>
      </div>
      <div class="value-col">
        <span class="value-label">
          {{ suggestion.isStale && isPending
            ? t('tours.suggestions.baseValue')
            : t('tours.suggestions.originalValue') }}
        </span>
        <span class="value value--old">{{ formatValue(suggestion.baseValue) }}</span>
      </div>
      <div class="value-col">
        <span class="value-label">{{ t('tours.suggestions.suggestedValue') }}</span>
        <span class="value value--new">{{ formatValue(suggestion.value, true) }}</span>
      </div>
    </div>

    <p v-if="capBlocked" class="cap-hint">
      {{ t('tours.suggestions.capHint') }}
    </p>

    <div v-if="isPending" class="row-actions">
      <template v-if="mode === 'owner'">
        <BaseButton
          type="button" variant="primary" size="sm" :disabled="busy || capBlocked"
          data-testid="accept-btn" @click="emit('accept', suggestion)"
        >
          <BaseIcon name="check" />
          {{ t('tours.suggestions.acceptBtn') }}
        </BaseButton>
        <BaseButton
          type="button" variant="secondary" size="sm" :disabled="busy"
          data-testid="decline-btn" @click="emit('decline', suggestion)"
        >
          <BaseIcon name="close" />
          {{ t('tours.suggestions.declineBtn') }}
        </BaseButton>
      </template>
      <BaseButton
        v-else type="button" variant="secondary" size="sm" :disabled="busy"
        data-testid="withdraw-btn" @click="emit('withdraw', suggestion)"
      >
        <BaseIcon name="delete" />
        {{ t('tours.suggestions.withdrawBtn') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-outline-variant);

  /* The card's own border already closes the list — a divider under the last row doubles
     it. In the review sheet the batch actions follow, so those rows keep theirs. */
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

/* `&--suffix` is Sass, not CSS: native nesting resolves `&` to a real selector, so the
   concatenated form never matches. Modifiers are written out in full. */
.row--stale {
  border-left: 3px solid var(--color-warning, var(--color-error));
  padding-left: var(--spacing-sm);
}

.row-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.row-label {
  font-weight: 600;
}

.stale-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

/* GitHub-style outcome pill: the tint carries the verdict at a glance, mixed off the
   existing semantic tokens rather than adding three one-off palette entries. */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
}

.status-badge--accepted {
  color: var(--color-success);
  background-color: color-mix(in srgb, var(--color-success) 14%, var(--color-background));
}

.status-badge--withdrawn {
  color: var(--color-warning);
  background-color: color-mix(in srgb, var(--color-warning) 18%, var(--color-background));
}

.status-badge--declined {
  color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 12%, var(--color-background));
}

.values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.values--triple {
  grid-template-columns: repeat(3, 1fr);
}

.value-col {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.value-label {
  font-size: var(--font-size-sm);
  opacity: 0.6;
}

.value {
  overflow-wrap: anywhere;
}

.value--old {
  text-decoration: line-through;
  opacity: 0.7;
}

.value--new {
  font-weight: 500;
}

.cap-hint {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.row-actions {
  display: flex;
  gap: var(--spacing-xs);
}
</style>
