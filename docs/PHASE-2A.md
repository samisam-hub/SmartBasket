# Phase 2A: setup and verification

## Status

The dedicated **SmartBasket** Supabase project is provisioned in the samisam
organization (eu-west-1), reference `oepajinqjkcqqyddpgne`. The quoted $10/month
cost was approved. The migration is applied and Supabase's security advisor
reports no findings. Local .env and GitHub public build variables are configured.
Anonymous sign-ins still need to be enabled in the dashboard; account sign-in
is pending. Hosted round-trip verification will follow that configuration.

## Database and identity

Migration: `supabase/migrations/20260905231852_user_preferences.sql`.

`user_preferences` has a UUID primary key, a unique indexed `user_id` referencing
`auth.users`, bounded numeric values, constrained text choices, PostgreSQL text
arrays for diet/allergens, completion status, and server-maintained timestamps.
Arrays suit these small closed sets without adding lookup/join tables. The
budget is a total for the selected 3/5/7/14-day planning period, not a weekly
normalization. Protein is null in automatic mode; budget is null when unlimited.

RLS is enabled. `authenticated` can SELECT, INSERT and UPDATE only where
`(select auth.uid()) = user_id`. UPDATE has both USING and WITH CHECK. The `anon`
role has no table privileges. There is no client delete grant/policy. Anonymous
sign-in creates a real Supabase user with the authenticated role; it does not
mean publicly writable data. Auth metadata is never used for authorization.

The client uses AsyncStorage for the Supabase session, a project-scoped auth
storage key, and a single root AppState listener for foreground refresh, with
cleanup. Session creation is deduplicated. Existing sessions are reused.
Network requests are bounded to 12 seconds. Invalid configuration, authentication
errors, RLS failures, and missing tables surface as recoverable cloud failures.

Repository upsert uses the unique `user_id` and returns the stored row. Ownership
is never hard-coded. If a local row belongs to a different session, upload is
rejected rather than silently moving it to another user.

## Provision the dedicated backend

1. Create/select the dedicated SmartBasket project; do not reuse Health Twin.
2. Apply the migration using Supabase migration tooling or the SQL editor.
3. Enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**.
4. Copy the project URL and a publishable key to `.env`. Restart Expo.
5. Use the client tests below to verify anonymous sign-in and persistence.
6. Review Supabase's anonymous sign-in abuse controls before public distribution.
   CAPTCHA requires additional UI and is not implemented in this native MVP.

