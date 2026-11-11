import { classify } from './core/matcher.ts';
import type { GroupsConfig } from './core/types.ts';
/** Default sidecar location: `$DSH_HOME/workspace-groups.yaml` (DSH_HOME falls back to ~/.dsh). */
export declare function defaultConfigPath(): string;
/** Parse + validate a raw sidecar document into a GroupsConfig (throws on malformed input). */
export declare function parseGroupsConfig(raw: unknown): GroupsConfig;
/**
 * Read + parse the sidecar config file. A missing file yields an empty config
 * (all workspaces fall into the uncategorized bucket); malformed YAML throws
 * so the operator sees the problem instead of silently ungrouping everything.
 */
export declare function readGroupsConfig(path: string): Promise<GroupsConfig>;
export { classify };
export type { GroupsConfig, GroupCategory, GroupRule } from './core/types.ts';
