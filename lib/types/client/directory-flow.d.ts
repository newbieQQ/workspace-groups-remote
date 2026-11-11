import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
import type { GroupsBrowserInjected } from './contract.ts';
/** Adapt the elected self-contained picker, without stealing its original slot. */
export declare function directoryFlowFromEntry(entry: StoredEntry | undefined): ReturnType<GroupsBrowserInjected['getDirectoryFlow']>;
