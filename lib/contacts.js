import { compactPhone } from "@/lib/extraction-shared";
import { supabase } from "@/lib/supabaseClient";
import { compactWebsite } from "@/lib/website";
import {
  CALL_STATUSES,
  currentStatusValue,
  DEFAULT_CONTACT_CHANNEL,
  DEFAULT_CONTACT_TYPE,
  DEFAULT_FILE_STATE,
  DEFAULT_STOCK,
  EMAIL_STATUSES,
} from "@/lib/statuses";

// The database keeps its original (French) table and column names; only this file knows about them.
// Grid + "Contact details" modal (address, image_url and notes are only shown in the modal).
const COLUMNS =
  "id, nom, prenom, email, telephone, societe, poste, site_web, type, canal_contact, adresse, image_url, statut_appel, statut_email, stock, etat_fichier, fichier_url, notes, date_ajout";

// Interface field -> Supabase column, for edits of a single value at a time.
const EDITABLE_COLUMNS = {
  type: "type",
  channel: "canal_contact",
  callStatus: "statut_appel",
  emailStatus: "statut_email",
  stock: "stock",
  fileState: "etat_fichier",
  fileUrl: "fichier_url",
};

// Supabase row (snake_case, columns sometimes null) -> interface contact (camelCase, never null).
function fromRow(row) {
  return {
    id: row.id,
    lastName: row.nom ?? "",
    firstName: row.prenom ?? "",
    email: row.email ?? "",
    phone: row.telephone ?? "",
    company: row.societe ?? "",
    position: row.poste ?? "",
    website: row.site_web ?? "",
    type: row.type ?? DEFAULT_CONTACT_TYPE,
    channel: row.canal_contact ?? DEFAULT_CONTACT_CHANNEL,
    address: row.adresse ?? "",
    imageUrl: row.image_url ?? "",
    notes: row.notes ?? "",
    // Status missing in the database: shown as "pending" (nothing is written back).
    callStatus: currentStatusValue(row.statut_appel ?? CALL_STATUSES[0].value),
    emailStatus: currentStatusValue(row.statut_email ?? EMAIL_STATUSES[0].value),
    stock: currentStatusValue(row.stock ?? DEFAULT_STOCK),
    fileState: currentStatusValue(row.etat_fichier ?? DEFAULT_FILE_STATE),
    fileUrl: row.fichier_url ?? "",
    dateAdded: row.date_ajout ?? "",
  };
}

export async function fetchContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select(COLUMNS)
    .order("date_ajout", { ascending: false, nullsFirst: false });

  if (error) {
    // 42703 = undefined column: the SQL script adding the stock / etat_fichier / fichier_url / canal_contact columns
    // has not been run.
    if (error.code === "42703") {
      throw new Error(
        `${error.message}. Add the stock, etat_fichier, fichier_url and canal_contact columns to the "contacts" table (SQL script in the SQL Editor).`,
      );
    }
    throw error;
  }
  return data.map(fromRow);
}

// Optional field left empty -> NULL in the database rather than an empty string.
const emptyToNull = (value) => value.trim() || null;

// Inserts a contact and returns the created row (id and date_ajout are provided by the database).
// `imageUrl`: public URL of the business card, for contacts created by importing an image.
export async function insertContact(
  { lastName, firstName, email, phone, company, position, website, address },
  imageUrl = null,
) {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      nom: lastName.trim(),
      prenom: firstName.trim(),
      email: emptyToNull(email),
      telephone: emptyToNull(compactPhone(phone)),
      societe: emptyToNull(company),
      poste: emptyToNull(position),
      site_web: emptyToNull(compactWebsite(website)),
      adresse: emptyToNull(address),
      type: DEFAULT_CONTACT_TYPE, // "B"
      canal_contact: DEFAULT_CONTACT_CHANNEL, // "None"
      ...(imageUrl && { image_url: imageUrl }),
      statut_appel: CALL_STATUSES[0].value, // "to call"
      statut_email: EMAIL_STATUSES[0].value, // "to send"
      stock: DEFAULT_STOCK, // "Not specified"
      etat_fichier: DEFAULT_FILE_STATE, // "Pending"
    })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return fromRow(data);
}

