-- Add the missing four-artwork Harmonie des Esprits booster artset.
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Artset de 4 boosters – Soleil et Lune – Harmonie des Esprits',
  'sealed', 'Soleil et Lune – Harmonie des Esprits', date '2019-08-02', 2019,
  p.image_url, p.image_source_url,
  'Poképédia — visuel représentatif Carchacrok & Giratina',
  'placeholder', 'FR', 'Artset', true, 'other', '4 visuels'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Booster loose'
  and p.booster_artwork = 'Carchacrok Giratina'
  and p.language = 'FR'
  and not exists (
    select 1 from public.products artset
    where artset.series = p.series
      and artset.product_type = 'Artset'
      and artset.name ilike 'Artset de 4 boosters%'
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
    select p.id, 'booster', 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel',
           p.series, 4, false, 1,
           'Quatre visuels standard : Carchacrok & Giratina, Mentali & Deoxys, Mewtwo & Mew et Noctali & Darkrai. Le booster échantillon est exclu.'
    from public.products p
    where p.series = 'Soleil et Lune – Harmonie des Esprits'
      and p.product_type = 'Artset'
      and p.name ilike 'Artset de 4 boosters%'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id
          and pc.item_name = 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel'
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
    select p.id, 'booster', 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel', 4,
           'https://www.pokepedia.fr/Soleil_et_Lune_%E2%80%93_Harmonie_des_Esprits',
           'Poképédia — boosters Harmonie des Esprits', 'verified', 'guaranteed'
    from public.products p
    where p.series = 'Soleil et Lune – Harmonie des Esprits'
      and p.product_type = 'Artset'
      and p.name ilike 'Artset de 4 boosters%'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id
          and pc.item_name = 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel'
      );
  end if;
end $$;
