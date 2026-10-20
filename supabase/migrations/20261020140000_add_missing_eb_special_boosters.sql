-- Add the documented loose-pack artworks for special Sword & Shield expansions.
-- Insert missing rows only; retain all existing product, image and price data.
with artworks(series, artwork, image_url, source_url) as (
  values
    ('La Voie du Maître', 'Charmilly Gigamax', 'https://www.pokepedia.fr/images/e/e6/Booster_La_Voie_du_Ma%C3%AEtre_Charmilly_Gigamax.png', 'https://www.pokepedia.fr/Fichier%3ABooster_La_Voie_du_Ma%C3%AEtre_Charmilly_Gigamax.png'),
    ('La Voie du Maître', 'Gardevoir', 'https://www.pokepedia.fr/images/3/39/Booster_La_Voie_du_Ma%C3%AEtre_Gardevoir.png', 'https://www.pokepedia.fr/Fichier%3ABooster_La_Voie_du_Ma%C3%AEtre_Gardevoir.png'),
    ('La Voie du Maître', 'Ixon', 'https://www.pokepedia.fr/images/8/8a/Booster_La_Voie_du_Ma%C3%AEtre_Ixon.png', 'https://www.pokepedia.fr/Fichier%3ABooster_La_Voie_du_Ma%C3%AEtre_Ixon.png'),
    ('La Voie du Maître', 'Torgamord Gigamax', 'https://www.pokepedia.fr/images/7/7e/Booster_La_Voie_du_Ma%C3%AEtre_Torgamord_Gigamax.png', 'https://www.pokepedia.fr/Fichier%3ABooster_La_Voie_du_Ma%C3%AEtre_Torgamord_Gigamax.png'),
    ('Célébrations', 'Booster Célébrations', 'https://www.pokepedia.fr/images/d/d8/Booster_C%C3%A9l%C3%A9brations_Recto.png', 'https://www.pokepedia.fr/Fichier%3ABooster_C%C3%A9l%C3%A9brations_Recto.png'),
    ('Pokémon GO', 'Pokémon GO', 'https://www.pokepedia.fr/images/3/34/Booster_Pok%C3%A9mon_GO.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Pok%C3%A9mon_GO.png'),
    ('Épée et Bouclier – Zénith Suprême', 'Zacian et Zamazenta', 'https://www.pokepedia.fr/images/2/2b/Booster_Z%C3%A9nith_Supr%C3%AAme_Zacian_et_Zamazenta.png', 'https://www.pokepedia.fr/Fichier%3ABooster_Z%C3%A9nith_Supr%C3%AAme_Zacian_et_Zamazenta.png')
), named as (
  select series, artwork, image_url, source_url,
         'Booster loose – ' || series || ' – ' || artwork as name
  from artworks
)
insert into public.products (
  name, category, series, image_url, image_source_url, image_credit,
  image_usage_status, language, product_type, is_public,
  booster_packaging, booster_artwork
)
select n.name, 'sealed', n.series, n.image_url, n.source_url,
       'Poképédia — ' || n.artwork, 'placeholder', 'FR', 'Booster loose', true,
       'loose', n.artwork
from named n
where not exists (
  select 1
  from public.products existing
  where existing.product_type = 'Booster loose'
    and existing.series = n.series
    and existing.booster_artwork = n.artwork
);
