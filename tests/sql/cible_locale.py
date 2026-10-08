# Garde des tests SQL : vérifie que la base visée est le banc de test LOCAL avant toute écriture.
# La présence de PGHOST ne suffit pas. Il faut :
#  1. avant connexion : PGHOST = dossier de socket local existant (contenant .s.PGSQL.<port>) ou localhost /
#     127.0.0.1 / ::1 ; aucune variable qui redirige libpq ailleurs (PGHOSTADDR, PGSERVICE, PGSERVICEFILE,
#     DATABASE_URL) ; aucun hôte contenant « supabase » ;
#  2. après connexion, côté serveur : connexion par socket Unix ou boucle locale (inet_server_addr) ET marqueur
#     cluster_name = 'climpilot-test', posé au démarrage du cluster de test (voir tests/LISEZMOI.md).
# Le serveur Supabase réel n'a pas ce marqueur et n'est pas joignable par un socket local.
import os

MARQUEUR = 'climpilot-test'
LOCAUX = {'localhost', '127.0.0.1', '::1'}
REDIRECTIONS = ('PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'DATABASE_URL')


class CibleRefusee(Exception):
    pass


def parametres(env=None):
    """Contrôle 1 (sans connexion). Renvoie les paramètres de connexion admin, ou lève CibleRefusee."""
    env = os.environ if env is None else env
    hote, port = env.get('PGHOST', ''), env.get('PGPORT', '5432')
    if not hote:
        raise CibleRefusee('PGHOST absent : tests SQL non exécutés')
    for v in REDIRECTIONS:
        if env.get(v):
            raise CibleRefusee(f'{v} est défini : la connexion pourrait partir ailleurs que PGHOST')
    if 'supabase' in hote.lower() or ',' in hote:
        raise CibleRefusee(f'hôte refusé : {hote}')
    if not port.isdigit():
        raise CibleRefusee(f'PGPORT invalide : {port}')
    if hote.startswith('/'):
        if not os.path.exists(os.path.join(hote, f'.s.PGSQL.{port}')):
            raise CibleRefusee(f'aucun socket PostgreSQL local dans {hote} pour le port {port}')
    elif hote.lower() not in LOCAUX:
        raise CibleRefusee(f'hôte non local refusé : {hote}')
    return dict(host=hote, port=int(port), user='postgres', dbname='postgres')


def verifier_serveur(cluster_name, adresse_serveur):
    """Contrôle 2 (réponse du serveur) : marqueur du banc de test et connexion locale."""
    if cluster_name != MARQUEUR:
        raise CibleRefusee(f"marqueur absent : cluster_name = {cluster_name!r}, attendu {MARQUEUR!r}")
    if adresse_serveur not in (None, '127.0.0.1', '::1', '127.0.0.1/32', '::1/128'):
        raise CibleRefusee(f'connexion non locale : {adresse_serveur}')


def verifier_connexion(connexion):
    nom, adr = connexion.execute("select current_setting('cluster_name'), inet_server_addr()::text").fetchone()
    verifier_serveur(nom, adr)
