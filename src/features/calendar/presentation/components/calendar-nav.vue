<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'

type CalendarView = 'planned' | 'seasons'

defineProps<{ active: CalendarView }>()
const emit = defineEmits<{ select: [view: CalendarView] }>()

const { t } = useI18n({ useScope: 'global' })

const items: { view: CalendarView, icon: string, labelKey: string }[] = [
  { view: 'planned', icon: 'calendar_today', labelKey: 'calendar.nav.planned' },
  { view: 'seasons', icon: 'wb_sunny', labelKey: 'calendar.nav.seasons' },
]
</script>

<template>
  <!-- Desktop: persistent left sidebar. -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <h1 class="brand-title">
        {{ t('calendar.title') }}
      </h1>
      <p class="brand-subtitle">
        {{ t('calendar.subtitle') }}
      </p>
    </div>
    <nav class="sidebar-nav">
      <button
        v-for="item in items"
        :key="item.view"
        type="button"
        class="nav-item"
        :class="{ 'nav-item--active': active === item.view }"
        :aria-current="active === item.view ? 'page' : undefined"
        @click="emit('select', item.view)"
      >
        <BaseIcon :name="item.icon" />
        <span>{{ t(item.labelKey) }}</span>
      </button>
    </nav>
  </aside>

  <!-- Mobile: bottom navigation bar. -->
  <nav class="bottom-nav">
    <button
      v-for="item in items"
      :key="item.view"
      type="button"
      class="bottom-nav-item"
      :class="{ 'bottom-nav-item--active': active === item.view }"
      :aria-current="active === item.view ? 'page' : undefined"
      @click="emit('select', item.view)"
    >
      <BaseIcon :name="item.icon" />
      <span>{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* ── Desktop sidebar ─────────────────────────────────────────────────────── */
.sidebar {
  display: none;
  flex-direction: column;
  width: 256px;
  flex-shrink: 0;
  padding: var(--spacing-xxl) var(--spacing-md);
  gap: var(--spacing-xxl);
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-outline-variant);
}

.sidebar-brand {
  padding: 0 var(--spacing-xs);
}

.brand-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.brand-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  transition:
    background-color 0.15s,
    color 0.15s;
}

.nav-item:hover {
  background-color: var(--color-surface-variant);
}

.nav-item--active {
  background-color: var(--color-surface-variant);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

/* ── Mobile bottom nav ───────────────────────────────────────────────────── */
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: calc(64px + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  flex-shrink: 0;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-outline-variant);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
}

.bottom-nav-item--active {
  color: var(--color-primary);
}

@media (min-width: 600px) {
  .sidebar {
    display: flex;
  }

  .bottom-nav {
    display: none;
  }
}
</style>
