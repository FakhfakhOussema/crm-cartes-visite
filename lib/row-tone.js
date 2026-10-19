import { FILE_RECEIVED, STOCK_AVAILABLE, STOCK_UNAVAILABLE } from "@/lib/statuses";

// Colour of a grid row, based on the stock and the file state:
//  - green : stock available AND file received;
//  - orange: stock available but file not received yet;
//  - red   : stock unavailable (whatever the file state);
//  - none  : stock "Not specified" (case not covered by the rule: neutral row).
export function rowTone(contact) {
  if (contact.stock === STOCK_AVAILABLE) {
    return contact.fileState === FILE_RECEIVED ? "green" : "orange";
  }
  if (contact.stock === STOCK_UNAVAILABLE) return "red";
  return "none";
}

// Display order: green, then orange, then neutral rows ("not processed"), then red.
const TONE_ORDER = { green: 0, orange: 1, none: 2, red: 3 };

// Keeps the contacts whose colour is in `tones`; an empty list means no filter, everything is kept.
export function filterByTones(contacts, tones) {
  if (tones.length === 0) return contacts;
  return contacts.filter((contact) => tones.includes(rowTone(contact)));
}

// Number of contacts per colour: { green, orange, red, none }.
export function countByTone(contacts) {
  const counts = { green: 0, orange: 0, red: 0, none: 0 };
  for (const contact of contacts) counts[rowTone(contact)] += 1;
  return counts;
}

// Sorts by colour; for the same colour the original order (date added, newest first) is kept
// (Array.prototype.sort is stable).
export function sortByTone(contacts) {
  return [...contacts].sort((a, b) => TONE_ORDER[rowTone(a)] - TONE_ORDER[rowTone(b)]);
}
