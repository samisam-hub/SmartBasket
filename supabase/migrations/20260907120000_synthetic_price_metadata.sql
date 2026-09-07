alter table public.products
  add column price_estimate_source text,
  add column price_confidence text check (price_confidence in ('high','medium','low')),
  add column price_estimate_version text,
  add constraint synthetic_price_metadata check (price_estimate_source is distinct from 'synthetic_mvp' or
    (price_estimate is not null and price_estimate > 0 and currency='EUR' and price_kind='estimate'
     and price_confidence is not null and price_estimate_version is not null));
comment on column public.products.price_estimate_source is 'Synthetic MVP estimates are not retailer offers. Future retailer quotes belong to a separate provider model.';
comment on column public.products.price_confidence is 'Confidence in synthetic package/category inputs, not accuracy against market prices.';

-- Re-importing nutrition/images must never erase a price or replace it with a new synthetic estimate.
create function public.preserve_catalog_price() returns trigger language plpgsql set search_path='' as $$
begin
  if old.price_estimate is not null and
    (new.price_estimate is null or new.price_estimate_source='synthetic_mvp') then
    new.price_estimate=old.price_estimate;
    new.currency=old.currency;
    new.price_kind=old.price_kind;
    new.price_estimate_source=old.price_estimate_source;
    new.price_confidence=old.price_confidence;
    new.price_estimate_version=old.price_estimate_version;
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_catalog_price() from public;
create trigger preserve_catalog_price before update on public.products for each row execute function public.preserve_catalog_price();
