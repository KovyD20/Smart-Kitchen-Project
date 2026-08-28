# Pantry thumbnails

Static product images for the shopping-list and fridge rows (`ItemRow`).

## Naming

`{slug}.avif`, where the slug is the catalog's `normalized_key` with spaces
replaced by dashes — exactly what `src/lib/pantryImages.js` generates:

| canonical name        | normalized_key        | file                       |
|-----------------------|-----------------------|----------------------------|
| `vöröshagyma`         | `voroshagyma`         | `voroshagyma.avif`         |
| `csirke mellfilé`     | `csirke mellfile`     | `csirke-mellfile.avif`     |

Nothing enumerates this directory: a missing file is handled by the `<img>`
`onError` handler, which drops the thumbnail for that row. So files can be added
incrementally without touching any code.

## Asset requirements

- **Format:** AVIF, for every file. The extension is a single constant
  (`PANTRY_IMAGE_EXT` in `src/lib/pantryImages.js`), not a per-file guess, so a
  stray `.webp` or `.png` is simply never requested. Changing formats means
  re-encoding the whole directory.
- **Size:** square, and no resizing needed. The row renders at 24×24 CSS px with
  `object-fit: cover`, so anything from 48 px up looks identical; ~200-256 px is
  a good default and costs a few kB per file. A non-square image is centre-
  cropped to a square, which cuts the edges.
- **Style:** one consistent look and background across the whole set — a
  visually inconsistent set looks worse than no images at all. A plain white
  background reads as a small product tile against the dark UI; transparency
  also works, and shows `--pill` behind it.
- **Licence:** freely usable sources only.
- **Order of work:** the `priority: "essential"` catalog items first (37 of the
  220 items), then `good_to_have` (58), then `extra` (125).

Desktop only: the thumbnail is hidden on mobile (`showThumb={!isMobile}` in the
shopping and fridge views), so there is no need for a 3× variant.

## Overriding a single item

`pantry_items.image_url` in Postgres wins over the convention above, per item.
While it is `NULL` the conventional path is used. That column is the migration
path to a CDN or to user uploads without a frontend change.

## Why `vercel.json` excludes this directory

Nothing checks whether a file here exists before the `<img>` asks for it, so
misses are normal and must stay cheap. The SPA rewrite in `frontend/vercel.json`
is therefore `/((?!pantry/).*)` rather than a plain catch-all: with a catch-all,
every missing thumbnail would be answered with a full `index.html` at HTTP 200.
The `onError` fallback still fires in that case (HTML does not decode as an
image), but each miss would cost a document-sized download instead of a 404.

The Vite dev server has no equivalent switch and still answers a miss with
`index.html` at 200 — dev-only noise in the network tab, not a production cost.
