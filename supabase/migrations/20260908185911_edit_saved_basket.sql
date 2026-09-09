-- Product-removal edits preserve basket identity, name, date and meal snapshots.
grant update(result_summary, estimated_total_price, generation_score, status, updated_at) on public.baskets to authenticated;
grant delete on public.basket_items to authenticated;
create policy basket_items_delete_own on public.basket_items for delete to authenticated using (
 exists(select 1 from public.baskets b where b.id=basket_id and b.user_id=(select auth.uid()))
);
create function public.update_saved_basket(p_request_key text, p_result jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.baskets; item jsonb;
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
 for item in select value from jsonb_array_elements(p_result->'items') loop
  if not exists(select 1 from public.basket_items i where i.basket_id=existing.id and i.item_snapshot=item) then raise exception 'Only removal of existing products is supported'; end if;
 end loop;
 delete from public.basket_items i where i.basket_id=existing.id and not exists (
 select 1 from jsonb_array_elements(p_result->'items') x where x.value#>>'{product,id}'=i.product_id::text);
 update public.baskets set result_summary=p_result-'items',
 estimated_total_price=(p_result->>'estimatedTotalPrice')::numeric,
 generation_score=(p_result->>'score')::numeric,status=p_result->>'status',updated_at=now()
 where id=existing.id and user_id=auth.uid();
 return existing.id;
end;
$$;
revoke all on function public.update_saved_basket(text,jsonb) from public,anon;
grant execute on function public.update_saved_basket(text,jsonb) to authenticated;
