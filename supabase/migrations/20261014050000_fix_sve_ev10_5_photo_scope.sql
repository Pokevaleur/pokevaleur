-- Keep the supplied SVE FR 017 photo on its own print only. Other EV10.5
-- print variants use their existing card-level French scans as fallbacks.
update public.card_print_variants v
set image_url = null
from public.cards c
join public.card_sets s on s.id = c.card_set_id
where v.card_id = c.id
  and s.set_code = 'sv10.5e'
  and s.language = 'FR'
  and c.collector_number between '018' and '024'
  and v.variant_key = 'holo_striee_ev10_5'
  and v.image_url = '/catalog/sve-fr-017-ev10-5.jpg';

do $$
declare
  bad_photo_count integer;
  supplied_photo_count integer;
begin
  select count(*)::integer into bad_photo_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sv10.5e'
    and s.language = 'FR'
    and c.collector_number between '018' and '024'
    and v.variant_key = 'holo_striee_ev10_5'
    and v.image_url = '/catalog/sve-fr-017-ev10-5.jpg';

  if bad_photo_count <> 0 then
    raise exception 'The SVE FR 017 photo is still linked to % other energies', bad_photo_count;
  end if;

  select count(*)::integer into supplied_photo_count
  from public.card_print_variants v
  join public.cards c on c.id = v.card_id
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sv10.5e'
    and s.language = 'FR'
    and c.collector_number = '017'
    and v.variant_key = 'holo_striee_ev10_5'
    and v.image_url = '/catalog/sve-fr-017-ev10-5.jpg'
    and v.copyright_year = 2025;

  if supplied_photo_count <> 1 then
    raise exception 'The supplied SVE FR 017 photo is missing from its own print';
  end if;
end;
$$;
