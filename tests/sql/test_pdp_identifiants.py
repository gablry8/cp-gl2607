# FACT-0 (18/11/2026) — connexion à la plateforme de facturation sur le projet TEST : table climpilot_pdp et fonctions
# pdp_cred_set / pdp_cred_get / pdp_cred_delete, sur un VRAI PostgreSQL (banc local, Supabase imité, coffre imité).
# Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql/test_pdp_identifiants.py
# Base neuve à chaque test : 00_supabase_emul.sql (avec le coffre minimal) + 01_base_actuelle.sql + TOUTES les migrations.
# Avant FACT-0, les trois scripts n° 8 n'existent pas : ces tests doivent être ROUGES.
# Couvre (docs/MISSION-FACT.md § 5.2 « FACT-0 » et § 5.3) : verrous du script TEST (marqueur, coffre, rôle) ; script rejouable,
# aucune donnée écrite ; copie conforme du relevé du réel (lecture seule du 18/11/2026) et de supabase/schema.sql ; droits ;
# enregistrer / relire / effacer un identifiant ; retour arrière (refus si la table n'est pas vide) ; script de lecture du réel ;
# contrôles qui savent dire « À REVOIR » ; garde P6 (aucun droit pour le visiteur non connecté dans public).
import json, os, re, uuid, pathlib, contextlib
import psycopg, pytest
from cible_locale import CibleRefusee, parametres, verifier_connexion

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATIONS = RACINE / 'supabase' / 'migrations'
SCHEMA = RACINE / 'supabase' / 'schema.sql'
ESSAIS = RACINE / 'tests' / 'supabase-test'
SCRIPT_TEST = ESSAIS / '8-pdp-TEST.sql'
SCRIPT_RETOUR = ESSAIS / '8-pdp-retour-arriere.sql'
SCRIPT_REEL = ESSAIS / '8-REEL-pdp-lecture.sql'
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
NB_CONTROLES = 15
REPERE_VERIF = '-- VÉRIFICATIONS : 15 lignes attendues, TOUTES « OK »'

# Relevé du réel, lecture seule du 18/11/2026 (pg_attribute, pg_constraint, pg_policies, pg_get_functiondef).
COLONNES_REEL = ('user_id uuid not null, client_id text not null, secret_id uuid not null, env text, company jsonb, '
                 'updated_at timestamp with time zone not null default now()')
CONTRAINTES_REEL = 'PRIMARY KEY (user_id) | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
REGLE_REEL = ('pdp lecture proprio', 'SELECT', ['authenticated'], 'PERMISSIVE', '(auth.uid() = user_id)', None)
FONCTIONS = {  # signature → empreinte md5 de pg_get_functiondef relevée sur le réel
    'public.pdp_cred_set(uuid,text,text,text,jsonb)': 'c4dc578e2bf2718bb8fe3a7d022b83b9',
    'public.pdp_cred_get(uuid)': '7e4e584bd684d85af7c5fe26bec0c47d',
    'public.pdp_cred_delete(uuid)': 'e3a97fd402cf201dc24398a732d57c03',
}
PRIV_TABLE = ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
# Droits de la table sur le réel : authenticated = rxtm (lecture, plus REFERENCES, TRIGGER et MAINTAIN laissés par défaut ;
# MAINTAIN n'existe qu'à partir de PostgreSQL 17), service_role = tout, anon = rien.
AUTH_TABLE_REEL = {'SELECT', 'REFERENCES', 'TRIGGER'}

