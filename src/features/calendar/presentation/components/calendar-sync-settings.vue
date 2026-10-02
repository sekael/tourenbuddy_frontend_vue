<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import CalendarFeedHelp from '@/features/calendar/presentation/components/calendar-feed-help.vue'
import CalendarFeedRow from '@/features/calendar/presentation/components/calendar-feed-row.vue'
import CalendarOutboundFeed from '@/features/calendar/presentation/components/calendar-outbound-feed.vue'
import { useCalendarFeedStore } from '@/features/calendar/presentation/stores/calendar-feed-store'

const MAX_FEEDS = 5
const MIN_FREE_OPTIONS = [180, 240, 300, 360, 420, 480, 540, 600]

const { t } = useI18n({ useScope: 'global' })
const store = useCalendarFeedStore()
const { feeds, settings, loading, syncing, error, hasFeeds } = storeToRefs(store)

const newUrl = ref('')
const newLabel = ref('')
const coreStart = ref('06:00')
const coreEnd = ref('18:00')
const minFree = ref(360)

// Seed the window form from the server once settings arrive (and after a save round-trips).
watch(settings, (s) => {
  if (!s)
    return
  coreStart.value = s.coreStart
  coreEnd.value = s.coreEnd
  minFree.value = s.minFreeMinutes
}, { immediate: true })

async function add() {
  if (await store.addFeed(newUrl.value, newLabel.value)) {
    newUrl.value = ''
    newLabel.value = ''
  }
}

function saveWindow() {
  store.saveSettings({ coreStart: coreStart.value, coreEnd: coreEnd.value, minFreeMinutes: minFree.value })
}

onMounted(store.load)
// The store outlives the sheet: an action error must not greet the next visit.
onUnmounted(() => (error.value = null))
</script>

<template>
  <section class="calendar-sync">
    <h3 class="section-title">
      {{ t('calendar.sync.title') }}
    </h3>
    <p class="hint">
      {{ t('calendar.sync.hint') }}
    </p>

    <div v-if="loading && !settings" class="loading-placeholder" />

    <template v-else>
      <ul v-if="hasFeeds" class="feeds">
        <CalendarFeedRow
          v-for="feed in feeds"
          :key="feed.id"
          :feed="feed"
          @remove="store.removeFeed(feed.id)"
          @relabel="label => store.relabelFeed(feed.id, label)"
        />
      </ul>

      <form v-if="feeds.length < MAX_FEEDS" class="add-form" @submit.prevent="add">
        <input v-model="newUrl" class="input" type="url" inputmode="url" required :placeholder="t('calendar.sync.urlPlaceholder')" :aria-label="t('calendar.sync.urlPlaceholder')">
        <CalendarFeedHelp />
        <input v-model="newLabel" class="input" maxlength="60" :placeholder="t('calendar.sync.labelPlaceholder')" :aria-label="t('calendar.sync.labelPlaceholder')">
        <BaseButton type="submit" size="sm" :disabled="syncing">
          {{ t('calendar.sync.addFeed') }}
        </BaseButton>
      </form>
      <p v-else class="hint">
        {{ t('calendar.sync.errors.limit') }}
      </p>

      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>

      <form v-if="settings" class="window-form" @submit.prevent="saveWindow">
        <span class="subtitle">{{ t('calendar.sync.windowTitle') }}</span>
        <label class="field">{{ t('calendar.sync.coreStart') }}
          <input v-model="coreStart" class="input" type="time" required>
        </label>
        <label class="field">{{ t('calendar.sync.coreEnd') }}
          <input v-model="coreEnd" class="input" type="time" required>
        </label>
        <label class="field">{{ t('calendar.sync.minFree') }}
          <select v-model.number="minFree" class="input">
            <option v-for="m in MIN_FREE_OPTIONS" :key="m" :value="m">{{ t('calendar.sync.hours', { n: m / 60 }) }}</option>
          </select>
        </label>
        <BaseButton type="submit" variant="secondary" size="sm" :disabled="syncing">
          {{ t('calendar.sync.saveWindow') }}
        </BaseButton>
      </form>

      <BaseButton v-if="hasFeeds" variant="text" size="sm" class="sync-now" :disabled="syncing" @click="store.sync">
        <BaseIcon name="sync_alt" />
        {{ syncing ? t('calendar.sync.syncing') : t('calendar.sync.syncNow') }}
      </BaseButton>

      <CalendarOutboundFeed />
    </template>
  </section>
</template>

<style scoped>
.calendar-sync,
.feeds,
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.subtitle {
  flex-basis: 100%;
  font-weight: var(--font-weight-medium);
}

.window-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.input {
  padding: var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font: inherit;
  color: var(--color-on-surface);
  background-color: var(--color-background);
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.sync-now,
.add-form :deep(.base-button) {
  align-self: flex-start;
}

.loading-placeholder {
  height: 4rem;
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant);
}
</style>
