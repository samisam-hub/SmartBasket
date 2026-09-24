-- Adds the "diabetes" dietary preference to every table that stores dietary_preferences.
-- The allow-list checks are rebuilt; the pattern-exclusivity checks ("none" alone, and
-- vegan/vegetarian/pescatarian being alternatives) stay as they are, because diabetes is
-- an additional restriction that combines with any pattern.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.user_preferences'::regclass, 'public.profiles'::regclass, 'public.plan_participants'::regclass)
      and pg_get_constraintdef(oid) like '%dietary_preferences%'
      and pg_get_constraintdef(oid) like '%gluten_free%'
  loop
    execute format('alter table %s drop constraint %I', c.table_name, c.conname);
  end loop;
end $$;

alter table public.user_preferences add constraint valid_diets check (
  cardinality(dietary_preferences) between 1 and 7
  and array_position(dietary_preferences, null) is null
  and dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free','diabetes']::text[]
  and (not ('none' = any(dietary_preferences)) or cardinality(dietary_preferences) = 1)
  and (('vegan' = any(dietary_preferences))::int + ('vegetarian' = any(dietary_preferences))::int + ('pescatarian' = any(dietary_preferences))::int <= 1)
);

alter table public.profiles add constraint profiles_valid_diets check (
  cardinality(dietary_preferences) > 0
  and array_position(dietary_preferences, null) is null
  and dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free','diabetes']::text[]
);

alter table public.plan_participants add constraint participants_valid_diets check (
  dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free','diabetes']::text[]
);

comment on column public.user_preferences.dietary_preferences is
  'Dietary preferences. "diabetes" is a shopping filter on declared sugars, not a medical recommendation.';
