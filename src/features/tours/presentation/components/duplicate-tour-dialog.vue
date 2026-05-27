<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const props = defineProps<{ collidingTour: Tour }>()
const emit = defineEmits<{ confirm: [], decline: [], cancel: [] }>()

const { t } = useI18n({ useScope: 'global' })
const friendshipsStore = useFriendshipsStore()

const ownerName = computed(() => {
  const owner = friendshipsStore.userIdToNamesMap.get(props.collidingTour.userId)
  const name = owner ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() : ''
  return name || t('tours.list.aFriend')
})

const tourName = computed(() => props.collidingTour.name ?? t('tours.infoSheet.unnamedTour'))
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('cancel')">
    <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dup-tour-title">
      <div class="dialog-header">
        <h2 id="dup-tour-title" class="dialog-title">
          {{ t('tours.duplicate.title') }}
        </h2>
        <button type="button" class="close-btn" :aria-label="t('tours.duplicate.cancelBtn')" @click="emit('cancel')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="dialog-body">
        <p class="dialog-text">
          {{ t('tours.duplicate.body', { owner: ownerName, tour: tourName }) }}
        </p>
        <p class="dialog-hint">
          {{ t('tours.duplicate.hint') }}
        </p>
      </div>

      <div class="dialog-footer">
        <button type="button" class="decline-btn" @click="emit('decline')">
          {{ t('tours.duplicate.declineBtn') }}
        </button>
        <button type="button" class="confirm-btn" @click="emit('confirm')">
          {{ t('tours.duplicate.confirmBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.dialog-card {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: dialog-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.dialog-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.close-btn .material-symbols-outlined {
  font-size: 18px;
}

.dialog-body {
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.dialog-text {
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
}

.dialog-hint {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-outline-variant);
}

.decline-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.decline-btn:hover {
  background-color: var(--color-surface-variant);
}

.confirm-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: opacity 0.15s;
}

.confirm-btn:hover {
  opacity: 0.85;
}

/* Mobile (< desktop breakpoint): present as a bottom sheet, not a centered
   dialog window — no dialog windows on phone screens. */
@media (max-width: 599.98px) {
  .dialog-backdrop {
    align-items: flex-end;
  }

  .dialog-card {
    max-width: none;
    max-height: 90dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    animation: sheet-enter 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
  }

  .dialog-footer {
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  }
}

@keyframes sheet-enter {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
