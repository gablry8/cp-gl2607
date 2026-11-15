# PREUVE-SIGNATURE (15/11/2026) — signature : verrouillage complet d'une demande de signature, sur un VRAI PostgreSQL
# (banc local, Supabase imité). Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql/test_preuve_signature.py
# Base neuve à chaque test : 00_supabase_emul.sql + 01_base_actuelle.sql + TOUTES les migrations de supabase/migrations
# (ordre des noms) ; la migration PREUVE-SIGNATURE est appliquée une 2e fois (rejouable).
# Règle vérifiée pour le rôle authenticated (l'appli connectée, next-signature.js) : toute modification d'une demande de
# signature est refusée, SAUF
#   (a) statut 'en_attente' → 'annule', aucune autre colonne changée (nouveau lien, devis remplacé ou annulé, « Désactiver ») ;
#   (b) applique false → true, aucune autre colonne changée (l'appli a pris en compte la signature ou le refus).
# Les colonnes sont lues dans information_schema : une colonne ajoutée plus tard est vérifiée d'office.
# La fonction publique « signature » (service_role) garde ses droits : vu, signer, refuser, copie. auth.uid() nul : inchangé.
# Création d'une demande (déclencheur cp_sig_insert) : le serveur impose aussi la date de création et un motif de refus vide.
# Avant la correction, la migration et ses scripts n'existent pas : ces tests doivent être ROUGES.
import json, os, uuid, pathlib, contextlib
import psycopg, pytest
from cible_locale import CibleRefusee, parametres, verifier_connexion

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATIONS = RACINE / 'supabase' / 'migrations'
MIGRATION_PS = MIGRATIONS / '20261115120000_preuve_signature.sql'
ESSAIS = RACINE / 'tests' / 'supabase-test'
SCRIPT_TEST = ESSAIS / '7-preuve-signature-TEST.sql'
SCRIPT_REEL = ESSAIS / '7-REEL-preuve-signature.sql'
RETOUR = ESSAIS / '7-preuve-signature-retour-arriere.sql'
try:
    ADMIN = parametres()
except CibleRefusee as e:
    if not os.environ.get('PGHOST'):
        pytest.skip(str(e), allow_module_level=True)  # non exécuté (annoncé comme tel), jamais « réussi »
    pytest.exit(f'CIBLE REFUSÉE : {e}', returncode=3)
with psycopg.connect(**ADMIN, connect_timeout=5) as _c:
    try:
        verifier_connexion(_c)
    except CibleRefusee as e:
        pytest.exit(f'CIBLE REFUSÉE : {e}', returncode=3)
A = '11111111-1111-1111-1111-111111111111'
B = '22222222-2222-2222-2222-222222222222'

# Empreinte (md5, fins de ligne Windows retirées) du code de public.cp_sig_guard lu en lecture seule sur le projet réel ET
# sur ClimPilot-TEST le 15/11/2026 : c'est la fonction que le retour arrière doit remettre.
EMPREINTE_AVANT = '01fa989c59f024f00666b9fb48e2d769'
EMPREINTE_INSERT_AVANT = 'a761e69f5c4d5bc86ac7b1fa64f65bef'  # public.cp_sig_insert, même lecture (réel et TEST)
MESSAGES = {'modification interdite', 'changement de statut interdit'}  # courts, sans donnée du client
STATUTS = ('en_attente', 'signe', 'refuse', 'annule')
PNG = 'data:image/png;base64,' + 'A' * 900
TABLE = 'public.climpilot_signatures'
BASE = {'nom': None}


def migrations_sans_ps():
    return [f for f in sorted(MIGRATIONS.glob('*.sql')) if f.name != MIGRATION_PS.name]


@contextlib.contextmanager
def base(avec_ps=True):
    """Base neuve (Supabase imité + base actuelle + migrations). Avec avec_ps, la migration PREUVE-SIGNATURE est appliquée deux fois."""
    nom = 'cpps_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    try:
        with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
            for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
                c.execute(f.read_text())
            c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
            for f in migrations_sans_ps():
                c.execute(f.read_text())
            if avec_ps and MIGRATION_PS.exists():  # absente avant la correction : les tests échouent sur leurs contrôles
                c.execute(MIGRATION_PS.read_text())
                c.execute(MIGRATION_PS.read_text())  # rejouable
        yield nom
    finally:
        with psycopg.connect(**ADMIN, autocommit=True) as c:
            c.execute(f'drop database {nom} with (force)')


