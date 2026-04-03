<script setup lang="ts">
// No props — renders a centered crosshair SVG overlay
</script>

<template>
  <div class="crosshair-wrapper" aria-hidden="true">
    <svg class="crosshair" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <!-- Horizontal bar -->
      <line x1="0" y1="20" x2="16" y2="20" stroke="red" stroke-width="2.5" stroke-linecap="round" />
      <line
        x1="24"
        y1="20"
        x2="40"
        y2="20"
        stroke="red"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <!-- Vertical bar -->
      <line x1="20" y1="0" x2="20" y2="16" stroke="red" stroke-width="2.5" stroke-linecap="round" />
      <line
        x1="20"
        y1="24"
        x2="20"
        y2="40"
        stroke="red"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <!-- Center dot -->
      <circle cx="20" cy="20" r="2.5" fill="red" />
    </svg>
  </div>
</template>

<style scoped>
.crosshair-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.crosshair {
  width: 40px;
  height: 40px;
}
</style>
