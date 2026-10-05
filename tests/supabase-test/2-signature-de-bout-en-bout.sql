-- =====================================================================
-- ClimPilot 1.10 — ESSAI 2 (2e passage) : signature en ligne de bout en bout
-- Projet « ClimPilot-TEST » UNIQUEMENT (SQL Editor › New query › Run).
-- La base appelle elle-même la fonction « signature » installée sur ce projet de test.
-- VERROU : s'arrête si ce n'est pas le projet de test préparé ce matin.
-- =====================================================================
do $$ begin
  if to_regclass('public.zz_resultats') is null then
    raise exception 'STOP : ce n''est pas le projet de test (essai 1 absent). Rien n''a été modifié.';
  end if;
end $$;

create extension if not exists http with schema extensions;

do $$
declare
  k   text := '<CLE_ANON_DU_PROJET_DE_TEST>';  -- Supabase › Project Settings › API (clé « anon » publique)
  url text := 'https://<REF_PROJET_TEST>.supabase.co/functions/v1/signature';
  ua  uuid := '11111111-1111-4111-8111-111111111111';
  png text := 'data:image/png;base64,' || repeat('iVBORw0KGgoAAAANSUhEUg', 50);
  t1 uuid; t2 uuid; t3 uuid; r extensions.http_response; j jsonb; n int; sg public.climpilot_signatures;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  -- les 3 liens d'essai ont été créés (et enregistrés) au premier passage : on les reprend
  select token into t1 from public.climpilot_signatures where doc_num = 'DV-ESSAI-1' order by created_at desc limit 1;
  select token into t2 from public.climpilot_signatures where doc_num = 'DV-ESSAI-2' order by created_at desc limit 1;
  select token into t3 from public.climpilot_signatures where doc_num = 'DV-ESSAI-3' order by created_at desc limit 1;
  if t1 is null or t2 is null or t3 is null then raise exception 'liens d''essai absents'; end if;
  delete from public.zz_resultats where phase = 'C';

  -- 1. lecture
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',t1,'action','lire')::text)::extensions.http_request);
  j := r.content::jsonb;
  perform public.zz_ok('C','lire : document affiché, en attente, remise disponible', r.status = 200 and j->>'statut' = 'en_attente' and (j->>'copie_possible')::boolean, r.status||' '||left(r.content,150));
  -- 2. copie avant signature : refusée
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',t1,'action','copie')::text)::extensions.http_request);
  perform public.zz_ok('C','copie refusée tant que le devis n''est pas signé', r.status = 409, r.status||' '||left(r.content,120));
  -- 3. signature avec accord support durable + commencement anticipé
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',
       json_build_object('t',t1,'action','signer','nom','Client Essai','accepte',true,'signature',png,'support_durable',true,'anticipe',true)::text)::extensions.http_request);
  j := r.content::jsonb;
  perform public.zz_ok('C','signer : accepté, consentement complet (support durable + rétractation)', r.status = 200 and j->>'statut' = 'signe'
      and j->>'consentement' ilike '%support durable%' and j->>'consentement' ilike '%plus de droit de rétractation%', r.status||' '||left(r.content,200));
  select * into sg from public.climpilot_signatures where token = t1;
  perform public.zz_ok('C','base : statut signé, accord support durable enregistré, horodatage serveur', sg.statut = 'signe' and sg.support_durable_accord is true and sg.signed_at is not null and sg.doc_hash is not null, coalesce(sg.statut,'')||' '||coalesce(sg.support_durable_accord::text,'null'));
  -- 4. double signature refusée
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',
       json_build_object('t',t1,'action','signer','nom','Quelqu''un','accepte',true,'signature',png)::text)::extensions.http_request);
  perform public.zz_ok('C','deuxième signature du même lien refusée', r.status = 409, r.status||' '||left(r.content,120));
  -- 5. remise de l'exemplaire
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',t1,'action','copie')::text)::extensions.http_request);
  j := r.content::jsonb;
  perform public.zz_ok('C','copie : exemplaire signé rendu au client (document + signature + consentement)', r.status = 200 and j->>'doc_html' is not null and j->>'signature_png' is not null and j->>'consentement' is not null, r.status||' '||left(r.content,100));
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',t1,'action','copie')::text)::extensions.http_request);
  select * into sg from public.climpilot_signatures where token = t1;
  perform public.zz_ok('C','remise enregistrée : 1er téléchargement daté, compteur = 2', sg.copie_le is not null and sg.copie_nb = 2, coalesce(sg.copie_le::text,'null')||' nb='||sg.copie_nb);
  select count(*) into n from public.climpilot_inbox where user_id = ua and source = 'signature' and titre ilike '%DV-ESSAI-1%';
  perform public.zz_ok('C','ClimPilot prévenu : « signé » + « téléchargé » (une seule note de téléchargement)', n = 2, n::text||' note(s)');
  -- 6. lecture après signature
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',t1,'action','lire')::text)::extensions.http_request);
  j := r.content::jsonb;
  perform public.zz_ok('C','lire après signature : signé, support durable, date de remise', j->>'statut' = 'signe' and (j->>'support_durable')::boolean and j->>'copie_le' is not null, left(r.content,150));
  -- 7. refus
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',
       json_build_object('t',t2,'action','refuser','nom','Client Deux','motif','Trop cher')::text)::extensions.http_request);
  select * into sg from public.climpilot_signatures where token = t2;
  perform public.zz_ok('C','refuser : statut refusé + motif enregistré', r.status = 200 and sg.statut = 'refuse' and sg.motif_refus = 'Trop cher', r.status||' '||sg.statut);
  -- 8. lien expiré
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',
       json_build_object('t',t3,'action','signer','nom','Client Trois','accepte',true,'signature',png)::text)::extensions.http_request);
  perform public.zz_ok('C','lien expiré : signature refusée', r.status = 410, r.status||' '||left(r.content,120));
  -- 9. liens faux
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t',gen_random_uuid(),'action','lire')::text)::extensions.http_request);
  perform public.zz_ok('C','lien inconnu : introuvable', r.status = 404, r.status::text);
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',json_build_object('t','abc','action','lire')::text)::extensions.http_request);
  perform public.zz_ok('C','lien mal formé : refusé', r.status = 404, r.status::text);
  -- 10. signature sans case cochée
  r := extensions.http(('POST',url,array[extensions.http_header('apikey',k),extensions.http_header('Authorization','Bearer '||k)],'application/json',
       json_build_object('t',t2,'action','signer','nom','X','accepte',false,'signature',png)::text)::extensions.http_request);
  perform public.zz_ok('C','lien déjà refusé : plus de signature possible', r.status = 409, r.status::text);
end $$;

select phase, count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echoues from public.zz_resultats group by phase order by phase;
