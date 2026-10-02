# Tests de la migration « documents émis » sur un VRAI PostgreSQL (banc local, Supabase imité).
# Lancer : PGHOST=<dossier du socket> PGPORT=54329 pytest -q tests/sql/test_migration.py
# Chaque test repart d'une base neuve : 00_supabase_emul.sql + 01_base_actuelle.sql + la migration.
import json, os, uuid, datetime, threading, pathlib
import psycopg, pytest

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent.parent
MIGRATION = RACINE / 'supabase' / 'migrations' / '20261002120000_documents_emis.sql'
ADMIN = dict(host=os.environ.get('PGHOST', '/var/lib/postgresql/cptest'), port=int(os.environ.get('PGPORT', 54329)), user='postgres', dbname='postgres')
A = str(uuid.UUID('11111111-1111-1111-1111-111111111111'))
B = str(uuid.UUID('22222222-2222-2222-2222-222222222222'))
V = '1.10.0-beta'


def aujourdhui():
    # même calcul que la fonction : date du jour à Paris
    with psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}) as c:
        return c.execute("select (now() at time zone 'Europe/Paris')::date").fetchone()[0]


BASE = {'nom': None}


@pytest.fixture(autouse=True)
def base_neuve():
    nom = 'cp_' + uuid.uuid4().hex[:10]
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'create database {nom}')
    BASE['nom'] = nom
    with psycopg.connect(**{**ADMIN, 'dbname': nom}, autocommit=True) as c:
        for f in (ICI / '00_supabase_emul.sql', ICI / '01_base_actuelle.sql'):
            c.execute(f.read_text())
        c.execute("insert into auth.users(id,email) values (%s,'a@test'),(%s,'b@test')", (A, B))
        c.execute(MIGRATION.read_text())
    yield nom
    with psycopg.connect(**ADMIN, autocommit=True) as c:
        c.execute(f'drop database {nom} with (force)')


def cnx(user=None, role='authenticated'):
    """Connexion « comme l'appli » : rôle authenticated + jeton (sub = user)."""
    c = psycopg.connect(**{**ADMIN, 'dbname': BASE['nom']}, autocommit=True)
    if role:
        c.execute(f'set role {role}')
    claims = {'role': role or 'postgres'}
    if user:
        claims['sub'] = user
    c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    return c


def emettre(c, rid=None, serie='F', typ='facture', date=None, payload=None, mini=0, version=V):
    rid = rid or str(uuid.uuid4())
    r = c.execute('select public.cp_emettre_document(%s,%s,%s,%s,%s::jsonb,%s,%s)',
                  (rid, serie, typ, date or aujourdhui(), json.dumps(payload or {'montant': 100}), mini, version)).fetchone()[0]
    return rid, r


def test_emission_numero_et_enregistrement_ensemble():
    with cnx(A) as c:
        _, r = emettre(c)
        an = aujourdhui().year
        assert r['ok'] and not r['deja'] and r['doc']['num'] == f'F-{an}-001'
        n = c.execute('select count(*) from public.climpilot_documents').fetchone()[0]
        assert n == 1  # le numéro n'existe pas sans son document


def test_meme_demande_rejouee_meme_facture():
    with cnx(A) as c:
        rid, r1 = emettre(c)
        _, r2 = emettre(c, rid=rid, payload={'montant': 999})  # réponse perdue puis nouvelle tentative
        assert r2['deja'] and r2['doc']['id'] == r1['doc']['id'] and r2['doc']['payload'] == {'montant': 100}
        assert c.execute('select count(*) from public.climpilot_documents').fetchone()[0] == 1
        assert c.execute('select dernier from public.climpilot_seq').fetchone()[0] == 1


def test_emissions_concurrentes_numeros_uniques_et_continus():
    res, err = [], []

    def go():
        try:
            with cnx(A) as c:
                res.append(emettre(c)[1]['doc']['numero'])
        except Exception as e:  # noqa
            err.append(repr(e))
    th = [threading.Thread(target=go) for _ in range(25)]
    [t.start() for t in th]; [t.join() for t in th]
    assert not err, err
    assert sorted(res) == list(range(1, 26))


