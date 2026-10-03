// Service worker d'essai (portée /tests/isolation/) : fait lui-même une requête vers l'adresse reçue et renvoie
// le résultat à la page. Sert à vérifier qu'une requête partie d'un service worker est elle aussi bloquée.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
  const rep = (o) => e.source.postMessage(o);
  fetch(e.data.url, { mode: 'no-cors', cache: 'no-store' }).then((r) => rep({ ok: true, type: r.type, status: r.status }), (err) => rep({ ok: false, erreur: String(err) }));
});
