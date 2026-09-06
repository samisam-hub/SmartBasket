# Product image audit — 6 September 2026

## Findings and result

The hosted catalog had 750 `.400.jpg` main images and 750 `.200.jpg`
thumbnails. The importer first accepted `image_front_url` (falling back to
`image_url`) and `image_front_small_url` / `image_small_url`. For the bulk data,
it constructed `front_LANGUAGE.REVISION.400.jpg` and `.200.jpg` from
`images.selected.front` (or legacy `images.front_LANGUAGE`). It ignored the
available `sizes.full` dimensions. Details could also fall back to thumbnails.
An 80×96 logical-pixel card can need 240×288 physical pixels on a 3× Android
display; a 200-pixel thumbnail is insufficient. A 240-high detail frame can need
720 physical pixels, exceeding the previous 400-pixel image.

**655 of the existing 750 products now have a resolution-qualified display
image. The remaining 95 retain their product data and use the existing package
placeholder.** All 750 image records were audited and refreshed in place.
There are 650 separate 400-pixel card URLs; five usable images have no smaller
suitable variant, so cards use the qualified display image for those products.

For qualifying display images, the long edge ranges from 600 to 6,528 pixels,
with median 1,360 and 90th percentile 4,032. Across all audited source front
crops, long edges range from 172 to 6,528. Common dimensions include 900×1200,
1021×1360 and 3024×4032. Some originals are only 200×200 or 300×400.

Downloaded file checks matched the advertised dimensions:

| Example barcode | Previous main | Selected full front |
| --- | --- | --- |
| 0024182029307 | 300×400 | 3024×4032 |
| 0017400118105 | 184×400 | 590×1280 |
| 0018627703358 | 300×400 | 4896×6528 |

The issue came from both implementation and source data: reduced variants were
chosen even when larger originals existed, while 95 products have no front crop
meeting the chosen minimum. Resolution does not measure focus, lighting, framing
or whether packaging is current. No AI images, retouching or replacement provider
was used.

## Selection and rendering

`services/catalog/off-images.ts` considers only explicitly selected front crops
from modern and legacy image metadata. It selects the largest qualifying crop
across available languages, normally `front_LANGUAGE.REVISION.full.jpg`.
Dimensions must be positive, valid metadata; a generated variant larger than its
known original is rejected. Arbitrary uploaded, nutrition and ingredient images
are not used as packaging substitutes. Convenience URLs without dimensions are
retained as unverified provenance and not displayed.

Display suitability requires a long edge of at least 600 and short edge of at
least 200 pixels. A separate thumbnail must have at least 240/120 pixels and
come from the same selected front crop. The smallest qualifying card variant is
used. This policy is centralized and can be tuned without provider-specific UI.

ProductImage preserves the existing frames, spinner and placeholder. Details
never substitute a thumbnail. Rendering is capped at source dimensions divided
by the device pixel ratio, preventing source-pixel enlargement. Actual decoded
dimensions are checked on load before revealing the image; tiny files and failed
loads show the placeholder. Android requests native resize/downsampling for large
source files. Decoded-size checks allow native downsampling (which may report fewer
pixels than the source metadata). Full-resolution downloads can still be larger: the three checked
examples were about 108 KB–3 MB. Cards avoid those downloads when a suitable
smaller variant exists.

## Schema and compatibility

Migration `20260906124417_product_image_quality.sql` was applied to SmartBasket.
It adds `source_image_url`, `display_image_url`, `image_source`, `image_quality`,
`image_width`, `image_height`, `image_thumbnail_width`, `image_thumbnail_height`.
Quality is `usable`, `low-resolution`, `unknown` or `missing`; it describes
resolution suitability only. Dimensions describe the display image when usable,
otherwise the best known source crop. Unknown dimensions remain null.

The legacy `image_url` mirrors the qualified display URL, so existing APKs also
receive improved images and placeholders from the hosted catalog. Updated native
rendering safeguards require a future APK containing this source change.
Product provenance (`source = open-food-facts`) remains separate from image
provenance. A later image provider can populate these presentation fields without
changing nutrition, the repository contract or the screens.

Only image fields and server-maintained update timestamps changed. A hash of all
other product fields before and after is identical:
`dc6b06c1e08dc6397662bd71462644fb`. Catalog count and IDs remain unchanged, and
both app roles retain SELECT-only access. No preference, navigation, safe-area,
design-system or APK-workflow changes were made.

## Repeating the audit

1. `node --env-file=.env scripts/audit-catalog-images.cjs` reads current IDs using
   the public key and streams bounded OFF bulk metadata (80,000-record / ten-minute
   cap). This audit found every current product within 37,601 records.
2. `node scripts/prepare-image-refresh.cjs` creates image-only SQL update batches
   for those exact IDs. Review `.expo/catalog-images/report.json` and SQL before
   administrative application; missing metadata fails preparation.
3. Apply the migration and generated update batches through an authorized database
   tool. The scripts never give the app write privileges or embed admin keys.
4. `npm run catalog:verify` checks real reads, discovery queries and image metadata.

The regular development importer now requires `imageQuality === 'usable'`, rather
than merely requiring a URL. It will prefer usable images when preparing future
catalogs; this audit did not replace or add products. Local audit metadata and
sample images are ignored by Git.

Tests cover modern/legacy selection, better alternate front images, missing and
malformed metadata, tiny originals behind upscaled variants, separate thumbnails,
database suitability constraints, actual component placeholders, decoded-size
checks and 3× density size caps. Hosted search/filter/pagination verification passed.
TypeScript, lint and all 34 tests passed; the additional native downsampling guard
is covered by the component tests. Physical-device appearance has not been retested
in a new APK for this change.

Reference: [Open Food Facts image metadata and URL conventions](https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/).
Existing OFF attribution and image licensing remain in the app.
