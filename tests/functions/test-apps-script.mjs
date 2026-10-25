// Test du script Google Agenda (tools/apps-script/ClimPilot-Agenda.gs) avec un faux Google (agendas, réseau) en mémoire.
// Lancement : node tests/functions/test-apps-script.mjs
process.env.TZ = 'Europe/Paris';
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(ICI, '../../tools/apps-script/ClimPilot-Agenda.gs'), 'utf8');
const R = []; const rec = (n, ok, d) => R.push([ok === true ? 'PASS' : 'FAIL', n, ok === true ? '' : JSON.stringify(d)]);

function faux(occupations, evPrincipal) {
  const envois = [], logs = [];
  const mkCal = (id, evs) => ({ id, evs, getId() { return id; },
    getEvents(a, b) { return evs.filter((e) => e.f > a && e.d < b).map(mkEv(evs)); },
    createEvent(t, d, f, o) { evs.push({ t, d, f, desc: o.description }); } });
  const mkEv = (evs) => (e) => ({ getStartTime: () => e.d, getEndTime: () => e.f, getDescription: () => e.desc || '', isAllDayEvent: () => !!e.jour,
    getMyStatus: () => e.statut || 'YES', getTransparency: () => e.dispo ? 'TRANSPARENT' : 'OPAQUE', deleteEvent: () => { evs.splice(evs.indexOf(e), 1); } });
  const principal = mkCal('principal', evPrincipal), agendas = [];
  const g = {
    console: { warn: (m) => logs.push(m), log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ({ AGENDA_URL: 'https://fn.exemple/agenda', AGENDA_CLE: 'cle-de-test-assez-longue-1234' })[k] || null }) },
    Session: { getScriptTimeZone: () => 'Europe/Paris' },
    Utilities: { formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) },
    CalendarApp: { GuestStatus: { NO: 'NO' }, EventTransparency: { TRANSPARENT: 'TRANSPARENT' },
      getDefaultCalendar: () => principal, getCalendarById: (id) => (id === 'principal' ? principal : null),
      getCalendarsByName: (n) => agendas.filter((c) => c.nom === n),
      createCalendar: (n) => { const c = mkCal('cp', []); c.nom = n; agendas.push(c); return c; } },
    UrlFetchApp: { fetch: (url, o = {}) => { envois.push({ url, o });
      const corps = /occupations=1/.test(url) ? { ok: true, jours: occupations } : { ok: true, n: 1 };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(corps) }; } },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
  };
  vm.createContext(g); vm.runInContext(SRC, g);
  return { g, envois, logs, principal, agendas };
}
const j = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const iso = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const h = (n, hh, mm = 0) => { const d = j(n); d.setHours(hh, mm); return d; };

