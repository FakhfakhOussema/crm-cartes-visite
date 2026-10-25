"use client";

import { useId } from "react";

export const EMPTY_CONTACT_VALUES = {
  lastName: "",
  firstName: "",
  email: "",
  phone: "",
  company: "",
  position: "",
  website: "",
  address: "",
};

// `required` lets through fields filled with spaces only: we check again on submit.
export function validateContactValues(values) {
  if (!values.lastName.trim() || !values.firstName.trim()) {
    return "Last name and first name are required.";
  }
  return null;
}

const inputClassName =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 shadow-sm sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-gray-50 disabled:text-gray-500";

export function Field({
  label,
  name,
  value,
  onChange,
  required,
  disabled,
  inputMode,
  multiline = false,
  className = "",
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={4}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={inputClassName}
        />
      ) : (
        <input
          id={id}
          name={name}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={inputClassName}
        />
      )}
    </div>
  );
}

// The eight fields of a contact, shared by manual entry and the form pre-filled after extraction.
export default function ContactFields({ values, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Company" name="company" value={values.company} onChange={onChange} disabled={disabled} className="sm:col-span-2" />
      <Field label="First name" name="firstName" value={values.firstName} onChange={onChange} required disabled={disabled} />
      <Field label="Last name" name="lastName" value={values.lastName} onChange={onChange} required disabled={disabled} />
      <Field label="Position" name="position" value={values.position} onChange={onChange} disabled={disabled} className="sm:col-span-2" />
      <Field label="Email" name="email" value={values.email} onChange={onChange} disabled={disabled} inputMode="email" />
      <Field label="Phone" name="phone" value={values.phone} onChange={onChange} disabled={disabled} inputMode="tel" />
      <Field label="Web site" name="website" value={values.website} onChange={onChange} disabled={disabled} inputMode="url" className="sm:col-span-2" />
      <Field label="Address" name="address" value={values.address} onChange={onChange} disabled={disabled} className="sm:col-span-2" />
    </div>
  );
}
