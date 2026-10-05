-- Link verified promo contents when their exact name resolves to one eligible promo card.
DO $$
DECLARE
  invalid_link record;
BEGIN
  WITH links(product_name, item_name, set_code, collector_number) AS (
  VALUES
    ('Coffret Dresseur d’élite Majesté des Dragons', 'Mandrillon-GX', 'smp', 'SM125'),
    ('Coffret Lougaroc-GX', 'Lougaroc-GX', 'smp', 'SM14'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Bulbizarre', 'smp', 'SM198'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Psykokwak', 'smp', 'SM199'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Snubbull', 'smp', 'SM200'),
    ('Collection avec pin’s Légendes Brillantes – Zoroark', 'Zoroark', 'smp', 'SM89'),
    ('Collection Destinées Occultes – Léviator-GX', 'Léviator-GX', 'smp', 'SM212'),
    ('Collection Super-Premium Légendes Brillantes – Ho-Oh', 'Celebi Brillant', 'smp', 'SM79'),
    ('Pokébox Gardiens des îles – Tokotoro-GX', 'Tokotoro-GX', 'smp', 'SM32'),
    ('Pokébox Partenariat de Puissance – Carchacrok et Giratina-GX', 'Carchacrok et Giratina-GX', 'smp', 'SM193'),
    ('Pokébox Partenariat de Puissance – Lucario et Melmetal-GX', 'Lucario et Melmetal-GX', 'smp', 'SM192'),
    ('Pokébox Partenariat de Puissance – Mewtwo et Mew-GX', 'Mewtwo et Mew-GX', 'smp', 'SM191'),
    ('Coffret Alakazam-V', 'Alakazam-V', 'swshp', 'SWSH083'),
    ('Coffret Astronelle-V', 'Astronelle-V', 'swshp', 'SWSH078'),
    ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-VMAX', 'swshp', 'SWSH267'),
    ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-VSTAR', 'swshp', 'SWSH268'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-V', 'swshp', 'SWSH263'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-VMAX', 'swshp', 'SWSH264'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-VSTAR', 'swshp', 'SWSH265'),
    ('Coffret Galopa de Galar-V', 'Galopa de Galar-V', 'swshp', 'SWSH111'),
    ('Coffret Hoopa-V', 'Hoopa-V', 'swshp', 'SWSH176'),
    ('Coffret Salarsen-V', 'Salarsen-V', 'swshp', 'SWSH017'),
    ('Coffret Sylveroy Cavalier d’Effroi-V', 'Sylveroy Cavalier d’Effroi-V', 'swshp', 'SWSH131'),
    ('Coffret Sylveroy Cavalier du Froid-V', 'Sylveroy Cavalier du Froid-V', 'swshp', 'SWSH130'),
    ('Collection avec pin’s Destinées Radieuses – Dedenne', 'Dedenne', 'swshp', 'SWSH080'),
    ('Collection avec pin’s Destinées Radieuses – M. Glaquette', 'M. Glaquette de Galar', 'swshp', 'SWSH079'),
    ('Collection avec pin’s Destinées Radieuses – Polthégeist', 'Polthégeist', 'swshp', 'SWSH081'),
    ('Collection avec pin’s Destinées Radieuses – Sapereau', 'Sapereau', 'swshp', 'SWSH082'),
    ('Collection La Voie du Maître – Moumouflon-V (variante internationale Dubwool-V)', 'Moumouflon-V', 'swshp', 'SWSH049'),
    ('Collection Premium Hachécateur VSTAR', 'Hachécateur-V', 'swshp', 'SWSH248'),
    ('Collection Premium Hachécateur VSTAR', 'Hachécateur-VSTAR', 'swshp', 'SWSH249'),
    ('Collection Premium Lucario VSTAR', 'Lucario-V', 'swshp', 'SWSH213'),
    ('Collection Premium Squishy – Mew, Celebi et Victini', 'Victini-V', 'swshp', 'SWSH104'),
    ('Collection Premium VMAX – Aquali', 'Aquali-VMAX', 'swshp', 'SWSH182'),
    ('Collection Premium VMAX – Pyroli', 'Pyroli-VMAX', 'swshp', 'SWSH180'),
    ('Collection Premium VMAX – Voltali', 'Voltali-VMAX', 'swshp', 'SWSH184'),
    ('Collection spéciale Givrali VSTAR', 'Givrali-V', 'swshp', 'SWSH196'),
    ('Collection spéciale Givrali VSTAR', 'Givrali-VSTAR', 'swshp', 'SWSH197'),
    ('Pokébox Frappe-V – Pingoléon-V', 'Pingoléon-V', 'swshp', 'SWSH108'),
    ('Pokébox Frappe-V – Tyranocif-V', 'Tyranocif-V', 'swshp', 'SWSH109'),
    ('Coffret Dresseur d’élite Générations', 'Shaymin-EX', 'xyp', 'XY148'),
    ('Collection Premium Méga-Absol-EX', 'Absol-EX', 'xyp', 'XY62'),
    ('Collection Super-Premium Générations – Mew et Mewtwo', 'Mew-EX', 'xyp', 'XY126'),
    ('Pokébox Kalos chromatique – Zygarde-EX', 'Zygarde-EX', 'xyp', 'XY151'),
    ('Pokébox Pouvoirs au-delà – Latios-EX', 'Latios-EX', 'xyp', 'XY72')
  ),
  link_counts AS (
    SELECT links.*,
      (SELECT count(*)
       FROM public.products p
       JOIN public.product_contents pc ON pc.product_id = p.id
       WHERE p.name = links.product_name
         AND pc.item_name = links.item_name
         AND pc.content_type = 'promo'
         AND pc.confidence = 'verified') AS content_count,
      (SELECT count(*)
       FROM public.products p
       JOIN public.card_sets s ON s.set_code = links.set_code AND s.release_date <= p.release_date
       JOIN public.cards c ON c.card_set_id = s.id
       WHERE p.name = links.product_name
         AND p.release_date IS NOT NULL
         AND c.collector_number = links.collector_number
         AND lower(regexp_replace(c.card_name, '[^[:alnum:]]', '', 'g')) =
             lower(regexp_replace(links.item_name, '[^[:alnum:]]', '', 'g'))) AS card_count
    FROM links
  )
  SELECT * INTO invalid_link
  FROM link_counts
  WHERE content_count <> 1 OR card_count <> 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Promo link is not unique: product %, item %, cards %, contents %',
      invalid_link.product_name, invalid_link.item_name,
      invalid_link.card_count, invalid_link.content_count;
  END IF;
