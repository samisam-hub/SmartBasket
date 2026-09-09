# Approved meal illustrations

Update: the catalog now has 31 meals and snacks. See COMFORT-MEALS-AND-SNACKS.md. The visible AI caption was removed at the user's request; provenance remains in these project documents. The notes below describe the original 24-image batch.

All 24 current meals have AI serving illustrations bundled locally in assets/meals, shown in meal review and confirmed basket meals, with an explicit AI caption. The three individually approved images are preserved; 21 more were generated at the user's request in the same style. They are not catalog/product photographs. Missing or failed illustrations leave the existing meal text usable. Image selection checks ingredient keys as well as meal ID to avoid misleading saved snapshots.

The full prompts, built-in image_gen tool provenance, original paths and project asset paths for the additional 21 images are recorded in meal-image-prompts.json. All generated outputs were visually inspected for meal identity and composition. This image-only expansion does not change recipes or nutrition. The display remains centered, 200 px square (160 px in confirmed baskets), constrained by the card width; an explicit square wrapper prevents React Native Web from using the intrinsic PNG height.

The original oatmeal and salmon previews and the final thin-noodle tofu revision were approved. Older tofu rice snapshots retain their original ingredients and do not receive the noodle image. New plans use the distinct tofu-teriyaki-noodles recipe ID.

The new recipe uses 200 g tofu, 70 g dry wheat noodles/spaghetti, 150 g broccoli, 100 g carrots, 5 g olive oil and 15 ml teriyaki marinade. Macro totals are recalculated by the existing recipe helper. Wheat and soy restrictions are retained; this recipe is not gluten-free.

Teriyaki development reference: https://www.kikkoman.eu/products/detail/kikkoman-teriyaki-marinade (accessed 2026-09-08), per 100 ml: 100 kcal, 6 g protein, 12 g carbohydrates, 0 g fat. These are a recipe development reference, not values assigned to arbitrary catalog products. Actual sauce labels vary. The existing allergen model does not include sulphites; the reference marinade can contain them. No broader allergen-free claim is made.

Ingredient matching uses narrow dry noodle and plain teriyaki marinade aliases with the existing SKU safety and unit checks. Missing sauce SKUs remain explicitly unresolved; no product or price is fabricated. Other meals and saved plans are not rewritten. No database migration or APK workflow change is needed.
