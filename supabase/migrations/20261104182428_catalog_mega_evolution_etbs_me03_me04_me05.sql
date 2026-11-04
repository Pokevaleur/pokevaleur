-- Add the missing French Elite Trainer Boxes for ME03, ME04, and ME05.
-- Insert only; existing catalogue rows and collection references are untouched.
with candidates (
  name, series, release_date, image_url, image_source_url,
  image_credit, official_source_url
) as (
  values
    (
      'Coffret Dresseur d’élite Méga-Évolution – Équilibre Parfait',
      'Méga-Évolution – Équilibre Parfait', date '2026-03-27',
      'https://www.pokepedia.fr/images/b/b6/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_%C3%89quilibre_Parfait.png',
      'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_%C3%89quilibre_Parfait.png',
      'Poképédia — visuel du coffret, source The Pokémon Company',
      'https://www.pokepedia.fr/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_%C3%89quilibre_Parfait'
    ),
    (
      'Coffret Dresseur d’élite Méga-Évolution – Chaos Ascendant',
      'Méga-Évolution – Chaos Ascendant', date '2026-05-22',
      'https://www.pokepedia.fr/images/3/3d/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Chaos_Ascendant.png',
      'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Chaos_Ascendant.png',
      'Poképédia — visuel du coffret, source The Pokémon Company',
      'https://www.pokepedia.fr/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Chaos_Ascendant'
    ),
    (
      'Coffret Dresseur d’élite Méga-Évolution – Nuit Noire',
      'Méga-Évolution – Nuit Noire', date '2026-07-17',
      'https://www.pokepedia.fr/images/4/47/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Nuit_Noire.png',
      'https://www.pokepedia.fr/Fichier:Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Nuit_Noire.png',
      'Poképédia — visuel du coffret, source The Pokémon Company',
      'https://www.pokepedia.fr/Coffret_Dresseur_d%27%C3%A9lite_M%C3%A9ga-%C3%89volution_Nuit_Noire'
    )
)
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, official_source_url
)
select
  c.name, 'sealed', c.series, c.release_date, 2026, c.image_url,
  c.image_source_url, c.image_credit, 'placeholder', 'FR',
  'ETB', true, c.official_source_url
from candidates c
where not exists (
  select 1 from public.products p
  where p.name = c.name
    and p.product_type = 'ETB'
    and p.language = 'FR'
);