END
$$;

WITH verified_links(product_name, item_name, set_code, collector_number) AS (
  VALUES
    ('Coffret Dresseur d’élite Majesté des Dragons', 'Mandrillon-GX', 'smp', 'SM125'),
    ('Coffret Lougaroc-GX', 'Lougaroc-GX', 'smp', 'SM14'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Bulbizarre', 'smp', 'SM198'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Psykokwak', 'smp', 'SM199'),
    ('Collection avec figurine Détective Pikachu – En pleine enquête', 'Snubbull', 'smp', 'SM200'),
    ('Collection avec pin’s Légendes Brillantes – Zoroark', 'Zoroark', 'smp', 'SM89'),
    ('Collection Destinées Occultes – Léviator-GX', 'Léviator-GX', 'smp', 'SM212'),
    ('Collection Super-Premium Légendes Brillantes – Ho-Oh', 'Celebi Brillant', 'smp', 'SM79'),
    ('Pokébox Gardiens des îles – Tokotoro-GX', 'Tokotoro-GX', 'smp', 'SM32'),
    ('Pokébox Partenariat de Puissance – Carchacrok et Giratina-GX', 'Carchacrok et Giratina-GX', 'smp', 'SM193'),
    ('Pokébox Partenariat de Puissance – Lucario et Melmetal-GX', 'Lucario et Melmetal-GX', 'smp', 'SM192'),
    ('Pokébox Partenariat de Puissance – Mewtwo et Mew-GX', 'Mewtwo et Mew-GX', 'smp', 'SM191'),
    ('Coffret Alakazam-V', 'Alakazam-V', 'swshp', 'SWSH083'),
    ('Coffret Astronelle-V', 'Astronelle-V', 'swshp', 'SWSH078'),
    ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-VMAX', 'swshp', 'SWSH267'),
    ('Coffret Combat VMAX & VSTAR Deoxys', 'Deoxys-VSTAR', 'swshp', 'SWSH268'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-V', 'swshp', 'SWSH263'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-VMAX', 'swshp', 'SWSH264'),
    ('Coffret Combat VMAX & VSTAR Zeraora', 'Zeraora-VSTAR', 'swshp', 'SWSH265'),
    ('Coffret Galopa de Galar-V', 'Galopa de Galar-V', 'swshp', 'SWSH111'),
    ('Coffret Hoopa-V', 'Hoopa-V', 'swshp', 'SWSH176'),
    ('Coffret Salarsen-V', 'Salarsen-V', 'swshp', 'SWSH017'),
    ('Coffret Sylveroy Cavalier d’Effroi-V', 'Sylveroy Cavalier d’Effroi-V', 'swshp', 'SWSH131'),
    ('Coffret Sylveroy Cavalier du Froid-V', 'Sylveroy Cavalier du Froid-V', 'swshp', 'SWSH130'),
    ('Collection avec pin’s Destinées Radieuses – Dedenne', 'Dedenne', 'swshp', 'SWSH080'),
    ('Collection avec pin’s Destinées Radieuses – M. Glaquette', 'M. Glaquette de Galar', 'swshp', 'SWSH079'),
    ('Collection avec pin’s Destinées Radieuses – Polthégeist', 'Polthégeist', 'swshp', 'SWSH081'),
    ('Collection avec pin’s Destinées Radieuses – Sapereau', 'Sapereau', 'swshp', 'SWSH082'),
    ('Collection La Voie du Maître – Moumouflon-V (variante internationale Dubwool-V)', 'Moumouflon-V', 'swshp', 'SWSH049'),
    ('Collection Premium Hachécateur VSTAR', 'Hachécateur-V', 'swshp', 'SWSH248'),
    ('Collection Premium Hachécateur VSTAR', 'Hachécateur-VSTAR', 'swshp', 'SWSH249'),
    ('Collection Premium Lucario VSTAR', 'Lucario-V', 'swshp', 'SWSH213'),
    ('Collection Premium Squishy – Mew, Celebi et Victini', 'Victini-V', 'swshp', 'SWSH104'),
    ('Collection Premium VMAX – Aquali', 'Aquali-VMAX', 'swshp', 'SWSH182'),
    ('Collection Premium VMAX – Pyroli', 'Pyroli-VMAX', 'swshp', 'SWSH180'),
    ('Collection Premium VMAX – Voltali', 'Voltali-VMAX', 'swshp', 'SWSH184'),
    ('Collection spéciale Givrali VSTAR', 'Givrali-V', 'swshp', 'SWSH196'),
    ('Collection spéciale Givrali VSTAR', 'Givrali-VSTAR', 'swshp', 'SWSH197'),
    ('Pokébox Frappe-V – Pingoléon-V', 'Pingoléon-V', 'swshp', 'SWSH108'),
    ('Pokébox Frappe-V – Tyranocif-V', 'Tyranocif-V', 'swshp', 'SWSH109'),
    ('Coffret Dresseur d’élite Générations', 'Shaymin-EX', 'xyp', 'XY148'),
    ('Collection Premium Méga-Absol-EX', 'Absol-EX', 'xyp', 'XY62'),
    ('Collection Super-Premium Générations – Mew et Mewtwo', 'Mew-EX', 'xyp', 'XY126'),
    ('Pokébox Kalos chromatique – Zygarde-EX', 'Zygarde-EX', 'xyp', 'XY151'),
    ('Pokébox Pouvoirs au-delà – Latios-EX', 'Latios-EX', 'xyp', 'XY72')
)
UPDATE public.product_contents AS pc
SET card_id = c.id
FROM verified_links AS link
JOIN public.products AS p ON p.name = link.product_name
JOIN public.card_sets AS s
  ON s.set_code = link.set_code
 AND s.release_date <= p.release_date
JOIN public.cards AS c
  ON c.card_set_id = s.id
 AND c.collector_number = link.collector_number
 AND lower(regexp_replace(c.card_name, '[^[:alnum:]]', '', 'g')) =
     lower(regexp_replace(link.item_name, '[^[:alnum:]]', '', 'g'))
WHERE pc.product_id = p.id
  AND pc.content_type = 'promo'
  AND pc.confidence = 'verified'
  AND pc.item_name = link.item_name
  AND pc.card_id IS NULL;
