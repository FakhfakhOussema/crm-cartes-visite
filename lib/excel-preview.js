import {
  createImageUrls,
  EMU_PER_PIXEL,
  readSheetDefaults,
  readSheetImages,
  readSheetPaths,
} from "@/lib/excel-images";

// Measured with real .xlsx workbooks: ~100 MB are read in ~3 s for ~600 MB of memory.
// Reading happens on the main thread: above LARGE_FILE_BYTES the tab freezes for a few seconds.
const MAX_BYTES = 100 * 1024 * 1024;
const LARGE_FILE_BYTES = 10 * 1024 * 1024;
export const PREVIEW_MAX_ROWS = 500;
export const PREVIEW_MAX_COLUMNS = 50;

// Excel's default dimensions (Calibri 11 font, 100%) when the file does not specify any.
const DEFAULT_COLUMN_PX = 64;
const DEFAULT_ROW_PX = 20;
const DEFAULT_MAX_DIGIT_WIDTH = 7;

const TOO_LARGE = `File too large to preview (${MAX_BYTES / 1024 / 1024} MB maximum). Download it to open it in Excel.`;

// .xlsx / .xlsm are ZIP archives ("PK\x03\x04"), .xls an OLE2 container (D0 CF 11 E0).
// The signature is checked before reading: SheetJS would otherwise accept any text as CSV.
function looksLikeExcel(bytes) {
  const startsWith = (signature) => signature.every((byte, i) => bytes[i] === byte);
  return startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0xd0, 0xcf, 0x11, 0xe0]);
}