# Libellés des 15 contrôles, dans l'ordre (communs au script TEST et au script de lecture du réel).
L_COFFRE = 'coffre de Supabase (Vault) présent et utilisable par le propriétaire des fonctions (postgres)'
L_TABLE = 'table climpilot_pdp présente'
L_COLONNES = 'climpilot_pdp : colonnes conformes au réel'
L_CLES = 'climpilot_pdp : clé user_id, liée au compte (effacée avec lui)'
L_RLS = 'climpilot_pdp : protection par compte activée'
L_REGLE = 'climpilot_pdp : une seule règle, chacun lit sa propre ligne (authenticated)'
L_ANON_T = 'climpilot_pdp : aucun droit pour le visiteur non connecté (anon) ni pour public'
L_AUTH_T = 'climpilot_pdp : appli connectée (authenticated) en lecture seule'
L_SERV_T = 'climpilot_pdp : service_role lit et écrit'
L_SET = 'pdp_cred_set : présente, copie conforme du réel'
L_GET = 'pdp_cred_get : présente, copie conforme du réel'
L_DEL = 'pdp_cred_delete : présente, copie conforme du réel'
L_PROPRIO = 'table et trois fonctions : propriétaire postgres'
L_FERMEES = 'trois fonctions : aucun droit pour public, anon, authenticated'
L_SERV_F = 'trois fonctions : exécutables par service_role'
LIBELLES = [L_COFFRE, L_TABLE, L_COLONNES, L_CLES, L_RLS, L_REGLE, L_ANON_T, L_AUTH_T, L_SERV_T,
            L_SET, L_GET, L_DEL, L_PROPRIO, L_FERMEES, L_SERV_F]

BASE = {'nom': None}


@contextlib.contextmanager
def base():
    """Base neuve : Supabase imité (coffre compris) + base actuelle + toutes les migrations du dépôt (comme le projet TEST)."""
    nom = 'cppdp_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    try:
        with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
            for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
                c.execute(f.read_text())
            c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
            for f in sorted(MIGRATIONS.glob('*.sql')):
                c.execute(f.read_text())
        yield nom
    finally:
        with psycopg.connect(**ADMIN, autocommit=True) as c:
            c.execute(f'drop database {nom} with (force)')


@pytest.fixture(autouse=True)
def base_neuve():
    with base() as nom:
        BASE['nom'] = nom
        yield nom


def admin():
    return psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)


def cnx(user=None, role='authenticated'):
    c = psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)
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


def lire(f):
    assert f.exists(), f'{f.name} absent'
    return f.read_text()


def verifications(script):
    """Partie « VÉRIFICATIONS » d'un script (après le repère), sans la ligne du repère."""
    texte = lire(script)
    assert REPERE_VERIF in texte, f'{script.name} : repère des vérifications absent'
    return texte.split(REPERE_VERIF, 1)[1].split('\n', 1)[1]


def objets(c):
    """(table présente, nombre de fonctions pdp_* dans public)."""
    return c.execute("""select to_regclass('public.climpilot_pdp') is not null,
                               (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'public' and p.proname like 'pdp%%')""").fetchone()


def poser_marqueur(c):
    """Marqueur du projet TEST, fermé au visiteur comme sur le projet TEST depuis P6 (6-droits-anon-TEST.sql)."""
    c.execute('create table if not exists public.climpilot_marqueur_test (note text)')
    c.execute('revoke all on public.climpilot_marqueur_test from public, anon, authenticated')


def installer(c):
    """Marqueur + script TEST ; renvoie les lignes de contrôle."""
    poser_marqueur(c)
    return resultat_final(c, lire(SCRIPT_TEST))


def tous_ok(lignes):
    return lignes is not None and len(lignes) == NB_CONTROLES and all(etat == 'OK' for _, etat in lignes)


def droits_table(c, role):
    return {p for p in PRIV_TABLE if c.execute('select has_table_privilege(%s, %s::regclass, %s)', (role, 'public.climpilot_pdp', p)).fetchone()[0]}


def peut_executer(c, role, f):
    return c.execute('select has_function_privilege(%s, %s::regprocedure, %s)', (role, f, 'EXECUTE')).fetchone()[0]


def beneficiaires(c, f):
    """Rôles qui ont un droit d'exécution écrit sur la fonction (0 = public)."""
    return sorted(('public' if g == 0 else c.execute('select pg_get_userbyid(%s)', (g,)).fetchone()[0])
                  for (g,) in c.execute("""select a.grantee from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                           where p.oid = %s::regprocedure and a.privilege_type = 'EXECUTE'""", (f,)).fetchall())


