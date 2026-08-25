<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

type Platform = 'ios' | 'android' | 'desktop'

/**
 * iOS leads unconditionally — no UA sniffing. All three tabs are one tap away, so guessing
 * the platform saves a single tap and costs a regex that every browser release can break.
 * iOS is first because it has no Contact Picker fallback: the file path is its only path.
 */
const activeTab = ref<Platform>('ios')

const TABS: { id: Platform, labelKey: string, stepCount: number }[] = [
  { id: 'ios', labelKey: 'contacts.addDialog.help.tabIos', stepCount: 4 },
  { id: 'android', labelKey: 'contacts.addDialog.help.tabAndroid', stepCount: 4 },
  { id: 'desktop', labelKey: 'contacts.addDialog.help.tabDesktop', stepCount: 4 },
]

const steps = computed<string[]>(() => {
  const tab = TABS.find(x => x.id === activeTab.value)!
  const prefix = `contacts.addDialog.help.${tab.id}Step`
  return Array.from({ length: tab.stepCount }, (_, i) => t(`${prefix}${i + 1}`))
})
</script>

<template>
  <details class="import-help">
    <summary class="import-help-summary">
      {{ t('contacts.addDialog.help.summary') }}
    </summary>

    <div class="tabs" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <ol class="steps" role="tabpanel">
      <li v-for="(step, i) in steps" :key="i">
        {{ step }}
      </li>
    </ol>
  </details>
</template>

<style scoped>
.import-help {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.import-help-summary {
  cursor: pointer;
  padding: var(--spacing-xxs) 0;
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.tabs {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1.5px solid var(--color-outline-variant);
  margin-top: var(--spacing-xs);
}

.tab {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.steps {
  margin: var(--spacing-sm) 0 0;
  padding-left: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  line-height: 1.4;
}
</style>
