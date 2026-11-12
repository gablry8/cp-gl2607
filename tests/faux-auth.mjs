// Faux serveur d'authentification Supabase (COMPTE, 12/11/2026) — docs/MISSION-COMPTE.md § 5.1.
// Imite les RÉPONSES de supabase-js 2.117.3 embarqué (vendor/), relues dans la bibliothèque : chaque appel REND {data, error} (jamais de rejet),
// une coupure réseau rend une AuthRetryableFetchError (status 0), une erreur du serveur une AuthApiError (status HTTP + code).
// Deux moitiés :
//  - serveurAuth() côté Node : compte, sessions (une par appareil), facteurs TOTP, défis, code de ré-authentification « envoyé », journal des appels ;
//  - FAUX_AUTH_PAGE côté page (posé par banc-appareils.mjs avant le chargement de l'appli) : stockage de la session, événements
//    onAuthStateChange (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED) aux mêmes moments que la bibliothèque,
//    getAuthenticatorAssuranceLevel LOCAL (aucun appel au serveur), listFactors par le « réseau ».
// Heure : celle du serveur simulé (REF.horloge + décalage réglé par le test), JAMAIS Date.now() de la machine (règle 9).
// Le code TOTP est calculé par totp() ci-dessous (RFC 6238) à partir d'un secret de TEST PUBLIC (graine de l'annexe B de la RFC 6238) : ce n'est pas un secret réel.
// Compte fictif (adresse en .invalid). Aucun réseau.
import crypto from 'crypto';

/* ---------------- TOTP (RFC 6238 : HMAC-SHA1, pas de 30 s) ---------------- */
export const SECRET_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // « 12345678901234567890 » en base32 (RFC 6238, annexe B) : secret de test public
export function base32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = [];
  for (const ch of String(s).replace(/=+$/, '').toUpperCase()) { const i = A.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totp(secretB32, ms, chiffres = 6, pas = 30) {
  const t = Math.floor(ms / 1000 / pas); const b = Buffer.alloc(8); b.writeUInt32BE(Math.floor(t / 2 ** 32), 0); b.writeUInt32BE(t >>> 0, 4);
  const h = crypto.createHmac('sha1', base32(secretB32)).update(b).digest(); const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** chiffres).padStart(chiffres, '0');
}
/* vecteurs de l'annexe B (8 chiffres) : test du test, gardé dans la suite AH */
export const VECTEURS_RFC = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];

/* ---------------- jetons (format JWT, NON signés : la page les décode comme la bibliothèque) ---------------- */
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
export function jeton(charge) { return b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u(charge) + '.signature-essai'; }

