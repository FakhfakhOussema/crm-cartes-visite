"use client";

import { useState } from "react";
import ContactEditForm from "@/components/ContactEditForm";
import CopyButton from "@/components/CopyButton";
import Modal from "@/components/Modal";
import { TONES } from "@/components/StatusSelect";
import { formatDate } from "@/lib/format-date";
import { websiteHref } from "@/lib/website";
import {
  CALL_STATUSES,
  CONTACT_TYPES,
  EMAIL_STATUSES,
  FILE_RECEIVED,
  FILE_STATES,
  STOCK_STATUSES,
} from "@/lib/statuses";

// Same coloured pill as the grid's status lists, but read-only.
function StatusBadge({ value, options }) {
  const tone = TONES[options.find((option) => option.value === value)?.tone] ?? TONES.orange;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${tone.select}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
      {value}
    </span>
  );
}

// `copy`: text offered by a copy icon next to the value (text fields only).
function Detail({ label, className = "", copy, children }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 flex items-start gap-1 break-words text-sm text-gray-900">
        <span className="min-w-0 break-words">
          {children || <span className="text-gray-400">—</span>}
        </span>
        {copy && <CopyButton text={copy} label={`the ${label.toLowerCase()}`} />}
      </dd>
    </div>
  );
}

function CardImage({ url, name }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-gray-400"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        {failed ? "Image unavailable" : "No image"}
      </div>
    );
  }

  return (
    <div>
      {/* Remote Supabase Storage URL: next/image would require declaring the domain, with no gain here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Business card of ${name}`}
        onError={() => setFailed(true)}
        className="max-h-[60vh] w-full rounded-xl border border-gray-200 bg-gray-50 object-contain"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        Open full size
      </a>
    </div>
  );
}

// A contact's sheet: read-only by default, "Edit" button to switch to editing.
// `startInEditMode`: opened directly in edit mode (the grid's pencil icon), without going through reading.
export default function ContactDetailsModal({
  contact,
  onClose,
  onContactUpdated,
  onPreviewFile,
  startInEditMode = false,
}) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim() || "this contact";
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [justSaved, setJustSaved] = useState(false);

  const image = <CardImage url={contact.imageUrl} name={fullName} />;

  // Escape / click on the backdrop: while editing, we only leave editing (without losing the window
  // or, by a wrong move, all the input); while reading, we close.
  // Opened directly in edit mode, there is no reading view to go back to: we close the window.
  const cancelEditing = () => (startInEditMode ? onClose() : setIsEditing(false));
  const handleDismiss = isEditing ? cancelEditing : onClose;

  function startEditing() {
    setJustSaved(false);
    setIsEditing(true);
  }

  function handleSaved(updated) {
    onContactUpdated(updated);
    if (startInEditMode) {
      // Quick edit: saved, the window closes (the updated row is highlighted in the grid).
      onClose();
      return;
    }
    setIsEditing(false);
    setJustSaved(true);
  }

  return (
    <Modal onClose={handleDismiss} labelledBy="contact-details-title" sizeClassName="max-w-3xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 id="contact-details-title" className="text-lg font-semibold">
          {isEditing ? "Edit contact" : "Contact details"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the window"
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {isEditing ? (
        <ContactEditForm
          contact={contact}
          imageSlot={image}
          onCancel={cancelEditing}
          onSaved={handleSaved}
        />
      ) : (
        <>
          {justSaved && (
            <p
              role="status"
              className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              Contact updated.
            </p>
          )}

          <div className="grid gap-6 px-6 py-5 md:grid-cols-5">
            <div className="md:col-span-2">{image}</div>

            <dl className="grid grid-cols-1 content-start gap-x-4 gap-y-4 sm:grid-cols-2 md:col-span-3">
              <Detail label="Company" className="sm:col-span-2" copy={contact.company}>
                {contact.company}
              </Detail>
              <Detail label="First name" copy={contact.firstName}>
                {contact.firstName}
              </Detail>
              <Detail label="Last name" copy={contact.lastName}>
                {contact.lastName}
              </Detail>
              <Detail label="Position" className="sm:col-span-2" copy={contact.position}>
                {contact.position}
              </Detail>
              <Detail label="Email" copy={contact.email}>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="break-all text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {contact.email}
                  </a>
                )}
              </Detail>
              <Detail label="Phone" copy={contact.phone}>
                {contact.phone}
              </Detail>
              <Detail label="Web site" className="sm:col-span-2" copy={contact.website}>
                {contact.website && (
                  <a
                    href={websiteHref(contact.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {contact.website}
                  </a>
                )}
              </Detail>
              <Detail label="Address" className="sm:col-span-2" copy={contact.address}>
                {contact.address}
              </Detail>
              <Detail label="Type" className="sm:col-span-2">
                <StatusBadge value={contact.type} options={CONTACT_TYPES} />
              </Detail>
              <Detail label="Call status">
                <StatusBadge value={contact.callStatus} options={CALL_STATUSES} />
              </Detail>
              <Detail label="Email status">
                <StatusBadge value={contact.emailStatus} options={EMAIL_STATUSES} />
              </Detail>
              <Detail label="Stock">
                <StatusBadge value={contact.stock} options={STOCK_STATUSES} />
              </Detail>
              <Detail label="File state">
                <StatusBadge value={contact.fileState} options={FILE_STATES} />
              </Detail>
              <Detail label="File" className="sm:col-span-2">
                {contact.fileState === FILE_RECEIVED &&
                  (contact.fileUrl ? (
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onPreviewFile(contact)}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus-visible:underline"
                      >
                        View the file
                      </button>
                      <a
                        href={contact.fileUrl}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Download the stock file
                      </a>
                    </span>
                  ) : (
                    <span className="text-gray-500">No file attached</span>
                  ))}
              </Detail>
              <Detail label="Date added" className="sm:col-span-2">
                {formatDate(contact.dateAdded, "long")}
              </Detail>
              {contact.notes && (
                <Detail label="Notes" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{contact.notes}</span>
                </Detail>
              )}
            </dl>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Close
            </button>
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
