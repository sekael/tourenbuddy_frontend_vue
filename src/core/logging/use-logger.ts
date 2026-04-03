import { createConsola } from 'consola'

const logger = createConsola({ level: import.meta.env.DEV ? 4 : 2 })

/** Composable that returns a structured logger backed by consola. */
export function useLogger(tag?: string) {
  return tag ? logger.withTag(tag) : logger
}
