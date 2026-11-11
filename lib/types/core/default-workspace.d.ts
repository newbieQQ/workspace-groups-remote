/**
 * Recognising the Host's own default workspace ("默认工作区").
 *
 * The workspace snapshot carries no `isDefault` flag, so the only Host-owned
 * signal is the one the Host itself uses: the registry title. Its
 * `workspaceDisplayTitle()` treats a title equal to `DEFAULT_WORKSPACE_DIRECTORY`
 * as "the default workspace" and swaps in a localized label. That constant lives
 * in the workspace-controller package, which this plugin must not import at
 * runtime (it is a client bundle), so the string is mirrored here.
 *
 * Two Host signals are combined:
 *  - the registry title (primary: exactly what the Host substitutes for);
 *  - the Host's own directory layout (`<Documents>/deepseek-harness/default-workspace`),
 *    which still identifies the workspace after the user renames it.
 * A user-created directory that merely happens to be called "default-workspace"
 * somewhere else on disk is NOT treated as the default workspace, and no single
 * directory name is used as the sole test.
 */
/** Directory name the Host uses for its default workspace (host mirror). */
export declare const DEFAULT_WORKSPACE_TITLE = "default-workspace";
/** The fields the identification needs from a workspace snapshot. */
export interface DefaultWorkspaceIdentity {
    /** Registry title (`WorkspaceView.title`). */
    title?: string | undefined;
    /** Absolute workspace directory (`WorkspaceView.path`). */
    path?: string | undefined;
}
/**
 * Whether a workspace snapshot is the Host's default workspace.
 * @param workspace - workspace snapshot (title is the primary signal, path the fallback).
 */
export declare function isDefaultWorkspace(workspace: DefaultWorkspaceIdentity): boolean;
