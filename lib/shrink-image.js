// A phone photo is often 4 to 12 MB, above the 10 MB the analysis API accepts, and far more than needed to read a
// business card. Below this size the file is left alone.
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;

// Reduces a large photo to a JPEG of at most `maxSide` pixels on its longest side. The orientation recorded by the
// camera (EXIF) is applied while decoding, so the card comes out the right way up. Returns the file itself when it
// is small already, when the result would not be lighter, or when the browser cannot decode the format (HEIC on
// most computers): it is then sent as it is.
export async function shrinkImage(file, { maxSide = 2000, quality = 0.85 } = {}) {
  if (file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff"; // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
