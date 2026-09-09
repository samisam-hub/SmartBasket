# Demo catalog completion — 2026-09-08

Explicitly requested synthetic completion of missing price, nutrition and package data. All 784 products already had estimated prices. Updated 476 existing products: nutrition gaps in 194, package size/unit gaps in 368, quantity labels in 346 (overlapping sets).

Only absent values were filled. Nutrition estimates use the median of existing values for the same category and nutrition basis, falling back to the same basis across the catalog. Generated sugar is capped by carbohydrates. Package estimates use the category/unit median, with 500 g/ml as a demo fallback. These are illustrative values, not manufacturer facts.

Every estimated field has a `smartbasket:demo:<database_field>` entry in product labels. Generated package metadata has source `smartbasket-synthetic-demo-v1`. `known` package status means a numeric demo package size is supplied, not that it has been verified. Product cards, details and basket products show a demo estimate notice. Internal tags are excluded from displayed source labels. Existing prices retain their synthetic pricing metadata.

No ingredient, allergen, dietary, image or manufacturer claims were generated. Saved baskets retain their original snapshots; new plans use the enriched catalog. The prepare script is read-only and writes proposed SQL for review. Audit snapshot, field-level manifest and SQL are under `.expo/demo-completeness` and `.expo/catalog-completeness` on the development machine.
