# Tests de la migration « agenda » (demi-journées occupées) sur un VRAI PostgreSQL (banc local, Supabase imité).
# Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql   (cluster démarré avec -c cluster_name=climpilot-test)
# Base neuve à chaque test : 00_supabase_emul.sql + 01_base_actuelle.sql + migration agenda (appliquée deux fois : rejouable).
# Vérifié aussi le 20/10/2026 sur PGlite (PostgreSQL 16 en mémoire) avec les mêmes contrôles.
# Date de référence (OUTILLAGE-2, 05/11/2026) : UNE seule date, lue une fois par test sur le serveur (BASE['ref']), d'où sont tirés
# tous les jours ET toutes les fenêtres passés aux fonctions. Avant, les jours venaient de l'horloge de Python (truquée par faketime)
# et les fenêtres de current_date (horloge de PostgreSQL, jamais truquée) : sous « faketime 2027-01-05 », les jours tombaient hors de
# la fenêtre et 3 tests échouaient. Pourquoi la date du serveur et pas une date figée comme REF (tests/lib.mjs) : cp_busy_remplacer
# fait son ménage avec current_date (jours passés de plus de 30 jours) ; une date figée deviendrait « passée » avec le temps et
# ce ménage effacerait les jours du test. PostgreSQL ne permet pas de figer current_date pour une session.
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
BASE = {'nom': None, 'ref': None}


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
        BASE['ref'] = c.execute('select current_date').fetchone()[0]
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
    """Jour de référence + n jours (texte AAAA-MM-JJ). Jamais l'horloge de Python."""
    assert isinstance(BASE['ref'], datetime.date), 'date de référence non lue'
    return (BASE['ref'] + datetime.timedelta(days=n)).isoformat()


def appli(c, jours, du=0, au=60):
    return c.execute('select public.cp_busy_appli(%s::date, %s::date, %s::jsonb)', (jour(du), jour(au), json.dumps(jours))).fetchone()[0]


def test_appli_enregistre_ses_demi_journees_et_ignore_le_reste():
    with cnx(A) as c:
        n = appli(c, [{'jour': jour(3), 'matin': True}, {'jour': '2000-01-01', 'matin': True}, {'jour': 'x'}, {'jour': jour(4), 'matin': False, 'apresmidi': False}])
        assert n == 1
        assert c.execute('select source, jour, matin, apresmidi from public.climpilot_busy').fetchall() == [('climpilot', datetime.date.fromisoformat(jour(3)), True, False)]


def test_remplacement_de_la_fenetre():
    with cnx(A) as c:
        appli(c, [{'jour': jour(3), 'matin': True}, {'jour': jour(5), 'apresmidi': True}])
        appli(c, [{'jour': jour(6), 'matin': True}])
        assert [r[0].isoformat() for r in c.execute('select jour from public.climpilot_busy order by jour')] == [jour(6)]


def test_chacun_ne_voit_que_ses_demi_journees():
    with cnx(A) as c:
        assert appli(c, [{'jour': jour(3), 'matin': True}]) == 1  # A a bien écrit (sans cela, « B ne voit rien » ne prouverait rien)
        assert c.execute('select count(*) from public.climpilot_busy').fetchone()[0] == 1
    with cnx(B) as c:
        assert c.execute('select count(*) from public.climpilot_busy').fetchone()[0] == 0


def test_ecriture_directe_et_fonction_interne_refusees_au_compte():
    with cnx(A) as c:
        for sql, args in (("insert into public.climpilot_busy(user_id,source,jour,matin) values (%s,'google',%s::date,true)", (A, jour(0))),
                          ('delete from public.climpilot_busy', None),
                          ("select public.cp_busy_remplacer(%s,'google',%s::date,%s::date,'[]')", (B, jour(0), jour(1)))):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(sql, args)


def test_anonyme_refuse():
    with cnx(None, 'anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("select public.cp_busy_appli(%s::date, %s::date, '[]')", (jour(0), jour(1)))


def test_service_role_google_et_garde_fous():
    with cnx(None, 'service_role') as c:
        n = c.execute("select public.cp_busy_remplacer(%s,'google',%s::date,%s::date,%s::jsonb)", (A, jour(0), jour(10), json.dumps([{'jour': jour(5), 'apresmidi': True}]))).fetchone()[0]
        assert n == 1
        for user, source, du, au in ((A, 'google', 0, 200), (A, 'autre', 0, 2), (A, 'google', 5, 1)):
            with pytest.raises(psycopg.errors.RaiseException):
                c.execute("select public.cp_busy_remplacer(%s,%s,%s::date,%s::date,'[]')", (user, source, jour(du), jour(au)))
    with cnx(A) as c:
        appli(c, [])  # l'appli vide sa source sans toucher à celle de Google
        assert c.execute('select source from public.climpilot_busy').fetchall() == [('google',)]
