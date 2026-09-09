# Checkout and pantry

Checkout records a purchase, not payment or a retailer order. Prices remain catalog estimates. A purchase stores the complete basket snapshot and timestamp independently of basket deletion.

`services/pantry-domain.ts` reserves planned consumption and keeps only unreserved package leftovers. Extra products enter stock in full. Later basket matching uses compatible stock first, FIFO by purchase date, retaining dietary/allergen checks and g/ml boundaries. Previewing a plan does not consume inventory. Meal selection itself is unchanged.

`services/pantry.ts` supports per-owner cloud storage and a device-only journal for sessions without an owner. Cloud checkout requires connectivity. The SQL transaction locks the owner's pantry, checks its version and basket snapshot, and records each basket once. Purchased baskets cannot be edited; a new plan is needed. Deleting a basket does not reverse its purchase or restore reserved stock.

The Pantry screen shows available quantities and purchase snapshots. Used/discarded stock can be removed. Expiry, actual weighed quantities, receipt prices, partial stock adjustments, purchase reversal and retailer checkout are not implemented. Stock reflects the existing package estimates; it is not a measured inventory. Reserved quantities are considered committed to their meal plan, not confirmed eaten.

Checks include pure quantity/preview tests, PostgreSQL transaction/idempotency/owner-isolation tests, basket persistence, navigation and screen tests. Local preview checkout review and empty pantry were inspected without purchasing the user's basket.
