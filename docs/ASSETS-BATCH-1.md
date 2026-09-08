# SmartBasket — Asset Library Batch 1

## Source and inventory
Approved source: `C:\Users\Samaana Zakharova\Downloads\smartbasket-assets-batch-1.zip`.
Extracted for inspection into `.expo/asset-review/smartbasket-assets-batch-1` (ignored development directory).
All 13 PNGs were copied unchanged. Byte comparison against the extracted files passed; PNG dimensions match the supplied manifest.

Final structure:
- `assets/brand/`: logo-horizontal.png, logo-horizontal-dark.png, logo-mark.png
- `assets/android/`: app-icon.png, adaptive-icon-foreground.png, adaptive-icon-background.png, monochrome-icon.png
- `assets/splash/`: splash-logo.png
- `assets/states/`: product-placeholder.png, empty-basket.png, no-search-results.png, offline-state.png, data-error.png
- `assets/config/`: original design-tokens.json and asset-manifest.json
- `assets/README.md`: supplied usage guidance

## Integration
`lib/assets.ts` owns static image imports. `components/BrandAssets.tsx` provides full/compact branding and state illustrations, using contain and preserved aspect ratios. Full logos are 220 dp wide; compact marks 40 dp; states normally 160 dp (120 dp inline).

Home and Account use the full light-surface logo. Profile uses the compact mark. The dark horizontal logo is available through the same component for dark surfaces; the existing light-only app setting remains unchanged.

ProductCard, search results and Product Detail already share ProductImage. It now uses the bundled placeholder for missing, rejected or failed external images while preserving dimension checks, load handling and real product photographs. Basket rows do not currently contain an image slot, so no new row layout was introduced.

Basket and saved meal-plan empty states use the empty-basket artwork. Empty product searches/filters use no-search-results. Catalog failures and product detail failures use offline or data-error based on the original failure. Existing copy and retry controls remain native components. Basket setup's unavailable-data state uses data-error.

The old Home Feather zap/text brand header and ProductImage package-icon fallback are replaced. There were no existing raster branding files to remove. Other standard icons remain unchanged.

## Theme
The existing centralized theme imports approved core colors from the supplied JSON: primary #0F6B3F, secondary #A7D36B, accent #FFD14D, orange #FF6B00, error #E63946, background #FFF8F0, surface #FFFFFF and text #1F2937. A pale green surface supports the new primary. Existing semantic contrast colors, spacing, typography, cards, inputs, navigation and safe-area structure remain.

## Android configuration
`app.config.js` sets app-icon.png as the primary and Android icon. Adaptive foreground, background image and monochrome image are all configured directly using supported Expo SDK 54 fields. Existing package identifier, scheme, version-code validation and GitHub workflow remain.

The SDK-compatible expo-splash-screen 31.0.13 config plugin uses splash-logo.png, background #FFF8F0, imageWidth 240 and resizeMode contain. No manually drawn text, full-screen baked image, artificial delay or network wait is added.

Native launcher icons and splash require a rebuilt installed app. A web preview cannot verify Android launcher masks or the native release splash. Expo also recommends checking splash appearance in a release build: https://docs.expo.dev/versions/v54.0.0/sdk/splash-screen/.

## Validation
Results are recorded below.

No Batch 2 assets, generated artwork, database migration or product-data changes are part of this task.

### Completed checks (8 September 2026)
- TypeScript and lint passed again after the visual sizing correction.
- 81/81 tests passed, including image loading/failure/tiny-image/browser events, network-versus-data classification, PNG manifest dimensions, authentication, onboarding, catalog, basket save/rename/delete and owner isolation.
- Expo Doctor: 18/18 passed. An initial API connection failure cleared on retry.
- Android export including Hermes bytecode passed. New brand/state assets were bundled. The final export was repeated after the explicit image-height correction.
- Expo native config introspection passed, including adaptive foreground/background/monochrome and native splash background resources. Existing optional expo-system-ui advisory is unchanged; no system-appearance feature was added.
- Byte identity of all 13 approved PNGs and manifest dimensions checked.
- Visually checked Home, Products with real images, Product Detail, no-search-results, Basket with existing saved entries/actions, saved meal plans, Profile, Create Account, Sign In and onboarding welcome in the local web preview. A temporary page using the actual shared components verified placeholder, empty-basket, offline, data-error and dark-surface logo; that page was removed.
- Visual QA found React Native Web reserving the logo's intrinsic height when only aspectRatio was specified. Explicit 220x55 logo and square state dimensions corrected this, confirmed by a fresh screenshot.
- Full native device safe-area/launcher masking/splash appearance still requires an installed release APK. No APK was generated or GitHub APK workflow dispatched for this task.
- Native build folders remain ignored; `.gitignore` now anchors /android/ and /ios/ to the repository root so assets/android is included in Git.

### Files changed
Existing: .gitignore, app.config.js, app/(tabs)/index.tsx, products.tsx, basket.tsx, profile.tsx, app/account.tsx, app/basket-setup.tsx, app/product/[id].tsx, app/saved-meal-plans.tsx, components/ProductImage.tsx, components/ui.tsx, hooks/useProducts.ts, lib/theme.ts, services/catalog/ProductRepository.ts, package.json, package-lock.json, tests/product-image.test.cjs, tests/register.cjs.
New: the approved assets/ library, lib/assets.ts, lib/failureIllustration.ts, components/BrandAssets.tsx, tests/brand-assets.test.cjs and this report.

Limitations: offline artwork classifies known network failures (and browser offline status), not a continuous native connectivity monitor. It does not turn ordinary backend errors into offline states. No destructive live-data testing or account registration was performed. Dark logo support is ready; a new app-wide dark mode is outside this task.
