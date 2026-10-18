"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { deleteContact } from "@/lib/contacts";

// Confirmation before permanently deleting a contact. Mount it only when `contact` is defined.
export default function ConfirmDeleteModal({ contact, onCancel, onDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const fullName = `${contact.firstName} ${contact.lastName}`.trim() || "This contact";

  async function handleConfirm() {
    if (isDeleting) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteContact(contact.id);
      // The parent removes the row and unmounts this window: no setState afterwards.
      onDeleted(contact.id);
    } catch (deleteError) {
      setError(`The contact could not be deleted: ${deleteError.message}`);
      setIsDeleting(false);
    }
  }

  return (
    // While deleting, Escape and a click on the backdrop do nothing: we do not abandon a request in progress.
    <Modal
      onClose={isDeleting ? () => {} : onCancel}
      labelledBy="confirm-delete-title"
      sizeClassName="max-w-md"
    >
      <div className="flex gap-4 px-6 py-5">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 id="confirm-delete-title" className="text-lg font-semibold">
            Delete this contact?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            <span className="break-words font-medium text-gray-900">{fullName}</span>
            {contact.company && <span className="break-words"> ({contact.company})</span>} will be
            permanently deleted from the list. This action cannot be undone.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        {/* Initial focus is on "Cancel": an accidental keyboard confirmation deletes nothing. */}
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          disabled={isDeleting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDeleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