// Updates all the editable fields of a contact and returns the row as saved.
// `fileUrl`: new URL of the stock file; `undefined` = file unchanged.
// (date_ajout and image_url are never modified here.)
export async function updateContact(
  id,
  {
    lastName,
    firstName,
    email,
    phone,
    company,
    position,
    website,
    address,
    notes,
    type,
    channel,
    callStatus,
    emailStatus,
    stock,
    fileState,
    fileUrl,
  },
) {
  const { data, error } = await supabase
    .from("contacts")
    .update({
      nom: lastName.trim(),
      prenom: firstName.trim(),
      email: emptyToNull(email),
      telephone: emptyToNull(compactPhone(phone)),
      societe: emptyToNull(company),
      poste: emptyToNull(position),
      site_web: emptyToNull(compactWebsite(website)),
      adresse: emptyToNull(address),
      notes: emptyToNull(notes),
      type,
      canal_contact: channel,
      statut_appel: callStatus,
      statut_email: emailStatus,
      stock,
      etat_fichier: fileState,
      ...(fileUrl !== undefined && { fichier_url: fileUrl }),
    })
    .eq("id", id)
    .select(COLUMNS);

  if (error) throw error;
  // With RLS, a refused UPDATE does not return an error: it simply touches 0 rows.
  if (data.length === 0) {
    throw new Error("no row updated (contact not found or update refused by the RLS policies)");
  }
  return fromRow(data[0]);
}

// A single public bucket: business cards at the root, stock files under "stock/".
// (The bucket keeps its original name: renaming it would break the URLs already stored.)
const STORAGE_BUCKET = "cartes-visite";
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// Uploads the original image to the Storage bucket and returns its public URL.
// The name is generated (timestamp + random suffix): the original name, with its accents and spaces,
// is rejected by Storage and could overwrite an existing file.
export async function uploadCardImage(file) {
  const extension =
    IMAGE_EXTENSIONS[file.type] ??
    (file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "img");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

const EXCEL_TYPES = {
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
};
export const EXCEL_ACCEPT = ".xls,.xlsx,.xlsm";

const extensionOf = (file) => file.name.split(".").pop().toLowerCase();

// Browsers sometimes return an empty MIME type for .xls: the extension is what we rely on.
export function isExcelFile(file) {
  return Object.hasOwn(EXCEL_TYPES, extensionOf(file));
}

// Uploads an Excel stock file (under "stock/") and returns its public URL.
// The link forces the download under the file's original name rather than the generated one.
export async function uploadStockFile(file) {
  const extension = extensionOf(file);
  const path = `stock/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: EXCEL_TYPES[extension], upsert: false });
  if (error) throw error;

  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path, { download: file.name }).data
    .publicUrl;
}

// Permanently deletes a contact. The files it references (card, stock file) stay in Storage.
export async function deleteContact(id) {
  const { data, error } = await supabase.from("contacts").delete().eq("id", id).select("id");

  if (error) throw error;
  // With RLS, a refused DELETE does not return an error: it simply deletes 0 rows.
  if (data.length === 0) {
    throw new Error("no row deleted (contact not found or deletion refused by the RLS policies)");
  }
}

// Updates a single value of a contact (grid dropdown, attached stock file…).
export async function updateContactField(id, field, value) {
  const { data, error } = await supabase
    .from("contacts")
    .update({ [EDITABLE_COLUMNS[field]]: value })
    .eq("id", id)
    .select("id");

  if (error) throw error;
  // With RLS, a refused UPDATE does not return an error: it simply touches 0 rows.
  if (data.length === 0) {
    throw new Error("no row updated (contact not found or update refused by the RLS policies)");
  }
}
