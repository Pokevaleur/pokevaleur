alter table public.foreign_card_sets
  add column if not exists series_name_fr text;

update public.foreign_card_sets
set series_name_fr = 'Épée et Bouclier'
where language_code = 'JP'
  and market_code = 'JP'
  and set_code = 'S10b'
  and series_name_fr is null;
