<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import bgDesktop from '@/assets/background-desktop.webp'
import bgMobile from '@/assets/background-mobile.webp'

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="home-page">
    <picture class="background">
      <source media="(max-width: 768px)" :srcset="bgMobile">
      <img :src="bgDesktop" alt="" aria-hidden="true">
    </picture>
    <div class="overlay" aria-hidden="true" />
    <div class="content">
      <h1 class="title">
        TourenBuddy
      </h1>
      <p class="subtitle">
        {{ t('auth.home.subtitle') }}
      </p>
      <button class="login-button" @click="router.push({ name: 'email-entry' })">
        {{ t('auth.home.getStartedBtn') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  /* No top padding — background image fills edge-to-edge including notch zone.
     Inner .content handles notch clearance via padding-top. */
  padding: 0 var(--spacing-xl) calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-background);
  overflow: hidden;
}

.background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.6));
}

.content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  max-width: 400px;
  text-align: center;
  /* Push content below notch with comfortable breathing room */
  padding-top: calc(var(--spacing-xl) + env(safe-area-inset-top, 0px));
}

.title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-medium);
  color: #ffffff;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.subtitle {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.92);
  line-height: var(--line-height-relaxed);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.login-button {
  padding: var(--spacing-md) var(--spacing-xxl);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.login-button:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}
</style>
