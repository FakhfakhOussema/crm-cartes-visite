import { supabase } from "@/lib/supabaseClient";

// One email (subject + body) per contact type, stored in the "email_templates" table (one row per type).
// The text can contain these placeholders, replaced by the contact's values when the email is prepared.
export const TEMPLATE_PLACEHOLDERS = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "position", label: "Position" },
];

// -> { A: { subject, body }, B: { subject, body } } (a type without a row is simply missing).
export async function fetchEmailTemplates() {
  const { data, error } = await supabase.from("email_templates").select("type, subject, body");
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [row.type, { subject: row.subject ?? "", body: row.body ?? "" }]),
  );
}

// Creates or replaces the template of a type.
export async function saveEmailTemplate(type, { subject, body }) {
  const { error } = await supabase
    .from("email_templates")
    .upsert({ type, subject, body }, { onConflict: "type" });
  if (error) throw error;
}

// "Dear {{firstName}}," -> "Dear Li,". An unknown placeholder is left as it is.
export function fillTemplate(text, contact) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    TEMPLATE_PLACEHOLDERS.some((placeholder) => placeholder.key === key)
      ? (contact[key] ?? "")
      : match,
  );
}

// mailto: link opening the user's mail program with the recipient, the subject and the body filled in,
// ready to be sent. Without a template for the contact's type, only the recipient is filled in.
export function buildMailtoHref(contact, templates) {
  const to = contact.email.trim();
  const template = templates[contact.type];
  if (!template) return `mailto:${to}`;

  const subject = fillTemplate(template.subject, contact);
  // Line breaks of a mailto body must be CRLF.
  const body = fillTemplate(template.body, contact).replace(/\r?\n/g, "\r\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
