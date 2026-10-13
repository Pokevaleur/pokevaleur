update public.cards
set image_url = regexp_replace(image_url, '/0+([0-9]+)/low[.]webp$', '/\\1/low.webp')
where card_type = 'Énergie'
  and image_url ~ '/0+[0-9]+/low[.]webp$';