To use the existing APK workflow with the backend, set these GitHub Actions
repository **variables** (public client values, not signing secrets):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Optional legacy fallback `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The only workflow modification is mapping these variables into the build job.
Signing secrets, Gradle invocation, prebuild, package identity, version numbering,
permissions, pinned Actions, and artifact upload stay as before.

## Store and durability

`PreferenceStore` is independent of React and uses an injected local storage and
remote repository. React reads one stable external-store snapshot through the
provider. AsyncStorage key `smartbasket.preferences.v1` holds a versioned envelope
with the draft, saved preferences, current step, edit status, and pending-sync bit.

Writes are serialized so rapid changes cannot overwrite newer answers. Saving
requires successful local durability before completing onboarding. Device writes
that fail leave the answers in memory, show an error, and do not claim completion.
Corrupt cached data is reported and preserved rather than overwritten. Save &
exit awaits a successful write. App restarts restore the last durable state.

Home displays the **saved** preferences while a separate editable draft is in
progress. A late cloud response cannot overwrite active edits or a pending local
completion. A failed upload keeps `pendingSync=true`; reopening the app preserves
that status. Retry cloud sync resubmits the saved completion using an idempotent
upsert. It does not upload unreviewed draft edits.

Local-only drafts remain available after adding Supabase credentials. A local-only
saved completion has null IDs until the server acknowledges a real user and row.
Synced rows have server IDs and timestamps. Local fallback is visibly labeled.

## Routes

The validated dynamic route `app/onboarding/[step].tsx` serves:

- `/onboarding/welcome`
- `/onboarding/household`
- `/onboarding/goals`
- `/onboarding/diet`
- `/onboarding/allergies`
- `/onboarding/budget`
- `/onboarding/review`

Unknown steps redirect safely to Home. Review edits pass a return-to-review
parameter. The stored step and answers survive back navigation and exit. Android
hardware back follows the same flow as the visible Back button. Native safe areas,
scrolling and keyboard resize behavior are respected.

## Reusable components

`PrimaryButton`, `SecondaryButton`, `TextButton`, `IconButton`, `TextInput`,
`SearchInput`, `NumberStepper`, `SelectionChip`, `PreferenceChip`, `InfoChip`,
`SectionCard`, `InfoCard`, `PreferenceRow`, `ProgressIndicator`, `ScreenHeader`,
`EmptyState`, `ErrorMessage`, `SuccessMessage`, plus `NumberInput`,
`PreferenceSummary`, `PersistenceStatus` and `ProductCard`.

They use the theme's colors, typography, spacing and radii. Interactive controls
provide pressed, selected, disabled and error states where applicable, accessible
labels/states, and at least 48pt touch targets. None are PNG controls.

## Test locally

1. Leave `.env` absent; `npm start`, then open in SDK 54 Expo Go.
2. Tap Create my basket and Get started. Choose 3 people and 14 days.
3. Enter an invalid calorie value (999 or blank). Continue must show an inline
   error. Enter 2400, select Build muscle and manual protein at 150 g.
4. Go Back; household choices must remain. Continue; calorie/protein choices
   must remain. Test switching to automatic and back.
5. Select Vegan, then Pescatarian: only the latter pattern remains. Add
   Gluten-free. No restriction must clear both.
6. Select Milk and Soy; None must clear them. Review label-checking guidance.
7. Choose a €95.50 budget; test 0 (invalid) and No budget limit.
8. Save & exit partway. Force-close and reopen: Create my basket resumes at the
   saved step with previous answers.
9. Review, edit any section, return to review, then Save preferences.
10. Home must show the actual saved chips and a local-only label.
11. Profile → My preferences changes saved settings. Save & exit during an edit
    leaves Home's previous saved values unchanged. Resume and Save to apply them.
12. Force-close and reopen again; the saved summary must be unchanged.
13. Test all four tabs, catalog search, and the coming-soon generation screen.

## Verify hosted persistence after provisioning

1. Enable anonymous sign-ins and apply the migration, configure `.env`, restart.
2. Complete onboarding or retry an existing local-only completion. Wait for the
   explicit cloud-synced status, not merely navigation to Home.
3. In Supabase, confirm one auth user and exactly one preference row for its ID.
4. Edit settings and save again: the same row ID and created_at must remain,
   values must change and updated_at must advance.
5. Force-close/reopen: the same anonymous session and preferences must return.
6. Disable network and save changed settings. Home must show local-only status.
   Reopen offline to verify durability. Reconnect and Retry cloud sync; the row
   must update without duplication.
7. With two independent anonymous sessions, verify each can read/insert/update
   only its own row. Attempts to write the other user_id must fail or affect
   zero rows; unauthenticated access and deletes must fail.

Automated tests (`npm test`) cover validation, draft/resume, durable local
completion, isolated edits, write failures, remote retry, stale cloud responses,
and corrupt cache handling. Store tests use in-memory storage and a fake remote
boundary. `tests/database.test.cjs` executes the actual migration in isolated
PGlite PostgreSQL with an auth schema fixture and two generated identities. It
verifies owner-only select/insert/update, denied reassignment, immutable IDs and
creation timestamps, mode/range/diet constraints, and denied anon/delete access.
This is an actual PostgreSQL/RLS test, but not a hosted Supabase/JWT round trip.

Validation results: all 15 tests pass; Expo Doctor passed 18/18; the Android
production export including Hermes bytecode succeeded. The existing Android
emulator did not complete boot, so screen interaction and a newly signed APK
have not been verified during this phase. No GitHub build has been dispatched.

## Architecture found before this phase

The existing repository was a standalone npm app using Expo SDK 54, React Native
0.81.5, React 19.1, strict TypeScript, Expo Router stack/tabs, and native shared
components. It had a lazy environment-based Supabase client but no authentication
or profile persistence. Products were local mock data. GitHub had separate PR
checks and a signed APK workflow using Expo prebuild, Java 17, Gradle, dedicated
keystore secrets, and uploaded APK artifacts. These foundations were retained.

## Files changed or created
- .env.example
- .github/workflows/build-android.yml
- .github/workflows/ci.yml
- .gitignore
- app/_layout.tsx
- app/(tabs)/_layout.tsx
- app/(tabs)/basket.tsx
- app/(tabs)/index.tsx
- app/(tabs)/products.tsx
- app/(tabs)/profile.tsx
- app/basket-setup.tsx
- app/onboarding/[step].tsx
- components/NumberInput.tsx
- components/PersistenceStatus.tsx
- components/PreferenceSummary.tsx
- components/ProductCard.tsx
- components/ui.tsx
- context/PreferencesContext.tsx
- docs/PHASE-2A.md
- hooks/useBasketFlow.ts
- lib/supabase.ts
- lib/theme.ts
- package-lock.json
- package.json
- README.md
- services/preference-domain.ts
- services/preference-store.ts
- services/preferences-repository.ts
- supabase/migrations/20260905231852_user_preferences.sql
- tests/database.test.cjs
- tests/preferences.test.cjs
- tests/register.cjs
- types/preferences.ts

Hosted verification: `node --env-file=.env scripts/verify-backend.cjs`. This explicitly creates two disposable anonymous users and records only their IDs in `.expo/backend-verification.json` for scoped cleanup. It is not part of the default test command.
