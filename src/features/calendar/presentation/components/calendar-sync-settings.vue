<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

// Save only when the form differs from the backend; confirm in place once applied.
const dirty = computed(() => !!settings.value && (
  coreStart.value !== settings.value.coreStart
  || coreEnd.value !== settings.value.coreEnd
  || minFree.value !== settings.value.minFreeMinutes
))
const saving = ref(false)
const saved = ref(false)
watch(dirty, d => d && (saved.value = false))

async function saveWindow() {
  saving.value = true
  try {
    saved.value = await store.saveSettings({ coreStart: coreStart.value, coreEnd: coreEnd.value, minFreeMinutes: minFree.value })
  }
  finally {
    saving.value = false
  }
}

onMounted(store.load)
// The store outlives the sheet: an action error must not greet the next visit.
onUnmounted(() => (error.value = null))
</script>

<template>
  <section class="calendar-sync">
    <div v-if="loading && !settings" class="loading-placeholder" />

    <template v-else>
      <div class="group">
        <h3 class="group-title">
          {{ t('calendar.sync.feedsTitle') }}
        </h3>
        <p class="hint">
          {{ t('calendar.sync.hint') }}
        </p>
        <ul v-if="hasFeeds" class="feeds">
          <CalendarFeedRow
            v-for="feed in feeds"
            :key="feed.id"
            :feed="feed"
            @remove="store.removeFeed(feed.id)"
            @relabel="label => store.relabelFeed(feed.id, label)"
          />
        </ul>
        <BaseButton v-if="hasFeeds" variant="secondary" :disabled="syncing" @click="store.sync">
          <BaseIcon name="sync_alt" />
          {{ syncing ? t('calendar.sync.syncing') : t('calendar.sync.syncNow') }}
        </BaseButton>

        <form v-if="feeds.length < MAX_FEEDS" class="add-form" @submit.prevent="add">
          <input v-model="newUrl" class="input" type="url" inputmode="url" required :placeholder="t('calendar.sync.urlPlaceholder')" :aria-label="t('calendar.sync.urlPlaceholder')">
          <CalendarFeedHelp />
          <input v-model="newLabel" class="input" maxlength="60" :placeholder="t('calendar.sync.labelPlaceholder')" :aria-label="t('calendar.sync.labelPlaceholder')">
          <BaseButton type="submit" :disabled="syncing">
            {{ t('calendar.sync.addFeed') }}
          </BaseButton>
        </form>
        <p v-else class="hint">
          {{ t('calendar.sync.errors.limit') }}
        </p>

        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
      </div>

      <form v-if="settings" class="window-form" @submit.prevent="saveWindow">
        <h3 class="group-title">
          {{ t('calendar.sync.windowTitle') }}
        </h3>
        <label class="field">{{ t('calendar.sync.coreStart') }}
          <input v-model="coreStart" class="input" type="time" required>
        </label>
        <label class="field">{{ t('calendar.sync.coreEnd') }}
          <input v-model="coreEnd" class="input" type="time" required>
        </label>
        <label class="field">{{ t('calendar.sync.minFree') }}
          <span class="select-wrap">
            <select v-model.number="minFree" class="input select">
              <option v-for="m in MIN_FREE_OPTIONS" :key="m" :value="m">{{ t('calendar.sync.hours', { n: m / 60 }) }}</option>
            </select>
            <BaseIcon name="expand_more" class="select-chevron" />
          </span>
        </label>
        <BaseButton
          type="submit"
          class="save-window"
          :class="{ 'save-window--saved': saved && !dirty }"
          :disabled="!dirty || saving || syncing"
        >
          <span role="status">
            <template v-if="saving">{{ t('calendar.sync.savingWindow') }}</template>
            <template v-else-if="saved && !dirty"><BaseIcon name="check" /> {{ t('calendar.sync.savedWindow') }}</template>
            <template v-else>{{ t('calendar.sync.saveWindow') }}</template>
          </span>
        </BaseButton>
      </form>

      <CalendarOutboundFeed />
    </template>
  </section>
</template>

<style scoped>
/* Three titled groups (your calendars, availability window, your feed) spaced
   apart, so the page reads as sections instead of one long form. */
.calendar-sync {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.group,
.feeds,
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-title {
  flex-basis: 100%;
  font-size: var(--heading-section-size);
  font-weight: var(--heading-section-weight);
  color: var(--heading-section-color);
  letter-spacing: var(--heading-section-tracking);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
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
  border-radius: var(--input-radius);
  font: inherit;
  /* `font: inherit` would take the 14px label size; fields stay >= 16px (iOS focus zoom). */
  font-size: max(1rem, 1em);
  color: var(--color-on-surface);
  background-color: var(--input-bg);
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  background-color: var(--input-bg-focus);
  box-shadow: var(--input-focus-ring);
}

/* The native select arrow sits at a fixed inset that padding can't move, so it
   hugged the border; draw our own chevron at the same inset as the time inputs' clock. */
.select-wrap {
  position: relative;
  display: flex;
}

.select {
  flex: 1;
  appearance: none;
  padding-right: calc(var(--spacing-sm) + var(--icon-size-md) + var(--spacing-xs));
}

.select-chevron {
  position: absolute;
  top: 50%;
  right: var(--spacing-sm);
  translate: 0 -50%;
  pointer-events: none;
  color: var(--color-on-surface-variant);
}

/* Every labelled button on the page (incl. the outbound feed) is exactly as tall as
   the fields it sits beside, with or without an icon. */
.calendar-sync :deep(.base-button) {
  min-height: 48px;
  padding-block: 0;
}

.group > :deep(.base-button),
.add-form :deep(.base-button) {
  align-self: flex-start;
}

/* Success state stays legible although the button is disabled (nothing left to save). */
.save-window.save-window--saved:disabled {
  opacity: 1;
  color: var(--color-success-text);
  border-color: var(--color-success);
  background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
}

.save-window span {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.loading-placeholder {
  height: 4rem;
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant);
}
</style>