@pytest.fixture(autouse=True)
def base_neuve():
    with base() as nom:
        BASE['nom'] = nom
        yield nom


def admin(nom=None):
    """Administrateur (postgres, sans jeton : auth.uid() nul), comme le SQL Editor."""
    return psycopg.connect(**{**ADMIN, 'dbname': nom or BASE['nom']}, autocommit=True)


def cnx(user=None, role='authenticated', nom=None):
    """Connexion « comme l'appli » (authenticated + jeton) ou « comme la fonction signature » (service_role)."""
    c = psycopg.connect(**{**ADMIN, 'dbname': nom or BASE['nom']}, autocommit=True)
    c.execute(f'set role {role}')
    claims = {'role': role}
    if user:
        claims['sub'] = user
    c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    return c


def resultat_final(c, script):
    """Exécute un script SQL complet (comme le SQL Editor) ; renvoie les lignes du dernier select."""
    cur = c.execute(script)
    lignes = None
    while True:
        if cur.description:
            lignes = cur.fetchall()
        if not cur.nextset():
            break
    return lignes


def colonnes(c):
    """Toutes les colonnes de la table, lues dans information_schema (pas de liste recopiée à la main)."""
    return c.execute("""select column_name, data_type from information_schema.columns
                        where table_schema = 'public' and table_name = 'climpilot_signatures' order by ordinal_position""").fetchall()


def ligne(c, tok):
    return c.execute(f'select to_jsonb(s) from {TABLE} s where token = %s', (tok,)).fetchone()[0]


def empreinte(c, f='public.cp_sig_guard()'):
    return c.execute("select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = %s::regprocedure", (f,)).fetchone()[0]


# ---------- gestes de l'appli (next-signature.js) et de la fonction publique « signature » (index.ts), en SQL ----------
def appli_creer(c, doc_id):
    """createLink : insertion d'une demande en attente (le serveur calcule l'empreinte et vide les colonnes de preuve)."""
    return c.execute(f"""insert into {TABLE}(user_id, doc_type, doc_id, doc_num, titre, client_nom, montant_ttc, doc_html)
                         values (%s, 'devis', %s, 'DV-ESSAI-1', 'Climatisation murale', 'Client Essai', 1500, '<p>devis</p>')
                         returning token""", (A, doc_id)).fetchone()[0]


def appli_annuler_liens(c, doc_id):
    """createLink et desactiverLiens : update({statut:'annule'}).eq('doc_id').eq('doc_type').eq('statut','en_attente')."""
    return [r[0] for r in c.execute(f"update {TABLE} set statut = 'annule' where doc_id = %s and doc_type = 'devis' and statut = 'en_attente' returning token",
                                    (doc_id,)).fetchall()]


def service_lire(s, tok):
    s.execute(f'update {TABLE} set vu_at = now() where token = %s', (tok,))


def service_signer(s, tok):
    return s.execute(f"""update {TABLE} set statut = 'signe', signed_at = now(), signer_nom = 'Client Essai', signature_png = %s,
                         signer_ip = '192.0.2.10', signer_ua = 'Navigateur essai', consentement = 'J''ai lu le devis… Bon pour accord.',
                         support_durable_accord = true where token = %s and statut = 'en_attente' returning token""", (PNG, tok)).fetchall()


def service_refuser(s, tok):
    return s.execute(f"""update {TABLE} set statut = 'refuse', signed_at = now(), signer_nom = 'Client Essai', signer_ip = '192.0.2.10',
                         signer_ua = 'Navigateur essai', motif_refus = 'Trop cher' where token = %s and statut = 'en_attente' returning token""",
                     (tok,)).fetchall()


def service_copie(s, tok):
    s.execute(f'update {TABLE} set copie_le = coalesce(copie_le, now()), copie_nb = copie_nb + 1 where token = %s', (tok,))


