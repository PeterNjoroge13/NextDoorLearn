import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './dialog.css';

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const DialogShell = ({ children, labelledBy, describedBy, onClose, className = '', closeLabel = 'Close dialog', closeDisabled = false }) => {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll(focusableSelector);
    (focusable?.[0] || dialog)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll(focusableSelector)];
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}>
      <section
        ref={dialogRef}
        className={`dialog-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex="-1"
      >
        {children}
        <button className="dialog-close" type="button" onClick={onClose} aria-label={closeLabel} disabled={closeDisabled}>
          <X size={18} />
        </button>
      </section>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  tone = 'danger',
  onConfirm,
  onClose,
}) => {
  const id = useId();
  if (!open) return null;

  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <DialogShell labelledBy={titleId} describedBy={descriptionId} onClose={onClose} closeDisabled={busy} className="confirm-dialog">
      <div className={`dialog-icon dialog-icon-${tone}`} aria-hidden="true">
        <AlertTriangle size={24} />
      </div>
      <div className="dialog-copy">
        <p className="dialog-kicker">Please confirm</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{message}</p>
      </div>
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>{cancelLabel}</button>
        <button className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
};
