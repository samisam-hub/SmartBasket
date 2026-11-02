-- Calendar weeks beside the existing fixed planning periods. Version 1 plans keep every value and
-- every rule they were saved under; version 2 plans name real dates and may skip days of the week.

-- The household's meal standard and its people, so a chosen calendar day can be prefilled.
alter table public.user_preferences add column slot_defaults jsonb, add column participants jsonb;
create function public.valid_slot_defaults(value jsonb) returns boolean language sql immutable set search_path = '' as $$
  select value is null or (
    jsonb_typeof(value) = 'object'
    and value ?& array['breakfast','lunch','dinner','snack']
    and (select count(*) from jsonb_object_keys(value)) = 4
    and (select bool_and(jsonb_typeof(entry.value) = 'boolean') from jsonb_each(value) entry)
    -- At least one planned meal; a standard that plans nothing would leave the calendar empty.
    and (select bool_or(entry.value = 'true'::jsonb) from jsonb_each(value) entry))
$$;
revoke all on function public.valid_slot_defaults(jsonb) from public;
-- The check constraint runs as whoever writes the row, so those roles must be able to call it.
grant execute on function public.valid_slot_defaults(jsonb) to authenticated, service_role;
alter table public.user_preferences
  add constraint preferences_slot_defaults_check check (public.valid_slot_defaults(slot_defaults)),
  -- Shape and count only; each person's own values are validated in plan_participants on save.
  add constraint preferences_participants_check check (
    participants is null or (jsonb_typeof(participants) = 'array'
      and jsonb_array_length(participants) between 1 and 10
      and jsonb_array_length(participants) = household_size));
comment on column public.user_preferences.slot_defaults is
  'Meals the household plans by default. Null means the application default (snack off).';
comment on column public.user_preferences.participants is
  'The household as people. Null means only household_size is known, as before the calendar onboarding.';

-- Inline column checks carry generated names; find them by what they constrain.
do $$
declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.meal_plans'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%planning_days%'
  loop execute format('alter table public.meal_plans drop constraint %I', constraint_name); end loop;
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.meal_plan_items'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%day_index%'
  loop execute format('alter table public.meal_plan_items drop constraint %I', constraint_name); end loop;
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.baskets'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%planning_days%'
  loop execute format('alter table public.baskets drop constraint %I', constraint_name); end loop;
end $$;

-- A plan is either a fixed period of days counted from 0, or a week that names its dates.
alter table public.meal_plans add column plan_version text not null default '1', add column week_start date;
alter table public.meal_plans alter column planning_days drop not null;
alter table public.meal_plans
  add constraint meal_plans_version_check check (plan_version in ('1','2')),
  add constraint meal_plans_period_check check (case plan_version
    when '1' then planning_days in (3,5,7,14) and week_start is null
    else planning_days is null and week_start is not null and extract(isodow from week_start) = 1 end);
comment on column public.meal_plans.week_start is 'Monday the calendar week starts on; null for version 1 plans.';
comment on column public.meal_plans.planning_days is 'Fixed planning period of a version 1 plan; null for calendar weeks.';

alter table public.meal_plan_items add column plan_date date;
alter table public.meal_plan_items alter column day_index drop not null;
alter table public.meal_plan_items
  add constraint meal_plan_items_day_check check (
    (plan_date is null and day_index is not null and day_index between 0 and 13)
    or (plan_date is not null and day_index is null)),
  -- One meal per date and slot. The day_index unique constraint keeps doing the same for version 1,
  -- where plan_date is null and distinct nulls never collide.
  add constraint meal_plan_items_date_slot_key unique (meal_plan_id, plan_date, meal_slot);

-- A calendar item must fall inside its plan's week; a version 1 item inside its planning period.
drop policy meal_plan_items_insert_own on public.meal_plan_items;
create policy meal_plan_items_insert_own on public.meal_plan_items for insert to authenticated
  with check (exists (select 1 from public.meal_plans p
    where p.id = meal_plan_id and p.user_id = (select auth.uid())
      and case p.plan_version
        when '1' then day_index is not null and day_index < p.planning_days
        else plan_date is not null and plan_date >= p.week_start and plan_date < p.week_start + 7 end));

-- A calendar week can cover any number of days, including two or four.
alter table public.baskets add constraint baskets_planning_days_check check (planning_days between 1 and 14);

create or replace function public.save_generated_basket(p_request_key text, p_name text, p_preferences jsonb, p_result jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare basket_id uuid; item jsonb; position integer := 0; plan_id uuid; plan jsonb; line jsonb;
  plan_version text; period_days integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_result -> 'items') is distinct from 'array' then raise exception 'Items must be an array'; end if;
  if jsonb_array_length(p_result -> 'items') not between (case when p_result->>'engineVersion'='2' then 0 else 1 end) and (case when p_result->>'engineVersion'='2' then 64 else 24 end) then raise exception 'Invalid basket size'; end if;
  if octet_length(p_result::text) > 1000000 then raise exception 'Basket snapshot is too large'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_request_key, 0));
  select b.id into basket_id from public.baskets b where b.user_id = auth.uid() and b.request_key = p_request_key;
  if basket_id is not null then return basket_id; end if;
  period_days := (p_preferences ->> 'planningDays')::integer;
  if p_result->>'engineVersion'='2' then
    plan := p_result->'mealPlan';
    if plan->>'status' is distinct from 'confirmed' or jsonb_typeof(plan->'items') is distinct from 'array' then raise exception 'Confirmed meal plan required'; end if;
    plan_version := coalesce(plan->>'version','1');
    if plan_version not in ('1','2') then raise exception 'Unknown meal plan version'; end if;
    if jsonb_array_length(plan->'items') not between 1 and 42 then raise exception 'Invalid meal plan size'; end if;
    if (plan->>'householdSize')::integer is distinct from (p_preferences->>'householdSize')::integer then raise exception 'Meal plan/preferences mismatch'; end if;
    -- A fixed period must still match the saved preferences; a calendar week carries its own days.
    if plan_version='1' and (plan->>'planningDays')::integer is distinct from period_days then raise exception 'Meal plan/preferences mismatch'; end if;
    if plan_version='2' then period_days := coalesce(period_days, jsonb_array_length(plan->'days')); end if;
    insert into public.meal_plans(user_id,request_key,plan_version,planning_days,week_start,household_size,target_calories,target_protein,status,plan_snapshot)
      values(auth.uid(),p_request_key,plan_version,
        case when plan_version='1' then (plan->>'planningDays')::integer end,
        case when plan_version='2' then (plan->>'weekStart')::date end,
        (plan->>'householdSize')::integer,(p_result->>'calorieTarget')::numeric,(p_result->>'proteinTarget')::numeric,'confirmed',plan) returning id into plan_id;
    for line in select value from jsonb_array_elements(plan->'items') loop
      insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,plan_date,meal_slot,servings,item_snapshot)
        values(plan_id,line#>>'{meal,id}',
          case when plan_version='1' then (line->>'dayIndex')::integer end,
          case when plan_version='2' then (line->>'date')::date end,
          line->>'mealSlot',(line->>'servings')::numeric,line);
    end loop;
  end if;
  insert into public.baskets(user_id, request_key, name, planning_days, household_size, target_calories,
    target_protein, estimated_total_price, generation_score, status, preferences_snapshot, result_summary, meal_plan_id)
  values (auth.uid(), p_request_key, p_name, period_days,
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
