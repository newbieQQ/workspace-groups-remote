/**
 * Modal stub for the isolated preview.
 *
 * The real component imports `Modal` from
 * `@deepseek-ai/dsh-client-ui-primitives`; the preview bundle aliases that
 * package to this stub so the section renders without the shell. Props match
 * the primitives contract: open / onClose / title / closeLabel / className /
 * children. Focus management is intentionally minimal — the preview only
 * needs a stable, visually faithful dialog shell.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface ModalStubProps {
  open?: boolean
  onClose?: () => void
  title?: ReactNode
  closeLabel?: string
  className?: string
  children?: ReactNode
  /** Any other primitive props are accepted and ignored (preview only). */
  [key: string]: unknown
}

export function Modal({
  open = false,
  onClose,
  title,
  closeLabel = '关闭',
  className,
  children,
}: ModalStubProps): ReactNode {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="preview-modal" data-preview-modal="1">
      <div className="preview-modal__backdrop" onClick={() => onClose?.()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={['preview-modal__panel', className].filter(Boolean).join(' ')}
      >
        {(title !== undefined || onClose) && (
          <header className="preview-modal__header">
            {title !== undefined && <span className="preview-modal__title">{title}</span>}
            {onClose && (
              <button
                type="button"
                className="preview-modal__close"
                aria-label={closeLabel}
                onClick={() => onClose()}
              >
                ×
              </button>
            )}
          </header>
        )}
        <div className="preview-modal__body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
