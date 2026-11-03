-- Add the four French Forces Temporelles solo blister artworks and their
-- one-quantity artset without changing any existing product records.
with artworks(artwork, image_url, source_url) as (
  values
    ('Chef-de-Fer',
     'https://www.pokepedia.fr/images/0/04/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Chef-de-Fer.png',
     'https://www.pokepedia.fr/Fichier:Booster%20%C3%89carlate%20et%20Violet%20Forces%20Temporelles%20Chef-de-Fer.png'),
    ('Ire-Foudre',
     'https://www.pokepedia.fr/images/a/a5/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Ire-Foudre.png',
     'https://www.pokepedia.fr/Fichier:Booster%20%C3%89carlate%20et%20Violet%20Forces%20Temporelles%20Ire-Foudre.png'),
    ('Serpente-Eau',
     'https://www.pokepedia.fr/images/2/2a/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Serpente-Eau.png',
     'https://www.pokepedia.fr/Fichier:Booster%20%C3%89carlate%20et%20Violet%20Forces%20Temporelles%20Serpente-Eau.png'),
    ('Vert-de-Fer',
     'https://www.pokepedia.fr/images/9/95/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png',
     'https://www.pokepedia.fr/Fichier:Booster%20%C3%89carlate%20et%20Violet%20Forces%20Temporelles%20Vert-de-Fer.png')
)
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Solo blister – Écarlate et Violet – Forces Temporelles – ' || a.artwork,
  'sealed', 'Écarlate et Violet – Forces Temporelles', date '2024-03-22', 2024,
  a.image_url, a.source_url, 'Poképédia — ' || a.artwork, 'placeholder', 'FR',
  'Solo blister', true, 'solo_blister', a.artwork
from artworks a
where not exists (
  select 1 from public.products p
  where p.series = 'Écarlate et Violet – Forces Temporelles'
    and p.product_type = 'Solo blister'
    and p.booster_artwork = a.artwork
    and p.language = 'FR'
);

insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Artset de 4 solo blisters – Écarlate et Violet – Forces Temporelles',
  'sealed', 'Écarlate et Violet – Forces Temporelles', date '2024-03-22', 2024,
  p.image_url, p.image_source_url, 'Poképédia — visuel représentatif Chef-de-Fer',
  'placeholder', 'FR', 'Artset', true, 'solo_blister_artset', '4 visuels'
from public.products p
where p.series = 'Écarlate et Violet – Forces Temporelles'
  and p.product_type = 'Solo blister'
  and p.booster_artwork = 'Chef-de-Fer'
  and p.language = 'FR'
  and not exists (
    select 1 from public.products existing
    where existing.series = 'Écarlate et Violet – Forces Temporelles'
      and existing.product_type = 'Artset'
      and existing.booster_packaging = 'solo_blister_artset'
      and existing.language = 'FR'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Booster', p.series, 1, false, 1,
       'Un booster scellé sous blister carton. Le visuel correspond à la variante indiquée. Images des boosters : Poképédia.'
from public.products p
where p.series = 'Écarlate et Violet – Forces Temporelles'
  and p.product_type = 'Solo blister'
  and p.booster_packaging = 'solo_blister'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.component_type = 'booster'
      and pc.item_name = 'Booster'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Solo blister Forces Temporelles — un exemplaire de chaque visuel',
       p.series, 4, false, 1,
       'Artset composé des quatre visuels français : Chef-de-Fer, Ire-Foudre, Serpente-Eau et Vert-de-Fer.'
from public.products p
where p.series = 'Écarlate et Violet – Forces Temporelles'
  and p.product_type = 'Artset'
  and p.booster_packaging = 'solo_blister_artset'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id
      and pc.item_name = 'Solo blister Forces Temporelles — un exemplaire de chaque visuel'
  );

-- Remove only the image-less generic entry, after its four replacements are
-- present and only if no collection, trade, or market-history data depends on it.
delete from public.product_contents pc
using public.products p
where pc.product_id = p.id
  and p.name = 'Solo blister – Écarlate et Violet – Forces Temporelles'
  and p.series = 'Écarlate et Violet – Forces Temporelles'
  and p.product_type = 'Solo blister'
  and p.booster_artwork is null
  and p.image_url is null
  and (
    select count(*) from public.products variant
    where variant.series = p.series
      and variant.product_type = 'Solo blister'
      and variant.booster_packaging = 'solo_blister'
      and variant.booster_artwork is not null
      and variant.image_url is not null
      and variant.language = 'FR'
  ) = 4;

delete from public.products p
where p.name = 'Solo blister – Écarlate et Violet – Forces Temporelles'
  and p.series = 'Écarlate et Violet – Forces Temporelles'
  and p.product_type = 'Solo blister'
  and p.booster_artwork is null
  and p.image_url is null
  and (
    select count(*) from public.products variant
    where variant.series = p.series
      and variant.product_type = 'Solo blister'
      and variant.booster_packaging = 'solo_blister'
      and variant.booster_artwork is not null
      and variant.image_url is not null
      and variant.language = 'FR'
  ) = 4
  and not exists (select 1 from public.collection_items ci where ci.product_id = p.id)
  and not exists (select 1 from public.trade_listings tl where tl.product_id = p.id)
  and not exists (select 1 from public.product_price_history h where h.product_id = p.id)
  and not exists (select 1 from public.product_contents pc where pc.product_id = p.id);
