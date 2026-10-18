import { extractCard } from "@/lib/extraction-cascade";
import { EXTRACTED_FIELDS } from "@/lib/extraction-shared";

// The cascade (Gemini with retries, then OpenRouter) can take up to 58 s.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// Image formats accepted by the Gemini API.
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function fail(error, status) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(request) {
  // Keys are read here only, server side: they are never sent to the browser.
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!geminiApiKey && !openrouterApiKey) {
    console.error("[extract] Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is defined");
    return fail("Automatic analysis is not configured on the server.", 500);
  }

  let image;
  try {
    const formData = await request.formData();
    image = formData.get("image");
  } catch {
    return fail("Invalid request: the image must be sent as multipart/form-data.", 400);
  }

  if (!(image instanceof Blob)) return fail("No image received.", 400);
  if (image.size === 0) return fail("The received image is empty.", 400);
  if (image.size > MAX_IMAGE_BYTES) {
    return fail("The image is too large (10 MB maximum).", 413);
  }
  if (!SUPPORTED_TYPES.includes(image.type)) {
    return fail("Unsupported image format (JPG, PNG, WEBP or HEIC).", 415);
  }

  let result;
  try {
    result = await extractCard({
      geminiApiKey,
      openrouterApiKey,
      mimeType: image.type,
      base64: Buffer.from(await image.arrayBuffer()).toString("base64"),
      // If the user closes the window during the analysis, we stop querying the providers.
      signal: request.signal,
    });
  } catch (error) {
    // Unexpected error (not a provider response): logged, and a JSON response rather than an error page.
    console.error("[extract] Unexpected error:", error);
    return fail("The image analysis failed. Please try again.", 500);
  }

  if (result.aborted) return fail("Request cancelled.", 499);
  if (!result.ok) return fail(result.error, result.status);

  // Everything is empty: unreadable or blurry image, or not a business card.
  if (EXTRACTED_FIELDS.every((field) => result.data[field] === "")) {
    console.log(`[extract] Empty card (source: ${result.source}): no readable information`);
    return fail(
      "No readable information on this image. Check that it is a sharp, well-lit business card.",
      422,
    );
  }

  // `source` ("gemini" or "openrouter"): debugging information, ignored by the interface.
  return Response.json({ success: true, data: result.data, source: result.source });
}
