/**
 * Slepá mapa, verzia 2.1: skript tabuľky učiteľa (Google Apps Script).
 *
 * Aplikácia beží na GitHub Pages (APP_URL). Tento skript je len most k tabuľke učiteľa:
 * číta zoznam žiakov, ukladá testy a zapisuje výsledky. Údaje žiakov ostávajú v tabuľke učiteľa.
 *
 * Nasadenie: Nasadiť > Nové nasadenie > Webová aplikácia, spustiť ako „Ja", prístup „Ktokoľvek".
 * Po úprave kódu: Nasadiť > Spravovať nasadenia > ceruzka > Verzia: Nová verzia > Nasadiť (adresa ostane rovnaká).
 */
const VERSION = '2.2';
const APP_URL = 'https://samocief.github.io/blindmap/';

const SH = { pupils: ['Žiaci', 'Ziaci', 'Pupils', 'Students'], custom: ['Vlastné objekty', 'Custom objects'], tests: 'Testy', packs: '_balíky' };
const PUPIL_HEAD = ['Trieda', 'Meno', 'Aktívny'];
const CUSTOM_HEAD = ['Názov', 'Typ', 'Oblasť', 'Obtiažnosť', 'Súradnice'];
const TEST_HEAD = ['id testu', 'vytvorený', 'trieda', 'oblasť', 'typy objektov', 'obtiažnosť', 'počet objektov', 'čas na tip (s)', 'stav',
  '100 % do (km)', '0 % od (km)', 'uhlopriečka mapy (km)', 'objekty', 'id objektov', 'názov', 'jazyk', 'mapa', 'režim'];
const RES_FIXED = ['odoslané', 'žiak', 'výsledok (%)'];
const RES_TAIL = ['tipy (šírka, dĺžka)', 'príznak'];
const STATE = { ready: 'pripravený', open: 'otvorený', closed: 'uzavretý' };
const MODE = { cls: 'trieda', open: 'externí' };   // externí: bez zoznamu, každý hráč si napíše meno
const OPEN_CLASS = 'Externí';
const TEACHER = 'Učiteľ';                        // jedno meno navyše v každej triede, nepočíta sa do priemeru
const ABSENT = 'neprítomný';
const DOZOR_OK = { tTest: 1, tSetTest: 1, tUnlock: 1, tAbsent: 1 };   // čo smie odkaz pre dozor (len jeden test)
const WHY = { none: 'bez tipu', leave: 'odchod', ended: 'ukončené' };
const CHUNK = 40000;

