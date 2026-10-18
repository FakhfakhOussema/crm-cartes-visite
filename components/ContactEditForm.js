"use client";

import { useRef, useState } from "react";
import ContactFields, { Field, validateContactValues } from "@/components/ContactFields";
import StatusSelect from "@/components/StatusSelect";
import { EXCEL_ACCEPT, isExcelFile, updateContact, uploadStockFile } from "@/lib/contacts";
import { formatDate } from "@/lib/format-date";
import {
  CALL_STATUSES,
  EMAIL_STATUSES,
  FILE_RECEIVED,
  FILE_STATES,
  STOCK_STATUSES,
} from "@/lib/statuses";

// Edit mode of the sheet: same fields as manual entry, plus the notes and the statuses.
// `imageSlot` keeps the image on the left, as in reading mode; the date added and the image cannot be edited.
export default function ContactEditForm({ contact, imageSlot, onCancel, onSaved }) {
  const [values, setValues] = useState({
    lastName: contact.lastName,
    firstName: contact.firstName,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    address: contact.address,
    notes: contact.notes,
    callStatus: contact.callStatus,
    emailStatus: contact.emailStatus,
    stock: contact.stock,
    fileState: contact.fileState,
  });
  const [newFile, setNewFile] = useState(null); // chosen stock file, uploaded on save
  const [fileError, setFileError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // File already uploaded: if the UPDATE fails, a new attempt does not upload the file again.
  const uploadedRef = useRef(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleStatusChange(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isExcelFile(file)) {
      setFileError("The file must be an Excel file (.xls, .xlsx or .xlsm).");
      return;
    }
    setFileError(null);
    setNewFile(file);
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

    // The file is only attached if the state is "Received"; otherwise (and without a new file) it stays unchanged.
    let fileUrl;
    if (values.fileState === FILE_RECEIVED && newFile) {
      try {
        if (uploadedRef.current?.file !== newFile) {
          uploadedRef.current = { file: newFile, url: await uploadStockFile(newFile) };
        }
        fileUrl = uploadedRef.current.url;
      } catch (uploadError) {
        setError(`The file could not be uploaded: ${uploadError.message}`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const updated = await updateContact(contact.id, { ...values, fileUrl });
      // The parent goes back to reading mode: this form is unmounted, no setState afterwards.
      onSaved(updated);
    } catch (updateError) {
      setError(`The changes could not be saved: ${updateError.message}`);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 px-6 py-5 md:grid-cols-5">
        <div className="md:col-span-2">{imageSlot}</div>

        <div className="space-y-4 md:col-span-3">
          <ContactFields values={values} onChange={handleChange} disabled={isSubmitting} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Call status</p>
              <StatusSelect
                label="Call status"
                value={values.callStatus}
                options={CALL_STATUSES}
                onChange={(value) => handleStatusChange("callStatus", value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Email status</p>
              <StatusSelect
                label="Email status"
                value={values.emailStatus}
                options={EMAIL_STATUSES}
                onChange={(value) => handleStatusChange("emailStatus", value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Stock</p>
              <StatusSelect
                label="Stock"
                value={values.stock}
                options={STOCK_STATUSES}
                onChange={(value) => handleStatusChange("stock", value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">File state</p>
              <StatusSelect
                label="File state"
                value={values.fileState}
                options={FILE_STATES}
                onChange={(value) => handleStatusChange("fileState", value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {values.fileState === FILE_RECEIVED ? (
            <div>
              <label
                htmlFor="stock-file"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Stock file (Excel)
              </label>
              {contact.fileUrl && !newFile && (
                <a
                  href={contact.fileUrl}
                  className="mb-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Current file: download
                </a>
              )}
              <input
                id="stock-file"
                type="file"
                accept={EXCEL_ACCEPT}
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-60"
              />
              {newFile && (
                <p className="mt-1 text-sm text-gray-600">
                  New file: <span className="font-medium">{newFile.name}</span> (uploaded on
                  save)
                </p>
              )}
              {fileError && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {fileError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              The stock file can be attached once the state is set to &quot;Received&quot;.
            </p>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              Date added <span className="font-normal text-gray-400">(cannot be changed)</span>
            </p>
            <p className="text-sm text-gray-900">
              {formatDate(contact.dateAdded, "long") || <span className="text-gray-400">—</span>}
            </p>
          </div>

          <Field
            label="Notes"
            name="notes"
            value={values.notes}
            onChange={handleChange}
            disabled={isSubmitting}
            multiline
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
