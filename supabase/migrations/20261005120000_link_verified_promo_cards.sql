-- Link verified product contents to French catalog cards by stable catalog keys.
-- Product contents stay verified with their original source references; four source references are improved below.
do $migration$
declare
  invalid_rows integer;
  changed_rows integer;
begin
  create temporary table verified_promo_link_map (
    product_name text not null,
    item_name text not null,
    set_code text not null,
    collector_number text not null,
    source_url text,
    source_label text
  ) on commit drop;

  insert into verified_promo_link_map
    (product_name, item_name, set_code, collector_number, source_url, source_label)
  values
('Coffre de collection – Automne 2014','Arcko','xyp','XY36','https://www.codedyellow.com/pokemon-collector-chest-history/','Coded Yellow – Autumn 2014 Collector Chest'),
('Coffre de collection – Automne 2014','Gobou','xyp','XY38','https://www.codedyellow.com/pokemon-collector-chest-history/','Coded Yellow – Autumn 2014 Collector Chest'),
('Coffre de collection – Automne 2014','Poussifeu','xyp','XY37','https://www.codedyellow.com/pokemon-collector-chest-history/','Coded Yellow – Autumn 2014 Collector Chest'),
('Coffre de collection – Automne 2015','Hoopa','xyp','XY90',null,null),
('Coffre de collection – Automne 2015','Marisson','xyp','XY88',null,null),
('Coffre de collection – Automne 2015','Pikachu','xyp','XY89',null,null),
('Coffre de collection – Automne 2016','Magearna','xyp','XY165',null,null),
('Coffre de collection – Automne 2016','Méga-Ectoplasma-EX chromatique','xyp','XY166',null,null),
('Coffre de collection – Automne 2016','Volcanion','xyp','XY164',null,null),
('Coffre de collection 2018','Lougaroc Forme Crépusculaire','smp','SM105',null,null),
('Coffre de collection 2018','Necrozma Ailes de l’Aurore','smp','SM106',null,null),
('Coffre de collection 2018','Necrozma Crinière du Couchant','smp','SM107',null,null),
('Coffret Amphinobi de Sacha-EX','Amphinobi de Sacha-EX','xyp','XY133',null,null),
('Coffret Dracolosse-V','Dracolosse-V','swshp','SWSH154',null,null),
('Coffret Némélios','Némélios','xyp','XY26','https://www.pokepedia.fr/Coffret_N%C3%A9m%C3%A9lios_(Carrefour)','Poképédia – Coffret Némélios (Carrefour), promo XY26'),
('Coffret Rayquaza-EX chromatique','Rayquaza-EX chromatique','xyp','XY69',null,null),
('Coffret Silvallié-GX chromatique','Silvallié-GX chromatique','smp','SM91',null,null),
('Collection Légendaire – Pikachu-EX','Pikachu-EX','xyp','XY174',null,null),
('Pokébox Kalos chromatique – Xerneas-EX','Xerneas-EX','xyp','XY149',null,null),
('Pokébox Kalos chromatique – Yveltal-EX','Yveltal-EX','xyp','XY150',null,null),
('Coffret Tokorico-GX chromatique','Tokorico-GX chromatique','smp','SM50',null,null),
('Collection Alola','Brindibou','smp','SM01',null,null),
('Collection Alola','Flamiaou','smp','SM02',null,null),
('Collection Alola','Otaquin','smp','SM03',null,null),
('Collection avec figurine – Raichu d’Alola','Raichu d’Alola','smp','SM65',null,null),
('Collection avec figurine – Reshiram et Dracaufeu-GX','Reshiram et Dracaufeu-GX','smp','SM201',null,null),
('Collection avec figurine Arceus-V','Arceus-V','swshp','SWSH204',null,null),
('Collection avec figurine Épée et Bouclier','Pikachu full-art','swshp','SWSH020',null,null),
('Collection Destinées Occultes – Dracaufeu-GX','Dracaufeu-GX','smp','SM211',null,null),
('Collection Destinées Occultes – Raichu-GX','Raichu-GX','smp','SM213',null,null),
('Collection Destinées Radieuses – Pikachu-V','Pikachu-V','swshp','SWSH061',null,null),
('Collection Méga-Lucario','Lucario','xyp','XY140',null,null),
('Collection Méga-Mewtwo X','Mewtwo','xyp','XY100',null,null),
('Collection Méga-Mewtwo Y','Mewtwo','xyp','XY101',null,null),
('Collection Premium Lucario VSTAR','Lucario-VSTAR','swshp','SWSH214',null,null),
('Collection Premium Méga-Absol-EX','Méga-Absol-EX','xyp','XY63',null,null),
('Collection Premium Méga-Ptéra-EX','Méga-Ptéra-EX','xyp','XY98',null,null),
('Collection Super-Premium Légendes Brillantes – Ho-Oh','Ho-Oh-GX arc-en-ciel','smp','SM80',null,null),
('Collection Super-Premium Légendes Brillantes – Ho-Oh','Pikachu','smp','SM81',null,null),
('Dossier Détective Pikachu – Dracaufeu-GX','Dracaufeu-GX','smp','SM195',null,null),
('Collection Dragons légendaires d’Unys','Kyurem holographique','bw3','34',null,null),
('Collection Dragons légendaires d’Unys','Reshiram holographique','bw9','17',null,null),
('Collection Dragons légendaires d’Unys','Zekrom holographique','bw9','39',null,null),
('Collection Nymphali','Nymphali holographique','xyp','XY04',null,null),
('Collection Pokémon fabuleux – Arceus','Arceus','xyp','XY116',null,null),
('Collection Pokémon fabuleux – Celebi','Celebi','xyp','XY111',null,null),
('Collection Pokémon fabuleux – Darkrai','Darkrai','xyp','XY114',null,null),
('Collection Pokémon fabuleux – Genesect','Genesect','xyp','XY119',null,null),
('Collection Pokémon fabuleux – Jirachi','Jirachi','xyp','XY112',null,null),
('Collection Pokémon fabuleux – Keldeo','Keldeo','xyp','XY118',null,null),
('Collection Pokémon fabuleux – Manaphy','Manaphy','xyp','XY113',null,null),
('Collection Pokémon fabuleux – Meloetta','Meloetta','xyp','XY120',null,null),
('Collection Pokémon fabuleux – Mew','Mew','xyp','XY110',null,null),
('Collection Pokémon fabuleux – Shaymin','Shaymin','xyp','XY115',null,null),
('Collection Pokémon fabuleux – Victini','Victini','xyp','XY117',null,null),
('Collection Premium Méga-Métalosse-EX chromatique','Méga-Métalosse-EX chromatique','xyp','XY35',null,null),
('Collection Premium Méga-Métalosse-EX chromatique','Métalosse-EX chromatique','xyp','XY34',null,null),
('Collection Rouge & Bleu – Dracaufeu-EX','Dracaufeu-EX','xyp','XY121',null,null),
('Collection Xerneas','Xerneas','xyp','XY05',null,null),
('Collection Yveltal','Yveltal','xyp','XY06',null,null),
('Coffret Lunala-GX','Lunala-GX','smp','SM17',null,null),
('Coffret Solgaleo-GX','Solgaleo-GX','smp','SM16',null,null),
('Collection Pouvoirs Premium Destinées Occultes','Lunala-GX doré','smp','SM103',null,null),
('Collection Pouvoirs Premium Destinées Occultes','Rayquaza-GX chromatique full-art','sm7','177',null,null),
('Collection Pouvoirs Premium Destinées Occultes','Solgaleo-GX doré','smp','SM104',null,null),
('Collection Pouvoirs Premium Majesté des Dragons','Dracolosse-GX arc-en-ciel','smp','SM156',null,null),
('Collection Pouvoirs Premium Majesté des Dragons','Hyporoi-GX arc-en-ciel','smp','SM155',null,null),
('Collection Premium Squishy – Mew, Celebi et Victini','Celebi-V','swsh1','1',null,null),
('Collection Premium Squishy – Mew, Celebi et Victini','Mew-V','swsh3','69',null,null),
('Collection Rouge & Bleu – Florizarre-EX','Florizarre-EX','xyp','XY123',null,null),
('Collection Rouge & Bleu – Pikachu-EX','Pikachu-EX','xyp','XY124',null,null),
('Collection Rouge & Bleu – Tortank-EX','Tortank-EX','xyp','XY122',null,null),
('Collection Super-Premium Générations – Mew et Mewtwo','Mewtwo-EX','xyp','XY125',null,null),
('Collection Ultra-Premium Célébrations','Pikachu V doré','swshp','SWSH145',null,null),
('Collection Ultra-Premium Célébrations','Poké Ball dorée','swshp','SWSH146',null,null),
('Collection Ultra-Premium Destinées Occultes','Lunala-GX doré','smp','SM103',null,null),
('Collection Ultra-Premium Destinées Occultes','Rayquaza-GX chromatique full-art','sm7','177',null,null),
('Collection Ultra-Premium Destinées Occultes','Solgaleo-GX doré','smp','SM104',null,null),
('Pokébox Pouvoirs au-delà – Hoopa-EX','Hoopa-EX','xyp','XY71',null,null),
('Pokébox Pouvoirs au-delà – Rayquaza-EX','Rayquaza-EX','xyp','XY73',null,null),
('Collection avec pin’s Légendes Brillantes – Marshadow','Marshadow','smp','SM93',null,null),
('Collection Légendaire – Hoopa-EX','Hoopa-EX','xyp','XY71',null,null),
('Collection Légendes de Johto GX','Entei-GX','sm3.5','10',null,null),
('Collection Premium Dracaufeu-GX','Dracaufeu-GX full-art','smp','SM211',null,null),
('Collection Premium Dracaufeu-GX','Reptincel','sm3','19',null,null),
('Collection Premium Dracaufeu-GX','Salamèche','sm3','18',null,null);

  select count(*) into invalid_rows
  from verified_promo_link_map m
  where
    (select count(*)
     from public.products p
     join public.product_contents pc on pc.product_id=p.id
     where p.name=m.product_name
       and pc.item_name=m.item_name
       and pc.content_type='promo'
       and pc.confidence='verified'
       and pc.card_id is null) <> 1
    or
    (select count(*)
     from public.card_sets cs
     join public.cards c on c.card_set_id=cs.id
     where cs.set_code=m.set_code
       and cs.language='FR'
       and c.collector_number=m.collector_number) <> 1;

  if invalid_rows <> 0 then
    raise exception 'Expected unique product content and French card keys for 86 promo links; invalid mappings: %', invalid_rows;
  end if;

  update public.product_contents pc
  set card_id=c.id,
      source_url=coalesce(m.source_url,pc.source_url),
      source_label=coalesce(m.source_label,pc.source_label)
  from verified_promo_link_map m
  join public.products p on p.name=m.product_name
  join public.card_sets cs on cs.set_code=m.set_code and cs.language='FR'
  join public.cards c on c.card_set_id=cs.id and c.collector_number=m.collector_number
  where pc.product_id=p.id
    and pc.item_name=m.item_name
    and pc.content_type='promo'
    and pc.confidence='verified'
    and pc.card_id is null;

  get diagnostics changed_rows = row_count;
  if changed_rows <> 86 then
    raise exception 'Expected to link 86 verified promo contents, linked %', changed_rows;
  end if;

  drop table verified_promo_link_map;
end
$migration$;