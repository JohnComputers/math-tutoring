import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useMotion';
import { Icon } from './Icon';
import './Modal.css';

/**
 * Accessible modal dialog.
 *
 * A dialog is one of the few widgets where getting accessibility wrong is genuinely
 * trapping: keyboard focus can escape to the page behind, leaving someone tabbing
 * through content they cannot see. This implements the full contract:
 *
 *   - `role="dialog"` + `aria-modal` + a labelled title
 *   - focus moves in on open and returns to the trigger on close
 *   - Tab and Shift+Tab cycle within the dialog
 *   - Escape closes
 *   - the backdrop closes on click, but only when the click *started* on the backdrop,
 *     so a drag that ends outside does not dismiss the dialog by accident
 *   - background scroll is locked
 *   - rendered through a portal, so an ancestor's `overflow: hidden` cannot clip it
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider variant for reschedule pickers and long forms. */
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const backdropMouseDown = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useScrollLock(open);

  // Remember what had focus, move focus into the dialog, restore it on close.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? dialog).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      // Wrap the ends so focus cannot walk out into the page behind.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="modal"
      onMouseDown={(event) => {
        backdropMouseDown.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        // Only dismiss when press *and* release both landed on the backdrop.
        if (backdropMouseDown.current && event.target === event.currentTarget) onClose();
        backdropMouseDown.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className={`modal__dialog modal__dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={20} />
          </button>
        </div>

        {description && (
          <p className="modal__description" id={descriptionId}>
            {description}
          </p>
        )}

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation prompt for destructive actions.
 *
 * Cancelling a booking or deleting a subject cannot be undone from the UI, so both go
 * through here rather than firing on a single click.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <div className="btn-row modal__actions">
          <button
            type="button"
            className="btn btn--ghost-dark"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="modal__message">{message}</div>
    </Modal>
  );
}
