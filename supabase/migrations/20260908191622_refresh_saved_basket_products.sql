create or replace function public.update_saved_basket(p_request_key text, p_result jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.baskets; item jsonb; position integer := 0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_request_key,0));
 select * into existing from public.baskets where user_id=auth.uid() and request_key=p_request_key for update;
 if existing.id is null then raise exception 'Basket not found' using errcode='42501'; end if;
 if jsonb_typeof(p_result->'items') is distinct from 'array' or octet_length(p_result::text)>1000000 then raise exception 'Invalid basket'; end if;
 if p_result->'mealPlan' is distinct from existing.result_summary->'mealPlan'
 or p_result->'engineVersion' is distinct from existing.result_summary->'engineVersion' then raise exception 'Meal plan cannot change in a product-removal edit'; end if;
 if jsonb_array_length(p_result->'items')=0 and p_result->>'engineVersion' <> '2' then raise exception 'Older baskets need one product'; end if;
 if (select count(distinct value#>>'{product,id}') from jsonb_array_elements(p_result->'items')) <> jsonb_array_length(p_result->'items') then raise exception 'Duplicate products'; end if;
 if jsonb_array_length(p_result->'items') > 64 then raise exception 'Too many products'; end if;
 delete from public.basket_items where basket_id=existing.id;
  for item in select value from jsonb_array_elements(p_result -> 'items') loop
    insert into public.basket_items(basket_id, product_id, position, package_count, total_weight, total_volume,
      estimated_price, total_calories, total_protein, reason_selected, item_snapshot, ingredient_key,package_size,package_unit,purchased_quantity,planned_consumption_quantity,leftover_quantity,source_meal_ids,quantity_adjustment_percent)
    values (existing.id, (item #>> '{product,id}')::uuid, position, (item ->> 'packageCount')::integer,
      (item ->> 'totalWeight')::numeric, (item ->> 'totalVolume')::numeric,
      (item ->> 'estimatedPrice')::numeric, (item ->> 'totalCalories')::numeric,
      (item ->> 'totalProtein')::numeric, item -> 'reasonSelected', item, item->>'ingredientKey',(item->>'packageAmount')::numeric,item->>'quantityUnit',(item->>'purchasedQuantity')::numeric,(item->>'plannedConsumptionQuantity')::numeric,(item->>'leftoverQuantity')::numeric,item->'sourceMealIds',(item->>'quantityAdjustmentPercent')::numeric);
    position := position + 1;
  end loop;
 update public.baskets set result_summary=p_result-'items',
 estimated_total_price=(p_result->>'estimatedTotalPrice')::numeric,
 generation_score=(p_result->>'score')::numeric,status=p_result->>'status',updated_at=now()
 where id=existing.id and user_id=auth.uid();
 return existing.id;
end;
$$;
revoke all on function public.update_saved_basket(text,jsonb) from public,anon;
grant execute on function public.update_saved_basket(text,jsonb) to authenticated;
