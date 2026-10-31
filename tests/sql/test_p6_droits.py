# P6 (31/10/2026) — retrait de droits inutiles au rôle « anon » (visiteur NON connecté), sur un VRAI PostgreSQL
# (banc local, Supabase imité). Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql
# Base neuve à chaque test : 00_supabase_emul.sql + 01_base_actuelle.sql + tables du réel absentes du banc (ci-dessous)
# + TOUTES les migrations de supabase/migrations (ordre des noms) ; la migration P6 est appliquée deux fois (rejouable).
# Avant la correction, la migration P6 et ses scripts n'existent pas : ces tests doivent être ROUGES.
# Couvre : M4 C19 / S-5 (cinq petites fonctions), S-6 (tables), S-8 (script d'essai n° 1), alignement du projet TEST,
# verrous des scripts TEST / RÉEL, retour arrière, et une garde pour les migrations futures (aucun droit anon dans public).
import json, os, uuid, pathlib, contextlib
import psycopg, pytest
from cible_locale import CibleRefusee, parametres, verifier_connexion

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATIONS = RACINE / 'supabase' / 'migrations'
MIGRATION_P6 = MIGRATIONS / '20261031120000_droits_anon.sql'
ESSAIS = RACINE / 'tests' / 'supabase-test'
RETOUR_P6 = ESSAIS / '6-droits-anon-retour-arriere.sql'
SCRIPT_TEST = ESSAIS / '6-droits-anon-TEST.sql'
SCRIPT_REEL = ESSAIS / '6-REEL-droits-anon.sql'
SCRIPT_1 = ESSAIS / '1-structure-migration-essais.sql'
try:
    ADMIN = parametres()
except CibleRefusee as e:
    if not os.environ.get('PGHOST'):
        pytest.skip(str(e), allow_module_level=True)
    pytest.exit(f'CIBLE REFUSÉE : {e}', returncode=3)
with psycopg.connect(**ADMIN, connect_timeout=5) as _c:
    try:
        verifier_connexion(_c)
    except CibleRefusee as e:
        pytest.exit(f'CIBLE REFUSÉE : {e}', returncode=3)
A = '11111111-1111-1111-1111-111111111111'
B = '22222222-2222-2222-2222-222222222222'
V = '1.13.0'

# Les cinq petites fonctions (S-5) et les tables ClimPilot (S-6).
FONCTIONS = ['public.cp_serveur_info()', 'public.cp_version_ok(text)', 'public.cp_arr_len(jsonb)',
             'public.cp_doc_json(public.climpilot_documents)', 'public.cp_num_txt(text,integer,integer)']
APPELS = ['select public.cp_serveur_info()', "select public.cp_version_ok('1.13.0')", "select public.cp_arr_len('[1,2]'::jsonb)",
          'select public.cp_doc_json(null::public.climpilot_documents)', "select public.cp_num_txt('F',2026,7)"]
TABLES = ['climpilot_state', 'climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_ai_usage',
          'climpilot_catalogue', 'climpilot_pdp', 'climpilot_seq', 'climpilot_documents', 'climpilot_doc_events', 'climpilot_busy']
DU_REEL = ['climpilot_inbox', 'climpilot_ai_usage', 'climpilot_catalogue', 'climpilot_pdp']
DECLENCHEURS = ['public.cp_sig_guard()', 'public.cp_sig_insert()', 'public.cp_docs_guard()', 'public.cp_events_guard()', 'public.cp_seq_guard()']
PRIV_TABLE = ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

