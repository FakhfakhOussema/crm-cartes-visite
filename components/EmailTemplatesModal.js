"use client";

import { useState } from "react";
import { Field } from "@/components/ContactFields";
import Modal from "@/components/Modal";
import { saveEmailTemplate, TEMPLATE_PLACEHOLDERS } from "@/lib/email-templates";
import { CONTACT_TYPES } from "@/lib/statuses";

// Configuration of the email sent to the contacts of each type (A / B): subject and body.
// Mount it only when it must be open. `onSaved(type, template)` lets the parent update its copy.
export default function EmailTemplatesModal({ templates, onClose, onSaved }) {
  const [type, setType] = useState(CONTACT_TYPES[0].value);
  // One draft per type: switching tab does not lose what has been typed.
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      CONTACT_TYPES.map(({ value }) => [
        value,
        { subject: templates[value]?.subject ?? "", body: templates[value]?.body ?? "" },
      ]),
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedType, setSavedType] = useState(null);

  const draft = drafts[type];

  function handleChange(event) {
    const { name, value } = event.target;
    setSavedType(null);
    setDrafts((current) => ({ ...current, [type]: { ...current[type], [name]: value } }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await saveEmailTemplate(type, draft);
      onSaved(type, draft);
      setSavedType(type);
    } catch (saveError) {
      setError(`The email could not be saved: ${saveError.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal onClose={isSaving ? () => {} : onClose} labelledBy="email-templates-title" sizeClassName="max-w-2xl">
      <form onSubmit={handleSave}>
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="email-templates-title" className="text-lg font-semibold">
            Email templates
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Subject and body of the email prepared by the Send icon, one per contact type.
          </p>
        </div>

        <div role="tablist" aria-label="Contact type" className="flex gap-2 border-b border-gray-200 px-6">
          {CONTACT_TYPES.map(({ value }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={type === value}
              onClick={() => {
                setType(value);
                setSavedType(null);
              }}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:rounded-t-md focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                type === value
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Type {value}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Subject" name="subject" value={draft.subject} onChange={handleChange} disabled={isSaving} />
          <Field label="Body" name="body" value={draft.body} onChange={handleChange} disabled={isSaving} multiline />

          <p className="text-xs text-gray-500">
            Placeholders replaced by the contact&apos;s values:{" "}
            {TEMPLATE_PLACEHOLDERS.map(({ key, label }, index) => (
              <span key={key}>
                {index > 0 && ", "}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-700" title={label}>
                  {`{{${key}}}`}
                </code>
              </span>
            ))}
          </p>

          {savedType === type && (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              Type {type} email saved.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : `Save type ${type}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
