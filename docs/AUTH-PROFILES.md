# Phase 4A — authentication, personal profiles and plan participants

Implemented in the existing Expo SDK 54 / React Native app on 7 September 2026. The catalog, meal → ingredient → SKU → package architecture, existing preference onboarding and Android workflow are retained.

## Authentication and guest upgrade

`AuthProvider` restores the existing persisted Supabase session and creates an anonymous Supabase identity only when no session exists. The existing AsyncStorage session, refresh handling and public client configuration remain; PKCE supports email callbacks. Credentials are sent directly to Supabase and are not stored by SmartBasket forms.

The account screen offers email registration, sign-in, password reset and password setting after verification. Registration calls `updateUser({email})` on the current anonymous user, verifies email, then sets the password. It does not call `signUp` to create a second identity. The user ID, preferences, baskets and meal plan foreign keys stay unchanged. Signing into a different existing account opens that account's data and does not merge guest records.

See the [Supabase anonymous upgrade guidance](https://supabase.com/docs/guides/auth/auth-anonymous) and [password auth guidance](https://supabase.com/docs/guides/auth/passwords).

**Backend activation is pending.** The connected project has anonymous sign-in and email confirmation enabled, manual identity linking disabled, no allowed callback URLs, and the built-in development email sender. A browser-required confirmation was requested for manual linking and these exact redirects:

- `smartbasket://auth/callback?mode=register`
- `smartbasket://auth/callback?mode=recovery`
- `http://localhost:8088/auth/callback?mode=register`
- `http://localhost:8088/auth/callback?mode=recovery`

No reply had arrived when this report was written, so these auth access settings were not changed. The sender choice is also pending. Built-in email has development delivery/rate restrictions; custom SMTP needs a configured sender. No real registration/reset emails were sent, and no end-to-end email account conversion is claimed. Open verification links on the initiating device for PKCE; code entry is available when the email template supplies a code. Social providers remain disabled.

## Data responsibilities and migration

Applied `supabase/migrations/20260907100053_personal_profiles_and_participants.sql` to the dedicated SmartBasket project `oepajinqjkcqqyddpgne`.

| Data | Responsibility |
| --- | --- |
| auth.users | Authentication, verified email and credentials. Email is not duplicated in profiles. |
| profiles | One row per auth user: optional name, sex, age, height and weight; goal, activity, optional calories, protein mode/target, diets, allergens, separate lactose/gluten intolerances, completion and timestamps. |
| user_preferences | Existing onboarding and plan setup defaults; retained for compatibility. |
| meal_plans | Immutable specific meal plan snapshot, including participant inputs. |
| plan_participants | Parent-owned participant rows, saved atomically with the plan. |
| baskets / basket_items | Existing generated grocery snapshots and package selection. |

Profiles have a primary-key foreign key to auth.users, server timestamps, immutable ownership and bounded values. Optional values are nullable: age 1–120, height 50–250 cm, weight 10–500 kg; explicit calories 1,000–5,000 and manual protein 1–500 g/day. Existing goal logic supplies automatic protein; no sex, activity or body-size formula is introduced.

Participants have an independent UUID, meal-plan foreign key, stable participant key, name, optional age/sex, explicit calorie/protein targets, individual restrictions, current-user flag and original JSON snapshot. Parent/key uniqueness and at most one current-user row prevent duplicate snapshots. An insert trigger runs inside the existing atomic basket-save transaction. Old plans without participants remain readable.

## Privacy and sessions

RLS is enabled and reviewed for profiles, user_preferences, meal_plans, meal_plan_items, plan_participants, baskets and basket_items. Profiles allow authenticated owners to select, insert and update their own row. Participant access requires ownership through the meal plan; app users cannot update/delete saved participant rows. Existing parent/child owner policies remain intact. Anonymous Supabase users use the authenticated role and can access only their own records; the unauthenticated anon role cannot read personal profiles.

Local profile, preference and plan caches are scoped to the user ID. Legacy data is adopted only by its owner or the first eligible anonymous claimant. Pending drafts and failed uploads survive reopening; Save profile retries cloud sync. Switching identity clears prior screens. Initial session restoration, token refresh and an upgrade retaining the same ID keep the navigator mounted.

The hosted security advisor's anonymous-access notices are expected for owner-private guest functionality. Its existing leaked-password protection warning remains unchanged; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security). Local app storage is not an additional encrypted vault; device/OS access controls still matter.

## Screens and defaults

- Account: create, sign in, verify email, set/reset password; sign out from Profile.
- Personal profile: five short steps — About you, Goals, Diet, Allergies/intolerances, Review — with optional fields, progress, back/edit and durable draft exit.
- Profile tab: guest or signed-in identity, personal details, nutrition goals, diet, allergies/intolerances, existing plan preferences, saved baskets/plans, account, help and about.
- Plan setup: separate person editors, add/remove participants, plan period and budget, then the existing meal review and package flow.
- Saved meal plans: opens plans stored with saved baskets, preserving their original snapshots.

Personal defaults prefill the current user. A 1,700 kcal personal default can become 2,200 kcal in one plan without writing profiles or user_preferences. Other people start with independently editable restrictions and blank targets, rather than inheriting the current user's diet. An in-progress plan resumes its own overrides; “Use my personal defaults” explicitly refreshes the current participant from the latest profile.

The current engine produces one shared menu. It unions all selected allergies/intolerances, applies the strongest selected shared diet (vegan, vegetarian, pescatarian), and sums individual calorie/protein targets exactly. Lactose intolerance remains separate from milk allergy. Gluten intolerance additionally requires affirmative gluten-free SKU evidence; unknown evidence is excluded. Ingredient safety rules remain strict. Individual servings and child-specific target calculations are not implemented; all participants must have explicit supported targets before generation.

## Validation and checks

- 73 automated tests pass, including auth service/session resume/upgrade, local owner isolation, profile creation/edit persistence, slow-save races, defaults versus overrides, exact multi-person totals, diet/allergy propagation and navigation lifecycle.
- PostgreSQL tests execute migrations/RLS with two identities, validate numeric constraints and atomic participant/basket saves, reject unauthorized reads/writes and verify old snapshot compatibility.
- Existing catalog, image fallback, preference onboarding, meal, matching, package, pricing, persistence and navigation regressions pass.
- TypeScript and lint pass after corrections; Expo Doctor: 18/18 checks.
- Android Expo/Hermes export succeeds. This is compilation verification, not an installed APK/device test. The GitHub Android workflow is unchanged; no new APK run was requested for this phase.
- Browser inspection confirms the new guest Profile and optional profile form. Existing user plan preferences remain: 3 days, 2 people, 1,500 kcal, build muscle, lactose-free, no selected allergens and €120 budget. No invented personal details were saved.

Tests use mocked auth operations and an isolated PostgreSQL environment; live email delivery, cold/warm Android email links and account conversion across physical devices remain to be verified after backend activation. React test-renderer emits deprecation/act warnings in existing UI tests; assertions pass.

## Files changed

New screens: app/account.tsx, app/auth/callback.tsx, app/personal-profile.tsx, app/plan-setup.tsx, app/saved-meal-plans.tsx.

New shared code: components/ProfileFields.tsx; context/AuthContext.tsx and ProfileContext.tsx; services/auth-service.ts, profile-domain.ts, profile-repository.ts, profile-store.ts and scope-migration.ts; types/profile.ts.

Updated integration: app/_layout.tsx, app/(tabs)/profile.tsx, app/basket-setup.tsx; components/BasketResult.tsx; context/PreferencesContext.tsx; hooks/useBasketFlow.ts; lib/supabase.ts; services/preferences-repository.ts, basket/nutritionTargets.ts, meals/planner.ts, meals/skuSafety.ts and meals/validation.ts; types/preferences.ts and meal.ts.

Database/tests/docs: migration above; tests/profile-auth.test.cjs, profile-database.test.cjs and auth-navigation.test.cjs; existing tests/basket-ui.test.cjs mock; README.md and this report.

No social login, medical calculations, checkout, payment, retailer account or additional feature phase was added.

## Registration form simplification

Registration now asks for email and password together, with a single Create account button. Supabase still verifies the email before attaching a password to the anonymous identity. The selected password is held only in the auth service's memory, scoped to that guest ID and email; it is never written to local storage, profile data or callback URLs. After verification, the confirmation action (or a warm callback) applies it to the same account. Invalid passwords are rejected before sending an email. Cancellation, sign-in and sign-out discard the pending password; an identity mismatch also discards it.

A reload, closed app or new browser tab loses that memory intentionally. The verification callback then asks the user to re-enter their chosen password. Ordinary subsequent sign-in remains email plus password. Code entry is optional when a template contains a code. The user reports saving manual linking and redirect settings; email delivery remains unverified by automated tests.
