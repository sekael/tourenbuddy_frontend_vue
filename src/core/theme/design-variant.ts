import { ref } from 'vue'

/**
 * Runtime design variant (change: modern-design-preview). The variant is a
 * token override block in `tokens.css` keyed on `<html data-design>`; this
 * module only picks, applies and persists the name. Module-level ref (same
 * pattern as `isOnline`) because it is applied in `main.ts` before Pinia exists.
 */
export const DESIGN_VARIANTS = ['classic', 'alpenglow'] as const
export type DesignVariant = typeof DESIGN_VARIANTS[number]

const STORAGE_KEY = 'tb.design'

export const designVariant = ref<DesignVariant>('classic')

function isDesignVariant(value: unknown): value is DesignVariant {
  return DESIGN_VARIANTS.includes(value as DesignVariant)
}

/** Stored choice, or Classic when missing, unknown, or storage is unavailable. */
export function readDesignVariant(): DesignVariant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isDesignVariant(stored) ? stored : 'classic'
  }
  catch {
    return 'classic'
  }
}

export function setDesignVariant(variant: DesignVariant): void {
  designVariant.value = variant
  document.documentElement.dataset.design = variant
  try {
    localStorage.setItem(STORAGE_KEY, variant)
  }
  catch {
    // Storage unavailable (Safari private mode etc.) — choice lasts this session only.
  }
}
