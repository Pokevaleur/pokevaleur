-- Add the six verified French Soleil et Lune booster pack artworks.
-- Insert only missing rows so existing product and price data stays untouched.
with artworks(artwork, image_url, source_url) as (
  values
    ('Archéduc', 'https://www.pokepedia.fr/images/d/d2/Booster_Soleil_et_Lune_Arch%C3%A9duc.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_Arch%C3%A9duc.png'),
    ('Félinferno', 'https://www.pokepedia.fr/images/2/2b/Booster_Soleil_et_Lune_F%C3%A9linferno.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_F%C3%A9linferno.png'),
    ('Flamiaou Brindibou Otaquin', 'https://www.pokepedia.fr/images/8/85/Booster_Soleil_et_Lune_Flamiaou_Brindibou_Otaquin.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_Flamiaou_Brindibou_Otaquin.png'),
    ('Lunala', 'https://www.pokepedia.fr/images/d/df/Booster_Soleil_et_Lune_Lunala.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_Lunala.png'),
    ('Oratoria', 'https://www.pokepedia.fr/images/9/90/Booster_Soleil_et_Lune_Oratoria.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_Oratoria.png'),
    ('Solgaleo', 'https://www.pokepedia.fr/images/b/b9/Booster_Soleil_et_Lune_Solgaleo.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Soleil_et_Lune_Solgaleo.png')
), named as (
  select artwork, image_url, source_url,
         'Booster loose – Soleil et Lune – ' || artwork as name
  from artworks
)
insert into public.products (
  name, category, series, image_url, image_source_url, image_credit,
  image_usage_status, language, product_type, is_public,
  booster_packaging, booster_artwork
)
select n.name, 'sealed', 'Soleil et Lune', n.image_url, n.source_url,
       'Poképédia — ' || n.artwork, 'placeholder', 'FR', 'Booster loose', true,
       'loose', n.artwork
from named n
where not exists (
  select 1
  from public.products existing
  where existing.product_type = 'Booster loose'
    and existing.series = 'Soleil et Lune'
    and existing.booster_artwork = n.artwork
);
