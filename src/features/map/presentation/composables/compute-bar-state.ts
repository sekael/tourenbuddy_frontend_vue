export interface BarStateInput {
  activeOverlay: string | null
  isPickingLocation: boolean
  speedDialOpen: boolean
  isAuthenticated: boolean
}

export interface BarState {
  visible: boolean
  toursAction: 'open' | 'dismiss' | 'hidden'
  addTourAction: 'pick' | 'dismiss' | 'disabled' | 'hidden'
}

const TOUR_OVERLAYS = new Set(['tours', 'tour', 'tour-creation'])

export function computeBarState({
  activeOverlay,
  isPickingLocation,
  speedDialOpen,
  isAuthenticated,
}: BarStateInput): BarState {
  if (isPickingLocation || (activeOverlay !== null && TOUR_OVERLAYS.has(activeOverlay))) {
    return { visible: false, toursAction: 'hidden', addTourAction: 'hidden' }
  }

  const blocked = activeOverlay !== null || speedDialOpen

  return {
    visible: true,
    toursAction: blocked ? 'dismiss' : 'open',
    addTourAction: blocked ? 'dismiss' : isAuthenticated ? 'pick' : 'disabled',
  }
}
