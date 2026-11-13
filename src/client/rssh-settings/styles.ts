/**
 * Compiled-at-build CSS for the Remote-SSH settings face.
 *
 * `settings.css?inline` is resolved by tsdown's virtual CSS module (see
 * `tsdown.config.ts`: lightningcss minification, no CSS Modules hashing), so
 * the whole stylesheet arrives as a string. The merged client entry imports
 * `SETTINGS_CSS` and injects it through `ctx.effect` beside the vendored
 * client's own `<style>` element. No other file may import the stylesheet.
 */
import css from './settings.css?inline'

export const SETTINGS_CSS: string = css
