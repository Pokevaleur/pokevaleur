-- Restore the Shining Legends chest image and fill the missing Collector Chest entries.
-- Keep the existing 2018 chest; only complete its known French release date.
update public.products
set release_date = '2018-04-18',
    release_year = 2018,
    release_period = '18 avril 2018'
where name = 'Coffre de collection 2018'
  and product_type = 'Coffre de collection'
  and release_date is null;

update public.products
set image_url = 'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P4008PC_210-80325_02.jpg',
    image_source_url = 'https://www.pokemoncenter.com/product/210-80325/pokemon-tcg-shining-legends-collector-chest',
    image_credit = 'Pokémon Center'
where name = 'Coffre de collection Légendes Brillantes'
  and series = 'Légendes Brillantes'
  and product_type = 'Coffre de collection';

with missing_chests (
  name, series, release_date, release_year, release_period, image_url,
  image_source_url, image_credit, official_source_url
) as (
  values
    (
      'Coffre de collection – Automne 2022',
      'Épée et Bouclier',
      '2022-11-18'::date,
      2022,
      '18 novembre 2022',
      'https://product-images.tcgplayer.com/284930.jpg',
      'https://www.tcgplayer.com/product/284930/pokemon-swsh12-silver-tempest-fall-2022-collector-chest',
      'TCGplayer',
      'https://www.pokemon.com/us/pokemon-tcg/product-gallery/collector-chest-fall-2022-hisuian-voltorb-hisuian-growlithe-hisuian-sneasel'
    ),
    (
      'Coffre de collection – Automne 2025',
      'Méga-Évolution',
      '2025-12-05'::date,
      2025,
      '5 décembre 2025',
      'https://i5.walmartimages.com/seo/Fall-2025-Collector-Chest_76102a4a-1839-4d6c-8995-3a9962805364.2f870a26cc9c4dc5b61a78d64420ae2b.jpeg',
      'https://www.walmart.com/ip/17909423419',
      'Walmart',
      'https://www.pokemon.com/us/pokemon-tcg/product-gallery/collector-chest-fall-2025'
    )
)
insert into public.products (
  name, category, series, release_date, release_year, release_period,
  image_url, image_source_url, image_credit, language, product_type,
  official_source_url, is_public
)
select
  chest.name, 'sealed', chest.series, chest.release_date, chest.release_year,
  chest.release_period, chest.image_url, chest.image_source_url, chest.image_credit,
  'FR', 'Coffre de collection', chest.official_source_url, true
from missing_chests chest
where not exists (
  select 1
  from public.products existing
  where existing.name = chest.name
    and existing.product_type = 'Coffre de collection'
);
