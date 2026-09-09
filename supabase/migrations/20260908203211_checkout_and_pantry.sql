create table public.pantry_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version integer not null default 0 check(version>=0), lots jsonb not null default '[]' check(jsonb_typeof(lots)='array')
);
create table public.purchase_history (
 user_id uuid not null references auth.users(id) on delete cascade, basket_key text not null,
 purchased_at timestamptz not null default now(), snapshot jsonb not null,
 primary key(user_id,basket_key)
);
alter table public.pantry_state enable row level security;
alter table public.purchase_history enable row level security;
grant select,insert,update on public.pantry_state to authenticated;
grant select,insert on public.purchase_history to authenticated;
create policy pantry_own on public.pantry_state for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy purchases_read on public.purchase_history for select to authenticated using(user_id=(select auth.uid()));
create policy purchases_insert on public.purchase_history for insert to authenticated with check(user_id=(select auth.uid()));

create function public.checkout_basket(p_basket_key text,p_version integer,p_lots jsonb,p_expected_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.baskets; s public.pantry_state; purchased timestamptz; snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':pantry',0));
 select purchased_at into purchased from public.purchase_history where user_id=auth.uid() and basket_key=p_basket_key;
 if purchased is not null then return jsonb_build_object('purchasedAt',purchased); end if;
 select * into b from public.baskets where user_id=auth.uid() and request_key=p_basket_key for update;
 if b.id is null then raise exception 'Save this basket before checkout'; end if;
 if b.result_summary is distinct from (p_expected_result-'items') then raise exception 'Basket changed. Reload before checkout.'; end if;
 if coalesce((select jsonb_agg(item_snapshot order by position) from public.basket_items where basket_id=b.id),'[]'::jsonb) is distinct from p_expected_result->'items' then raise exception 'Basket products changed. Reload before checkout.'; end if;
 insert into public.pantry_state(user_id) values(auth.uid()) on conflict do nothing;
 select * into s from public.pantry_state where user_id=auth.uid() for update;
 if s.version<>p_version then raise exception 'Pantry changed. Refresh the basket before checkout.'; end if;
 if jsonb_typeof(p_lots) is distinct from 'array' or jsonb_array_length(p_lots)>1000 then raise exception 'Invalid pantry'; end if;
 if exists(select 1 from jsonb_array_elements(p_lots) l where jsonb_typeof(l->'quantity') is distinct from 'number' or (l->>'quantity')::numeric<=0 or l->>'unit' is null or (l->>'unit') not in ('g','ml') or l->>'id' is null) then raise exception 'Invalid pantry quantity'; end if;
 if (select count(*) from jsonb_array_elements(p_lots)) <> (select count(distinct l->>'id') from jsonb_array_elements(p_lots) l) then raise exception 'Duplicate pantry entries'; end if;
 purchased:=now();
 select jsonb_build_object('id',b.request_key,'cloudId',b.id,'ownerId',b.user_id,'name',b.name,'createdAt',b.created_at,
 'preferences',b.preferences_snapshot,'syncStatus','synced','result',b.result_summary||jsonb_build_object('purchasedAt',purchased,'items',
 coalesce((select jsonb_agg(item_snapshot order by position) from public.basket_items where basket_id=b.id),'[]'::jsonb))) into snapshot;
 insert into public.purchase_history(user_id,basket_key,purchased_at,snapshot) values(auth.uid(),p_basket_key,purchased,snapshot);
 update public.pantry_state set lots=p_lots,version=version+1 where user_id=auth.uid();
 update public.baskets set result_summary=result_summary||jsonb_build_object('purchasedAt',purchased),updated_at=purchased where id=b.id;
 return jsonb_build_object('purchasedAt',purchased);
end; $$;
revoke all on function public.checkout_basket(text,integer,jsonb,jsonb) from public,anon;
grant execute on function public.checkout_basket(text,integer,jsonb,jsonb) to authenticated;

create function public.protect_purchased_basket() returns trigger language plpgsql set search_path='' as $$
begin
 if old.result_summary->>'purchasedAt' is not null and new.result_summary is distinct from old.result_summary then raise exception 'Purchased baskets cannot be edited. Create a new basket.'; end if;
 return new;
end; $$;
create trigger protect_purchased_basket before update on public.baskets for each row execute function public.protect_purchased_basket();
