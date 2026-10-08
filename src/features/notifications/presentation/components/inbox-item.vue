<script setup lang="ts">
import type { InboxNotification, InboxStaleReason } from '../../domain/entities/inbox-notification'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { inboxText } from '../inbox-text'

const props = defineProps<{ entry: InboxNotification, stale: InboxStaleReason | null }>()
const emit = defineEmits<{ open: [], delete: [] }>()

const { t, locale } = useI18n({ useScope: 'global' })

const TYPE_ICONS: Record<InboxNotification['type'], string> = {
  friend_requests: 'person_add',
  tour_updates: 'route',
  tour_interest: 'link',
  tour_suggestions: 'edit',
}

// Stale overrides unread (D7): a resolved subject needs no attention, read or not.
const state = computed(() => (props.stale ? 'stale' : props.entry.readAt ? 'read' : 'unread'))
const text = computed(() => inboxText(props.entry, t))
const ariaLabel = computed(() => [
  text.value,
  props.stale ? t(`inbox.stale.${props.stale}`) : state.value === 'unread' ? t('inbox.state.unread') : null,
].filter(Boolean).join(', '))

const relativeTime = computed(() => {
  const seconds = (new Date(props.entry.createdAt).getTime() - Date.now()) / 1000
  const fmt = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', style: 'short' })
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return fmt.format(Math.round(seconds / size), unit)
  }
  return fmt.format(0, 'minute')
})

// Swipe-to-delete: horizontal drag only (touch-action: pan-y keeps vertical scroll
// native). Past 40 % of the width it deletes, otherwise it snaps back. A drag never
// counts as a tap.
// ponytail: hand-rolled, no gesture lib — add one if more swipe surfaces appear.
const SWIPE_THRESHOLD = 0.4
const offset = ref(0)
let startX: number | null = null
let dragged = false

function onPointerDown(e: PointerEvent) {
  startX = e.clientX
  dragged = false
}

function onPointerMove(e: PointerEvent) {
  if (startX === null)
    return
  const dx = Math.min(0, e.clientX - startX)
  if (Math.abs(dx) > 6)
    dragged = true
  offset.value = dx
}

function onPointerUp(e: PointerEvent) {
  if (startX === null)
    return
  const width = (e.currentTarget as HTMLElement).offsetWidth || 1
  const passed = -offset.value / width >= SWIPE_THRESHOLD
  startX = null
  offset.value = 0
  if (passed)
    emit('delete')
}

function onClick() {
  if (!dragged)
    emit('open')
}
</script>

<template>
  <li class="item-wrap">
    <button
      class="item" :class="`item--${state}`"
      :style="offset ? { transform: `translateX(${offset}px)` } : undefined"
      :aria-label="ariaLabel" data-testid="inbox-item"
      @pointerdown="onPointerDown" @pointermove="onPointerMove"
      @pointerup="onPointerUp" @pointercancel="onPointerUp" @click="onClick"
    >
      <BaseIcon :name="TYPE_ICONS[entry.type]" class="type-icon" />
      <span class="body">
        <span class="text">{{ text }}</span>
        <span class="meta">
          <span>{{ relativeTime }}</span>
          <span v-if="entry.occurrences > 1" class="count">{{ t('inbox.occurrences', { count: entry.occurrences }) }}</span>
          <span v-if="stale" class="chip" data-testid="stale-chip">
            <BaseIcon name="history" class="chip-icon" />{{ t(`inbox.stale.${stale}`) }}
          </span>
        </span>
      </span>
      <span v-if="state === 'unread'" class="dot" data-testid="unread-dot" aria-hidden="true" />
    </button>
    <button class="delete" :aria-label="t('inbox.delete')" :title="t('inbox.delete')" @click="emit('delete')">
      <BaseIcon name="delete" />
    </button>
  </li>
</template>

<style scoped>
.item-wrap {
  position: relative;
  display: flex;
  align-items: center;
  list-style: none;
}

.item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  text-align: start;
  touch-action: pan-y;
  transition: transform var(--motion-duration-short) var(--motion-ease-standard);
}

/* D7 token table: unread / read / stale */
.item--unread {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  font-weight: var(--font-weight-semibold);
}
.item--unread .type-icon {
  color: var(--color-primary);
}
.item--read {
  background-color: var(--color-background);
  color: var(--color-on-surface);
  font-weight: var(--font-weight-regular);
}
.item--read .type-icon {
  color: var(--color-on-surface-variant);
}
.item--stale {
  background-color: var(--color-background);
  color: var(--color-on-surface-variant);
  font-weight: var(--font-weight-regular);
}
.item--stale .type-icon {
  color: var(--color-outline);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.text {
  font-size: var(--font-size-base);
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface-variant);
}
.count {
  font-weight: var(--font-weight-semibold);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 var(--spacing-xs);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
}

.chip-icon {
  width: 14px;
  height: 14px;
}
.dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
  flex-shrink: 0;
}

/* Pointer devices: no swipe gesture, so a delete button appears on hover/focus. */
.delete {
  display: none;
  padding: var(--spacing-xs);
  color: var(--color-on-surface-variant);
  border-radius: var(--radius-sm);
}

@media (hover: hover) {
  .delete {
    display: inline-flex;
    opacity: 0;
  }
  .item-wrap:hover .delete,
  .delete:focus-visible {
    opacity: 1;
  }
}
</style>