# Tables présentes sur le projet réel mais absentes de 01_base_actuelle.sql (colonnes et règles RLS : supabase/schema.sql).
# Créées AVANT les migrations, comme sur le réel : elles reçoivent les droits par défaut de Supabase (anon compris).
TABLES_DU_REEL = """
create table public.climpilot_inbox (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(), kind text, titre text, resume text, dictee text, payload jsonb, statut text, source text, traite_at timestamptz);
create table public.climpilot_ai_usage (id bigserial primary key, user_id uuid references auth.users(id), created_at timestamptz not null default now(),
  modele text, in_tok int, out_tok int, cache_read int, cache_write int, cout_eur numeric, resultat text);
create table public.climpilot_catalogue (user_id uuid not null default auth.uid() references auth.users(id), four text not null, part int not null default 0,
  date text, n int, pub_only boolean, fichier text, rows jsonb, updated_at timestamptz default now(), primary key (user_id, four, part));
create table public.climpilot_pdp (user_id uuid primary key references auth.users(id), client_id text, secret_id uuid, env text, company jsonb,
  updated_at timestamptz default now());
alter table public.climpilot_inbox enable row level security;
alter table public.climpilot_ai_usage enable row level security;
alter table public.climpilot_catalogue enable row level security;
alter table public.climpilot_pdp enable row level security;
create policy inbox_all on public.climpilot_inbox for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_select on public.climpilot_ai_usage for select using ((select auth.uid()) = user_id);
create policy cat_all on public.climpilot_catalogue for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pdp_select on public.climpilot_pdp for select using ((select auth.uid()) = user_id);
"""

# État laissé sur le projet TEST par l'ANCIEN script d'essai n° 1 (avant P6) et par le réglage du projet TEST :
# table d'essais et fonction zz_ok ouvertes au visiteur non connecté, fonctions de déclencheur exécutables par anon.
ETAT_TEST_AVANT = """
create table public.climpilot_marqueur_test (note text);
create table if not exists public.zz_resultats (n serial primary key, phase text, test text, ok boolean, detail text, le timestamptz default now());
grant select, insert on public.zz_resultats to authenticated, anon;
grant usage on sequence public.zz_resultats_n_seq to authenticated, anon;
create or replace function public.zz_ok(p_phase text, p_test text, p_ok boolean, p_detail text default '') returns void
language sql as $f$ insert into public.zz_resultats(phase,test,ok,detail) values (p_phase,p_test,coalesce(p_ok,false),left(coalesce(p_detail,''),400)) $f$;
grant execute on function public.zz_ok(text,text,boolean,text) to authenticated, anon;
grant execute on function public.cp_sig_guard(), public.cp_sig_insert(), public.cp_docs_guard(), public.cp_events_guard(), public.cp_seq_guard() to public, anon;
"""

# Droits effectifs d'un rôle sur tout le schéma public (tables, vues, séquences, fonctions), en une requête.
DROITS = """
select c.oid::regclass::text,
  array(select p from unnest(case when c.relkind = 'S' then array['USAGE','SELECT','UPDATE']
                                  else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] end) p
        where case when c.relkind = 'S' then has_sequence_privilege(%(r)s, c.oid, p) else has_table_privilege(%(r)s, c.oid, p) end
        order by p)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
union all
select p.oid::regprocedure::text, case when has_function_privilege(%(r)s, p.oid, 'EXECUTE') then array['EXECUTE'] else array[]::text[] end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
"""
BASE = {'nom': None, 'avant': {}}


def droits(c, role):
    return {nom: tuple(p) for nom, p in c.execute(DROITS, {'r': role}).fetchall()}


def migrations_sans_p6():
    return [f for f in sorted(MIGRATIONS.glob('*.sql')) if f.name != MIGRATION_P6.name]


@contextlib.contextmanager
def base(avec_p6=True, tables_du_reel=True):
    """Base neuve (Supabase imité + base actuelle + migrations). Avec avec_p6, la migration P6 est appliquée deux fois."""
    nom = 'cpp6_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    try:
        with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
            for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
                c.execute(f.read_text())
            c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
            if tables_du_reel:
                c.execute(TABLES_DU_REEL)
            for f in migrations_sans_p6():
                c.execute(f.read_text())
            avant = {r: droits(c, r) for r in ('anon', 'authenticated', 'service_role')}
            if avec_p6 and MIGRATION_P6.exists():  # absente avant la correction : les tests échouent sur leurs contrôles
                c.execute(MIGRATION_P6.read_text())
                c.execute(MIGRATION_P6.read_text())  # rejouable
        yield nom, avant
    finally:
        with psycopg.connect(**ADMIN, autocommit=True) as c:
            c.execute(f'drop database {nom} with (force)')


