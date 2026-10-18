import {
  GoogleGenerativeAI,
  GoogleGenerativeAIError,
  GoogleGenerativeAIResponseError,
  SchemaType,
} from "@google/generative-ai";
import {
  EXTRACTED_FIELDS,
  EXTRACTION_PROMPT,
  ParseError,
  parseModelResponse,
  sleep,
} from "@/lib/extraction-shared";

// Vision models tried in order on each attempt: the most recent first, then fallback models.
// Tested with @google/generative-ai 0.24.1. Google regularly retires models ("gemini-2.5-flash" already
// answers 404), sometimes overloads the most recent ones (503) and caps the free quota per day and per model (429):
// so an unavailable model does not prevent the following ones from answering.
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];

const DEFAULT_OPTIONS = {
  models: GEMINI_MODELS,
  // Pause before the 2nd then the 3rd attempt: 3 attempts in total, with an increasing delay.
  retryDelaysMs: [2000, 5000],
  // Maximum duration of one call. Normally an extraction takes 4 to 6 s; measured when Google is busy:
  // 17 s for a valid response, 31 s for a call that ended in a 503.
  attemptTimeoutMs: 20_000,
  budgetMs: 35_000, // maximum duration of the whole Gemini step
};
const MIN_ATTEMPT_MS = 3000; // no point starting a call if less time than this is left

// Structured response: forces the model to return exactly these keys, all of type string.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: Object.fromEntries(
    EXTRACTED_FIELDS.map((field) => [field, { type: SchemaType.STRING }]),
  ),
  required: EXTRACTED_FIELDS,
};

// What to do after an error?
//  - "retry": temporary overload / unavailability (503, 500, 502, 504, "overloaded" / "unavailable" message,
//             network or timeout, non-JSON response): try the next model, then do another round;
//  - "skip" : this model will not answer (quota reached, retired, access denied): dropped for the rest of the run;
//  - "stop" : Gemini is unusable (invalid key): no point insisting, hand over to the next provider;
//  - "fatal": the problem comes from the image or the content: no provider will change that.
function classify(error) {
  if (error instanceof ParseError) return { kind: "retry", reason: "non-JSON response" };
  // An error that does not come from the API (a bug in our code) must not be hidden behind retries.
  if (!(error instanceof GoogleGenerativeAIError)) throw error;

  const message = String(error.message ?? "");
  if (/api key/i.test(message)) return { kind: "stop", reason: "invalid API key" };
  if (/unable to process input image/i.test(message)) return { kind: "fatal", reason: "unreadable image" };
  if (error instanceof GoogleGenerativeAIResponseError) {
    // "blocked due to OTHER" is a model incident; the other reasons (SAFETY…) are content refusals.
    return /\b(OTHER|MAX_TOKENS|FINISH_REASON_UNSPECIFIED)\b/.test(message)
      ? { kind: "retry", reason: "response blocked by the model (incident)" }
      : { kind: "fatal", reason: "content refused" };
  }
  switch (error.status) {
    case 429:
      return { kind: "skip", reason: "quota reached (429)" };
    case 403:
      return { kind: "skip", reason: "access denied (403)" };
    case 404:
      return { kind: "skip", reason: "model not found (404)" };
    case 500:
    case 502:
    case 503:
    case 504:
      return { kind: "retry", reason: `overload / unavailable (${error.status})` };
    case undefined: // no HTTP response: network down, timeout
      return { kind: "retry", reason: "no response (network or timeout)" };
    default:
      return /overloaded|unavailable/i.test(message)
        ? { kind: "retry", reason: `overload / unavailable (${error.status})` }
        : { kind: "skip", reason: `request refused (${error.status})` };
  }
}

const FATAL_MESSAGES = {
  "unreadable image": {
    status: 422,
    error: "This image could not be read (corrupted file or wrong format). Try another photo.",
  },
  "content refused": { status: 422, error: "The model refused to analyse this image." },
};

async function attempt(client, model, mimeType, base64, signal) {
  const generativeModel = client.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });
  const result = await generativeModel.generateContent(
    [EXTRACTION_PROMPT, { inlineData: { mimeType, data: base64 } }],
    { signal },
  );
  return parseModelResponse(result.response.text());
}

// Step 1: Gemini, with retries. Up to 3 attempts (pauses of 2 s then 5 s); each attempt
// tries the models in order until one answers. Returns:
//   { ok: true, data, model, calls }
//   { ok: false, calls, failures }          failure: the next provider can take over
//   { ok: false, fatal: { status, error } } image / content problem: no point going further
//   { ok: false, aborted: true }            the client left
export async function extractWithGemini({ apiKey, mimeType, base64, signal, options, log = () => {} }) {
  const { models, retryDelaysMs, attemptTimeoutMs, budgetMs } = { ...DEFAULT_OPTIONS, ...options };
  const passes = retryDelaysMs.length + 1;
  const client = new GoogleGenerativeAI(apiKey);
  const deadline = Date.now() + budgetMs;
  const skipped = new Set();
  const failures = [];
  let calls = 0;

  const aborted = () => {
    log(`[extract] Gemini: cancelled, the client closed the request (${calls} call(s))`);
    return { ok: false, aborted: true };
  };
  const failed = () => ({ ok: false, calls, failures });

  for (let pass = 1; pass <= passes; pass++) {
    const candidates = models.filter((model) => !skipped.has(model));
    if (candidates.length === 0) {
      log("[extract] Gemini: no usable model left");
      break;
    }

    if (pass > 1) {
      const delay = retryDelaysMs[pass - 2];
      if (deadline - Date.now() < delay + MIN_ATTEMPT_MS) {
        log("[extract] Gemini: allotted time used up, no new attempt");
        break;
      }
      log(`[extract] Gemini: pausing ${delay / 1000} s before attempt ${pass}/${passes}`);
      if (!(await sleep(delay, signal))) return aborted();
    }

    for (const model of candidates) {
      if (signal?.aborted) return aborted();
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        log("[extract] Gemini: allotted time used up");
        return failed();
      }

      calls += 1;
      const startedAt = Date.now();
      log(`[extract] Gemini: attempt ${pass}/${passes} — model ${model}`);
      const attemptSignal = AbortSignal.timeout(Math.min(attemptTimeoutMs, remaining));
      try {
        const data = await attempt(
          client,
          model,
          mimeType,
          base64,
          signal ? AbortSignal.any([signal, attemptSignal]) : attemptSignal,
        );
        log(`[extract] Gemini: success with ${model} in ${Date.now() - startedAt} ms (attempt ${pass}/${passes})`);
        return { ok: true, data, model, calls };
      } catch (error) {
        if (signal?.aborted) return aborted();
        const { kind, reason } = classify(error);
        const next =
          kind === "retry" ? "next model, then new attempt" : kind === "skip" ? "model dropped" : "stopping Gemini";
        log(
          `[extract] Gemini: ${model} failed after ${Date.now() - startedAt} ms — ${reason} → ${next} | ${String(error.message).slice(0, 140)}`,
        );
        if (kind === "fatal") return { ok: false, fatal: FATAL_MESSAGES[reason], calls };
        failures.push(reason);
        if (kind === "stop") return failed();
        if (kind === "skip") skipped.add(model);
      }
    }
  }

  return failed();
}
