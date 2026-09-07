# SmartBasket · Basket engine V1

A fitness-oriented grocery assistant: **Fuel your goals.** This is the existing
React Native / Expo SDK 54 / Expo Router Android app, with a blue design system,
complete onboarding, local draft persistence, and a normalized Supabase product catalog.

## Run locally

```powershell
cd "C:\Users\Samaana Zakharova\Desktop\SmartBasket"
npm ci
npm start
```

Use Node 24 and Expo Go for SDK 54 on the same network. A matching Android Expo Go
build is available at https://expo.dev/go. No database is required for local mode.

```powershell
npm test
npm run typecheck
npm run lint
npx expo install --check
npm run doctor
npm run export:android
```

## What is included

- Central blue theme, typography, spacing, radii, and real native UI components.
- Home, Products, Basket, and Profile tabs with consistent outline icons.
- Seven onboarding steps with inline validation, review editing, back navigation,
  save-and-exit, and restoration after app restart.
- A shared store for drafts, saved preferences, and cloud synchronization status.
- Guest onboarding via Supabase anonymous authentication when configured.
- One private `user_preferences` table, database constraints, timestamps, and RLS.
- Explicit local-only completion and a Retry cloud sync action when offline.
- Editable saved preferences in Profile and actual preference chips on Home.
- 784 real imported groceries, paged name/brand search, category/diet filters, and product details.
- Conservative preference matching, allergen warnings, source attribution, and image fallbacks.
- A clearly labeled ten-item fictional catalog if the live catalog is unavailable.
- Deterministic basket generation with package quantities, safety exclusions, target coverage and structured warnings.
- Device/cloud basket saving, owner-only RLS, atomic retry-safe saves and snapshot reopening.

Basket editing, retailer integration, payments, recipes, and notification delivery
are not implemented. See [Phase 3A engine and verification](docs/BASKET-ENGINE.md).

## Architecture

```text
app/
  _layout.tsx                  Root stack, safe areas, preference provider
  (tabs)/                      Home, Products, Basket, Profile and tab layout
  onboarding/[step].tsx        Seven validated step routes
  basket-setup.tsx             Generate, inspect, save or reopen a basket
components/
  ui.tsx                      Shared native design-system components
  NumberInput.tsx              Numeric keyboard text buffer
  ProductCard.tsx              Grocery card
  PreferenceSummary.tsx        Review/profile summary
  PersistenceStatus.tsx        Device/cloud status and retry actions
context/PreferencesContext.tsx Store subscription and auth refresh lifecycle
hooks/useBasketFlow.ts         Shared onboarding/generation navigation
hooks/useProducts.ts           Debounced paged catalog state with cancellation
lib/theme.ts                  Central design tokens
lib/supabase.ts                Optional native client with bounded fetch waits
services/
  preference-domain.ts        Validation, dietary selection, summary formatting
  preference-store.ts         UI-independent durable draft/completion state
  preferences-repository.ts   Anonymous identity, row mapping, select/upsert
  products.ts                 Catalog repository composition
  catalog/                    Provider, normalization, database reads and discovery rules
  basket/                     Pure engine, constraints, scoring, quantities and persistence
supabase/migrations/          Versioned preferences, catalog and basket migrations
tests/                        Domain and persistence regression tests
types/preferences.ts          Draft and saved preference models
```

System fonts are retained; Inter was not previously installed. Food imagery uses
qualified source images with native placeholders. Existing package versions and native modules are preserved.
PGlite is a development-only dependency for isolated PostgreSQL migration/RLS tests;
it is not imported or bundled into the mobile app.

## Backend configuration

The catalog migration and import are applied to the same dedicated SmartBasket
project. See [catalog implementation, import commands, and verification](docs/PRODUCT-CATALOG.md)
for the complete data mapping, 750-product breakdown, license attribution, and limitations.
Catalog reads work with the existing public app credentials; the app has no catalog write access.

The dedicated SmartBasket project (`oepajinqjkcqqyddpgne`) is configured locally and in GitHub Actions. Anonymous sign-in, migration, session recovery, cloud upsert/readback, and owner-only RLS passed hosted verification on 2026-09-06.

See [Phase 2A setup and verification](docs/PHASE-2A.md) for migration, anonymous
authentication, ownership checks, limitations, and the complete testing checklist.
Copy `.env.example` to `.env` and supply a **dedicated SmartBasket** project:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

The legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a fallback. Never use a secret or
service-role key in the app. Restart Metro after changing configuration.

Without credentials, preferences are saved locally only. With credentials, the
same local progress is available and pending completions can be uploaded using
Retry cloud sync. No email/password screen is required.

## Android APK workflow

See [existing Android build documentation](docs/ANDROID-BUILD.md).
The repository, Expo configuration, version code, build/signing scripts, and
artifact workflow are retained. The APK workflow additionally reads the public
Supabase values from same-named GitHub Actions **repository variables**. If those
variables are empty, the APK runs in local-only mode. Adding variables does not
change an APK already built; build another APK to embed them.

## Known limits

- Anonymous cloud identity is tied to the installation/session. Reinstalling,
  clearing app data, or losing the session can lose access to the remote row.
  Permanent accounts and cross-device recovery are not part of this phase.
- Cloud retry is explicit; background synchronization and conflict merging are
  not implemented. Unsynced local completions take priority over cloud reads.
- Budget is the **total for the selected planning period and whole household**.
  The requested `weekly_budget_eur` column name is retained and documented.
- Automatic protein is calculated in the basket engine from the saved goal;
  manual targets remain unchanged. Always check actual product labels.
- Synthetic development estimates cover products with sufficient package data.
  They are not retailer offers. Meal package optimization leaves unknown quantities unresolved.
- The inherited SDK 54 dependency tree has 25 npm audit entries (16 moderate,
  9 high). No force upgrade or untested transitive overrides were introduced.

[Supabase anonymous authentication](https://supabase.com/docs/guides/auth/auth-anonymous)
explains the session identity and its recovery limitations.

## Phase 3B meal-based baskets

New generation uses 24 curated meals, review/replacement, ingredient aggregation and package optimization. See [the original implementation report](docs/MEAL-BASKETS.md).

## Phase 3C ingredient matching

Canonical English/German ingredient mappings, conservative package normalization and separate dietary confidence now resolve all 13 ingredients in the three-day example. The catalog contains 784 products; 17 of 23 ingredient concepts have an eligible package. Read [the current matching report](docs/INGREDIENT-MATCHING.md) for safety policy, remaining gaps and verification. Run `npm run matching:verify` for read-only live diagnostics. Unknown lifestyle flags remain unverified and selected allergies retain strict evidence requirements.

## MVP price estimates

410 of 784 products now have synthetic package estimates; the one-person three-day regression basket totals an estimated €38.76. Read [pricing assumptions, coverage and validation](docs/PRICE-ESTIMATES.md). Run `npm run prices:prepare` to prepare a missing-price backfill and `npm run prices:verify` for read-only hosted verification. Unknown quantities remain unpriced, and missing ingredient costs are separately excluded from selected-basket estimates.