{ // Google → ClimPilot
  const ev = [
    { t: 'Dentiste', d: h(2, 9), f: h(2, 10) },                    // matin
    { t: 'École', d: h(3, 8), f: h(3, 17) },                       // journée
    { t: 'Déjeuner', d: h(4, 12), f: h(4, 13) },                   // touche les deux (12 h 30)
    { t: 'Match', d: h(5, 20), f: h(5, 22) },                      // soir : ne bloque pas
    { t: 'Anniversaire', d: j(6), f: j(7), jour: true, dispo: true }, // journée entière « disponible » : ignorée
    { t: 'Congés', d: j(8), f: j(10), jour: true },                // 2 jours entiers occupés
    { t: 'Invitation refusée', d: h(11, 14), f: h(11, 15), statut: 'NO' },
    { t: 'ClimPilot — occupé (matin)', d: h(12, 8), f: h(12, 12), desc: 'cp-agenda:' + iso(j(12)) + ':matin' },
  ];
  const F = faux([], ev); F.g.synchroniser();
  const post = F.envois.find((e) => e.o.method === 'post'), b = JSON.parse(post.o.payload), m = Object.fromEntries(b.jours.map((x) => [x.jour, x]));
  rec('Script Google : clé envoyée en en-tête, fenêtre de 60 jours', post.o.headers['x-agenda-cle'] === 'cle-de-test-assez-longue-1234' && b.du === iso(j(0)) && b.au === iso(j(59)), b);
  rec('Script Google : rendez-vous du matin → matin pris seulement', m[iso(j(2))] && m[iso(j(2))].matin && !m[iso(j(2))].apresmidi, m[iso(j(2))]);
  rec('Script Google : journée d’école → matin et après-midi', m[iso(j(3))] && m[iso(j(3))].matin && m[iso(j(3))].apresmidi, m[iso(j(3))]);
  rec('Script Google : 12 h – 13 h touche les deux demi-journées', m[iso(j(4))] && m[iso(j(4))].matin && m[iso(j(4))].apresmidi, m[iso(j(4))]);
  rec('Script Google : le soir, « disponible », invitation refusée et événements du script ne bloquent rien', !m[iso(j(5))] && !m[iso(j(6))] && !m[iso(j(11))] && !m[iso(j(12))], Object.keys(m));
  rec('Script Google : congés sur deux jours entiers → deux journées prises', m[iso(j(8))] && m[iso(j(9))] && m[iso(j(8))].apresmidi && !m[iso(j(10))], Object.keys(m));
  { // passage à l'heure d'hiver (dernier dimanche d'octobre) : ni jour sauté ni jour compté deux fois
    const ete = new Date(2026, 9, 24), hiver = new Date(2026, 9, 27), F2 = faux([], [{ t: 'Congés', d: ete, f: hiver, jour: true }]);
    const pris = {}; F2.g.marquer_(pris, { getStartTime: () => ete, getEndTime: () => hiver, isAllDayEvent: () => true }, 'Europe/Paris');
    rec('Script Google : congés à cheval sur l’heure d’hiver → 24, 25 et 26 octobre, rien d’autre', Object.keys(pris).sort().join() === '2026-10-24,2026-10-25,2026-10-26', Object.keys(pris));
  }
  rec('Script Google : aucun titre d’événement envoyé', !/Dentiste|École|Congés|Match/.test(post.o.payload), post.o.payload.slice(0, 120));
}
{ // ClimPilot → Google : agenda séparé, recopie idempotente
  const occ = [{ jour: iso(j(2)), matin: true, apresmidi: false }, { jour: iso(j(3)), matin: true, apresmidi: true }];
  const F = faux(occ, []); F.g.synchroniser();
  const cp = F.agendas[0], t1 = cp.evs.map((e) => e.t).sort();
  rec('ClimPilot → Google : agenda « ClimPilot (occupé) » créé, un événement par moment pris', cp.nom === 'ClimPilot (occupé)' && t1.length === 2 && t1.includes('ClimPilot — occupé (matin)') && t1.includes('ClimPilot — occupé (journée)'), t1);
  F.g.synchroniser();
  rec('ClimPilot → Google : deuxième passage sans doublon', cp.evs.length === 2, cp.evs.length);
  occ.length = 0; occ.push({ jour: iso(j(3)), matin: false, apresmidi: true });
  F.g.synchroniser();
  rec('ClimPilot → Google : moment libéré retiré, moment changé remplacé', cp.evs.length === 1 && cp.evs[0].t === 'ClimPilot — occupé (après-midi)' && cp.evs[0].d.getHours() === 13, cp.evs.map((e) => e.t));
  rec('ClimPilot → Google : les événements recopiés ne repartent pas comme « pris dans Google »', JSON.parse(F.envois.filter((e) => e.o.method === 'post').pop().o.payload).jours.length === 0, '');
}
R.forEach((x) => console.log(x[0].padEnd(5), '[Script Google]', x[1], x[2] ? '— ' + x[2] : ''));
if (process.env.CP_TEST_OUT) { fs.mkdirSync(process.env.CP_TEST_OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.CP_TEST_OUT, 'resFn-apps-script.json'), JSON.stringify(R.map(([ok, name, detail]) => ({ group: 'Script Google Agenda', name, ok, detail })), null, 1)); }
if (R.some((x) => x[0] !== 'PASS')) process.exitCode = 1;
