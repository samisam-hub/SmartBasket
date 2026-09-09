# Meals and daily snacks

The catalog now offers 31 choices: nine breakfasts, nineteen main meals and three snacks. New choices have eight locally bundled images (including the replacement chicken-ham toast). The former tomato toast remains readable in saved snapshots, but is no longer offered for new plans. Image provenance stays in documentation; the user requested removal of the visible AI caption. The new image prompts and paths are in comfort-meal-image-prompts.json.

New base portions use curated development estimates, not claims about the exact purchased SKU:

| Meal | Approximate kcal per base serving |
| --- | ---: |
| Egg and chicken-ham toast | 344 |
| Smoked salmon and soft egg toast | 397 |
| Steak, potatoes and spinach | 569 |
| Chicken Stroganoff with wheat noodles and soy cooking cream | 632 |
| Steak, potatoes and chanterelle cream sauce | 604 |
| Apple and berries | 118 |
| Greek yogurt and berries | 140 |
| Banana and dairy-free dark chocolate | 113 |

The smoked salmon option is specifically smoked salmon, not an interchangeable gravlax SKU. Creamy meals use soy cooking cream; soy remains an allergen, and Greek yogurt snacks retain milk restrictions. Raw weights are used for meat and dry weights for noodles. Black pepper (0.2 g) and fresh parsley or dill (3 g) are counted in savory recipes. Existing images can represent those recipes with or without the small seasoning garnish; core ingredient matching remains required. No products have been relabeled as allergen-free.

Generation reserves a normal small snack before allocating the three main meals. Dinner portions can use the remaining daily calories, within 0.5–1.5 base servings per person. Replacement uses the chosen meal's base portion and adjusts the other main meals that day within the same limits. The daily summary includes the snack and explicitly shows an over-target result if portion bounds prevent exact alignment. Calorie targets and restrictions remain those chosen by the user; no medical suitability claim is made.

New plans carry snacksIncluded=true. Old three-slot plans remain valid. A migration allows snack in meal_plan_items without changing RLS, grants or ownership rules. Existing snapshots are not rewritten. Existing RPC saves and local persistence now cover four daily slots.

The product catalog still lacks some new ingredient SKUs, particularly chicken ham, mushrooms, cooking cream and herbs. Narrow matching prevents raw salmon being used for smoked salmon, or braising beef/jerky for steak. Missing catalog matches remain explicit rather than inventing products, prices or nutrition coverage. The meal preview can still offer the recipes before full package coverage is available.
