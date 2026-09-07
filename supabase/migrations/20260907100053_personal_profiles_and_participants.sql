create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 sex text check(sex in ('female','male','prefer_not_to_say','other')), age integer check(age between 1 and 120),
 height_cm numeric check(height_cm between 50 and 250), weight_kg numeric check(weight_kg between 10 and 500),
 primary_nutrition_goal text not null default 'balanced' check(primary_nutrition_goal in ('maintain','lose_weight','build_muscle','high_protein','balanced','improve_habits')),
 activity_level text check(activity_level in ('low','light','moderate','high','very_high')),
 default_daily_calories integer check(default_daily_calories between 1000 and 5000),
 protein_mode text not null default 'automatic' check(protein_mode in ('automatic','manual')),
 default_protein_target_grams integer check(default_protein_target_grams between 1 and 500),
 dietary_preferences text[] not null default '{none}' check(cardinality(dietary_preferences)>0 and dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free']::text[]),
 allergens text[] not null default '{}' check(allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame']::text[]),
 intolerances text[] not null default '{}' check(intolerances <@ array['lactose','gluten']::text[]),
 onboarding_completed boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(protein_mode<>'manual' or default_protein_target_grams is not null),
 check(not ('none'=any(dietary_preferences)) or cardinality(dietary_preferences)=1),
 check(not ('vegan'=any(dietary_preferences) and ('vegetarian'=any(dietary_preferences) or 'pescatarian'=any(dietary_preferences)))),
 check(not ('vegetarian'=any(dietary_preferences) and 'pescatarian'=any(dietary_preferences)))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profiles_read_own on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create function public.profile_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.id=old.id;new.created_at=old.created_at;new.updated_at=now();return new;end;$$;
revoke all on function public.profile_updated_at() from public;
create trigger profile_updated before update on public.profiles for each row execute function public.profile_updated_at();

create table public.plan_participants (
 id uuid primary key default gen_random_uuid(),
 meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
 participant_key text not null check(length(participant_key) between 1 and 100),
 name text not null check(length(btrim(name)) between 1 and 80),age integer check(age between 1 and 120),
 sex text check(sex in ('female','male','prefer_not_to_say','other')),
 daily_calories integer not null check(daily_calories between 1000 and 5000),protein_target integer not null check(protein_target between 1 and 500),
 dietary_preferences text[] not null,allergens text[] not null,intolerances text[] not null,
 is_current_user boolean not null, participant_snapshot jsonb not null,
 created_at timestamptz not null default now(),unique(meal_plan_id,participant_key),
 check(dietary_preferences <@ array['none','vegetarian','vegan','pescatarian','lactose_free','gluten_free']::text[]),
 check(allergens <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame']::text[]),
 check(intolerances <@ array['lactose','gluten']::text[])
);
create unique index plan_one_current_user on public.plan_participants(meal_plan_id) where is_current_user;
alter table public.plan_participants enable row level security;
revoke all on public.plan_participants from public,anon,authenticated;
grant select,insert on public.plan_participants to authenticated;grant all on public.plan_participants to service_role;
create policy participants_read_own on public.plan_participants for select to authenticated using(exists(select 1 from public.meal_plans p where p.id=meal_plan_id and p.user_id=(select auth.uid())));
create policy participants_insert_own on public.plan_participants for insert to authenticated with check(exists(select 1 from public.meal_plans p where p.id=meal_plan_id and p.user_id=(select auth.uid()) and p.plan_snapshot->'participants' @> jsonb_build_array(participant_snapshot)));
create function public.snapshot_plan_participants() returns trigger language plpgsql security invoker set search_path='' as $$
declare person jsonb;
begin
 if new.plan_snapshot ? 'participants' then
  if jsonb_typeof(new.plan_snapshot->'participants') is distinct from 'array' or jsonb_array_length(new.plan_snapshot->'participants')<>new.household_size then raise exception 'Participant count must match household';end if;
  for person in select value from jsonb_array_elements(new.plan_snapshot->'participants') loop
   insert into public.plan_participants(meal_plan_id,participant_key,name,age,sex,daily_calories,protein_target,dietary_preferences,allergens,intolerances,is_current_user,participant_snapshot)
   values(new.id,person->>'id',person->>'name',(person->>'age')::integer,person->>'sex',(person->>'dailyCalories')::integer,(person->>'proteinTarget')::integer,
     array(select jsonb_array_elements_text(person->'dietaryPreferences')),array(select jsonb_array_elements_text(person->'allergens')),array(select jsonb_array_elements_text(person->'intolerances')),(person->>'isCurrentUser')::boolean,person);
  end loop;
 end if;return new;
end;$$;
revoke all on function public.snapshot_plan_participants() from public;
create trigger meal_plan_participants after insert on public.meal_plans for each row execute function public.snapshot_plan_participants();
comment on table public.profiles is 'Long-term personal defaults. Email and credentials remain in auth.users. Plan overrides never update this table.';
comment on table public.plan_participants is 'Immutable participant snapshots saved atomically with the parent meal plan and basket.';
