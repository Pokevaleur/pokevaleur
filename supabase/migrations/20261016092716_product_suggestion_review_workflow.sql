-- Keep member proposals intact while adding structured evidence and review metadata.
alter table if exists public.product_suggestions
  add column if not exists reference_code text,
  add column if not exists source_url text,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create or replace function pokevaleur_private.review_product_suggestion(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  suggestion_id uuid := (p_payload->>'suggestion_id')::uuid;
  suggestion public.product_suggestions%rowtype;
  target_product uuid;
  product_name text;
  product_series text;
  product_category text;
  product_type text;
  release_date date;
  release_period text;
  reference_code text;
  source_url text;
  image_url text;
  image_source_url text;
  image_credit text;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and is_admin=true) then
    raise exception 'Accès administrateur requis.' using errcode='42501';
  end if;
  if suggestion_id is null then raise exception 'Proposition introuvable.' using errcode='22023'; end if;

  select * into suggestion from public.product_suggestions where id=suggestion_id for update;
  if not found then raise exception 'Proposition introuvable.' using errcode='22023'; end if;
  if suggestion.status <> 'pending' then raise exception 'Cette proposition a déjà été traitée.' using errcode='22023'; end if;

  if p_action='reject' then
    update public.product_suggestions set status='rejected', reviewed_at=now(), reviewed_by=actor
    where id=suggestion_id;
    return jsonb_build_object('status','rejected');
  elsif p_action='link' then
    target_product := (p_payload->>'product_id')::uuid;
    if target_product is null or not exists(select 1 from public.products where id=target_product and is_public=true) then
      raise exception 'Choisis un produit public existant.' using errcode='22023';
    end if;
    update public.product_suggestions set status='approved', product_id=target_product, reviewed_at=now(), reviewed_by=actor
    where id=suggestion_id;
    return jsonb_build_object('status','linked','product_id',target_product);
  elsif p_action <> 'approve' then
    raise exception 'Action de traitement inconnue.' using errcode='22023';
  end if;

  product_name := btrim(coalesce(p_payload->>'name',''));
  product_series := nullif(btrim(coalesce(p_payload->>'series','')),'');
  product_category := nullif(btrim(coalesce(p_payload->>'category','')),'');
  product_type := nullif(btrim(coalesce(p_payload->>'product_type','')),'');
  release_date := nullif(p_payload->>'release_date','')::date;
  release_period := nullif(btrim(coalesce(p_payload->>'release_period','')),'');
  reference_code := nullif(btrim(coalesce(p_payload->>'reference_code','')),'');
  source_url := nullif(btrim(coalesce(p_payload->>'official_source_url','')),'');
  image_url := nullif(btrim(coalesce(p_payload->>'image_url','')),'');
  image_source_url := nullif(btrim(coalesce(p_payload->>'image_source_url','')),'');
  image_credit := nullif(btrim(coalesce(p_payload->>'image_credit','')),'');

  if product_name='' or product_category is null then raise exception 'Renseigne le nom officiel et le type de produit.' using errcode='22023'; end if;
  if source_url is null or source_url !~* '^https?://' then raise exception 'Ajoute une adresse web valide pour la source consultée.' using errcode='22023'; end if;
  if (image_url is not null and image_url !~* '^https?://') or (image_source_url is not null and image_source_url !~* '^https?://') then
    raise exception 'Les liens de visuel doivent commencer par http:// ou https://.' using errcode='22023';
  end if;
  if coalesce((p_payload->>'verified')::boolean,false) is not true then
    raise exception 'Confirme la vérification avant publication.' using errcode='22023';
  end if;

  insert into public.products (
    name, series, category, currency, is_public, product_type, release_date, release_period,
    case_reference, official_source_url, image_url, image_source_url, image_credit
  ) values (
    product_name, product_series, product_category, 'EUR', true, product_type, release_date, release_period,
    reference_code, source_url, image_url, image_source_url, image_credit
  ) returning id into target_product;

  update public.product_suggestions set status='approved', product_id=target_product, reviewed_at=now(), reviewed_by=actor
  where id=suggestion_id;
  return jsonb_build_object('status','approved','product_id',target_product);
end;
$$;

revoke all on function pokevaleur_private.review_product_suggestion(text,jsonb) from public,anon,authenticated;
grant execute on function pokevaleur_private.review_product_suggestion(text,jsonb) to authenticated;

create or replace function public.review_product_suggestion(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select pokevaleur_private.review_product_suggestion(p_action,coalesce(p_payload,'{}'::jsonb));
$$;
revoke all on function public.review_product_suggestion(text,jsonb) from public,anon;
grant execute on function public.review_product_suggestion(text,jsonb) to authenticated;
