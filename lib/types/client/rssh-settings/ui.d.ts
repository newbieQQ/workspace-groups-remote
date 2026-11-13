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
import type { ReactNode } from 'react';
/** Disclosure chevron; the rotation is a restrained CSS transition. */
export declare function ChevronIcon({ open }: {
    open: boolean;
}): import("react").JSX.Element;
/**
 * Feedback glyph. Icons never carry the only error signal: every feedback
 * block also renders a localized textual prefix (`common.error` /
 * `common.warning`) so colour-blind users get the same information.
 */
export declare function StatusIcon({ status }: {
    status: 'success' | 'warning' | 'error' | 'info';
}): import("react").JSX.Element;
export interface FieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: (() => void) | undefined;
    placeholder?: string | undefined;
    type?: 'text' | 'password' | undefined;
    autoComplete?: string | undefined;
    inputMode?: 'text' | 'numeric' | undefined;
    /** `data-rsui-field` hook consumed by preview/acceptance scripts. */
    dataField?: string | undefined;
    hint?: string | undefined;
    error?: string | undefined;
    mono?: boolean | undefined;
}
export declare function Field({ id, label, value, onChange, onBlur, placeholder, type, autoComplete, inputMode, dataField, hint, error, mono }: FieldProps): import("react").JSX.Element;
export interface TextAreaFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string | undefined;
    dataField?: string | undefined;
    hint?: string | undefined;
    rows?: number | undefined;
}
export declare function TextAreaField({ id, label, value, onChange, placeholder, dataField, hint, rows }: TextAreaFieldProps): import("react").JSX.Element;
export interface CheckFieldProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    dataField?: string | undefined;
}
export declare function CheckField({ id, label, checked, onChange, dataField }: CheckFieldProps): import("react").JSX.Element;
export interface SelectFieldProps {
    id: string;
    label: string;
    value: string;
    options: ReadonlyArray<{
        value: string;
        label: string;
    }>;
    onChange: (value: string) => void;
    dataField?: string | undefined;
    hint?: string | undefined;
}
export declare function SelectField({ id, label, value, options, onChange, dataField, hint }: SelectFieldProps): import("react").JSX.Element;
export type NoticeTone = 'success' | 'warning' | 'error' | 'info';
export interface NoticeProps {
    tone?: NoticeTone | undefined;
    title: string;
    /** Localized textual prefix, e.g. `common.error` / `common.warning`. */
    prefix?: string | undefined;
    detail?: string | undefined;
    action?: ReactNode;
}
/**
 * Generic status/alert block. `role` follows the tone (`alert` for errors,
 * `status` otherwise) so screen readers announce failures without relying on
 * the red colour alone.
 */
export declare function Notice({ tone, title, prefix, detail, action }: NoticeProps): import("react").JSX.Element;