def test_double_clic_concurrent_meme_request_id_un_seul_document():
    rid = str(uuid.uuid4()); ids, err = [], []

    def go():
        try:
            with cnx(A) as c:
                ids.append(emettre(c, rid=rid)[1]['doc']['id'])
        except Exception as e:  # noqa
            err.append(repr(e))
    th = [threading.Thread(target=go) for _ in range(10)]
    [t.start() for t in th]; [t.join() for t in th]
    assert not err, err
    assert len(set(ids)) == 1
    with cnx(A) as c:
        assert c.execute('select count(*) from public.climpilot_documents').fetchone()[0] == 1


def test_plantage_entre_numero_et_fichiers_puis_reprise():
    with cnx(A) as c:
        _, r = emettre(c)
        did = r['doc']['id']
        # l'appli a planté avant de déposer les fichiers : le document émis existe quand même
        assert c.execute('select html is null from public.climpilot_documents where id=%s', (did,)).fetchone()[0]
        h = '<html>' + 'x' * 100 + '</html>'
        r1 = c.execute('select public.cp_document_fichiers(%s,%s,%s)', (did, h, '<xml/>')).fetchone()[0]
        r2 = c.execute('select public.cp_document_fichiers(%s,%s,%s)', (did, h, '<xml/>')).fetchone()[0]
        assert r1['ok'] and not r1['deja'] and r2['deja']
        with pytest.raises(psycopg.Error, match='déjà enregistrés'):
            c.execute('select public.cp_document_fichiers(%s,%s,%s)', (did, h + 'autre', '<xml/>'))


