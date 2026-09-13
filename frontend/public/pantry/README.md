# Pantry thumbnails

Static product images for the shopping-list and fridge rows (`ItemRow`).

## Naming

`{slug}.png`, where the slug is the catalog's `normalized_key` with spaces
replaced by dashes — exactly what `src/lib/pantryImages.js` generates:

| canonical name        | normalized_key        | file                       |
|-----------------------|-----------------------|----------------------------|
| `vöröshagyma`         | `voroshagyma`         | `voroshagyma.png`          |
| `csirke mellfilé`     | `csirke mellfile`     | `csirke-mellfile.png`      |

Nothing enumerates this directory: a missing file is handled by the `<img>`
`onError` handler, which drops the thumbnail for that row. So files can be added
incrementally without touching any code.

## Asset requirements

- **Format:** PNG, for every file. The extension is a single constant
  (`PANTRY_IMAGE_EXT` in `src/lib/pantryImages.js`), not a per-file guess, so a
  stray `.webp` or `.avif` is simply never requested. Changing formats means
  re-encoding the whole directory.
- **Cut out, not on a plate:** the product sits on transparency and the row's
  own surface shows through. A backdrop of any colour reads as a tile rather
  than as the product — white as a bright one, `--pill` as a black one, which
  is why `.item-thumb` no longer paints a background. The set has to be
  consistent about this: one plate in a column of cut-outs is what stands out.
- **Indexed colour, 128 entries.** Truecolour PNG of the same set runs about
  60 kB a file; indexed runs about 13 kB, which is what the AVIF set it
  replaced cost. At 24 px the two are indistinguishable — the trade is only
  visible on a smooth gradient viewed at full size, which nothing here does.
- **Size:** square, and no resizing needed. The row renders at 24×24 CSS px with
  `object-fit: cover`, so anything from 48 px up looks identical; ~200-256 px is
  a good default. A non-square image is centre-cropped to a square, which cuts
  the edges.
- **No shop furniture:** a listing photo often carries the shop's promo
  overlays (`Diszkont ár`, the `ÁR és CSÖKKENTÉS` starburst, `Hazai`,
  `100% RECYCLABLE`, `Új`). They belong to a price, not to the product, so they
  come off before the file lands here. What is printed on the packaging itself
  stays: that is the product.
- **Licence:** freely usable sources only.

## Masters

Each file here is reduced from a 512 px truecolour master of the same name, cut
out and cleaned but not yet size- or colour-reduced. The masters live outside
the repo, next to the original photographs, because 40 MB of them buys nothing
a checkout needs; re-encoding the set (a different size, palette, or the
whole-directory change that swapping `PANTRY_IMAGE_EXT` implies) starts from
there rather than from the original photos.

All 272 catalog items are covered. A row whose file is missing is still fine —
the `onError` handler drops the thumbnail — so the set can fall behind the
catalog without anything breaking.

What a cut-out needs is for the product to differ from the backdrop somewhere
along its whole outline. A photograph bright enough that the product's white
*is* the backdrop white, with no edge in between, cannot be matted by colour at
any threshold; when one turns up, the answer is a different photograph rather
than a better algorithm, and no file at all rather than a shredded one.

One file here, `papirzsebkendo.png`, has no catalog item to match and is never
requested. It is kept so the master set and this directory stay one-to-one.

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
