create table public.baskets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (length(request_key) between 1 and 100),
  name text not null check (length(name) between 1 and 120),
  planning_days integer not null check (planning_days in (3,5,7,14)),
  household_size integer not null check (household_size between 1 and 10),
  target_calories numeric not null check (target_calories > 0 and target_calories <= 700000),
  target_protein numeric not null check (target_protein > 0 and target_protein <= 70000),
  estimated_total_price numeric check (estimated_total_price >= 0 and estimated_total_price < 10000000),
  generation_score numeric not null check (generation_score between 0 and 100),
  status text not null check (status in ('generated','partial')),
  preferences_snapshot jsonb not null check (jsonb_typeof(preferences_snapshot) = 'object'),
  result_summary jsonb not null check (jsonb_typeof(result_summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index baskets_owner_created_idx on public.baskets (user_id, created_at desc, id);
create table public.basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position integer not null check (position between 0 and 23),
  package_count integer not null check (package_count between 1 and 1000),
  total_weight numeric check (total_weight > 0 and total_weight < 100000000),
  total_volume numeric check (total_volume > 0 and total_volume < 100000000),
  estimated_price numeric check (estimated_price >= 0 and estimated_price < 10000000),
  total_calories numeric not null check (total_calories >= 0 and total_calories < 10000000),
  total_protein numeric not null check (total_protein >= 0 and total_protein < 1000000),
  reason_selected jsonb not null check (jsonb_typeof(reason_selected) = 'array'),
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object'),
  unique (basket_id, position),
  unique (basket_id, product_id),
  check ((total_weight is not null) <> (total_volume is not null))
);
create index basket_items_product_idx on public.basket_items(product_id);
alter table public.baskets enable row level security;
alter table public.basket_items enable row level security;
revoke all on public.baskets, public.basket_items from public, anon, authenticated;
grant select, insert on public.baskets, public.basket_items to authenticated;
grant all on public.baskets, public.basket_items to service_role;
create policy baskets_read_own on public.baskets for select to authenticated using ((select auth.uid()) = user_id);
create policy baskets_insert_own on public.baskets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy basket_items_read_own on public.basket_items for select to authenticated using (
  exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = (select auth.uid()))
);
create policy basket_items_insert_own on public.basket_items for insert to authenticated with check (
  exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = (select auth.uid()))
);
-- Append-only V1: no user updates/deletes or ownership reassignment. One atomic save,
-- with an idempotency key so timeout/retry never duplicates a completed basket.
create function public.save_generated_basket(p_request_key text, p_name text, p_preferences jsonb, p_result jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare basket_id uuid; item jsonb; position integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_result -> 'items') is distinct from 'array' then raise exception 'Items must be an array'; end if;
  if jsonb_array_length(p_result -> 'items') not between 1 and 24 then raise exception 'Invalid basket size'; end if;
  if octet_length(p_result::text) > 1000000 then raise exception 'Basket snapshot is too large'; end if;
  select b.id into basket_id from public.baskets b where b.user_id = auth.uid() and b.request_key = p_request_key;
  if basket_id is not null then return basket_id; end if;
  insert into public.baskets(user_id, request_key, name, planning_days, household_size, target_calories,
    target_protein, estimated_total_price, generation_score, status, preferences_snapshot, result_summary)
  values (auth.uid(), p_request_key, p_name, (p_preferences ->> 'planningDays')::integer,
    (p_preferences ->> 'householdSize')::integer, (p_result ->> 'calorieTarget')::numeric,
    (p_result ->> 'proteinTarget')::numeric, (p_result ->> 'estimatedTotalPrice')::numeric,
    (p_result ->> 'score')::numeric, p_result ->> 'status', p_preferences, p_result - 'items')
  on conflict (user_id, request_key) do nothing returning id into basket_id;
  if basket_id is null then
    select b.id into basket_id from public.baskets b where b.user_id = auth.uid() and b.request_key = p_request_key;
    return basket_id;
  end if;
  for item in select value from jsonb_array_elements(p_result -> 'items') loop
    insert into public.basket_items(basket_id, product_id, position, package_count, total_weight, total_volume,
      estimated_price, total_calories, total_protein, reason_selected, item_snapshot)
    values (basket_id, (item #>> '{product,id}')::uuid, position, (item ->> 'packageCount')::integer,
      (item ->> 'totalWeight')::numeric, (item ->> 'totalVolume')::numeric,
      (item ->> 'estimatedPrice')::numeric, (item ->> 'totalCalories')::numeric,
      (item ->> 'totalProtein')::numeric, item -> 'reasonSelected', item);
    position := position + 1;
  end loop;
  return basket_id;
end;
$$;
revoke all on function public.save_generated_basket(text,text,jsonb,jsonb) from public, anon;
grant execute on function public.save_generated_basket(text,text,jsonb,jsonb) to authenticated;
