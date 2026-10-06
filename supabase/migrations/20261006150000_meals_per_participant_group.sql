-- Several dishes may share one slot of one day when they feed different people: the family eats
-- one thing and somebody eats their own. Version 1 plans are untouched and keep exactly one meal
-- per day number and slot.
alter table public.meal_plan_items
  add column item_key text check (length(item_key) between 1 and 120),
  add column participant_ids text[];

-- Existing calendar rows carry their item id from the snapshot they were saved with.
update public.meal_plan_items
  set item_key = item_snapshot ->> 'id',
      participant_ids = case when jsonb_typeof(item_snapshot -> 'participantIds') = 'array'
        then array(select jsonb_array_elements_text(item_snapshot -> 'participantIds')) end
  where plan_date is not null;

alter table public.meal_plan_items
  -- A calendar row is identified by its meal, a version 1 row by its day number and slot.
  add constraint meal_plan_items_calendar_key_check check ((plan_date is null) = (item_key is null)),
  add constraint meal_plan_items_participants_check check (
    participant_ids is null or (cardinality(participant_ids) between 1 and 10
      and array_position(participant_ids, null) is null)),
  -- Only a calendar row may name who eats it; version 1 plans have no per-meal participants.
  add constraint meal_plan_items_participants_version_check check (plan_date is not null or participant_ids is null);
alter table public.meal_plan_items drop constraint meal_plan_items_date_slot_key;
alter table public.meal_plan_items
  add constraint meal_plan_items_date_slot_item_key unique (meal_plan_id, plan_date, meal_slot, item_key);
comment on column public.meal_plan_items.item_key is
  'Item id inside the saved plan. Several meals can share a date and slot when they feed different people.';
comment on column public.meal_plan_items.participant_ids is
  'Who eats this meal. Null means the whole household, which is what every plan saved earlier means.';

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
      insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,plan_date,item_key,participant_ids,meal_slot,servings,item_snapshot)
        values(plan_id,line#>>'{meal,id}',
          case when plan_version='1' then (line->>'dayIndex')::integer end,
          case when plan_version='2' then (line->>'date')::date end,
          case when plan_version='2' then line->>'id' end,
          case when plan_version='2' and jsonb_typeof(line->'participantIds')='array'
            then array(select jsonb_array_elements_text(line->'participantIds')) end,
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
