# SmartBasket · Step 1

A standalone React Native mobile app built with Expo SDK 54, React 19.1,
TypeScript, and Expo Router. The app runs with local sample data and no account
or database. This folder is independent of Health Twin.

## GitHub und installierbare Android-APK

Repository: https://github.com/samisam-hub/SmartBasket (privat).

Build-Anleitung, Workflow-Dateien, Signierungs-Secrets und APK-Download:
[Android-Build-Dokumentation](docs/ANDROID-BUILD.md).

## Run on your Android phone

Use Node.js 22.13+ (Node 24 LTS recommended) and npm. From PowerShell:

```powershell
cd "C:\Users\Samaana Zakharova\Desktop\SmartBasket"
npm ci
npm start
```

Open Expo Go on Android and scan the terminal QR code. Keep your computer and
phone on the same Wi-Fi network. Allow Node.js through Windows Firewall on your
private network if necessary. No Android Studio, custom native build, or EAS
account is required for these screens.

Use an Expo Go version supporting **SDK 54**. If Expo Go reports an SDK mismatch,
install the matching Android version from https://expo.dev/go?sdkVersion=54&platform=android&device=true.
SDK 54 was chosen to match Health Twin and its Expo Go workflow, rather than
adopting the latest native runtime in this foundation.

If LAN connectivity is unavailable, an optional tunnel can be started with
`npx expo start --go --tunnel` (Expo may prompt to install its ngrok helper).

## What works

- Home, Products, Basket, and Profile bottom tabs.
- Home and Basket CTAs open a basket setup preview with back navigation.
- Ten grocery cards with food placeholders, package price estimates, nutrition,
  labels, and allergen information.
- Case-insensitive search across name, brand, category, and dietary labels.
  Multiple words narrow results; clearing the search restores the catalog.
- No-results and empty-basket states.
- Profile and basket setup placeholders clearly identify features coming later.

Mock brands, prices, labels, and nutrition are illustrative. Food placeholders
are native emoji, so the catalog works offline and artwork varies by device.
`imageUrl` is ready for future remote images and falls back on load failure.
Prices are per package; nutrition is per 100 g. Unknown future nutrition and
dietary values can be null. Lactose-free does not imply milk-allergen-free.

## Optional Supabase configuration

Nothing needs to be configured to use Step 1. When ready, create a **separate
SmartBasket Supabase project**, copy `.env.example` to `.env`, and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is also supported as a legacy fallback when no
publishable key is supplied. Never put a secret or service-role key in Expo
public variables. Restart Expo after changing the environment.

`lib/supabase.ts` exports `supabaseConfigured` and `getSupabaseClient()`. The getter
returns null when unconfigured and lazily creates a singleton when configured.
Native session storage uses AsyncStorage with a SmartBasket-specific storage
key. URL session detection and automatic token refresh are
disabled for this unauthenticated foundation. When adding auth, attach a single
foreground/background refresh listener with cleanup in the root lifecycle.

No Supabase project, tables, migrations, queries, credentials, or authentication
were created. Future services can use the client behind the existing UI boundary.

## Architecture and complete source file inventory

```text
SmartBasket/
  app/
    _layout.tsx                 Root stack and safe-area provider
    basket-setup.tsx            Read-only example preferences
    (tabs)/
      _layout.tsx              Four bottom tabs
      index.tsx                Home
      products.tsx             Searchable catalog
      basket.tsx               Empty basket
      profile.tsx              Future settings
  components/
    ui.tsx                     Screen, Button, Chips, PreferenceRow
    ProductCard.tsx             Reusable grocery card and image fallback
  data/products.ts             Ten typed local sample products
  hooks/useProducts.ts         Search state and derived results
  lib/
    supabase.ts                Optional lazy native client
    theme.ts                   Shared colors and typography
  services/products.ts         Catalog search independent of UI
  types/product.ts             Provider-neutral normalized product model
  .env.example
  .gitignore
  app.json
  eslint.config.js
  expo-env.d.ts
  package.json
  package-lock.json
  tsconfig.json
  README.md
```

All source files above are new. Generated `node_modules`, `.expo`, and `dist`
folders are ignored. No files in the existing mobile projects were changed.

## Patterns inspected and reused

The active Health Twin app is at `../Execution-Spec-Builder/artifacts/mobile`.
It uses Expo SDK 54, React Native 0.81.5, Expo Router, strict TypeScript, `@/`
aliases, reusable native components, theme hooks, Supabase, and AsyncStorage.
Its root wraps health, localization, challenge, and forest providers and guards
routes with authentication and onboarding state. Android uses classic Router
tabs, while supported iOS devices use native tabs. Supabase public configuration
comes through Expo environment variables.

SmartBasket reuses the general SDK family, stack/tab routing, strict types,
aliases, shared styles/components, and native Supabase storage pattern.

Deliberately omitted: the pnpm monorepo and workspace API dependencies,
Replit-specific commands, health services, notifications, auth/onboarding guards,
provider stack, native glass effects, animations, custom fonts, and analytics.
They do not serve Step 1 and some require a custom native build. The older
`../digital-twin-app` was also inspected; its mixed dependency versions were
not used as a template. No files were blindly copied.

React DOM is pinned to React's version to satisfy Expo Router's transitive peers.
This remains a native mobile app; it has no Next.js app or web product surface.

## Validation

Completed: TypeScript and ESLint (zero errors/warnings), Expo dependency version
check, Expo Doctor (18/18), Android production export including Hermes bytecode,
and Expo Go LAN server startup. Search smoke checks covered empty/whitespace,
case-insensitive, multiword, brand, and unmatched queries. Supabase initialization
was checked with missing configuration and both public key formats using a
storage stub and no database requests. A physical phone was not available for
interactive testing.

```powershell
npm run typecheck
npm run lint
npx expo install --check
npm run doctor
npm run export:android
```

Android bundle export verifies native module resolution but does not replace a
physical-device check. On your phone: open each tab, search `VEGAN`, search
`high protein`, try an unmatched query, clear search, and open the setup preview
from both Home and Basket. Check Android back navigation and keyboard behavior.

Dependency audit at implementation: `npm audit --omit=dev` reports 25 affected
dependency entries (16 moderate, 9 high), including SDK 54's Metro/image-size,
PostCSS, navigation URI decoding, and Xcode/uuid dependency chains. npm proposes
major Expo changes for several fixes. The SDK was not force-upgraded or given
untested transitive overrides. Reassess these dependencies before production.

Step 2 is intentionally not implemented: no optimization, real catalog provider,
product editing, saved baskets, recipes, payments, retailer integration, AI,
or profile persistence.

References: [Expo Go SDK compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/),
[Supabase React Native client guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native).
