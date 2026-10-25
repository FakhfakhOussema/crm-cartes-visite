"use client";

import Modal from "@/components/Modal";
import { formatDate } from "@/lib/format-date";

// Shown when the contact being added looks like one already in the list: the user can add it anyway or cancel.
// `matches`: [{ contact, reasons }] (see findDuplicates). Mount it only when there is something to show.
export default function DuplicateContactModal({ matches, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} labelledBy="duplicate-contact-title" sizeClassName="max-w-md">
      <div className="flex gap-4 px-6 py-5">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
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
          <h2 id="duplicate-contact-title" className="text-lg font-semibold">
            This contact already exists
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {matches.length > 1 ? "These contacts are" : "This contact is"} already in the list. Add
            it anyway? It will be marked as a duplicate.
          </p>
          <ul className="mt-3 space-y-2">
            {matches.map(({ contact, reasons }) => (
              <li
                key={contact.id}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <p className="break-words font-medium text-gray-900">
                  {`${contact.firstName} ${contact.lastName}`.trim()}
                  {contact.company && (
                    <span className="font-normal text-gray-600"> ({contact.company})</span>
                  )}
                </p>
                {(contact.email || contact.phone) && (
                  <p className="break-words text-gray-600">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-amber-700">
                  {reasons.join(", ")}
                  {contact.dateAdded && ` · added ${formatDate(contact.dateAdded)}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        {/* Initial focus is on "Cancel": an accidental keyboard confirmation adds nothing. */}
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Add anyway
        </button>
      </div>
    </Modal>
  );
}
