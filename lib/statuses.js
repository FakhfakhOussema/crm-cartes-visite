// Options of the status dropdowns.
// `tone` drives the colour of the indicator: "orange" (pending), "green" (ok), "red" (failed), "gray" (unset).
// These values are what gets stored in the database.

export const CALL_STATUSES = [
  { value: "to call", tone: "orange" },
  { value: "answered", tone: "green" },
  { value: "no answer", tone: "red" },
  { value: "unreachable", tone: "red" },
];

export const EMAIL_STATUSES = [
  { value: "to send", tone: "orange" },
  { value: "sent", tone: "green" },
  { value: "not sent", tone: "red" },
];

export const STOCK_STATUSES = [
  { value: "Not specified", tone: "gray" },
  { value: "Available", tone: "green" },
  { value: "Unavailable", tone: "red" },
];

export const FILE_STATES = [
  { value: "Pending", tone: "orange" },
  { value: "Received", tone: "green" },
];

// Type of a contact: A or B. The tone only gives each letter its own colour (no meaning).
export const CONTACT_TYPES = [
  { value: "A", tone: "blue" },
  { value: "B", tone: "gray" },
];

export const STOCK_AVAILABLE = "Available";
export const STOCK_UNAVAILABLE = "Unavailable";

// The (Excel) stock file is only attached to a contact when its state is "Received".
export const FILE_RECEIVED = "Received";

// Values of a new contact.
export const DEFAULT_STOCK = "Not specified";
export const DEFAULT_FILE_STATE = "Pending";
export const DEFAULT_CONTACT_TYPE = "B";

// Rows saved before the interface was translated still hold the French values. They are mapped to the current
// ones when read, so they keep their colour and show up in the dropdowns. Can be removed once the rows have been
// updated in the database (see the UPDATE statements handed over with the translation).
const LEGACY_VALUES = {
  "à appeler": "to call",
  "a répondu": "answered",
  "n'a pas répondu": "no answer",
  "non joignable": "unreachable",
  "à envoyer": "to send",
  envoyé: "sent",
  "pas envoyé": "not sent",
  "Non précisé": "Not specified",
  Disponible: "Available",
  "Non disponible": "Unavailable",
  "En attente": "Pending",
  Reçu: "Received",
};

export const currentStatusValue = (value) => LEGACY_VALUES[value] ?? value;
