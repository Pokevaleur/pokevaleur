-- Add the four French back-to-school Duo Packs with their distinct erasers,
-- plus the Victini Illustration Collection. Existing generic and unrelated
-- catalog rows are deliberately left untouched.

with new_products(
  name, series, product_type, release_date, release_year, image_url,
  image_source_url, image_credit, official_source_url, booster_artwork
) as (
  values
    (
      'Duopack avec gomme Pokémon 2023 – Gourmelet',
      'Épée et Bouclier / Écarlate et Violet', 'Duo Pack',
      date '2024-07-05', 2024,
      'https://www.pokepedia.fr/images/b/bb/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet.png',
      'https://www.pokepedia.fr/Fichier:Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet.png',
      'Poképédia — photographie de produit (source indiquée : The Pokémon Company International)',
      'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet',
      'Gomme Gourmelet'
    ),
    (
      'Duopack avec gomme Pokémon 2023 – Olivini',
      'Épée et Bouclier / Écarlate et Violet', 'Duo Pack',
      date '2024-07-05', 2024,
      'https://www.pokepedia.fr/images/7/72/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini.png',
      'https://www.pokepedia.fr/Fichier:Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini.png',
      'Poképédia — photographie de produit (source indiquée : The Pokémon Company International)',
      'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini',
      'Gomme Olivini'
    ),
    (
      'Duopack avec gomme Pokémon 2024 – Ectoplasma',
      'Écarlate et Violet', 'Duo Pack',
      date '2024-07-05', 2024,
      'https://www.pokepedia.fr/images/7/7c/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma.png',
      'https://www.pokepedia.fr/Fichier:Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma.png',
      'Poképédia — photographie Amazon du produit, auteur crédité : The Pokémon Company International',
      'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma',
      'Gomme Ectoplasma'
    ),
    (
      'Duopack avec gomme Pokémon 2024 – Ampibidou',
      'Écarlate et Violet', 'Duo Pack',
      date '2024-07-05', 2024,
      'https://www.pokepedia.fr/images/0/02/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou.png',
      'https://www.pokepedia.fr/Fichier:Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou.png',
      'Poképédia — photographie Amazon du produit, auteur crédité : The Pokémon Company International',
      'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou',
      'Gomme Ampibidou'
    ),
    (
      'Coffret Illustration Unys – Victini – Foudre Noire et Flamme Blanche',
      'Écarlate et Violet – Foudre Noire et Flamme Blanche', 'Coffret',
      date '2025-08-01', 2025,
      'https://www.pokepedia.fr/images/9/9d/Collection_Illustration_Unys_Victini.png',
      'https://www.pokepedia.fr/Fichier:Collection_Illustration_Unys_Victini.png',
      'Poképédia — visuel produit officiel',
      'https://www.asmodee.fr/product/coffret-collection-illustration-unys-victini/',
      null
    )
)
insert into public.products (
  name, category, series, release_date, release_year, image_url,
  image_source_url, image_credit, image_usage_status, language,
  product_type, is_public, official_source_url, booster_artwork
)
select
  n.name, 'sealed', n.series, n.release_date, n.release_year, n.image_url,
  n.image_source_url, n.image_credit, 'placeholder', 'FR',
  n.product_type, true, n.official_source_url, n.booster_artwork
from new_products n
where not exists (
  select 1 from public.products p
  where p.name = n.name
    and p.product_type = n.product_type
    and p.language = 'FR'
);

