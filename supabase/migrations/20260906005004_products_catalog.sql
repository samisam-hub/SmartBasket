-- Shared public grocery catalog; imports are administrative, app access is read-only.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (length(source) between 1 and 80),
  external_id text,
  barcode text unique check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (length(btrim(name)) between 2 and 500),
  brand text,
  category text not null check (category in ('fruit','vegetables','meat','fish','eggs','dairy',
    'dairy-alternatives','bread','grains','pasta','potatoes','legumes','breakfast','snacks','beverages','other')),
  image_url text check (image_url is null or image_url like 'https://%'),
  image_thumbnail_url text check (image_thumbnail_url is null or image_thumbnail_url like 'https://%'),
  quantity_label text,
  package_size numeric check (package_size > 0),
  package_unit text check (package_unit in ('g','ml','piece')),
  price_estimate numeric(10,2) check (price_estimate >= 0),
  price_kind text not null default 'unavailable' check (price_kind in ('unavailable','demo-estimate','estimate')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  calories_per_100g numeric check (calories_per_100g between 0 and 910),
  protein_per_100g numeric check (protein_per_100g between 0 and 100),
  carbohydrates_per_100g numeric check (carbohydrates_per_100g between 0 and 100),
  fat_per_100g numeric check (fat_per_100g between 0 and 100),
  fiber_per_100g numeric check (fiber_per_100g between 0 and 100),
  sugars_per_100g numeric check (sugars_per_100g between 0 and 100),
  salt_per_100g numeric check (salt_per_100g between 0 and 100),
  nutrition_basis text not null check (nutrition_basis in ('100g','100ml')),
  ingredients_text text,
  allergens text[] not null default '{}',
  may_contain_allergens text[] not null default '{}',
  allergen_info_available boolean not null default false,
  labels text[] not null default '{}',
  vegetarian boolean, vegan boolean, lactose_free boolean, gluten_free boolean,
  nutrition_grade text check (nutrition_grade in ('a','b','c','d','e')),
  source_url text check (source_url is null or source_url like 'https://%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', name), 'A') || setweight(to_tsvector('simple', coalesce(brand,'')), 'B')
  ) stored,
  high_protein boolean generated always as (
    calories_per_100g > 0 and protein_per_100g * 4 >= calories_per_100g * 0.2
  ) stored,
  unique (source, external_id),
  check ((price_kind = 'unavailable' and price_estimate is null) or
         (price_kind <> 'unavailable' and price_estimate is not null)),
  check (calories_per_100g is not null and
    (protein_per_100g is not null or carbohydrates_per_100g is not null or fat_per_100g is not null))
);
create index products_search_idx on public.products using gin (search_document);
create index products_name_id_idx on public.products (name, id);
create index products_brand_idx on public.products (brand);
create index products_category_name_idx on public.products (category, name, id);
create index products_vegan_idx on public.products (name, id) where vegan = true;
create index products_vegetarian_idx on public.products (name, id) where vegetarian = true;
create index products_lactose_free_idx on public.products (name, id) where lactose_free = true;
create index products_gluten_free_idx on public.products (name, id) where gluten_free = true;
create index products_high_protein_idx on public.products (name, id) where high_protein = true;
create index products_allergens_idx on public.products using gin (allergens);
create index products_traces_idx on public.products using gin (may_contain_allergens);
create function public.products_updated_at() returns trigger language plpgsql
set search_path = '' as $$
begin
  new.id = old.id;
  new.created_at = old.created_at;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
create trigger products_updated before update on public.products
for each row execute function public.products_updated_at();
revoke all on function public.products_updated_at() from public, anon, authenticated;
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
create policy products_public_read on public.products for select to anon, authenticated using (true);
comment on table public.products is 'SmartBasket normalized catalog. Open Food Facts data: ODbL; images: CC BY-SA. No client writes.';
comment on column public.products.allergen_info_available is 'Source lists ingredients or allergens; does not certify completeness or allergy suitability.';
comment on column public.products.price_estimate is 'Estimated package price only; never a current retailer offer.';
comment on column public.products.nutrition_basis is 'All *_per_100g fields use this declared basis (100g or 100ml), as sold.';
