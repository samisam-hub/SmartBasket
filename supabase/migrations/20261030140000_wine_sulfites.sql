-- Support sulfites declared by wine recipes and imported products.
-- Preserve existing values and all RLS/ownership rules.
alter table public.user_preferences drop constraint valid_allergens;
alter table public.user_preferences add constraint valid_allergens check (
 cardinality(allergens) <= 12 and array_position(allergens, null) is null
 and allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame','mustard','celery','sulfites']::text[]
);
alter table public.profiles drop constraint profiles_allergens_check;
alter table public.profiles add constraint profiles_allergens_check check (
 array_position(allergens, null) is null
 and allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame','mustard','celery','sulfites']::text[]
);
alter table public.plan_participants drop constraint plan_participants_allergens_check;
alter table public.plan_participants add constraint plan_participants_allergens_check check (
 array_position(allergens, null) is null
 and allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame','mustard','celery','sulfites']::text[]
);
