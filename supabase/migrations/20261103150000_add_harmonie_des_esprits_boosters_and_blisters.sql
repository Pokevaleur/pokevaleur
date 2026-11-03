-- Correct the Harmonie des Esprits solo blister image, add the four
-- documented blister variants, and complete the booster catalog/artset.
-- The existing generic blister row is reused as Mewtwo & Mew so its ID and
-- existing product-content relation remain intact.

with blister_artworks(artwork, image_url) as (
  values
    ('Carchacrok Giratina', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-4.png?v=1762936793&width=2400'),
    ('Mewtwo Mew', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-2.png?v=1762936793&width=2400'),
    ('Mentali Deoxys', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-3.png?v=1762936793&width=2400'),
    ('Noctali Darkrai', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits.png?v=1762936793&width=2400')
)
update public.products p
set name = 'Solo blister – Soleil et Lune – Harmonie des Esprits – Mewtwo Mew',
    booster_artwork = a.artwork,
    image_url = a.image_url,
    image_source_url = 'https://snooop.gg/products/booster-sous-blister-pokemon-soleil-et-lune-harmonie-des-esprits-sl11',
    image_credit = 'Snooop — photographie du blister Mewtwo & Mew',
    image_usage_status = 'placeholder',
    language = 'FR',
    release_year = coalesce(p.release_year, 2019)
from blister_artworks a
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Solo blister'
  and p.booster_packaging = 'solo_blister'
  and p.booster_artwork is null
  and p.name = 'Solo blister – Soleil et Lune – Harmonie des Esprits'
  and a.artwork = 'Mewtwo Mew';

with blister_artworks(artwork, image_url) as (
  values
    ('Carchacrok Giratina', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-4.png?v=1762936793&width=2400'),
    ('Mewtwo Mew', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-2.png?v=1762936793&width=2400'),
    ('Mentali Deoxys', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits-3.png?v=1762936793&width=2400'),
    ('Noctali Darkrai', 'https://snooop.gg/cdn/shop/files/pokemon-booster-blister-harmonie-des-esprits.png?v=1762936793&width=2400')
)
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Solo blister – Soleil et Lune – Harmonie des Esprits – ' || a.artwork,
  'sealed', 'Soleil et Lune – Harmonie des Esprits', date '2019-08-02', 2019,
  a.image_url,
  'https://snooop.gg/products/booster-sous-blister-pokemon-soleil-et-lune-harmonie-des-esprits-sl11',
  'Snooop — photographie du blister ' || replace(a.artwork, ' ', ' & '),
  'placeholder', 'FR', 'Solo blister', true, 'solo_blister', a.artwork
from blister_artworks a
where a.artwork <> 'Mewtwo Mew'
  and not exists (
    select 1 from public.products p
    where p.series = 'Soleil et Lune – Harmonie des Esprits'
      and p.product_type = 'Solo blister'
      and p.booster_packaging = 'solo_blister'
      and p.booster_artwork = a.artwork
      and p.language = 'FR'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Booster', p.series, 1, false, 1,
       'Un booster Harmonie des Esprits présenté sous blister cartonné. Visuels documentés par les déclinaisons françaises de Snooop.'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Solo blister'
  and p.booster_packaging = 'solo_blister'
  and p.booster_artwork is not null
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.component_type = 'booster'
      and pc.item_name = 'Booster'
  );

with booster_artworks(artwork, image_url, image_source_url) as (
  values
    ('Carchacrok Giratina',
     'https://www.pokepedia.fr/images/9/9b/Booster_Soleil_et_Lune_Harmonie_des_Esprits_Carchacrok_Giratina.png',
     'https://www.pokepedia.fr/Fichier:Booster_Soleil_et_Lune_Harmonie_des_Esprits_Carchacrok_Giratina.png'),
    ('Mentali Deoxys',
     'https://www.pokepedia.fr/images/7/78/Booster_Soleil_et_Lune_Harmonie_des_Esprits_Mentali_Deoxys.png',
     'https://www.pokepedia.fr/Fichier:Booster_Soleil_et_Lune_Harmonie_des_Esprits_Mentali_Deoxys.png'),
    ('Mewtwo Mew',
     'https://www.pokepedia.fr/images/7/7d/Booster_Soleil_et_Lune_Harmonie_des_Esprits_Mewtwo_Mew.png',
     'https://www.pokepedia.fr/Fichier:Booster_Soleil_et_Lune_Harmonie_des_Esprits_Mewtwo_Mew.png'),
    ('Noctali Darkrai',
     'https://www.pokepedia.fr/images/1/1a/Booster_Soleil_et_Lune_Harmonie_des_Esprits_Noctali_Darkrai.png',
     'https://www.pokepedia.fr/Fichier:Booster_Soleil_et_Lune_Harmonie_des_Esprits_Noctali_Darkrai.png'),
    ('Osselait Minidraco Keunotor',
     'https://www.pokepedia.fr/images/3/3e/Booster_Soleil_et_Lune_Harmonie_des_Esprits_Osselait_Minidraco_Keunotor.png',
     'https://www.pokepedia.fr/Fichier:Booster_Soleil_et_Lune_Harmonie_des_Esprits_Osselait_Minidraco_Keunotor.png')
)
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Booster loose – Soleil et Lune – Harmonie des Esprits – ' || a.artwork,
  'sealed', 'Soleil et Lune – Harmonie des Esprits', date '2019-08-02', 2019,
  a.image_url, a.image_source_url, 'Poképédia — ' || a.artwork,
  'placeholder', 'FR', 'Booster loose', true, 'loose', a.artwork
from booster_artworks a
where not exists (
  select 1 from public.products p
  where p.series = 'Soleil et Lune – Harmonie des Esprits'
    and p.product_type = 'Booster loose'
    and p.booster_artwork = a.artwork
    and p.language = 'FR'
);

insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, booster_packaging, booster_artwork
)
select
  'Artset de 4 boosters – Soleil et Lune – Harmonie des Esprits',
  'sealed', 'Soleil et Lune – Harmonie des Esprits', date '2019-08-02', 2019,
  p.image_url, p.image_source_url, 'Poképédia — visuel représentatif Carchacrok & Giratina',
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

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Booster', p.series, 1, false, 1,
       'Un booster scellé Harmonie des Esprits. Visuels des quatre boosters vérifiés sur Poképédia.'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Booster loose'
  and p.booster_artwork is not null
  and p.booster_artwork <> 'Osselait Minidraco Keunotor'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.component_type = 'booster'
      and pc.item_name = 'Booster'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel',
       p.series, 4, false, 1,
       'Artset des quatre visuels standard : Carchacrok & Giratina, Mentali & Deoxys, Mewtwo & Mew, Noctali & Darkrai. Le booster échantillon 3 cartes est exclu.'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Artset'
  and p.name ilike 'Artset de 4 boosters%'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id
      and pc.item_name = 'Artset de boosters Harmonie des Esprits — un exemplaire de chaque visuel'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'booster', 'Booster échantillon 3 cartes', p.series, 1, false, 2,
       'Booster échantillon illustré par Osselait, Minidraco et Keunotor, distribué avec certains magazines. Il ne fait pas partie de l’artset des quatre boosters standard.'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Booster loose'
  and p.booster_artwork = 'Osselait Minidraco Keunotor'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.item_name = 'Booster échantillon 3 cartes'
  );

insert into public.product_contents (
  product_id, component_type, item_name, set_name, quantity, is_random,
  sort_order, source_note
)
select p.id, 'guaranteed_card', 'Cartes incluses', p.series, 3, false, 2,
       'Le booster échantillon Harmonie des Esprits contient trois cartes.'
from public.products p
where p.series = 'Soleil et Lune – Harmonie des Esprits'
  and p.product_type = 'Booster loose'
  and p.booster_artwork = 'Osselait Minidraco Keunotor'
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id and pc.item_name = 'Cartes incluses'
  );
