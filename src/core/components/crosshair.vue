<script setup lang="ts">
// No props — renders a centered crosshair SVG overlay
</script>

<template>
  <div class="crosshair-wrapper" aria-hidden="true">
    <svg class="crosshair" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <!--
        Geometry is defined once and painted twice: a wide white halo pass, then the
        red mark on top. Contrast comes from the light/dark edge pair rather than the
        hue, so the reticle stays legible over glacier, snow, rock and forest alike.

        The shapes deliberately carry no stroke/fill of their own — `<use>` only
        inherits those from the referencing element when the referenced geometry
        does not set them.
      -->
      <defs>
        <g id="crosshair-geometry">
          <!-- Horizontal bar -->
          <line x1="3" y1="20" x2="16" y2="20" stroke-linecap="round" />
          <line x1="24" y1="20" x2="37" y2="20" stroke-linecap="round" />
          <!-- Vertical bar -->
          <line x1="20" y1="3" x2="20" y2="16" stroke-linecap="round" />
          <line x1="20" y1="24" x2="20" y2="37" stroke-linecap="round" />
          <!-- Center dot -->
          <circle cx="20" cy="20" r="2.5" />
        </g>
      </defs>
      <!-- Halo first: SVG paints in document order, so this must precede the mark. -->
      <use href="#crosshair-geometry" stroke="#fff" fill="#fff" stroke-width="5" />
      <use
        href="#crosshair-geometry"
        stroke="currentColor"
        fill="currentColor"
        stroke-width="2.5"
      />
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
  z-index: 15;
}

.crosshair {
  width: 40px;
  height: 40px;
  /* Drives the mark pass via currentColor on the `<use>`. Red over the accent blue:
     Swisstopo renders water, glacier polygons and contour shading in cool blues, so
     a blue reticle vanished exactly where goal placement matters most. */
  color: var(--color-error);
}
</style>