@pytest.fixture(autouse=True)
def base_neuve():
    with base() as (nom, avant):
        BASE['nom'], BASE['avant'] = nom, avant
        yield nom


def admin(nom=None):
    return psycopg.connect(**{**ADMIN, 'dbname': nom or BASE['nom']}, autocommit=True)


def cnx(user=None, role='authenticated', nom=None):
    c = psycopg.connect(**{**ADMIN, 'dbname': nom or BASE['nom']}, autocommit=True)
    c.execute(f'set role {role}')
    claims = {'role': role}
    if user:
        claims['sub'] = user
    c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    return c


def resultat_final(c, script):
    """Exécute un script SQL complet (une seule transaction implicite, comme le SQL Editor) ; renvoie les lignes du dernier select."""
    cur = c.execute(script)
    lignes = None
    while True:
        if cur.description:
            lignes = cur.fetchall()
        if not cur.nextset():
            break
    return lignes


def anon_droits_table(c, t):
    return [p for p in PRIV_TABLE if c.execute('select has_table_privilege(%s, %s::regclass, %s)', ('anon', 'public.' + t, p)).fetchone()[0]]


def public_peut_executer(c, f):
    return c.execute("""select exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where p.oid = %s::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE')""", (f,)).fetchone()[0]


# ---------- S-5 : cinq petites fonctions ----------
def test_p6_01_cinq_fonctions_fermees_au_visiteur_non_connecte():
    with admin() as c:
        for f in FONCTIONS:
            assert c.execute("select has_function_privilege('anon', %s::regprocedure, 'EXECUTE')", (f,)).fetchone()[0] is False, f
            assert public_peut_executer(c, f) is False, f + ' : encore exécutable par PUBLIC (M4 C19)'
    for q in APPELS:
        with cnx(None, role='anon') as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(q)


def test_p6_02_cinq_fonctions_gardees_pour_l_appli_connectee_et_le_service():
    with admin() as c:
        for f in FONCTIONS:
            for r in ('authenticated', 'service_role'):
                assert c.execute('select has_function_privilege(%s, %s::regprocedure, %s)', (r, f, 'EXECUTE')).fetchone()[0], (r, f)
    with cnx(A) as c:  # appel direct de l'appli (next-emission.js, sonde), APRÈS connexion
        assert c.execute('select public.cp_serveur_info()').fetchone()[0]['documents'] is True


def test_p6_03_appli_connectee_inchangee_synchro_emission_sauvegarde_signature_boite_catalogue():
    with cnx(A) as c:
        r = c.execute('select public.cp_state_push(%s::jsonb, null, false, %s)', (json.dumps({'cp2_devis': [1, 2, 3]}), V)).fetchone()[0]
        assert r['ok']
        r = c.execute('select public.cp_state_push(%s::jsonb, %s, false, %s)', (json.dumps({'cp2_devis': [1]}), r['updated_at'], V)).fetchone()[0]
        assert r['ok']  # mise à jour : déclencheur de sauvegarde (cp_arr_len) exécuté
        assert c.execute('select count(*) from public.climpilot_state').fetchone()[0] == 1
        jour = c.execute("select (now() at time zone 'Europe/Paris')::date").fetchone()[0]
        e = c.execute('select public.cp_emettre_document(%s,%s,%s,%s,%s::jsonb,%s,%s)',
                      (str(uuid.uuid4()), 'F', 'facture', jour, json.dumps({'v': 1, 'app': V, 'type': 'facture', 'fac': {'num': '', 'montant': 10}}), 0, V)).fetchone()[0]
        assert e['ok'] and e['doc']['num'].endswith('-001')  # cp_version_ok, cp_num_txt, cp_doc_json appelées par la fonction
        c.execute("insert into public.climpilot_backups(user_id, raison, data) values (%s, 'manuelle', '{}')", (A,))
        c.execute("insert into public.climpilot_signatures(doc_type, doc_id, doc_html) values ('devis', 'd1', '<p>devis</p>')")
        c.execute("insert into public.climpilot_inbox(kind, titre, statut) values ('note', 'essai', 'auto')")
        c.execute("insert into public.climpilot_catalogue(four, rows) values ('F1', '[]')")
        assert c.execute('select count(*) from public.climpilot_backups').fetchone()[0] >= 1
        assert c.execute('select count(*) from public.climpilot_signatures').fetchone()[0] == 1
        assert c.execute('select count(*) from public.climpilot_inbox').fetchone()[0] == 1
        assert c.execute('select count(*) from public.climpilot_catalogue').fetchone()[0] == 1
        assert c.execute('select count(*) from public.climpilot_pdp').fetchone()[0] == 0
        assert c.execute('select count(*) from public.climpilot_documents').fetchone()[0] == 1


