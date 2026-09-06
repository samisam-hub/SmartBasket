-- Append-only, owner-private meal plans; saved basket snapshots remain backward compatible.
create table public.meal_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_key text not null check(length(request_key) between 1 and 100),
 planning_days integer not null check(planning_days in (3,5,7,14)), household_size integer not null check(household_size between 1 and 10),
 target_calories numeric not null check(target_calories>0 and target_calories<=700000), target_protein numeric not null check(target_protein>0 and target_protein<=70000),
 status text not null check(status='confirmed'), plan_snapshot jsonb not null check(jsonb_typeof(plan_snapshot)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,request_key), unique(id,user_id)
);
create index meal_plans_owner_created_idx on public.meal_plans(user_id,created_at desc);
create table public.meal_plan_items (
 id uuid primary key default gen_random_uuid(), meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
 meal_id text not null, day_index integer not null check(day_index between 0 and 13),
 meal_slot text not null check(meal_slot in ('breakfast','lunch','dinner')), servings numeric not null check(servings>0 and servings<=15),
 item_snapshot jsonb not null check(jsonb_typeof(item_snapshot)='object'), created_at timestamptz not null default now(), unique(meal_plan_id,day_index,meal_slot)
);
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
revoke all on public.meal_plans,public.meal_plan_items from public,anon,authenticated;
grant select,insert on public.meal_plans,public.meal_plan_items to authenticated;
grant all on public.meal_plans,public.meal_plan_items to service_role;
create policy meal_plans_read_own on public.meal_plans for select to authenticated using ((select auth.uid())=user_id);
create policy meal_plans_insert_own on public.meal_plans for insert to authenticated with check ((select auth.uid())=user_id);
create policy meal_plan_items_read_own on public.meal_plan_items for select to authenticated using (exists(select 1 from public.meal_plans p where p.id=meal_plan_id and p.user_id=(select auth.uid())));
create policy meal_plan_items_insert_own on public.meal_plan_items for insert to authenticated with check (exists(select 1 from public.meal_plans p where p.id=meal_plan_id and p.user_id=(select auth.uid()) and day_index<p.planning_days));
alter table public.baskets add column meal_plan_id uuid;
alter table public.baskets add constraint baskets_meal_plan_owner_fk foreign key(meal_plan_id,user_id) references public.meal_plans(id,user_id);
create index baskets_meal_plan_idx on public.baskets(meal_plan_id,user_id);
alter table public.baskets drop constraint baskets_status_check;
alter table public.baskets add constraint baskets_status_check check(status in ('generated','partial','empty'));
alter table public.basket_items drop constraint basket_items_position_check;
alter table public.basket_items add constraint basket_items_position_check check(position between 0 and 63);
alter table public.basket_items
 add column ingredient_key text,
 add column package_size numeric check(package_size>0),
 add column package_unit text check(package_unit in ('g','ml')),
 add column purchased_quantity numeric,
 add column planned_consumption_quantity numeric,
 add column leftover_quantity numeric,
 add column source_meal_ids jsonb,
 add column quantity_adjustment_percent numeric,
 add constraint basket_items_consumption_check check(ingredient_key is null or (
   purchased_quantity is not null and planned_consumption_quantity is not null and leftover_quantity is not null and
   purchased_quantity>=0 and planned_consumption_quantity>=0 and leftover_quantity>=0 and
   abs(purchased_quantity-planned_consumption_quantity-leftover_quantity)<0.01 and
   package_size is not null and package_unit is not null and abs(purchased_quantity-package_count*package_size)<0.01));
