import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Extra classes for the panel, e.g. a wider max width. */
  className?: string;
}

/**
 * Modal built on the native <dialog> element: focus trapping, Esc to close and the top layer come
 * for free. Appears as a bottom sheet on phones and a centred panel on larger screens.
 */
export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself, outside the inner panel.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className={`m-0 mt-auto w-full max-w-none rounded-t-2xl border border-border bg-surface p-0 text-text backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-2xl ${className}`}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
