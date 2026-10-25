import { normalize } from "@/lib/search";

// Two contacts are duplicates when they have the same company name (case, accents and extra spaces ignored).
// A contact without a company is never a duplicate.
export const DUPLICATE_REASON = "Same company";

// Works on a contact as well as on the values of the "Add" forms (same field name).
const companyKey = (contact) => normalize(contact.company).replace(/\s+/g, " ").trim();

// Contacts already in the list that have the same company as the one about to be added:
// [{ contact, reasons }] (empty if it is new).
export function findDuplicates(contacts, values) {
  const key = companyKey(values);
  if (!key) return [];
  return contacts
    .filter((contact) => companyKey(contact) === key)
    .map((contact) => ({ contact, reasons: [DUPLICATE_REASON] }));
}

// Oldest first. `dateAdded` can be a plain date, so the id breaks the ties to keep the order stable between loads.
function byAge(a, b) {
  const byDate = (Date.parse(a.dateAdded) || 0) - (Date.parse(b.dateAdded) || 0);
  return byDate || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

// The oldest contact of a company is the original, the following ones are the duplicates.
// -> Map: id of a duplicate -> { original, reasons }. Computed from the list itself (nothing stored in the
// database), so the mark disappears by itself if the original is deleted or the company is corrected.
export function markDuplicates(contacts) {
  const originals = new Map();
  const duplicates = new Map();

  for (const contact of [...contacts].sort(byAge)) {
    const key = companyKey(contact);
    if (!key) continue;
    const original = originals.get(key);
    if (original) duplicates.set(contact.id, { original, reasons: [DUPLICATE_REASON] });
    else originals.set(key, contact);
  }
  return duplicates;
}
