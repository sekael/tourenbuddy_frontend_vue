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
  .menu {
    flex-direction: row;
    align-items: flex-end;
  }
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 9999px;
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