-- Contents are inserted with whichever product_contents shape the environment
-- currently uses. No existing rows are updated or removed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'component_type'
  ) then
    insert into public.product_contents (
      product_id, component_type, item_name, set_name, quantity,
      is_random, sort_order, source_note
    )
    select p.id, 'booster', 'Booster ' || c.set_name, c.set_name, 1,
           false, c.sort_order, c.source_note
    from public.products p
    cross join (values
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Épée et Bouclier – Stars Étincelantes', 1, 'Contenu vérifié sur Poképédia : un booster Stars Étincelantes, un booster Évolutions à Paldea et une gomme Gourmelet.'),
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Écarlate et Violet – Évolutions à Paldea', 2, 'Contenu vérifié sur Poképédia : un booster Stars Étincelantes, un booster Évolutions à Paldea et une gomme Gourmelet.'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Épée et Bouclier – Stars Étincelantes', 1, 'Contenu vérifié sur Poképédia : un booster Stars Étincelantes, un booster Évolutions à Paldea et une gomme Olivini.'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Écarlate et Violet – Évolutions à Paldea', 2, 'Contenu vérifié sur Poképédia : un booster Stars Étincelantes, un booster Évolutions à Paldea et une gomme Olivini.'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Écarlate et Violet – Forces Temporelles', 1, 'Contenu vérifié sur Poképédia : un booster Forces Temporelles, un booster Mascarade Crépusculaire et une gomme Ectoplasma.'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Écarlate et Violet – Mascarade Crépusculaire', 2, 'Contenu vérifié sur Poképédia : un booster Forces Temporelles, un booster Mascarade Crépusculaire et une gomme Ectoplasma.'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Écarlate et Violet – Forces Temporelles', 1, 'Contenu vérifié sur Poképédia : un booster Forces Temporelles, un booster Mascarade Crépusculaire et une gomme Ampibidou.'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Écarlate et Violet – Mascarade Crépusculaire', 2, 'Contenu vérifié sur Poképédia : un booster Forces Temporelles, un booster Mascarade Crépusculaire et une gomme Ampibidou.')
    ) as c(product_name, set_name, sort_order, source_note)
    where p.name = c.product_name and p.product_type = 'Duo Pack'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = 'Booster ' || c.set_name
      );

    insert into public.product_contents (
      product_id, component_type, item_name, quantity, is_random,
      sort_order, source_note
    )
    select p.id, 'accessory', c.item_name, 1, false, 3,
           'Gomme fournie dans la variante française du Duo Pack ; contenu identifié sur Poképédia.'
    from public.products p
    join (values
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Gomme Gourmelet'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Gomme Olivini'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Gomme Ectoplasma'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Gomme Ampibidou')
    ) as c(product_name, item_name) on c.product_name = p.name
    where p.product_type = 'Duo Pack'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = c.item_name
      );

    insert into public.product_contents (
      product_id, component_type, item_name, set_name, quantity,
      is_random, sort_order, source_note
    )
    select p.id, c.component_type, c.item_name, c.set_name, c.quantity,
           false, c.sort_order, c.source_note
    from public.products p
    cross join (values
      ('booster', 'Booster Écarlate et Violet – Foudre Noire', 'Écarlate et Violet – Foudre Noire', 2, 1, 'Asmodee et Poképédia : deux boosters Foudre Noire, deux boosters Flamme Blanche, les cartes Victini et une carte à code.'),
      ('booster', 'Booster Écarlate et Violet – Flamme Blanche', 'Écarlate et Violet – Flamme Blanche', 2, 2, 'Asmodee et Poképédia : deux boosters Foudre Noire, deux boosters Flamme Blanche, les cartes Victini et une carte à code.'),
      ('guaranteed_card', 'Victini promo SVP 208 — format standard', null, 1, 3, 'Carte promotionnelle Victini incluse ; fiche et contenu vérifiés sur Asmodee/Poképédia.'),
      ('guaranteed_card', 'Victini 012/086 — traitement reverse Poké Ball', 'Écarlate et Violet – Foudre Noire', 1, 4, 'Carte Victini incluse avec traitement reverse Poké Ball ; fiche et contenu vérifiés sur Asmodee/Poképédia.'),
      ('guaranteed_card', 'Victini promo SVP 208 — format jumbo', null, 1, 5, 'Carte jumbo Victini incluse ; fiche et contenu vérifiés sur Asmodee/Poképédia.'),
      ('digital_code', 'Carte à code pour le JCC Pokémon Live', null, 1, 6, 'Carte à code incluse selon la fiche produit Asmodee.')
    ) as c(component_type, item_name, set_name, quantity, sort_order, source_note)
    where p.name = 'Coffret Illustration Unys – Victini – Foudre Noire et Flamme Blanche'
      and p.product_type = 'Coffret'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = c.item_name
      );

  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'content_type'
  ) then
    insert into public.product_contents (
      product_id, content_type, item_name, quantity,
      source_url, source_label, confidence, content_role
    )
    select p.id, 'booster', c.item_name, 1,
           c.source_url, c.source_label, 'verified', 'guaranteed'
    from public.products p
    cross join (values
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Booster Épée et Bouclier – Stars Étincelantes', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet', 'Poképédia — contenu du Duo Pack Gourmelet'),
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Booster Écarlate et Violet – Évolutions à Paldea', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet', 'Poképédia — contenu du Duo Pack Gourmelet'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Booster Épée et Bouclier – Stars Étincelantes', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini', 'Poképédia — contenu du Duo Pack Olivini'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Booster Écarlate et Violet – Évolutions à Paldea', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini', 'Poképédia — contenu du Duo Pack Olivini'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Booster Écarlate et Violet – Forces Temporelles', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma', 'Poképédia — contenu du Duo Pack Ectoplasma'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Booster Écarlate et Violet – Mascarade Crépusculaire', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma', 'Poképédia — contenu du Duo Pack Ectoplasma'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Booster Écarlate et Violet – Forces Temporelles', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou', 'Poképédia — contenu du Duo Pack Ampibidou'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Booster Écarlate et Violet – Mascarade Crépusculaire', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou', 'Poképédia — contenu du Duo Pack Ampibidou')
    ) as c(product_name, item_name, source_url, source_label)
    where p.name = c.product_name and p.product_type = 'Duo Pack'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = c.item_name
      );

    insert into public.product_contents (
      product_id, content_type, item_name, quantity,
      source_url, source_label, confidence, content_role
    )
    select p.id, 'accessory', c.item_name, 1,
           c.source_url, c.source_label, 'verified', 'guaranteed'
    from public.products p
    join (values
      ('Duopack avec gomme Pokémon 2023 – Gourmelet', 'Gomme Gourmelet', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Gourmelet', 'Poképédia — variante Gourmelet'),
      ('Duopack avec gomme Pokémon 2023 – Olivini', 'Gomme Olivini', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2023_-_Olivini', 'Poképédia — variante Olivini'),
      ('Duopack avec gomme Pokémon 2024 – Ectoplasma', 'Gomme Ectoplasma', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ectoplasma', 'Poképédia — variante Ectoplasma'),
      ('Duopack avec gomme Pokémon 2024 – Ampibidou', 'Gomme Ampibidou', 'https://www.pokepedia.fr/Duopack_avec_gomme_Pok%C3%A9mon_2024_-_Ampibidou', 'Poképédia — variante Ampibidou')
    ) as c(product_name, item_name, source_url, source_label) on c.product_name = p.name
    where p.product_type = 'Duo Pack'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = c.item_name
      );

    insert into public.product_contents (
      product_id, content_type, item_name, quantity,
      source_url, source_label, confidence, content_role
    )
    select p.id, c.content_type, c.item_name, c.quantity,
           c.source_url, c.source_label, 'verified', 'guaranteed'
    from public.products p
    cross join (values
      ('booster', 'Booster Écarlate et Violet – Foudre Noire', 2, 'https://www.asmodee.fr/product/coffret-collection-illustration-unys-victini/', 'Asmodee — Collection Illustration Unys Victini'),
      ('booster', 'Booster Écarlate et Violet – Flamme Blanche', 2, 'https://www.asmodee.fr/product/coffret-collection-illustration-unys-victini/', 'Asmodee — Collection Illustration Unys Victini'),
      ('promo', 'Victini promo SVP 208 — format standard', 1, 'https://www.pokepedia.fr/Collection_Illustration_Unys_Victini', 'Poképédia — cartes incluses'),
      ('promo', 'Victini 012/086 — traitement reverse Poké Ball', 1, 'https://www.pokepedia.fr/Collection_Illustration_Unys_Victini', 'Poképédia — cartes incluses'),
      ('jumbo', 'Victini promo SVP 208 — format jumbo', 1, 'https://www.pokepedia.fr/Collection_Illustration_Unys_Victini', 'Poképédia — cartes incluses'),
      ('other', 'Carte à code pour le JCC Pokémon Live', 1, 'https://www.asmodee.fr/product/coffret-collection-illustration-unys-victini/', 'Asmodee — Collection Illustration Unys Victini')
    ) as c(content_type, item_name, quantity, source_url, source_label)
    where p.name = 'Coffret Illustration Unys – Victini – Foudre Noire et Flamme Blanche'
      and p.product_type = 'Coffret'
      and not exists (
        select 1 from public.product_contents pc
        where pc.product_id = p.id and pc.item_name = c.item_name
      );
  end if;
end
$$;
