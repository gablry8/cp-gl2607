/**
 * ClimPilot — synchro Google Agenda ⇄ ClimPilot, toutes les 15 minutes (20/10/2026, PRÉPARÉ, pas encore installé).
 * Ne transmet QUE des demi-journées occupées (date + matin / après-midi) : aucun titre, aucun nom, aucune adresse.
 *
 *  1. Google → ClimPilot : les moments pris dans ton agenda Google (rendez-vous perso, école…) sont envoyés
 *     à la fonction « agenda ». Le site ne les propose plus et ClimPilot les affiche au planning.
 *  2. ClimPilot → Google : les demi-journées prises dans ClimPilot sont recopiées dans un agenda séparé
 *     « ClimPilot (occupé) », que tu vois sur ton téléphone à côté de ton agenda habituel.
 *
 * Installation (voir docs/AGENDA.md) : script.google.com > Nouveau projet > coller ce fichier >
 *   Paramètres du projet > Propriétés du script :
 *     AGENDA_URL  = https://<projet>.supabase.co/functions/v1/agenda
 *     AGENDA_CLE  = la même clé que le secret AGENDA_CLE de la fonction (au moins 24 caractères)
 *     AGENDAS_LUS = facultatif : identifiants des agendas Google à lire, séparés par des virgules (défaut : agenda principal)
 *   puis exécuter une fois la fonction « installer » et accepter les autorisations Google.
 */
var JOURS = 60;                       // fenêtre synchronisée (comme ClimPilot)
var MATIN = [7, 12.5];                // de 7 h à 12 h 30 = matin
var APRES_MIDI = [12.5, 19];          // de 12 h 30 à 19 h = après-midi (le soir ne bloque pas le site)
var NOM_AGENDA = 'ClimPilot (occupé)';
var MARQUE = 'cp-agenda';             // repère des événements créés par ce script (jamais relus comme « pris »)

function installer() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'synchroniser') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('synchroniser').timeBased().everyMinutes(15).create();
  synchroniser();
}

function synchroniser() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('AGENDA_URL'), cle = p.getProperty('AGENDA_CLE');
  if (!url || !cle) throw new Error('Réglages manquants : AGENDA_URL et AGENDA_CLE (Paramètres du projet > Propriétés du script)');
  var tz = Session.getScriptTimeZone();
  var debut = new Date(); debut.setHours(0, 0, 0, 0);
  var fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + JOURS); // calendrier, pas millisecondes (heure d'hiver)
  var cp = agendaClimPilot_();

  /* 1. Google → ClimPilot */
  var ids = String(p.getProperty('AGENDAS_LUS') || '').split(',').map(function (s) { return s.trim(); }).filter(String);
  var agendas = ids.length ? ids.map(function (id) { return CalendarApp.getCalendarById(id); }).filter(Boolean) : [CalendarApp.getDefaultCalendar()];
  var pris = {};
  agendas.forEach(function (cal) {
    if (cal.getId() === cp.getId()) return;
    cal.getEvents(debut, fin).forEach(function (ev) {
      if (String(ev.getDescription() || '').indexOf(MARQUE) >= 0) return;                          // créé par ce script
      try { if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; } catch (e) {} // invitation refusée
      try { if (ev.getTransparency && ev.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) return; } catch (e) {} // « disponible »
      marquer_(pris, ev, tz);
    });
  });
  var jours = Object.keys(pris).sort().map(function (j) { return { jour: j, matin: !!pris[j].m, apresmidi: !!pris[j].a }; });
  var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: { 'x-agenda-cle': cle }, muteHttpExceptions: true,
    payload: JSON.stringify({ du: jourDe_(debut, tz), au: jourDe_(new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 1), tz), jours: jours }) });
  if (r.getResponseCode() !== 200) console.warn('Google → ClimPilot : réponse ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));

  /* 2. ClimPilot → Google (agenda séparé) */
  var o = UrlFetchApp.fetch(url + '?occupations=1', { headers: { 'x-agenda-cle': cle }, muteHttpExceptions: true });
  if (o.getResponseCode() !== 200) { console.warn('ClimPilot → Google : réponse ' + o.getResponseCode()); return; }
  var occ = (JSON.parse(o.getContentText()).jours || []);
  recopier_(cp, occ, debut, fin, tz);
}

/* demi-journées touchées par un événement */
function marquer_(pris, ev, tz) {
  var d = new Date(ev.getStartTime()), f = new Date(ev.getEndTime());
  if (ev.isAllDayEvent()) {
    for (var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x < f; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) { pris[jourDe_(x, tz)] = { m: true, a: true }; }
    return;
  }
  for (var y = new Date(d.getFullYear(), d.getMonth(), d.getDate()); y < f; y = new Date(y.getFullYear(), y.getMonth(), y.getDate() + 1)) {
    var j2 = jourDe_(y, tz), h0 = heure_(d, y), h1 = heure_(f, y);
    var deb = Math.max(0, h0), fi = Math.min(24, h1);
    var e = pris[j2] || { m: false, a: false };
    if (deb < MATIN[1] && fi > MATIN[0]) e.m = true;
    if (deb < APRES_MIDI[1] && fi > APRES_MIDI[0]) e.a = true;
    if (e.m || e.a) pris[j2] = e;
  }
}
function heure_(t, jour) { return (t.getTime() - jour.getTime()) / 36e5; }
function jourDe_(d, tz) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }

/* agenda « ClimPilot (occupé) » : créé au premier passage */
function agendaClimPilot_() {
  var l = CalendarApp.getCalendarsByName(NOM_AGENDA);
  return l.length ? l[0] : CalendarApp.createCalendar(NOM_AGENDA, { summary: 'Demi-journées prises dans ClimPilot (recopiées automatiquement)' });
}

/* recopie idempotente : un événement par demi-journée (ou journée) prise ; ceux qui ne sont plus pris sont retirés */
function recopier_(cal, occ, debut, fin, tz) {
  var voulu = {};
  occ.forEach(function (o) {
    if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(o.jour)) return;
    var type = o.matin && o.apresmidi ? 'journee' : o.matin ? 'matin' : o.apresmidi ? 'apresmidi' : '';
    if (type) voulu[MARQUE + ':' + o.jour + ':' + type] = { jour: o.jour, type: type };
  });
  cal.getEvents(debut, fin).forEach(function (ev) {
    var k = String(ev.getDescription() || '');
    if (k.indexOf(MARQUE) !== 0) return;
    if (voulu[k]) delete voulu[k]; else ev.deleteEvent();
  });
  Object.keys(voulu).forEach(function (k) {
    var v = voulu[k], h = { journee: [8, 0, 18, 0, 'journée'], matin: [8, 0, 12, 0, 'matin'], apresmidi: [13, 30, 18, 0, 'après-midi'] }[v.type];
    var a = v.jour.split('-').map(Number);
    cal.createEvent('ClimPilot — occupé (' + h[4] + ')', new Date(a[0], a[1] - 1, a[2], h[0], h[1]), new Date(a[0], a[1] - 1, a[2], h[2], h[3]), { description: k });
  });
}
