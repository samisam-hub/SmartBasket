-- Optional verified preparation metadata. Existing products remain unknown, never auto-classified by name.
alter table public.products add column ready_meal jsonb;
alter table public.products add constraint products_ready_meal_check check (
  ready_meal is null or coalesce((
    jsonb_typeof(ready_meal) = 'object'
    and ready_meal->>'category' in ('salad','lasagne','pasta','asian','pizza')
    and jsonb_typeof(ready_meal->'modes') = 'array'
    and ready_meal->'modes' <> '[]'::jsonb
    and ready_meal->'modes' <@ '["ready_to_eat","heat_and_eat"]'::jsonb
    and jsonb_typeof(ready_meal->'slots') = 'array'
    and ready_meal->'slots' <> '[]'::jsonb
    and ready_meal->'slots' <@ '["breakfast","lunch","dinner","snack"]'::jsonb
    and jsonb_typeof(ready_meal->'portionGrams') = 'number'
    and (ready_meal->>'portionGrams')::numeric > 0
    and (ready_meal->>'portionGrams')::numeric <= 2000
    and jsonb_typeof(ready_meal->'available') = 'boolean'
    and jsonb_typeof(ready_meal->'evidence') = 'string'
    and length(trim(ready_meal->>'evidence')) > 0
  ), false)
);
create index products_ready_meal_category_idx on public.products ((ready_meal->>'category')) where ready_meal is not null;
comment on column public.products.ready_meal is 'Verified meal category, preparation modes, slots, portionGrams, catalog availability and evidence. Null = unknown. No retailer stock claim.';
-- Existing catalog SELECT-only grants/RLS apply. Meal choices and matches persist in existing JSON snapshots.
