<script setup lang="ts">
import type { CalendarFeed } from '@/features/calendar/domain/repositories/calendar-feed-repository'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import { useFormatter } from '@/core/composables/use-formatter'

const props = defineProps<{ feed: CalendarFeed }>()
const emit = defineEmits<{ remove: [], relabel: [label: string] }>()

const { t, te } = useI18n({ useScope: 'global' })
const { formatDate } = useFormatter()

const KNOWN_ERRORS = ['timeout', 'network', 'too_large', 'unparseable', 'too_complex']

// Worker codes (design D5): `http_<status>` or a fixed set; anything else reads as generic.
const errorText = computed(() => {
  const code = props.feed.lastError
  if (!code)
    return null
  const http = /^http_(\d{3})$/.exec(code)
  if (http)
    return t(`calendar.sync.feedError.${http[1] >= '500' ? 'httpServer' : 'http'}`, { status: http[1] })
  const key = `calendar.sync.feedError.${code}`
  return KNOWN_ERRORS.includes(code) && te(key) ? t(key) : t('calendar.sync.feedError.unknown')
})

const syncedText = computed(() => props.feed.lastSyncedAt
  ? t('calendar.sync.lastSynced', {
      when: formatDate.value(props.feed.lastSyncedAt, { dateStyle: 'short', timeStyle: 'short' }),
    })
  : t('calendar.sync.neverSynced'))

function onLabelChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value.trim() !== (props.feed.label ?? ''))
    emit('relabel', value)
}
</script>

<template>
  <li class="feed">
    <div class="feed-main">
      <input
        class="label-input"
        :value="feed.label ?? ''"
        :placeholder="t('calendar.sync.label')"
        :aria-label="t('calendar.sync.labelAria', { host: feed.host })"
        maxlength="60"
        @change="onLabelChange"
      >
      <!-- Host only: the full URL is a bearer credential (design D8). -->
      <span class="host">{{ feed.host }}</span>
      <span v-if="errorText" class="status status--error" role="status">{{ errorText }}</span>
      <span v-else class="status">{{ syncedText }}</span>
    </div>
    <BaseIconButton
      name="delete"
      tone="danger"
      size="sm"
      :label="t('calendar.sync.removeFeed', { host: feed.host })"
      @click="emit('remove')"
    />
  </li>
</template>

<style scoped>
.feed {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.feed-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.label-input {
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

.label-input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.host,
.status {
  overflow: hidden;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status--error {
  color: var(--color-error);
  white-space: normal;
}
</style>
