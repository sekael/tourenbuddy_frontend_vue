/** Ephemeral friend cursor shown on the map (derived from Yjs Awareness). */
export interface FriendCursor {
  userId: string
  displayName: string
  color: string
  lon: number
  lat: number
  updatedAt: number
}