def instantane(c):
    """Photo du catalogue et des données concernées (pour prouver qu'un script n'a rien changé)."""
    return c.execute("""
      select json_build_object(
        'rel', (select json_agg(json_build_array(c.oid::regclass::text, c.relacl::text, c.relrowsecurity) order by c.oid::regclass::text)
                from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'vault')),
        'fn', (select json_agg(json_build_array(p.oid::regprocedure::text, p.proacl::text, md5(pg_get_functiondef(p.oid))) order by p.oid::regprocedure::text)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'vault')),
        'pol', (select json_agg(json_build_array(tablename, policyname, qual) order by tablename, policyname) from pg_policies),
        'pdp', (select json_agg(row_to_json(p) order by user_id) from public.climpilot_pdp p),
        'coffre', (select json_agg(row_to_json(s) order by id) from vault.secrets s))::text""").fetchone()[0]


def pdp_set(c, user, client, valeur, env='sandbox'):
    c.execute('select public.pdp_cred_set(%s, %s, %s, %s, %s::jsonb)', (user, client, valeur, env, json.dumps({'env': env, 'env_brut': env})))


# ---------- verrous du script TEST ----------
def test_pdp_01_script_test_sans_marqueur_stop_rien_cree():
    with admin() as c:
        with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
            c.execute(lire(SCRIPT_TEST))
        assert objets(c) == (False, 0)


def test_pdp_02_script_test_coffre_absent_stop_rien_cree():
    with admin() as c:
        poser_marqueur(c)
        c.execute('drop schema vault cascade')
        with pytest.raises(psycopg.errors.RaiseException, match='STOP.*coffre'):
            c.execute(lire(SCRIPT_TEST))
        assert objets(c) == (False, 0)


def test_pdp_03_script_test_par_un_autre_role_que_postgres_stop_rien_cree():
    with admin() as c:
        poser_marqueur(c)
        c.execute('set role service_role')
        with pytest.raises(psycopg.errors.RaiseException, match='STOP.*postgres'):
            c.execute(lire(SCRIPT_TEST))
        c.execute('reset role')
        assert objets(c) == (False, 0)


# ---------- script TEST : rejouable, aucune donnée ----------
def test_pdp_04_script_test_joue_deux_fois_quinze_ok_aucune_donnee_ecrite():
    with admin() as c:
        coffre_avant = c.execute('select count(*) from vault.secrets').fetchone()[0]
        lignes = installer(c)
        assert tous_ok(lignes), lignes
        assert [l for l, _ in lignes] == LIBELLES
        assert objets(c) == (True, 3)
        assert c.execute('select count(*) from public.climpilot_pdp').fetchone()[0] == 0
        assert c.execute('select count(*) from vault.secrets').fetchone()[0] == coffre_avant
        photo = instantane(c)
        lignes = resultat_final(c, lire(SCRIPT_TEST))  # rejouable
        assert tous_ok(lignes), lignes
        assert instantane(c) == photo  # la 2e fois ne change rien


def test_pdp_05_script_test_rejoue_apres_une_connexion_garde_la_ligne_et_le_secret():
    with admin() as c:
        assert tous_ok(installer(c))
    with cnx(role='service_role') as c:
        pdp_set(c, A, 'client-essai-fact0', 'valeur-essai-fact0')
    with admin() as c:
        photo = instantane(c)
        assert tous_ok(resultat_final(c, lire(SCRIPT_TEST)))
        assert instantane(c) == photo


# ---------- copie conforme ----------
def test_pdp_06_copie_conforme_du_releve_du_reel():
    with admin() as c:
        assert tous_ok(installer(c))
        col = c.execute("""select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
                                  || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''), ', ' order by a.attnum)
                           from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                           where a.attrelid = 'public.climpilot_pdp'::regclass and a.attnum > 0 and not a.attisdropped""").fetchone()[0]
        assert col == COLONNES_REEL
        cles = c.execute("""select string_agg(pg_get_constraintdef(oid), ' | ' order by contype desc)
                            from pg_constraint where conrelid = 'public.climpilot_pdp'::regclass""").fetchone()[0]
        assert cles == CONTRAINTES_REEL
        assert c.execute("select relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) from pg_class where oid = 'public.climpilot_pdp'::regclass").fetchone() == (True, False, 'postgres')
        regles = c.execute("""select policyname, cmd, roles::text[], permissive, qual, with_check from pg_policies
                              where schemaname = 'public' and tablename = 'climpilot_pdp'""").fetchall()
        assert regles == [REGLE_REEL]
        for f, empreinte in FONCTIONS.items():
            assert c.execute('select md5(pg_get_functiondef(%s::regprocedure))', (f,)).fetchone()[0] == empreinte, f
            assert c.execute('select pg_get_userbyid(proowner), prosecdef from pg_proc where oid = %s::regprocedure', (f,)).fetchone() == ('postgres', True), f
            assert beneficiaires(c, f) == ['postgres', 'service_role'], f  # réel : {postgres=X/postgres,service_role=X/postgres}
        assert droits_table(c, 'authenticated') == AUTH_TABLE_REEL
        assert droits_table(c, 'service_role') == set(PRIV_TABLE)
        assert droits_table(c, 'anon') == set()


