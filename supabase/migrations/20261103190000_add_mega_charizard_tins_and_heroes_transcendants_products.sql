-- Add the two 2026 Mega Charizard Pokébox variants, the two Héros
-- Transcendants Duo Pack variants, and the sealed display of 10 bundles.
-- Inserts are idempotent and leave existing catalog rows untouched.

with candidates (
  name, series, product_type, release_date, image_url, image_source_url,
  image_credit, official_source_url
) as (
  values
    (
      'Pokébox – Méga-Dracaufeu X-ex – 2026',
      'Méga-Évolution', 'Pokébox', date '2026-02-20',
      'https://www.pokepedia.fr/images/7/72/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex.png',
      'https://www.pokepedia.fr/Fichier:Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex.png',
      'Poképédia — visuel de la boîte, source Kuro Star ; auteur crédité : The Pokémon Company International',
      'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex'
    ),
    (
      'Pokébox – Méga-Dracaufeu Y-ex – 2026',
      'Méga-Évolution', 'Pokébox', date '2026-02-20',
      'https://www.pokepedia.fr/images/1/12/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex.png',
      'https://www.pokepedia.fr/Fichier:Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex.png',
      'Poképédia — visuel de la boîte, source Kuro Star ; auteur crédité : The Pokémon Company International',
      'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex'
    ),
    (
      'Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika',
      'Méga-Évolution – Héros Transcendants', 'Duo Pack', date '2026-01-30',
      'https://imaginaire.com/docs/10312_SAC.JPG',
      'https://imaginaire.com/fr/cartes-de-jeux/pokemon-heros-transcendants-blister-de-2-paquets-saquedeneu-d-erika-francais-me2-5-mega-evolution.html',
      'Imaginaire — photographie du blister Saquedeneu d’Erika',
      null
    ),
    (
      'Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba',
      'Méga-Évolution – Héros Transcendants', 'Duo Pack', date '2026-01-30',
      'https://miixyscards.ch/8626-large_default/duo-pack-janvier-2026-fr.jpg',
      'https://miixyscards.ch/francais/3796-duo-pack-janvier-2026-fr.html',
      'Miixys Cards — photographie du blister Dodoala d’Okuba',
      null
    ),
    (
      'Display de 10 bundles – Méga-Évolution – Héros Transcendants',
      'Méga-Évolution – Héros Transcendants', 'Display de bundles', date '2026-04-24',
      'https://www.ultrajeux.com/images/produits/maxi/32403.jpg',
      'https://www.ultrajeux.com/produit-32403-me25-mega-evolution-heros-transcendants-display-de-10-bundles-0196214131637.html',
      'UltraJeux — photographie du présentoir de 10 bundles',
      'https://www.pokecardex.com/series/ME2.5'
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
  c.product_type, true, c.official_source_url
from candidates c
where not exists (
  select 1 from public.products p
  where p.name = c.name
    and p.product_type = c.product_type
    and p.language = 'FR'
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'component_type'
  ) then
    -- Pokébox contents: four boosters, the variant's guaranteed promo and
    -- a digital code card.
    insert into public.product_contents (
      product_id, component_type, item_name, set_name, quantity,
      is_random, sort_order, source_note
    )
    select p.id, c.component_type, c.item_name, c.set_name, c.quantity,
           false, c.sort_order, c.source_note
    from public.products p
    join (values
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Booster Méga-Évolution – Flammes Fantasmagoriques', 'Méga-Évolution – Flammes Fantasmagoriques', 2, 1, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 029 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Booster Méga-Évolution', 'Méga-Évolution', 1, 2, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 029 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Booster Écarlate et Violet – Flammes Obsidiennes', 'Écarlate et Violet – Flammes Obsidiennes', 1, 3, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 029 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'guaranteed_card', 'Méga-Dracaufeu X-ex — promo MEP 029', 'Promo Méga-Évolution', 1, 4, 'Carte promotionnelle MEP 029 identifiée sur Poképédia.'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'digital_code', 'Carte à code pour le JCC Pokémon Live', null, 1, 5, 'Carte à code incluse selon Poképédia.'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Booster Méga-Évolution – Flammes Fantasmagoriques', 'Méga-Évolution – Flammes Fantasmagoriques', 2, 1, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 030 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Booster Méga-Évolution', 'Méga-Évolution', 1, 2, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 030 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Booster Écarlate et Violet – Flammes Obsidiennes', 'Écarlate et Violet – Flammes Obsidiennes', 1, 3, 'Poképédia : contenu de la Pokébox française, deux boosters Flammes Fantasmagoriques, un booster Méga-Évolution, un booster Flammes Obsidiennes, la promo MEP 030 et une carte à code.'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'guaranteed_card', 'Méga-Dracaufeu Y-ex — promo MEP 030', 'Promo Méga-Évolution', 1, 4, 'Carte promotionnelle MEP 030 identifiée sur Poképédia.'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'digital_code', 'Carte à code pour le JCC Pokémon Live', null, 1, 5, 'Carte à code incluse selon Poképédia.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'booster', 'Booster Héros Transcendants', 'Méga-Évolution – Héros Transcendants', 2, 1, 'Contenu vérifié : deux boosters Héros Transcendants, la carte promo Saquedeneu d’Erika et le jeton d’Erika.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'guaranteed_card', 'Carte promo Saquedeneu d’Erika', 'Méga-Évolution – Héros Transcendants', 1, 2, 'Carte promo variant Saquedeneu d’Erika.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'accessory', 'Jeton métallisé d’Erika', null, 1, 3, 'Jeton assorti inclus dans la variante Saquedeneu d’Erika.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'booster', 'Booster Héros Transcendants', 'Méga-Évolution – Héros Transcendants', 2, 1, 'Contenu vérifié : deux boosters Héros Transcendants, la carte promo Dodoala d’Okuba et le jeton d’Okuba.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'guaranteed_card', 'Carte promo Dodoala d’Okuba', 'Méga-Évolution – Héros Transcendants', 1, 2, 'Carte promo variant Dodoala d’Okuba.'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'accessory', 'Jeton métallisé d’Okuba', null, 1, 3, 'Jeton assorti inclus dans la variante Dodoala d’Okuba.'),
      ('Display de 10 bundles – Méga-Évolution – Héros Transcendants', 'booster', 'Boosters Héros Transcendants (10 bundles de 6)', 'Méga-Évolution – Héros Transcendants', 60, 1, 'Display scellé comprenant 10 bundles de 6 boosters, soit 60 boosters au total.')
    ) as c(product_name, component_type, item_name, set_name, quantity, sort_order, source_note)
      on p.name = c.product_name
    where not exists (
      select 1 from public.product_contents pc
      where pc.product_id = p.id and pc.item_name = c.item_name
    );

  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'content_type'
  ) then
    -- Production's legacy content_type constraint uses promo/other rather
    -- than guaranteed_card/digital_code.
    insert into public.product_contents (
      product_id, content_type, item_name, quantity, source_url,
      source_label, confidence, content_role
    )
    select p.id, c.content_type, c.item_name, c.quantity,
           c.source_url, c.source_label, 'verified', 'guaranteed'
    from public.products p
    join (values
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Méga-Évolution – Flammes Fantasmagoriques', 2, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex', 'Poképédia — Pokébox Méga-Dracaufeu X'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Méga-Évolution', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex', 'Poképédia — Pokébox Méga-Dracaufeu X'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'booster', 'Écarlate et Violet – Flammes Obsidiennes', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex', 'Poképédia — Pokébox Méga-Dracaufeu X'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'promo', 'Méga-Dracaufeu X-ex — promo MEP 029', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex', 'Poképédia — promo MEP 029'),
      ('Pokébox – Méga-Dracaufeu X-ex – 2026', 'other', 'Carte à code pour le JCC Pokémon Live', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_X-ex', 'Poképédia — carte à code'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Méga-Évolution – Flammes Fantasmagoriques', 2, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex', 'Poképédia — Pokébox Méga-Dracaufeu Y'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Méga-Évolution', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex', 'Poképédia — Pokébox Méga-Dracaufeu Y'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'booster', 'Écarlate et Violet – Flammes Obsidiennes', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex', 'Poképédia — Pokébox Méga-Dracaufeu Y'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'promo', 'Méga-Dracaufeu Y-ex — promo MEP 030', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex', 'Poképédia — promo MEP 030'),
      ('Pokébox – Méga-Dracaufeu Y-ex – 2026', 'other', 'Carte à code pour le JCC Pokémon Live', 1, 'https://www.pokepedia.fr/Bo%C3%AEte_M%C3%A9ga-Dracaufeu_M%C3%A9ga-Dracaufeu_Y-ex', 'Poképédia — carte à code'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'booster', 'Héros Transcendants', 2, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'King Jouet — contenu du Duo Pack'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'promo', 'Carte promo Saquedeneu d’Erika', 1, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'Duo Pack Héros Transcendants — variante Saquedeneu'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Saquedeneu d’Erika', 'accessory', 'Jeton métallisé d’Erika', 1, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'Duo Pack Héros Transcendants — variante Saquedeneu'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'booster', 'Héros Transcendants', 2, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'King Jouet — contenu du Duo Pack'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'promo', 'Carte promo Dodoala d’Okuba', 1, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'Duo Pack Héros Transcendants — variante Dodoala'),
      ('Duo Pack – Méga-Évolution – Héros Transcendants – Dodoala d’Okuba', 'accessory', 'Jeton métallisé d’Okuba', 1, 'https://www.king-jouet.mq/jeu-jouet/jeux-societes/cartes-a-collectionner/ref-0196214131798.htm', 'Duo Pack Héros Transcendants — variante Dodoala'),
      ('Display de 10 bundles – Méga-Évolution – Héros Transcendants', 'booster', 'Héros Transcendants (10 bundles de 6)', 60, 'https://www.ultrajeux.com/produit-32403-me25-mega-evolution-heros-transcendants-display-de-10-bundles-0196214131637.html', 'UltraJeux — présentoir officiel, 10 bundles de 6 boosters')
    ) as c(product_name, content_type, item_name, quantity, source_url, source_label)
      on p.name = c.product_name
    where not exists (
      select 1 from public.product_contents pc
      where pc.product_id = p.id and pc.item_name = c.item_name
    );
  end if;
end
$$;
