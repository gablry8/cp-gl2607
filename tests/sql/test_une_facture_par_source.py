# C1 (M3, 21/10/2026) — règle serveur « une seule facture VIVANTE par source » dans cp_emettre_document, sur un VRAI PostgreSQL
# (banc local, Supabase imité). Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql
# Base neuve à chaque test : 00_supabase_emul.sql + 01_base_actuelle.sql + migration documents (1.10) + migration C1 (rejouable, 2 fois).
# Avant la correction, la migration C1 n'existe pas : les tests tournent sur la fonction 1.10 et doivent être ROUGES.
# Source d'un document = payload->'src' : {k: devis|dep|loc|ctr, id, w: acompte|solde|''|annee}. Un avoir TOTAL
# (type avoir, payload->'fac'->>'total' = 'true') dont payload->'src'->>'w' commence par le numéro de la facture la libère.
import json, os, uuid, threading, pathlib
import psycopg, pytest
from cible_locale import CibleRefusee, parametres, verifier_connexion

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATION_1_10 = RACINE / 'supabase' / 'migrations' / '20261002120000_documents_emis.sql'
MIGRATION_C1 = RACINE / 'supabase' / 'migrations' / '20261021180000_une_facture_par_source.sql'
RETOUR_C1 = RACINE / 'tests' / 'supabase-test' / '4-une-facture-par-source-retour-arriere.sql'
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
V = '1.12.0'
BASE = {'nom': None}


@pytest.fixture(autouse=True)
def base_neuve():
    nom = 'cpc1_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    BASE['nom'] = nom
    with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
        for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
            c.execute(f.read_text())
        c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
        c.execute(MIGRATION_1_10.read_text())
        if MIGRATION_C1.exists():
            c.execute(MIGRATION_C1.read_text())
            c.execute(MIGRATION_C1.read_text())  # rejouable
    yield nom
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'drop database {nom} with (force)')


def admin():
    return psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)


def cnx(user=None, role='authenticated'):
    c = psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)
    if role:
        c.execute(f'set role {role}')
    claims = {'role': role or 'postgres'}
    if user:
        claims['sub'] = user
    c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    return c


def aujourdhui(c):
    return c.execute("select (now() at time zone 'Europe/Paris')::date").fetchone()[0]


def src(k='devis', id='dv1', w='solde'):
    return {'k': k, 'id': id, 'w': w}


def payload(k='devis', id='dv1', w='solde', montant=191.10, total=273.00):
    fac = {'num': '', 'montant': montant, 'total': total} if w != 'acompte' else {'num': '', 'montant': montant, 'baseTTC': total}
    return {'v': 1, 'app': V, 'src': src(k, id, w), 'type': 'acompte' if w == 'acompte' else 'facture', 'fac': fac}


def emettre(c, pl, rid=None, serie='F', typ=None, date=None, version=V):
    rid = rid or str(uuid.uuid4())
    typ = typ or ('avoir' if serie == 'AV' else pl.get('type', 'facture'))
    r = c.execute('select public.cp_emettre_document(%s,%s,%s,%s,%s::jsonb,%s,%s)',
                  (rid, serie, typ, date or aujourdhui(c), json.dumps(pl), 0, version)).fetchone()[0]
    return rid, r


def avoir(c, fac_num, montant, total):
    pl = {'v': 1, 'app': V, 'src': {'k': 'avoir', 'id': 'av' + uuid.uuid4().hex[:4], 'w': fac_num}, 'type': 'avoir',
          'fac': {'num': '', 'facNum': fac_num, 'montant': montant, 'total': total}}
    return emettre(c, pl, serie='AV', typ='avoir')


def nb_docs(c):
    return c.execute('select count(*) from public.climpilot_documents').fetchone()[0]


def seq(c, serie='F'):
    return c.execute('select coalesce(max(dernier),0) from public.climpilot_seq where serie=%s', (serie,)).fetchone()[0]


