<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

const props = withDefaults(defineProps<{
  matchedUserId: string
  beforeSend?: () => Promise<void>
  beforeDismiss?: () => Promise<void>
  showDismiss?: boolean
}>(), {
  showDismiss: true,
})
const emit = defineEmits<{ sent: [], dismissed: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useFriendshipsStore()
const blocksStore = useUserBlocksStore()
const { blockedUserIds } = storeToRefs(blocksStore)

type State = 'idle' | 'sending' | 'sent' | 'error'
const state = ref<State>('idle')
const errorMsg = ref<string | null>(null)
const isBlockedByTarget = ref(false)
const isBlockedByMe = computed(() => blockedUserIds.value.has(props.matchedUserId))
const isHidden = computed(() => isBlockedByTarget.value || isBlockedByMe.value)

onMounted(async () => {
  isBlockedByTarget.value = await blocksStore.isBlockedBy(props.matchedUserId)
})

async function handleSend() {
  state.value = 'sending'
  errorMsg.value = null
  try {
    if (props.beforeSend)
      await props.beforeSend()
    await store.sendRequest(props.matchedUserId)
    state.value = 'sent'
    emit('sent')
  }
  catch {
    state.value = 'error'
    isBlockedByTarget.value = blocksStore.isBlockedByCache.get(props.matchedUserId)?.value ?? false
    errorMsg.value = t('blocks.snackbar.sendRequestFailed')
  }
}

async function handleDismiss() {
  if (!props.beforeDismiss) {
    emit('dismissed')
    return
  }
  state.value = 'sending'
  errorMsg.value = null
  try {
    await props.beforeDismiss()
    emit('dismissed')
  }
  catch (err) {
    state.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : t('friendships.justSaveContact')
  }
}
</script>

<template>
  <div v-if="!isHidden" class="connect-prompt">
    <template v-if="state === 'sent'">
      <p class="sent-msg">
        <BaseIcon name="check_circle" class="sent-icon" />
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
        <BaseButton
          v-if="props.showDismiss"
          type="button"
          variant="secondary"
          size="sm"
          :disabled="state === 'sending'"
          @click="handleDismiss"
        >
          {{ state === 'sending' ? '…' : t('friendships.justSaveContact') }}
        </BaseButton>
        <BaseButton
          type="button"
          variant="primary"
          size="sm"
          :disabled="state === 'sending'"
          @click="handleSend"
        >
          {{ state === 'sending' ? '…' : t('friendships.sendRequest') }}
        </BaseButton>
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

/* Dismiss/send use shared BaseButton; fill the row like before. */
.prompt-actions :deep(.base-button) {
  flex: 1;
}

.sent-msg {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.sent-icon {
  font-size: 18px;
}
</style>