def test_ecrasement_et_suppression_refuses():
    with cnx(A) as c:
        _, r = emettre(c); did = r['doc']['id']
        # écriture directe par l'appli : pas de droit
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("update public.climpilot_documents set payload='{}' where id=%s", (did,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute('delete from public.climpilot_documents where id=%s', (did,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("insert into public.climpilot_documents(user_id,request_id,serie,annee,numero,num,type,date_doc,payload,payload_hash) values (%s,gen_random_uuid(),'F',2026,99,'F-2026-099','facture',current_date,'{}','x')", (A,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute('truncate public.climpilot_documents')
    # même un rôle qui contourne RLS (service) se heurte aux déclencheurs
    with cnx(None, role='service_role') as s:
        with pytest.raises(psycopg.Error, match='ne se modifie pas'):
            s.execute("update public.climpilot_documents set payload='{\"montant\":1}' where id=%s", (did,))
        with pytest.raises(psycopg.Error, match='ne se supprime pas'):
            s.execute('delete from public.climpilot_documents where id=%s', (did,))
        with pytest.raises(psycopg.Error, match='ne recule jamais'):
            s.execute('update public.climpilot_seq set dernier=0')


def test_autre_utilisateur_ne_voit_ni_ne_touche_rien():
    with cnx(A) as c:
        _, r = emettre(c); did = r['doc']['id']
    with cnx(B) as b:
        assert b.execute('select count(*) from public.climpilot_documents').fetchone()[0] == 0
        assert b.execute('select count(*) from public.climpilot_seq').fetchone()[0] == 0
        with pytest.raises(psycopg.Error, match='introuvable'):
            b.execute('select public.cp_document_fichiers(%s,%s,%s)', (did, '<html>' + 'y' * 80, ''))
        with pytest.raises(psycopg.Error, match='introuvable'):
            b.execute("select public.cp_document_evenement(gen_random_uuid(),%s,'paiement','{}')", (did,))
        # B a sa propre série qui démarre à 1
        _, rb = emettre(b)
        assert rb['doc']['numero'] == 1
    with cnx(None, role='anon') as an:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            an.execute('select count(*) from public.climpilot_documents')
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            emettre(an)


def test_evenements_ajout_seul_et_idempotents():
    with cnx(A) as c:
        _, r = emettre(c); did = r['doc']['id']; rid = str(uuid.uuid4())
        e1 = c.execute("select public.cp_document_evenement(%s,%s,'paiement','{\"montant\":100}')", (rid, did)).fetchone()[0]
        e2 = c.execute("select public.cp_document_evenement(%s,%s,'paiement','{\"montant\":100}')", (rid, did)).fetchone()[0]
        assert e2['deja'] and e1['id'] == e2['id']
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute('delete from public.climpilot_doc_events')
    with cnx(None, role='service_role') as s:
        with pytest.raises(psycopg.Error, match='ajout seul'):
            s.execute('delete from public.climpilot_doc_events')
        # le paiement ne modifie pas le document figé
        assert s.execute('select payload from public.climpilot_documents where id=%s', (did,)).fetchone()[0] == {'montant': 100}


def test_date_hors_de_la_journee_refusee():
    with cnx(A) as c:
        with pytest.raises(psycopg.Error, match='hors de la journée'):
            emettre(c, date=aujourdhui() - datetime.timedelta(days=5))


def test_anciennes_factures_reconstituees_et_suite_de_la_numerotation():
    an = aujourdhui().year
    with cnx(A) as c:
        for n in ('007', '007', '003'):  # doublon historique : les deux sont gardés
            c.execute("select public.cp_importer_ancien(gen_random_uuid(),'F','facture',%s,current_date,'{}'::jsonb)", (f'F-{an}-{n}',))
        assert c.execute("select count(*) from public.climpilot_documents where origine='reconstitue'").fetchone()[0] == 3
        _, r = emettre(c)
        assert r['doc']['numero'] == 8 and r['doc']['origine'] == 'emis'
        _, r2 = emettre(c, mini=12)  # l'appli connaît un numéro local plus grand
        assert r2['doc']['numero'] == 13


def test_avoir_serie_distincte_et_format_au_dela_de_999():
    with cnx(A) as c:
        _, r = emettre(c, serie='AV', typ='avoir')
        assert r['doc']['num'].startswith('AV-') and r['doc']['numero'] == 1
        with pytest.raises(psycopg.Error, match='type incohérent'):
            emettre(c, serie='F', typ='avoir')
        assert c.execute("select public.cp_num_txt('F',2026,1000)").fetchone()[0] == 'F-2026-1000'
        assert c.execute("select public.cp_num_txt('F',2026,7)").fetchone()[0] == 'F-2026-007'


def test_ancienne_version_refusee_et_ecriture_directe_retiree():
    with cnx(A) as c:
        with pytest.raises(psycopg.Error, match='mis à jour'):
            emettre(c, version=None)
        with pytest.raises(psycopg.Error, match='mis à jour'):
            emettre(c, version='1.9.1')
        # synchro : l'ancienne appli (sans version) est refusée, la 1.10 passe
        with pytest.raises(psycopg.Error, match='mis à jour'):
            c.execute("select public.cp_state_push('{}'::jsonb, null, false)")
        r = c.execute("select public.cp_state_push('{\"cp2_devis\":[]}'::jsonb, null, false, %s)", (V,)).fetchone()[0]
        assert r['ok']
        r2 = c.execute("select public.cp_state_push('{\"cp2_devis\":[1]}'::jsonb, %s::timestamptz, false, %s)", (r['updated_at'], V)).fetchone()[0]
        assert r2['ok']
        # plus d'écriture directe de l'état
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("update public.climpilot_state set data='{}'")
        assert c.execute('select data from public.climpilot_state').fetchone()[0] == {'cp2_devis': [1]}
        # la sauvegarde quotidienne existante fonctionne toujours
        assert c.execute("select count(*) from public.climpilot_backups where raison='quotidienne'").fetchone()[0] == 1


def test_preuve_de_remise_non_falsifiable_par_le_compte():
    with cnx(A) as c:
        tok = c.execute("insert into public.climpilot_signatures(user_id,doc_type,doc_id,doc_html) values (%s,'devis','d1','<p>x</p>') returning token", (A,)).fetchone()[0]
        with pytest.raises(psycopg.Error, match='modification interdite'):
            c.execute('update public.climpilot_signatures set copie_le=now() where token=%s', (tok,))
    with cnx(None, role='service_role') as s:  # la fonction serveur « signature »
        s.execute("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
        s.execute('update public.climpilot_signatures set copie_le=now(), copie_nb=copie_nb+1, support_durable_accord=true where token=%s', (tok,))
        assert s.execute('select copie_nb from public.climpilot_signatures where token=%s', (tok,)).fetchone()[0] == 1
