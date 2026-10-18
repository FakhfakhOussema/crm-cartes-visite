"use client";

import { useEffect, useRef, useState } from "react";
import StatusSelect from "@/components/StatusSelect";
import { EXCEL_ACCEPT } from "@/lib/contacts";
import { formatDate } from "@/lib/format-date";
import { rowTone } from "@/lib/row-tone";
import {
  CALL_STATUSES,
  EMAIL_STATUSES,
  FILE_RECEIVED,
  FILE_STATES,
  STOCK_STATUSES,
} from "@/lib/statuses";

const COLUMNS = [
  "Last name",
  "First name",
  "Email",
  "Phone",
  "Company",
  "Call status",
  "Email status",
  "Stock",
  "File state",
  "File",
  "Date added",
];

const actionButtonClassName =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

// "File" column: the (Excel) stock file only exists if the file state is "Received".
function StockFileCell({ contact, fullName, onUploadFile, onPreviewFile }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  if (contact.fileState !== FILE_RECEIVED) {
    return <span className="text-gray-400">—</span>;
  }

  async function handleChange(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be selected again
    if (!file) return;
    setIsUploading(true);
    try {
      await onUploadFile(contact, file);
    } finally {
      setIsUploading(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={EXCEL_ACCEPT}
      onChange={handleChange}
      className="hidden"
      aria-label={`Stock file of ${fullName}`}
    />
  );

  if (isUploading) {
    return <span className="text-sm text-gray-500">Uploading...</span>;
  }

  if (!contact.fileUrl) {
    return (
      <>
        {input}
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          className={`${actionButtonClassName} border border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600`}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Attach a file
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {input}
      <button
        type="button"
        onClick={() => onPreviewFile(contact)}
        aria-label={`View the stock file of ${fullName}`}
        className={`${actionButtonClassName} text-gray-700 hover:bg-gray-100 hover:text-indigo-700`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M2.04 12.32a1.01 1.01 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3.01 9.96 7.18.07.21.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3.01-9.96-7.18Z" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        View
      </button>
      <a
        href={contact.fileUrl}
        aria-label={`Download the stock file of ${fullName}`}
        className={`${actionButtonClassName} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
          <path d="M14 3v5h5M9 13l4 4m0-4-4 4" />
        </svg>
        Download
      </a>
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        aria-label={`Replace the stock file of ${fullName}`}
        title="Replace the file"
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </button>
    </div>
  );
}

// Colour of each row (see lib/row-tone.js): tinted background + coloured bar on the left. Full class names for Tailwind.
const ROW_STYLES = {
  green: { row: "bg-emerald-50 hover:bg-emerald-100/70", edge: "shadow-[inset_4px_0_0_0_#10b981]" },
  orange: { row: "bg-orange-50 hover:bg-orange-100/70", edge: "shadow-[inset_4px_0_0_0_#f97316]" },
  red: { row: "bg-red-50 hover:bg-red-100/70", edge: "shadow-[inset_4px_0_0_0_#ef4444]" },
  none: { row: "hover:bg-gray-50", edge: "" },
};

export default function ContactsGrid({
  contacts,
  onStatusChange,
  onViewContact,
  onEditContact,
  onUploadFile,
  onPreviewFile,
  onDeleteContact,
  highlightedId,
}) {
  // After an addition or a change of stock / state, the row moves (colour sort): we bring it back into view.
  useEffect(() => {
    if (!highlightedId) return;
    document
      .querySelector(`[data-contact-id="${highlightedId}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [highlightedId]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  {column}
                </th>
              ))}
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  No contacts yet.
                </td>
              </tr>
            )}
            {contacts.map((contact) => {
              const fullName = `${contact.firstName} ${contact.lastName}`.trim() || "this contact";
              const tone = ROW_STYLES[rowTone(contact)];
              return (
                <tr
                  key={contact.id}
                  data-contact-id={contact.id}
                  data-tone={rowTone(contact)}
                  className={`transition-colors ${tone.row} ${contact.id === highlightedId ? "row-highlight" : ""}`}
                >
                  <td className={`whitespace-nowrap px-4 py-3 font-medium text-gray-900 ${tone.edge}`}>
                    {contact.lastName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {contact.firstName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {contact.phone}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {contact.company}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusSelect
                      label={`Call status of ${fullName}`}
                      value={contact.callStatus}
                      options={CALL_STATUSES}
                      onChange={(value) =>
                        onStatusChange(contact.id, "callStatus", value)
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusSelect
                      label={`Email status of ${fullName}`}
                      value={contact.emailStatus}
                      options={EMAIL_STATUSES}
                      onChange={(value) =>
                        onStatusChange(contact.id, "emailStatus", value)
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusSelect
                      label={`Stock of ${fullName}`}
                      value={contact.stock}
                      options={STOCK_STATUSES}
                      onChange={(value) => onStatusChange(contact.id, "stock", value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusSelect
                      label={`File state of ${fullName}`}
                      value={contact.fileState}
                      options={FILE_STATES}
                      onChange={(value) => onStatusChange(contact.id, "fileState", value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StockFileCell
                      contact={contact}
                      fullName={fullName}
                      onUploadFile={onUploadFile}
                      onPreviewFile={onPreviewFile}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDate(contact.dateAdded)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onViewContact(contact)}
                      aria-label={`View the details of ${fullName}`}
                      title="View details"
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M2.04 12.32a1.01 1.01 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3.01 9.96 7.18.07.21.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3.01-9.96-7.18Z" />
                        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditContact(contact)}
                      aria-label={`Edit ${fullName}`}
                      title="Edit contact"
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="m16.86 4.49 1.69-1.69a1.88 1.88 0 1 1 2.65 2.65L10.58 16.07a4.5 4.5 0 0 1-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 0 1 1.13-1.9l8.93-8.93Zm0 0L19.5 7.13M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteContact(contact)}
                      aria-label={`Delete ${fullName}`}
                      title="Delete contact"
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