# ---------- S1 : deux soldes pour le même devis ----------
def test_s1_deuxieme_solde_meme_devis_refuse_et_facture_existante_renvoyee():
    with cnx(A) as c:
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        assert r1['ok'] and r1['doc']['num'].endswith('-001')
        _, r2 = emettre(c, payload(w='solde', montant=273.00, total=273.00))  # autre request_id, même source
        assert r2['ok'] is False and r2['raison'] == 'deja_facture' and r2['doc']['num'] == r1['doc']['num']
        assert nb_docs(c) == 1 and seq(c) == 1  # le refus n'a pas consommé de numéro


# ---------- S2/S3 : solde après acompte ----------
def test_s2_solde_qui_ignore_l_acompte_refuse():
    with cnx(A) as c:
        _, ra = emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        _, rs = emettre(c, payload(w='solde', montant=273.00, total=273.00))  # l'acompte n'est pas déduit
        assert rs['ok'] is False and rs['raison'] == 'acompte_ignore' and rs['doc']['num'] == ra['doc']['num']
        assert nb_docs(c) == 1 and seq(c) == 1


def test_s3_solde_coherent_avec_l_acompte_accepte():
    with cnx(A) as c:
        _, ra = emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        _, rs = emettre(c, payload(w='solde', montant=191.10, total=273.00))
        assert rs['ok'] and rs['deja'] is False and rs['doc']['num'].endswith('-002')
        # arrondi au centime toléré (le solde est calculé par l'appareil en flottants)
        _, rs2 = emettre(c, payload(id='dv2', w='acompte', montant=33.33, total=100.00))
        _, rs3 = emettre(c, payload(id='dv2', w='solde', montant=66.67, total=100.00))
        assert rs3['ok']
        assert nb_docs(c) == 4


def test_s2bis_solde_sans_total_ni_montant_quand_un_acompte_existe_refuse():
    with cnx(A) as c:
        emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        pl = payload(w='solde'); pl['fac'] = {'num': ''}
        _, rs = emettre(c, pl)
        assert rs['ok'] is False and rs['raison'] == 'acompte_ignore'


# ---------- S4/S5 : avoir total libère, avoir partiel non ----------
def test_s4_avoir_total_libere_le_chantier():
    with cnx(A) as c:
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        _, av = avoir(c, r1['doc']['num'], 273.00, True)
        assert av['ok'] and av['doc']['serie'] == 'AV'
        _, r2 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        assert r2['ok'] and r2['doc']['num'] != r1['doc']['num']


def test_s5_avoir_partiel_ne_libere_pas():
    with cnx(A) as c:
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        _, av = avoir(c, r1['doc']['num'], 20.00, False)
        assert av['ok']
        _, r2 = emettre(c, payload(w='solde', montant=253.00, total=273.00))
        assert r2['ok'] is False and r2['raison'] == 'deja_facture' and r2['doc']['num'] == r1['doc']['num']


def test_s4bis_acompte_annule_par_avoir_total_puis_refait_puis_solde_sur_le_nouveau():
    with cnx(A) as c:
        _, a1 = emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        avoir(c, a1['doc']['num'], 81.90, True)
        _, a2 = emettre(c, payload(w='acompte', montant=54.60, total=273.00))  # refait, autre montant
        assert a2['ok'] and a2['doc']['num'] != a1['doc']['num']
        _, s_faux = emettre(c, payload(w='solde', montant=191.10, total=273.00))  # déduit l'acompte ANNULÉ
        assert s_faux['ok'] is False and s_faux['raison'] == 'acompte_ignore' and s_faux['doc']['num'] == a2['doc']['num']
        _, s_ok = emettre(c, payload(w='solde', montant=218.40, total=273.00))
        assert s_ok['ok']


