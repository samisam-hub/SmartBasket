# Diabetes-friendly dietary preference

"Diabetes-friendly" is now selectable wherever dietary preferences are chosen: the onboarding diet step, the personal profile, and per-participant plan setup. It is an additional restriction, so it combines with any pattern (vegetarian, vegan, pescatarian) and with lactose-free and gluten-free. Only vegetarian, vegan and pescatarian remain mutually exclusive.

The preference is a shopping filter, not medical advice, a treatment plan or a suitability claim for any individual. The app says so on the diet step and in the profile whenever the option is selected.

## Product rule

Products are filtered on their *declared* sugars, against the UK FSA front-of-pack "high sugars" thresholds:

| Declared basis | Rejected above |
| --- | ---: |
| per 100 g | 22.5 g sugars |
| per 100 ml | 11.25 g sugars |

An undeclared sugar value is never read as a low one. Discovery, the catalog query and the basket generator all exclude products without a declared value (`sugar_content_unknown`); ingredient matching for meal baskets keeps the existing "uncertainty is a warning" policy and reports the missing sugar declaration as a basket warning instead of silently accepting the SKU. Allergy handling is unchanged and stays strict.

## Meal rule

Curated ingredients carry the `diabetes` tag unless they are above the same sugar threshold as sold; dark chocolate and teriyaki marinade are the two current exclusions. A curated meal keeps the tag only when every ingredient carries it *and* the base serving stays inside common carbohydrate-counting portions: 75 g carbohydrates for breakfast, lunch and dinner, 30 g for a snack. 23 of the 32 curated meals qualify, covering every slot for diabetes alone and combined with vegan, vegetarian, pescatarian, lactose-free and gluten-free selections.

## Storage

Migration `20260913090000_diabetes_dietary_preference.sql` rebuilds the dietary allow-lists on `user_preferences`, `profiles` and `plan_participants` to include `diabetes` (and widens the preference cardinality to 7). The "none" exclusivity and the vegan/vegetarian/pescatarian exclusivity checks are unchanged. Existing rows stay valid.