const err = (status, code, message, extra) => Object.assign({ name: 'AuthApiError', status, code, message, __isAuthError: true }, extra || {});
const copie = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function serveurAuth(o = {}) {
  const t0 = Date.parse(o.horloge || '2026-10-20T10:00:00+02:00');
  const AU = {
    compte: { id: o.id || 'u-essai-gab', email: o.email || 'essai@exemple.invalid', mdp: o.mdp || 'mot-de-passe-essai' },
    facteurs: [],           // {id, friendly_name, factor_type:'totp', status:'unverified'|'verified', secret, created_at}
    sessions: {},           // sid -> {sid, dev, aal, amr, revoquee, rt, cree}
    defis: {},              // id -> {fid, exp}
    nonce: null,            // code de ré-authentification « envoyé par e-mail » (lisible par le test)
    options: { mdpActuelExige: true, reauthExigee: false, longueurMin: 12, codeMdpActuelFaux: 'current_password_mismatch' },
    erreurs: {},            // méthode -> [erreur à rendre au prochain appel]
    appels: [],             // {dev, m, a} : le test lit les corps envoyés (données d'essai uniquement)
    decalage: 0,            // ms ajoutées à l'heure du serveur simulé
    exigerJeton: false,     // vrai : les données (état, registre) sont refusées sans jeton, comme pour un visiteur non connecté (P6)
    n: 0,
  };
  AU.maintenant = () => t0 + AU.decalage;
  AU.secretSuivant = o.secret || SECRET_RFC;
  const factPub = (f) => ({ id: f.id, friendly_name: f.friendly_name, factor_type: f.factor_type, status: f.status, created_at: f.created_at, updated_at: f.created_at });
  const user = () => ({ id: AU.compte.id, aud: 'authenticated', role: 'authenticated', email: AU.compte.email, factors: AU.facteurs.map(factPub) });
  function session(s) {
    const exp = Math.floor(AU.maintenant() / 1000) + 3600;
    const at = jeton({ sub: AU.compte.id, email: AU.compte.email, role: 'authenticated', aal: s.aal, amr: s.amr, session_id: s.sid, exp, iat: exp - 3600 });
    return { access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: s.rt, user: user() };
  }
  AU.ouvrirSession = (dev, aal) => {
    const sid = 's' + (++AU.n); const s = { sid, dev, aal: aal || 'aal1', amr: [{ method: 'password', timestamp: Math.floor(AU.maintenant() / 1000) }], revoquee: false, rt: 'r-' + sid + '-1', cree: AU.maintenant() };
    AU.sessions[sid] = s; return session(s);
  };
  const sid = (j) => { try { return JSON.parse(Buffer.from(String(j).split('.')[1], 'base64').toString()).session_id; } catch (e) { return null; } };
  const sessionDe = (j) => { const s = AU.sessions[sid(j)]; return s && !s.revoquee ? s : null; };
  AU.sessionsActives = (dev) => Object.values(AU.sessions).filter((s) => !s.revoquee && (!dev || s.dev === dev));
  AU.injecter = (m, e) => { (AU.erreurs[m] = AU.erreurs[m] || []).push(e); };
  AU.erreur = err;
  AU.codeOk = (f, code) => { const t = AU.maintenant(); return [-30000, 0, 30000].some((d) => totp(f.secret, t + d) === String(code)); };

  AU.appel = (dev, m, a = {}, jt) => {
    AU.appels.push({ dev, m, a: copie(a) });
    const inj = AU.erreurs[m] && AU.erreurs[m].shift(); if (inj) return { error: inj };
    const s = sessionDe(jt);
    switch (m) {
      case 'signInWithPassword': {
        if (a.email !== AU.compte.email || a.password !== AU.compte.mdp) return { error: err(400, 'invalid_credentials', 'Invalid login credentials') };
        return { session: AU.ouvrirSession(dev, 'aal1') };
      }
      case 'refresh': {
        const x = Object.values(AU.sessions).find((y) => y.rt === a.refresh_token);
        if (!x || x.revoquee) return { error: err(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found') };
        if (!AU.facteurs.some((f) => f.status === 'verified')) x.aal = 'aal1'; // facteur retiré : le niveau redescend au renouvellement (doc)
        x.rt = 'r-' + x.sid + '-' + (++AU.n); return { session: session(x) };
      }
      case 'getUser': { if (!s) return { error: err(403, 'session_not_found', 'Session from session_id claim in JWT does not exist') }; return { data: { user: user() } }; }
      case 'updateUser': {
        if (!s) return { error: err(403, 'session_not_found', 'Session from session_id claim in JWT does not exist') };
        const v = AU.facteurs.some((f) => f.status === 'verified');
        if (v && s.aal !== 'aal2') return { error: err(403, 'insufficient_aal', 'AAL2 session is required to update email or password when MFA is enabled.') };
        if (a.password != null) {
          if (AU.options.reauthExigee) {
            if (!a.nonce) return { error: err(400, 'reauthentication_needed', 'Password update requires reauthentication') };
            if (a.nonce !== AU.nonce) return { error: err(400, 'reauthentication_not_valid', 'Verification code not found or expired') };
          }
          if (AU.options.mdpActuelExige && a.current_password !== AU.compte.mdp) return { error: err(400, AU.options.codeMdpActuelFaux, 'Current password is incorrect') };
          if (a.password === AU.compte.mdp) return { error: err(422, 'same_password', 'New password should be different from the old password.') };
          if (Array.from(a.password).length < AU.options.longueurMin) return { error: err(422, 'weak_password', 'Password should be at least ' + AU.options.longueurMin + ' characters.', { name: 'AuthWeakPasswordError', reasons: ['length'] }) };
          AU.compte.mdp = a.password; AU.nonce = null;
        }
        return { data: { user: user() } };
      }
      case 'reauthenticate': { if (!s) return { error: err(403, 'session_not_found', 'Session not found') }; AU.nonce = String(100000 + (++AU.n * 7919) % 900000); return { data: { user: null, session: null } }; }
      case 'signOut': {
        const scope = a.scope || 'global';
        if (!s) return { error: null }; // 401 / 403 / 404 ignorées par la bibliothèque
        Object.values(AU.sessions).forEach((x) => { if (scope === 'global' || (scope === 'local' && x === s) || (scope === 'others' && x !== s)) x.revoquee = true; });
        return { error: null };
      }
      case 'enroll': {
        if (!s) return { error: err(403, 'session_not_found', 'Session not found') };
        if (a.factorType !== 'totp') return { error: err(422, 'validation_failed', 'invalid factor type') };
        if (AU.facteurs.length >= 10) return { error: err(422, 'too_many_enrolled_mfa_factors', 'Maximum number of verified factors reached, unenroll to continue') };
        if (AU.facteurs.some((f) => f.status === 'verified') && s.aal !== 'aal2') return { error: err(403, 'insufficient_aal', 'AAL2 required to enroll a new factor') };
        if (AU.facteurs.some((f) => f.friendly_name === a.friendlyName)) return { error: err(422, 'mfa_factor_name_conflict', 'A factor with the friendly name "' + a.friendlyName + '" for this user already exists') };
        const f = { id: 'f' + (++AU.n) + '-0000-4000-8000-essai', friendly_name: a.friendlyName, factor_type: 'totp', status: 'unverified', secret: AU.secretSuivant, created_at: new Date(AU.maintenant()).toISOString() };
        AU.facteurs.push(f);
        const uri = 'otpauth://totp/' + encodeURIComponent(a.issuer || 'ClimPilot') + ':' + encodeURIComponent(AU.compte.email) + '?algorithm=SHA1&digits=6&issuer=' + encodeURIComponent(a.issuer || 'ClimPilot') + '&period=30&secret=' + f.secret;
        return { data: { id: f.id, type: 'totp', friendly_name: f.friendly_name, totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>', secret: f.secret, uri } } };
      }
      case 'challenge': {
        if (!s) return { error: err(403, 'session_not_found', 'Session not found') };
        const f = AU.facteurs.find((x) => x.id === a.factorId); if (!f) return { error: err(404, 'mfa_factor_not_found', 'Factor not found') };
        const id = 'c' + (++AU.n); AU.defis[id] = { fid: f.id, exp: AU.maintenant() + 300000 };
        return { data: { id, type: 'totp', expires_at: Math.floor(AU.defis[id].exp / 1000) } };
      }
      case 'verify': {
        if (!s) return { error: err(403, 'session_not_found', 'Session not found') };
        const d = AU.defis[a.challengeId], f = AU.facteurs.find((x) => x.id === a.factorId);
        if (!f) return { error: err(404, 'mfa_factor_not_found', 'Factor not found') };
        if (!d || d.fid !== f.id || AU.maintenant() > d.exp) return { error: err(400, 'mfa_challenge_expired', 'MFA challenge has expired, verify against another challenge or create a new challenge.') };
        delete AU.defis[a.challengeId];
        if (!AU.codeOk(f, a.code)) return { error: err(422, 'mfa_verification_failed', 'Invalid TOTP code entered') };
        const inscription = f.status !== 'verified'; f.status = 'verified';
        s.aal = 'aal2'; s.amr = [{ method: 'totp', timestamp: Math.floor(AU.maintenant() / 1000) }].concat(s.amr.filter((x) => x.method !== 'totp'));
        if (inscription) Object.values(AU.sessions).forEach((x) => { if (x !== s) x.revoquee = true; }); // doc : « all other sessions are logged out »
        s.rt = 'r-' + s.sid + '-' + (++AU.n); return { session: session(s) };
      }
      case 'unenroll': {
        if (!s) return { error: err(403, 'session_not_found', 'Session not found') };
        const f = AU.facteurs.find((x) => x.id === a.factorId); if (!f) return { error: err(404, 'mfa_factor_not_found', 'Factor not found') };
        if (f.status === 'verified' && s.aal !== 'aal2') return { error: err(403, 'insufficient_aal', 'AAL2 required to unenroll verified factor') };
        AU.facteurs = AU.facteurs.filter((x) => x !== f); return { data: { id: f.id } };
      }
      default: return { error: err(404, 'not_found', 'méthode inconnue du faux serveur : ' + m) };
    }
  };
  return AU;
}

/* ---------------- moitié « page » : posée par addInitScript AVANT l'appli (fonction autonome, sans référence au module) ---------------- */
export function FAUX_AUTH_PAGE(arg) {
  const DEV = arg.dev, CLE = '__essai_session';
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } };
  const ecrire = (s) => { try { localStorage.setItem(CLE, JSON.stringify(s)); } catch (e) { console.warn('faux-auth : stockage', e); } };
  const ecouteurs = new Map(); let nId = 0;
  const notifier = (ev, s) => { ecouteurs.forEach((cb) => { try { cb(ev, s); } catch (e) { console.error('faux-auth : écouteur', e); } }); };
  const retirer = () => { localStorage.removeItem(CLE); notifier('SIGNED_OUT', null); };
  const reseau = { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' };
  const manque = { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' };
  /* appel au serveur simulé : coupure → erreur réessayable RENDUE (supabase-js ne rejette pas) */
  const srv = async (m, a) => { const s = lire(); const r = await window.__srvCommun(DEV, 'auth', m, a, s && s.access_token); return r && r.rejet ? { error: reseau } : r; };
  const charge = (s) => { try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } };
  const expiree = (s) => !!(s && s.expires_at && s.expires_at * 1000 - Date.now() < 90000);
  async function renouveler(s) {
    const r = await srv('refresh', { refresh_token: s.refresh_token });
    if (r.error) { if (r.error.status !== 0) retirer(); return { error: r.error }; }
    ecrire(r.session); notifier('TOKEN_REFRESHED', r.session); return { session: r.session };
  }
  const auth = {
    async getSession() {
      const s = lire(); if (!s) return { data: { session: null }, error: null };
      if (!expiree(s)) return { data: { session: s }, error: null };
      const r = await renouveler(s); return r.error ? { data: { session: null }, error: r.error } : { data: { session: r.session }, error: null };
    },
    async getUser() { const s = lire(); if (!s) return { data: { user: null }, error: manque }; const r = await srv('getUser', {}); return r.error ? { data: { user: null }, error: r.error } : { data: r.data, error: null }; },
    async signInWithPassword({ email, password }) {
      const r = await srv('signInWithPassword', { email, password });
      if (r.error) return { data: { user: null, session: null }, error: r.error };
      ecrire(r.session); notifier('SIGNED_IN', r.session); return { data: { user: r.session.user, session: r.session }, error: null };
    },
    async signOut(o) {
      const scope = (o && o.scope) || 'global'; const s = lire();
      let e = null; if (s) { const r = await srv('signOut', { scope }); e = r.error || null; }
      if (scope !== 'others') retirer();
      return { error: e };
    },
    async updateUser(attrs) {
      const s = lire(); if (!s) return { data: { user: null }, error: manque };
      const r = await srv('updateUser', attrs); if (r.error) return { data: { user: null }, error: r.error };
      s.user = r.data.user; ecrire(s); notifier('USER_UPDATED', s); return { data: { user: s.user }, error: null };
    },
    async reauthenticate() { const s = lire(); if (!s) return { data: { user: null, session: null }, error: manque }; const r = await srv('reauthenticate', {}); return { data: { user: null, session: null }, error: r.error || null }; },
    async refreshSession() {
      const s = lire(); if (!s) return { data: { user: null, session: null }, error: manque };
      const r = await renouveler(s); return r.error ? { data: { user: null, session: null }, error: r.error } : { data: { user: r.session.user, session: r.session }, error: null };
    },
    onAuthStateChange(cb) {
      const id = ++nId; ecouteurs.set(id, cb);
      setTimeout(() => { try { cb('INITIAL_SESSION', lire()); } catch (e) { console.error('faux-auth : INITIAL_SESSION', e); } }, 0);
      return { data: { subscription: { id, unsubscribe() { ecouteurs.delete(id); } } } };
    },
    mfa: {
      async enroll(p) { if (!lire()) return { data: null, error: manque }; const r = await srv('enroll', p); return r.error ? { data: null, error: r.error } : { data: r.data, error: null }; },
      async challenge(p) { if (!lire()) return { data: null, error: manque }; const r = await srv('challenge', p); return r.error ? { data: null, error: r.error } : { data: r.data, error: null }; },
      async verify(p) {
        if (!lire()) return { data: null, error: manque }; const r = await srv('verify', p); if (r.error) return { data: null, error: r.error };
        ecrire(r.session); notifier('MFA_CHALLENGE_VERIFIED', r.session); return { data: r.session, error: null };
      },
      async challengeAndVerify(p) { const c = await auth.mfa.challenge({ factorId: p.factorId }); if (c.error) return { data: null, error: c.error }; return auth.mfa.verify({ factorId: p.factorId, challengeId: c.data.id, code: p.code }); },
      async unenroll(p) { if (!lire()) return { data: null, error: manque }; const r = await srv('unenroll', p); return r.error ? { data: null, error: r.error } : { data: r.data, error: null }; },
      async listFactors() {
        const u = await auth.getUser(); if (u.error) return { data: null, error: u.error };
        const L = { all: [], phone: [], totp: [], webauthn: [], recovery_code: [] };
        (u.data.user.factors || []).forEach((f) => { L.all.push(f); if (f.status === 'verified' && Array.isArray(L[f.factor_type])) L[f.factor_type].push(f); });
        return { data: L, error: null };
      },
      /* LOCAL, comme la bibliothèque sans argument : jeton + session.user.factors, aucun appel au serveur */
      async getAuthenticatorAssuranceLevel() {
        window.__fauxAalLocal = (window.__fauxAalLocal || 0) + 1;
        const s = lire(); if (!s) return { data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: null };
        const c = charge(s), cur = c.aal || null; const nx = ((s.user && s.user.factors) || []).some((f) => f.status === 'verified') ? 'aal2' : cur;
        return { data: { currentLevel: cur, nextLevel: nx, currentAuthenticationMethods: c.amr || [] }, error: null };
      },
    },
  };
  window.__fauxAuth = auth;
  window.__fauxAuthJeton = () => { const s = lire(); return s && s.access_token; };
  /* renouvellement du jeton à la demande du test (la bibliothèque le fait seule toutes les 30 s) : session révoquée → effacée + SIGNED_OUT */
  window.__fauxAuthRenouveler = async () => { const s = lire(); if (!s) return 'aucune'; const r = await renouveler(s); return r.error ? (r.error.status === 0 ? 'reseau' : 'refus') : 'ok'; };
  /* jeton expiré (appli fermée plus d'une heure) : le prochain getSession devra le renouveler */
  window.__fauxAuthExpirer = () => { const s = lire(); if (s) { s.expires_at = Math.floor(Date.now() / 1000) - 60; ecrire(s); } };
}
