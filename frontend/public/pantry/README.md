# Pantry thumbnails

Static product images for the shopping-list and fridge rows (`ItemRow`).

## Naming

`{slug}.webp`, where the slug is the catalog's `normalized_key` with spaces
replaced by dashes — exactly what `src/lib/pantryImages.js` generates:

| canonical name        | normalized_key        | file                       |
|-----------------------|-----------------------|----------------------------|
| `vöröshagyma`         | `voroshagyma`         | `voroshagyma.webp`         |
| `csirke mellfilé`     | `csirke mellfile`     | `csirke-mellfile.webp`     |

Nothing enumerates this directory: a missing file is handled by the `<img>`
`onError` handler, which drops the thumbnail for that row. So files can be added
incrementally without touching any code.

## Asset requirements

- **Format:** WebP.
- **Size:** 48×48 px (2× the 24 px display size).
- **Style:** one consistent look and background across the whole set — a
  visually inconsistent set looks worse than no images at all.
- **Licence:** freely usable sources only.
- **Order of work:** the `priority: "essential"` catalog items first (~20–30
  images), then `good_to_have`, then the rest.

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
