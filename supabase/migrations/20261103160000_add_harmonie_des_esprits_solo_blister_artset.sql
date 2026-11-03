-- Add the four-variant Harmonie des Esprits solo blister artset without
-- changing the individual blister products or any collection entries.
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Artset de 4 solo blisters – Soleil et Lune – Harmonie des Esprits',
  'sealed', 'Soleil et Lune – Harmonie des Esprits', date '2019-08-02', 2019,
  p.image_url,
  p.image_source_url,
  'Snooop — photo représentative du blister Mewtwo & Mew',
  'placeholder', 'FR', 'Artset', true, 'other', '4 visuels'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Solo blister'
  and p.booster_packaging = 'solo_blister'
  and p.booster_artwork = 'Mewtwo Mew'
  and p.language = 'FR'
  and not exists (
    select 1 from public.products artset
    where artset.series = p.series
      and artset.product_type = 'Artset'
      and artset.name ilike 'Artset de 4 solo blisters%'
      and artset.language = 'FR'
  );

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'component_type'
  ) then
    insert into public.product_contents (
      product_id, component_type, item_name, set_name, quantity,
      is_random, sort_order, source_note
    )
    select p.id, 'booster', 'Artset de solo blisters Harmonie des Esprits — un exemplaire de chaque visuel',
           p.series, 4, false, 1,
           'Quatre visuels français : Carchacrok & Giratina, Mentali & Deoxys, Mewtwo & Mew, Noctali & Darkrai.'
    from public.products p
    where p.series = 'Soleil et Lune – Harmonie des Esprits'
      and p.product_type = 'Artset'
      and p.name ilike 'Artset de 4 solo blisters%'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id
          and pc.item_name = 'Artset de solo blisters Harmonie des Esprits — un exemplaire de chaque visuel'
      );
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'content_type'
  ) then
    insert into public.product_contents (
      product_id, content_type, item_name, quantity,
      source_url, source_label, confidence, content_role
    )
    select p.id, 'booster', 'Artset de solo blisters Harmonie des Esprits — un exemplaire de chaque visuel', 4,
           'https://snooop.gg/products/booster-sous-blister-pokemon-soleil-et-lune-harmonie-des-esprits-sl11',
           'Snooop — visuels de blisters Harmonie des Esprits', 'verified', 'guaranteed'
    from public.products p
    where p.series = 'Soleil et Lune – Harmonie des Esprits'
      and p.product_type = 'Artset'
      and p.name ilike 'Artset de 4 solo blisters%'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id
          and pc.item_name = 'Artset de solo blisters Harmonie des Esprits — un exemplaire de chaque visuel'
      );
  end if;
end $$;
