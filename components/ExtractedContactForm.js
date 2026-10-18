"use client";

import { useRef, useState } from "react";
import ContactFields, { validateContactValues } from "@/components/ContactFields";
import { insertContact, uploadCardImage } from "@/lib/contacts";

// Form pre-filled with the data extracted from the card; editable before the contact is finally added.
export default function ExtractedContactForm({
  file,
  previewUrl,
  initialValues,
  onBack,
  onClose,
  onContactAdded,
}) {
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // URL of the image already uploaded: if the insert fails, a new attempt does not upload the file again.
  const uploadedUrlRef = useRef(null);

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
      if (!uploadedUrlRef.current) {
        uploadedUrlRef.current = await uploadCardImage(file);
      }
    } catch (uploadError) {
      setError(`The image could not be uploaded: ${uploadError.message}`);
      setIsSubmitting(false);
      return;
    }

    try {
      const contact = await insertContact(values, uploadedUrlRef.current);
      onContactAdded(contact);
      // The parent unmounts the modal: all the state (image, form) is reset.
      onClose();
    } catch (insertError) {
      setError(`The contact could not be added: ${insertError.message}`);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          {/* Local blob URL: next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Imported business card"
            className="h-14 w-20 shrink-0 rounded-md border border-gray-200 bg-white object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-500">
              Information extracted automatically: check it and correct it if needed.
            </p>
          </div>
        </div>

        <ContactFields values={values} onChange={handleChange} disabled={isSubmitting} />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding..." : "Confirm and add"}
        </button>
      </div>
    </form>
  );
}
