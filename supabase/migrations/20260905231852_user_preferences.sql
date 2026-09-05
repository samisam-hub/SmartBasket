-- One private preference row per Supabase authenticated identity (including anonymous users).
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  household_size smallint not null check (household_size between 1 and 10),
  planning_days smallint not null check (planning_days in (3, 5, 7, 14)),
  daily_calories integer not null check (daily_calories between 1000 and 5000),
  primary_goal text not null check (primary_goal in ('maintain','lose_weight','build_muscle','high_protein','balanced')),
  protein_mode text not null check (protein_mode in ('automatic','manual')),
  protein_target_grams integer,
  dietary_preferences text[] not null default array['none']::text[],
  allergens text[] not null default '{}'::text[],
  budget_enabled boolean not null default true,
  weekly_budget_eur numeric(7,2),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protein_target_matches_mode check (
    (protein_mode = 'automatic' and protein_target_grams is null)
    or (protein_mode = 'manual' and protein_target_grams is not null and protein_target_grams between 1 and 500)
  ),
  constraint budget_matches_mode check (
    (not budget_enabled and weekly_budget_eur is null)
    or (budget_enabled and weekly_budget_eur is not null and weekly_budget_eur > 0 and weekly_budget_eur <= 10000)
  ),
  constraint valid_diets check (
    cardinality(dietary_preferences) between 1 and 6
    and array_position(dietary_preferences, null) is null
    and dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free']::text[]
    and (not ('none' = any(dietary_preferences)) or cardinality(dietary_preferences) = 1)
    and (('vegan' = any(dietary_preferences))::int + ('vegetarian' = any(dietary_preferences))::int + ('pescatarian' = any(dietary_preferences))::int <= 1)
  ),
  constraint valid_allergens check (
    cardinality(allergens) <= 9 and array_position(allergens, null) is null
    and allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame']::text[]
  )
);
comment on column public.user_preferences.weekly_budget_eur is
  'Total EUR budget for the selected planning_days and whole household; legacy name, not a normalized weekly amount.';
comment on column public.user_preferences.daily_calories is 'Daily calorie target per person.';

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;

create policy preferences_select_own on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy preferences_insert_own on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy preferences_update_own on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- No delete grant/policy. The unique user_id constraint also indexes ownership lookups.

create function public.smartbasket_preferences_timestamps()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.smartbasket_preferences_timestamps() from public, anon;
create trigger preferences_timestamps before insert or update on public.user_preferences
  for each row execute function public.smartbasket_preferences_timestamps();