// Axis of a sheet (columns or rows): size in pixels of each cell, the file's value if there is one,
// otherwise the default value. `start(i)` (x/y of the edge of cell i) is computed in O(1).
function makeAxis(explicit, defaultSize) {
  const prefix = [0];
  for (let i = 0; i < explicit.length; i++) prefix.push(prefix[i] + (explicit[i] ?? defaultSize));
  const size = (i) => explicit[i] ?? defaultSize;
  const start = (i) =>
    i <= explicit.length ? prefix[i] : prefix[explicit.length] + (i - explicit.length) * defaultSize;
  // Index of the cell containing position `px`.
  const indexAt = (px) => {
    if (px >= prefix[explicit.length]) {
      return explicit.length + Math.floor((px - prefix[explicit.length]) / defaultSize);
    }
    let low = 0;
    let high = explicit.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (prefix[middle] <= px) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  return { size, start, indexAt };
}

// Column widths and row heights of a sheet, in pixels, as Excel displays them.
function readSheetAxes(sheet, defaults) {
  const columns = sheet["!cols"] ?? [];
  // "Width of the widest digit" of the default font: SheetJS derives it from the workbook.
  const digitWidth = columns.find((column) => column?.MDW)?.MDW ?? DEFAULT_MAX_DIGIT_WIDTH;
  const defaultColumnPx = defaults.defaultColWidth
    ? Math.round(defaults.defaultColWidth * digitWidth)
    : DEFAULT_COLUMN_PX;
  const defaultRowPx = defaults.defaultRowHeight
    ? (defaults.defaultRowHeight * 96) / 72
    : DEFAULT_ROW_PX;

  return {
    columns: makeAxis(
      columns.map((column) => (column?.hidden ? 0 : column?.wpx)),
      defaultColumnPx,
    ),
    // hpt = height in points (1 pt = 96/72 px). SheetJS's `hpx` is not converted: we do not use it.
    rows: makeAxis(
      (sheet["!rows"] ?? []).map((row) => (row?.hidden ? 0 : row?.hpt != null ? (row.hpt * 96) / 72 : undefined)),
      defaultRowPx,
    ),
  };
}

// Position and size of each image in the sheet, in pixels from its top-left corner (A1).
// Images whose start cell is outside the preview area, or without usable dimensions, are discarded.
function placeImages(anchors, axes) {
  const placed = [];
  let skipped = 0;

  for (const anchor of anchors) {
    let left;
    let top;
    if (anchor.from) {
      if (anchor.from.col >= PREVIEW_MAX_COLUMNS || anchor.from.row >= PREVIEW_MAX_ROWS) {
        skipped += 1;
        continue;
      }
      left = axes.columns.start(anchor.from.col) + anchor.from.colOff / EMU_PER_PIXEL;
      top = axes.rows.start(anchor.from.row) + anchor.from.rowOff / EMU_PER_PIXEL;
    } else if (anchor.pos) {
      left = anchor.pos.x / EMU_PER_PIXEL;
      top = anchor.pos.y / EMU_PER_PIXEL;
      if (
        axes.columns.indexAt(left) >= PREVIEW_MAX_COLUMNS ||
        axes.rows.indexAt(top) >= PREVIEW_MAX_ROWS
      ) {
        skipped += 1;
        continue;
      }
    } else {
      skipped += 1;
      continue;
    }

    let width;
    let height;
    if (anchor.size) {
      width = anchor.size.cx / EMU_PER_PIXEL;
      height = anchor.size.cy / EMU_PER_PIXEL;
    } else if (anchor.from && anchor.to) {
      // No explicit size: the image fills the space between its two anchor cells.
      width = axes.columns.start(anchor.to.col) + anchor.to.colOff / EMU_PER_PIXEL - left;
      height = axes.rows.start(anchor.to.row) + anchor.to.rowOff / EMU_PER_PIXEL - top;
    }
    if (!(width > 0 && height > 0)) {
      skipped += 1;
      continue;
    }

    placed.push({
      mediaPath: anchor.mediaPath,
      mime: anchor.mime,
      alt: anchor.name,
      left,
      top,
      width,
      height,
      // Last column and last row touched by the image (the exact edge belongs to the next cell).
      lastColumn: axes.columns.indexAt(left + width - 0.01),
      lastRow: axes.rows.indexAt(top + height - 0.01),
    });
  }
  return { placed, skipped };
}

// Images of a sheet, ready to display. Unimportant for the text: an error here must not prevent
// the cells from being previewed, it is simply reported.
const NO_IMAGES = { images: [], skippedImages: 0, imageProblem: false, imageColumns: 0, imageRows: 0 };

function loadSheetImages(files, sheetPath, axes) {
  try {
    const { anchors, unsupported } = readSheetImages(files, sheetPath);
    if (anchors.length === 0) return { ...NO_IMAGES, skippedImages: unsupported };

    const { placed, skipped } = placeImages(anchors, axes);
    const urls = createImageUrls(files, placed);
    return {
      images: placed.map(({ mediaPath, ...image }) => ({ ...image, url: urls.get(mediaPath) })),
      skippedImages: unsupported + skipped,
      imageProblem: false,
      imageColumns: Math.max(0, ...placed.map((image) => image.lastColumn + 1)),
      imageRows: Math.max(0, ...placed.map((image) => image.lastRow + 1)),
    };
  } catch {
    return { ...NO_IMAGES, imageProblem: true };
  }
}

// Downloads the Excel file and returns its sheets, ready to display:
// [{ name, rows, columnWidths, rowHeights, images, skippedImages, imageProblem, truncatedRows, truncatedColumns }]
// (rows: lines of text; sizes in pixels; images: { url, alt, left, top, width, height } in pixels).
// Reading happens in the browser. Call releasePreviewImages(sheets) when the preview is closed.
// Throws an Error with a readable message; rethrows the AbortError as is if `signal` is aborted.
// `onLargeFile` is called as soon as the headers arrive if the file is large, before downloading and reading.
export async function loadExcelPreview(url, signal, { onLargeFile } = {}) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Unable to fetch the file. Check your connection.");
  }
  if (!response.ok) {
    throw new Error(`The file was not found or is inaccessible (error ${response.status}).`);
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_BYTES) throw new Error(TOO_LARGE);
  if (declaredSize > LARGE_FILE_BYTES) onLargeFile?.();

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error(TOO_LARGE);
  if (!looksLikeExcel(new Uint8Array(buffer))) {
    throw new Error("This is not a valid Excel file.");
  }

  // Loaded on demand: the (heavy) library does not weigh down the rest of the application.
  const XLSX = await import("xlsx");

  let workbook;
  try {
    // sheetRows: we only read one row more than the limit, just to know whether there are more.
    // bookFiles: keeps the archive's content (drawings, images); cellStyles: widths and heights.
    workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      cellStyles: true,
      bookFiles: true,
      sheetRows: PREVIEW_MAX_ROWS + 1,
    });
  } catch (error) {
    // RangeError: a sheet decompresses into more text than the browser can hold
    // ("Invalid string length", out of memory) — the file is not necessarily corrupted.
    if (error instanceof RangeError) {
      throw new Error(
        "This workbook is too large to be displayed in the browser. Download it to open it in Excel.",
      );
    }
    throw new Error(
      "This file could not be read: it may be corrupted or password-protected.",
    );
  }

  // Archive content (.xlsx / .xlsm): gives the default cell size and the images of each sheet.
  // Absent for .xls (images not handled) or without DOMParser: Excel's default sizes, no images.
  const files = typeof DOMParser === "undefined" ? undefined : workbook.files;
  const sheetPaths = files ? readSheetPaths(files) : new Map();

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const sheetPath = sheetPaths.get(name);
    let rows = [];

    if (sheet["!ref"]) {
      // Anchors the sheet at A1 so that the displayed row numbers / column letters
      // match Excel's, even if the data starts further away (e.g. in B3).
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      range.s.r = 0;
      range.s.c = 0;
      sheet["!ref"] = XLSX.utils.encode_range(range);
      // raw: false -> text as Excel displays it (dates, percentages, separators…).
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: true });
    }

    const truncatedRows = rows.length > PREVIEW_MAX_ROWS;
    const truncatedColumns = rows.some((row) => row.length > PREVIEW_MAX_COLUMNS);
    rows = rows.slice(0, PREVIEW_MAX_ROWS).map((row) => row.slice(0, PREVIEW_MAX_COLUMNS).map(String));

    const axes = readSheetAxes(sheet, sheetPath ? readSheetDefaults(files, sheetPath) : {});
    const { images, skippedImages, imageProblem, imageColumns, imageRows } = sheetPath
      ? loadSheetImages(files, sheetPath, axes)
      : NO_IMAGES;

    // The table must cover the whole surface of every image, even beyond the data (e.g. a column
    // of photos on the right): it is extended, within the limit of the preview area.
    const columnCount = Math.min(
      PREVIEW_MAX_COLUMNS,
      Math.max(imageColumns, ...rows.map((row) => row.length)),
    );
    const rowCount = Math.min(PREVIEW_MAX_ROWS, Math.max(imageRows, rows.length));
    while (rows.length < rowCount) rows.push([]);

    return {
      name,
      rows,
      columnWidths: Array.from({ length: columnCount }, (_, index) => axes.columns.size(index)),
      rowHeights: Array.from({ length: rowCount }, (_, index) => axes.rows.size(index)),
      images,
      skippedImages,
      imageProblem,
      truncatedRows,
      truncatedColumns,
    };
  });
}

// Releases the local URLs (blob:) created for the preview images.
export function releasePreviewImages(sheets) {
  for (const sheet of sheets) {
    for (const image of sheet.images) URL.revokeObjectURL(image.url);
  }
}

// "stock october.xlsx": original name, kept in the ?download= parameter of the URL (see uploadStockFile).
export function fileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("download") || decodeURIComponent(parsed.pathname.split("/").pop());
  } catch {
    return "Stock file";
  }
}

// 0 -> A, 25 -> Z, 26 -> AA…
export function columnLabel(index) {
  let label = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    label = String.fromCharCode(65 + (n % 26)) + label;
  }
  return label;
}
