import type { RemoteSshApi, SettingsSectionComponent } from './contract.ts';
/** Options handed to the extracted factory by the merged client entry. */
export interface CreateSettingsSectionOptions {
    api: RemoteSshApi;
}
/**
 * Build the settings section component around the injected API.
 * The returned component matches the shell's `settings.section` renderer
 * signature `(props: { t? }) => ReactNode`.
 */
export declare function createSettingsSection(options: CreateSettingsSectionOptions): SettingsSectionComponent;
