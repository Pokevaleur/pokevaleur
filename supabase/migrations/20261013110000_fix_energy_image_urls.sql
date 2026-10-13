update public.cards
set image_url = regexp_replace(
  image_url,
  '/0+[0-9]+/low[.]webp$',
  '/' || substring(image_url from '/0+([0-9]+)/low[.]webp$') || '/low.webp'
)
where card_type = 'Énergie'
  and image_url ~ '/0+[0-9]+/low[.]webp$';
