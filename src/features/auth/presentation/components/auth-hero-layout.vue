<script setup lang="ts">
import bgDesktop from '@/assets/background-desktop.webp'
import bgMobile from '@/assets/background-mobile.webp'
</script>

<template>
  <div class="auth-hero">
    <picture class="background">
      <source media="(max-width: 768px)" :srcset="bgMobile">
      <img :src="bgDesktop" alt="" aria-hidden="true">
    </picture>
    <div class="overlay" aria-hidden="true" />
    <div class="content">
      <h1 class="hero-title">
        TourenBuddy
      </h1>
      <div class="card">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: -webkit-fill-available;
  min-height: 100lvh;
  /* No top padding — background image fills edge-to-edge including notch zone.
     Inner .content handles notch clearance via padding-top. */
  padding: 0 var(--spacing-xl) calc(var(--spacing-xl) + var(--safe-bottom));
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
  width: 100%;
  max-width: 400px;
  /* Push content below notch with comfortable breathing room */
  padding-top: calc(var(--spacing-xl) + var(--safe-top));
}

.hero-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-contrast);
  letter-spacing: -0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* ponytail: 88% opacity keeps the card legible when backdrop-filter is
   unsupported, so no @supports fallback branch is needed. */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-surface) 60%, transparent);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-md);
}
</style>
