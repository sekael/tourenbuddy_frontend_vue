<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { buildContactActions } from '@/features/contacts/core/utils/contact-actions'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'

const props = defineProps<{
  contact: Contact
  anchorRect: DOMRect | null
}>()

const emit = defineEmits<{
  close: []
  editContact: [contactId: string]
}>()

const isDesktop = useIsDesktop()
const actions = computed(() => buildContactActions(props.contact))
const contactName = computed(() => resolveContactName(props.contact))

// ── Desktop popover positioning ───────────────────────────────────────────────
const popoverStyle = computed(() => {
  if (!props.anchorRect) return {}
  const POPOVER_WIDTH = 240
  const MARGIN = 8
  let left = props.anchorRect.left
  if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
    left = window.innerWidth - POPOVER_WIDTH - MARGIN
  }
  const top = props.anchorRect.bottom + MARGIN
  return { top: `${top}px`, left: `${left}px` }
})

// Close on outside click (desktop)
const popoverEl = ref<HTMLElement | null>(null)

function handleOutsideClick(e: MouseEvent) {
  if (popoverEl.value && !popoverEl.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  if (isDesktop.value) {
    document.addEventListener('mousedown', handleOutsideClick, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick, true)
})
</script>

<template>
  <!-- Desktop: anchored popover -->
  <Teleport to="body">
    <div v-if="isDesktop" class="popover-backdrop" @click.self="emit('close')">
      <div
        ref="popoverEl"
        class="popover"
        :style="popoverStyle"
        role="menu"
        :aria-label="`Actions for ${contactName}`"
      >
        <div class="popover-header">
          <span class="popover-name">{{ contactName }}</span>
          <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="menu-body">
          <template v-if="actions.length > 0">
            <div v-for="action in actions" :key="action.methodId" class="method-row">
              <span class="method-label">{{ action.label }}</span>
              <div class="method-actions">
                <a :href="action.call" class="menu-action-btn" title="Call" role="menuitem">
                  <span class="material-symbols-outlined">call</span>
                </a>
                <a
                  :href="action.whatsApp"
                  class="menu-action-btn"
                  title="WhatsApp"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                >
                  <span class="material-symbols-outlined">chat</span>
                </a>
              </div>
            </div>
            <div class="menu-divider" />
          </template>
          <p v-else class="no-methods-hint">
            No contact method available. Edit contact to add one.
          </p>

          <button
            type="button"
            class="edit-row"
            role="menuitem"
            @click="emit('editContact', props.contact.id)"
          >
            <span class="material-symbols-outlined edit-icon">edit</span>
            Edit contact
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile: bottom sheet -->
    <div v-else class="sheet-container" @click.self="emit('close')">
      <BottomSheet :title="contactName" @close="emit('close')">
        <div class="sheet-body">
          <template v-if="actions.length > 0">
            <div v-for="action in actions" :key="action.methodId" class="method-row">
              <span class="method-label">{{ action.label }}</span>
              <div class="method-actions">
                <a :href="action.call" class="menu-action-btn sheet-action-btn" title="Call">
                  <span class="material-symbols-outlined">call</span>
                </a>
                <a
                  :href="action.whatsApp"
                  class="menu-action-btn sheet-action-btn"
                  title="WhatsApp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="material-symbols-outlined">chat</span>
                </a>
              </div>
            </div>
            <div class="menu-divider" />
          </template>
          <p v-else class="no-methods-hint">
            No contact method available. Edit contact to add one.
          </p>

          <button
            type="button"
            class="edit-row sheet-edit-row"
            @click="emit('editContact', props.contact.id)"
          >
            <span class="material-symbols-outlined edit-icon">edit</span>
            Edit contact
          </button>
        </div>
      </BottomSheet>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Desktop popover ── */
.popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.popover {
  position: fixed;
  width: 240px;
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 61;
  overflow: hidden;
  animation: popover-enter 0.15s ease both;
}

@keyframes popover-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.popover-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.close-btn .material-symbols-outlined {
  font-size: 18px;
}

/* ── Shared menu body ── */
.menu-body,
.sheet-body {
  display: flex;
  flex-direction: column;
}

.method-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-lg);
  gap: var(--spacing-sm);
}

.method-label {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.menu-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: var(--color-on-surface-variant);
  transition:
    background-color 0.15s,
    color 0.15s;
}

.menu-action-btn:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-primary);
}

.menu-action-btn .material-symbols-outlined {
  font-size: 18px;
}

.sheet-action-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
}

.no-methods-hint {
  padding: var(--spacing-xs) var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  opacity: 0.7;
  font-style: italic;
}

.menu-divider {
  height: 1px;
  background-color: var(--color-outline-variant);
  margin: 4px 0;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md) var(--spacing-md);
  min-height: 36px;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  width: 100%;
  text-align: left;
  transition: background-color 0.15s;
}

.edit-row:hover {
  background-color: var(--color-surface-variant);
}

.edit-icon {
  font-size: 18px;
}

.sheet-edit-row {
  min-height: 44px;
}

/* ── Mobile sheet container ── */
.sheet-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
</style>
