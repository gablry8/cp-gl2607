// Test de la fonction serveur « signature » (1.10, non déployée) avec une base simulée en mémoire.
// Lancement : node tests/functions/test-signature.mjs   (Node ≥ 22.6 : --experimental-strip-types est ajouté automatiquement)
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
if (!process.env.__SIG_CHILD) { try { execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, __SIG_CHILD: '1' } }); } catch (e) { process.exit(e.status || 1); } process.exit(0); }
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/signature/index.ts'), 'utf8').replace(/^import .*npm:@supabase.*$/m, '');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sig-')), 'index.ts'); fs.writeFileSync(tmp, src);
globalThis.__NO_SERVE = true;
const { handle } = await import(tmp);

function base(avecColonnes) {
  const T = { climpilot_signatures: [], climpilot_inbox: [] };
  const from = (t) => { const f = []; let op = null, val = null, sel = false;
    const rows = () => T[t].filter(r => f.every(([c, v]) => r[c] === v));
    const run = () => {
      if (op === 'update') { if (!avecColonnes && Object.keys(val).some(k => /support_durable_accord|copie_le|copie_nb/.test(k))) return { data: null, error: { message: 'column "support_durable_accord" of relation "climpilot_signatures" does not exist' } };
        const rs = rows(); rs.forEach(r => Object.assign(r, val)); return { data: sel ? rs.map(r => ({ token: r.token })) : null, error: null }; }
      if (op === 'insert') { T[t].push(val); return { data: null, error: null }; }
      return { data: rows(), error: null }; };
    const q = { select() { sel = true; return q; }, eq(c, v) { f.push([c, v]); return q; }, update(o) { op = 'update'; val = o; return q; }, insert(o) { op = 'insert'; val = o; return q; },
      maybeSingle() { const r = rows()[0]; return Promise.resolve({ data: r ? { ...r } : null, error: null }); }, then(ok, ko) { return Promise.resolve(run()).then(ok, ko); } };
    return q; };
  return { T, db: { from } };
}
const tok = '11111111-2222-4333-8444-555555555555';
const ligne = (extra) => ({ token: tok, user_id: 'u1', doc_type: 'devis', doc_num: 'D-2026-010', titre: 'Climatisation', client_nom: 'Mme Test', montant_ttc: 1200, doc_html: '<p>devis</p>', doc_hash: 'abc', statut: 'en_attente', expires_at: new Date(Date.now() + 864e5).toISOString(), ...extra });
const req = (body) => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify({ t: tok, ...body }) });
const png = 'data:image/png;base64,' + 'A'.repeat(1200);
const R = []; const rec = (n, ok, d) => R.push([ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(d)]);

{ const { T, db } = base(true); T.climpilot_signatures.push(ligne({ copie_nb: 0, copie_le: null, support_durable_accord: null }));
  let r = await (await handle(req({ action: 'copie' }), db)).json();
  rec('Copie refusée tant que le document n’est pas signé', r.erreur === 'statut', r);
  r = await (await handle(req({ action: 'signer', nom: 'Mme Test', accepte: true, support_durable: true, signature: png }), db)).json();
  const s = T.climpilot_signatures[0];
  rec('Signature : accord « support durable » enregistré + consentement', r.ok && s.support_durable_accord === true && /support durable/.test(s.consentement), { r, s: { sd: s.support_durable_accord, c: s.consentement } });
  r = await (await handle(req({ action: 'copie' }), db)).json();
  const le1 = s.copie_le;
  rec('Copie : document signé renvoyé, remise enregistrée par le serveur (date + compteur)', r.ok && r.doc_html === '<p>devis</p>' && r.signature_png === png && !!le1 && s.copie_nb === 1, { r: { ok: r.ok }, le1, nb: s.copie_nb });
  rec('Copie : note « exemplaire téléchargé » dans la boîte de l’artisan (une seule fois)', T.climpilot_inbox.filter(x => /téléchargé/.test(x.titre)).length === 1, T.climpilot_inbox.map(x => x.titre));
  await new Promise(r => setTimeout(r, 5));
  r = await (await handle(req({ action: 'copie' }), db)).json();
  rec('2e téléchargement : date de première remise conservée, compteur à 2, pas de 2e note', r.ok && s.copie_le === le1 && s.copie_nb === 2 && T.climpilot_inbox.filter(x => /téléchargé/.test(x.titre)).length === 1, { le: s.copie_le, le1, nb: s.copie_nb });
  r = await (await handle(req({ action: 'lire' }), db)).json();
  rec('Lire : date de remise et accord renvoyés à la page', r.copie_le === le1 && r.support_durable === true && r.copie_possible === true, r);
  r = await (await handle(req({ action: 'signer', nom: 'Autre', accepte: true, signature: png }), db)).json();
  rec('Signature déjà faite : refus (409)', r.erreur === 'deja', r);
}
{ const { T, db } = base(false); T.climpilot_signatures.push(ligne({}));
  let r = await (await handle(req({ action: 'signer', nom: 'Mme Test', accepte: true, support_durable: true, signature: png }), db)).json();
  rec('Migration absente : la signature fonctionne comme avant (repli sans la colonne)', r.ok && T.climpilot_signatures[0].statut === 'signe' && !('support_durable_accord' in T.climpilot_signatures[0]), r);
  r = await (await handle(req({ action: 'copie' }), db)).json();
  rec('Migration absente : copie « indisponible » (la page télécharge quand même, sans preuve)', r.erreur === 'indisponible', r);
}
{ const { T, db } = base(true); T.climpilot_signatures.push(ligne({ copie_nb: 0 }));
  const r = await (await handle(req({ action: 'signer', nom: 'Mme Test', accepte: true, signature: png }), db)).json();
  rec('Sans la case : accord support durable = false', r.ok && T.climpilot_signatures[0].support_durable_accord === false && !/support durable/.test(T.climpilot_signatures[0].consentement), T.climpilot_signatures[0]);
}
R.forEach(x => console.log(x[0].padEnd(5), '[Signature]', x[1], x[2] ? '— ' + x[2] : ''));
if (process.env.CP_TEST_OUT) { fs.mkdirSync(process.env.CP_TEST_OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.CP_TEST_OUT, 'resFn-signature.json'), JSON.stringify(R.map(([ok, name, detail]) => ({ group: 'Signature', name, ok, detail })), null, 1)); }
if (R.some(x => x[0] !== 'PASS')) process.exitCode = 1;
