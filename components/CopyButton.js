"use client";

import { useEffect, useRef, useState } from "react";

// Copies `text` to the clipboard. The Clipboard API only exists in a secure context (https / localhost):
// elsewhere (e.g. the dev server opened from a phone by its IP) we fall back to a temporary <textarea>.
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission refused: we try the fallback
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

// Small "copy" icon placed next to a value; turns into a check mark for a moment once copied.
// Renders nothing when there is nothing to copy. `label`: what is copied, for the screen readers ("the phone").
// `revealOnHover`: hidden until the parent (class "group") is hovered or the button focused — always visible on touch screens.
export default function CopyButton({ text, label, revealOnHover = false }) {
  const [state, setState] = useState("idle"); // "idle" | "copied" | "failed"
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!text) return null;

  async function handleClick(event) {
    event.stopPropagation();
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 1500);
  }

  const title = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : `Copy ${label}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy ${label}`}
      title={title}
      className={`shrink-0 rounded-md p-1 transition-colors focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        state === "copied"
          ? "text-emerald-600"
          : state === "failed"
            ? "text-red-600"
            : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
      } ${
        revealOnHover && state === "idle"
          ? "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          : ""
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
        className="h-4 w-4"
      >
        {state === "copied" ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        ) : (
          <>
            <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
            <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
          </>
        )}
      </svg>
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied" : ""}
      </span>
    </button>
  );
}