// ===== GEO: rovnaké výpočty ako v js/geo.js aplikácie =====
var RAD = Math.PI / 180, R_EARTH = 6371.0088, KM_DEG = R_EARTH * RAD;
function hav(a, b) {
  var dl = (b[0] - a[0]) * RAD, df = (b[1] - a[1]) * RAD;
  var h = Math.pow(Math.sin(df / 2), 2) + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.pow(Math.sin(dl / 2), 2);
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
function inRing(c, r) {
  var ins = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    var a = r[i], b = r[j];
    if ((a[1] > c[1]) !== (b[1] > c[1]) && c[0] < (b[0] - a[0]) * (c[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
function inPoly(c, poly) {
  if (!poly.length || !inRing(c, poly[0])) return false;
  for (var i = 1; i < poly.length; i++) if (inRing(c, poly[i])) return false;
  return true;
}
function wrapLon(d) { return d > 180 ? d - 360 : d < -180 ? d + 360 : d; }
function nearestOnPath(c, pts, best) {
  var k = Math.cos(c[1] * RAD) * KM_DEG;
  for (var i = 1; i < pts.length; i++) {
    var ax = wrapLon(pts[i - 1][0] - c[0]) * k, ay = (pts[i - 1][1] - c[1]) * KM_DEG;
    var bx = wrapLon(pts[i][0] - c[0]) * k, by = (pts[i][1] - c[1]) * KM_DEG;
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    var x = ax + t * dx, y = ay + t * dy, d2 = x * x + y * y;
    if (d2 < best.d2) { best.d2 = d2; best.near = [c[0] + x / k, c[1] + y / KM_DEG]; }
  }
  if (pts.length === 1) {
    var d = hav(c, pts[0]);
    if (d * d < best.d2) { best.d2 = d * d; best.near = pts[0]; }
  }
  return best;
}
function measure(g, c) {
  var d, near;
  if (g.t === 'pt') { near = g.c; d = hav(c, near); }
  else {
    var best = { d2: Infinity, near: null }, i, j;
    if (g.t === 'area') {
      for (i = 0; i < g.c.length; i++) if (inPoly(c, g.c[i])) return { d: 0, near: c };
      for (i = 0; i < g.c.length; i++) for (j = 0; j < g.c[i].length; j++) nearestOnPath(c, g.c[i][j], best);
    } else {
      for (i = 0; i < g.c.length; i++) nearestOnPath(c, g.c[i], best);
    }
    if (!best.near) return { d: 0, near: c };
    near = best.near; d = hav(c, near);
  }
  return { d: d, near: near };
}
// Rovnaká krivka ako v js/geo.js: kvadratická, PCT_POW = 1 by bolo lineárne.
var PCT_POW = 2;
function pctFor(d, full, zero) {
  if (d === null || d === undefined || d === '' || isNaN(d)) return 0;
  if (d <= full) return 1;
  if (d >= zero) return 0;
  return Math.pow((zero - d) / (zero - full), PCT_POW);
}
function round1(x) { return Math.round(x * 10) / 10; }
function normName(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`´.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
// ===== /GEO =====

/* ---------- pomocné ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return ss_().getSpreadsheetTimeZone() || 'Europe/Bratislava'; }
function now_(fmt) { return Utilities.formatDate(new Date(), tz_(), fmt || 'yyyy-MM-dd HH:mm:ss'); }
function s_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm');
  return String(v).trim();
}
function num_(v) { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
function yes_(v) { const n = normName(v); return !(n === 'nie' || n === 'no' || n === 'false' || n === '0' || n === 'n'); }
function fail_(code, msg) { throw new Error('E:' + code + (msg ? '|' + msg : '')); }
function props_() { return PropertiesService.getScriptProperties(); }
function cache_() { return CacheService.getScriptCache(); }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) fail_('busy');
  try { return fn(); } finally { lock.releaseLock(); }
}
function sheetByNames_(names) { for (let i = 0; i < names.length; i++) { const sh = ss_().getSheetByName(names[i]); if (sh) return sh; } return null; }

// Hárok ako tabuľka: hlavička v prvom riadku, stĺpce sa hľadajú podľa začiatku názvu (bez diakritiky, aj viac možných názvov).
function tableOf_(sheet, label) {
  const vals = sheet.getDataRange().getValues();
  const head = (vals[0] || []).map(function (h) { return normName(h); });
  return {
    sheet: sheet, head: head, rows: vals.slice(1), label: label || sheet.getName(),
    col: function (prefixes) {
      prefixes = [].concat(prefixes);
      for (let p = 0; p < prefixes.length; p++) { const n = normName(prefixes[p]); for (let i = 0; i < head.length; i++) if (head[i] && head[i].indexOf(n) === 0) return i; }
      return -1;
    },
    need: function (prefixes) { const i = this.col(prefixes); if (i < 0) fail_('no_col', this.label + ': ' + [].concat(prefixes)[0]); return i; }
  };
}
function ensureSheet_(name, head, hidden) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name, ss_().getSheets().length);
    if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#d9d9d9');
    sh.setFrozenRows(1);
    if (hidden) sh.hideSheet();
  }
  return sh;
}
// Doplní stĺpce, ktoré pribudli v novšej verzii, na koniec hlavičky existujúceho hárka.
function ensureCols_(sh, head) {
  const last = Math.max(1, sh.getLastColumn());
  const have = sh.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return normName(h); });
  const miss = head.filter(function (h) { return have.indexOf(normName(h)) < 0; });
  if (!miss.length) return;
  const at = sh.getLastColumn() + 1;
  if (sh.getMaxColumns() < at + miss.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), at + miss.length - 1 - sh.getMaxColumns());
  sh.getRange(1, at, 1, miss.length).setValues([miss]).setFontWeight('bold').setBackground('#d9d9d9');
}
function ensureBaseSheets_() {
  if (!sheetByNames_(SH.pupils)) ensureSheet_(SH.pupils[0], PUPIL_HEAD);
  if (!sheetByNames_(SH.custom)) ensureSheet_(SH.custom[0], CUSTOM_HEAD);
}
// Kľúč a adresa sa ukladajú spolu s id tabuľky: v kópii tabuľky (iný učiteľ) neplatia a vytvoria sa nové.
function ownProp_(name) {
  const v = props_().getProperty(name);
  if (!v) return '';
  try { const o = JSON.parse(v); return o && o.ss === ss_().getId() ? String(o.v || '') : ''; } catch (e) { return ''; }
}
function setOwnProp_(name, v) { props_().setProperty(name, JSON.stringify({ ss: ss_().getId(), v: v })); }
function teacherKey_() {
  let k = ownProp_('TKEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); setOwnProp_('TKEY', k); }
  return k;
}
function auth_(req) { if (!req.k || req.k !== teacherKey_()) fail_('auth'); }
// Kľúč dozoru platí len pre jeden test a len na prehľad, spustenie, uzavretie, odomknutie a neprítomných.
function dozorKey_(testId) {
  const sig = Utilities.computeHmacSha256Signature('dozor|' + testId, teacherKey_());
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 16);
}
function dozorAuth_(req) {
  if (!DOZOR_OK[req.a] || !req.t || String(req.dk) !== dozorKey_(String(req.t))) fail_('auth');
  req.dozor = true;
}

/* ---------- vstupné body ---------- */
function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out_({ error: 'bad_request' }); }
  return out_(handle_(req));
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.q) { let req; try { req = JSON.parse(p.q); } catch (x) { return out_({ error: 'bad_request' }); } return out_(handle_(req)); }
  return HtmlService.createHtmlOutput('<p style="font:16px sans-serif">Toto je skript tabuľky pre aplikáciu Slepá mapa (verzia ' + VERSION + '). ' +
    'Aplikácia beží na <a href="' + APP_URL + '">' + APP_URL + '</a>.</p>').setTitle('Slepá mapa');
}
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
const ROUTES = {
  ping: function () { return { ok: true, v: VERSION }; },
  pupilInit: pupilInit_, pupilLogin: pupilLogin_, pupilEvent: pupilEvent_, pupilSubmit: pupilSubmit_, pupilState: pupilState_, pupilResult: pupilResult_,
  tInit: tInit_, tCreateTest: tCreateTest_, tTest: tTest_, tSetTest: tSetTest_, tUnlock: tUnlock_, tAbsent: tAbsent_, tSaveImage: tSaveImage_
};
function handle_(req) {
  try {
    const fn = ROUTES[req && req.a];
    if (!fn) return { error: 'bad_request', msg: String(req && req.a) };
    if (/^t[A-Z]/.test(req.a)) { if (req.dk && !req.k) dozorAuth_(req); else auth_(req); }
    return fn(req) || { ok: true };
  } catch (err) {
    const m = String(err && err.message || err);
    if (m.indexOf('E:') === 0) { const p = m.slice(2).split('|'); return { error: p[0], msg: p[1] || '' }; }
    if (/lock|timed out|too many|Service invoked|Rate Limit|Service unavailable/i.test(m)) return { error: 'busy', msg: m };
    return { error: 'server', msg: m };
  }
}

/* ---------- ponuka v tabuľke ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Slepá mapa')
    .addItem('Otvoriť aplikáciu učiteľa', 'showTeacherLink')
    .addItem('Zmeniť adresu webovej aplikácie', 'changeUrl')
    .addToUi();
}
function deployId_(url) { const m = /\/s\/([-\w]+)\/(exec|dev)/.exec(url || ''); return m ? m[1] : ''; }
function execUrl_() {
  const saved = ownProp_('URL');
  if (saved) return saved;
  let live = '';
  try { live = ScriptApp.getService().getUrl() || ''; } catch (e) { live = ''; }
  if (/\/exec$/.test(live)) { setOwnProp_('URL', live); return live; }
  return '';
}
function askUrl_() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Slepá mapa', 'Vlož adresu webovej aplikácie. Nájdeš ju v editore skriptu: Nasadiť > Spravovať nasadenia. Končí na /exec.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return '';
  const u = r.getResponseText().trim().split('?')[0];
  if (!/^https:\/\/script\.google\.com\/.*\/s\/[-\w]+\/exec$/.test(u)) { ui.alert('Toto nie je adresa webovej aplikácie. Má tvar https://script.google.com/macros/s/…/exec'); return ''; }
  setOwnProp_('URL', u);
  return u;
}
function changeUrl() { if (askUrl_()) showTeacherLink(); }
function showTeacherLink() {
  const url = execUrl_() || askUrl_();
  if (!url) return;
  ensureBaseSheets_();
  const link = APP_URL + 'ucitel.html#s=' + deployId_(url) + '&k=' + teacherKey_();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.45 sans-serif;color:#18262a">' +
    '<p><a href="' + link + '" target="_blank" style="font-size:18px;font-weight:bold;color:#1c4f8a">Otvoriť aplikáciu učiteľa</a></p>' +
    '<p>Na telefóne: naskenuj tento kód. Aplikácia si tabuľku zapamätá.</p><div id="qr" style="width:220px"></div>' +
    '<p style="color:#a2420b"><b>Odkaz aj kód sú tvoj kľúč k tabuľke. Žiakom ich neukazuj.</b></p>' +
    '<p style="color:#56666a;font-size:12px">Webová aplikácia: ' + url + '</p></div>' +
    '<script src="' + APP_URL + 'js/qrcode.js"></script>' +
    '<script>try{var q=qrcode(0,"M");q.addData(' + JSON.stringify(link) + ');q.make();document.getElementById("qr").innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){}</script>'
  ).setWidth(400).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, 'Slepá mapa');
}

/* ---------- čítanie tabuľky ---------- */
function pupilKey_(cls, label) { return normName(cls) + '|' + normName(label); }
// Hárok Žiaci: Trieda | Meno („Priezvisko Meno“) | Aktívny. Voliteľne samostatný stĺpec Priezvisko. Ostatné stĺpce sa ignorujú.
function readPupils_() {
  const sh = sheetByNames_(SH.pupils);
  if (!sh) fail_('no_sheet', SH.pupils[0]);
  const t = tableOf_(sh);
  const cC = t.need(['trieda', 'class']), cS = t.col(['priezvisko', 'surname', 'last name']), cN = t.need(['meno', 'name', 'ziak']), cA = t.col(['aktivny', 'active']);
  const out = [], used = {};
  t.rows.forEach(function (row) {
    const cls = s_(row[cC]), label = ((cS >= 0 && cS !== cN ? s_(row[cS]) + ' ' : '') + s_(row[cN])).trim();
    if (!cls || !label) return;
    let id = pupilKey_(cls, label);
    if (used[id]) id += '#' + (++used[id]); else used[id] = 1;
    out.push({ id: id, cls: cls, label: label, active: cA >= 0 ? yes_(row[cA]) : true });
  });
  return out;
}
// Hárok Vlastné objekty: Názov | Typ | Oblasť | Obtiažnosť | Súradnice („48.73, 19.15“ ako z Google Máp).
function readCustom_() {
  const sh = sheetByNames_(SH.custom);
  if (!sh) return [];
  const t = tableOf_(sh), out = [];
  const cN = t.col(['nazov', 'name']), cT = t.col(['typ', 'type']), cR = t.col(['oblast', 'region']), cD = t.col(['obtiaznost', 'obtaznost', 'difficulty']), cX = t.col(['suradnice', 'coordinates']);
  if (cN < 0 || cX < 0) return [];
  t.rows.forEach(function (row, i) {
    const name = s_(row[cN]), ll = parseLatLon_(row[cX]);
    if (!name || !ll) return;
    const lat = ll[0], lon = ll[1];
    out.push({ id: 'custom-' + (i + 2) + '-' + normName(name).replace(/ /g, '-'), name: name, type: cT >= 0 ? s_(row[cT]) : '', region: cR >= 0 ? s_(row[cR]) : '',
      diff: Math.max(1, Math.min(5, Math.round(num_(row[cD]) || 3))), c: [lon, lat] });
  });
  return out;
}
// „48.7297, 19.1498“ (Google Mapy), „48.7297; 19.1498“ alebo s desatinnou čiarkou „48,7297; 19,1498“ -> [šírka, dĺžka]
function parseLatLon_(v) {
  const s = s_(v);
  const m = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/.exec(s) || /^(-?\d+(?:,\d+)?)\s*[;\s]\s*(-?\d+(?:,\d+)?)$/.exec(s) || /^(-?\d+,\d+),\s+(-?\d+,\d+)$/.exec(s);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
function testsTable_() {
  let sh = ss_().getSheetByName(SH.tests);
  if (sh && sh.getLastColumn() > 0) {
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return normName(h); });
    if (head.indexOf('mapa') < 0) {   // hárok z verzie 1 sa odloží bokom
      let name = SH.tests + ' (verzia 1)', k = 2;
      while (ss_().getSheetByName(name)) name = SH.tests + ' (verzia 1, ' + (k++) + ')';
      sh.setName(name); sh = null;
    }
  }
  ensureCols_(ensureSheet_(SH.tests, TEST_HEAD), TEST_HEAD);
  return tableOf_(ss_().getSheetByName(SH.tests));
}
function testObj_(t, row) {
  const g = function (p) { const i = t.col(p); return i < 0 ? '' : row[i]; };
  let map = null; try { map = JSON.parse(s_(g('mapa')) || 'null'); } catch (e) { map = null; }
  const st = normName(g('stav'));
  return {
    id: s_(g('id testu')), created: s_(g('vytvoreny')), cls: s_(g('trieda')), regions: s_(g('oblast')), types: s_(g('typy')), diff: s_(g('obtiaznost') || g('obtaznost')),
    n: num_(g('pocet')) || 0, time: num_(g('cas')) || 30, state: st === normName(STATE.closed) ? 'closed' : st === normName(STATE.ready) ? 'ready' : 'open',
    open: normName(g('rezim')) === normName(MODE.open),
    scoring: { full: num_(g('100')) || 0, zero: num_(g('0 % od')) || 1 }, diag: num_(g('uhlopriecka')) || 0,
    names: s_(g('objekty')).split(';').map(function (x) { return x.trim(); }).filter(String),
    keys: s_(g('id objektov')).split(';').map(function (x) { return x.trim(); }).filter(String),
    title: s_(g('nazov')), lang: s_(g('jazyk')) || 'sk', map: map
  };
}
function findTest_(testId) {
  const t = testsTable_(), c = t.need('id testu');
  for (let i = 0; i < t.rows.length; i++) if (s_(t.rows[i][c]) === testId) return { t: t, rowIndex: i + 2, test: testObj_(t, t.rows[i]) };
  return null;
}
// Test z vyrovnávacej pamäte (žiaci sa pýtajú často); po zmene učiteľom sa pamäť maže.
function testCached_(testId) {
  const key = 'T2_' + testId;
  try { const c = cache_().get(key); if (c) return JSON.parse(c); } catch (e) { /* čítame z hárka */ }
  const f = findTest_(testId);
  if (!f) return null;
  try { cache_().put(key, JSON.stringify(f.test), 60); } catch (e) { /* nevadí */ }
  return f.test;
}
function forgetTest_(testId) { try { cache_().remove('T2_' + testId); } catch (e) { /* nevadí */ } }

/* ---------- balík testu: objekty s geometriou (snímka v čase vytvorenia testu) ---------- */
function savePack_(id, json) {
  const sh = ensureSheet_(SH.packs, ['id testu', 'časť', 'obsah'], true);
  const rows = [];
  for (let i = 0, n = 0; i < json.length; i += CHUNK, n++) rows.push([id, n, '#' + json.substr(i, CHUNK)]);
  const start = sh.getLastRow() + 1;
  sh.getRange(start, 3, rows.length, 1).setNumberFormat('@');
  sh.getRange(start, 1, rows.length, 3).setValues(rows);
  cachePack_(id, rows.map(function (r) { return r[2]; }));
}
function cachePack_(id, parts) {
  try {
    const m = {};
    parts.forEach(function (p, i) { m['P2_' + id + '_' + i] = p; });
    m['P2_' + id + '_n'] = String(parts.length);
    cache_().putAll(m, 21600);
  } catch (e) { /* vyrovnávacia pamäť je len zrýchlenie */ }
}
function loadPack_(id) {
  try {
    const n = +cache_().get('P2_' + id + '_n');
    if (n) {
      const keys = []; for (let i = 0; i < n; i++) keys.push('P2_' + id + '_' + i);
      const got = cache_().getAll(keys);
      if (keys.every(function (k) { return got[k]; })) return JSON.parse(keys.map(function (k) { return got[k].slice(1); }).join(''));
    }
  } catch (e) { /* čítame z hárka */ }
  const sh = ss_().getSheetByName(SH.packs);
  if (!sh) fail_('no_pack');
  const parts = sh.getDataRange().getValues().filter(function (r) { return s_(r[0]) === id; }).sort(function (a, b) { return a[1] - b[1]; }).map(function (r) { return String(r[2]); });
  if (!parts.length) fail_('no_pack');
  cachePack_(id, parts);
  return JSON.parse(parts.map(function (p) { return p.slice(1); }).join(''));
}

/* ---------- prihlásenia (zámok mena na jedno zariadenie) ---------- */
function logins_(id) { try { return JSON.parse(props_().getProperty('L2_' + id)) || { p: {}, f: [] }; } catch (e) { return { p: {}, f: [] }; } }
function saveLogins_(id, L) { if (L.f.length > 40) L.f = L.f.slice(-40); props_().setProperty('L2_' + id, JSON.stringify(L)); }
// Vlastnosti skriptu majú obmedzené miesto: prihlásenia testov starších než 60 dní sa mažú (výsledky v tabuľke ostávajú).
function pruneLogins_() {
  const limit = Number(Utilities.formatDate(new Date(Date.now() - 60 * 864e5), tz_(), 'yyMMdd'));
  const all = props_().getProperties();
  Object.keys(all).forEach(function (k) {
    const m = /^L2_.*-(\d{6})-\d{4}[a-z]?$/.exec(k);
    if (m && Number(m[1]) < limit) props_().deleteProperty(k);
  });
}

/* ---------- výsledky ---------- */
function resultsName_(id) { return 'Výsledky ' + id; }
function createResultsSheet_(id, names) {
  const head = RES_FIXED.concat(names).concat(RES_TAIL);
  const sh = ss_().insertSheet(resultsName_(id), ss_().getSheets().length);
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#d9d9d9').setWrap(true);
  sh.setFrozenRows(1); sh.setFrozenColumns(2);
  sh.getRange(2, 3, 500, 1).setNumberFormat('0%');
  if (names.length) sh.getRange(2, 4, 500, names.length).setNumberFormat('0.0').setHorizontalAlignment('right');
  return sh;
}
// Riadky výsledkov. Stĺpce objektov idú v poradí keys (id objektov testu).
// Neprítomný žiak má riadok s textom „neprítomný“ namiesto percent; učiteľ má riadok s menom Učiteľ.
function readResults_(test) {
  const sh = ss_().getSheetByName(resultsName_(test.id));
  if (!sh) return [];
  const t = tableOf_(sh), cN = t.need('ziak'), cS = t.col('odoslane'), cT = t.col('tipy'), cF = t.col('priznak'), cR = t.col('vysledok'), first = RES_FIXED.length;
  const back = {}; Object.keys(WHY).forEach(function (k) { back[normName(WHY[k])] = k; });
  const out = [];
  t.rows.forEach(function (row, ri) {
    if (!s_(row[cN])) return;
    const km = {}, why = {};
    test.keys.forEach(function (k, i) {
      const v = row[first + i];
      if (typeof v === 'number') km[k] = v;
      else { km[k] = null; why[k] = back[normName(v)] || 'none'; }
    });
    let tips = {}; try { tips = JSON.parse(String(row[cT]) || '{}'); } catch (e) { tips = {}; }
    const rv = cR >= 0 ? row[cR] : 0;
    out.push({ row: ri + 2, pupilId: pupilKey_(test.cls, row[cN]), name: s_(row[cN]), sent: s_(row[cS]), km: km, why: why, tips: tips, flag: cF >= 0 ? s_(row[cF]) : '',
      absent: typeof rv !== 'number' && normName(rv) === normName(ABSENT), teacher: !test.open && normName(row[cN]) === normName(TEACHER) });
  });
  return out;
}
// Zmaže riadky „neprítomný“ daného žiaka (prišiel neskôr alebo učiteľ označenie zrušil).
function clearAbsentRows_(test, label) {
  const sh = ss_().getSheetByName(resultsName_(test.id));
  if (!sh || sh.getLastRow() < 2) return;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, RES_FIXED.length).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (normName(vals[i][1]) === normName(label) && typeof vals[i][2] !== 'number' && normName(vals[i][2]) === normName(ABSENT)) sh.deleteRow(i + 2);
  }
}
function teacherId_(test) { return pupilKey_(test.cls, TEACHER); }
function cleanName_(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
// Kto sa prihlasuje: žiak zo zoznamu triedy, učiteľ, alebo pri externom teste meno, ktoré si hráč sám napísal.
function player_(test, pupilId, name) {
  if (test.open) {
    const n = cleanName_(name);
    if (!normName(n)) fail_('bad_name');
    return { id: pupilKey_(test.cls, n), label: n };
  }
  if (pupilId === teacherId_(test)) return { id: pupilId, label: TEACHER, teacher: true };
  const me = readPupils_().filter(function (p) { return p.cls === test.cls && p.active && p.id === pupilId; })[0];
  if (!me) fail_('not_in_class');
  return { id: me.id, label: me.label };
}
function pctOf_(km, keys, sc) { let s = 0; keys.forEach(function (k) { s += pctFor(km[k], sc.full, sc.zero); }); return keys.length ? s / keys.length : 0; }

/* ---------- žiak (verejné, bez kľúča) ---------- */
function pupilInit_(req) {
  const test = testCached_(String(req.t || ''));
  if (!test) fail_('no_test');
  const L = logins_(test.id);
  let names = [];
  if (!test.open) {
    names = readPupils_().filter(function (p) { return p.cls === test.cls && p.active; })
      .map(function (p) { const e = L.p[p.id]; return { id: p.id, label: p.label, done: !!(e && e.done) }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); });
    const tid = teacherId_(test), te = L.p[tid];
    names.push({ id: tid, label: TEACHER, done: !!(te && te.done), teacher: true });
  }
  return { id: test.id, cls: test.cls, state: test.state, open: test.open, time: test.time, n: test.keys.length, lang: test.lang, title: test.title, map: test.map, names: names };
}
function pupilLogin_(req) {
  const testId = String(req.t || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  if (test.state === 'ready') fail_('not_started');
  if (test.state !== 'open') fail_('closed');
  const me = player_(test, String(req.p || ''), req.n);
  let wasAbsent = false;
  withLock_(function () {
    const L = logins_(testId), e = L.p[me.id];
    if (test.open) {
      if (e && e.d !== device) fail_('name_taken');
      if (e && e.done) fail_('done');
    } else {
      if (e && e.done) fail_('done');
      if (e && e.d !== device) {
        L.f.push({ p: me.id, t: now_('HH:mm:ss'), k: 'pokus o prihlásenie z iného zariadenia' });
        saveLogins_(testId, L);
        fail_('taken');
      }
    }
    if (!e) {
      L.p[me.id] = { d: device, t: now_('HH:mm:ss'), n: me.label };
      if (L.a && L.a[me.id]) { delete L.a[me.id]; wasAbsent = true; }
      saveLogins_(testId, L);
    }
    if (wasAbsent) clearAbsentRows_(test, me.label);
  });
  const pack = loadPack_(testId);
  return { ok: true, pid: me.id, name: me.label, time: test.time, scoring: test.scoring, keys: pack.keys, objects: pack.objects };
}
// Žiak opustil test (iná karta alebo aplikácia). Zapíše sa hneď, aby to učiteľ videl v prehľade.
function pupilEvent_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  withLock_(function () {
    const L = logins_(testId), e = L.p[pupilId];
    if (!e || e.d !== device) return;
    L.f.push({ p: pupilId, t: now_('HH:mm:ss'), k: String(req.what || '').slice(0, 80) });
    saveLogins_(testId, L);
  });
  return { ok: true };
}
function pupilSubmit_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  const L0 = logins_(testId), e0 = L0.p[pupilId];
  if (!e0 || e0.d !== device) fail_('not_logged');
  let label = '';
  if (test.open) label = e0.n || '';
  else if (pupilId === teacherId_(test)) label = TEACHER;
  else { const me = readPupils_().filter(function (p) { return p.cls === test.cls && p.id === pupilId; })[0]; label = me ? me.label : ''; }
  if (!label) fail_('not_in_class');
  const pack = loadPack_(testId), keys = pack.keys, byKey = {};
  (req.tips || []).forEach(function (x) { if (x && x.k) byKey[String(x.k)] = x; });
  const km = {}, cells = [], tipOut = {}, notes = { none: [], leave: [], ended: [] };
  keys.forEach(function (k) {
    const o = pack.objects[k], x = byKey[k] || {}, c = x.c, why = WHY[x.why] ? x.why : '';
    if (!why && c && c.length === 2 && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[1]) <= 90) {
      km[k] = round1(measure(o.g, [+c[0], +c[1]]).d); cells.push(km[k]);
      tipOut[k] = [Math.round(c[1] * 1e4) / 1e4, Math.round(c[0] * 1e4) / 1e4];
    } else { km[k] = null; tipOut[k] = null; const w = why || 'none'; cells.push(WHY[w]); notes[w].push(o.name); }
  });
  const pct = pctOf_(km, keys, test.scoring);
  if (e0.done) return { ok: true, already: true, pct: pct };
  withLock_(function () {
    const L = logins_(testId), e = L.p[pupilId];
    if (e && e.done) return;
    const sh = ss_().getSheetByName(resultsName_(testId)) || createResultsSheet_(testId, test.names);
    const flags = L.f.filter(function (x) { return x.p === pupilId && x.k.indexOf('odchod') !== 0; }).map(function (x) { return x.k + ' ' + x.t; });
    if (notes.leave.length) flags.push('odchod z testu: ' + notes.leave.join(', '));
    if (notes.ended.length) flags.push('test ukončený po druhom odchode, nedokončené: ' + notes.ended.join(', '));
    if (notes.none.length) flags.push('bez tipu: ' + notes.none.join(', '));
    const row = [now_(), label, pct].concat(cells).concat([JSON.stringify(tipOut), flags.join('; ')]);
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    L.p[pupilId] = { d: device, t: e ? e.t : now_('HH:mm:ss'), n: label, done: 1 };
    saveLogins_(testId, L);
  });
  return { ok: true, pct: pct };
}
function pupilState_(req) {
  const test = testCached_(String(req.t || ''));
  if (!test) fail_('no_test');
  return { state: test.state, scoring: test.scoring };
}
// Po uzavretí testu: tipy žiaka so správnymi polohami.
function pupilResult_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  if (test.state !== 'closed') fail_('not_closed');
  const e = logins_(testId).p[pupilId];
  if (!e || e.d !== device) fail_('not_logged');
  const mine = readResults_(test).filter(function (r) { return r.pupilId === pupilId.split('#')[0] && !r.absent; }).pop();
  if (!mine) fail_('no_result');
  const pack = loadPack_(testId);
  return { name: mine.name, cls: test.cls, title: test.title, sent: mine.sent, keys: pack.keys, objects: pack.objects, km: mine.km, why: mine.why, tips: mine.tips,
    scoring: test.scoring, pct: pctOf_(mine.km, pack.keys, test.scoring), map: test.map };
}

/* ---------- učiteľ (s kľúčom) a dozor (s kľúčom jedného testu) ---------- */
function tInit_() {
  ensureBaseSheets_();
  const classes = {};
  readPupils_().filter(function (p) { return p.active; }).forEach(function (p) { (classes[p.cls] = classes[p.cls] || []).push(p.label); });
  const t = testsTable_();
  const tests = t.rows.map(function (r) { return testObj_(t, r); }).filter(function (x) { return x.id; })
    .map(function (x) { return { id: x.id, created: x.created, cls: x.cls, open: x.open, regions: x.regions, title: x.title, n: x.keys.length, state: x.state }; });
  return { v: VERSION, classes: classes, tests: tests, custom: readCustom_(), sheetUrl: ss_().getUrl(), sheetName: ss_().getName() };
}
// cfg: {cls, open, state, title, regions, types, diff, time, full, zero, diag, lang, map:{bbox, base}, names}; pack: {keys, objects}
function tCreateTest_(req) {
  const cfg = req.cfg || {}, pack = req.pack || {}, open = !!cfg.open;
  const cls = open ? OPEN_CLASS : String(cfg.cls || '').trim();
  if (!cls || !pack.keys || !pack.keys.length) fail_('bad_request');
  return withLock_(function () {
    const t = testsTable_();
    let id = cls.replace(/[^0-9A-Za-z]/g, '').slice(0, 8) + '-' + now_('yyMMdd-HHmm');
    const ids = t.rows.map(function (r) { return s_(r[t.need('id testu')]); });
    for (let k = 97; ids.indexOf(id) >= 0 || ss_().getSheetByName(resultsName_(id)); k++) id = id.replace(/[a-z]?$/, String.fromCharCode(k));
    const row = t.head.map(function () { return ''; });
    const put = function (p, v) { const i = t.col(p); if (i >= 0) row[i] = v; };
    put('id testu', id); put('vytvoreny', now_('yyyy-MM-dd HH:mm')); put('trieda', cls); put('oblast', String(cfg.regions || ''));
    put('typy', String(cfg.types || '')); put('obtiaznost', String(cfg.diff || '')); put('obtaznost', String(cfg.diff || '')); put('pocet', pack.keys.length); put('cas', Number(cfg.time) || 30);
    put('stav', cfg.state === 'ready' ? STATE.ready : STATE.open); put('100', Number(cfg.full)); put('0 % od', Number(cfg.zero)); put('uhlopriecka', Number(cfg.diag) || '');
    put('objekty', (cfg.names || []).join('; ')); put('id objektov', pack.keys.join('; ')); put('nazov', String(cfg.title || '')); put('jazyk', String(cfg.lang || 'sk'));
    put('mapa', JSON.stringify(cfg.map || null)); put('rezim', open ? MODE.open : MODE.cls);
    const r = t.sheet.getLastRow() + 1;
    t.sheet.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row.map(function (v) { return typeof v === 'number' ? v : String(v); })]);
    t.sheet.getRange(r, t.col('100') + 1, 1, 3).setNumberFormat('0.0');
    createResultsSheet_(id, cfg.names || pack.keys);
    try { pruneLogins_(); } catch (e) { /* upratovanie nie je dôležité */ }
    savePack_(id, JSON.stringify({ v: 2, keys: pack.keys, objects: pack.objects }));
    return { id: id, cls: cls, dk: dozorKey_(id) };
  });
}
function tTest_(req) {
  const f = findTest_(String(req.t || ''));
  if (!f) fail_('no_test');
  const test = f.test, L = logins_(test.id);
  let pupils;
  if (test.open) {
    // externí hráči: zoznam vzniká z prihlásení
    pupils = Object.keys(L.p).map(function (id) { return { id: id, label: L.p[id].n || id }; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); });
  } else {
    pupils = readPupils_().filter(function (p) { return p.cls === test.cls && p.active; })
      .map(function (p) { return { id: p.id, label: p.label }; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); });
    pupils.push({ id: teacherId_(test), label: TEACHER, teacher: true });
  }
  const out = { test: test, pupils: pupils, logins: L, results: readResults_(test) };
  if (!req.dozor) out.dk = dozorKey_(test.id);
  if (req.withPack) out.pack = loadPack_(test.id);
  return out;
}
function tSetTest_(req) {
  const f = findTest_(String(req.t || ''));
  if (!f) fail_('no_test');
  const patch = req.patch || {}, t = f.t;
  if (req.dozor && patch.scoring) fail_('auth');
  const set = function (p, v) { const i = t.col(p); if (i >= 0) t.sheet.getRange(f.rowIndex, i + 1).setValue(v); };
  if (patch.state) set('stav', STATE[patch.state] || STATE.open);
  if (patch.scoring) {
    const full = Number(patch.scoring.full), zero = Number(patch.scoring.zero);
    if (!(zero > full && full >= 0)) fail_('bad_request');
    set('100', full); set('0 % od', zero);
    // prepočet percent v hárku výsledkov (riadky neprítomných ostávajú)
    const sh = ss_().getSheetByName(resultsName_(f.test.id));
    if (sh && sh.getLastRow() > 1) {
      const test = f.test; test.scoring = { full: full, zero: zero };
      const rng = sh.getRange(2, 3, sh.getLastRow() - 1, 1), vals = rng.getValues();
      readResults_(test).forEach(function (r) { if (!r.absent) vals[r.row - 2][0] = pctOf_(r.km, test.keys, test.scoring); });
      rng.setValues(vals);
    }
  }
  forgetTest_(f.test.id);
  return { ok: true };
}
function tUnlock_(req) {
  const testId = String(req.t || '');
  withLock_(function () { const L = logins_(testId); delete L.p[String(req.p || '')]; saveLogins_(testId, L); });
  return { ok: true };
}
// Neprítomný žiak: v hárku výsledkov dostane riadok s textom „neprítomný“. on=false označenie zruší.
function tAbsent_(req) {
  const f = findTest_(String(req.t || ''));
  if (!f) fail_('no_test');
  const test = f.test, pid = String(req.p || '');
  if (test.open || pid === teacherId_(test)) fail_('bad_request');
  const me = readPupils_().filter(function (p) { return p.cls === test.cls && p.id === pid; })[0];
  if (!me) fail_('not_in_class');
  withLock_(function () {
    const L = logins_(test.id);
    L.a = L.a || {};
    if (req.on) {
      if (L.p[pid]) fail_('logged_in');
      if (!L.a[pid]) {
        const sh = ss_().getSheetByName(resultsName_(test.id)) || createResultsSheet_(test.id, test.names);
        const row = [now_(), me.label, ABSENT].concat(test.keys.map(function () { return ''; })).concat(['', ABSENT]);
        sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
        L.a[pid] = 1;
      }
    } else {
      delete L.a[pid];
      clearAbsentRows_(test, me.label);
    }
    saveLogins_(test.id, L);
  });
  return { ok: true };
}
function tSaveImage_(req) {
  const file = DriveApp.getFileById(ss_().getId()), parents = file.getParents();
  const root = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const sub = function (parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  const folder = sub(sub(root, 'Slepá mapa – obrázky'), String(req.t || 'test'));
  const name = String(req.name || 'obrazok.png').replace(/[\\/:*?"<>|]/g, '_');
  const old = folder.getFilesByName(name); while (old.hasNext()) old.next().setTrashed(true);
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(String(req.b64 || '')), 'image/png', name));
  return { url: f.getUrl(), folderUrl: folder.getUrl() };
}