def demande(statut, doc_id=None):
    """Une demande dans l'état voulu, construite par les vrais gestes (appli puis fonction publique), colonnes remplies."""
    doc_id = doc_id or 'd-' + uuid.uuid4().hex[:8]
    with cnx(A) as c, cnx(None, role='service_role') as s:
        tok = appli_creer(c, doc_id)
        service_lire(s, tok)
        if statut == 'signe':
            assert service_signer(s, tok) == [(tok,)]
            service_copie(s, tok)
        elif statut == 'refuse':
            assert service_refuser(s, tok) == [(tok,)]
        elif statut == 'annule':
            assert appli_annuler_liens(c, doc_id) == [tok]
    with admin() as a:
        assert a.execute(f'select statut from {TABLE} where token = %s', (tok,)).fetchone()[0] == statut
    return tok


# ---------- une modification tentée par le compte connecté ----------
def valeur_modifiee(col, typ):
    """Expression SQL qui donne à la colonne une AUTRE valeur, valide pour les contraintes de la table."""
    if col == 'doc_type':
        return "case when doc_type = 'devis' then 'fluide' else 'devis' end"
    if col == 'user_id':
        return f"'{B}'::uuid"
    simple = {
        'text': f"coalesce({col}, '') || ' (modifié)'",
        'numeric': f'coalesce({col}, 0) + 1', 'integer': f'coalesce({col}, 0) + 1',
        'bigint': f'coalesce({col}, 0) + 1', 'smallint': f'coalesce({col}, 0) + 1',
        'timestamp with time zone': f"coalesce({col}, now()) + interval '1 day'",
        'timestamp without time zone': f"coalesce({col}, now()::timestamp) + interval '1 day'",
        'date': f'coalesce({col}, current_date) + 1',
        'boolean': f'not coalesce({col}, false)',
        'uuid': 'gen_random_uuid()',
        'jsonb': f"""coalesce({col}, '{{}}'::jsonb) || '{{"modifie": true}}'::jsonb""",
    }
    if typ not in simple:
        pytest.fail(f'colonne {col} ({typ}) : type non prévu par ce test, ajoute une valeur modifiée')
    return simple[typ]


def tentative(c, tok, set_sql, params=(), prealable=None):
    """Tente « update … set <set_sql> » dans une transaction TOUJOURS annulée (la ligne reste intacte pour la suite).
    prealable : modification permise faite juste avant, dans la même transaction. Renvoie None si le serveur refuse avec
    un message attendu ; sinon ce qui s'est passé (acceptée, ligne non atteinte, autre erreur, message inattendu)."""
    try:
        with c.transaction(force_rollback=True):
            if prealable:
                n0 = c.execute(f'update {TABLE} set {prealable} where token = %s', (tok,)).rowcount
                if n0 != 1:
                    return f'préalable non appliqué ({n0})'
            n = c.execute(f'update {TABLE} set {set_sql} where token = %s', (*params, tok)).rowcount
    except psycopg.errors.RaiseException as e:
        msg = e.diag.message_primary
        return None if msg in MESSAGES else f'message inattendu : {msg}'
    except psycopg.Error as e:
        return f'autre erreur : {type(e).__name__} {e.diag.message_primary}'
    return 'acceptée' if n == 1 else f'ligne non atteinte ({n})'


# ---------- 1. toute colonne, quatre états ----------
def test_ps_01_colonnes_lues_dans_information_schema():
    with admin() as a:
        cols = dict(colonnes(a))
    assert len(cols) >= 25, cols  # 25 colonnes sur le réel le 15/11/2026
    for k in ('token', 'statut', 'applique', 'doc_html', 'doc_hash', 'montant_ttc', 'copie_nb'):
        assert k in cols, k


