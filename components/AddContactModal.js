"use client";

import { useId, useRef, useState } from "react";
import CardImportPanel from "@/components/CardImportPanel";
import ManualContactForm from "@/components/ManualContactForm";
import Modal from "@/components/Modal";

const TABS = [
  { id: "import", label: "Import a business card" },
  { id: "manual", label: "Manual entry" },
];

// `initialFile`: photo taken with the page's "Scan" button, loaded in the import tab as soon as the window opens.
export default function AddContactModal({ onClose, onContactAdded, existingContacts, initialFile }) {
  const baseId = useId();
  const tabRefs = useRef([]);
  const [activeTab, setActiveTab] = useState("import");
  // Card whose automatic analysis failed: shown for reference in the "Manual entry" tab.
  const [referenceFile, setReferenceFile] = useState(null);

  // Keyboard navigation between tabs (arrows, Home, End) with a roving tabindex.
  function handleTabKeyDown(event, index) {
    const last = TABS.length - 1;
    let next;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;

    event.preventDefault();
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <Modal onClose={onClose} labelledBy="add-contact-title">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h2 id="add-contact-title" className="text-lg font-semibold">
          Add a contact
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <div
        role="tablist"
        aria-label="How to add the contact"
        className="flex gap-2 border-b border-gray-200 px-6"
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`-mb-px flex-1 border-b-2 px-3 py-3 text-center text-sm font-medium transition-colors focus:outline-none focus-visible:rounded-t-md focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Both panels stay mounted (the other one is simply hidden):
          switching tabs loses neither the image preview nor the input in progress. */}
      <div
        role="tabpanel"
        id={`${baseId}-panel-import`}
        aria-labelledby={`${baseId}-tab-import`}
        hidden={activeTab !== "import"}
      >
        <CardImportPanel
          onClose={onClose}
          onContactAdded={onContactAdded}
          existingContacts={existingContacts}
          initialFile={initialFile}
          onSwitchToManual={(file) => {
            setReferenceFile(file);
            setActiveTab("manual");
          }}
        />
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-manual`}
        aria-labelledby={`${baseId}-tab-manual`}
        hidden={activeTab !== "manual"}
      >
        <ManualContactForm
          onClose={onClose}
          onContactAdded={onContactAdded}
          existingContacts={existingContacts}
          referenceFile={referenceFile}
        />
      </div>
    </Modal>
  );
}
