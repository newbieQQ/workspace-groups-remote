/**
 * Remote-SSH settings — presentational atoms.
 *
 * Every atom here is stateless: drafts, busy flags, confirmations and results
 * live in the root component (`index.tsx`), which keeps folding reversible and
 * guarantees that a collapse/refresh can never drop typed input.
 *
 * The atoms only use native elements plus React; the sole UI primitive this
 * face consumes is `Modal` (in `index.tsx`). Styling comes from
 * `.rsui-*` classes in `settings.css` (DSH theme tokens, light/dark aware).
 */
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Icons (inline SVG — never emoji)                                    */
/* ------------------------------------------------------------------ */

/** Disclosure chevron; the rotation is a restrained CSS transition. */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span className={`rsui-chevron${open ? ' rsui-chevron-open' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
        <path d="M4.5 6.25 8 9.75l3.5-3.5" />
      </svg>
    </span>
  )
}

/**
 * Feedback glyph. Icons never carry the only error signal: every feedback
 * block also renders a localized textual prefix (`common.error` /
 * `common.warning`) so colour-blind users get the same information.
 */
export function StatusIcon({ status }: { status: 'success' | 'warning' | 'error' | 'info' }) {
  if (status === 'success') {
    return (
      <span className="rsui-feedback-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="m5 8.2 2.1 2.1L11.2 6" />
        </svg>
      </span>
    )
  }
  if (status === 'warning') {
    return (
      <span className="rsui-feedback-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
          <path d="M8 2.4 14.4 13.6H1.6L8 2.4Z" />
          <path d="M8 6.4v3.2" />
          <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
    )
  }
  return (
    <span className="rsui-feedback-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.6v4.2" />
        <circle cx="8" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: (() => void) | undefined
  placeholder?: string | undefined
  type?: 'text' | 'password' | undefined
  autoComplete?: string | undefined
  inputMode?: 'text' | 'numeric' | undefined
  /** `data-rsui-field` hook consumed by preview/acceptance scripts. */
  dataField?: string | undefined
  hint?: string | undefined
  error?: string | undefined
  mono?: boolean | undefined
}

export function Field({ id, label, value, onChange, onBlur, placeholder, type, autoComplete, inputMode, dataField, hint, error, mono }: FieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="rsui-field">
      <label className="rsui-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`rsui-input${mono ? ' rsui-input-mono' : ''}${error ? ' rsui-input-invalid' : ''}`}
        type={type ?? 'text'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        data-rsui-field={dataField}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={event => onChange(event.currentTarget.value)}
        onBlur={onBlur === undefined ? undefined : () => onBlur()}
      />
      {hint ? <p className="rsui-hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="rsui-error-text" id={errorId}>{error}</p> : null}
    </div>
  )
}

export interface TextAreaFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string | undefined
  dataField?: string | undefined
  hint?: string | undefined
  rows?: number | undefined
}

export function TextAreaField({ id, label, value, onChange, placeholder, dataField, hint, rows }: TextAreaFieldProps) {
  const hintId = `${id}-hint`
  return (
    <div className="rsui-field">
      <label className="rsui-label" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="rsui-textarea"
        value={value}
        rows={rows ?? 2}
        placeholder={placeholder}
        data-rsui-field={dataField}
        aria-describedby={hint ? hintId : undefined}
        onChange={event => onChange(event.currentTarget.value)}
      />
      {hint ? <p className="rsui-hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}

export interface CheckFieldProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  dataField?: string | undefined
}

export function CheckField({ id, label, checked, onChange, dataField }: CheckFieldProps) {
  return (
    <div className="rsui-check">
      <input
        id={id}
        className="rsui-check-input"
        type="checkbox"
        checked={checked}
        data-rsui-field={dataField}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <label className="rsui-check-label" htmlFor={id}>{label}</label>
    </div>
  )
}

export interface SelectFieldProps {
  id: string
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
  dataField?: string | undefined
  hint?: string | undefined
}

export function SelectField({ id, label, value, options, onChange, dataField, hint }: SelectFieldProps) {
  const hintId = `${id}-hint`
  return (
    <div className="rsui-field">
      <label className="rsui-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="rsui-select"
        value={value}
        data-rsui-field={dataField}
        aria-describedby={hint ? hintId : undefined}
        onChange={event => onChange(event.currentTarget.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint ? <p className="rsui-hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Feedback blocks                                                     */
/* ------------------------------------------------------------------ */

export type NoticeTone = 'success' | 'warning' | 'error' | 'info'

export interface NoticeProps {
  tone?: NoticeTone | undefined
  title: string
  /** Localized textual prefix, e.g. `common.error` / `common.warning`. */
  prefix?: string | undefined
  detail?: string | undefined
  action?: ReactNode
}

/**
 * Generic status/alert block. `role` follows the tone (`alert` for errors,
 * `status` otherwise) so screen readers announce failures without relying on
 * the red colour alone.
 */
export function Notice({ tone, title, prefix, detail, action }: NoticeProps) {
  const kind = tone ?? 'info'
  return (
    <div className={`rsui-feedback rsui-feedback-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <StatusIcon status={kind} />
      <div className="rsui-feedback-body">
        <div className="rsui-feedback-title">
          {prefix ? <span className="rsui-feedback-prefix">{prefix}</span> : null}
          <span>{title}</span>
        </div>
        {detail ? <pre className="rsui-feedback-pre">{detail}</pre> : null}
        {action ? <div className="rsui-feedback-actions">{action}</div> : null}
      </div>
    </div>
  )
}