@pytest.mark.parametrize('statut', ['signe', 'refuse', 'annule', 'en_attente'])
def test_ps_02_chaque_colonne_refusee_au_compte_connecte(statut):
    tok = demande(statut)
    with admin() as a:
        avant, cols = ligne(a, tok), colonnes(a)
    refus, pas_refusees = 0, {}
    with cnx(A) as c:
        for col, typ in cols:
            if col == 'statut':
                essais = [(f'statut → {autre}', 'statut = %s', (autre,), None) for autre in STATUTS
                          if autre != statut and not (statut == 'en_attente' and autre == 'annule')]  # (a) : vérifié à part
            elif col == 'applique':  # false → true seul est le cas (b), vérifié à part ; ici : revenir en arrière
                essais = [('applique → false', 'applique = false', (), 'applique = true')]
            else:
                essais = [(col, f'{col} = {valeur_modifiee(col, typ)}', (), None)]
            for nom, set_sql, params, prealable in essais:
                r = tentative(c, tok, set_sql, params, prealable)
                if r:
                    pas_refusees[nom] = r
                else:
                    refus += 1
    with admin() as a:
        assert ligne(a, tok) == avant, 'la ligne a changé'
    assert pas_refusees == {}, f'demande {statut} : {pas_refusees}'
    assert refus >= len(cols), refus


# ---------- 2. les deux cas permis ----------
def test_ps_03_cas_a_annuler_une_demande_en_attente_seul_le_statut_change():
    t1, t2 = demande('en_attente', 'd-a1'), demande('en_attente', 'd-a2')
    with admin() as a:
        avant1, avant2 = ligne(a, t1), ligne(a, t2)
    with cnx(A) as c:
        assert appli_annuler_liens(c, 'd-a1') == [t1]  # createLink / desactiverLiens
        assert c.execute(f"update {TABLE} set statut = 'annule' where token = %s", (t2,)).rowcount == 1  # nxsCancel (« Désactiver »)
    with admin() as a:
        for tok, avant in ((t1, avant1), (t2, avant2)):
            apres = ligne(a, tok)
            assert apres['statut'] == 'annule'
            assert {k: v for k, v in apres.items() if k != 'statut'} == {k: v for k, v in avant.items() if k != 'statut'}


def test_ps_04_cas_a_refuse_si_une_autre_colonne_change_en_meme_temps():
    tok = demande('en_attente')
    pas_refusees = {}
    with admin() as a:
        cols = colonnes(a)
    with cnx(A) as c:
        for col, typ in cols:
            if col == 'statut':
                continue
            v = 'true' if col == 'applique' else valeur_modifiee(col, typ)
            r = tentative(c, tok, f"statut = 'annule', {col} = {v}")
            if r:
                pas_refusees[col] = r
        assert tentative(c, tok, "statut = 'annule'") == 'acceptée'  # seul : permis (mise en place du contrôle)
    assert pas_refusees == {}, pas_refusees


def test_ps_05_cas_b_signature_appliquee_seule_la_marque_change():
    ts, tr = demande('signe'), demande('refuse')
    with admin() as a:
        avant = {t: ligne(a, t) for t in (ts, tr)}
    with cnx(A) as c:  # refresh : update({applique:true}).in('token', done)
        assert c.execute(f'update {TABLE} set applique = true where token = any(%s)', ([ts, tr],)).rowcount == 2
        # relevé suivant sur un autre appareil : la même marque déjà posée ne change rien et ne bloque rien
        assert c.execute(f'update {TABLE} set applique = true where token = any(%s)', ([ts, tr],)).rowcount == 2
    with admin() as a:
        for t in (ts, tr):
            apres = ligne(a, t)
            assert apres['applique'] is True
            assert {k: v for k, v in apres.items() if k != 'applique'} == {k: v for k, v in avant[t].items() if k != 'applique'}


def test_ps_06_cas_b_refuse_si_une_autre_colonne_change_en_meme_temps():
    tok = demande('signe')
    pas_refusees = {}
    with admin() as a:
        cols = colonnes(a)
    with cnx(A) as c:
        for col, typ in cols:
            if col == 'applique':
                continue
            v = "'annule'" if col == 'statut' else valeur_modifiee(col, typ)
            r = tentative(c, tok, f'applique = true, {col} = {v}')
            if r:
                pas_refusees[col] = r
        assert tentative(c, tok, 'applique = true') == 'acceptée'  # seul : permis (mise en place du contrôle)
    assert pas_refusees == {}, pas_refusees


def test_ps_07_mise_a_jour_sans_changement_acceptee():
    """Un geste répété (lien déjà désactivé sur un autre appareil, marque déjà posée) ne doit pas faire échouer l'appli."""
    ta, ts = demande('annule'), demande('signe')
    with cnx(A) as c:
        assert c.execute(f"update {TABLE} set statut = 'annule' where token = %s", (ta,)).rowcount == 1
        assert c.execute(f'update {TABLE} set statut = statut, montant_ttc = montant_ttc where token = %s', (ts,)).rowcount == 1


