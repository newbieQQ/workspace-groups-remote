/**
 * Plugin-owned projection of descendant counts from Session summaries.
 *
 * 0.1.2 移除了 `@deepseek-ai/dsh-client-runtime/client`（平台模块表不再提供
 * `indexSubagentDescendants`），官方 ui-workspace 改为各自持有本地副本
 * （packages/client/ui-workspace/src/client/subagent-lineage.ts，MIT）。这里
 * 保持同一实现，使运行中的子代理会话数在树行上继续可见。
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

interface LineageEntry {
  readonly id: SessionId
  readonly parentId?: SessionId
  readonly origin?: 'subagent'
  readonly running: boolean
}

/** Descendant counts for one possible parent Session. */
export interface SubagentDescendantSummary {
  readonly count: number
  readonly runningCount: number
}

/**
 * Index uninterrupted subagent descendants under each ancestor.
 * @param summaries - Session summaries keyed by id.
 * @returns descendant totals keyed by possible parent id.
 */
export function indexSubagentDescendants(
  summaries: Readonly<Record<SessionId, LineageEntry>>,
): ReadonlyMap<SessionId, SubagentDescendantSummary> {
  const indexed = new Map<SessionId, { count: number; runningCount: number }>()
  for (const descendant of Object.values(summaries)) {
    if (descendant.origin !== 'subagent') continue
    const seen = new Set<SessionId>()
    let current: LineageEntry | undefined = descendant
    while (current?.origin === 'subagent' && current.parentId !== undefined && !seen.has(current.id)) {
      seen.add(current.id)
      const aggregate = indexed.get(current.parentId)
      if (aggregate === undefined) {
        indexed.set(current.parentId, { count: 1, runningCount: descendant.running ? 1 : 0 })
      } else {
        aggregate.count += 1
        if (descendant.running) aggregate.runningCount += 1
      }
      current = summaries[current.parentId]
    }
  }
  return indexed
}
