import type { GroupsContext } from './context-types.ts';
/** Plugin identity for cordis.yml rows. */
export declare const name = "workspace-groups-local";
/** Services required before mounting: the webserver route. */
export declare const inject: string[];
/** Plugin body: mount the config snapshot route and the overlay write route. */
export declare function apply(ctx: GroupsContext): void;
