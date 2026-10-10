<script setup lang="ts">
import { nextTick, ref } from 'vue'
import SpeedDialItem from './speed-dial-item.vue'

export interface SpeedDialMenuItem {
  id: string
  icon: string
  label: string
  badge?: number
  /** Attention without a number (shown when there is no badge). */
  dot?: boolean
  disabled?: boolean
  tooltip?: string
}

// `expanded`: the item whose options unfold beside it (default slot). The rest of the
// menu stays in place but inert, so a tap on it lands on the backdrop and closes all.
const props = defineProps<{ items: SpeedDialMenuItem[], expanded?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const menuEl = ref<HTMLElement | null>(null)

async function focusFirst() {
  await nextTick()
  const btns = menuEl.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  btns?.[0]?.focus()
}

function onKeydown(e: KeyboardEvent) {
  const btns = Array.from(
    menuEl.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled, [inert])') ?? [],
  )
  const idx = btns.indexOf(document.activeElement as HTMLButtonElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    btns[(idx + 1) % btns.length]?.focus()
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    btns[(idx - 1 + btns.length) % btns.length]?.focus()
  }
  else if (e.key === 'Home') {
    e.preventDefault()
    btns[0]?.focus()
  }
  else if (e.key === 'End') {
    e.preventDefault()
    btns[btns.length - 1]?.focus()
  }
}

function select(id: string) {
  emit('select', id)
}

defineExpose({ focusFirst })
</script>

<template>
  <div
    id="speed-dial-menu"
    ref="menuEl"
    role="menu"
    class="menu"
    :style="{ '--n': props.items.length }"
    @keydown="onKeydown"
  >
    <div
      v-for="(item, idx) in props.items"
      :key="item.id"
      class="item-slot"
      :class="{ 'item-slot--expanded': item.id === props.expanded }"
      :style="{ '--i': idx, '--ri': props.items.length - 1 - idx }"
    >
      <SpeedDialItem
        :icon="item.icon"
        :label="item.label"
        :disabled="item.disabled"
        :tooltip="item.tooltip"
        :inert="!!props.expanded || undefined"
        :aria-expanded="item.id === props.expanded || undefined"
        :data-tour="`menu-${item.id}`"
        @select="select(item.id)"
      >
        <template v-if="item.badge && item.badge > 0" #badge>
          <span class="badge">{{ item.badge > 9 ? '9+' : item.badge }}</span>
        </template>
        <template v-else-if="item.dot" #badge>
          <span class="dot" data-testid="menu-dot" />
        </template>
      </SpeedDialItem>
      <slot v-if="item.id === props.expanded" />
    </div>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
}

/* Containing block for the options that unfold beside the item */
.item-slot {
  position: relative;
  display: flex;
}

/* The options overflow this slot by design. driver.js clips the parent of a
   spotlit element (`overflow: hidden !important`), which would hide them during
   the guided tour's base-map step. */
.item-slot--expanded {
  z-index: 1;
  overflow: visible !important;
}

.item-slot--expanded > :deep(.item-row) {
  background-color: var(--color-fab-glass-strong);
}

.menu:has(.item-slot--expanded) .item-slot:not(.item-slot--expanded) > :deep(.item-row) {
  opacity: 0.45;
}

@media (orientation: landscape) and (max-height: 500px) {
  /* Quarter-circle arc around the speed-dial trigger (bottom-right), so the menu
     doesn't cover the bottom-center tour pill. The menu's bottom-right corner is
     the trigger's; item i of n sits at θ = i/(n-1) · 90° from vertical (up → left)
     on a 136px radius — wide enough that five 48px items never touch. */
  .menu {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 184px;
    height: 184px;
    display: block;
  }

  .menu > .item-slot {
    --angle: calc(var(--i) / max(var(--n) - 1, 1) * 90deg);
    position: absolute;
    right: calc(sin(var(--angle)) * 136px);
    bottom: calc(cos(var(--angle)) * 136px);
  }

  /* Icon-only circles; the name stays in aria-label/title. Unfolded options keep
     their labels — there is room beside the arc. */
  .item-slot > :deep(.item-row) {
    width: 48px;
    padding: 0;
    justify-content: center;
  }

  .item-slot > :deep(.item-row .label) {
    display: none;
  }
}

/* Sits on the pill's top-right border (the item row is its containing block), ringed
   like the trigger's count so it reads as one signal in two places. */
.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background-color: var(--color-fab-on-surface);
  color: var(--color-primary-dark);
  border: 2px solid var(--color-fab-surface);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--color-fab-on-surface);
  border: 2px solid var(--color-fab-surface);
  pointer-events: none;
}
</style>
