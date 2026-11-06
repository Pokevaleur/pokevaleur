-- Complete the sealed deck catalogue from published product imagery and
-- current Cardmarket trend references. Updates are limited to these 16 rows.
UPDATE public.products AS p
SET image_url = v.image_url,
    image_source_url = v.image_source_url,
    image_credit = v.image_credit,
    image_usage_status = v.image_usage_status,
    current_value = v.current_value,
    price_source = v.price_source,
    price_source_url = v.price_source_url,
    price_updated_at = now()
FROM (VALUES
  (
    'Deck à thème Let’s Play, Évoli!',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5275PC_699-16934_03.jpg',
    'https://www.pokemoncenter.com/product/699-16934/pokemon-tcg-lets-play-eevee-theme-deck',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 38.90::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/lets-play-eevee-theme-deck-373092/'
  ),
  (
    'Deck à thème Let’s Play, Pikachu!',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5275_699-16933_04.jpg',
    'https://www.pokemoncenter.com/product/699-16933/pokemon-tcg-lets-play-pikachu-theme-deck',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 40.13::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/lets-play-pikachu-theme-deck-373091/'
  ),
  (
    'Deck Championnats du Monde 2018 – Buzzroc',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5008_699-16912_01.jpg',
    'https://www.pokemoncenter.com/product/699-16912/pokemon-tcg-2018-world-championships-deck-naohito-inoue-buzzroc',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 76.32::numeric,
    'Tendance Cardmarket via Holotrends · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2018-buzzroc-365492/'
  ),
  (
    'Deck Championnats du Monde 2018 – Dragones y Sombras',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5008_699-16915_01.jpg',
    'https://www.pokemoncenter.com/product/699-16915/pokemon-tcg-2018-world-championships-deck-pedro-eugenio-torres-dragones-y-sombras',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 124.59::numeric,
    'Tendance Cardmarket via Holotrends · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2018-dragones-y-sombras-365493/'
  ),
  (
    'Deck Championnats du Monde 2018 – Garbanette',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5008_699-16913_01.jpg',
    'https://www.pokemoncenter.com/product/699-16913/pokemon-tcg-2018-world-championships-deck-magnus-pedersen-garbanette',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 91.76::numeric,
    'Tendance Cardmarket via Holotrends · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2018-garbanette-365494/'
  ),
  (
    'Deck Championnats du Monde 2018 – Victory Map',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5008_699-16914_01.jpg',
    'https://www.pokemoncenter.com/product/699-16914/pokemon-tcg-2018-world-championships-deck-robin-schulz-victory-map',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 92.75::numeric,
    'Tendance Cardmarket via Holotrends · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2018-victory-map-365495/'
  ),
  (
    'Deck Championnats du Monde 2019 – Haruki Miyamoto',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5741_699-16985_01.jpg',
    'https://www.pokemoncenter.com/product/699-16985/pokemon-tcg-2019-world-championships-deck-haruki-miyamoto-pikarom-judge',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 73.66::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2019-pikarom-judge-407434/'
  ),
  (
    'Deck Championnats du Monde 2019 – Henry Brand',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5741_699-16983_01.jpg',
    'https://www.pokemoncenter.com/product/699-16983/pokemon-tcg-2019-world-championships-deck-henry-brand-perfection',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 71.61::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2019-perfection-407429/'
  ),
  (
    'Deck Championnats du Monde 2019 – Kaya Lichtleitner',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5741_699-16984_01.jpg',
    'https://www.pokemoncenter.com/product/699-16984/pokemon-tcg-2019-world-championships-deck-kaya-lichtleitner-fire-box',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 86.64::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2019-fire-box-407419/'
  ),
  (
    'Deck Championnats du Monde 2019 – Shintaro Ito',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P5741_699-16986_01.jpg',
    'https://www.pokemoncenter.com/product/699-16986/pokemon-tcg-2019-world-championships-deck-shintaro-ito-mind-blown',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 66.06::numeric,
    'Tendance Cardmarket via Holotrends · 05/11/2026',
    'https://holotrends.com/pokemon/sealed/wcd-2019-mind-blown-407424/'
  ),
  (
    'Deck Combat 30e Anniversaire – Mentali-ex',
    'https://pokemael.com/cdn/shop/files/Deck_de_Combat_Mentali-ex_Pokemon_30e_Anniversaire_FR_9fdac599-c6e1-4763-be57-06e33ea4c423.png?v=1782836595',
    'https://pokemael.com/products/pokemon-30th-celebration-battle-deck-mentali-ex-espeon-ex-en',
    'Visuel produit · PokéMael', 'placeholder', 44.42::numeric,
    'Cote Cardmarket calculée par ScanCote · 05/11/2026',
    'https://scancote.fr/cartes/30e-anniversaire/produits/30th-celebration-espeon-ex-battle-deck'
  ),
  (
    'Deck Combat 30e Anniversaire – Noctali-ex',
    'https://cardnews.io/images/pokemon-Deck-Combat-30eme-Anniversaire-Noctali-ex.webp',
    'https://cardnews.io/fr/events/pokemon-deck-combat-30eme-anniversaire-noctali-ex/',
    'Visuel produit · CardNews', 'placeholder', 45.26::numeric,
    'Cote Cardmarket calculée par ScanCote · 05/11/2026',
    'https://scancote.fr/cartes/30e-anniversaire/produits/30th-celebration-umbreon-ex-battle-deck'
  ),
  (
    'Deck Combat de Ligue – Pikachu et Zekrom-GX',
    'https://tbcgames.com/cdn/shop/products/unnamed_62901aa8-661e-4112-bc14-e2e47f91a6f0.jpg?v=1674666083',
    'https://tbcgames.com/es/products/pokemon-tcg-league-battle-deck-pikachu-zekrom-gx-or-reshiram-charizard-gx',
    'Photo produit · TBC Games', 'placeholder', 250.90::numeric,
    'Tendance Cardmarket via Holotrends · 01/11/2026',
    'https://holotrends.com/pokemon/sealed/league-battle-decks-pikachu-zekrom-gx-453393/'
  ),
  (
    'Deck Combat de Ligue – Reshiram et Dracaufeu-GX',
    'https://eclipsecards.com/cdn/shop/products/pokemon-reshiram-charizard-gx-league-battle-deck.jpg?v=1612880695',
    'https://eclipsecards.com/products/pokemon-reshiram-and-charizard-league-battle-deck',
    'Photo produit · Eclipse Cards', 'placeholder', 169.67::numeric,
    'Tendance Cardmarket via Holotrends · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/league-battle-decks-reshiram-charizard-gx-453398/'
  ),
  (
    'Deck Combat de Ligue – Zacian-V',
    'https://www.pokemoncenter.com/images/DAMRoot/High/10000/P6650_290-80797_01.jpg',
    'https://www.pokemoncenter.com/product/290-80797/pokemon-tcg-zacian-v-league-battle-deck',
    'The Pokémon Company / Pokémon Center', 'official_authorized', 39.33::numeric,
    'Cote Card Agora',
    'https://card-agora.com/fr/catalogue/pokemon/products/deck'
  ),
  (
    'Decks Arène de Combat – Rayquaza-GX contre Ultra-Necrozma-GX',
    'https://levelonegameshop.com/cdn/shop/products/6289df466187a387f2461b4d61078d09.jpg?v=1593569445',
    'https://levelonegameshop.com/products/pokemon-tcg-battle-arena-deck-rayquaza-vs-ultra-necrozma-8',
    'Photo produit · Level One Game Shop', 'placeholder', 138.77::numeric,
    'Somme des tendances Cardmarket des deux decks · 27/10/2026',
    'https://holotrends.com/pokemon/sealed/battle-arena-decks-rayquaza-gx-vs-ultra-necrozma-gx-rayquaza-gx-393952/'
  )
) AS v(name, image_url, image_source_url, image_credit, image_usage_status, current_value, price_source, price_source_url)
WHERE p.name = v.name
  AND p.category = 'sealed'
  AND p.is_public = true;
