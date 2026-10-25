"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_CONTACT_VALUES } from "@/components/ContactFields";
import CameraIcon from "@/components/CameraIcon";
import ExtractedContactForm from "@/components/ExtractedContactForm";
import { extractCardData } from "@/lib/extract-card";
import { shrinkImage } from "@/lib/shrink-image";

// Beyond this, we warn that the analysis is taking longer than usual: the server retries on its own (new Gemini
// attempts, then the OpenRouter fallback) when Gemini is overloaded, which can take almost a minute.
const SLOW_ANALYSIS_MS = 8000;

// phase: "select" (image choice) -> "analyzing" -> "review" (pre-filled form) or "error".
export default function CardImportPanel({
  onClose,
  onContactAdded,
  onSwitchToManual,
  existingContacts,
  initialFile = null, // photo already taken (the "Scan" button of the page): shown as soon as the panel opens
}) {
  const previewUrlRef = useRef(null);
  const cameraInputRef = useRef(null);
  const latestFileRef = useRef(0); // number of the last file chosen: a slower, older one must not replace it
  const abortRef = useRef(null);
  const [selection, setSelection] = useState(null); // { file, url }
  const [phase, setPhase] = useState("select");
  const [extracted, setExtracted] = useState(EMPTY_CONTACT_VALUES);
  const [extractError, setExtractError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [isSlow, setIsSlow] = useState(false);

  const isAnalyzing = phase === "analyzing";

  useEffect(() => {
    if (!isAnalyzing) return undefined;
    const timer = setTimeout(() => setIsSlow(true), SLOW_ANALYSIS_MS);
    return () => clearTimeout(timer);
  }, [isAnalyzing]);

  // When the modal closes: cancels the analysis in progress and releases the preview's blob URL.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function clearPreviewUrl() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }

  function showFile(file) {
    clearPreviewUrl();
    previewUrlRef.current = URL.createObjectURL(file);
    setFileError(null);
    setExtractError(null);
    setPhase("select");
    setSelection({ file, url: previewUrlRef.current });
  }

  async function handleFile(chosenFile) {
    if (!chosenFile || isAnalyzing) return;
    if (!chosenFile.type.startsWith("image/")) {
      setFileError("The file must be an image (JPG, PNG, WEBP…).");
      return;
    }
    const fileNumber = ++latestFileRef.current;
    // Large photos (phone camera) are reduced first: the analysis accepts 10 MB at most.
    const file = await shrinkImage(chosenFile);
    if (fileNumber === latestFileRef.current) showFile(file);
  }

  // The photo the panel was opened with (the page's "Scan" button). Only that one, once: later choices go
  // through the inputs.
  useEffect(() => {
    if (!initialFile) return undefined;
    let cancelled = false;
    const fileNumber = ++latestFileRef.current;
    shrinkImage(initialFile).then((file) => {
      if (!cancelled && fileNumber === latestFileRef.current) showFile(file);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  function removePreview() {
    clearPreviewUrl();
    setSelection(null);
    setExtractError(null);
    setPhase("select");
  }

  async function handleExtract() {
    if (!selection || isAnalyzing) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setExtractError(null);
    setIsSlow(false);
    setPhase("analyzing");

    try {
      const data = await extractCardData(selection.file, controller.signal);
      setExtracted({ ...EMPTY_CONTACT_VALUES, ...data });
      setPhase("review");
    } catch (error) {
      if (error.name === "AbortError") return;
      setExtractError(error.message);
      setPhase("error");
    }
  }

  function handleInputChange(event) {
    handleFile(event.target.files?.[0]);
    // Lets the same file be selected again after it was removed.
    event.target.value = "";
  }

  function handleDragOver(event) {
    event.preventDefault(); // required to allow the drop
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    // dragleave also fires when hovering a child: we ignore it.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  if (phase === "review") {
    return (
      <ExtractedContactForm
        file={selection.file}
        previewUrl={selection.url}
        initialValues={extracted}
        onBack={() => setPhase("select")}
        onClose={onClose}
        onContactAdded={onContactAdded}
        existingContacts={existingContacts}
      />
    );
  }

  return (
    <>
      <div className="px-6 py-5">
        <label
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 has-[:focus-visible]:ring-offset-2 ${
            isAnalyzing ? "pointer-events-none opacity-60 " : ""
          }${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-9 w-9 text-gray-400"
          >
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <span className="text-sm text-gray-600">
            Drag a business card image here or click to select one
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            disabled={isAnalyzing}
            className="sr-only"
          />
        </label>

        {/* Opens the camera on a phone or tablet (the `capture` attribute is ignored on a computer, where the
            button is hidden). */}
        <button
          type="button"
          onClick={() => cameraInputRef.current.click()}
          disabled={isAnalyzing}
          className="mt-3 hidden w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 [@media(hover:none)]:flex"
        >
          <CameraIcon />
          Take a photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />

        {fileError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {fileError}
          </p>
        )}

        {selection && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-gray-700">
                {selection.file.name}
              </p>
              <button
                type="button"
                onClick={removePreview}
                disabled={isAnalyzing}
                className="shrink-0 text-sm font-medium text-gray-500 hover:text-red-600 focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-gray-500"
              >
                Remove
              </button>
            </div>
            {/* Local blob URL: next/image adds nothing here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selection.url}
              alt="Business card preview"
              className="mx-auto max-h-64 w-auto rounded-lg object-contain"
            />
          </div>
        )}

        {isAnalyzing && (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" fill="currentColor" className="opacity-75" />
            </svg>
            <div>
              <p>Analysing...</p>
              {isSlow && (
                <p className="mt-1 font-normal text-indigo-600">
                  The analysis is taking longer than usual: the service is very busy, so new attempts (then a
                  backup service) are started automatically. Thank you for your patience.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === "error" && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p className="font-medium">The card analysis failed.</p>
            <p className="mt-1 text-red-600">{extractError}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExtract}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Try again
              </button>
              <button
                type="button"
                // The image goes with us: it stays visible in the manual tab so the information can be copied.
                onClick={() => onSwitchToManual(selection?.file ?? null)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Manual entry
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleExtract}
          disabled={!selection || isAnalyzing}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing ? "Analysing..." : "Submit"}
        </button>
      </div>
    </>
  );
}
