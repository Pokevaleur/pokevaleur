-- Add Collect Aura to the card-grading services offered in collection forms.
insert into public.card_grading_companies (company_name, is_active)
values ('Collect Aura', true)
on conflict (company_name) do update
  set is_active = true;
