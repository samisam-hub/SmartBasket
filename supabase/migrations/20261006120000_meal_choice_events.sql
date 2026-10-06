-- What the household decided on the choose-a-meal screen. Insert only, owner-private, and nothing
-- reads it yet: it is recorded from the first version so later suggestions have something to learn
-- from. No basket, plan or preference depends on a row here.
create table public.meal_choice_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  plan_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast','lunch','dinner','snack')),
  -- The meals that were on screen when the decision was made, at most one card set per round.
  shown_meal_ids text[] not null check (cardinality(shown_meal_ids) between 0 and 8
    and array_position(shown_meal_ids, null) is null),
  action text not null check (action in ('chosen','shuffled','skipped','heat_and_eat','ready_to_eat','eat_out','copied_day')),
  chosen_meal_id text check (length(chosen_meal_id) between 1 and 100),
  -- How often "show two others" was pressed before this decision.
  round smallint not null default 0 check (round between 0 and 50),
  check ((action = 'chosen') = (chosen_meal_id is not null))
);
create index meal_choice_events_owner_idx on public.meal_choice_events(user_id, created_at desc);
alter table public.meal_choice_events enable row level security;
revoke all on public.meal_choice_events from public, anon, authenticated;
grant select, insert on public.meal_choice_events to authenticated;
grant all on public.meal_choice_events to service_role;
create policy meal_choice_events_read_own on public.meal_choice_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy meal_choice_events_insert_own on public.meal_choice_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
