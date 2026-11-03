-- Add the four French Rivalités Destinées solo blister variants with photos
-- of the complete blister packaging. The current generic product is removed
-- only after all variants exist and no table with a product FK references it.

with blister_artworks(artwork, image_url, credit) as (
  values
    (
      'Carchacrok de Cynthia',
      'https://playshop.fr/cdn/shop/files/blister-rivalites-destinees-carchacrok-de-cynthia.png?format=webp&v=1788657154&width=1200',
      'Carchacrok de Cynthia'
    ),
    (
      'Ho-Oh de Luth',
      'https://playshop.fr/cdn/shop/files/blister-rivalites-destinees-ho-oh-de-luth.png?format=webp&v=1788657156&width=1200',
      'Ho-Oh de Luth'
    ),
    (
      'Mewtwo de Giovanni',
      'https://playshop.fr/cdn/shop/files/blister-rivalites-destinees-mewtwo-de-giovanni.png?format=webp&v=1788657159&width=1200',
      'Mewtwo de Giovanni'
    ),
    (
      'Team Rocket',
      'https://playshop.fr/cdn/shop/files/blister-rivalites-destinees-team-rocket.png?format=webp&v=1788657160&width=1200',
      'Team Rocket'
    )
), inserted as (
  insert into public.products (
    name, category, series, release_date, release_year, image_url,
    image_source_url, image_credit, image_usage_status, language,
    product_type, is_public, booster_packaging, booster_artwork
  )
  select
    'Solo blister – Écarlate et Violet – Rivalités Destinées – ' || a.artwork,
    'sealed', 'Écarlate et Violet – Rivalités Destinées', date '2025-05-30', 2025,
    a.image_url,
    'https://playshop.fr/products/artset-blister-rivalites-destinees',
    'PlayShop — photographie du blister ' || a.credit,
    'placeholder', 'FR', 'Solo blister', true, 'solo_blister', a.artwork
  from blister_artworks a
  where not exists (
    select 1 from public.products p
    where p.series = 'Écarlate et Violet – Rivalités Destinées'
      and p.product_type = 'Solo blister'
      and p.booster_packaging = 'solo_blister'
      and p.booster_artwork = a.artwork
      and p.language = 'FR'
  )
  returning id
)
select count(*) from inserted;

-- Record one sealed booster inside each identified blister. Both the test and
-- production databases currently use different product_contents schemas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'component_type'
  ) then
    execute $sql$
      insert into public.product_contents (
        product_id, component_type, item_name, set_name, quantity,
        is_random, sort_order, source_note
      )
      select p.id, 'booster', 'Booster', p.series, 1, false, 1,
             'Un booster Rivalités Destinées scellé sous blister carton. Visuel et variante vérifiés sur PlayShop.'
      from public.products p
      where p.series = 'Écarlate et Violet – Rivalités Destinées'
        and p.product_type = 'Solo blister'
        and p.booster_packaging = 'solo_blister'
        and p.booster_artwork in (
          'Carchacrok de Cynthia', 'Ho-Oh de Luth',
          'Mewtwo de Giovanni', 'Team Rocket'
        )
        and not exists (
          select 1 from public.product_contents pc
          where pc.product_id = p.id and pc.component_type = 'booster'
        )
    $sql$;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'content_type'
  ) then
    execute $sql$
      insert into public.product_contents (
        product_id, content_type, item_name, quantity, source_url,
        source_label, confidence, content_role
      )
      select p.id, 'booster', 'Booster Rivalités Destinées', 1,
             'https://playshop.fr/products/artset-blister-rivalites-destinees',
             'PlayShop — blister français Rivalités Destinées', 'verified', 'guaranteed'
      from public.products p
      where p.series = 'Écarlate et Violet – Rivalités Destinées'
        and p.product_type = 'Solo blister'
        and p.booster_packaging = 'solo_blister'
        and p.booster_artwork in (
          'Carchacrok de Cynthia', 'Ho-Oh de Luth',
          'Mewtwo de Giovanni', 'Team Rocket'
        )
        and not exists (
          select 1 from public.product_contents pc
          where pc.product_id = p.id and pc.content_type = 'booster'
        )
    $sql$;
  end if;
end
$$;

-- Remove the superseded generic entry only after the four illustrated rows
-- have been inserted, and only if no table that references products uses it.
do $$
declare
  generic_id uuid;
  has_reference boolean;
  reference_row record;
begin
  select p.id into generic_id
  from public.products p
  where p.name = 'Solo blister – Écarlate et Violet – Rivalités Destinées'
    and p.series = 'Écarlate et Violet – Rivalités Destinées'
    and p.product_type = 'Solo blister'
    and p.booster_artwork is null
  limit 1;

  if generic_id is null or (
    select count(*) from public.products p
    where p.series = 'Écarlate et Violet – Rivalités Destinées'
      and p.product_type = 'Solo blister'
      and p.booster_packaging = 'solo_blister'
      and p.booster_artwork in (
        'Carchacrok de Cynthia', 'Ho-Oh de Luth',
        'Mewtwo de Giovanni', 'Team Rocket'
      )
      and p.language = 'FR' and p.image_url is not null
  ) <> 4 then
    return;
  end if;

  -- Its existing booster line is represented by the contents added above.
  -- Keep any unexpected non-booster contents attached so the reference check
  -- below prevents deleting a row whose data has not been safely transferred.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'component_type'
  ) then
    delete from public.product_contents
    where product_id = generic_id and component_type = 'booster';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_contents'
      and column_name = 'content_type'
  ) then
    delete from public.product_contents
    where product_id = generic_id and content_type = 'booster';
  end if;

  for reference_row in
    select c.conrelid::regclass as table_name, a.attname as column_name
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as key(attnum, ord)
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = key.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.products'::regclass
      and c.confkey = array[(select attnum from pg_attribute
                              where attrelid = 'public.products'::regclass
                                and attname = 'id')]::smallint[]
  loop
    execute format(
      'select exists (select 1 from %s where %I = $1)',
      reference_row.table_name, reference_row.column_name
    ) into has_reference using generic_id;
    if has_reference then
      return;
    end if;
  end loop;

  delete from public.products where id = generic_id;
end
$$;