def test_pdp_07_fonctions_de_schema_sql_identiques_au_releve_du_reel():
    """supabase/schema.sql (copie de lecture du 01/10) : les trois fonctions donnent la même définition que le réel du 18/11."""
    texte = SCHEMA.read_text()
    blocs = re.findall(r'CREATE OR REPLACE FUNCTION public\.pdp_cred_\w+\(.*?\$function\$;', texte, flags=re.S)
    assert len(blocs) == 3, blocs
    with admin() as c:
        c.execute("""create table public.climpilot_pdp (user_id uuid not null primary key references auth.users(id) on delete cascade,
                     client_id text not null, secret_id uuid not null, env text, company jsonb, updated_at timestamptz not null default now())""")
        for b in blocs:
            c.execute(b)
        for f, empreinte in FONCTIONS.items():
            assert c.execute('select md5(pg_get_functiondef(%s::regprocedure))', (f,)).fetchone()[0] == empreinte, f


# ---------- droits ----------
def test_pdp_08_trois_fonctions_fermees_a_anon_et_authenticated_service_role_execute():
    with admin() as c:
        assert tous_ok(installer(c))
        for f in FONCTIONS:
            assert peut_executer(c, 'anon', f) is False, f
            assert peut_executer(c, 'authenticated', f) is False, f
            assert peut_executer(c, 'service_role', f) is True, f
            assert 'public' not in beneficiaires(c, f), f
    appels = [("select public.pdp_cred_set(%s, 'x', 'y', 'sandbox', '{}'::jsonb)", (A,)),
              ('select * from public.pdp_cred_get(%s)', (A,)), ('select public.pdp_cred_delete(%s)', (A,))]
    for role, user in (('anon', None), ('authenticated', A)):
        for q, p in appels:
            with cnx(user, role=role) as c:
                with pytest.raises(psycopg.errors.InsufficientPrivilege):
                    c.execute(q, p)
    with cnx(role='service_role') as c:
        for q, p in appels:
            c.execute(q, p)


def test_pdp_09_table_lecture_de_sa_ligne_seulement_aucune_ecriture_hors_service():
    with admin() as c:
        assert tous_ok(installer(c))
    with cnx(role='service_role') as c:
        pdp_set(c, A, 'client-a', 'valeur-a')
        pdp_set(c, B, 'client-b', 'valeur-b')
    with cnx(A) as c:  # authenticated : sa propre ligne, rien d'autre
        assert c.execute('select client_id, env from public.climpilot_pdp').fetchall() == [('client-a', 'sandbox')]
    for q in ("insert into public.climpilot_pdp(user_id, client_id, secret_id) values ('%s', 'x', gen_random_uuid())" % A,
              "update public.climpilot_pdp set env = 'production'", 'delete from public.climpilot_pdp',
              'truncate public.climpilot_pdp', 'select count(*) from vault.decrypted_secrets'):
        with cnx(A) as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(q)
    for q in ('select count(*) from public.climpilot_pdp', 'select count(*) from vault.secrets'):
        with cnx(None, role='anon') as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(q)
    with admin() as c:
        assert c.execute("select env from public.climpilot_pdp where user_id = %s", (A,)).fetchone()[0] == 'sandbox'


