/** Shape broadcast in Yjs Awareness `user` / `cursor` fields (local and remote). */
export interface LocalPresenceUser {
  id: string
  name: string
  color: string
}

export interface LocalPresenceCursor {
  lon: number
  lat: number
  t: number
}

export interface LocalPresence {
  user: LocalPresenceUser
  cursor: LocalPresenceCursor | null
}
