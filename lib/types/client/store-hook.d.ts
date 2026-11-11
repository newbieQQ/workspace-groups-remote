import type { ActionsDecl, StoreInstance } from '@deepseek-ai/dsh-client-store';
/**
 * Build a selector hook bound to one store instance.
 * @param instance - the live store instance (snapshot source).
 * @returns a `SnapshotSelectorHook`-compatible hook over that instance.
 */
export declare function createStoreHook<T, A extends ActionsDecl<T>>(instance: StoreInstance<T, A>): <S>(selector: (state: T) => S, eq?: (a: S, b: S) => boolean) => S;
