// Reads the images of an .xlsx / .xlsm workbook (SheetJS, in its free version, only reads the cells).
// An .xlsx is a ZIP archive: each sheet can point to a "drawing" (xl/drawings/drawingN.xml) that
// lists anchors (start cell, offset, size) and, for each one, an image stored in xl/media/.
// Works on `workbook.files`, obtained with XLSX.read(..., { bookFiles: true }).

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";

export const EMU_PER_PIXEL = 9525; // 914400 EMU per inch / 96 px per inch

// Formats the browser can display in an <img> tag. EMF, WMF, TIFF… cannot be.
const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const decoder = new TextDecoder();
const entryText = (entry) =>
  typeof entry.content === "string" ? entry.content : decoder.decode(entry.content);

function parseXml(entry) {
  if (!entry) return null;
  try {
    const doc = new DOMParser().parseFromString(entryText(entry), "application/xml");
    return doc.getElementsByTagName("parsererror").length ? null : doc;
  } catch {
    return null;
  }
}

// Path of a relationship target, which can be absolute ("/xl/media/a.png") or relative ("../media/a.png").
function resolvePath(baseDir, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = [];
  for (const part of (baseDir + target).split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

const dirOf = (path) => path.slice(0, path.lastIndexOf("/") + 1);

// Relationship id -> { type, path } for a .rels file.
function readRelationships(files, relsPath, baseDir) {
  const relationships = new Map();
  const doc = parseXml(files[relsPath]);
  if (!doc) return relationships;
  for (const rel of doc.getElementsByTagNameNS(NS_REL, "Relationship")) {
    if (rel.getAttribute("TargetMode") === "External") continue;
    relationships.set(rel.getAttribute("Id"), {
      type: rel.getAttribute("Type"),
      path: resolvePath(baseDir, rel.getAttribute("Target")),
    });
  }
  return relationships;
}

// Sheet name -> path of its XML (xl/worksheets/sheet1.xml…), via workbook.xml and its relationships.
export function readSheetPaths(files) {
  const paths = new Map();
  const doc = parseXml(files["xl/workbook.xml"]);
  if (!doc) return paths;
  const relationships = readRelationships(files, "xl/_rels/workbook.xml.rels", "xl/");
  for (const sheet of doc.getElementsByTagNameNS(NS_MAIN, "sheet")) {
    const rel = relationships.get(sheet.getAttributeNS(NS_R, "id"));
    if (rel) paths.set(sheet.getAttribute("name"), rel.path);
  }
  return paths;
}

const number = (element, ns, name) =>
  Number(element?.getElementsByTagNameNS(ns, name)[0]?.textContent ?? 0) || 0;

function childOf(element, ns, name) {
  for (const child of element?.children ?? []) {
    if (child.namespaceURI === ns && child.localName === name) return child;
  }
  return null;
}

const readMarker = (element) =>
  element && {
    col: number(element, NS_XDR, "col"),
    colOff: number(element, NS_XDR, "colOff"),
    row: number(element, NS_XDR, "row"),
    rowOff: number(element, NS_XDR, "rowOff"),
  };

// Image anchors of a sheet: [{ from, to, pos, size, mediaPath, name }] (positions in EMU), and the number
// of images that cannot be displayed (unsupported format, grouped or linked image).
// `from` / `to`: cell + offset; `pos`: absolute position; `size`: wanted size { cx, cy }.
export function readSheetImages(files, sheetPath) {
  const result = { anchors: [], unsupported: 0 };

  const sheetRels = readRelationships(
    files,
    `${dirOf(sheetPath)}_rels/${sheetPath.slice(sheetPath.lastIndexOf("/") + 1)}.rels`,
    dirOf(sheetPath),
  );
  const drawingRel = [...sheetRels.values()].find((rel) => rel.type.endsWith("/drawing"));
  if (!drawingRel) return result;

  const drawing = parseXml(files[drawingRel.path]);
  if (!drawing) return result;
  const drawingDir = dirOf(drawingRel.path);
  const drawingRels = readRelationships(
    files,
    `${drawingDir}_rels/${drawingRel.path.slice(drawingRel.path.lastIndexOf("/") + 1)}.rels`,
    drawingDir,
  );

  for (const anchor of drawing.documentElement.children) {
    if (!/Anchor$/.test(anchor.localName)) continue;

    // Images grouped with other shapes: their coordinates are relative to the group, not handled.
    if (anchor.getElementsByTagNameNS(NS_XDR, "grpSp").length) {
      result.unsupported += 1;
      continue;
    }
    const pic = anchor.getElementsByTagNameNS(NS_XDR, "pic")[0];
    if (!pic) continue; // chart, shape, text box… : not an image

    const blip = pic.getElementsByTagNameNS(NS_A, "blip")[0];
    const media = drawingRels.get(blip?.getAttributeNS(NS_R, "embed"));
    const extension = media?.path.split(".").pop().toLowerCase();
    if (!media || !files[media.path] || !(extension in IMAGE_TYPES)) {
      result.unsupported += 1;
      continue;
    }

    // Wanted size: the image's own (xfrm/ext), or the one carried by the anchor itself.
    const xfrmExt = childOf(childOf(childOf(pic, NS_XDR, "spPr"), NS_A, "xfrm"), NS_A, "ext");
    const anchorExt = childOf(anchor, NS_XDR, "ext");
    const sizeElement = xfrmExt ?? anchorExt;
    const size = sizeElement
      ? { cx: Number(sizeElement.getAttribute("cx")), cy: Number(sizeElement.getAttribute("cy")) }
      : null;
    const position = childOf(anchor, NS_XDR, "pos");

    result.anchors.push({
      from: readMarker(childOf(anchor, NS_XDR, "from")),
      to: readMarker(childOf(anchor, NS_XDR, "to")),
      pos: position && { x: Number(position.getAttribute("x")), y: Number(position.getAttribute("y")) },
      size: size && size.cx > 0 && size.cy > 0 ? size : null,
      mediaPath: media.path,
      mime: IMAGE_TYPES[extension],
      name: pic.getElementsByTagNameNS(NS_XDR, "cNvPr")[0]?.getAttribute("descr") || "",
    });
  }
  return result;
}

// Reads sheetFormatPr (default width / height of columns and rows) from the start of a sheet's XML,
// without decoding the whole sheet (which can weigh hundreds of MB): this element always precedes <sheetData>.
export function readSheetDefaults(files, sheetPath) {
  const entry = files[sheetPath];
  if (!entry) return {};
  const head =
    typeof entry.content === "string"
      ? entry.content.slice(0, 65536)
      : decoder.decode(entry.content.subarray(0, 65536));
  const tag = head.match(/<sheetFormatPr\b[^>]*>/)?.[0] ?? "";
  const attribute = (name) => {
    const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    return value === undefined ? undefined : Number(value);
  };
  return {
    defaultColWidth: attribute("defaultColWidth"),
    defaultRowHeight: attribute("defaultRowHeight"),
  };
}

// Creates one local URL (blob:) per distinct image; the same image used 10 times is only created once.
export function createImageUrls(files, anchors) {
  const urls = new Map();
  for (const { mediaPath, mime } of anchors) {
    if (!urls.has(mediaPath)) {
      urls.set(mediaPath, URL.createObjectURL(new Blob([files[mediaPath].content], { type: mime })));
    }
  }
  return urls;
}
