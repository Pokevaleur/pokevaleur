with image_updates(id, image_url, image_source_url, image_credit) as (
  values
    (
      '2b41f6df-d06c-4f81-9fed-071df312bb8d'::uuid,
      'https://hikarudistribution.com/cdn/shop/files/MegaEvolutionetbgardevoir.png?v=1760511831&width=640',
      'https://hikarudistribution.com/en/products/coffret-dresseur-d-elite-mega-gardevoir-etb-mega-evolution-me-francais',
      'Hikaru Distribution — visuel produit'
    ),
    (
      'b6a64cdb-8a35-4090-bd7d-70ef69408a35'::uuid,
      'https://www.king-jouet.com/fstrz/r/s/images.king-jouet.com/6/gu1007727_6.jpg',
      'https://www.king-jouet.com/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-1007727-coffret-dresseur-d-elite-pokemon-me05-nuit-noire.htm',
      'King Jouet — visuel produit'
    ),
    (
      'e6418c97-7137-4357-bff3-2094fcda0746'::uuid,
      'https://oupi.eu/22747-large_default/elite-trainer-box-chaos-ascendant-me04-etb-mega-evolution-pokemon.jpg',
      'https://oupi.eu/en/pokemon-box-set/7567-elite-trainer-box-chaos-ascendant-me04-etb-mega-evolution-pokemon.html',
      'Oupi — visuel produit'
    ),
    (
      '707358fe-9886-4a74-81ee-0d33e0cf0144'::uuid,
      'https://imaginaire.com/en/images/POKEMON-%C3%89QUILIBRE-PARFAIT-COFFRET-DRESSEUR-D-%C3%89LITE-FRENCH-ME03-M%C3%89GA-%C3%89VOLUTION__0196214136380.JPG',
      'https://imaginaire.com/en/trading-card-games/pokemon-equilibre-parfait-coffret-dresseur-d-elite-french-me03-mega-evolution.html',
      'Imaginaire — visuel produit'
    ),
    (
      '44b16374-76ba-40a5-b256-02b58bbb685d'::uuid,
      'https://cdn.shopify.com/s/files/1/1023/7768/5337/files/coffret-dresseur-elite-pokemon-me2-5-mega-evolution-heros-transcendants-mega-dracolosse-fr.png?v=1774385399&width=640',
      'https://www.cmay-collections.com/en/product/coffret-dresseur-elite-pokemon-me2-5-mega-evolution-heros-transcendants-mega-dracolosse-fr',
      'CMay Collections — visuel produit'
    )
)
update public.products as product
set image_url = source.image_url,
    image_source_url = source.image_source_url,
    image_credit = source.image_credit
from image_updates as source
where product.id = source.id
  and product.product_type = 'ETB'
  and product.image_url like 'https://www.pokepedia.fr/images/%'
  and product.image_thumbnail_data is null;
