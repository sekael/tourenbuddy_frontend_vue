/** High-contrast palette for cursor dots on Swisstopo base + classic (see design). */
export const PRESENCE_PALETTE = [
  '#e63946',
  '#2a9d8f',
  '#e9c46a',
  '#264653',
  '#f4a261',
  '#8338ec',
  '#06d6a0',
  '#118ab2',
  '#ef476f',
  '#7209b7',
  '#fb8500',
  '#3a86ff',
] as const

function fnv1a32(input: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic color per user id (stable across sessions). */
export function colorForUserId(userId: string): string {
  const idx = fnv1a32(userId) % PRESENCE_PALETTE.length
  return PRESENCE_PALETTE[idx]!
}
