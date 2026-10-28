"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import StatusSelect from "@/components/StatusSelect";
import { EXCEL_ACCEPT } from "@/lib/contacts";
import { formatDate } from "@/lib/format-date";
import { rowTone } from "@/lib/row-tone";
import { useMediaQuery } from "@/lib/use-media-query";
import { websiteHref } from "@/lib/website";
import {
  CALL_STATUSES,
  CONTACT_CHANNELS,
  CONTACT_TYPES,
  EMAIL_STATUSES,
  FILE_RECEIVED,
  FILE_STATES,
  STOCK_STATUSES,
} from "@/lib/statuses";

// Plain text value followed by its copy icon (shown when the row is hovered). `truncate`: long text cut with "…"
// (the full text stays in the tooltip).
function CopyableText({ text, label, truncate = false }) {
  if (!text) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${truncate ? "max-w-xs" : ""}`}>
      <span className={truncate ? "truncate" : ""} title={truncate ? text : undefined}>
        {text}
      </span>
      <CopyButton text={text} label={label} revealOnHover />
    </span>
  );
}

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
// `row`: table row (with hover); `card`: mobile card.
const ROW_STYLES = {
  green: {
    row: "bg-emerald-50 hover:bg-emerald-100/70",
    card: "bg-emerald-50",
    edge: "shadow-[inset_4px_0_0_0_#10b981]",
  },
  orange: {
    row: "bg-orange-50 hover:bg-orange-100/70",
    card: "bg-orange-50",
    edge: "shadow-[inset_4px_0_0_0_#f97316]",
  },
  red: {
    row: "bg-red-50 hover:bg-red-100/70",
    card: "bg-red-50",
    edge: "shadow-[inset_4px_0_0_0_#ef4444]",
  },
  none: { row: "hover:bg-gray-50", card: "bg-white", edge: "" },
};

// The dropdowns shown in every row / card, in this order (after the company). `widthClassName`: width in the table,
// just enough for the longest option.
const STATUS_FIELDS = [
  { label: "Call status", field: "callStatus", options: CALL_STATUSES, widthClassName: "w-33" },
  { label: "Email status", field: "emailStatus", options: EMAIL_STATUSES, widthClassName: "w-26" },
  { label: "Stock", field: "stock", options: STOCK_STATUSES, widthClassName: "w-34" },
  { label: "Type", field: "type", options: CONTACT_TYPES, widthClassName: "w-16" },
  { label: "Contact", field: "channel", options: CONTACT_CHANNELS, widthClassName: "w-33" },
  { label: "File state", field: "fileState", options: FILE_STATES, widthClassName: "w-28" },
];

// Columns of the table; everything else is in the details panel opened by the arrow of each row.
const COLUMNS = ["Company", ...STATUS_FIELDS.map(({ label }) => label), "Notes"];

// One labelled value of the details panel. `empty`: nothing to show, a dash is displayed instead.
function DetailItem({ label, empty = false, className = "", children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-gray-800">
        {empty ? <span className="text-gray-400">—</span> : children}
      </dd>
    </div>
  );
}

// Takes the whole line on a phone (two columns), one cell from the `sm` breakpoint.
const WIDE_ON_PHONE = "col-span-2 sm:col-span-1";

// Everything that is not in the row itself: shared by the table (details row) and the mobile card.
function ContactDetails({ contact, fullName, getSendHref, onUploadFile, onPreviewFile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8 lg:grid-cols-3">
      <DetailItem label="First name" empty={!contact.firstName}>
        <CopyableText text={contact.firstName} label="the first name" />
      </DetailItem>
      <DetailItem label="Last name" empty={!contact.lastName}>
        <CopyableText text={contact.lastName} label="the last name" />
      </DetailItem>
      <DetailItem label="Position" empty={!contact.position} className={WIDE_ON_PHONE}>
        <CopyableText text={contact.position} label="the position" />
      </DetailItem>
      <DetailItem label="Email" empty={!contact.email} className={WIDE_ON_PHONE}>
        <span className="inline-flex items-center gap-1">
          <a
            href={`mailto:${contact.email}`}
            className="break-all text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {contact.email}
          </a>
          <CopyButton text={contact.email} label="the email" revealOnHover />
          {/* Opens Outlook on the web (new tab) with the email of the contact's type, ready to send. */}
          <a
            href={getSendHref(contact)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Send the type ${contact.type} email to ${fullName}`}
            title={`Send the type ${contact.type} email`}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
              <path d="M6 12 3.27 3.13a.5.5 0 0 1 .7-.58l17.5 8.75a.5.5 0 0 1 0 .9l-17.5 8.75a.5.5 0 0 1-.7-.58L6 12Zm0 0h7" />
            </svg>
          </a>
        </span>
      </DetailItem>
      <DetailItem label="Phone" empty={!contact.phone}>
        <CopyableText text={contact.phone} label="the phone number" />
      </DetailItem>
      <DetailItem label="Web site" empty={!contact.website} className={WIDE_ON_PHONE}>
        <span className="inline-flex items-center gap-1">
          <a
            href={websiteHref(contact.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {contact.website}
          </a>
          <CopyButton text={contact.website} label="the web site" revealOnHover />
        </span>
      </DetailItem>
      <DetailItem label="Address" empty={!contact.address} className="col-span-2 lg:col-span-3">
        <CopyableText text={contact.address} label="the address" />
      </DetailItem>
      <DetailItem label="Stock file" className={WIDE_ON_PHONE}>
        <StockFileCell
          contact={contact}
          fullName={fullName}
          onUploadFile={onUploadFile}
          onPreviewFile={onPreviewFile}
        />
      </DetailItem>
      <DetailItem label="Date added" empty={!contact.dateAdded}>
        {formatDate(contact.dateAdded)}
      </DetailItem>
      <DetailItem label="Notes" empty={!contact.notes} className="col-span-2 lg:col-span-3">
        <span className="whitespace-pre-wrap">{contact.notes}</span>
      </DetailItem>
    </dl>
  );
}

