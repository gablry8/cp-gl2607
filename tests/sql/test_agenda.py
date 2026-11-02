# Tests de la migration « agenda » (demi-journées occupées) sur un VRAI PostgreSQL (banc local, Supabase imité).
# Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql   (cluster démarré avec -c cluster_name=climpilot-test)
# Base neuve à chaque test : 00_supabase_emul.sql + 01_base_actuelle.sql + migration agenda (appliquée deux fois : rejouable).
# Vérifié aussi le 20/10/2026 sur PGlite (PostgreSQL 16 en mémoire) avec les mêmes contrôles.
import json, os, uuid, datetime, pathlib
import psycopg, pytest
from cible_locale import CibleRefusee, parametres, verifier_connexion

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATION = RACINE / 'supabase' / 'migrations' / '20261020120000_agenda.sql'
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
BASE = {'nom': None}


@pytest.fixture(autouse=True)
def base_neuve():
    nom = 'cpag_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    BASE['nom'] = nom
    with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
        for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
            c.execute(f.read_text())
        c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
        c.execute(MIGRATION.read_text())
        c.execute(MIGRATION.read_text())
    yield nom
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'drop database {nom} with (force)')


def cnx(user=None, role='authenticated'):
    c = psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)
    c.execute(f'set role {role}')
    claims = {'role': role}
    if user:
        claims['sub'] = user
    c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    return c


def jour(n):
    return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()


def appli(c, jours, du=0, au=60):
    return c.execute('select public.cp_busy_appli(current_date + %s, current_date + %s, %s::jsonb)', (du, au, json.dumps(jours))).fetchone()[0]


def test_appli_enregistre_ses_demi_journees_et_ignore_le_reste():
    with cnx(A) as c:
        n = appli(c, [{'jour': jour(3), 'matin': True}, {'jour': '2000-01-01', 'matin': True}, {'jour': 'x'}, {'jour': jour(4), 'matin': False, 'apresmidi': False}])
        assert n == 1
        assert c.execute('select source, matin, apresmidi from public.climpilot_busy').fetchall() == [('climpilot', True, False)]


def test_remplacement_de_la_fenetre():
    with cnx(A) as c:
        appli(c, [{'jour': jour(3), 'matin': True}, {'jour': jour(5), 'apresmidi': True}])
        appli(c, [{'jour': jour(6), 'matin': True}])
        assert [r[0].isoformat() for r in c.execute('select jour from public.climpilot_busy order by jour')] == [jour(6)]


def test_chacun_ne_voit_que_ses_demi_journees():
    with cnx(A) as c:
        appli(c, [{'jour': jour(3), 'matin': True}])
    with cnx(B) as c:
        assert c.execute('select count(*) from public.climpilot_busy').fetchone()[0] == 0


def test_ecriture_directe_et_fonction_interne_refusees_au_compte():
    with cnx(A) as c:
        for sql in ("insert into public.climpilot_busy(user_id,source,jour,matin) values ('%s','google',current_date,true)" % A,
                    'delete from public.climpilot_busy',
                    "select public.cp_busy_remplacer('%s','google',current_date,current_date+1,'[]')" % B):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(sql)


def test_anonyme_refuse():
    with cnx(None, 'anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("select public.cp_busy_appli(current_date, current_date+1, '[]')")


def test_service_role_google_et_garde_fous():
    with cnx(None, 'service_role') as c:
        n = c.execute("select public.cp_busy_remplacer(%s,'google',current_date,current_date+10,%s::jsonb)", (A, json.dumps([{'jour': jour(5), 'apresmidi': True}]))).fetchone()[0]
        assert n == 1
        for args in ((A, 'google', 0, 200), (A, 'autre', 0, 2), (A, 'google', 5, 1)):
            with pytest.raises(psycopg.errors.RaiseException):
                c.execute('select public.cp_busy_remplacer(%s,%s,current_date + %s,current_date + %s,\'[]\')', args)
    with cnx(A) as c:
        appli(c, [])  # l'appli vide sa source sans toucher à celle de Google
        assert c.execute('select source from public.climpilot_busy').fetchall() == [('google',)]
