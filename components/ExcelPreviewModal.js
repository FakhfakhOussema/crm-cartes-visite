"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import {
  columnLabel,
  fileNameFromUrl,
  loadExcelPreview,
  PREVIEW_MAX_COLUMNS,
  PREVIEW_MAX_ROWS,
  releasePreviewImages,
} from "@/lib/excel-preview";

const downloadLinkClassName =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

// Column headers (A, B, C…) and row headers (1, 2, 3…), as in Excel.
const ROW_HEADER_WIDTH = 48;
const COLUMN_HEADER_HEIGHT = 24;

const sum = (values) => values.reduce((total, value) => total + value, 0);

// The table reproduces the file's column widths and row heights, in pixels, with fixed-size
// cells: that is what lets each image be placed exactly where it belongs (computed from the same
// sizes). Images float above the cells, under the headers, which stay visible when scrolling.
function SheetTable({ sheet }) {
  const { rows, columnWidths, rowHeights, images } = sheet;

  if (rows.length === 0 && images.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-gray-500">This sheet is empty.</p>;
  }

  const headCell =
    "sticky top-0 z-10 border-b border-r border-gray-200 bg-gray-100 p-0 text-center text-xs font-semibold text-gray-500";

  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-200">
      <div className="relative">
        <table
          className="border-separate border-spacing-0 text-sm"
          style={{ tableLayout: "fixed", width: ROW_HEADER_WIDTH + sum(columnWidths) }}
        >
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH }} />
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: COLUMN_HEADER_HEIGHT }}>
              <th
                scope="col"
                className={`${headCell} left-0 z-20`}
                style={{ height: COLUMN_HEADER_HEIGHT }}
              >
                <span className="sr-only">Row</span>
              </th>
              {columnWidths.map((width, index) => (
                <th
                  key={index}
                  scope="col"
                  className={headCell}
                  style={{ height: COLUMN_HEADER_HEIGHT, ...(width === 0 && { borderWidth: 0 }) }}
                >
                  {width > 0 && columnLabel(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowHeights.map((height, rowIndex) => {
              const row = rows[rowIndex] ?? [];
              // A cell with zero width or height (hidden column / row) has neither border nor content.
              const lineHeight = `${height - 1}px`;
              return (
                <tr key={rowIndex} style={{ height }}>
                  <th
                    scope="row"
                    className="sticky left-0 z-[2] border-b border-r border-gray-200 bg-gray-100 p-0 text-center text-xs font-semibold text-gray-500"
                    style={{ height, ...(height === 0 && { borderWidth: 0 }) }}
                  >
                    {height > 0 && (
                      <div className="overflow-hidden" style={{ height: height - 1, lineHeight }}>
                        {rowIndex + 1}
                      </div>
                    )}
                  </th>
                  {columnWidths.map((width, colIndex) => {
                    const text = row[colIndex] ?? "";
                    const hidden = width === 0 || height === 0;
                    return (
                      <td
                        key={colIndex}
                        className="border-b border-r border-gray-200 p-0 text-gray-800"
                        style={{ height, ...(hidden && { borderWidth: 0 }) }}
                      >
                        {!hidden && (
                          <div
                            title={text || undefined}
                            className="overflow-hidden text-ellipsis whitespace-nowrap px-2"
                            style={{ height: height - 1, lineHeight }}
                          >
                            {text}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {images.map((image, index) => (
          // Local URL (blob:) created from the file: next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={image.url}
            alt={image.alt || `Image ${index + 1}`}
            title={image.alt || undefined}
            draggable={false}
            decoding="async"
            className="pointer-events-none absolute z-[1] select-none"
            style={{
              left: ROW_HEADER_WIDTH + image.left,
              top: COLUMN_HEADER_HEIGHT + image.top,
              width: image.width,
              height: image.height,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Read-only preview of an Excel file (all the sheets, with their images), read in the browser.
export default function ExcelPreviewModal({ url, onClose }) {
  const fileName = fileNameFromUrl(url);
  const [state, setState] = useState({ status: "loading", sheets: [], error: null });
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const sheetsRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    loadExcelPreview(url, controller.signal, { onLargeFile: () => setIsLargeFile(true) })
      .then((sheets) => {
        if (controller.signal.aborted) {
          releasePreviewImages(sheets);
          return;
        }
        sheetsRef.current = sheets;
        setState({ status: "ready", sheets, error: null });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ status: "error", sheets: [], error: error.message });
      });

    return () => {
      controller.abort();
      // Releases the images created for the preview (local URLs).
      if (sheetsRef.current) releasePreviewImages(sheetsRef.current);
      sheetsRef.current = null;
    };
  }, [url]);

  const sheet = state.sheets[activeSheet];

  return (
    <Modal onClose={onClose} labelledBy="excel-preview-title" sizeClassName="max-w-5xl">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
        <div className="min-w-0">
          <h2 id="excel-preview-title" className="text-lg font-semibold">
            File preview
          </h2>
          <p className="truncate text-sm text-gray-500">{fileName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the preview"
          className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-5">
        {state.status === "loading" && (
          <div role="status" className="px-4 py-12 text-center text-sm text-gray-500">
            <p>Loading the file...</p>
            {isLargeFile && (
              <p className="mt-2 text-gray-400">
                Large file: loading may take a while, and the page may freeze for a few seconds
                when it opens.
              </p>
            )}
          </div>
        )}

        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700"
          >
            <p className="font-medium">This file cannot be displayed.</p>
            <p className="mt-1 text-red-600">{state.error}</p>
          </div>
        )}

        {state.status === "ready" && sheet && (
          <div className="space-y-3">
            {state.sheets.length > 1 && (
              <div role="tablist" aria-label="Workbook sheets" className="flex flex-wrap gap-2">
                {state.sheets.map((s, index) => (
                  <button
                    key={s.name}
                    type="button"
                    role="tab"
                    aria-selected={index === activeSheet}
                    onClick={() => setActiveSheet(index)}
                    className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      index === activeSheet
                        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                        : "bg-white text-gray-600 ring-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            <SheetTable key={sheet.name} sheet={sheet} />

            {(sheet.truncatedRows || sheet.truncatedColumns) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Preview limited to the first {PREVIEW_MAX_ROWS} rows and the first {PREVIEW_MAX_COLUMNS}{" "}
                columns. Download the file to see everything.
              </p>
            )}
            {sheet.skippedImages > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {sheet.skippedImages} {sheet.skippedImages > 1 ? "images" : "image"} in this sheet{" "}
                {sheet.skippedImages > 1 ? "are" : "is"} not displayed (outside the preview area, or an
                unsupported format such as EMF, WMF or TIFF).
              </p>
            )}
            {sheet.imageProblem && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                The images in this sheet could not be read.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Close
        </button>
        <a href={url} className={downloadLinkClassName}>
          Download
        </a>
      </div>
    </Modal>
  );
}
