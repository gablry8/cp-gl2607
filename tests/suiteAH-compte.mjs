// Suite AH — COMPTE (12/11/2026) : mot de passe, double authentification, appareils (docs/MISSION-COMPTE.md § 5.3 et § 5.4).
// Banc : tests/banc-appareils.mjs avec l'authentification simulée de tests/faux-auth.mjs (formes de réponse de supabase-js 2.117.3 embarqué) ;
// l'appli suit son vrai chemin (initCloud, doLogin, afterLogin, pullState / pushState) sous sa VRAIE politique de sécurité (CSP).
// AH18 charge le VRAI supabase-js embarqué (démarrage hors ligne au jeton expiré, Supabase injoignable).
// Horloge : REF.horloge (tests/lib.mjs) pour les pages ET pour le serveur simulé, qui calcule le code TOTP attendu au même instant (± 30 s, comme Supabase).
// Le code TOTP est calculé par le test (RFC 6238) depuis le secret de test PUBLIC de l'annexe B de la RFC 6238 : jamais un vrai secret.
// Compte, mots de passe et clients fictifs. Aucun réseau. Q1 = non (11/11/2026) : aucun contrôle aal2 côté serveur, donc pas d'AH19.
import { rec, RES, REF, getBrowser, closeBrowser, sansBibliothequesCloud, page } from './lib.mjs';
import { ecrireResultats, devices, URL_LOCALE } from './env.mjs';
import { serveurCommun, appareil, seConnecter, calme, pret, lire, couper, retablir, rouvrir, fermerNavigateur, COMPTE } from './banc-appareils.mjs';
import { totp, VECTEURS_RFC, SECRET_RFC, jeton } from './faux-auth.mjs';
const G = 'COMPTE';
const j = (o) => JSON.stringify(o);
const r = (nom, ok, detail) => rec(G, nom, !!ok, detail);
const H = REF.horloge;
const DEBUT = new Date(Date.parse(H) - 3600000).toISOString();
const MDP0 = COMPTE.mdp;
const CLE_GROUPEE = SECRET_RFC.match(/.{1,4}/g).join(' ');

/* ---------------- aides ---------------- */
const nb = (S, m, dev) => S.auth.appels.filter((x) => x.m === m && (!dev || x.dev === dev)).length;
const derniers = (S, m, dev) => S.auth.appels.filter((x) => x.m === m && (!dev || x.dev === dev));
const vueParams = (S, A) => lire(S, A, () => { go('params'); return true; }).catch(() => false);
const present = (A, sel) => A.p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return !!(b.width || b.height) && getComputedStyle(e).visibility !== 'hidden'; }, sel).catch(() => false);
const texte = (A, sel) => A.p.evaluate((s) => { const e = document.querySelector(s); return e ? (e.innerText || e.textContent || '') : ''; }, sel).catch(() => '');
async function remplir(A, sel, v) { try { if (!(await A.p.$(sel))) return false; await A.p.fill(sel, v, { timeout: 3000 }); return true; } catch (e) { return false; } }
async function cliquer(A, sel) { try { if (!(await A.p.$(sel))) return false; await A.p.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } }
const desactive = (A, sel) => A.p.evaluate((s) => { const e = document.querySelector(s); return !!(e && e.disabled); }, sel).catch(() => false);
const valeurs = (A, sels) => A.p.evaluate((L) => L.map((s) => { const e = document.querySelector(s); return e ? e.value : null; }), sels).catch(() => []);
const sess = (S, A) => lire(S, A, () => { const s = window.SESS; let aal = null; try { aal = JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal; } catch (e) {}
  const st = JSON.parse(localStorage.getItem('__essai_session') || 'null'); return { connecte: !!s, aal, memeQueStockee: !!(s && st && s.access_token === st.access_token), stockee: !!st }; }).catch(() => ({}));
const niveau = (S, A) => lire(S, A, async () => { try { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); return data; } catch (e) { return null; } }).catch(() => null);
const ecouterMsgs = (S, A) => lire(S, A, () => { window.__msgs = window.__msgs || []; if (window.toast && !window.toast.__espion) { const t = window.toast; window.toast = function (m) { __msgs.push(String(m)); return t.apply(this, arguments); }; window.toast.__espion = 1; } }).catch(() => {});
const loginVisible = (A) => present(A, '#loginScreen');
const etape2 = (A) => present(A, '#logEtape2');
const appelsEtat = (S, dev) => S.journal.filter((x) => x.dev === dev && x.nom === 'climpilot_state').length;
const lignesCsp = (A) => A.console.filter((t) => /Content Security Policy|Refused to/i.test(t));
function espion(A) { A.console = []; A.p.on('console', (m) => A.console.push(m.text())); }
async function essai(nom, f) { try { await f(); } catch (e) { r(nom + ' — essai interrompu', false, String(e && e.stack || e).slice(0, 300)); } }
async function changerMdp(S, A, actuel, nouv, conf) {
  await vueParams(S, A); await A.p.waitForTimeout(80);
  const ok = (await remplir(A, '#acc_mdp_actuel', actuel)) && (await remplir(A, '#acc_mdp_nouv', nouv)) && (await remplir(A, '#acc_mdp_conf', conf == null ? nouv : conf));
  if (!ok) return '(carte « Mon compte » absente)';
  await cliquer(A, '#acc_mdp_btn'); await A.p.waitForTimeout(250); await calme(S, A);
  return texte(A, '#acc_mdp_msg');
}
const CHAMPS_MDP = ['#acc_mdp_actuel', '#acc_mdp_nouv', '#acc_mdp_conf'];
const vides = (L) => L.length === 3 && L.every((v) => v === '');
const codeJuste = (S) => totp(SECRET_RFC, S.auth.maintenant());
const codeFaux = (S) => { const c = codeJuste(S); return c === '000000' ? '111111' : '000000'; };
/* activer la double authentification par l'écran (nom proposé, ou donné) ; rend le texte du bloc */
async function activerMfa(S, A, nom, bouton = '#acc_mfa_activer') {
  await vueParams(S, A);
  if (!(await cliquer(A, bouton))) return { ok: false, raison: 'bouton ' + bouton + ' absent' };
  await A.p.waitForTimeout(150);
  if (nom) await remplir(A, '#acc_mfa_nom', nom);
  if (!(await cliquer(A, '#acc_mfa_go'))) return { ok: false, raison: '#acc_mfa_go absent' };
  await A.p.waitForTimeout(300); await calme(S, A);
  return { ok: await present(A, '#acc_mfa_scan') };
}
async function validerMfa(S, A, code) { await remplir(A, '#acc_mfa_code', code); await cliquer(A, '#acc_mfa_valider'); await A.p.waitForTimeout(300); await calme(S, A); return texte(A, '#acc_mfa_msg'); }
async function seConnecterCode(S, A, mdp, code) {
  await A.p.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 });
  await A.p.fill('#logEmail', COMPTE.email); await A.p.fill('#logPass', mdp);
  await A.p.evaluate(() => doLogin()); await A.p.waitForTimeout(400);
  if (code != null) { await remplir(A, '#logCode', code); await cliquer(A, '#logCodeBtn'); await A.p.waitForTimeout(400); }
  await calme(S, A);
}
const ajouterClient = (S, A, nom) => lire(S, A, (n) => { CLIENTS.push({ id: 'cl' + Math.abs(n.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)), nom: n, tel: '', type: 'Particulier' }); save(LS.clients, CLIENTS); return true; }, nom);
const clientSrv = (S, nom) => ((((S.etat || {}).data || {}).cp2_clients) || []).some((c) => c.nom === nom);

