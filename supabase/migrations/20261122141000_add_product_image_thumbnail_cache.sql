alter table public.products
  add column if not exists image_thumbnail_data text;

comment on column public.products.image_thumbnail_data is
  'Persistent base64 data URI for a public product image, saved on first successful fallback fetch.';
