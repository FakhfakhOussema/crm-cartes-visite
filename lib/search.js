import { formatDate } from "@/lib/format-date";

// Lowercase + accents removed: "Lefèvre" matches "lefevre", "LEFEVRE", "lefèvre"…
// The typographic apostrophe (’) is turned into ' so that "doesn't" typed on a mobile keyboard still matches.
export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/’/g, "'")
    .toLowerCase();
}

// One searchable value per table column (plus a few typing variants).
function searchableValues(contact) {
  const shortDate = formatDate(contact.dateAdded); // "12 Oct 2026", as displayed

  return [
    contact.lastName,
    contact.firstName,
    `${contact.firstName} ${contact.lastName}`,
    `${contact.lastName} ${contact.firstName}`,
    contact.email,
    contact.phone,
    contact.phone.replace(/\s/g, ""), // "0612345678" finds "06 12 34 56 78"
    contact.company,
    contact.position,
    contact.website,
    contact.address,
    contact.callStatus,
    contact.emailStatus,
    contact.channel,
    contact.stock,
    contact.fileState,
    shortDate,
    formatDate(contact.dateAdded, "long"), // "12 October 2026"
    formatDate(contact.dateAdded, "numeric"), // "12/10/2026"
    contact.dateAdded, // "2026-10-12"
  ].map(normalize);
}

// A contact matches if the whole query is found in at least one of its columns.
// (Searching word by word across all columns would give false positives:
// "not sent" would find a contact with "no answer" / "sent".)
export function filterContacts(contacts, query) {
  const needle = normalize(query).trim().replace(/\s+/g, " ");
  if (!needle) return contacts;

  return contacts.filter((contact) =>
    searchableValues(contact).some((value) => value.includes(needle)),
  );
}