// Mark on a contact added although it was already in the list (see markDuplicates). The tooltip tells which one.
function DuplicateBadge({ duplicate: { original, reasons } }) {
  const originalName = `${original.firstName} ${original.lastName}`.trim();
  const added = original.dateAdded && ` (added ${formatDate(original.dateAdded)})`;
  return (
    <span
      title={`Duplicate of ${originalName}${added || ""} — ${reasons.join(", ").toLowerCase()}`}
      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300"
    >
      Duplicate
    </span>
  );
}

// Arrow opening / closing the details of a row. `className`: size of the touch target.
function DetailsToggle({ isExpanded, fullName, detailsId, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isExpanded}
      aria-controls={isExpanded ? detailsId : undefined}
      aria-label={`${isExpanded ? "Hide" : "Show"} the details of ${fullName}`}
      title={isExpanded ? "Hide details" : "Show details"}
      className={`rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

// View / edit / delete. `buttonClassName`: padding of the buttons (larger on touch screens).
function RowActions({ contact, fullName, onView, onEdit, onDelete, buttonClassName }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onView(contact)}
        aria-label={`View the details of ${fullName}`}
        title="View details"
        className={`rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${buttonClassName}`}
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
        onClick={() => onEdit(contact)}
        aria-label={`Edit ${fullName}`}
        title="Edit contact"
        className={`rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${buttonClassName}`}
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
        onClick={() => onDelete(contact)}
        aria-label={`Delete ${fullName}`}
        title="Delete contact"
        className={`rounded-md text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${buttonClassName}`}
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
    </>
  );
}

// Controls inside a row (links, buttons, dropdowns…) keep their own behaviour: a click on them does not select the row.
const INTERACTIVE_ELEMENTS = "a, button, input, select, textarea, label, summary";

// Below this width (Tailwind's `md`), the table is replaced by one card per contact: no horizontal scrolling.
const MOBILE_QUERY = "(max-width: 767px)";

// Mobile version of a row: company and actions on top, the dropdowns in two columns, details below.
function ContactCard({
  contact,
  duplicate,
  isSelected,
  isExpanded,
  isHighlighted,
  onRowClick,
  onToggleExpanded,
  onStatusChange,
  onViewContact,
  onEditContact,
  onDeleteContact,
  getSendHref,
  onUploadFile,
  onPreviewFile,
}) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim() || "this contact";
  const tone = ROW_STYLES[rowTone(contact)];
  const detailsId = `contact-details-${contact.id}`;

  return (
    <li
      data-contact-id={contact.id}
      data-tone={rowTone(contact)}
      onClick={(event) => onRowClick(event, contact.id)}
      className={`rounded-xl border border-gray-200 shadow-sm transition-colors ${tone.card} ${tone.edge} ${isSelected ? "ring-2 ring-indigo-400" : ""} ${isHighlighted ? "row-highlight" : ""}`}
    >
      <div className="flex items-start gap-1 px-2 pt-2">
        <DetailsToggle
          isExpanded={isExpanded}
          fullName={fullName}
          detailsId={detailsId}
          onClick={() => onToggleExpanded(contact.id)}
          className="shrink-0 p-2"
        />
        <div className="min-w-0 flex-1 pt-2">
          <p className="break-words font-medium text-gray-900">
            {contact.company || <span className="font-normal text-gray-500">{fullName}</span>}
          </p>
          {duplicate && (
            <span className="mt-1 inline-block">
              <DuplicateBadge duplicate={duplicate} />
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <RowActions
            contact={contact}
            fullName={fullName}
            onView={onViewContact}
            onEdit={onEditContact}
            onDelete={onDeleteContact}
            buttonClassName="p-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-4 pt-3">
        {STATUS_FIELDS.map(({ label, field, options }) => (
          <div key={field} className="min-w-0">
            <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
            <StatusSelect
              label={`${label} of ${fullName}`}
              value={contact[field]}
              options={options}
              widthClassName="w-full"
              onChange={(value) => onStatusChange(contact.id, field, value)}
            />
          </div>
        ))}
      </div>

      {isExpanded && (
        <div id={detailsId} className="border-t border-gray-200/80 bg-white/70 px-4 py-4">
          <ContactDetails
            contact={contact}
            fullName={fullName}
            getSendHref={getSendHref}
            onUploadFile={onUploadFile}
            onPreviewFile={onPreviewFile}
          />
        </div>
      )}
    </li>
  );
}

export default function ContactsGrid({
  contacts,
  duplicates,
  selectedId,
  onToggleSelected,
  onStatusChange,
  onViewContact,
  onEditContact,
  onUploadFile,
  onPreviewFile,
  onDeleteContact,
  getSendHref,
  highlightedId,
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [expandedIds, setExpandedIds] = useState(() => new Set()); // rows whose details are open

  function toggleExpanded(id) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // A click on the row selects it (a single row at a time); a second click unselects it. Selecting text (to copy it) is not a click on the row.
  function handleRowClick(event, id) {
    if (event.target.closest(INTERACTIVE_ELEMENTS)) return;
    if (window.getSelection()?.toString()) return;
    onToggleSelected(id);
  }

  // After an addition or a change of stock / state, the row moves (colour sort): we bring it back into view.
  useEffect(() => {
    if (!highlightedId) return;
    document
      .querySelector(`[data-contact-id="${highlightedId}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [highlightedId]);

  if (isMobile) {
    return (
      <ul className="space-y-3">
        {contacts.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-500">
            No contacts yet.
          </li>
        )}
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            duplicate={duplicates.get(contact.id)}
            isSelected={contact.id === selectedId}
            isExpanded={expandedIds.has(contact.id)}
            isHighlighted={contact.id === highlightedId}
            onRowClick={handleRowClick}
            onToggleExpanded={toggleExpanded}
            onStatusChange={onStatusChange}
            onViewContact={onViewContact}
            onEditContact={onEditContact}
            onDeleteContact={onDeleteContact}
            getSendHref={getSendHref}
            onUploadFile={onUploadFile}
            onPreviewFile={onPreviewFile}
          />
        ))}
      </ul>
    );
  }

  return (
    // No scroll container of its own: a table wider than the window widens the page, and the browser's own
    // horizontal scrollbar is used. `w-max min-w-full`: full width, and the frame follows the table if it is wider.
    // No `overflow-hidden` either (it would cut the table): the rounded corners are given to the header cells.
    <div className="w-max min-w-full rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="w-10 rounded-tl-xl px-2 py-3">
              <span className="sr-only">Details</span>
            </th>
            {COLUMNS.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`whitespace-nowrap ${index === 0 ? "px-4" : "px-2"} py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500`}
              >
                {column}
              </th>
            ))}
            <th
              scope="col"
              className="whitespace-nowrap rounded-tr-xl px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {contacts.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length + 2}
                className="px-4 py-12 text-center text-gray-500"
              >
                No contacts yet.
              </td>
            </tr>
          )}
          {contacts.map((contact) => {
            const fullName = `${contact.firstName} ${contact.lastName}`.trim() || "this contact";
            const tone = ROW_STYLES[rowTone(contact)];
            const isSelected = contact.id === selectedId;
            const isExpanded = expandedIds.has(contact.id);
            const detailsId = `contact-details-${contact.id}`;
            const selectedClassName = isSelected ? "[&>td]:bg-indigo-300/30" : "";
            return (
              <Fragment key={contact.id}>
                <tr
                  data-contact-id={contact.id}
                  data-tone={rowTone(contact)}
                  onClick={(event) => handleRowClick(event, contact.id)}
                  className={`group cursor-pointer transition-colors ${tone.row} ${selectedClassName} ${contact.id === highlightedId ? "row-highlight" : ""}`}
                >
                  {/* The coloured bar stays on the left edge of the row, so it is carried by this first cell. */}
                  <td className={`w-10 px-2 py-3 ${tone.edge}`}>
                    <DetailsToggle
                      isExpanded={isExpanded}
                      fullName={fullName}
                      detailsId={detailsId}
                      onClick={() => toggleExpanded(contact.id)}
                      className="p-1"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <CopyableText text={contact.company} label="the company" />
                      {duplicates.has(contact.id) && (
                        <DuplicateBadge duplicate={duplicates.get(contact.id)} />
                      )}
                    </span>
                  </td>
                  {STATUS_FIELDS.map(({ label, field, options, widthClassName }) => (
                    <td key={field} className="whitespace-nowrap px-2 py-3">
                      <StatusSelect
                        label={`${label} of ${fullName}`}
                        value={contact[field]}
                        options={options}
                        widthClassName={widthClassName}
                        compact
                        onChange={(value) => onStatusChange(contact.id, field, value)}
                      />
                    </td>
                  ))}
                  {/* Notes read in place: up to 3 lines, the full text is in the tooltip and the details panel. */}
                  <td className="w-72 min-w-56 max-w-80 px-2 py-3 text-gray-700">
                    {contact.notes ? (
                      <p title={contact.notes} className="line-clamp-3 whitespace-pre-wrap break-words">
                        {contact.notes}
                      </p>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <RowActions
                      contact={contact}
                      fullName={fullName}
                      onView={onViewContact}
                      onEdit={onEditContact}
                      onDelete={onDeleteContact}
                      buttonClassName="p-1.5"
                    />
                  </td>
                </tr>
                {isExpanded && (
                  <tr id={detailsId} className={`group ${tone.row} ${selectedClassName}`}>
                    <td colSpan={COLUMNS.length + 2} className={`px-4 pb-4 pt-1 ${tone.edge}`}>
                      <div className="rounded-lg border border-gray-200 bg-white/80 px-5 py-4">
                        <ContactDetails
                          contact={contact}
                          fullName={fullName}
                          getSendHref={getSendHref}
                          onUploadFile={onUploadFile}
                          onPreviewFile={onPreviewFile}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