/* ================= Partie 0 — test du test : TOTP (RFC 6238, annexe B) ================= */
{
  const res = VECTEURS_RFC.map(([t, c]) => [t, totp(SECRET_RFC, t * 1000, 8), c]);
  r('Test du test — TOTP RFC 6238 annexe B : 6 valeurs à 8 chiffres conformes, et T = 59 → 287082 à 6 chiffres', res.every((x) => x[1] === x[2]) && totp(SECRET_RFC, 59000) === '287082', j(res));
}

/* ================= Partie 1 — un PC connecté (1300 px) : mot de passe, appareils, double authentification ================= */
{
  const S = serveurCommun(DEBUT, { auth: { horloge: H } }); S.auth.exigerJeton = true;
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true }); espion(PC);
  await pret(S, PC); await ecouterMsgs(S, PC);
  await lire(S, PC, () => { document.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }); });
  let mdp = MDP0;
  r('Mise en place : PC connecté (session simulée), Paramètres ouverts, carte « Mon compte » présente', (await sess(S, PC)).connecte && (await vueParams(S, PC)) && (await present(PC, '#acc_carte')), j({ sess: await sess(S, PC), carte: await present(PC, '#acc_carte') }));

  await essai('AH1', async () => {
    const a0 = nb(S, 'updateUser');
    const onze = 'onze-car🔑ab'; // 11 caractères (un emoji compte pour un) mais 12 unités UTF-16 : compter par caractère
    const m1 = await changerMdp(S, PC, mdp, onze);
    r('AH1 — nouveau mot de passe de 11 caractères (dont un emoji) : refus « Trop court : 12 caractères au moins (tu en as tapé 11) », aucun appel updateUser', /Trop court/.test(m1) && /12 caract/.test(m1) && /tu en as tapé 11\b/.test(m1) && nb(S, 'updateUser') === a0, j({ m1, appels: nb(S, 'updateUser') - a0 }));
    const douze = 'douze-carac1';
    const m2 = await changerMdp(S, PC, mdp, douze);
    const ok = nb(S, 'updateUser') === a0 + 1 && S.auth.compte.mdp === douze; if (ok) mdp = douze;
    r('AH1 — 12 caractères : accepté (1 appel updateUser, mot de passe changé sur le serveur simulé)', ok && /Mot de passe changé/.test(m2), j({ m2, appels: nb(S, 'updateUser') - a0 }));
  });

  await essai('AH2', async () => {
    const a0 = nb(S, 'updateUser');
    const m1 = await changerMdp(S, PC, mdp, 'phrase-de-douze-a', 'phrase-de-douze-b');
    const m2 = await changerMdp(S, PC, mdp, mdp);
    r('AH2 — confirmation différente : « pas identiques » ; nouveau = actuel : « C\'est déjà ton mot de passe » ; aucun appel', /pas identiques/.test(m1) && /déjà ton mot de passe/.test(m2) && nb(S, 'updateUser') === a0, j({ m1, m2, appels: nb(S, 'updateUser') - a0 }));
  });

  await essai('AH3', async () => {
    const a0 = nb(S, 'updateUser'), M3 = 'Phrase-essai-numero-trois';
    const avant = mdp;
    const m = await changerMdp(S, PC, mdp, M3);
    const L = derniers(S, 'updateUser'), d = L[L.length - 1] || { a: {} };
    if (S.auth.compte.mdp === M3) mdp = M3;
    const corps = Object.keys(d.a).sort();
    r('AH3 — changement réussi : 1 appel updateUser, corps { current_password, password } (Q4 : mot de passe actuel demandé), valeurs justes', nb(S, 'updateUser') === a0 + 1 && j(corps) === j(['current_password', 'password']) && d.a.password === M3 && d.a.current_password === avant, j({ appels: nb(S, 'updateUser') - a0, corps }));
    r('AH3 — message « ✓ Mot de passe changé. Note-le dans ton gestionnaire de mots de passe. », les trois champs vidés, proposition « Déconnecter aussi mes autres appareils »', /✓ Mot de passe changé/.test(m) && /gestionnaire de mots de passe/.test(m) && vides(await valeurs(PC, CHAMPS_MDP)) && (await present(PC, '#acc_mdp_autres')), j({ m, champs: await valeurs(PC, CHAMPS_MDP), proposition: await present(PC, '#acc_mdp_autres') }));
    const fuite = await lire(S, PC, (x) => { const t = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (String(localStorage.getItem(k)).indexOf(x) >= 0) t.push('localStorage:' + k); }
      for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (String(sessionStorage.getItem(k)).indexOf(x) >= 0) t.push('sessionStorage:' + k); }
      if ((localStorage.getItem('cpnext_journal') || '').indexOf(x) >= 0) t.push('journal'); if ((window.__msgs || []).some((m) => m.indexOf(x) >= 0)) t.push('messages');
      if ((document.body.innerText || '').indexOf(x) >= 0) t.push('écran'); if (Array.from(document.querySelectorAll('input')).some((e) => e.value.indexOf(x) >= 0)) t.push('champ'); return t; }, M3);
    const fuiteConsole = PC.console.filter((t) => t.indexOf(M3) >= 0 || t.indexOf(avant) >= 0);
    r('AH3 — le mot de passe n\'est nulle part : stockage local et de session, journal cpnext_journal, messages, écran, champs, console', fuite.length === 0 && fuiteConsole.length === 0 && /Mot de passe changé/.test(m), j({ fuite, fuiteConsole: fuiteConsole.length }));
  });

  await essai('AH4', async () => {
    S.auth.options.reauthExigee = true;
    const a0 = nb(S, 'reauthenticate'), u0 = nb(S, 'updateUser'), M4 = 'Phrase-essai-numero-quatre';
    const m1 = await changerMdp(S, PC, mdp, M4);
    const codeVisible = await present(PC, '#acc_mdp_code');
    r('AH4 — « reauthentication_needed » : 1 appel reauthenticate, champ « Code reçu par e-mail » affiché, message « un code à 6 chiffres vient d\'être envoyé »', nb(S, 'reauthenticate') === a0 + 1 && codeVisible && /code à 6 chiffres/.test(m1), j({ m1, reauth: nb(S, 'reauthenticate') - a0, codeVisible }));
    await remplir(PC, '#acc_mdp_code', '999999'); await cliquer(PC, '#acc_mdp_code_btn'); await PC.p.waitForTimeout(250); await calme(S, PC);
    const m2 = await texte(PC, '#acc_mdp_msg');
    r('AH4 — code faux : « reauthentication_not_valid » → « Code faux ou expiré », bouton « Renvoyer un code »', /Code faux ou expiré/.test(m2) && (await present(PC, '#acc_mdp_renvoi')) && S.auth.compte.mdp === mdp, j({ m2 }));
    await remplir(PC, '#acc_mdp_code', S.auth.nonce || ''); await cliquer(PC, '#acc_mdp_code_btn'); await PC.p.waitForTimeout(250); await calme(S, PC);
    const m3 = await texte(PC, '#acc_mdp_msg'), L = derniers(S, 'updateUser'), d = L[L.length - 1] || { a: {} };
    if (S.auth.compte.mdp === M4) mdp = M4;
    r('AH4 — code juste : updateUser avec le code (nonce) et le mot de passe actuel, réussite', d.a.nonce && d.a.password === M4 && d.a.current_password && S.auth.compte.mdp === M4 && /Mot de passe changé/.test(m3) && nb(S, 'updateUser') >= u0 + 3, j({ m3, corps: Object.keys(d.a).sort(), appels: nb(S, 'updateUser') - u0 }));
    S.auth.options.reauthExigee = false;
  });

  await essai('AH5', async () => {
    const E = S.auth.erreur, nouv = 'Phrase-essai-numero-cinq';
    const cas = [];
    const un = async (nom, err, attendu, actuel) => { if (err) S.auth.injecter('updateUser', err); const m = await changerMdp(S, PC, actuel || mdp, nouv); cas.push({ nom, ok: attendu.every((re) => re.test(m)) && vides(await valeurs(PC, CHAMPS_MDP)), m: m.slice(0, 160) }); };
    await un('weak_password', E(422, 'weak_password', 'Password is known to be weak and easy to guess', { name: 'AuthWeakPasswordError', reasons: ['characters', 'pwned'] }), [/Supabase refuse ce mot de passe/, /caractères/, /divulgu/]);
    await un('same_password', E(422, 'same_password', 'New password should be different from the old password.'), [/déjà ton mot de passe/]);
    await un('limite', E(429, 'over_request_rate_limit', 'Request rate limit reached'), [/Trop d'essais/]);
    await un('coupure', { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, [/Résultat inconnu/, /c'est le nouveau qui compte/]);
    await un('mot de passe actuel faux', null, [/Mot de passe actuel incorrect/], 'pas-le-bon-mot-de-passe');
    await un('autre', E(500, 'unexpected_failure', 'boom'), [/Erreur du serveur \(HTTP 500\)/, /boom/]);
    r('AH5 — réponses du serveur : mot de passe faible (raisons traduites), identique, limite d\'essais, coupure (« Résultat inconnu »), mot de passe actuel faux, autre (HTTP n) ; champs vidés après chaque réponse ; mot de passe inchangé', cas.length === 6 && cas.every((c) => c.ok) && S.auth.compte.mdp === mdp, j(cas.filter((c) => !c.ok).concat([{ tous: cas.length }])));
  });

  await essai('AH6', async () => {
    const u0 = nb(S, 'updateUser'), s0 = nb(S, 'signOut'), e0 = nb(S, 'enroll');
    await couper(S, PC); await vueParams(S, PC); await PC.p.waitForTimeout(150);
    const etat = await texte(PC, '#acc_etat');
    const gris = { mdp: await desactive(PC, '#acc_mdp_btn'), autres: await desactive(PC, '#acc_autres_btn'), mfa: await desactive(PC, '#acc_mfa_activer') };
    await remplir(PC, '#acc_mdp_actuel', mdp); await remplir(PC, '#acc_mdp_nouv', 'Phrase-essai-hors-ligne'); await remplir(PC, '#acc_mdp_conf', 'Phrase-essai-hors-ligne');
    await lire(S, PC, () => { try { cpCompteMdp(); } catch (e) { return String(e); } }).catch(() => {}); await PC.p.waitForTimeout(150);
    const m = await texte(PC, '#acc_mdp_msg');
    await retablir(S, PC); await vueParams(S, PC);
    r('AH6 — hors ligne : « Pas de réseau » dans la carte, trois boutons grisés, « rien n\'a changé » si on force le changement, aucun appel', /Pas de réseau/.test(etat) && gris.mdp && gris.autres && gris.mfa && /Pas de réseau : rien n'a changé/.test(m) && nb(S, 'updateUser') === u0 && nb(S, 'signOut') === s0 && nb(S, 'enroll') === e0, j({ etat, gris, m }));
    r('AH6 — réseau revenu : boutons de nouveau actifs', !(await desactive(PC, '#acc_mdp_btn')) && !(await desactive(PC, '#acc_autres_btn')) && (await present(PC, '#acc_mdp_btn')), j({ mdp: await desactive(PC, '#acc_mdp_btn') }));
  });

  await essai('AH7', async () => {
    S.auth.ouvrirSession('tel'); // un autre appareil connecté
    const s0 = nb(S, 'signOut'), d0 = PC.dialogues.length;
    await vueParams(S, PC); PC.reponses.push(false); await cliquer(PC, '#acc_autres_btn'); await PC.p.waitForTimeout(250);
    const dlg = PC.dialogues.slice(d0).map((d) => d.msg).join(' | ');
    r('AH7 — « Déconnecter mes autres appareils » puis Annuler : confirmation complète (« Cet appareil reste connecté », 1 heure au plus), aucun appel', nb(S, 'signOut') === s0 && /autres appareils/.test(dlg) && /Cet appareil reste connecté/.test(dlg) && /1 heure/.test(dlg), j({ dlg, appels: nb(S, 'signOut') - s0 }));
    PC.reponses.push(true); await cliquer(PC, '#acc_autres_btn'); await PC.p.waitForTimeout(300); await calme(S, PC);
    const L = derniers(S, 'signOut').slice(s0), m = await texte(PC, '#acc_app_msg');
    r('AH7 — OK : signOut({ scope: \'others\' }) une seule fois, message « ✓ Tes autres appareils sont déconnectés », la session du téléphone est révoquée', L.length === 1 && L[0].a.scope === 'others' && /Tes autres appareils sont déconnectés/.test(m) && S.auth.sessionsActives('tel').length === 0, j({ L: L.map((x) => x.a), m, tel: S.auth.sessionsActives('tel').length }));
    const e0 = S.ecritures; await ajouterClient(S, PC, 'Client après autres appareils'); await pret(S, PC);
    r('AH7 — cet appareil reste connecté : session gardée, un envoi d\'état passe encore', (await sess(S, PC)).connecte && (await sess(S, PC)).stockee && S.ecritures > e0 && clientSrv(S, 'Client après autres appareils'), j({ sess: await sess(S, PC), ecritures: S.ecritures - e0 }));
  });

  let fid = null;
  await essai('AH12', async () => {
    const e0 = nb(S, 'enroll'), u0 = nb(S, 'unenroll');
    const a = await activerMfa(S, PC);
    const txt = await texte(PC, '#acc_mfa_ins');
    const fid1 = (S.auth.facteurs[0] || {}).id;
    await cliquer(PC, '#acc_mfa_annuler'); await PC.p.waitForTimeout(250); await calme(S, PC);
    r('AH12 — « Activer » : avertissement (application d\'authentification, autres appareils déconnectés, moyen de secours), enroll ; Annuler → le facteur non vérifié est retiré (unenroll)', a.ok && /application d'authentification/.test(txt) && /autres appareils seront déconnectés/.test(txt) && /secours/.test(txt) && nb(S, 'enroll') === e0 + 1 && nb(S, 'unenroll') === u0 + 1 && S.auth.facteurs.length === 0, j({ a, txt: txt.slice(0, 200), enroll: nb(S, 'enroll') - e0, unenroll: nb(S, 'unenroll') - u0, facteurs: S.auth.facteurs.map((f) => f.status), fid1 }));
    S.auth.facteurs.push({ id: 'f-fantome-essai', friendly_name: 'Ancien essai', factor_type: 'totp', status: 'unverified', secret: SECRET_RFC, created_at: '2026-10-19T10:00:00.000Z' });
  });

  await essai('AH9 (PC)', async () => {
    const u0 = derniers(S, 'unenroll').length;
    const a = await activerMfa(S, PC);
    const L = derniers(S, 'enroll'), d = L[L.length - 1] || { a: {} };
    const fantomeRetire = derniers(S, 'unenroll').slice(u0).some((x) => x.a.factorId === 'f-fantome-essai') && !S.auth.facteurs.some((f) => f.id === 'f-fantome-essai');
    r('AH12 — nouvel essai : le facteur fantôme non vérifié d\'un essai précédent est retiré avant l\'inscription (aucun facteur fantôme)', a.ok && fantomeRetire && S.auth.facteurs.filter((f) => f.status === 'unverified').length === 1, j({ fantomeRetire, facteurs: S.auth.facteurs.map((f) => f.id + ':' + f.status) }));
    fid = (S.auth.facteurs.find((f) => f.status === 'unverified') || {}).id;
    const uri = (S.auth.facteurs.length && 'otpauth://totp/ClimPilot:' + encodeURIComponent(COMPTE.email) + '?algorithm=SHA1&digits=6&issuer=ClimPilot&period=30&secret=' + SECRET_RFC);
    const qr = await PC.p.evaluate((u) => { const i = document.querySelector('#acc_mfa_qr'); if (!i) return null; const b = i.getBoundingClientRect();
      let attendu = null; try { attendu = cpQrImage(u); } catch (e) {} return { src: (i.getAttribute('src') || '').slice(0, 40), memeQueLAppli: !!attendu && i.getAttribute('src') === attendu, largeur: Math.round(b.width), visible: !!b.width }; }, uri).catch(() => null);
    const cle = (await texte(PC, '#acc_mfa_cle')).trim();
    r('AH9 — PC : enroll({ factorType: \'totp\', friendlyName: \'iPhone\', issuer: \'ClimPilot\' }) ; QR code fabriqué dans l\'appli (image data:image/svg+xml, la même que cpQrImage(uri)), assez grand pour être scanné (≥ 150 px)', d.a.factorType === 'totp' && d.a.friendlyName === 'iPhone' && d.a.issuer === 'ClimPilot' && qr && /^data:image\/svg\+xml/.test(qr.src) && qr.memeQueLAppli && qr.largeur >= 150, j({ corps: d.a, qr }));
    r('AH9 — PC : clé en clair par groupes de 4 et bouton « Copier »', cle === CLE_GROUPEE && (await present(PC, '#acc_mfa_copier')), j({ cle, attendu: CLE_GROUPEE }));
    const csp = await lire(S, PC, () => (window.__csp || []).slice()).catch(() => ['?']);
    r('AH9 — sous la politique de sécurité ACTUELLE (non élargie) : 0 violation, 0 ligne « Content Security Policy » en console', csp.length === 0 && lignesCsp(PC).length === 0, j({ csp, console: lignesCsp(PC).slice(0, 3) }));
  });

  await essai('AH10', async () => {
    const m = await validerMfa(S, PC, codeFaux(S));
    const f = S.auth.facteurs.find((x) => x.id === fid) || {}, n = await niveau(S, PC);
    r('AH10 — code faux : « Code refusé » avec le conseil de l\'heure automatique ; facteur toujours non vérifié ; niveau aal1', /Code refusé/.test(m) && /heure/.test(m) && f.status === 'unverified' && n && n.currentLevel === 'aal1', j({ m, statut: f.status, n }));
  });

  await essai('AH11', async () => {
    const m = await validerMfa(S, PC, codeJuste(S));
    const f = S.auth.facteurs.find((x) => x.id === fid) || {}, n = await niveau(S, PC), s = await sess(S, PC);
    await vueParams(S, PC); const etat = await texte(PC, '#acc_mfa_etat');
    r('AH11 — code juste : « ✓ Double authentification activée », message « autres appareils », moyen de secours proposé', /Double authentification activée/.test(m) && /autres appareils/.test(m) && /secours/i.test(m) && f.status === 'verified', j({ m, statut: f.status }));
    r('AH11 — état « Activée : 1 appareil (« iPhone ») » ; niveau aal2 ; SESS = la nouvelle session (jeton aal2, le même que celui enregistré)', /Activée/.test(etat) && /iPhone/.test(etat) && n && n.currentLevel === 'aal2' && s.connecte && s.aal === 'aal2' && s.memeQueStockee, j({ etat, n, s }));
  });

  await essai('AH11 bis', async () => {
    const a = await activerMfa(S, PC, null, '#acc_mfa_secours');
    const L = derniers(S, 'enroll'), d = L[L.length - 1] || { a: {} };
    const m = await validerMfa(S, PC, codeJuste(S)); await vueParams(S, PC); const etat = await texte(PC, '#acc_mfa_etat');
    r('AH11 bis — « Ajouter un appareil de secours » (Q2) : nom proposé « Secours », 2 facteurs vérifiés, état « 2 appareils »', a.ok && d.a.friendlyName === 'Secours' && S.auth.facteurs.filter((f) => f.status === 'verified').length === 2 && /2 appareils/.test(etat) && /Secours/.test(etat), j({ a, corps: d.a, m: m.slice(0, 120), etat }));
  });

  await essai('AH15 (PC)', async () => {
    const u0 = nb(S, 'unenroll'), f0 = nb(S, 'refresh'), d0 = PC.dialogues.length;
    await vueParams(S, PC);
    const fSec = S.auth.facteurs.find((f) => f.friendly_name === 'Secours'), fIph = S.auth.facteurs.find((f) => f.friendly_name === 'iPhone');
    PC.reponses.push(true); await cliquer(PC, `#acc_mfa_liste button[data-fid="${fSec && fSec.id}"]`); await PC.p.waitForTimeout(300); await calme(S, PC);
    await vueParams(S, PC);
    PC.reponses.push(true); await cliquer(PC, `#acc_mfa_liste button[data-fid="${fIph && fIph.id}"]`); await PC.p.waitForTimeout(300); await calme(S, PC);
    await vueParams(S, PC); const etat = await texte(PC, '#acc_mfa_etat'), n = await niveau(S, PC);
    const dlg = PC.dialogues.slice(d0).map((d) => d.msg).join(' | ');
    r('AH15 — retirer chaque appareil : confirmation (« Retirer « … » ? S\'il est le seul, la connexion ne demandera plus de code »), unenroll, refreshSession ; état « Désactivée » ; niveau redescendu à aal1', nb(S, 'unenroll') === u0 + 2 && nb(S, 'refresh') >= f0 + 2 && /Retirer « Secours »/.test(dlg) && /ne demandera plus de code/.test(dlg) && /Désactivée/.test(etat) && S.auth.facteurs.length === 0 && n && n.currentLevel === 'aal1', j({ unenroll: nb(S, 'unenroll') - u0, refresh: nb(S, 'refresh') - f0, dlg: dlg.slice(0, 200), etat, n }));
  });

  await essai('AH8', async () => {
    const s0 = nb(S, 'signOut'); S.auth.ouvrirSession('tel');
    PC.reponses.push(true); await lire(S, PC, () => { cloudLogout(); }).catch(() => {});
    await PC.p.waitForTimeout(1500); await calme(S, PC);
    const L = derniers(S, 'signOut').slice(s0);
    r('AH8 — lien « Déconnexion » du menu (Q6) : signOut({ scope: \'local\' }) — cet appareil seulement, l\'autre reste connecté', L.length === 1 && L[0].a.scope === 'local' && S.auth.sessionsActives('tel').length === 1 && S.auth.sessionsActives('pc').length === 0, j({ L: L.map((x) => x.a), tel: S.auth.sessionsActives('tel').length, pc: S.auth.sessionsActives('pc').length }));
  });
  r('Aucune erreur JavaScript (partie 1)', PC.errs.length === 0, PC.errs.join(' | ').slice(0, 400));
  await PC.ctx.close();
}

/* ================= Partie 2 — téléphone : activation (lien otpauth), connexion en deux étapes, démarrage, retrait, « Continuer sans connexion » ================= */
{
  const S = serveurCommun(DEBUT, { auth: { horloge: H } }); S.auth.exigerJeton = true;
  await essai('AH9 (iPhone)', async () => {
    const T = await appareil(S, 'tel0', { mobile: true, horloge: H, connecte: true }); espion(T); await pret(S, T);
    const a = await activerMfa(S, T);
    const lien = await T.p.evaluate(() => { const l = document.querySelector('#acc_mfa_lien'); if (!l) return null; const b = l.getBoundingClientRect(); return { href: l.getAttribute('href') || '', visible: !!b.width }; }).catch(() => null);
    const cle = (await texte(T, '#acc_mfa_cle')).trim(), conseil = await texte(T, '#acc_mfa_scan');
    r('AH9 — iPhone : bouton « Ouvrir dans l\'application d\'authentification » (lien otpauth://), clé en clair + « Copier », conseil « active-la depuis le PC »', a.ok && lien && lien.visible && /^otpauth:\/\/totp\//.test(lien.href) && cle === CLE_GROUPEE && (await present(T, '#acc_mfa_copier')) && /depuis le PC/.test(conseil), j({ a, lien, cle, conseil: conseil.slice(0, 160) }));
    await cliquer(T, '#acc_mfa_annuler'); await T.p.waitForTimeout(200); await calme(S, T);
    r('Aucune erreur JavaScript (activation sur iPhone)', T.errs.length === 0, T.errs.join(' | ').slice(0, 300));
    await T.ctx.close(); S.auth.facteurs = [];
  });

  S.auth.facteurs.push({ id: 'f-iph-essai', friendly_name: 'iPhone', factor_type: 'totp', status: 'verified', secret: SECRET_RFC, created_at: '2026-10-19T10:00:00.000Z' });
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); espion(TEL);
  await essai('AH13', async () => {
    await TEL.p.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 });
    await TEL.p.fill('#logEmail', COMPTE.email); await TEL.p.fill('#logPass', MDP0);
    const e0 = appelsEtat(S, 'tel');
    await TEL.p.evaluate(() => doLogin()); await TEL.p.waitForTimeout(500); await calme(S, TEL);
    const etape = { login: await loginVisible(TEL), e2: await etape2(TEL), etat: appelsEtat(S, 'tel') - e0, sess: (await sess(S, TEL)).connecte };
    r('AH13 — double authentification active : après le mot de passe, 2e étape « Code de double authentification » dans le même écran ; AUCUNE lecture de climpilot_state ; SESS pas encore posée', etape.login && etape.e2 && etape.etat === 0 && !etape.sess, j(etape));
    await remplir(TEL, '#logCode', codeFaux(S)); await cliquer(TEL, '#logCodeBtn'); await TEL.p.waitForTimeout(400); await calme(S, TEL);
    const m = await texte(TEL, '#logMsg');
    r('AH13 — code faux : « Code refusé », toujours sur l\'écran de connexion, aucune synchro', /Code refusé/.test(m) && (await loginVisible(TEL)) && appelsEtat(S, 'tel') === e0, j({ m, etat: appelsEtat(S, 'tel') - e0 }));
    await remplir(TEL, '#logCode', codeJuste(S)); await cliquer(TEL, '#logCodeBtn'); await TEL.p.waitForTimeout(500); await calme(S, TEL);
    const s = await sess(S, TEL);
    r('AH13 — code juste : écran fermé, SESS aal2, synchro faite (lecture de climpilot_state)', !(await loginVisible(TEL)) && s.connecte && s.aal === 'aal2' && appelsEtat(S, 'tel') > e0, j({ s, etat: appelsEtat(S, 'tel') - e0 }));
    r('AH13 — lien « Je n\'ai plus mon téléphone » présent sur la 2e étape (procédure de secours)', await TEL.p.evaluate(() => !!document.querySelector('#logTelPerdu')).catch(() => false), '');
  });

  await essai('AH14', async () => {
    await rouvrir(S, TEL);
    r('AH14 — démarrage avec une session aal2 : pas d\'écran de connexion (témoin)', !(await loginVisible(TEL)) && (await sess(S, TEL)).connecte, j(await sess(S, TEL)));
    const PC2 = await appareil(S, 'pc2', { mobile: false, horloge: H, connecte: true }); // session aal1, alors qu'un facteur vérifié existe
    await PC2.p.waitForTimeout(400);
    const v = { login: await loginVisible(PC2), e2: await etape2(PC2), etat: appelsEtat(S, 'pc2'), sess: (await sess(S, PC2)).connecte };
    r('AH14 — démarrage avec une session aal1 et un facteur vérifié (appli fermée pendant la saisie du code) : écran du code, aucune synchro', v.login && v.e2 && v.etat === 0 && !v.sess, j(v));
    await PC2.ctx.close();
    await couper(S, TEL); const j0 = S.journal.filter((x) => x.dev === 'tel' && x.sorte === 'auth').length;
    await TEL.p.reload(); await TEL.p.waitForTimeout(2000); await calme(S, TEL);
    const authApres = S.journal.filter((x) => x.dev === 'tel' && x.sorte === 'auth').length - j0;
    r('AH14 — démarrage hors ligne avec une session aal2 : pas d\'écran de connexion, AUCUN appel au serveur d\'authentification (niveau lu en local)', !(await loginVisible(TEL)) && authApres === 0, j({ login: await loginVisible(TEL), authApres }));
    await retablir(S, TEL);
  });

  await essai('AH15 (iPhone)', async () => {
    await pret(S, TEL); const u0 = nb(S, 'unenroll', 'tel');
    await vueParams(S, TEL); TEL.reponses.push(true); await cliquer(TEL, '#acc_mfa_liste button[data-fid="f-iph-essai"]'); await TEL.p.waitForTimeout(300); await calme(S, TEL);
    await vueParams(S, TEL); const etat = await texte(TEL, '#acc_mfa_etat');
    r('AH15 — retrait sur le téléphone (session aal2) : unenroll, « Désactivée »', nb(S, 'unenroll', 'tel') === u0 + 1 && S.auth.facteurs.length === 0 && /Désactivée/.test(etat), j({ etat, facteurs: S.auth.facteurs.length }));
    TEL.reponses.push(true); await lire(S, TEL, () => { cloudLogout(); }).catch(() => {}); await TEL.p.waitForTimeout(1500); await calme(S, TEL);
    await TEL.p.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 }).catch(() => {});
    await TEL.p.fill('#logEmail', COMPTE.email).catch(() => {}); await TEL.p.fill('#logPass', MDP0).catch(() => {});
    await TEL.p.evaluate(() => doLogin()).catch(() => {}); await TEL.p.waitForTimeout(500); await calme(S, TEL);
    r('AH15 — connexion suivante : mot de passe seul, sans code', !(await loginVisible(TEL)) && !(await etape2(TEL)) && (await sess(S, TEL)).connecte, j({ login: await loginVisible(TEL), sess: await sess(S, TEL) }));
  });

  await essai('Q8', async () => {
    TEL.reponses.push(true); await lire(S, TEL, () => { cloudLogout(); }).catch(() => {}); await TEL.p.waitForTimeout(1500); await calme(S, TEL);
    const vu = await present(TEL, '#logSansCo');
    await cliquer(TEL, '#logSansCo'); await TEL.p.waitForTimeout(300);
    const apres = { login: await loginVisible(TEL), sess: (await sess(S, TEL)).connecte, lbl: await texte(TEL, '#cloudLbl'), clients: await lire(S, TEL, () => { go('clients'); return document.querySelector('#v-clients.active') ? true : false; }).catch(() => false) };
    r('Q8 — appareil déjà synchronisé : « Continuer sans connexion » présent ; au clic, écran fermé, appli utilisable, synchro en pause (SESS vide)', vu && !apres.login && !apres.sess && apres.clients && /pause|non connecté/i.test(apres.lbl), j({ vu, apres }));
    const NEUF = await appareil(S, 'neuf', { mobile: true, horloge: H });
    const v2 = { login: await loginVisible(NEUF), bouton: await present(NEUF, '#logSansCo') };
    r('Q8 — appareil neuf (jamais synchronisé) : écran de connexion SANS « Continuer sans connexion »', v2.login && !v2.bouton && (await NEUF.p.evaluate(() => !!document.querySelector('#logSansCo')).catch(() => false)), j(v2));
    await NEUF.ctx.close();
  });
  r('Aucune erreur JavaScript (partie 2)', TEL.errs.length === 0, TEL.errs.join(' | ').slice(0, 400));
  await TEL.ctx.close();
}

/* ================= Partie 3 — AH17 : session fermée pendant l'usage, formulaire ouvert ================= */
{
  const S = serveurCommun(DEBUT, { auth: { horloge: H } }); S.auth.exigerJeton = true;
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true }); espion(PC); await pret(S, PC);
  await essai('AH17', async () => {
    S.etatBloque.pc = true; await ajouterClient(S, PC, 'Client pendant la coupure'); await PC.p.waitForTimeout(300);
    await lire(S, PC, () => { clearTimeout(_pushT); return pushState(); }).catch(() => {}); await PC.p.waitForTimeout(300);
    await lire(S, PC, () => { go('clients'); editClient(); return true; }); await PC.p.fill('#mc_nom', 'Saisie en cours non enregistrée');
    Object.values(S.auth.sessions).forEach((x) => { x.revoquee = true; }); // fermée ailleurs (mot de passe changé, autres appareils déconnectés…)
    const rr = await PC.p.evaluate(() => window.__fauxAuthRenouveler()); await PC.p.waitForTimeout(400);
    const v = await PC.p.evaluate(() => { const b = document.querySelector('#cpBandeauSession'); const r = b && b.getBoundingClientRect();
      return { sess: !!window.SESS, bandeau: b ? b.innerText : null, bandeauVisible: !!(r && r.width), login: getComputedStyle(document.getElementById('loginScreen')).display !== 'none', dirty: localStorage.getItem('cp2_dirty'), saisie: (document.getElementById('mc_nom') || {}).value, formOuvert: document.getElementById('mClient').classList.contains('on'), lbl: document.getElementById('cloudLbl').textContent }; });
    r('AH17 — SIGNED_OUT pendant l\'usage : SESS vidée, étiquette « déconnecté », bandeau NON bloquant (connexion fermée, données sur cet appareil, « des modifications attendent l\'envoi », SANS nombre), pas d\'écran plein', rr === 'refus' && !v.sess && v.bandeauVisible && /connexion au cloud a été fermée/.test(v.bandeau) && /des modifications attendent l'envoi/.test(v.bandeau) && !/\d+\s*modification/.test(v.bandeau) && !v.login && /déconnecté/.test(v.lbl), j(v));
    r('AH17 — rien n\'est perdu : formulaire toujours ouvert avec la saisie, « à envoyer » (cp2_dirty) gardé', v.formOuvert && v.saisie === 'Saisie en cours non enregistrée' && v.dirty === '1', j({ formOuvert: v.formOuvert, saisie: v.saisie, dirty: v.dirty }));
    await lire(S, PC, () => { closeModal('mClient'); }); S.etatBloque.pc = false;
    const rec0 = await cliquer(PC, '#cpBandeauSession button[data-action="reconnecter"]'); await PC.p.waitForTimeout(200);
    const loginApresClic = await loginVisible(PC);
    await seConnecter(S, PC); await pret(S, PC);
    r('AH17 — « Se reconnecter » ouvre l\'écran de connexion ; après la connexion, l\'envoi part (le client fait pendant la coupure arrive au serveur), bandeau retiré', rec0 && loginApresClic && clientSrv(S, 'Client pendant la coupure') && !(await present(PC, '#cpBandeauSession')) && (await sess(S, PC)).connecte, j({ rec0, loginApresClic, srv: clientSrv(S, 'Client pendant la coupure') }));
  });
  r('Aucune erreur JavaScript (partie 3)', PC.errs.length === 0, PC.errs.join(' | ').slice(0, 400));
  await PC.ctx.close();
}

/* ================= Partie 4 — banc deux appareils : AHB1 à AHB4 ================= */
{
  const S = serveurCommun(DEBUT, { auth: { horloge: H } }); S.auth.exigerJeton = true;
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true }); espion(PC); await pret(S, PC);
  await ajouterClient(S, PC, 'Client de départ'); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); espion(TEL); await seConnecter(S, TEL); await pret(S, TEL);
  let mdp = MDP0;
  r('Mise en place du banc : PC et téléphone connectés au même compte, synchronisés', (await sess(S, PC)).connecte && (await sess(S, TEL)).connecte && clientSrv(S, 'Client de départ'), j({ pc: await sess(S, PC), tel: await sess(S, TEL) }));

  await essai('AHB1', async () => {
    await couper(S, TEL); await ajouterClient(S, TEL, 'Client du téléphone hors ligne');
    await vueParams(S, PC); PC.reponses.push(true); await cliquer(PC, '#acc_autres_btn'); await PC.p.waitForTimeout(300); await calme(S, PC);
    S.coupe.tel = false; const rr = await TEL.p.evaluate(() => window.__fauxAuthRenouveler()); await TEL.p.waitForTimeout(300);
    await TEL.ctx.setOffline(false); await TEL.p.waitForTimeout(400); await calme(S, TEL);
    const v = { rr, bandeau: await present(TEL, '#cpBandeauSession'), login: await loginVisible(TEL), garde: await lire(S, TEL, () => CLIENTS.some((c) => c.nom === 'Client du téléphone hors ligne')), dirty: await lire(S, TEL, () => localStorage.getItem('cp2_dirty')), srv: clientSrv(S, 'Client du téléphone hors ligne') };
    const e0 = S.ecritures; await ajouterClient(S, PC, 'Client du PC après'); await pret(S, PC);
    r('AHB1 — PC : « Déconnecter mes autres appareils » ; PC toujours connecté et synchronisé', (await sess(S, PC)).connecte && S.ecritures > e0 && clientSrv(S, 'Client du PC après'), j({ pc: await sess(S, PC) }));
    r('AHB1 — téléphone revenu en ligne, renouvellement refusé : bandeau (pas d\'écran plein), modification hors ligne gardée et pas envoyée sans session', v.rr === 'refus' && v.bandeau && !v.login && v.garde && v.dirty === '1' && !v.srv, j(v));
    await cliquer(TEL, '#cpBandeauSession button[data-action="reconnecter"]'); await seConnecter(S, TEL); await pret(S, TEL); await pret(S, PC);
    r('AHB1 — reconnexion du téléphone : la modification part, rien de perdu (les deux clients au serveur et sur les deux appareils)', clientSrv(S, 'Client du téléphone hors ligne') && clientSrv(S, 'Client du PC après') && (await lire(S, TEL, () => CLIENTS.some((c) => c.nom === 'Client du PC après'))), j({ srvTel: clientSrv(S, 'Client du téléphone hors ligne'), srvPC: clientSrv(S, 'Client du PC après') }));
  });

  await essai('AHB3', async () => {
    const nouv = 'Phrase-du-banc-numero-trois';
    const m = await changerMdp(S, PC, mdp, nouv); if (S.auth.compte.mdp === nouv) { const ancien = mdp; mdp = nouv;
      PC.reponses.push(true); await cliquer(PC, '#acc_mdp_autres'); await PC.p.waitForTimeout(300); await calme(S, PC);
      const rr = await TEL.p.evaluate(() => window.__fauxAuthRenouveler()); await TEL.p.waitForTimeout(300);
      await cliquer(TEL, '#cpBandeauSession button[data-action="reconnecter"]');
      await seConnecter(S, TEL, ancien); const m1 = await texte(TEL, '#logMsg'), refuse = await loginVisible(TEL);
      await TEL.p.fill('#logPass', nouv); await TEL.p.evaluate(() => doLogin()); await TEL.p.waitForTimeout(400); await calme(S, TEL);
      r('AHB3 — PC change le mot de passe puis ferme les autres connexions : sur le téléphone, ancien mot de passe refusé, nouveau accepté', rr === 'refus' && refuse && /incorrect/.test(m1) && !(await loginVisible(TEL)) && (await sess(S, TEL)).connecte, j({ m, rr, m1, refuse }));
    } else r('AHB3 — changement du mot de passe sur le PC', false, m);
  });

  await essai('AHB2', async () => {
    const a = await activerMfa(S, PC); const m = a.ok ? await validerMfa(S, PC, codeJuste(S)) : '';
    const telRevoque = S.auth.sessionsActives('tel').length === 0;
    const rr = await TEL.p.evaluate(() => window.__fauxAuthRenouveler()); await TEL.p.waitForTimeout(300);
    const bandeau = await present(TEL, '#cpBandeauSession');
    await cliquer(TEL, '#cpBandeauSession button[data-action="reconnecter"]');
    await seConnecterCode(S, TEL, mdp, codeJuste(S)); await pret(S, TEL);
    await ajouterClient(S, TEL, 'Client après double authentification'); await pret(S, TEL);
    r('AHB2 — PC active la double authentification : session du téléphone révoquée, bandeau ; reconnexion : mot de passe PUIS code ; synchro', /activée/.test(m) && telRevoque && rr === 'refus' && bandeau && (await sess(S, TEL)).aal === 'aal2' && clientSrv(S, 'Client après double authentification'), j({ a, m: m.slice(0, 80), telRevoque, rr, bandeau, tel: await sess(S, TEL) }));
  });

  await essai('AHB4', async () => {
    await couper(S, TEL); await ajouterClient(S, TEL, 'Client AHB4 hors ligne');
    await vueParams(S, PC); PC.reponses.push(true); await cliquer(PC, '#acc_autres_btn'); await PC.p.waitForTimeout(300); await calme(S, PC);
    await TEL.p.evaluate(() => window.__fauxAuthExpirer());
    await TEL.p.reload(); await TEL.p.waitForTimeout(2200);
    const horsLigne = { login: await loginVisible(TEL), lbl: await texte(TEL, '#cloudLbl'), garde: await lire(S, TEL, () => CLIENTS.some((c) => c.nom === 'Client AHB4 hors ligne')).catch(() => false) };
    r('AHB4 — téléphone hors ligne pendant la révocation, rouvert hors ligne au jeton expiré : AUCUN écran de connexion, étiquette « hors ligne », données là', !horsLigne.login && /hors ligne/.test(horsLigne.lbl) && horsLigne.garde, j(horsLigne));
    await retablir(S, TEL); await TEL.p.waitForTimeout(800); await calme(S, TEL);
    const retour = { login: await loginVisible(TEL), bandeau: await present(TEL, '#cpBandeauSession'), srv: clientSrv(S, 'Client AHB4 hors ligne') };
    r('AHB4 — au retour du réseau : session refusée → bandeau « connexion fermée » (pas d\'écran plein), rien envoyé sans session', !retour.login && retour.bandeau && !retour.srv, j(retour));
    await cliquer(TEL, '#cpBandeauSession button[data-action="reconnecter"]'); await seConnecterCode(S, TEL, mdp, codeJuste(S)); await pret(S, TEL);
    r('AHB4 — reconnexion (mot de passe + code) : la modification faite hors ligne arrive, rien de perdu', clientSrv(S, 'Client AHB4 hors ligne') && clientSrv(S, 'Client après double authentification') && (await sess(S, TEL)).connecte, j({ srv: clientSrv(S, 'Client AHB4 hors ligne') }));
  });
  r('Aucune erreur JavaScript (banc deux appareils)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | ').slice(0, 400));
  await PC.ctx.close(); await TEL.ctx.close();
}
await fermerNavigateur();

