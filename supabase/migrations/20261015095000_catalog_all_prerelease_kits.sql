with expected(series, release_year) as (
  values
    ('Épée et Bouclier – Clash des Rebelles', 2020),
    ('Épée et Bouclier – Ténèbres Embrasées', 2020),
    ('Épée et Bouclier – Voltage Éclatant', 2020),
    ('Épée et Bouclier – Styles de Combat', 2021),
    ('Épée et Bouclier – Règne de Glace', 2021),
    ('Épée et Bouclier – Évolution Céleste', 2021),
    ('Épée et Bouclier – Poing de Fusion', 2021),
    ('Épée et Bouclier – Stars Étincelantes', 2022),
    ('Épée et Bouclier – Astres Radieux', 2022),
    ('Épée et Bouclier – Tempête Argentée', 2022),
    ('Écarlate et Violet', 2023),
    ('Écarlate et Violet – Évolutions à Paldea', 2023),
    ('Écarlate et Violet – Flammes Obsidiennes', 2023),
    ('Écarlate et Violet – Faille Paradoxe', 2023),
    ('Écarlate et Violet – Forces Temporelles', 2024),
    ('Écarlate et Violet – Mascarade Crépusculaire', 2024),
    ('Écarlate et Violet – Couronne Stellaire', 2024),
    ('Écarlate et Violet – Étincelles Déferlantes', 2024)
)
insert into public.products (name, category, series, currency, is_public, product_type, release_year)
select 'Kit Avant-première – ' || expected.series, 'sealed', expected.series, 'EUR', true, 'Kit Avant-première', expected.release_year
from expected
where exists (select 1 from public.products p where p.series = expected.series)
  and not exists (
    select 1 from public.products p
    where p.series = expected.series
      and p.product_type in ('Build & Battle', 'Kit Avant-première')
  );

insert into public.products (name, category, series, currency, is_public, product_type, release_year)
select
  'Kit AP Écarlate et Violet – Aventures Ensemble (4 boosters)',
  'sealed',
  'Écarlate et Violet – Aventures Ensemble',
  'EUR',
  true,
  'Kit Avant-première',
  2025
where exists (select 1 from public.products p where p.series = 'Écarlate et Violet – Aventures Ensemble')
  and not exists (
    select 1 from public.products p
    where p.name = 'Kit AP Écarlate et Violet – Aventures Ensemble (4 boosters)'
      and p.series = 'Écarlate et Violet – Aventures Ensemble'
  );

insert into public.product_contents (
  product_id, content_type, item_name, quantity, source_label, confidence, content_role
)
select p.id, 'booster', p.series, 4, 'Pokémon officiel', 'verified', 'guaranteed'
from public.products p
where p.product_type in ('Build & Battle', 'Kit Avant-première')
  and p.series is not null
  and not exists (
    select 1 from public.product_contents pc
    where pc.product_id = p.id
      and pc.content_type = 'booster'
      and pc.item_name = p.series
      and pc.quantity = 4
      and pc.content_role = 'guaranteed'
  );
