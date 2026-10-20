-- Add individually searchable loose-booster catalogue entries for every
-- Poképédia booster artwork currently represented by an Artset in the catalog.
-- Existing generic booster and collection rows are intentionally preserved.
with artworks(series, artwork, image_url, source_url) as (
  values
    ('Écarlate et Violet – Aventures Ensemble', 'Ampibidou de Mashynn', 'https://www.pokepedia.fr/images/0/0b/Booster_%C3%89carlate_et_Violet_Aventures_Ensemble_Ampibidou_de_Mashynn.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Aventures_Ensemble_Ampibidou_de_Mashynn.png'),
    ('Écarlate et Violet – Aventures Ensemble', 'Mélofée de Lilie', 'https://www.pokepedia.fr/images/a/a6/Booster_%C3%89carlate_et_Violet_Aventures_Ensemble_M%C3%A9lof%C3%A9e_de_Lilie.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Aventures_Ensemble_M%C3%A9lof%C3%A9e_de_Lilie.png'),
    ('Écarlate et Violet – Aventures Ensemble', 'Zacian de Nabil', 'https://www.pokepedia.fr/images/7/7c/Booster_%C3%89carlate_et_Violet_Aventures_Ensemble_Zacian_de_Nabil.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Aventures_Ensemble_Zacian_de_Nabil.png'),
    ('Écarlate et Violet – Aventures Ensemble', 'Zoroark de N', 'https://www.pokepedia.fr/images/d/de/Booster_%C3%89carlate_et_Violet_Aventures_Ensemble_Zoroark_de_N.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Aventures_Ensemble_Zoroark_de_N.png'),
    ('Écarlate et Violet – Forces Temporelles', 'Chef-de-Fer', 'https://www.pokepedia.fr/images/0/04/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Chef-de-Fer.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Forces_Temporelles_Chef-de-Fer.png'),
    ('Écarlate et Violet – Forces Temporelles', 'Vert-de-Fer', 'https://www.pokepedia.fr/images/9/95/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Forces_Temporelles_Vert-de-Fer.png'),
    ('Écarlate et Violet – Forces Temporelles', 'Ire-Foudre', 'https://www.pokepedia.fr/images/a/a5/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Ire-Foudre.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Forces_Temporelles_Ire-Foudre.png'),
    ('Écarlate et Violet – Forces Temporelles', 'Serpente-Eau', 'https://www.pokepedia.fr/images/2/2a/Booster_%C3%89carlate_et_Violet_Forces_Temporelles_Serpente-Eau.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_Forces_Temporelles_Serpente-Eau.png'),
    ('Écarlate et Violet – Étincelles Déferlantes', 'Noadkoko d’Alola Téracristal Stellaire', 'https://www.pokepedia.fr/images/5/5a/Booster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Noadkoko_d%27Alola_T%C3%A9racristal_Stellaire.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Noadkoko_d%27Alola_T%C3%A9racristal_Stellaire.png'),
    ('Écarlate et Violet – Étincelles Déferlantes', 'Pondralugon', 'https://www.pokepedia.fr/images/3/31/Booster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Pondralugon.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Pondralugon.png'),
    ('Écarlate et Violet – Étincelles Déferlantes', 'Latias et Latios', 'https://www.pokepedia.fr/images/4/49/Booster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Latias_et_Latios.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Latias_et_Latios.png'),
    ('Écarlate et Violet – Étincelles Déferlantes', 'Pikachu Téracristal Stellaire', 'https://www.pokepedia.fr/images/d/d4/Booster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Pikachu_T%C3%A9racristal_Stellaire.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89tincelles_D%C3%A9ferlantes_Pikachu_T%C3%A9racristal_Stellaire.png'),
    ('Écarlate et Violet – Évolutions à Paldea', 'Miascarade', 'https://www.pokepedia.fr/images/a/a4/Booster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Miascarade.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Miascarade.png'),
    ('Écarlate et Violet – Évolutions à Paldea', 'Flâmigator', 'https://www.pokepedia.fr/images/1/1c/Booster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Fl%C3%A2migator.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Fl%C3%A2migator.png'),
    ('Écarlate et Violet – Évolutions à Paldea', 'Palmaval', 'https://www.pokepedia.fr/images/c/c9/Booster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Palmaval.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Palmaval.png'),
    ('Écarlate et Violet – Évolutions à Paldea', 'Baojian', 'https://www.pokepedia.fr/images/8/85/Booster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Baojian.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Baojian.png'),
    ('Écarlate et Violet – Évolutions à Paldea', 'Dinglu', 'https://www.pokepedia.fr/images/d/d4/Booster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Dinglu.png', 'https://www.pokepedia.fr/Fichier%3ABooster_%C3%89carlate_et_Violet_%C3%89volutions_%C3%A0_Paldea_Dinglu.png'),
    ('XY – Évolutions', 'Salamèche, Pikachu et Machoc', 'https://www.pokepedia.fr/images/7/78/Booster_XY_%C3%89volutions_Salam%C3%A8che_Pikachu_Machoc.png', 'https://www.pokepedia.fr/Fichier%3ABooster_XY_%C3%89volutions_Salam%C3%A8che_Pikachu_Machoc.png'),
    ('XY – Évolutions', 'Méga-Dracaufeu Y', 'https://www.pokepedia.fr/images/4/42/Booster_XY_%C3%89volutions_M%C3%A9ga-Dracaufeu_Y.png', 'https://www.pokepedia.fr/Fichier%3ABooster_XY_%C3%89volutions_M%C3%A9ga-Dracaufeu_Y.png'),
    ('XY – Évolutions', 'Méga-Florizarre', 'https://www.pokepedia.fr/images/2/29/Booster_XY_%C3%89volutions_M%C3%A9ga-Florizarre.png', 'https://www.pokepedia.fr/Fichier%3ABooster_XY_%C3%89volutions_M%C3%A9ga-Florizarre.png'),
    ('XY – Évolutions', 'Méga-Tortank', 'https://www.pokepedia.fr/images/d/d2/Booster_XY_%C3%89volutions_M%C3%A9ga-Tortank.png', 'https://www.pokepedia.fr/Fichier%3ABooster_XY_%C3%89volutions_M%C3%A9ga-Tortank.png'),
    ('XY – Évolutions', 'Raichu', 'https://www.pokepedia.fr/images/5/5e/Booster_XY_%C3%89volutions_Raichu.png', 'https://www.pokepedia.fr/Fichier%3ABooster_XY_%C3%89volutions_Raichu.png')
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
