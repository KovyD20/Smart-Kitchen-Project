import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";

// Recipe image handling: validate, shrink, upload, delete.
//
// The shrink step is the point of this module. A phone photo is 3-5 MB and
// 4000px wide; the largest slot that ever displays one is a 56px header thumb
// and a 130px card, so uploading the original would burn the Storage quota and
// the user's data plan for pixels nothing renders. Re-encoding to WebP at
// MAX_EDGE brings a 4 MB JPEG down to roughly 100-200 KB.
//
// The Storage security rules (configured in the Firebase console, not here) are
// the second line of defence: uid-scoped write on recipes/{uid}/…, an image/*
// content-type check and a size cap. Everything below assumes the rules can and
// will reject anything that slips past it.

// What the file picker offers. Kept narrower than the validator: these are the
// formats a browser canvas can reliably decode. HEIC from an iPhone usually
// cannot be, which is why decode failure has its own error code.
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// The source cap only rejects absurd input early — a normal phone photo must
// pass, since shrinking it is the whole job. The upload cap is what has to match
// the console rules, and applies to the re-encoded blob.
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const MAX_EDGE = 1200;

// Tried in order until the encoded blob fits MAX_UPLOAD_BYTES. A photo needs
// only the first; the lower steps exist so a pathological image (huge flat
// noise) degrades in quality instead of failing the save.
const QUALITY_STEPS = [0.82, 0.7, 0.55];

// Validation returns a code rather than a sentence: the Hungarian wording is a
// UI concern and lives with the component that shows it.
export const IMAGE_ERROR = {
  MISSING: "missing",
  TYPE: "type",
  SIZE: "size",
  DECODE: "decode",
  TOO_BIG_ENCODED: "too_big_encoded",
};

export class ImageUploadError extends Error {
  constructor(code) {
    super(`image upload rejected: ${code}`);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

// Returns an IMAGE_ERROR code, or null when the file is acceptable.
export function validateImageFile(file) {
  if (!file) return IMAGE_ERROR.MISSING;
  if (!file.type || !file.type.startsWith("image/")) return IMAGE_ERROR.TYPE;
  if (file.size > MAX_SOURCE_BYTES) return IMAGE_ERROR.SIZE;
  return null;
}

// Scales (width, height) down so the longer edge is at most maxEdge, preserving
// the aspect ratio. Never upscales — a small image stays small rather than being
// blown up into a soft one. Rounded to whole pixels, and never to zero.
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 0, height: 0 };
  }

  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: Math.round(w), height: Math.round(h) };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

// Storage object path for a recipe image. Timestamped rather than fixed, so a
// replacement never collides with a cached copy of the previous one under the
// same URL. User-scoped by design: a later public-sharing feature widens the
// rules instead of moving files.
export function recipeImagePath(uid, recipeId, timestamp) {
  return `recipes/${uid}/${recipeId}/${timestamp}.webp`;
}

async function decode(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new ImageUploadError(IMAGE_ERROR.DECODE);
  }
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
  });
}

// Re-encodes `file` as a WebP blob that fits MAX_UPLOAD_BYTES. Exported for the
// tests; callers want uploadRecipeImage.
export async function shrinkToWebp(file, maxEdge = MAX_EDGE) {
  const bitmap = await decode(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

  if (width === 0 || height === 0) {
    bitmap.close?.();
    throw new ImageUploadError(IMAGE_ERROR.DECODE);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality);
    // A browser with no WebP encoder hands back null (or a PNG) rather than
    // throwing, so treat a missing blob as an undecodable input.
    if (!blob) throw new ImageUploadError(IMAGE_ERROR.DECODE);
    if (blob.size <= MAX_UPLOAD_BYTES) return blob;
  }

  throw new ImageUploadError(IMAGE_ERROR.TOO_BIG_ENCODED);
}

// Validates, shrinks and uploads, returning the download URL to store on the
// recipe document. Throws ImageUploadError for anything the user can fix.
export async function uploadRecipeImage({ uid, recipeId, file, now = Date.now }) {
  const invalid = validateImageFile(file);
  if (invalid) throw new ImageUploadError(invalid);

  const blob = await shrinkToWebp(file);
  const path = recipeImagePath(uid, recipeId, now());

  await uploadBytes(ref(storage, path), blob, { contentType: "image/webp" });
  return getDownloadURL(ref(storage, path));
}

// Best-effort cleanup of the object behind a download URL.
//
// Deliberately never throws: it runs after the user-visible change has already
// succeeded (the recipe is deleted, or the replacement image is live), so a
// failure here means one orphaned file — not something worth turning a
// successful save into an error toast over. An already-missing object is the
// normal case when a delete is retried.
export async function deleteRecipeImage(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (err) {
    if (err?.code === "storage/object-not-found") return;
    console.warn("A recept képét nem sikerült törölni a tárolóból", err);
  }
}