# ---------- 3. fonction publique « signature » (service_role) : droits gardés ----------
def test_ps_08_fonction_publique_vu_signer_refuser_copie_comme_avant():
    with cnx(A) as c:
        t1, t2 = appli_creer(c, 'd-s1'), appli_creer(c, 'd-s2')
    with cnx(None, role='service_role') as s:
        service_lire(s, t1)
        assert service_signer(s, t1) == [(t1,)]
        service_copie(s, t1)
        service_copie(s, t1)
        service_lire(s, t2)
        assert service_refuser(s, t2) == [(t2,)]
        assert service_signer(s, t2) == []  # déjà traité : la condition statut = 'en_attente' ne trouve plus la ligne
    with admin() as a:
        l1, l2 = ligne(a, t1), ligne(a, t2)
    assert l1['statut'] == 'signe' and l1['vu_at'] and l1['signed_at'] and l1['signature_png'] == PNG
    assert l1['support_durable_accord'] is True and l1['copie_le'] and l1['copie_nb'] == 2 and l1['applique'] is False
    assert l2['statut'] == 'refuse' and l2['motif_refus'] == 'Trop cher' and l2['signer_ua'] and l2['signature_png'] is None


@pytest.mark.parametrize('sub', [None, A], ids=['jeton_de_service', 'jeton_de_service_avec_identifiant'])
def test_ps_09_fonction_publique_garde_exactement_ses_droits_sur_toutes_les_colonnes(sub):
    """Clé de service : aucune restriction, comme avant (aussi avec un identifiant dans le jeton : c'est le rôle qui compte)."""
    tok = demande('signe')
    pas_acceptees = {}
    with admin() as a:
        cols = colonnes(a)
    with cnx(sub, role='service_role') as s:
        for col, typ in cols:
            if col == 'statut':
                set_sql = "statut = 'refuse'"
            else:
                set_sql = f'{col} = {valeur_modifiee(col, typ)}'
            r = tentative(s, tok, set_sql)
            if r != 'acceptée':
                pas_acceptees[col] = r
    assert pas_acceptees == {}, pas_acceptees


# ---------- 4. auth.uid() nul, autre compte, suppression : inchangés ----------
def test_ps_10_sans_identifiant_comportement_inchange():
    tok = demande('signe')
    with admin() as a:
        avant = ligne(a, tok)
    with cnx(None) as c:  # rôle authenticated sans identifiant : la protection par compte ne montre aucune ligne
        assert c.execute(f"update {TABLE} set titre = 'x' where token = %s", (tok,)).rowcount == 0
    with admin() as a:
        assert ligne(a, tok) == avant
        # administration (SQL Editor, rôle propriétaire) : passage gardé tel quel, comme sur le réel
        assert a.execute(f"update {TABLE} set titre = titre || ' (admin)' where token = %s", (tok,)).rowcount == 1


def test_ps_11_autre_compte_et_suppression_sans_effet():
    tok = demande('signe')
    with admin() as a:
        avant = ligne(a, tok)
    with cnx(B) as c:
        assert c.execute(f"update {TABLE} set titre = 'x' where token = %s", (tok,)).rowcount == 0
    with cnx(A) as c:
        assert c.execute(f'delete from {TABLE} where token = %s', (tok,)).rowcount == 0
    with admin() as a:
        assert ligne(a, tok) == avant


