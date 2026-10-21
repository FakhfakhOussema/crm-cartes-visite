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

// Outlook on the web, "new message" page. outlook.office.com works for work / school (Microsoft 365) accounts
// and redirects personal accounts (outlook.com, hotmail…) to their own inbox. To go straight to a personal
// inbox, use "https://outlook.live.com/mail/0/deeplink/compose" instead.
const OUTLOOK_COMPOSE_URL = "https://outlook.office.com/mail/deeplink/compose";

// Link opening Outlook in the browser on a new message with the recipient, the subject and the body filled in,
// ready to be sent. Without a template for the contact's type, only the recipient is filled in.
export function buildOutlookComposeHref(contact, templates) {
  const params = new URLSearchParams({ to: contact.email.trim() });
  const template = templates[contact.type];
  if (template) {
    params.set("subject", fillTemplate(template.subject, contact));
    params.set("body", fillTemplate(template.body, contact));
  }
  // URLSearchParams writes spaces as "+", which Outlook would show as is: we want %20.
  return `${OUTLOOK_COMPOSE_URL}?${params.toString().replace(/\+/g, "%20")}`;
}