def test_s4ter_avoir_total_reconstitue_importe_libere_aussi():
    with cnx(A) as c:
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        pl = {'v': 1, 'src': {'k': 'avoir', 'id': 'avx', 'w': r1['doc']['num']}, 'type': 'avoir', 'fac': {'num': '', 'facNum': r1['doc']['num'], 'montant': 273.00, 'total': True}}
        r = c.execute('select public.cp_importer_ancien(%s,%s,%s,%s,%s,%s::jsonb)',
                      (str(uuid.uuid4()), 'AV', 'avoir', 'AV-2025-007', '2025-06-01', json.dumps(pl))).fetchone()[0]
        assert r['ok'] and r['doc']['origine'] == 'reconstitue'
        _, r2 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        assert r2['ok']


# ---------- S6 : acomptes ----------
def test_s6_deuxieme_acompte_refuse_et_acompte_apres_solde_refuse():
    with cnx(A) as c:
        _, a1 = emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        _, a2 = emettre(c, payload(w='acompte', montant=81.90, total=273.00))
        assert a2['ok'] is False and a2['raison'] == 'deja_facture' and a2['doc']['num'] == a1['doc']['num']
        _, s1 = emettre(c, payload(id='dv3', w='solde', montant=500.00, total=500.00))
        _, a3 = emettre(c, payload(id='dv3', w='acompte', montant=150.00, total=500.00))
        assert a3['ok'] is False and a3['raison'] == 'solde_deja_emis' and a3['doc']['num'] == s1['doc']['num']
        assert nb_docs(c) == 2


# ---------- S7 : interventions, locations, contrats ----------
def test_s7_une_facture_vivante_par_intervention_location_et_contrat_annee():
    with cnx(A) as c:
        _, d1 = emettre(c, payload(k='dep', id='dep1', w='', montant=120.00, total=120.00))
        _, d2 = emettre(c, payload(k='dep', id='dep1', w='', montant=120.00, total=120.00))
        assert d1['ok'] and d2['ok'] is False and d2['raison'] == 'deja_facture'
        _, l1 = emettre(c, payload(k='loc', id='loc1', w='', montant=300.00, total=300.00))
        _, l2 = emettre(c, payload(k='loc', id='loc1', w='', montant=300.00, total=300.00))
        assert l1['ok'] and l2['ok'] is False
        _, c1 = emettre(c, payload(k='ctr', id='ctr1', w='2027', montant=240.00, total=240.00))
        _, c2 = emettre(c, payload(k='ctr', id='ctr1', w='2028', montant=240.00, total=240.00))  # autre année : accepté
        _, c3 = emettre(c, payload(k='ctr', id='ctr1', w='2027', montant=240.00, total=240.00))
        assert c1['ok'] and c2['ok'] and c3['ok'] is False
        # une autre intervention, un autre devis : acceptés ; une facture SANS source (ancien client) : acceptée, hors règle
        _, d3 = emettre(c, payload(k='dep', id='dep2', w='', montant=50.00, total=50.00))
        _, sans = emettre(c, {'v': 1, 'app': V, 'type': 'facture', 'fac': {'num': '', 'montant': 10}})
        assert d3['ok'] and sans['ok']
        assert nb_docs(c) == 6


def test_s7bis_la_source_d_un_autre_utilisateur_ne_compte_pas():
    with cnx(A) as c:
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        assert r1['ok']
    with cnx(B) as c:
        _, r2 = emettre(c, payload(w='solde', montant=273.00, total=273.00))  # même id de devis, autre compte
        assert r2['ok']


# ---------- S8 : rejeu ----------
def test_s8_meme_request_id_rejoue_toujours_idempotent():
    with cnx(A) as c:
        rid, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        _, r2 = emettre(c, payload(w='solde', montant=999.00, total=999.00), rid=rid)
        assert r2['ok'] and r2['deja'] and r2['doc']['id'] == r1['doc']['id']
        assert nb_docs(c) == 1