# ---------- 5. migration : rejouable, déclencheur, droits ----------
def test_ps_12_migration_rejouable_declencheur_et_droits():
    assert MIGRATION_PS.exists()
    with admin() as a:
        a.execute(MIGRATION_PS.read_text())  # 3e application
        f = a.execute("""select prosecdef, proconfig, obj_description(oid, 'pg_proc') from pg_proc
                         where oid = 'public.cp_sig_guard()'::regprocedure""").fetchone()
        assert f[0] is True and f[1] == ['search_path=""'] and (f[2] or '').startswith('PREUVE-SIGNATURE'), f
        assert empreinte(a) != EMPREINTE_AVANT
        trg = a.execute("""select pg_get_triggerdef(t.oid), t.tgenabled from pg_trigger t
                           where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_guard'""").fetchall()
        assert trg == [('CREATE TRIGGER cp_sig_guard BEFORE UPDATE ON public.climpilot_signatures FOR EACH ROW EXECUTE FUNCTION cp_sig_guard()', 'O')], trg
        for r, attendu in (('anon', False), ('authenticated', False), ('service_role', True)):
            assert a.execute("select has_function_privilege(%s, 'public.cp_sig_guard()', 'EXECUTE')", (r,)).fetchone()[0] is attendu, r
        assert a.execute("""select exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                            where p.oid = 'public.cp_sig_guard()'::regprocedure and x.grantee = 0)""").fetchone()[0] is False
        # création d'une demande : même en-tête, commentaire, droits, déclencheur inchangé
        f = a.execute("""select prosecdef, proconfig, obj_description(oid, 'pg_proc') from pg_proc
                         where oid = 'public.cp_sig_insert()'::regprocedure""").fetchone()
        assert f[0] is True and f[1] == ['search_path=""'] and (f[2] or '').startswith('PREUVE-SIGNATURE'), f
        assert empreinte(a, 'public.cp_sig_insert()') != EMPREINTE_INSERT_AVANT
        trg = a.execute("""select pg_get_triggerdef(t.oid), t.tgenabled from pg_trigger t
                           where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_insert'""").fetchall()
        assert trg == [('CREATE TRIGGER cp_sig_insert BEFORE INSERT ON public.climpilot_signatures FOR EACH ROW EXECUTE FUNCTION cp_sig_insert()', 'O')], trg
        for r, attendu in (('anon', False), ('authenticated', False), ('service_role', True)):
            assert a.execute("select has_function_privilege(%s, 'public.cp_sig_insert()', 'EXECUTE')", (r,)).fetchone()[0] is attendu, r


def test_ps_13_banc_part_de_la_fonction_du_reel():
    """Sans la migration, le banc a exactement le code lu sur le réel et sur TEST (même empreinte)."""
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            assert empreinte(a) == EMPREINTE_AVANT
            assert empreinte(a, 'public.cp_sig_insert()') == EMPREINTE_INSERT_AVANT


# ---------- 6. retour arrière ----------
def test_ps_14_retour_arriere_remet_la_fonction_du_reel_puis_la_migration_revient():
    assert MIGRATION_PS.exists() and RETOUR.exists()
    with admin() as a:
        for _ in range(2):  # rejouable
            lignes = resultat_final(a, RETOUR.read_text())
            assert lignes and len(lignes) == 5 and all(etat == 'OK' for _, etat in lignes), lignes
        assert empreinte(a) == EMPREINTE_AVANT
        assert empreinte(a, 'public.cp_sig_insert()') == EMPREINTE_INSERT_AVANT
        g = a.execute("""select prosecdef, proconfig, obj_description(oid, 'pg_proc') from pg_proc
                         where oid = 'public.cp_sig_insert()'::regprocedure""").fetchone()
        assert g == (True, ['search_path=""'], None), g
        f = a.execute("""select prosecdef, proconfig, obj_description(oid, 'pg_proc') from pg_proc
                         where oid = 'public.cp_sig_guard()'::regprocedure""").fetchone()
        assert f == (True, ['search_path=""'], None), f
        assert a.execute("select has_function_privilege('authenticated', 'public.cp_sig_guard()', 'EXECUTE')").fetchone()[0] is False
        a.execute(MIGRATION_PS.read_text())
        assert empreinte(a) != EMPREINTE_AVANT
        assert empreinte(a, 'public.cp_sig_insert()') != EMPREINTE_INSERT_AVANT
    tok = demande('signe')
    with cnx(A) as c:
        assert tentative(c, tok, 'titre = titre') == 'acceptée'
        assert tentative(c, tok, "titre = titre || ' (modifié)'") is None
        r = c.execute(f"""insert into {TABLE}(user_id, doc_type, doc_id, doc_html, created_at, motif_refus)
                         values (%s, 'devis', 'd-r', '<p>x</p>', now() - interval '3 days', 'x') returning created_at = now(), motif_refus""", (A,)).fetchone()
        assert r == (True, None), r


