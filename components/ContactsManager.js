"use client";

import { useEffect, useState } from "react";
import AddContactModal from "@/components/AddContactModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ContactDetailsModal from "@/components/ContactDetailsModal";
import ContactsGrid from "@/components/ContactsGrid";
import EmailTemplatesModal from "@/components/EmailTemplatesModal";
import ExcelPreviewModal from "@/components/ExcelPreviewModal";
import {
  fetchContacts,
  isExcelFile,
  updateContactField,
  uploadStockFile,
} from "@/lib/contacts";
import { buildMailtoHref, fetchEmailTemplates } from "@/lib/email-templates";
import { countByTone, filterByTones, sortByTone } from "@/lib/row-tone";
import { filterContacts } from "@/lib/search";

// Legend of the row colours (rules in lib/row-tone.js): each entry is also a filter button.
// `active`: style of the pressed button (full class names so that Tailwind detects them).
const TONE_FILTERS = [
  {
    tone: "green",
    label: "Available, file received",
    dot: "bg-emerald-500",
    active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    tone: "orange",
    label: "Available, file not received",
    dot: "bg-orange-500",
    active: "border-orange-300 bg-orange-50 text-orange-800",
  },
  {
    tone: "none",
    label: "Not processed",
    hint: "Stock not specified",
    dot: "bg-gray-400",
    active: "border-gray-400 bg-gray-100 text-gray-800",
  },
  {
    tone: "red",
    label: "Unavailable",
    dot: "bg-red-500",
    active: "border-red-300 bg-red-50 text-red-800",
  },
];