# ---------- enregistrer / relire / effacer ----------
def test_pdp_10_enregistrer_relire_remplacer_effacer_un_identifiant():
    with admin() as c:
        assert tous_ok(installer(c))
    with cnx(role='service_role') as c:
        pdp_set(c, A, 'client-essai-1', 'valeur-essai-1')
        pdp_set(c, B, 'client-b', 'valeur-b')
        assert c.execute('select * from public.pdp_cred_get(%s)', (A,)).fetchall() == [('client-essai-1', 'valeur-essai-1', 'sandbox')]
        sid = c.execute('select secret_id from public.climpilot_pdp where user_id = %s', (A,)).fetchone()[0]
        assert sid is not None
        ligne = c.execute('select row_to_json(p)::text from public.climpilot_pdp p where user_id = %s', (A,)).fetchone()[0]
        assert 'valeur-essai-1' not in ligne  # la table ne garde que l'identifiant du coffre
        assert c.execute('select company from public.climpilot_pdp where user_id = %s', (A,)).fetchone()[0] == {'env': 'sandbox', 'env_brut': 'sandbox'}
        # nouvelle connexion du même compte : même place dans le coffre, valeur remplacée
        pdp_set(c, A, 'client-essai-2', 'valeur-essai-2', env='production')
        assert c.execute('select * from public.pdp_cred_get(%s)', (A,)).fetchall() == [('client-essai-2', 'valeur-essai-2', 'production')]
        assert c.execute('select secret_id from public.climpilot_pdp where user_id = %s', (A,)).fetchone()[0] == sid
        assert c.execute('select count(*) from vault.secrets').fetchone()[0] == 2
        # effacer : la ligne ET la valeur du coffre ; l'autre compte n'est pas touché
        c.execute('select public.pdp_cred_delete(%s)', (A,))
        assert c.execute('select * from public.pdp_cred_get(%s)', (A,)).fetchall() == []
        assert c.execute('select count(*) from public.climpilot_pdp where user_id = %s', (A,)).fetchone()[0] == 0
        assert c.execute('select count(*) from vault.secrets where id = %s', (sid,)).fetchone()[0] == 0
        assert c.execute('select * from public.pdp_cred_get(%s)', (B,)).fetchall() == [('client-b', 'valeur-b', 'sandbox')]
        c.execute('select public.pdp_cred_delete(%s)', (A,))  # effacer deux fois : sans erreur


# ---------- retour arrière ----------
def test_pdp_11_retour_arriere_refuse_si_la_table_n_est_pas_vide():
    with admin() as c:
        assert tous_ok(installer(c))
    with cnx(role='service_role') as c:
        pdp_set(c, A, 'client-a', 'valeur-a')
    with admin() as c:
        photo = instantane(c)
        with pytest.raises(psycopg.errors.RaiseException, match='STOP.*pas vide'):
            c.execute(lire(SCRIPT_RETOUR))
        assert instantane(c) == photo
        assert objets(c) == (True, 3)


def test_pdp_12_retour_arriere_retire_tout_rejouable_puis_reinstallation():
    with admin() as c:
        assert tous_ok(installer(c))
        for _ in range(2):  # rejouable
            lignes = resultat_final(c, lire(SCRIPT_RETOUR))
            assert lignes and len(lignes) == 4 and all(etat == 'OK' for _, etat in lignes), lignes
            assert objets(c) == (False, 0)
        assert c.execute("select to_regclass('public.climpilot_documents') is not null").fetchone()[0]  # rien d'autre n'est touché
        assert tous_ok(resultat_final(c, lire(SCRIPT_TEST)))  # le script TEST réinstalle


def test_pdp_13_retour_arriere_sans_marqueur_stop_rien_retire():
    with admin() as c:
        assert tous_ok(installer(c))
        c.execute('drop table public.climpilot_marqueur_test')
        with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
            c.execute(lire(SCRIPT_RETOUR))
        assert objets(c) == (True, 3)


