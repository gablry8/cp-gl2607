// Garde réseau des processus Node des tests (chargée par NODE_OPTIONS="--import <ce fichier>", donc aussi
// par les sous-processus Node). Toute connexion TCP/TLS ou résolution DNS vers autre chose que la boucle
// locale ou un socket Unix est REFUSÉE et notée dans $CP_TEST_OUT/isolation/node.jsonl (hôte et port seulement).
// Ne remplace pas l'isolation du noyau (tests/run-all.sh, unshare -n) : elle sert à COMPTER les tentatives.
import net from 'net'; import dns from 'dns'; import fs from 'fs'; import path from 'path'; import os from 'os';

const OUT = path.join(process.env.CP_TEST_OUT || path.join(os.tmpdir(), 'climpilot-tests'), 'isolation');
const SCRIPT = path.basename(process.argv[1] || 'node');
const LOCAUX = new Set(['localhost', '::1', '::ffff:127.0.0.1', '']);
export const estLocal = (h) => LOCAUX.has(String(h ?? '').toLowerCase()) || /^127\.\d+\.\d+\.\d+$/.test(String(h)) || /\.localhost$/i.test(String(h));
function noter(o) {
  try { fs.mkdirSync(OUT, { recursive: true }); fs.appendFileSync(path.join(OUT, 'node.jsonl'), JSON.stringify({ script: SCRIPT, pid: process.pid, ...o }) + '\n'); } catch (_) {}
}
const refus = (h, p) => Object.assign(new Error(`CP_ISOLATION : connexion sortante refusée vers ${h}:${p}`), { code: 'ECONNREFUSED' });

const connecter = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let o = args[0];
  if (Array.isArray(o)) o = o[0]; // forme interne (normalisée)
  if (typeof o !== 'object' || o === null) o = typeof o === 'string' && isNaN(+o) ? { path: o } : { port: o, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  if (!o.path) {
    const h = o.host ?? 'localhost';
    if (!estLocal(h)) {
      noter({ type: 'connexion', hote: String(h).slice(0, 80), port: o.port, resultat: 'refusée' });
      process.nextTick(() => this.destroy(refus(h, o.port)));
      return this;
    }
  }
  return connecter.apply(this, args);
};
const chercher = dns.lookup;
dns.lookup = function (h, ...r) {
  if (!estLocal(h)) {
    noter({ type: 'dns', hote: String(h).slice(0, 80), resultat: 'refusée' });
    const cb = r.find((x) => typeof x === 'function');
    if (cb) process.nextTick(() => cb(Object.assign(new Error('CP_ISOLATION : résolution refusée ' + h), { code: 'ENOTFOUND' })));
    return {};
  }
  return chercher.call(this, h, ...r);
};
const chercherP = dns.promises.lookup;
dns.promises.lookup = async function (h, ...r) {
  if (!estLocal(h)) { noter({ type: 'dns', hote: String(h).slice(0, 80), resultat: 'refusée' }); throw Object.assign(new Error('CP_ISOLATION : résolution refusée ' + h), { code: 'ENOTFOUND' }); }
  return chercherP.call(this, h, ...r);
};
globalThis.__CP_GARDE_NODE = true;
