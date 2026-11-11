import type { SessionsTabsProps } from './contract.ts';
/**
 * Render the session tab strip into the conversation column's head seat.
 * @param props - tab store, catalog/status hooks, navigation, locale.
 * @returns the portal (or null until the column has mounted).
 */
export declare function SessionTabs({ useTabs, actions, useSessions, useSessionStatus, useWorkspaces, activate, rename, t, }: SessionsTabsProps): import("react").ReactPortal | null;
