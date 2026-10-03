-- Seed common card-grading services used by collection records.
insert into public.card_grading_companies (company_name, abbreviation, is_active)
values
  ('PSA', 'PSA', true),
  ('PCA Grading', 'PCA', true),
  ('CCC Grading', 'CCC', true),
  ('CGC Cards', 'CGC', true),
  ('Beckett Grading Services', 'BGS', true)
on conflict (company_name) do update
  set abbreviation = excluded.abbreviation,
      is_active = true;
