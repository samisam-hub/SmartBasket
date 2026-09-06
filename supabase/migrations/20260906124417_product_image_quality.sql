-- Additive presentation metadata; catalog and preference permissions stay unchanged.
alter table public.products
  add column source_image_url text,
  add column display_image_url text,
  add column image_source text,
  add column image_quality text not null default 'unknown'
    check (image_quality in ('usable', 'low-resolution', 'unknown', 'missing')),
  add column image_width integer check (image_width between 1 and 50000),
  add column image_height integer check (image_height between 1 and 50000),
  add column image_thumbnail_width integer check (image_thumbnail_width between 1 and 50000),
  add column image_thumbnail_height integer check (image_thumbnail_height between 1 and 50000),
  add constraint products_display_image_quality check (
    (image_quality = 'usable' and display_image_url is not null
      and image_width is not null and image_height is not null
      and greatest(image_width, image_height) >= 600 and least(image_width, image_height) >= 200)
    or (image_quality <> 'usable' and display_image_url is null)
  );

-- Preserve the previous URL as provenance pending the explicit metadata audit.
update public.products set source_image_url = image_url,
  image_source = case when image_url is not null then source else null end;