# ---------- S-6 : tables ----------
def test_p6_04_tables_aucun_droit_pour_le_visiteur_non_connecte():
    with admin() as c:
        for t in TABLES:
            assert anon_droits_table(c, t) == [], t
        seqs = c.execute("""select sq.oid::regclass::text from pg_class sq join pg_depend d on d.objid = sq.oid and d.deptype in ('a','i')
                            where sq.relkind = 'S' and d.refobjid = any(%s::regclass[])""", (['public.' + t for t in TABLES],)).fetchall()
        assert seqs, 'séquences des tables introuvables'
        for (s,) in seqs:
            for p in ('USAGE', 'SELECT', 'UPDATE'):
                assert c.execute('select has_sequence_privilege(%s, %s::regclass, %s)', ('anon', s, p)).fetchone()[0] is False, (s, p)
    with cnx(None, role='anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute('select count(*) from public.climpilot_state')
    with cnx(None, role='anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("insert into public.climpilot_backups(user_id, raison, data) values (%s, 'manuelle', '{}')", (A,))
    with cnx(None, role='anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute('select count(*) from public.climpilot_signatures')


def test_p6_05_droits_de_authenticated_et_service_role_identiques_a_avant():
    assert MIGRATION_P6.exists()
    with admin() as c:
        for r in ('authenticated', 'service_role'):
            assert droits(c, r) == BASE['avant'][r], r


def test_p6_06_rejouable_et_sans_erreur_quand_des_tables_manquent():
    assert MIGRATION_P6.exists()
    with admin() as c:
        c.execute(MIGRATION_P6.read_text())  # 3e application
    with base(avec_p6=True, tables_du_reel=False) as (nom, _):  # projet TEST : ces tables peuvent manquer
        with admin(nom) as c:
            for t in ('climpilot_state', 'climpilot_backups', 'climpilot_signatures'):
                assert anon_droits_table(c, t) == [], t


# ---------- retour arrière ----------
def test_p6_07_retour_arriere_rend_les_droits_anon_puis_la_migration_les_retire_a_nouveau():
    assert MIGRATION_P6.exists() and RETOUR_P6.exists()
    with admin() as c:
        c.execute(RETOUR_P6.read_text())
        c.execute(RETOUR_P6.read_text())  # rejouable
        for f in FONCTIONS:
            assert c.execute("select has_function_privilege('anon', %s::regprocedure, 'EXECUTE')", (f,)).fetchone()[0], f
        assert 'SELECT' in anon_droits_table(c, 'climpilot_state')
        assert 'INSERT' not in anon_droits_table(c, 'climpilot_state')  # 1.10 : l'état ne s'écrit que par cp_state_push
        for t in ('climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_catalogue', 'climpilot_ai_usage', 'climpilot_pdp'):
            assert {'SELECT', 'INSERT', 'UPDATE', 'DELETE'} <= set(anon_droits_table(c, t)), t
        for t in ('climpilot_seq', 'climpilot_documents', 'climpilot_doc_events', 'climpilot_busy'):
            assert anon_droits_table(c, t) == [], t  # fermées par 1.10 / agenda : le retour arrière ne les rouvre pas
        for r in ('authenticated', 'service_role'):
            assert droits(c, r) == BASE['avant'][r], r
    with cnx(None, role='anon') as c:  # la protection par compte (RLS) bloque toujours : rien n'est visible
        assert c.execute('select count(*) from public.climpilot_state').fetchone()[0] == 0
    with admin() as c:
        c.execute(MIGRATION_P6.read_text())
        for t in TABLES:
            assert anon_droits_table(c, t) == [], t
        for f in FONCTIONS:
            assert c.execute("select has_function_privilege('anon', %s::regprocedure, 'EXECUTE')", (f,)).fetchone()[0] is False, f


# ---------- scripts prêts à coller ----------
def test_p6_08_scripts_test_et_reel_contiennent_la_migration_telle_quelle():
    m = MIGRATION_P6.read_text()
    assert m in SCRIPT_TEST.read_text()
    assert m in SCRIPT_REEL.read_text()


def test_p6_09_script_reel_sur_une_base_sans_marqueur_toutes_les_lignes_ok():
    with base(avec_p6=False) as (nom, _):
        with admin(nom) as c:
            lignes = resultat_final(c, SCRIPT_REEL.read_text())
            assert lignes and len(lignes) == 19, lignes
            assert all(etat.startswith('OK') for _, etat in lignes), lignes
            for t in TABLES:
                assert anon_droits_table(c, t) == [], t


def test_p6_10_script_reel_refuse_de_tourner_sur_le_projet_test():
    with base(avec_p6=False) as (nom, _):
        with admin(nom) as c:
            c.execute('create table public.climpilot_marqueur_test (note text)')
            with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
                c.execute(SCRIPT_REEL.read_text())
            # rien n'a changé
            assert c.execute("select has_function_privilege('anon', 'public.cp_serveur_info()', 'EXECUTE')").fetchone()[0]
            assert 'SELECT' in anon_droits_table(c, 'climpilot_state')


def test_p6_11_script_test_refuse_de_tourner_sans_marqueur():
    with base(avec_p6=False) as (nom, _):
        with admin(nom) as c:
            with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
                c.execute(SCRIPT_TEST.read_text())
            assert c.execute("select has_function_privilege('anon', 'public.cp_serveur_info()', 'EXECUTE')").fetchone()[0]
            assert 'SELECT' in anon_droits_table(c, 'climpilot_state')


def test_p6_12_script_test_aligne_le_projet_test_sur_le_reel():
    with base(avec_p6=False, tables_du_reel=False) as (nom, _):
        with admin(nom) as c:
            c.execute(ETAT_TEST_AVANT)
            for f in DECLENCHEURS + ['public.zz_ok(text,text,boolean,text)']:  # mise en place : la dérive est bien là
                assert c.execute("select has_function_privilege('anon', %s::regprocedure, 'EXECUTE')", (f,)).fetchone()[0], f
            lignes = resultat_final(c, SCRIPT_TEST.read_text())
            assert lignes and len(lignes) == 27, lignes
            assert all(etat.startswith('OK') for _, etat in lignes), lignes
            for f in FONCTIONS + DECLENCHEURS + ['public.zz_ok(text,text,boolean,text)']:
                assert c.execute("select has_function_privilege('anon', %s::regprocedure, 'EXECUTE')", (f,)).fetchone()[0] is False, f
            for t in ('zz_resultats', 'climpilot_marqueur_test', 'climpilot_state', 'climpilot_backups', 'climpilot_signatures'):
                assert anon_droits_table(c, t) == [], t
            assert c.execute("select has_sequence_privilege('anon', 'public.zz_resultats_n_seq', 'USAGE')").fetchone()[0] is False
            assert c.execute("select has_function_privilege('authenticated', 'public.cp_serveur_info()', 'EXECUTE')").fetchone()[0]
            # le marqueur reste visible pour les verrous des scripts (lus par l'administrateur)
            assert c.execute("select to_regclass('public.climpilot_marqueur_test') is not null").fetchone()[0]
            # zz_ok sert encore aux scripts d'essai exécutés par l'administrateur (script 2)
            c.execute("select public.zz_ok('C', 'essai administrateur', true, '')")
            # rejouable
            assert all(etat.startswith('OK') for _, etat in resultat_final(c, SCRIPT_TEST.read_text()))


# ---------- S-8 : script d'essai n° 1 ----------
def test_p6_13_script_essais_1_ne_laisse_rien_ouvert_au_visiteur_et_teste_la_meme_chose():
    nom = 'cpp6s1_' + uuid.uuid4().hex[:8]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    try:
        with admin(nom) as c:
            # auth.users comme sur Supabase (colonnes utilisées par le script 1), puis l'imitation habituelle
            c.execute('create schema auth; create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text, '
                      'encrypted_password text, created_at timestamptz, updated_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb)')
            c.execute((ICI / '00_supabase_emul.sql').read_text())
            resume = resultat_final(c, SCRIPT_1.read_text())
            # ce qu'il teste ne change pas : 36 contrôles (phases A et B), tous réussis sur le banc local
            assert sorted(resume) == [('A', 2, 0), ('B', 34, 0)], resume
            for r in ('anon', 'authenticated'):
                for p in PRIV_TABLE:
                    assert c.execute('select has_table_privilege(%s, %s, %s)', (r, 'public.zz_resultats', p)).fetchone()[0] is False, (r, p)
                for p in ('USAGE', 'SELECT', 'UPDATE'):
                    assert c.execute('select has_sequence_privilege(%s, %s, %s)', (r, 'public.zz_resultats_n_seq', p)).fetchone()[0] is False, (r, p)
                assert c.execute("select has_function_privilege(%s, 'public.zz_ok(text,text,boolean,text)', 'EXECUTE')", (r,)).fetchone()[0] is False, r
            assert public_peut_executer(c, 'public.zz_ok(text,text,boolean,text)') is False
            assert c.execute("select relrowsecurity from pg_class where oid = 'public.zz_resultats'::regclass").fetchone()[0]
    finally:
        with psycopg.connect(**ADMIN, autocommit=True) as c:
            c.execute(f'drop database {nom} with (force)')


# ---------- garde pour les migrations futures ----------
def test_p6_14_garde_apres_toutes_les_migrations_aucun_droit_anon_dans_public():
    """Toute table, vue, séquence ou fonction du schéma public : aucun droit pour anon après TOUTES les migrations du dépôt.
    Les droits par défaut de Supabase n'ont pas été changés (voir la migration P6) : une nouvelle migration qui oublie
    « revoke … from public, anon » fait échouer ce test."""
    with admin() as c:
        ouverts = {nom: p for nom, p in droits(c, 'anon').items() if p}
        assert ouverts == {}, ouverts


def test_p6_15_les_controles_des_scripts_savent_dire_a_revoir():
    """Les lignes de vérification ne sont pas « OK » d'office : sur une base SANS la migration, elles signalent les droits restants."""
    verif = SCRIPT_REEL.read_text().split('-- VÉRIFICATIONS : 19 lignes attendues')[1]
    with base(avec_p6=False) as (nom, _):
        with admin(nom) as c:
            lignes = dict(resultat_final(c, verif.split('\n', 1)[1]))
            assert len(lignes) == 19
            for f in ('cp_serveur_info', 'cp_version_ok', 'cp_arr_len', 'cp_doc_json', 'cp_num_txt'):
                assert lignes[f'anon : {f} non exécutable sans connexion'] == 'À REVOIR', f
            for t in ('climpilot_state', 'climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_pdp'):
                assert lignes[f'anon : aucun droit sur la table {t}'] == 'À REVOIR', t
            assert lignes['anon : aucun droit sur les séquences de ces tables'] == 'À REVOIR'
            assert lignes['anon : aucun droit sur la table climpilot_documents'] == 'OK'  # déjà fermée par 1.10
