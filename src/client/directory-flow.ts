import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type { GroupsBrowserInjected } from './contract.ts'

/** Adapt the elected self-contained picker, without stealing its original slot. */
export function directoryFlowFromEntry(entry: StoredEntry | undefined): ReturnType<GroupsBrowserInjected['getDirectoryFlow']> {
  if (!entry) return null
  // Stateful/translated/nested seats need the full original renderer context.
  // Never silently drop them or fall back to a local picker for a remote request.
  if (entry.store || entry.locale || entry.children || typeof entry.component !== 'function') {
    throw new Error('This directory picker requires an unsupported renderer context.')
  }
  return {
    component: entry.component as NonNullable<ReturnType<GroupsBrowserInjected['getDirectoryFlow']>>['component'],
    injected: entry.inject?.() ?? {},
  }
}
