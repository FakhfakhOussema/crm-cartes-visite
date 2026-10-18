"use client";

import { useEffect, useRef } from "react";

// Common base of the modals: native <dialog> (traps focus, makes the background inert, handles Escape via onCancel).
// Mount it only when the modal must be open; the content (title, body, buttons) is provided by the caller.
export default function Modal({ onClose, labelledBy, sizeClassName = "max-w-lg", children }) {
  const dialogRef = useRef(null);
  const pressStartedOnBackdropRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      // Escape: we prevent the native close and let the caller decide (close, or for example
      // only leave an edit mode without losing the whole window).
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Close on a click on the backdrop (backdrop = the <dialog> itself), provided the click
      // also started there: otherwise, selecting text in a field and releasing the mouse
      // outside the modal would close it and lose the input.
      onMouseDown={(event) => {
        pressStartedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressStartedOnBackdropRef.current && event.target === event.currentTarget) {
          onClose();
        }
      }}
      className={`m-auto w-[calc(100%-2rem)] ${sizeClassName} overflow-y-auto rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-900/50`}
    >
      {children}
    </dialog>
  );
}
