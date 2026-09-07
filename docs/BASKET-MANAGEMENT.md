# Saved basket management

Basket list now offers Rename basket and Delete basket. Names are trimmed and must contain 1–120 characters. Deletion requires an explicit in-screen confirmation that the associated saved meal plan will also be removed. Cancel performs no mutation.

Local changes are durably recorded before remote writes. Renames remain visible offline; deletes clear stored snapshots and retain only an ID tombstone, preventing stale open screens from saving the deleted basket again. Pending operations retry on list load/reload. Successfully synchronized deletions are acknowledged so they do not make later offline loads look like pending failures. User-scoped keys and session verification keep owners isolated. Operations and list caching are serialized. Cloud listing fetches all pages so another device's deletions can safely remove stale synced copies, without confusing a 50-row limit with a deletion.

Migration `20260907134938_basket_management.sql` is applied to SmartBasket. Owner RLS permits updating only the name column and deleting owned baskets/plans. Security-invoker RPCs validate ownership and name length. Deletion is atomic: basket items cascade, and the now-unreferenced owned meal plan is deleted with its meal items and participant snapshots. Personal profiles, preferences and products remain untouched. Repeat deletion is idempotent. Nutrition/package snapshots remain immutable.

Validation: 79 tests pass, plus TypeScript and lint. Added coverage for offline rename/delete/restart, stale-save rejection, cross-device removal, failed local writes, foreign-owner operations, name validation, snapshot update denial and atomic deletion cascades. Hosted functions confirmed installed with security-invoker behavior. Browser confirmation UI inspected and cancelled without changing the user's existing baskets.

Security advisor: owner-scoped anonymous access is intentional for guest accounts; existing [leaked-password protection advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains unchanged. No new APK was generated; Android workflow unchanged.

Limitations: offline changes reach other devices only after reconnecting and loading the list. Simultaneous renames use the last successful server write. Deleted snapshots cannot be restored through the app; the local tombstone contains only the basket ID and acknowledgement.
