"use client";

import { useCallback, useState } from "react";
import ContactFields, {
  EMPTY_CONTACT_VALUES,
  validateContactValues,
} from "@/components/ContactFields";
import { insertContact } from "@/lib/contacts";

// Business card shown for reference (automatic analysis failed) so its information can be copied.
// It is not saved with the contact. The local URL is created and released by the tag itself
// (`ref` callback, with cleanup): it follows the file and does not depend on the import tab.
function ReferenceImage({ file }) {
  const attach = useCallback(
    (image) => {
      if (!image) return undefined;
      const url = URL.createObjectURL(file);
      image.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-gray-700">{file.name}</p>
        <span className="shrink-0 text-xs text-gray-500">For reference, not saved</span>
      </div>
      {/* Local blob URL: next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={attach}
        alt="Business card to copy from"
        className="mx-auto max-h-56 w-auto rounded-lg object-contain"
      />
    </div>
  );
}

export default function ManualContactForm({ onClose, onContactAdded, referenceFile = null }) {
  const [values, setValues] = useState(EMPTY_CONTACT_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const validationError = validateContactValues(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const contact = await insertContact(values);
      onContactAdded(contact);
      // The parent unmounts the modal: the form starts empty again the next time it opens.
      onClose();
    } catch (insertError) {
      setError(`The contact could not be added: ${insertError.message}`);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5">
        {referenceFile && <ReferenceImage file={referenceFile} />}

        <ContactFields values={values} onChange={handleChange} disabled={isSubmitting} />

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding..." : "Add contact"}
        </button>
      </div>
    </form>
  );
}
