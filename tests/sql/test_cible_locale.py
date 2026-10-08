# Tests de la garde « base de test locale » (sans connexion, sauf le dernier qui vérifie le vrai banc).
import os, tempfile
import pytest
from cible_locale import CibleRefusee, parametres, verifier_serveur, MARQUEUR


def socket_factice(port='54329'):
    d = tempfile.mkdtemp()
    open(os.path.join(d, f'.s.PGSQL.{port}'), 'w').close()
    return d


@pytest.mark.parametrize('env, motif', [
    ({}, 'PGHOST absent'),
    ({'PGHOST': 'db.abcdefgh.supabase.co', 'PGPORT': '5432'}, 'hôte refusé'),
    ({'PGHOST': 'aws-0-eu-west-3.pooler.supabase.com', 'PGPORT': '6543'}, 'hôte refusé'),
    ({'PGHOST': '10.0.0.5', 'PGPORT': '5432'}, 'non local'),
    ({'PGHOST': 'localhost,db.exemple.fr', 'PGPORT': '5432'}, 'hôte refusé'),
    ({'PGHOST': '/dossier/inexistant', 'PGPORT': '54329'}, 'aucun socket'),
    ({'PGHOST': 'localhost', 'PGPORT': '5432', 'PGHOSTADDR': '203.0.113.7'}, 'PGHOSTADDR'),
    ({'PGHOST': 'localhost', 'PGPORT': '5432', 'DATABASE_URL': 'postgres://x@db.exemple.supabase.co/postgres'}, 'DATABASE_URL'),
    ({'PGHOST': 'localhost', 'PGPORT': '5432', 'PGSERVICE': 'prod'}, 'PGSERVICE'),
])
def test_garde_refuse_avant_connexion(env, motif):
    with pytest.raises(CibleRefusee, match=motif):
        parametres(env)


def test_garde_accepte_socket_local_existant():
    d = socket_factice()
    assert parametres({'PGHOST': d, 'PGPORT': '54329'})['host'] == d


@pytest.mark.parametrize('nom, adr, motif', [
    ('', None, 'marqueur absent'),
    ('main', None, 'marqueur absent'),
    (MARQUEUR, '10.1.2.3', 'non locale'),
])
def test_garde_refuse_reponse_serveur(nom, adr, motif):
    with pytest.raises(CibleRefusee, match=motif):
        verifier_serveur(nom, adr)


def test_garde_accepte_banc_local():
    verifier_serveur(MARQUEUR, None)
    verifier_serveur(MARQUEUR, '127.0.0.1')