export default function ContactsManager() {
  const [contacts, setContacts] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [updateError, setUpdateError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Open sheet: { id, edit } — `edit`: opened directly in edit mode (the grid's pencil icon).
  const [viewing, setViewing] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // stock file shown in the preview
  const [contactToDelete, setContactToDelete] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null); // row to find again after a sort
  const [query, setQuery] = useState("");
  const [emailTemplates, setEmailTemplates] = useState({}); // { A: { subject, body }, B: { … } }
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Colours active in the filter buttons (several possible; none = show everything).
  const [activeTones, setActiveTones] = useState([]);

  // The search applies first; the button counters cover its result; then the colour filter;
  // then the sort: green, orange, not processed, red.
  const searchedContacts = filterContacts(contacts, query);
  const toneCounts = countByTone(searchedContacts);
  const visibleContacts = sortByTone(filterByTones(searchedContacts, activeTones));
  const viewedContact = contacts.find((contact) => contact.id === viewing?.id);

  // The highlight fades by itself.
  useEffect(() => {
    if (!highlightedId) return undefined;
    const timer = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  useEffect(() => {
    let cancelled = false;

    fetchContacts()
      .then((data) => {
        if (cancelled) return;
        setContacts(data);
        setLoadStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message);
        setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // The email templates are loaded apart: if they fail, the contacts stay usable (Send then only fills the recipient).
  useEffect(() => {
    let cancelled = false;
    fetchEmailTemplates()
      .then((data) => {
        if (!cancelled) setEmailTemplates(data);
      })
      .catch((error) => {
        if (!cancelled) setUpdateError(`The email templates could not be loaded: ${error.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleTone(tone) {
    setActiveTones((current) =>
      current.includes(tone) ? current.filter((t) => t !== tone) : [...current, tone],
    );
  }

  function handleRetry() {
    setLoadStatus("loading");
    setReloadKey((key) => key + 1);
  }

  function handleContactAdded(contact) {
    setContacts((current) => [contact, ...current]);
    // Without this, an active filter (search or colour) could hide the contact that was just added.
    setQuery("");
    setActiveTones([]);
    // A new contact (stock "Not specified") goes at the end of the list: we show it.
    setHighlightedId(contact.id);
  }

  function handleContactUpdated(updated) {
    setContacts((current) =>
      current.map((contact) => (contact.id === updated.id ? updated : contact)),
    );
    setHighlightedId(updated.id);
  }

  function handleContactDeleted(id) {
    setContacts((current) => current.filter((contact) => contact.id !== id));
    setContactToDelete(null);
  }

  async function handleStatusChange(id, field, value) {
    const previousValue = contacts.find((contact) => contact.id === id)?.[field];

    // Immediate visual feedback, then saving to Supabase.
    setUpdateError(null);
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );
    // The stock and the file state change the row's colour, hence its position: we follow it.
    if (field === "stock" || field === "fileState") setHighlightedId(id);

    try {
      await updateContactField(id, field, value);
    } catch (error) {
      // Failure: we restore the previous status (unless the user has already changed it in the meantime).
      setContacts((current) =>
        current.map((contact) =>
          contact.id === id && contact[field] === value
            ? { ...contact, [field]: previousValue }
            : contact,
        ),
      );
      setUpdateError(`The change could not be saved: ${error.message}`);
    }
  }

  // Attaches an Excel stock file to a contact (the grid's "File" column).
  async function handleFileUpload(contact, file) {
    if (!isExcelFile(file)) {
      setUpdateError("The stock file must be an Excel file (.xls, .xlsx or .xlsm).");
      return;
    }

    setUpdateError(null);
    try {
      const url = await uploadStockFile(file);
      await updateContactField(contact.id, "fileUrl", url);
      setContacts((current) =>
        current.map((c) => (c.id === contact.id ? { ...c, fileUrl: url } : c)),
      );
    } catch (error) {
      setUpdateError(`The file could not be saved: ${error.message}`);
    }
  }

  return (
    <div className="flex-1 bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            {loadStatus === "ready" && (
              <p className="mt-1 text-sm text-gray-500">
                {contacts.length} contact{contacts.length > 1 ? "s" : ""} from
                business cards
              </p>
            )}
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.58 3.58a.75.75 0 1 1-1.06 1.06l-3.58-3.58A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for a contact…"
                aria-label="Search for a contact by last name, first name, email or company"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsTemplatesOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
                <path d="M3 8l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
              </svg>
              Emails
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Add
            </button>
          </div>
        </header>

        {updateError && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{updateError}</p>
            <button
              type="button"
              onClick={() => setUpdateError(null)}
              className="shrink-0 font-medium text-red-700 hover:text-red-900 focus:outline-none focus-visible:underline"
            >
              Close
            </button>
          </div>
        )}

        {loadStatus === "ready" && contacts.length > 0 && (
          <ul
            aria-label="Filter by colour"
            className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-600"
          >
            {TONE_FILTERS.map(({ tone, label, hint, dot, active }) => {
              const isActive = activeTones.includes(tone);
              return (
                <li key={tone}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    title={hint}
                    onClick={() => toggleTone(tone)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? active
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${dot}`} />
                    {label}
                    <span className="font-normal tabular-nums opacity-70">{toneCounts[tone]}</span>
                  </button>
                </li>
              );
            })}
            {activeTones.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setActiveTones([])}
                  className="rounded-full px-2 py-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Show all
                </button>
              </li>
            )}
          </ul>
        )}

        {loadStatus === "loading" && (
          <div
            role="status"
            className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500 shadow-sm"
          >
            Loading...
          </div>
        )}

        {loadStatus === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700"
          >
            <p className="font-medium">Unable to load the contacts.</p>
            <p className="mt-1 text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Try again
            </button>
          </div>
        )}

        {loadStatus === "ready" &&
          (contacts.length > 0 && visibleContacts.length === 0 ? (
            <div
              role="status"
              className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500 shadow-sm"
            >
              No contacts found
            </div>
          ) : (
            <ContactsGrid
              contacts={visibleContacts}
              onStatusChange={handleStatusChange}
              onViewContact={(contact) => setViewing({ id: contact.id, edit: false })}
              onEditContact={(contact) => setViewing({ id: contact.id, edit: true })}
              onUploadFile={handleFileUpload}
              onPreviewFile={(contact) => setPreviewUrl(contact.fileUrl)}
              onDeleteContact={setContactToDelete}
              getMailtoHref={(contact) => buildMailtoHref(contact, emailTemplates)}
              highlightedId={highlightedId}
            />
          ))}
      </div>

      {/* Mounted only when open: the internal state (image, error) is reset each time it opens. */}
      {isModalOpen && (
        <AddContactModal
          onClose={() => setIsModalOpen(false)}
          onContactAdded={handleContactAdded}
        />
      )}

      {isTemplatesOpen && (
        <EmailTemplatesModal
          templates={emailTemplates}
          onClose={() => setIsTemplatesOpen(false)}
          onSaved={(type, template) =>
            setEmailTemplates((current) => ({ ...current, [type]: template }))
          }
        />
      )}

      {contactToDelete && (
        <ConfirmDeleteModal
          contact={contactToDelete}
          onCancel={() => setContactToDelete(null)}
          onDeleted={handleContactDeleted}
        />
      )}

      {viewedContact && (
        <ContactDetailsModal
          contact={viewedContact}
          startInEditMode={viewing.edit}
          onClose={() => setViewing(null)}
          onContactUpdated={handleContactUpdated}
          onPreviewFile={(contact) => setPreviewUrl(contact.fileUrl)}
        />
      )}

      {/* Mounted after the sheet: stacks on top of it when the preview is opened from the sheet. */}
      {previewUrl && <ExcelPreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}
