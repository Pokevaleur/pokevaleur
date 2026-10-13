-- Replace blocked seller-hosted photos for EV10.5 SVE FR 018–024 with
-- the verified Poképédia card scans. Keep the user-supplied photo attached to 017.
with source(collector_number, hash_path, energy_type) as (
  values
    ('018','1/1f','Feu'),
    ('019','e/e9','Eau'),
    ('020','7/74','Électrique'),
    ('021','b/b7','Psy'),
    ('022','9/90','Combat'),
    ('023','2/23','Obscurité'),
    ('024','e/e7','Métal')
)
update public.cards c
set image_url = 'https://www.pokepedia.fr/images/' || source.hash_path ||
      '/Carte_%C3%89carlate_et_Violet_%C3%89nergie_de_base_' || source.collector_number || '.png',
    image_source_url = 'https://www.pokepedia.fr/%C3%89nergie_' ||
      case source.energy_type
        when 'Électrique' then '%C3%89lectrique'
        when 'Obscurité' then 'Obscurit%C3%A9'
        else source.energy_type
      end ||
      '_de_base_(%C3%89carlate_et_Violet_%C3%89nergie_de_base_' ||
      source.collector_number || ')'
from source
join public.card_sets s on s.set_code = 'sv10.5e' and s.language = 'FR'
where c.card_set_id = s.id
  and c.collector_number = source.collector_number
  and c.image_url like 'https://i.ebayimg.com/%';

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from public.cards c
  join public.card_sets s on s.id=c.card_set_id
  where s.set_code='sv10.5e'
    and c.collector_number between '018' and '024'
    and c.image_url not like 'https://www.pokepedia.fr/images/%';
  if bad_count <> 0 then
    raise exception 'Expected Poképédia scans for EV10.5 energies 018–024; found % other URLs', bad_count;
  end if;

  if not exists (
    select 1 from public.card_print_variants v
    join public.cards c on c.id=v.card_id
    join public.card_sets s on s.id=c.card_set_id
    where s.set_code='sv10.5e' and c.collector_number='017'
      and v.variant_key='holo_striee_ev10_5'
      and v.image_url='/catalog/sve-fr-017-ev10-5.jpg'
  ) then
    raise exception 'The supplied SVE FR 017 photo must remain attached to 017';
  end if;
end $$;
