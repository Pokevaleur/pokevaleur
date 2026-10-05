alter table public.product_contents
  add column content_role text not null default 'guaranteed'
  check (content_role in ('guaranteed', 'possible'));

update public.product_contents pc
set item_name = 'Cartes aléatoires estampillées Play! Pokémon',
    quantity = 6,
    content_role = 'guaranteed'
from public.products p
where p.id = pc.product_id
  and p.name like 'Pack Récompense Play! Pokémon – Série %';

update public.product_contents pc
set item_name = 'Cartes promotionnelles aléatoires (au moins une brillante)',
    quantity = 4,
    content_role = 'guaranteed'
from public.products p
where p.id = pc.product_id
  and p.name = 'Booster promotionnel McDonald’s Pokémon 2024 (M24FR)';
