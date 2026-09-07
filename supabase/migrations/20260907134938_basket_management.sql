-- Only names may be updated; snapshots remain immutable.
grant update(name),delete on public.baskets to authenticated;
create policy baskets_rename_own on public.baskets for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy baskets_delete_own on public.baskets for delete to authenticated using(user_id=(select auth.uid()));
grant delete on public.meal_plans to authenticated;
create policy meal_plans_delete_own on public.meal_plans for delete to authenticated using(user_id=(select auth.uid()));
create function public.rename_saved_basket(p_request_key text,p_name text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'Name must contain 1-120 characters';end if;
 update public.baskets set name=btrim(p_name) where request_key=p_request_key and user_id=auth.uid();
 if not found then raise exception 'Basket not found';end if;
end;$$;
create function public.delete_saved_basket(p_request_key text) returns void language plpgsql security invoker set search_path='' as $$
declare plan_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.baskets where request_key=p_request_key and user_id=auth.uid() returning meal_plan_id into plan_id;
 -- Remove only this owner's now-unreferenced plan, including its items/participants by FK cascade.
 if plan_id is not null then delete from public.meal_plans where id=plan_id and user_id=auth.uid() and not exists(select 1 from public.baskets where meal_plan_id=plan_id);end if;
end;$$;
revoke all on function public.rename_saved_basket(text,text) from public;
revoke all on function public.delete_saved_basket(text) from public;
grant execute on function public.rename_saved_basket(text,text),public.delete_saved_basket(text) to authenticated;
