-- Add one catalog entry per French Paradox Rift solo blister artwork and a
-- one-quantity artset product. Preserve the generic row until its replacements
-- and their contents have been added; remove it only when it has no user data.
with artworks(artwork, image_url, source_url) as (
  values
    ('Carchacrok Téracristal',
     'https://www.pokepedia.fr/images/4/48/Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Carchacrok_T%C3%A9racristal.png',
     'https://www.pokepedia.fr/Fichier:Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Carchacrok_T%C3%A9racristal.png'),
    ('Carmadura',
     'https://www.pokepedia.fr/images/f/fb/Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Carmadura.png',
     'https://www.pokepedia.fr/Fichier:Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Carmadura.png'),
    ('Garde-de-Fer',
     'https://www.pokepedia.fr/images/1/1a/Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Garde-de-Fer.png',
     'https://www.pokepedia.fr/Fichier:Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Garde-de-Fer.png'),
    ('Rugit-Lune',
     'https://www.pokepedia.fr/images/a/a2/Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Rugit-Lune.png',
     'https://www.pokepedia.fr/Fichier:Booster_%C3%89carlate_et_Violet_Faille_Paradoxe_Rugit-Lune.png')
), inserted as (
  insert into public.products (
    name, category, series, release_date, release_year, image_url,
    image_source_url, image_credit, image_usage_status, language,
    product_type, is_public, booster_packaging, booster_artwork
  )
  select
    'Solo blister – Écarlate et Violet – Faille Paradoxe – ' || a.artwork,
    'sealed', 'Écarlate et Violet – Faille Paradoxe', date '2023-11-03', 2023,
    a.image_url, a.source_url, 'Poképédia — ' || a.artwork, 'placeholder', 'FR',
    'Solo blister', true, 'solo_blister', a.artwork
  from artworks a
  where not exists (
    select 1 from public.products p
    where p.series = 'Écarlate et Violet – Faille Paradoxe'
      and p.product_type = 'Solo blister'
      and p.booster_artwork = a.artwork
      and p.language = 'FR'
  )
  returning id, series, product_type, booster_artwork
)
select count(*) from inserted;

insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Artset de 4 solo blisters – Écarlate et Violet – Faille Paradoxe',
  'sealed', 'Écarlate et Violet – Faille Paradoxe', date '2023-11-03', 2023,
  p.image_url, p.image_source_url, 'Poképédia — visuel représentatif Carchacrok Téracristal',
  'placeholder', 'FR', 'Artset', true, 'solo_blister_artset', '4 visuels'
from public.products p
where p.series = 'Écarlate et Violet – Faille Paradoxe'
  and p.product_type = 'Solo blister'
  and p.booster_artwork = 'Carchacrok Téracristal'
  and p.language = 'FR'
  and not exists (
    select 1 from public.products existing
    where existing.series = 'Écarlate et Violet – Faille Paradoxe'
      and existing.product_type = 'Artset'
      and existing.booster_packaging = 'solo_blister_artset'
      and existing.language = 'FR'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Booster', p.series, 1, false, 1,
       'Un booster scellé sous blister carton. Le visuel correspond à la variante indiquée. Sources : Poképédia et fiche produit Pokémon France.'
from public.products p
where p.series = 'Écarlate et Violet – Faille Paradoxe'
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
select p.id, 'booster', 'Solo blister Faille Paradoxe — un exemplaire de chaque visuel',
       p.series, 4, false, 1,
       'Artset composé des quatre visuels français de solo blisters : Carchacrok Téracristal, Carmadura, Garde-de-Fer et Rugit-Lune.'
from public.products p
where p.series = 'Écarlate et Violet – Faille Paradoxe'
  and p.product_type = 'Artset'
  and p.booster_packaging = 'solo_blister_artset'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.item_name = 'Solo blister Faille Paradoxe — un exemplaire de chaque visuel'
  );

-- The old generic row has no image or artwork identity. Remove its catalog
-- content and row only after the four identified variants exist and no user,
-- market-history, trade, or product-content row still depends on it.
delete from public.product_contents pc
using public.products p
where pc.product_id = p.id
  and p.name = 'Solo blister – Écarlate et Violet – Faille Paradoxe'
  and p.series = 'Écarlate et Violet – Faille Paradoxe'
  and p.product_type = 'Solo blister'
  and p.booster_artwork is null
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
where p.name = 'Solo blister – Écarlate et Violet – Faille Paradoxe'
  and p.series = 'Écarlate et Violet – Faille Paradoxe'
  and p.product_type = 'Solo blister'
  and p.booster_artwork is null
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
