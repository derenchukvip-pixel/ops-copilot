"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons, laid out by the caller so each dialog controls its own emphasis. */
  footer: ReactNode;
}

/**
 * Built on the native `<dialog>` element opened with `showModal()`.
 *
 * That gives focus containment, restoring focus to the trigger on close, `aria-modal`, inertness
 * of the page behind, and Escape-to-close from the platform rather than from three hundred lines
 * of hand-rolled focus management that will be subtly wrong. The only thing added here is
 * click-outside-to-close and the styling.
 */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    // Fires for Escape as well as for `close()`, so the parent's state cannot drift out of
    // sync with whether the dialog is actually on screen.
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(event) => {
        // The dialog element's own box is the backdrop area; a click that lands on it rather
        // than on the content below means the user clicked outside.
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      className={[
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-[14px] border border-line bg-surface p-0",
        "text-ink shadow-(--shadow-raised)",
        "backdrop:bg-ink/40",
      ].join(" ")}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-title text-ink">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
        {footer}
      </div>
    </dialog>
  );
}
