import { env } from '@/core/constants/env'

/**
 * The running build as shown to users: the release version, plus the short commit on PR
 * previews (whose package.json still carries the last release) or "dev" locally.
 * Production builds show the version only.
 */
export function appVersionLabel(
  version: string = __APP_VERSION__,
  commit: string | undefined = env.VITE_BUILD_COMMIT,
  isDev: boolean = import.meta.env.DEV,
): string {
  if (commit)
    return `${version} · ${commit.slice(0, 7)}`
  return isDev ? `${version} · dev` : version
}
