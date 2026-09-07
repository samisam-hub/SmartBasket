-- Additive catalog metadata only; preferences, meals and basket architecture remain unchanged.
alter table public.products
 add column package_count_units integer check(package_count_units>0 and package_count_units<=1000),
 add column package_size_status text not null default 'unknown' check(package_size_status in ('known','unknown','conflicting')),
 add column package_size_source text,
 add column package_mass_per_unit numeric check(package_mass_per_unit>0 and package_mass_per_unit<=10000),
 add column package_drained_weight numeric check(package_drained_weight>0 and package_drained_weight<=100000);
-- Existing declared quantities stay intact. No guessed package size or dietary flag backfill.
update public.products set package_size_status='known',package_size_source='legacy-provider-quantity'
 where package_size>0 and package_unit is not null;
