<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="home-page">
    <div class="content">
      <h1 class="title">TourenBuddy</h1>
      <p class="subtitle">Plan your outdoor tours with confidence</p>
      <button class="login-button" @click="router.push({ name: 'email-entry' })">
        Get Started
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-xl);
  background-color: var(--color-background);
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  max-width: 400px;
  text-align: center;
}

.title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-on-surface-variant);
  line-height: var(--line-height-relaxed);
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
