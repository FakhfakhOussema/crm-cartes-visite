import { extractWithGemini } from "@/lib/gemini-extract";
import { extractWithOpenRouter } from "@/lib/openrouter-extract";
import { TOTAL_FAILURE_MESSAGE } from "@/lib/extraction-shared";

const DEFAULT_OPTIONS = {
  totalBudgetMs: 58_000, // the route's maxDuration: 60 s
  geminiBudgetMs: 35_000,
  openrouterBudgetMs: 30_000,
  gemini: {},
  openrouter: {},
};
const MIN_OPENROUTER_MS = 4000; // no point starting OpenRouter if less time than this is left

// Cascading extraction of a business card:
//   1. Gemini, up to 3 attempts (pauses of 2 s then 5 s);
//   2. if Gemini fails: OpenRouter;
//   3. if both fail: a clear message inviting the user to use manual entry.
// Every step is logged (console.log) so it can be diagnosed. Returns:
//   { ok: true, data, source: "gemini" | "openrouter", model }
//   { ok: false, status, error }      failure (message meant for the user)
//   { ok: false, aborted: true }      the client left
export async function extractCard({
  geminiApiKey,
  openrouterApiKey,
  mimeType,
  base64,
  signal,
  options,
  log = (message) => console.log(message),
}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const startedAt = Date.now();
  const deadline = startedAt + settings.totalBudgetMs;
  const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)} s`;

  log(
    `[extract] Start: ${mimeType} image (${Math.round((base64.length * 3) / 4 / 1024)} KB) | Gemini: ${geminiApiKey ? "key present" : "key MISSING"} | OpenRouter: ${openrouterApiKey ? "key present" : "key MISSING"}`,
  );

  // --- Step 1: Gemini ---
  if (geminiApiKey) {
    const gemini = await extractWithGemini({
      apiKey: geminiApiKey,
      mimeType,
      base64,
      signal,
      options: { ...settings.gemini, budgetMs: Math.min(settings.geminiBudgetMs, settings.totalBudgetMs) },
      log,
    });
    if (gemini.ok) {
      log(`[extract] Done: success via Gemini (${gemini.model}) in ${elapsed()}`);
      return { ok: true, data: gemini.data, source: "gemini", model: gemini.model };
    }
    if (gemini.aborted) return { ok: false, aborted: true };
    if (gemini.fatal) {
      // The image itself is the problem: OpenRouter would not change anything.
      log(`[extract] Done: permanent error (${gemini.fatal.error}), no fallback — ${elapsed()}`);
      return { ok: false, ...gemini.fatal };
    }
    log(
      `[extract] Gemini failed (${gemini.calls} call(s); causes: ${[...new Set(gemini.failures)].join(", ") || "no attempt possible"}) → switching to OpenRouter`,
    );
  } else {
    log("[extract] Gemini: GEMINI_API_KEY missing, step skipped → switching to OpenRouter");
  }

  // --- Step 2: OpenRouter ---
  if (!openrouterApiKey) {
    log("[extract] OpenRouter: OPENROUTER_API_KEY missing, fallback impossible");
  } else if (deadline - Date.now() < MIN_OPENROUTER_MS) {
    log("[extract] OpenRouter: total time used up, fallback not attempted");
  } else {
    const openrouter = await extractWithOpenRouter({
      apiKey: openrouterApiKey,
      mimeType,
      base64,
      signal,
      options: {
        ...settings.openrouter,
        budgetMs: Math.min(settings.openrouterBudgetMs, deadline - Date.now()),
      },
      log,
    });
    if (openrouter.ok) {
      log(`[extract] Done: success via OpenRouter (${openrouter.model}) in ${elapsed()}`);
      return { ok: true, data: openrouter.data, source: "openrouter", model: openrouter.model };
    }
    if (openrouter.aborted) return { ok: false, aborted: true };
    log(`[extract] OpenRouter failed (${openrouter.calls} call(s))`);
  }

  // --- Step 3: total failure ---
  log(`[extract] Done: TOTAL FAILURE after ${elapsed()} → manual entry offered to the user`);
  return { ok: false, status: 502, error: TOTAL_FAILURE_MESSAGE };
}
