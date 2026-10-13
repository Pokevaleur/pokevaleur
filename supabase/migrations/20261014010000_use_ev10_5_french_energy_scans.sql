-- Replace the generic SVE art references on the EV10.5 energy checklist with
-- French scans of the actual striated reverse-holo reprints.
update public.cards c
set image_url = source.image_url,
    image_source_url = source.image_url,
    source_url = source.source_url
from public.card_sets s,
     (values
       ('017', 'https://i.ebayimg.com/images/g/EbsAAeSwK05of6Cc/s-l1600.jpg', 'https://www.ebay.fr/itm/136198368294'),
       ('018', 'https://i.ebayimg.com/images/g/-c8AAeSwG8tofifJ/s-l1600.png', 'https://www.ebay.fr/itm/227470156513'),
       ('019', 'https://i.ebayimg.com/images/g/8UQAAeSwRBVofie5/s-l1600.png', 'https://www.ebay.fr/itm/226878740705'),
       ('020', 'https://i.ebayimg.com/images/g/-asAAeSwaXtofifB/s-l1600.png', 'https://www.ebay.fr/itm/226878740701'),
       ('021', 'https://i.ebayimg.com/images/g/BVoAAeSwQBxomOCU/s-l1600.jpg', 'https://www.ebay.fr/itm/257059699928'),
       ('022', 'https://i.ebayimg.com/images/g/KyQAAeSwffdojG9B/s-l1600.jpg', 'https://www.ebay.fr/itm/136252687854'),
       ('023', 'https://i.ebayimg.com/images/g/mmIAAeSwQf9of6E0/s-l1600.jpg', 'https://www.ebay.fr/itm/136198374494'),
       ('024', 'https://i.ebayimg.com/images/g/u1YAAeSwK4Rof77L/s-l1600.jpg', 'https://www.ebay.fr/itm/157502019038')
     ) as source(collector_number, image_url, source_url)
where s.set_code = 'sv10.5e'
  and s.language = 'FR'
  and c.card_set_id = s.id
  and c.collector_number = source.collector_number;

do $$
declare
  verified_cards integer;
begin
  select count(*)::integer into verified_cards
  from public.cards c
  join public.card_sets s on s.id = c.card_set_id
  where s.set_code = 'sv10.5e'
    and s.language = 'FR'
    and c.collector_number between '017' and '024'
    and c.image_url like 'https://i.ebayimg.com/%';

  if verified_cards <> 8 then
    raise exception 'Expected eight French EV10.5 scans, found %', verified_cards;
  end if;
end;
$$;
