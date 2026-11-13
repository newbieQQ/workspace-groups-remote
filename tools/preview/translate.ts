/**
 * Deterministic `t` seat for the isolated preview.
 *
 * The real section receives the shell locale service's bind. The preview has
 * no shell, so it resolves the SAME dictionary the section registers
 * (`zh` from `src/client/rssh-settings/i18n.ts`, single source of truth)
 * with `{name}` interpolation. Identical input → identical text, every run.
 */
import type { SettingsTranslate } from '../../src/client/rssh-settings/contract.ts'
import { zh } from '../../src/client/rssh-settings/i18n.ts'

const DICTIONARY: Record<string, string> = zh as unknown as Record<string, string>

export const makeT = (): SettingsTranslate => {
  return (key: string, params?: Record<string, string | number>): string => {
    const template = DICTIONARY[key]
    const raw = template === undefined ? key : template
    if (!params) return raw
    return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name]
      return value === undefined ? match : String(value)
    })
  }
}

/** Text the screenshot script expects to see once the section is mounted. */
export const EXPECTED_MOUNT_TEXT = DICTIONARY['connection.sectionTitle'] as string
