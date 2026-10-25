-- Use the Pokémon.com product image supplied by the administrator for the 151 Booster Bundle.
-- The old-image guard keeps a newer catalogue edit from being overwritten.
UPDATE public.products
SET image_url = '/catalogue/booster-bundle-151-fr.jpg',
    image_source_url = 'https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/',
    image_credit = 'Pokémon.com (capture fournie par l’administrateur)',
    image_usage_status = 'user_provided'
WHERE id = 'de792f7c-724c-4355-89cd-d58b6368aab5'
  AND name = 'Lot de 6 boosters Écarlate et Violet – 151'
  AND image_url = 'https://cartes-pokemon.com/cdn/shop/files/151-6-Boosters-Cartes-Pokemon.jpg?v=1750150430';
