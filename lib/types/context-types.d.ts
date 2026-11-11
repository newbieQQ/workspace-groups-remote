/**
 * Structural types for the cordis services this plugin consumes. A third-party
 * plugin resolves outside the DSH monorepo's single cordis instance, so the
 * upstream `declare module` augmentations do not reach this Context — the
 * members below mirror the actual runtime shapes this plugin touches:
 * - webServer: @deepseek-ai/dsh-host-webserver (the WebServer)
 * - effect: the DSH-vendored cordis lifecycle helper
 * Drift from upstream is contained to this file.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
/** One named webserver route (mirror of the host-webserver WebRoute). */
export interface GroupsWebRoute {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
/** The webServer service face this plugin uses. */
export interface GroupsWebServer {
    register(route: GroupsWebRoute): () => void;
}
/** Cordis Context augmented with the services this plugin needs. */
export interface GroupsContext extends Context {
    webServer: GroupsWebServer;
}