create or replace function public.save_generated_basket(p_request_key text, p_name text, p_preferences jsonb, p_result jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare basket_id uuid; item jsonb; position integer := 0; plan_id uuid; plan jsonb; line jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_result -> 'items') is distinct from 'array' then raise exception 'Items must be an array'; end if;
  if jsonb_array_length(p_result -> 'items') not between (case when p_result->>'engineVersion'='2' then 0 else 1 end) and (case when p_result->>'engineVersion'='2' then 64 else 24 end) then raise exception 'Invalid basket size'; end if;
  if octet_length(p_result::text) > 1000000 then raise exception 'Basket snapshot is too large'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_request_key, 0));
  select b.id into basket_id from public.baskets b where b.user_id = auth.uid() and b.request_key = p_request_key;
  if basket_id is not null then return basket_id; end if;
  if p_result->>'engineVersion'='2' then
    plan := p_result->'mealPlan';
    if plan->>'status' is distinct from 'confirmed' or jsonb_typeof(plan->'items') is distinct from 'array' then raise exception 'Confirmed meal plan required'; end if;
    if jsonb_array_length(plan->'items') not between 1 and 42 then raise exception 'Invalid meal plan size'; end if;
    if (plan->>'planningDays')::integer is distinct from (p_preferences->>'planningDays')::integer or (plan->>'householdSize')::integer is distinct from (p_preferences->>'householdSize')::integer then raise exception 'Meal plan/preferences mismatch'; end if;
    insert into public.meal_plans(user_id,request_key,planning_days,household_size,target_calories,target_protein,status,plan_snapshot)
      values(auth.uid(),p_request_key,(plan->>'planningDays')::integer,(plan->>'householdSize')::integer,(p_result->>'calorieTarget')::numeric,(p_result->>'proteinTarget')::numeric,'confirmed',plan) returning id into plan_id;
    for line in select value from jsonb_array_elements(plan->'items') loop
      insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
        values(plan_id,line#>>'{meal,id}',(line->>'dayIndex')::integer,line->>'mealSlot',(line->>'servings')::numeric,line);
    end loop;
  end if;
  insert into public.baskets(user_id, request_key, name, planning_days, household_size, target_calories,
    target_protein, estimated_total_price, generation_score, status, preferences_snapshot, result_summary, meal_plan_id)
  values (auth.uid(), p_request_key, p_name, (p_preferences ->> 'planningDays')::integer,
    (p_preferences ->> 'householdSize')::integer, (p_result ->> 'calorieTarget')::numeric,
    (p_result ->> 'proteinTarget')::numeric, (p_result ->> 'estimatedTotalPrice')::numeric,
    (p_result ->> 'score')::numeric, p_result ->> 'status', p_preferences, p_result - 'items', plan_id)
  on conflict (user_id, request_key) do nothing returning id into basket_id;
  if basket_id is null then
    select b.id into basket_id from public.baskets b where b.user_id = auth.uid() and b.request_key = p_request_key;
    return basket_id;
  end if;
  for item in select value from jsonb_array_elements(p_result -> 'items') loop
    insert into public.basket_items(basket_id, product_id, position, package_count, total_weight, total_volume,
      estimated_price, total_calories, total_protein, reason_selected, item_snapshot, ingredient_key,package_size,package_unit,purchased_quantity,planned_consumption_quantity,leftover_quantity,source_meal_ids,quantity_adjustment_percent)
    values (basket_id, (item #>> '{product,id}')::uuid, position, (item ->> 'packageCount')::integer,
      (item ->> 'totalWeight')::numeric, (item ->> 'totalVolume')::numeric,
      (item ->> 'estimatedPrice')::numeric, (item ->> 'totalCalories')::numeric,
      (item ->> 'totalProtein')::numeric, item -> 'reasonSelected', item, item->>'ingredientKey',(item->>'packageAmount')::numeric,item->>'quantityUnit',(item->>'purchasedQuantity')::numeric,(item->>'plannedConsumptionQuantity')::numeric,(item->>'leftoverQuantity')::numeric,item->'sourceMealIds',(item->>'quantityAdjustmentPercent')::numeric);
    position := position + 1;
  end loop;
  return basket_id;
end;
$$;
revoke all on function public.save_generated_basket(text,text,jsonb,jsonb) from public, anon;
grant execute on function public.save_generated_basket(text,text,jsonb,jsonb) to authenticated;