# ---------- S9 : anciennes factures reconstituées hors règle ----------
def test_s9_reconstituees_hors_regle_et_sans_effet_sur_la_regle():
    with cnx(A) as c:
        for n in ('F-2025-001', 'F-2025-002'):
            r = c.execute('select public.cp_importer_ancien(%s,%s,%s,%s,%s,%s::jsonb)',
                          (str(uuid.uuid4()), 'F', 'facture', n, '2025-06-01', json.dumps(payload(w='solde', montant=100, total=100)))).fetchone()[0]
            assert r['ok']
        # une reconstituée pour la même source n'empêche pas une vraie émission (elle n'est pas « vivante » au sens du registre émis)
        _, r = emettre(c, payload(w='solde', montant=100.00, total=100.00))
        assert r['ok']
        assert nb_docs(c) == 3


# ---------- S10 : concurrence ----------
def test_s10_deux_soldes_simultanes_un_seul_accepte():
    res, err = [], []

    def go():
        try:
            with cnx(A) as c:
                res.append(emettre(c, payload(w='solde', montant=273.00, total=273.00))[1])
        except Exception as e:  # noqa
            err.append(repr(e))
    th = [threading.Thread(target=go) for _ in range(8)]
    [t.start() for t in th]; [t.join() for t in th]
    assert not err, err
    assert sum(1 for r in res if r['ok']) == 1 and all(r['raison'] == 'deja_facture' for r in res if not r['ok'])
    with cnx(A) as c:
        assert nb_docs(c) == 1 and seq(c) == 1


def test_s10bis_solde_et_acompte_simultanes_sur_le_meme_devis():
    res, err = [], []

    def go(w, m):
        try:
            with cnx(A) as c:
                res.append((w, emettre(c, payload(w=w, montant=m, total=273.00))[1]))
        except Exception as e:  # noqa
            err.append(repr(e))
    th = [threading.Thread(target=go, args=a) for a in (('solde', 273.00), ('acompte', 81.90))]
    [t.start() for t in th]; [t.join() for t in th]
    assert not err, err
    assert sum(1 for _, r in res if r['ok']) == 1  # l'un passe, l'autre est refusé (solde sans acompte, ou acompte après solde)


# ---------- S11 : droits ----------
def test_s11_anon_refuse_authenticated_accepte():
    with cnx(None, role='anon') as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            emettre(c, payload())
    with cnx(A) as c:
        assert emettre(c, payload())[1]['ok']
    with admin() as c:
        row = c.execute("""select has_function_privilege('anon', p.oid, 'EXECUTE'), has_function_privilege('authenticated', p.oid, 'EXECUTE')
                           from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cp_emettre_document'""").fetchone()
        assert row == (False, True)


# ---------- S12 : migration rejouable, retour arrière ----------
def test_s12_migration_rejouable_et_retour_arriere_remet_la_version_1_10():
    assert MIGRATION_C1.exists() and RETOUR_C1.exists()
    with admin() as c:
        c.execute(MIGRATION_C1.read_text())  # 3e application : rien ne casse
        assert c.execute("select obj_description(p.oid,'pg_proc') from pg_proc p where p.proname='cp_emettre_document'").fetchone()[0]
        c.execute(RETOUR_C1.read_text())
    with cnx(A) as c:  # fonction 1.10 : la règle n'existe plus (2 soldes acceptés), le reste marche
        _, r1 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        _, r2 = emettre(c, payload(w='solde', montant=273.00, total=273.00))
        assert r1['ok'] and r2['ok'] and nb_docs(c) == 2
    with admin() as c:
        c.execute(MIGRATION_C1.read_text())  # et on la remet
    with cnx(A) as c:
        _, r3 = emettre(c, payload(id='dv9', w='solde', montant=1.00, total=1.00))
        _, r4 = emettre(c, payload(id='dv9', w='solde', montant=1.00, total=1.00))
        assert r3['ok'] and r4['ok'] is False
