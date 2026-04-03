<script setup lang="ts">
import { onMounted, ref } from 'vue'

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
          Install TouringBuddy for the best experience
        </p>
        <div class="actions">
          <button class="dismiss-btn" @click="handleDismiss">
            Not now
          </button>
          <button class="install-btn" @click="handleInstall">
            Install
          </button>
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
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
  z-index: 300;
  padding: var(--spacing-lg) var(--spacing-xl);
  padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom));
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

.dismiss-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}

.install-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.install-btn:hover {
  background-color: var(--color-primary-dark);
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
