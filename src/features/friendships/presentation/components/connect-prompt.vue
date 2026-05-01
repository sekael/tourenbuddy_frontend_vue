<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const props = defineProps<{ matchedUserId: string }>()
const emit = defineEmits<{ sent: []; dismissed: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useFriendshipsStore()

type State = 'idle' | 'sending' | 'sent' | 'error'
const state = ref<State>('idle')
const errorMsg = ref<string | null>(null)

async function handleSend() {
  state.value = 'sending'
  errorMsg.value = null
  try {
    await store.sendRequest(props.matchedUserId)
    state.value = 'sent'
    emit('sent')
  } catch (err) {
    state.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : t('friendships.sendRequest')
  }
}

function handleDismiss() {
  emit('dismissed')
}
</script>

<template>
  <div class="connect-prompt">
    <template v-if="state === 'sent'">
      <p class="sent-msg">
        <span class="material-symbols-outlined sent-icon">check_circle</span>
        {{ t('friendships.requestSent') }}
      </p>
    </template>

    <template v-else>
      <div class="prompt-body">
        <p class="prompt-title">
          {{ t('friendships.prompt.title') }}
        </p>
        <p class="security-note">
          {{ t('friendships.prompt.securityNote') }}
        </p>
        <p v-if="state === 'error'" class="error-text">
          {{ errorMsg }}
        </p>
      </div>
      <div class="prompt-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="state === 'sending'"
          @click="handleDismiss"
        >
          {{ t('friendships.justSaveContact') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="state === 'sending'"
          @click="handleSend"
        >
          {{ state === 'sending' ? '…' : t('friendships.sendRequest') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.connect-prompt {
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  background-color: color-mix(in srgb, var(--color-primary) 5%, transparent);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.prompt-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.prompt-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

.security-note {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
  line-height: 1.4;
}

.error-text {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-error);
}

.prompt-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.sent-msg {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: #15803d;
  font-weight: var(--font-weight-medium);
}

.sent-icon {
  font-size: 18px;
}
</style>
