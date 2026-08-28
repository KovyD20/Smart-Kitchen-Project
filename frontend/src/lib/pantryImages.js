// Product thumbnails for inventory rows.
//
// The images are a static, self-hosted asset set under `public/pantry/`, named
// after the catalog's normalized_key — so no network lookup, no CDN cost and no
// runtime licensing question. `pantry_items.image_url` overrides the convention
// when a row has one, which is the migration path to a CDN or user uploads
// without touching this module's callers.
//
// One extension for the whole set, deliberately: probing several would either
// cost an extra request per miss or need a manifest to keep in sync. Changing
// PANTRY_IMAGE_EXT means re-encoding every file in the directory.
//
// The convention path is generated blindly: which files actually exist is the
// <img onError> handler's problem, not ours (see ItemRow). That keeps the asset
// set growable without a manifest to keep in sync.

// normalizeCatalogText collapses punctuation to single spaces rather than
// removing it, so keys like "csirke mellfile" are normal — hence the slug step.
// Anything outside [a-z0-9] cannot appear in a key, so a dash is enough and no
// percent-encoding is needed.
export function pantryImageSlug(nameKey) {
  if (!nameKey) return "";
  return nameKey.toString().trim().replace(/\s+/g, "-");
}

export const PANTRY_IMAGE_EXT = "avif";

// Resolved thumbnail URL for an enriched inventory item, or null when there is
// no key to build one from (an item the catalog does not know at all).
export function pantryImageUrl(item) {
  if (item?.imageUrl) return item.imageUrl;

  const slug = pantryImageSlug(item?.nameKey);
  return slug ? `/pantry/${slug}.${PANTRY_IMAGE_EXT}` : null;
}
