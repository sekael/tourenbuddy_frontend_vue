<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'

const { t } = useI18n({ useScope: 'global' })

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isVisible = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    isVisible.value = true
  })
})

async function handleInstall() {
  if (!deferredPrompt)
    return
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    deferredPrompt = null
  }
  isVisible.value = false
}

function handleDismiss() {
  isVisible.value = false
}
</script>

<template>
  <Transition name="banner">
    <div v-if="isVisible" class="banner" role="banner">
      <div class="content">
        <p class="text">
          {{ t('core.pwa.banner.message') }}
        </p>
        <div class="actions">
          <BaseButton variant="text" size="sm" @click="handleDismiss">
            {{ t('core.pwa.banner.dismiss') }}
          </BaseButton>
          <BaseButton variant="primary" size="sm" @click="handleInstall">
            {{ t('core.pwa.banner.install') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-lg);
  z-index: 300;
  padding: var(--spacing-lg) var(--spacing-xl);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-bottom));
}

.content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  max-width: 600px;
  margin: 0 auto;
}

.text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  flex: 1;
}

.actions {
  display: flex;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.banner-enter-active,
.banner-leave-active {
  transition: transform 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(100%);
}
</style>