# ---------- script de lecture du réel ----------
def test_pdp_14_script_reel_lecture_seule_quinze_ok_rien_modifie():
    with admin() as c:  # base « comme le réel » : objets installés, une connexion enregistrée, pas de marqueur
        assert tous_ok(installer(c))
        c.execute('drop table public.climpilot_marqueur_test')
    with cnx(role='service_role') as c:
        pdp_set(c, A, 'client-a', 'valeur-a')
    with admin() as c:
        photo = instantane(c)
        lignes = resultat_final(c, lire(SCRIPT_REEL))
        assert tous_ok(lignes), lignes
        assert [l for l, _ in lignes] == LIBELLES
        assert instantane(c) == photo
        # le script se place en lecture seule : une écriture ajoutée à la suite, dans la même transaction, est refusée
        with pytest.raises(psycopg.errors.ReadOnlySqlTransaction):
            c.execute(lire(SCRIPT_REEL) + '\ncreate table public.zz_ecriture (x int);')
        assert c.execute("select to_regclass('public.zz_ecriture')").fetchone()[0] is None


def test_pdp_15_script_reel_refuse_le_projet_test():
    with admin() as c:
        assert tous_ok(installer(c))  # le marqueur reste
        with pytest.raises(psycopg.errors.RaiseException, match='STOP.*TEST'):
            c.execute(lire(SCRIPT_REEL))


def test_pdp_16_memes_controles_dans_les_deux_scripts():
    assert verifications(SCRIPT_TEST) == verifications(SCRIPT_REEL)


# ---------- les contrôles savent dire « À REVOIR » ----------
def test_pdp_17_controles_a_revoir_sur_une_base_sans_les_objets():
    with admin() as c:
        lignes = dict(resultat_final(c, verifications(SCRIPT_REEL)))
        assert list(lignes) == LIBELLES
        assert lignes[L_COFFRE] == 'OK'  # le coffre, lui, est là
        assert all(lignes[l] == 'À REVOIR' for l in LIBELLES if l != L_COFFRE), lignes


@pytest.mark.parametrize('degat, revoir', [
    ('drop function public.pdp_cred_get(uuid)', {L_GET, L_PROPRIO, L_FERMEES, L_SERV_F}),
    ('grant execute on function public.pdp_cred_set(uuid,text,text,text,jsonb) to authenticated', {L_FERMEES}),
    ('grant execute on function public.pdp_cred_delete(uuid) to public', {L_FERMEES}),
    ('revoke execute on function public.pdp_cred_delete(uuid) from service_role', {L_SERV_F}),
    ('grant insert on public.climpilot_pdp to authenticated', {L_AUTH_T}),
    ('grant select on public.climpilot_pdp to anon', {L_ANON_T}),
    ('revoke delete on public.climpilot_pdp from service_role', {L_SERV_T}),
    ('alter table public.climpilot_pdp disable row level security', {L_RLS}),
    ('create policy autre on public.climpilot_pdp for update to authenticated using (true)', {L_REGLE}),
    ('alter table public.climpilot_pdp alter column client_id drop not null', {L_COLONNES}),
    ('alter table public.climpilot_pdp drop constraint climpilot_pdp_user_id_fkey', {L_CLES}),
    ("create or replace function public.pdp_cred_delete(p_user uuid) returns void language plpgsql security definer "
     "set search_path to 'public', 'vault' as $f$ begin delete from public.climpilot_pdp where user_id = p_user; end $f$", {L_DEL}),
    ('drop schema vault cascade', {L_COFFRE}),
])
def test_pdp_18_controles_a_revoir_quand_un_objet_ou_un_droit_manque(degat, revoir):
    with admin() as c:
        assert tous_ok(installer(c))
        c.execute(degat)
        lignes = dict(resultat_final(c, verifications(SCRIPT_REEL)))
        assert {l for l, e in lignes.items() if e != 'OK'} == revoir, lignes
        assert all(e in ('OK', 'À REVOIR') for e in lignes.values()), lignes


# ---------- garde P6 ----------
def test_pdp_19_garde_p6_aucun_droit_anon_dans_public_apres_le_script():
    with admin() as c:
        assert tous_ok(installer(c))
        ouverts = c.execute("""
          select c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
            and exists (select 1 from unnest(case when c.relkind = 'S' then array['USAGE','SELECT','UPDATE']
                                                  else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] end) p
                        where case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, p) else has_table_privilege('anon', c.oid, p) end)
          union all
          select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')""").fetchall()
        assert ouverts == [], ouverts
