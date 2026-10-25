-- Use the Pokémon.com product image supplied by the administrator for the 151 Booster Bundle.
-- Update only the unique matching record if it still uses the previous image.
UPDATE public.products
SET image_url = '/catalogue/booster-bundle-151-fr.jpg',
    image_source_url = 'https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/',
    image_credit = 'Pokémon.com (capture fournie par l’administrateur)',
    image_usage_status = 'user_provided'
WHERE name = 'Lot de 6 boosters Écarlate et Violet – 151'
  AND series = 'Écarlate et Violet – 151'
  AND category = 'sealed'
  AND product_type = 'Booster bundle'
  AND image_url = 'https://cartes-pokemon.com/cdn/shop/files/151-6-Boosters-Cartes-Pokemon.jpg?v=1750150430'
  AND (
    SELECT count(*)
    FROM public.products
    WHERE name = 'Lot de 6 boosters Écarlate et Violet – 151'
      AND series = 'Écarlate et Violet – 151'
      AND category = 'sealed'
      AND product_type = 'Booster bundle'
      AND image_url = 'https://cartes-pokemon.com/cdn/shop/files/151-6-Boosters-Cartes-Pokemon.jpg?v=1750150430'
  ) = 1;