# ---------- 7. scripts prêts à coller ----------
def test_ps_15_scripts_test_et_reel_contiennent_la_migration_telle_quelle():
    m = MIGRATION_PS.read_text()
    assert m in SCRIPT_TEST.read_text()
    assert m in SCRIPT_REEL.read_text()


def test_ps_16_script_test_refuse_de_tourner_sans_marqueur():
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
                a.execute(SCRIPT_TEST.read_text())
            assert empreinte(a) == EMPREINTE_AVANT  # rien n'a changé
            assert empreinte(a, 'public.cp_sig_insert()') == EMPREINTE_INSERT_AVANT


def test_ps_17_script_reel_refuse_de_tourner_sur_le_projet_test():
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            a.execute('create table public.climpilot_marqueur_test (note text)')
            with pytest.raises(psycopg.errors.RaiseException, match='STOP'):
                a.execute(SCRIPT_REEL.read_text())
            assert empreinte(a) == EMPREINTE_AVANT
            assert empreinte(a, 'public.cp_sig_insert()') == EMPREINTE_INSERT_AVANT


def nb_controles(script):
    t = script.read_text()
    return int(t.split('-- VÉRIFICATIONS : ')[1].split(' ')[0])


def test_ps_18_script_test_sur_le_projet_test_toutes_les_lignes_ok():
    n = nb_controles(SCRIPT_TEST)
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            a.execute('create table public.climpilot_marqueur_test (note text)')
            for _ in range(2):  # rejouable
                lignes = resultat_final(a, SCRIPT_TEST.read_text())
                assert lignes and len(lignes) == n, lignes
                assert all(etat == 'OK' for _, etat in lignes), lignes
            assert empreinte(a) != EMPREINTE_AVANT
            assert empreinte(a, 'public.cp_sig_insert()') != EMPREINTE_INSERT_AVANT


def test_ps_19_script_reel_sur_une_base_sans_marqueur_toutes_les_lignes_ok():
    n = nb_controles(SCRIPT_REEL)
    assert n == nb_controles(SCRIPT_TEST)
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            lignes = resultat_final(a, SCRIPT_REEL.read_text())
            assert lignes and len(lignes) == n, lignes
            assert all(etat == 'OK' for _, etat in lignes), lignes


def test_ps_20_les_controles_des_scripts_savent_dire_a_revoir():
    """Les lignes de vérification ne sont pas « OK » d'office : sur une base SANS la migration, elles le disent."""
    t = SCRIPT_REEL.read_text()
    verif = t.split('-- VÉRIFICATIONS : ')[1].split('\n', 1)[1]
    with base(avec_ps=False) as nom:
        with admin(nom) as a:
            lignes = dict(resultat_final(a, verif))
    assert len(lignes) == nb_controles(SCRIPT_REEL)
    a_revoir = sorted(k for k, v in lignes.items() if v != 'OK')
    assert a_revoir == ['cp_sig_guard : code identique à la migration (empreinte 9da1de9b…)',
                        'cp_sig_guard : version PREUVE-SIGNATURE (commentaire)',
                        'cp_sig_insert : version PREUVE-SIGNATURE (empreinte dd8e9e6a…, security definer, search_path vide, déclencheur actif)'], lignes
    assert all(lignes[k] == 'À REVOIR' for k in a_revoir)


def test_ps_22_vider_une_colonne_remplie_refuse_au_compte_connecte():
    """Valeur → vide : chaque colonne remplie et sans contrainte « non nul », sur une demande signée et sur une demande refusée."""
    pas_refusees = {}
    for statut in ('signe', 'refuse'):
        tok = demande(statut)
        with admin() as a:
            avant = ligne(a, tok)
            nullables = [r[0] for r in a.execute("""select column_name from information_schema.columns where table_schema = 'public'
                                                    and table_name = 'climpilot_signatures' and is_nullable = 'YES' order by ordinal_position""")]
        cibles = [k for k in nullables if avant.get(k) is not None]
        assert len(cibles) >= 8, (statut, cibles)  # mise en place : la demande a bien des colonnes remplies
        with cnx(A) as c:
            for col in cibles:
                r = tentative(c, tok, f'{col} = null')
                if r:
                    pas_refusees[f'{statut} : {col}'] = r
        with admin() as a:
            assert ligne(a, tok) == avant
    assert pas_refusees == {}, pas_refusees


