<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

type Provider = 'google' | 'outlook' | 'icloud'

// Same tabbed <details> as contact-import-help.vue. Google first: the embed-link mix-up it
// prevents is the one users actually hit.
const TABS: { id: Provider, stepCount: number }[] = [
  { id: 'google', stepCount: 4 },
  { id: 'outlook', stepCount: 3 },
  { id: 'icloud', stepCount: 3 },
]
const active = ref<Provider>('google')

const steps = computed(() => {
  const tab = TABS.find(x => x.id === active.value)!
  return Array.from({ length: tab.stepCount }, (_, i) => t(`calendar.sync.help.${tab.id}Step${i + 1}`))
})
</script>

<template>
  <details class="help">
    <summary class="summary">
      {{ t('calendar.sync.help.summary') }}
    </summary>
    <div class="tabs" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--active': active === tab.id }"
        :aria-selected="active === tab.id"
        @click="active = tab.id"
      >
        {{ t(`calendar.sync.help.${tab.id}`) }}
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
.help {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.summary {
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