/* ================= Partie 5 — AH16 : code PIN (fonctionnement identique, texte honnête) ================= */
await essai('AH16', async () => {
  const b = await getBrowser();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Europe/Paris' }); await sansBibliothequesCloud(ctx);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const toasts = []; await p.exposeFunction('__toastAH', (m) => toasts.push(m));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'EFFACER' : undefined).catch(() => {}));
  await p.route(/supabase/, (x) => x.abort());
  await p.clock.install({ time: new Date(H) });
  await p.goto(URL_LOCALE + 'index.html'); await p.waitForTimeout(2200);
  await p.evaluate(() => { const t = window.toast; window.toast = function (m) { __toastAH(String(m)); return t.apply(this, arguments); }; go('params'); });
  const pin = async (cur, a, c) => p.evaluate(([x, y, z]) => { document.getElementById('pin_cur').value = x; document.getElementById('pin_n1').value = y; document.getElementById('pin_n2').value = z; pinSet(); return localStorage.getItem('cp2_pin'); }, [cur, a, c]);
  const p3 = await pin('', '123', '123'), t3 = toasts.slice(-1)[0];
  const p4 = await pin('', '1234', '1234');
  const p8 = await pin('1234', '12345678', '12345678');
  await p.clock.fastForward('10:01'); await p.waitForTimeout(200);
  const verrou = await p.evaluate(() => getComputedStyle(document.getElementById('lockScreen')).display !== 'none');
  await p.evaluate(() => pinForgot()); await p.waitForTimeout(200);
  const apres = await p.evaluate(() => ({ pin: localStorage.getItem('cp2_pin'), verrou: getComputedStyle(document.getElementById('lockScreen')).display !== 'none' }));
  r('AH16 — code PIN, fonctionnement identique (témoin) : 3 chiffres refusés, 4 et 8 acceptés, verrou après 10 min sans geste, « Code oublié ? » + EFFACER retire le code', p3 === null && /4 à 8 chiffres/.test(t3 || '') && !!p4 && !!p8 && p4 !== p8 && verrou && apres.pin === null && !apres.verrou && errs.length === 0, j({ p3, t3, p4: !!p4, p8: !!p8, verrou, apres, errs }));
  const txt = await p.evaluate(() => { const c = Array.from(document.querySelectorAll('#v-params .card')).find((x) => /code d'accès/.test(x.innerText)); return c ? c.innerText : ''; });
  r('AH16 — texte honnête de la carte du code : « ne protège pas d\'un vol », « cet appareil », connexion au cloud ouverte derrière, « Déconnecter mes autres appareils » ; l\'ancienne phrase « restent uniquement sur cet ordinateur » et la « session Windows » ont disparu', /ne protège pas d'un vol/.test(txt) && /cet appareil/.test(txt) && /connexion au cloud reste ouverte/.test(txt) && /Déconnecter mes autres appareils/.test(txt) && !/restent uniquement sur cet ordinateur/.test(txt) && !/session Windows/.test(txt) && /verrouillage auto après 10 min/.test(txt), txt.slice(0, 400));
  await ctx.close();
});

/* ================= Partie 6 — AH20 : sans cloud (bibliothèque remplacée, comme la suite A) ================= */
await essai('AH20', async () => {
  const { p, ctx, errs } = await page({ mobile: false, horloge: H, cspReelle: true });
  const res = await p.evaluate(async () => { go('params'); await new Promise((z) => setTimeout(z, 100)); const c = document.getElementById('acc_carte'); if (!c) return { n: 0 };
    const bs = Array.from(c.querySelectorAll('button')).filter((b) => b.getBoundingClientRect().width); const out = [];
    for (const b of bs) { b.click(); await new Promise((z) => setTimeout(z, 80)); out.push((b.innerText || '').trim().slice(0, 30)); }
    return { n: bs.length, boutons: out, texte: c.innerText.slice(0, 600) }; });
  r('AH20 — sans cloud : la carte « Mon compte » dit « Pas connecté au cloud », chacun de ses boutons répond sans erreur (« Connecte-toi au cloud d\'abord »)', res.n >= 3 && /Pas connecté au cloud/.test(res.texte) && /Connecte-toi au cloud d'abord/.test(res.texte) && errs.length === 0, j({ n: res.n, boutons: res.boutons, errs: errs.slice(0, 3) }));
  await ctx.close();
});

/* ================= Partie 7 — test du test : QR code fabriqué dans l'appli, comparé à une bibliothèque indépendante (segno 1.6.6, Python, niveau M, octets) ================= */
await essai('QR', async () => {
  const REFQR = [
    ['otpauth://totp/ClimPilot:essai%40exemple.invalid?algorithm=SHA1&digits=6&issuer=ClimPilot&period=30&secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 8, 49, ['c0de5417277b35d6', '96947633d621b85a', '5c1b4bccbbb5161f', '6067849996deaa15', '911abcad3ecf6619', 'cb42a3cd2fb067f9', '17579c95fdd9466d', 'a1b38bf5f8c5b88b']],
    ['otpauth://totp/X?secret=ABC', 3, 29, ['4df6299897e5977a', '6dccfcda3e1dab07', '79a7dc8af68b0e26', '4a1f2c2fa43f58ae', '7f9635b459519f73', 'c209b8a3742761a0', '84e049ec461d8d71', '73779b3ff350cbc5']],
    ['otpauth://totp/ClimPilot:un.nom.de.compte.vraiment.tres.long.pour.essayer.le.qr%40un-domaine-d-essai-assez-long.invalid?algorithm=SHA1&digits=6&issuer=ClimPilot&period=30&secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 11, 61, ['f0545afd45f00d41', '49acba3532616e4e', '42a386c0e74e1a54', 'd7e0f22e0496e5f8', '26cba6f936ac069c', 'f23283c9784f1335', '0a1731739bd6e4bf', '34c4826ca642820c']],
  ];
  const { p, ctx } = await page({ mobile: false, horloge: H, cspReelle: true });
  const crypto = await import('crypto');
  const ecarts = [];
  for (const [t, v, n, hs] of REFQR) for (let m = 0; m < 8; m++) {
    const q = await p.evaluate(([x, k]) => { try { return cpQr(x, k); } catch (e) { return { erreur: String(e) }; } }, [t, m]).catch((e) => ({ erreur: String(e) }));
    const h = q && q.lignes ? crypto.createHash('sha256').update(q.lignes.join('\n')).digest('hex').slice(0, 16) : null;
    if (!q || q.version !== v || q.taille !== n || h !== hs[m]) ecarts.push({ t: t.slice(0, 30), m, v: q && q.version, n: q && q.taille, h, attendu: hs[m], erreur: q && q.erreur });
  }
  r('Test du test — QR code de l\'appli (cpQr) identique module par module à segno 1.6.6 pour 3 textes (versions 3, 8 et 11) et les 8 masques', ecarts.length === 0, j(ecarts.slice(0, 4).concat([{ ecarts: ecarts.length }])));
  await ctx.close();
});

/* ================= Partie 8 — AH18 : démarrage, jeton expiré, Supabase injoignable, VRAI supabase-js embarqué ================= */
await essai('AH18', async () => {
  const b = await getBrowser();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route(/\/vendor\/chart-/, (x) => x.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=function(){return{destroy(){},update(){}}};' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let ouvert = false; const vus = [];
  const t0 = Math.floor(Date.parse(H) / 1000);
  const user = { id: COMPTE.id, aud: 'authenticated', role: 'authenticated', email: COMPTE.email, factors: [] };
  await ctx.route(/supabase\.co/, async (x) => { const u = x.request().url(); vus.push(u.replace(/^https:\/\/[^/]+/, '').slice(0, 60));
    if (!ouvert) return x.abort('internetdisconnected');
    if (/\/auth\/v1\/token/.test(u)) { const exp = t0 + 7200; return x.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: jeton({ sub: COMPTE.id, aal: 'aal1', exp, session_id: 'sv' }), token_type: 'bearer', expires_in: 7200, expires_at: exp, refresh_token: 'rafraichi-essai', user }) }); }
    if (/\/auth\/v1\/user/.test(u)) return x.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(user) });
    return x.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); });
  const perime = { access_token: jeton({ sub: COMPTE.id, aal: 'aal1', exp: t0 - 3600, session_id: 'sv' }), token_type: 'bearer', expires_in: 3600, expires_at: t0 - 3600, refresh_token: 'perime-essai', user };
  await p.addInitScript((s) => { if (!sessionStorage.getItem('__ah18')) { sessionStorage.setItem('__ah18', '1'); localStorage.setItem('sb-onnmomydxfoozcmmtsnz-auth-token', JSON.stringify(s)); } }, perime);
  await p.clock.install({ time: new Date(H) });
  const debut = Date.now();
  await p.goto(URL_LOCALE + 'index.html');
  let etat = null;
  for (let i = 0; i < 120; i++) { await p.waitForTimeout(500); etat = await p.evaluate(() => ({ login: getComputedStyle(document.getElementById('loginScreen')).display !== 'none', lbl: document.getElementById('cloudLbl').textContent }));
    if (etat.login || /hors ligne|injoignable|non connecté/.test(etat.lbl)) break; }
  const duree = Math.round((Date.now() - debut) / 1000);
  const stockee = await p.evaluate(() => !!localStorage.getItem('sb-onnmomydxfoozcmmtsnz-auth-token'));
  await p.waitForTimeout(1500); const etat2 = await p.evaluate(() => ({ login: getComputedStyle(document.getElementById('loginScreen')).display !== 'none', lbl: document.getElementById('cloudLbl').textContent }));
  r('AH18 — vrai supabase-js, jeton expiré, Supabase injoignable : PAS d\'écran de connexion (Q7), étiquette « hors ligne », session gardée dans le stockage', !etat2.login && /hors ligne/.test(etat2.lbl) && stockee, j({ etat2, duree, stockee, requetes: vus.length }));
  ouvert = true; const v0 = vus.length;
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  let fin = null;
  for (let i = 0; i < 200; i++) { await p.waitForTimeout(500); fin = await p.evaluate(() => ({ sess: !!window.SESS, lbl: document.getElementById('cloudLbl').textContent, user: document.getElementById('cloudUser').textContent, login: getComputedStyle(document.getElementById('loginScreen')).display !== 'none' })); if (fin.sess) break; }
  r('AH18 — réseau revenu (événement online, puis renouvellement de la bibliothèque) : nouvel essai, session reprise sans rien taper, synchro relancée', fin.sess && !fin.login && fin.user === COMPTE.email && vus.length > v0 && errs.length === 0, j({ fin, requetesApres: vus.slice(v0, v0 + 4), errs: errs.slice(0, 2) }));
  await ctx.close();
});

await closeBrowser();
ecrireResultats('resAH.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