def test_ps_23_creation_d_une_demande_date_et_motif_imposes_par_le_serveur():
    """À la création d'une demande, le serveur impose la date de création (now()) et un motif de refus vide, quoi que le compte
    envoie (date passée ou future) ; les colonnes de preuve restent vidées et l'empreinte calculée, comme avant."""
    with cnx(A) as c:
        for decalage in ("- interval '30 days'", "+ interval '30 days'"):
            tok, date_ok = c.execute(f"""insert into {TABLE}(user_id, doc_type, doc_id, doc_num, doc_html, created_at, motif_refus,
                                           signed_at, signer_nom, signature_png, signer_ip, signer_ua, consentement, vu_at, applique,
                                           support_durable_accord, copie_le, copie_nb)
                                         values (%s, 'devis', 'd-ins', 'DV-ESSAI-9', '<p>devis</p>', now() {decalage}, 'motif inventé',
                                           now(), 'X', %s, '192.0.2.99', 'ua', 'accord', now(), true, true, now(), 5)
                                         returning token, created_at = now()""", (A, PNG)).fetchone()
            with admin() as a:
                l = ligne(a, tok)
                attendu_hash = a.execute("select encode(sha256(convert_to('<p>devis</p>', 'UTF8')), 'hex')").fetchone()[0]
            assert date_ok is True, (decalage, l['created_at'])
            assert l['motif_refus'] is None, l['motif_refus']
            for k in ('signed_at', 'signer_nom', 'signature_png', 'signer_ip', 'signer_ua', 'consentement', 'vu_at', 'support_durable_accord', 'copie_le'):
                assert l[k] is None, k
            assert l['applique'] is False and l['copie_nb'] == 0 and l['statut'] == 'en_attente' and l['doc_hash'] == attendu_hash


def test_ps_21_scripts_s_arretent_si_la_fonction_en_ligne_n_est_pas_celle_attendue():
    """Si cp_sig_guard ou cp_sig_insert a changé en ligne depuis la lecture du 15/11/2026, le retour arrière ne la remettrait pas :
    STOP, rien modifié."""
    autre = (ICI / '01_base_actuelle.sql').read_text().split('create function public.cp_sig_guard()')[1].split('$function$;')[0]
    autre = 'create or replace function public.cp_sig_guard()' + autre + '$function$;'
    for script, marqueur in ((SCRIPT_TEST, True), (SCRIPT_REEL, False)):
        with base(avec_ps=False) as nom:
            with admin(nom) as a:
                a.execute(autre)  # une version différente (celle d'avant la 1.10)
                if marqueur:
                    a.execute('create table public.climpilot_marqueur_test (note text)')
                derive = empreinte(a)
                assert derive != EMPREINTE_AVANT
                with pytest.raises(psycopg.errors.RaiseException, match='STOP : cp_sig_guard'):
                    a.execute(script.read_text())
                assert empreinte(a) == derive, script.name
    autre_ins = (ICI / '01_base_actuelle.sql').read_text().split('create function public.cp_sig_insert()')[1].split('$function$;')[0]
    autre_ins = 'create or replace function public.cp_sig_insert()' + autre_ins + '$function$;'
    for script, marqueur in ((SCRIPT_TEST, True), (SCRIPT_REEL, False)):
        with base(avec_ps=False) as nom:
            with admin(nom) as a:
                a.execute(autre_ins)  # cp_sig_guard attendue, mais une version différente de cp_sig_insert (celle d'avant la 1.10)
                if marqueur:
                    a.execute('create table public.climpilot_marqueur_test (note text)')
                derive = empreinte(a, 'public.cp_sig_insert()')
                assert derive != EMPREINTE_INSERT_AVANT and empreinte(a) == EMPREINTE_AVANT
                with pytest.raises(psycopg.errors.RaiseException, match='STOP : cp_sig_insert'):
                    a.execute(script.read_text())
                assert empreinte(a, 'public.cp_sig_insert()') == derive and empreinte(a) == EMPREINTE_AVANT, script.name
