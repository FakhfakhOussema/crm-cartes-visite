// Sends the image to the /api/extract API route and returns { lastName, firstName, email, phone, company, position, website, address }.
// Throws an Error with a readable message on failure; rethrows the AbortError as is if `signal` is aborted.
export async function extractCardData(file, signal) {
  const body = new FormData();
  body.append("image", file);

  let response;
  try {
    response = await fetch("/api/extract", { method: "POST", body, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Unable to reach the analysis server. Check your connection.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response (unexpected server error): handled by the generic message below.
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? "The analysis failed (unexpected server response).");
  }
  return payload.data;
}
