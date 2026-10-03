# Garde réseau des processus Python des tests (chargée automatiquement quand ce dossier est dans PYTHONPATH
# et que CP_GARDE_RESEAU=1). Toute connexion ou résolution vers autre chose que la boucle locale ou un socket
# Unix est REFUSÉE et notée dans $CP_TEST_OUT/isolation/python.jsonl (hôte et port seulement).
# Limite : le code natif qui n'utilise pas le module socket (libpq de psycopg, Saxon) n'est pas vu ici ;
# il est couvert par l'isolation du noyau (tests/run-all.sh) et, pour PostgreSQL, par tests/sql/cible_locale.py.
import os
if os.environ.get('CP_GARDE_RESEAU') == '1':
    import json, re, socket, sys, tempfile
    _OUT = os.path.join(os.environ.get('CP_TEST_OUT') or os.path.join(tempfile.gettempdir(), 'climpilot-tests'), 'isolation')
    _LOCAUX = {'localhost', '::1', '::ffff:127.0.0.1', ''}

    def _local(h):
        h = '' if h is None else str(h).lower()
        return h in _LOCAUX or re.fullmatch(r'127\.\d+\.\d+\.\d+', h) is not None or h.endswith('.localhost')

    def _noter(o):
        try:
            os.makedirs(_OUT, exist_ok=True)
            with open(os.path.join(_OUT, 'python.jsonl'), 'a') as f:
                f.write(json.dumps({'script': os.path.basename(sys.argv[0] or 'python'), 'pid': os.getpid(), **o}) + '\n')
        except Exception:
            pass

    def _verifier(sock, adresse):
        if sock.family == socket.AF_UNIX or not isinstance(adresse, tuple):
            return
        h, p = adresse[0], adresse[1]
        if not _local(h):
            _noter({'type': 'connexion', 'hote': str(h)[:80], 'port': p, 'resultat': 'refusée'})
            raise ConnectionRefusedError(f'CP_ISOLATION : connexion sortante refusée vers {h}:{p}')

    _connect, _connect_ex, _gai = socket.socket.connect, socket.socket.connect_ex, socket.getaddrinfo

    def connect(self, adresse):
        _verifier(self, adresse); return _connect(self, adresse)

    def connect_ex(self, adresse):
        _verifier(self, adresse); return _connect_ex(self, adresse)

    def getaddrinfo(host, *a, **k):
        if not _local(host if not isinstance(host, bytes) else host.decode()):
            _noter({'type': 'dns', 'hote': str(host)[:80], 'resultat': 'refusée'})
            raise socket.gaierror(socket.EAI_NONAME, f'CP_ISOLATION : résolution refusée {host}')
        return _gai(host, *a, **k)

    socket.socket.connect, socket.socket.connect_ex, socket.getaddrinfo = connect, connect_ex, getaddrinfo
    os.environ['CP_GARDE_PYTHON_ACTIVE'] = '1'
