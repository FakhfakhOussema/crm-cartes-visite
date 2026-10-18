import { EXTRACTION_PROMPT, ParseError, parseModelResponse } from "@/lib/extraction-shared";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Vision models tried in order; we stop at the first one that answers.
export const OPENROUTER_MODELS = [
  // Requested model. Withdrawn from the free tier: OpenRouter answers 404 "This model is unavailable for free. The
  // paid version is available now" (the paid version would cost money: deliberately not used).
  // Kept first, it will be used again if it comes back for free; in the meantime this 404 costs ~0.5 s.
  "qwen/qwen2.5-vl-72b-instruct:free",
  // Free alternatives with vision, present in OpenRouter's catalogue and tested on a business card.
  "nvidia/nemotron-3.5-super-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

const DEFAULT_OPTIONS = {
  models: OPENROUTER_MODELS,
  attemptTimeoutMs: 20_000, // maximum duration of one call (2 to 5 s in practice with reasoning turned off)
  budgetMs: 30_000, // maximum duration of the whole OpenRouter step (capped by the total time left)
};
const MIN_ATTEMPT_MS = 2000;

class OpenRouterError extends Error {}

// Content of the response: a string, or a list of parts { type: "text", text }.
function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : (part?.text ?? ""))).join("");
  }
  return "";
}

async function callModel({ apiKey, model, mimeType, base64, signal }) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      // "Strict JSON" mode when the model supports it (ignored otherwise); the prompt asks for it anyway.
      response_format: { type: "json_object" },
      // Without this, a "reasoning" model such as nvidia/nemotron thinks for 40 s to several minutes, or
      // exceeds every timeout with an empty response; turned off, it answers in 2 to 5 s (measured). Ignored by
      // models that have no reasoning mode.
      reasoning: { enabled: false },
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
    signal,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // OpenRouter sends the 200 header right away and then makes the client wait: if the timeout is hit while the
    // body is being read, it is not an "empty response" but a model that did not answer in time.
    if (signal.aborted) throw new OpenRouterError("timeout: incomplete response");
  }
  // OpenRouter can also answer 200 with an "error" object (error from the upstream provider).
  if (!response.ok || body?.error) {
    const detail = body?.error?.metadata?.raw ?? body?.error?.message ?? `HTTP ${response.status}`;
    throw new OpenRouterError(`HTTP ${body?.error?.code ?? response.status} — ${String(detail)}`);
  }
  const text = contentToText(body?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new OpenRouterError("empty response");
  return parseModelResponse(text);
}

// Step 2: OpenRouter (fallback). One call per model, in order, until the first one that answers. Returns:
//   { ok: true, data, model, calls }
//   { ok: false, calls, failures }   all the models failed
//   { ok: false, aborted: true }     the client left
export async function extractWithOpenRouter({ apiKey, mimeType, base64, signal, options, log = () => {} }) {
  const { models, attemptTimeoutMs, budgetMs } = { ...DEFAULT_OPTIONS, ...options };
  const deadline = Date.now() + budgetMs;
  const failures = [];
  let calls = 0;

  for (const model of models) {
    if (signal?.aborted) break;
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      log("[extract] OpenRouter: allotted time used up");
      break;
    }

    calls += 1;
    const startedAt = Date.now();
    log(`[extract] OpenRouter: call ${calls} — model ${model}`);
    const attemptSignal = AbortSignal.timeout(Math.min(attemptTimeoutMs, remaining));
    try {
      const data = await callModel({
        apiKey,
        model,
        mimeType,
        base64,
        signal: signal ? AbortSignal.any([signal, attemptSignal]) : attemptSignal,
      });
      log(`[extract] OpenRouter: success with ${model} in ${Date.now() - startedAt} ms`);
      return { ok: true, data, model, calls };
    } catch (error) {
      if (signal?.aborted) break;
      // Keys never appear in these messages: they are only sent in the header.
      const reason =
        error instanceof OpenRouterError || error instanceof ParseError
          ? error.message
          : `${error.name}: ${error.message}`;
      log(`[extract] OpenRouter: ${model} failed after ${Date.now() - startedAt} ms — ${reason.slice(0, 200)}`);
      failures.push({ model, reason });
    }
  }

  if (signal?.aborted) {
    log(`[extract] OpenRouter: cancelled, the client closed the request (${calls} call(s))`);
    return { ok: false, aborted: true };
  }
  return { ok: false, calls, failures };
}
