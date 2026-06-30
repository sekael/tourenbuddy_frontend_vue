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
  <div id="speed-dial-menu" ref="menuEl" role="menu" class="menu" @keydown="onKeydown">
    <SpeedDialItem
      v-for="item in props.items"
      :key="item.id"
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
  /* Quarter-circle arc layout around the speed-dial trigger (bottom-right).
     Items positioned absolutely; trigger anchor = menu's bottom-right corner.
     Radius 100px, item half-size 24px. */
  .menu {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 150px;
    height: 150px;
    display: block;
  }

  .menu > :deep(.item-row) {
    position: absolute;
  }

  /* 4 items at θ = 0°, 30°, 60°, 90° from vertical (up → left).
     Anchor: each item's icon-fab right edge aligns with arc x; bottom likewise.
     +24px shift on both axes keeps the icon fully inside trigger's safe corner. */
  .menu > :deep(.item-row:nth-child(1)) {
    right: 0;
    bottom: 100px;
  }

  .menu > :deep(.item-row:nth-child(2)) {
    right: 50px;
    bottom: 86px;
  }

  .menu > :deep(.item-row:nth-child(3)) {
    right: 86px;
    bottom: 50px;
  }

  .menu > :deep(.item-row:nth-child(4)) {
    right: 100px;
    bottom: 0;
  }
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
</style>
