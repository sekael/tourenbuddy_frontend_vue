<script setup lang="ts">
import { nextTick, ref } from 'vue'
import SpeedDialItem from './speed-dial-item.vue'

export interface SpeedDialMenuItem {
  id: string
  icon: string
  label: string
  badge?: number
  disabled?: boolean
  tooltip?: string
}

const props = defineProps<{ items: SpeedDialMenuItem[] }>()
const emit = defineEmits<{ select: [id: string] }>()

const menuEl = ref<HTMLElement | null>(null)

async function focusFirst() {
  await nextTick()
  const btns = menuEl.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  btns?.[0]?.focus()
}

function onKeydown(e: KeyboardEvent) {
  const btns = Array.from(
    menuEl.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
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
    <SpeedDialItem
      v-for="(item, idx) in props.items"
      :key="item.id"
      :style="{ '--i': idx, '--ri': props.items.length - 1 - idx }"
      :icon="item.icon"
      :label="item.label"
      :disabled="item.disabled"
      :tooltip="item.tooltip"
      :data-tour="`menu-${item.id}`"
      @select="select(item.id)"
    >
      <template v-if="item.badge && item.badge > 0" #badge>
        <span class="badge">{{ item.badge }}</span>
      </template>
    </SpeedDialItem>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
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

  .menu > :deep(.item-row) {
    --angle: calc(var(--i) / max(var(--n) - 1, 1) * 90deg);
    position: absolute;
    right: calc(sin(var(--angle)) * 136px);
    bottom: calc(cos(var(--angle)) * 136px);
  }
}

/* Pinned to the icon's top-right corner */
.badge {
  position: absolute;
  top: -8px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: var(--radius-pill);
  background-color: var(--color-fab-on-surface);
  color: var(--color-primary-dark);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
</style>
