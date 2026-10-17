/* Slepá mapa: anonymná štatistika precvičovania (úvodná stránka aplikácie).
 *
 * Patrí k tabuľke „Slepá mapa – štatistika precvičovania“ (hárky Prehľad, Objekty, Hry, Tipy).
 * Nasadenie (raz):
 *   1. V tabuľke Rozšírenia → Apps Script, celý obsah súboru Code.gs nahraď týmto súborom a ulož.
 *   2. Nasadiť → Nové nasadenie → typ Webová aplikácia. Spustiť ako: ja. Kto má prístup: ktokoľvek.
 *   3. Povoľ prístup k tabuľke a skopíruj adresu webovej aplikácie (končí na /exec).
 *   4. Adresa patrí do data/index.json ako "stats". Kým tam nie je, aplikácia nič neposiela.
 * Po zmene skriptu: Nasadiť → Spravovať nasadenia → Upraviť → Verzia: nová. Adresa ostane rovnaká.
 *
 * Ukladá sa len to, čo pošle aplikácia po dokončenom kole: čas, náhodné číslo prehliadača,
 * nastavenie kola, výsledok a tipy pri objektoch. Žiadne mená, e-maily ani IP adresy.
 */
const STATS_VERSION = '1';
const MAX_ITEMS = 60;
const SHEETS = {
  games: { name: 'Hry', head: ['Čas', 'Kolo', 'Prehliadač', 'Oblasť', 'Skupiny', 'Obtiažnosť', 'Počet objektov', 'Čas na tip (s)', 'Úspešnosť', 'Opakovanie chýb', 'Verzia aplikácie'] },
  tips: { name: 'Tipy', head: ['Čas', 'Kolo', 'Prehliadač', 'Oblasť', 'Id objektu', 'Názov', 'Typ', 'Obtiažnosť', 'Odchýlka (km)', 'Úspešnosť', 'Opakovanie chýb'] }
};

function doGet() {
  return out_({ ok: true, app: 'slepa-mapa-stats', v: STATS_VERSION });
}

function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  if (!d || d.a !== 'practice' || !Array.isArray(d.items) || !d.items.length) return out_({ ok: false, error: 'bad_request' });
  const game = txt_(d.game, 24), cache = CacheService.getScriptCache();
  if (game && cache.get('g:' + game)) return out_({ ok: true, dup: true });   // to isté kolo poslané druhýkrát
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return out_({ ok: false, error: 'busy' });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), now = new Date();
    const id = game || Utilities.getUuid().slice(0, 8), dev = txt_(d.dev, 24), region = txt_(d.region, 40), rep = d.repeat ? 'áno' : 'nie';
    const items = d.items.slice(0, MAX_ITEMS);
    append_(sheet_(ss, SHEETS.games), [[now, id, dev, region, txt_(d.groups, 160), txt_(d.diff, 10), items.length, num_(d.time, 0, 600), num_(d.pct, 0, 1), rep, txt_(d.v, 12)]]);
    append_(sheet_(ss, SHEETS.tips), items.map(function (it) {
      it = it || {};
      return [now, id, dev, region, txt_(it.id, 80), txt_(it.name, 160), txt_(it.type, 60), num_(it.diff, 1, 5),
        it.km === null || it.km === undefined || it.km === '' ? '' : num_(it.km, 0, 40000), num_(it.pct, 0, 1), rep];
    }));
    if (game) cache.put('g:' + game, '1', 21600);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: 'server', msg: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet_(ss, def) {
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function append_(sh, rows) {
  if (!rows.length) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
// Text do bunky: skrátený a bez možnosti vložiť vzorec (=, +, -, @ na začiatku).
function txt_(v, max) {
  let s = String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 100);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num_(v, min, max) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !isFinite(n)) return '';
  return Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
