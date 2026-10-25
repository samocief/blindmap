/**
 * Slepá mapa, verzia 2.4: skript tabuľky učiteľa (Google Apps Script).
 *
 * Aplikácia beží na GitHub Pages (APP_URL). Tento skript je len most k tabuľke učiteľa:
 * číta zoznam žiakov, ukladá testy a zapisuje výsledky. Údaje žiakov ostávajú v tabuľke učiteľa.
 *
 * Nasadenie: Nasadiť > Nové nasadenie > Webová aplikácia, spustiť ako „Ja", prístup „Ktokoľvek".
 * Po úprave kódu: Nasadiť > Spravovať nasadenia > ceruzka > Verzia: Nová verzia > Nasadiť (adresa ostane rovnaká).
 *
 * Test ako písomka (od 2.3): jeden celkový čas, žiak sa medzi miestami voľne presúva a tipy mení až do odovzdania.
 * Trieda so žiakmi v skupinách A aj B (stĺpec Skupina v hárku Žiaci) dostane dve sady objektov s rovnakými typmi a obtiažnosťami.
 * Prvý odchod z testu strhne z celkového výsledku LEAVE_PENALTY, druhý test ukončí.
 *
 * Od 2.4: id testu „trieda_MM-dd_HH:mm“ (napr. 9A_10-23_09:58), hárok výsledkov „Res_<id>“ hneď za hárkom Testy, najnovší vľavo.
 */
const VERSION = '2.4.2';
const APP_URL = 'https://samocief.github.io/blindmap/';

const SH = { pupils: ['Žiaci', 'Ziaci', 'Pupils', 'Students'], custom: ['Vlastné objekty', 'Custom objects'], tests: 'Testy', packs: '_balíky' };
const PUPIL_HEAD = ['Trieda', 'Meno', 'Skupina', 'Aktívny'];
const CUSTOM_HEAD = ['Názov', 'Typ', 'Oblasť', 'Obtiažnosť', 'Súradnice'];
const TEST_HEAD = ['id testu', 'vytvorený', 'trieda', 'oblasť', 'typy objektov', 'obtiažnosť', 'počet objektov', 'čas na tip (s)', 'stav',
  '100 % do (km)', '0 % od (km)', 'uhlopriečka mapy (km)', 'objekty', 'id objektov', 'názov', 'jazyk', 'mapa', 'režim',
  'celkový čas (min)', 'objekty B', 'id objektov B'];
const RES_FIXED = ['odoslané', 'žiak', 'výsledok (%)'];        // testy do verzie 2.2
const RES_FIXED_AB = ['odoslané', 'žiak', 'skupina', 'výsledok (%)'];
const RES_TAIL3 = ['odchody', 'tipy (šírka, dĺžka)', 'príznak'];
const LEAVE_PENALTY = 0.10;    // strhnutie z celkového výsledku za prvý odchod z testu (10 percentuálnych bodov)
const GRACE_MS = 120000;       // po uplynutí času sa odovzdanie ešte prijme bez príznaku (pomalá sieť)
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
  const pupils = sheetByNames_(SH.pupils);
  if (!pupils) ensureSheet_(SH.pupils[0], PUPIL_HEAD);
  // Hárok Žiaci zo starších verzií dostane na koniec stĺpec Skupina (A/B), ak ho ešte nemá.
  else if (pupils.getLastColumn() > 0 && tableOf_(pupils).col(['skupina', 'group']) < 0) ensureCols_(pupils, ['Skupina']);
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
  // test so starým id (pred 2.4): odkaz pre dozor so starým id platí naďalej
  const ok = req.t && (String(req.dk) === dozorKey_(String(req.t)) || (req.tOld && String(req.dk) === dozorKey_(String(req.tOld))));
  if (!DOZOR_OK[req.a] || !ok) fail_('auth');
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
  pupilInit: pupilInit_, pupilLogin: pupilLogin_, pupilBegin: pupilBegin_, pupilSave: pupilSave_, pupilEvent: pupilEvent_, pupilSubmit: pupilSubmit_, pupilState: pupilState_, pupilResult: pupilResult_,
  tInit: tInit_, tCreateTest: tCreateTest_, tTest: tTest_, tSetTest: tSetTest_, tUnlock: tUnlock_, tAbsent: tAbsent_, tSaveImage: tSaveImage_
};
function handle_(req) {
  try {
    const fn = ROUTES[req && req.a];
    if (!fn) return { error: 'bad_request', msg: String(req && req.a) };
    if (req.t) { const al = aliases_()[String(req.t)]; if (al) { req.tOld = String(req.t); req.t = al; } }   // staré odkazy a QR kódy
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
    .addItem('Usporiadať hárky výsledkov (najnovšie vľavo)', 'organizeResults')
    .addSeparator()
    .addItem('Nový kľúč učiteľa (odhlási všetky zariadenia)', 'newTeacherKey')
    .addToUi();
}
// Keď kľúč videl niekto iný (napr. QR kód na projektore): nový kľúč, starý odkaz a QR kód prestanú platiť všade.
function newTeacherKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Nový kľúč učiteľa',
    'Starý odkaz a QR kód aplikácie učiteľa prestanú fungovať na všetkých zariadeniach, kde boli otvorené (aj u žiakov, ak ho naskenovali). ' +
    'Prestanú platiť aj odkazy a papiere pre dozor k doterajším testom. Svoj telefón potom pripojíš znova. Pokračovať?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  setOwnProp_('TKEY', Utilities.getUuid().replace(/-/g, ''));
  showTeacherLink();
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
  // QR kód je skrytý pod tlačidlom: okno býva na projektore a žiaci ho inak hneď naskenujú.
  const icon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-6px;margin-right:6px">' +
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>' +
    '<path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/></svg>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.45 sans-serif;color:#18262a">' +
    '<p><a href="' + link + '" target="_blank" style="font-size:18px;font-weight:bold;color:#1c4f8a">Otvoriť aplikáciu učiteľa</a></p>' +
    '<p><button id="qb" type="button" style="font:inherit;font-weight:bold;padding:8px 14px;border:1px solid #c9d3cd;border-radius:8px;background:#fff;cursor:pointer;color:#18262a">' +
    icon + 'QR kód pre telefón</button></p>' +
    '<div id="qbox" style="display:none"><p>Naskenuj ho svojím telefónom. Aplikácia si tabuľku zapamätá.</p><div id="qr" style="width:220px"></div></div>' +
    '<p style="color:#a2420b"><b>Odkaz aj QR kód sú tvoj kľúč k tabuľke. Žiakom ich neukazuj, ani na projektore.</b></p>' +
    '<p style="color:#56666a;font-size:12px">Ak kľúč videl niekto iný: Slepá mapa → Nový kľúč učiteľa.<br>Webová aplikácia: ' + url + '</p></div>' +
    '<script src="' + APP_URL + 'js/qrcode.js"></script>' +
    '<script>document.getElementById("qb").onclick=function(){var b=document.getElementById("qbox"),on=b.style.display==="none";b.style.display=on?"block":"none";' +
    'this.lastChild.textContent=on?"Skryť QR kód":"QR kód pre telefón";if(on&&!document.getElementById("qr").firstChild){try{var q=qrcode(0,"M");q.addData(' + JSON.stringify(link) + ');q.make();' +
    'document.getElementById("qr").innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){document.getElementById("qr").textContent="QR kód sa nepodarilo vytvoriť.";}}};</script>'
  ).setWidth(400).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Slepá mapa');
}

/* ---------- čítanie tabuľky ---------- */
function pupilKey_(cls, label) { return normName(cls) + '|' + normName(label); }
// Hárok Žiaci: Trieda | Meno („Priezvisko Meno“) | Skupina (A/B, voliteľne) | Aktívny. Voliteľne samostatný stĺpec Priezvisko. Ostatné stĺpce sa ignorujú.
function readPupils_() {
  const sh = sheetByNames_(SH.pupils);
  if (!sh) fail_('no_sheet', SH.pupils[0]);
  const t = tableOf_(sh);
  const cC = t.need(['trieda', 'class']), cS = t.col(['priezvisko', 'surname', 'last name']), cN = t.need(['meno', 'name', 'ziak']), cA = t.col(['aktivny', 'active']);
  const cG = t.col(['skupina', 'group']);
  const out = [], used = {};
  t.rows.forEach(function (row) {
    const cls = s_(row[cC]), label = ((cS >= 0 && cS !== cN ? s_(row[cS]) + ' ' : '') + s_(row[cN])).trim();
    if (!cls || !label) return;
    let id = pupilKey_(cls, label);
    if (used[id]) id += '#' + (++used[id]); else used[id] = 1;
    const g = cG >= 0 ? normName(row[cG]).split(' ').pop() : '';   // „A“, „b“, „Skupina B“
    out.push({ id: id, cls: cls, label: label, group: g === 'a' ? 'A' : g === 'b' ? 'B' : '', active: cA >= 0 ? yes_(row[cA]) : true });
  });
  return out;
}
// Skupiny tried: {trieda: {A: počet, B: počet, none: [mená bez skupiny]}}. Dve sady dostane trieda, ktorá má žiakov v A aj v B.
function classGroups_(pupils) {
  const out = {};
  pupils.forEach(function (p) {
    if (!p.active) return;
    const o = out[p.cls] = out[p.cls] || { A: 0, B: 0, none: [] };
    if (p.group) o[p.group]++; else o.none.push(p.label);
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
  const list = function (v) { return s_(v).split(';').map(function (x) { return x.trim(); }).filter(String); };
  const keysA = list(g('id objektov')), keysB = list(g('id objektov b'));
  const time = num_(g('cas')) || 0, total = num_(g('celkovy cas')) || 0;
  return {
    id: s_(g('id testu')), created: s_(g('vytvoreny')), cls: s_(g('trieda')), regions: s_(g('oblast')), types: s_(g('typy')), diff: s_(g('obtiaznost') || g('obtaznost')),
    n: num_(g('pocet')) || 0, time: time || (total ? 0 : 30), state: st === normName(STATE.closed) ? 'closed' : st === normName(STATE.ready) ? 'ready' : 'open',
    // celkový čas v minútach (od 2.3); staré testy mali čas na tip, pri nich sa celkový čas dopočíta
    total: total || Math.max(1, Math.ceil((time || 30) * keysA.length / 60)),
    open: normName(g('rezim')) === normName(MODE.open),
    scoring: { full: num_(g('100')) || 0, zero: num_(g('0 % od')) || 1 }, diag: num_(g('uhlopriecka')) || 0,
    names: list(g('objekty')), namesB: list(g('objekty b')),
    keysA: keysA, keysB: keysB, keys: keysA.concat(keysB), groups: keysB.length > 0,
    title: s_(g('nazov')), lang: s_(g('jazyk')) || 'sk', map: map
  };
}
// Objekty, ktoré píše žiak danej skupiny (test bez skupín: všetky).
function groupKeys_(test, g) { return test.groups ? (g === 'B' ? test.keysB : test.keysA) : test.keys; }
// Hlavička stĺpcov objektov vo výsledkoch: pri dvoch skupinách s predponou A:/B:.
function resNames_(test) {
  if (!test.groups) return test.names.length === test.keys.length ? test.names : test.keys;
  const pre = function (g, names, keys) { return keys.map(function (k, i) { return g + ': ' + (names[i] || k); }); };
  return pre('A', test.names, test.keysA).concat(pre('B', test.namesB, test.keysB));
}
function findTest_(testId) {
  const t = testsTable_(), c = t.need('id testu');
  for (let i = 0; i < t.rows.length; i++) if (s_(t.rows[i][c]) === testId) return { t: t, rowIndex: i + 2, test: testObj_(t, t.rows[i]) };
  return null;
}
// Test z vyrovnávacej pamäte (žiaci sa pýtajú často); po zmene učiteľom sa pamäť maže.
function testCached_(testId) {
  const key = 'T3_' + testId;
  try { const c = cache_().get(key); if (c) return JSON.parse(c); } catch (e) { /* čítame z hárka */ }
  const f = findTest_(testId);
  if (!f) return null;
  try { cache_().put(key, JSON.stringify(f.test), 60); } catch (e) { /* nevadí */ }
  return f.test;
}
function forgetTest_(testId) { try { cache_().remove('T3_' + testId); } catch (e) { /* nevadí */ } }

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
function saveLogins_(id, L) { if (L.f.length > 30) L.f = L.f.slice(-30); props_().setProperty('L2_' + id, JSON.stringify(L)); }
// Začiatok písania a počet odchodov každého žiaka: {žiak: [čas začiatku v ms, odchody]}. Samostatne od prihlásení,
// aby po odomknutí (iné zariadenie) žiak pokračoval so zvyšným časom a odchody sa nestratili. Nový pokus ich maže.
function starts_(id) { try { return JSON.parse(props_().getProperty('S2_' + id)) || {}; } catch (e) { return {}; } }
function saveStarts_(id, S) { props_().setProperty('S2_' + id, JSON.stringify(S)); }
// Vlastnosti skriptu majú obmedzené miesto: prihlásenia testov starších než 60 dní (podľa stĺpca vytvorený v hárku Testy) sa mažú.
// Výsledky v tabuľke ostávajú.
function pruneLogins_(t) {
  const cI = t.col('id testu'), cV = t.col('vytvoreny');
  if (cI < 0 || cV < 0) return;
  const limit = Utilities.formatDate(new Date(Date.now() - 60 * 864e5), tz_(), 'yyyy-MM-dd'), old = {};
  t.rows.forEach(function (r) { const id = s_(r[cI]), c = s_(r[cV]).slice(0, 10); if (id && /^\d{4}-\d\d-\d\d$/.test(c) && c < limit) old[id] = 1; });
  Object.keys(props_().getProperties()).forEach(function (k) {
    const m = /^[LS]2_(.+)$/.exec(k);
    if (m && old[m[1]]) props_().deleteProperty(k);
  });
}

/* ---------- výsledky ---------- */
// Hárok výsledkov sa volá „Res_<id testu>“ (do verzie 2.3 „Výsledky <id>“; starý názov sa pri prvom použití premenuje).
function resultsName_(id) { return 'Res_' + id; }
function oldResultsName_(id) { return 'Výsledky ' + id; }
function resultsGet_(id) {
  const sh = ss_().getSheetByName(resultsName_(id));
  if (sh) return sh;
  const old = ss_().getSheetByName(oldResultsName_(id));
  if (old) old.setName(resultsName_(id));
  return old;
}
// Nový hárok výsledkov ide hneď za hárok Testy, takže najnovší je vľavo.
function afterTests_() { const t = ss_().getSheetByName(SH.tests); return t ? t.getIndex() : ss_().getSheets().length; }
// Hárok výsledkov: odoslané | žiak | (skupina) | výsledok (%) | odchýlky v km pri objektoch | odchody | tipy | príznak.
// Stĺpce sa čítajú podľa hlavičky; objekty idú hneď za stĺpcom výsledok v poradí test.keys (pri skupinách najprv A, potom B).
function createResultsSheet_(test) {
  const names = resNames_(test), fixed = test.groups ? RES_FIXED_AB : RES_FIXED;
  const head = fixed.concat(names).concat(RES_TAIL3);
  const sh = ss_().insertSheet(resultsName_(test.id), afterTests_());
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#d9d9d9').setWrap(true);
  sh.setFrozenRows(1); sh.setFrozenColumns(2);
  sh.getRange(2, fixed.length, 500, 1).setNumberFormat('0%');
  if (names.length) sh.getRange(2, fixed.length + 1, 500, names.length).setNumberFormat('0.0').setHorizontalAlignment('right');
  return sh;
}
function resultsSheet_(test) { return resultsGet_(test.id) || createResultsSheet_(test); }
// Premenuje staré hárky „Výsledky <id>“ na „Res_<id>“ a zoradí hárky výsledkov hneď za hárok Testy: najnovší test vľavo.
function organizeResults_() {
  const tests = ss_().getSheetByName(SH.tests);
  if (!tests) return;
  const t = testsTable_(), cI = t.need('id testu'), active = ss_().getActiveSheet();
  // riadky v hárku Testy idú podľa času vytvorenia; najstarší sa presúva prvý, každý ďalší sa vloží pred neho
  t.rows.forEach(function (r) {
    const id = s_(r[cI]), sh = id ? resultsGet_(id) : null;
    if (!sh) return;
    const ti = tests.getIndex(), si = sh.getIndex();
    ss_().setActiveSheet(sh);
    ss_().moveActiveSheet(si < ti ? ti : ti + 1);
  });
  if (active) try { ss_().setActiveSheet(active); } catch (e) { /* nevadí */ }
}
function organizeResults() { withLock_(function () { renameOldIds_(); organizeResults_(); }); setOwnProp_('RESORD', '3'); }

/* ---------- premenovanie starých id testov (pred 2.4: 8B-261021-1204 -> 8B_10-21_12:04) ---------- */
// Staré id ostávajú ako prezývky: odkazy, QR kódy a odkazy pre dozor so starým id fungujú ďalej.
function aliases_() { try { return JSON.parse(ownProp_('ALIAS') || '{}') || {}; } catch (e) { return {}; } }
function renameOldIds_() {
  const t = testsTable_(), cI = t.need('id testu'), al = aliases_(), map = {};
  const ids = t.rows.map(function (r) { return s_(r[cI]); });
  ids.forEach(function (id, i) {
    const m = /^([0-9A-Za-z]*)-\d\d(\d\d)(\d\d)-(\d\d)(\d\d)([a-z]?)$/.exec(id);
    if (!m) return;
    let nid = (m[1] || 'test') + '_' + m[2] + '-' + m[3] + '_' + m[4] + ':' + m[5] + m[6];
    for (let k = 97; ids.indexOf(nid) >= 0 || ss_().getSheetByName(resultsName_(nid)); k++) nid = nid.replace(/[a-z]?$/, String.fromCharCode(k));
    map[id] = nid; ids[i] = nid;
  });
  const olds = Object.keys(map);
  if (!olds.length) return;
  // hárok Testy
  t.sheet.getRange(2, cI + 1, ids.length, 1).setNumberFormat('@').setValues(ids.map(function (x) { return [x]; }));
  // hárky výsledkov
  olds.forEach(function (o) {
    const sh = ss_().getSheetByName(resultsName_(o)) || ss_().getSheetByName(oldResultsName_(o));
    if (sh) sh.setName(resultsName_(map[o]));
  });
  // balíky testov
  const pk = ss_().getSheetByName(SH.packs);
  if (pk && pk.getLastRow() > 1) {
    const rng = pk.getRange(2, 1, pk.getLastRow() - 1, 1), v = rng.getValues();
    rng.setNumberFormat('@').setValues(v.map(function (r) { const o = s_(r[0]); return [map[o] || o]; }));
  }
  // prihlásenia a začiatky písania
  const all = props_().getProperties();
  Object.keys(all).forEach(function (k) {
    const m = /^([LS]2_)(.+)$/.exec(k);
    if (m && map[m[2]]) { props_().setProperty(m[1] + map[m[2]], all[k]); props_().deleteProperty(k); }
  });
  // priečinky s obrázkami na Drive
  try {
    const it = DriveApp.getFileById(ss_().getId()).getParents(), root = it.hasNext() ? it.next() : DriveApp.getRootFolder();
    const fs = root.getFoldersByName('Slepá mapa – obrázky');
    if (fs.hasNext()) { const f = fs.next(); olds.forEach(function (o) { const x = f.getFoldersByName(o); if (x.hasNext()) x.next().setName(map[o]); }); }
  } catch (e) { /* obrázky nie sú dôležité */ }
  olds.forEach(function (o) { al[o] = map[o]; forgetTest_(o); });
  Object.keys(al).forEach(function (o) { if (map[al[o]]) al[o] = map[al[o]]; });
  setOwnProp_('ALIAS', JSON.stringify(al));
}
// Zapíše riadok podľa hlavičky hárka: vals = {stĺpec: hodnota}, cells = hodnoty objektov v poradí test.keys.
function appendResult_(sh, test, vals, cells) {
  const t = tableOf_(sh), row = t.head.map(function () { return ''; });
  if (vals.odchody !== undefined && t.col('odchody') < 0) { ensureCols_(sh, ['odchody']); return appendResult_(sh, test, vals, cells); }
  Object.keys(vals).forEach(function (k) { const i = t.col(k); if (i >= 0) row[i] = vals[k]; });
  const first = t.need('vysledok') + 1;
  (cells || []).forEach(function (v, i) { if (first + i < row.length) row[first + i] = v; });
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}
// Riadky výsledkov. Neprítomný žiak má riadok s textom „neprítomný“ namiesto percent; učiteľ má riadok s menom Učiteľ.
// keys = objekty, ktoré žiak písal (jeho skupina), leaves = počet odchodov (prvý strháva LEAVE_PENALTY).
function readResults_(test) {
  const sh = resultsGet_(test.id);
  if (!sh) return [];
  const t = tableOf_(sh), cN = t.need('ziak'), cS = t.col('odoslane'), cT = t.col('tipy'), cF = t.col('priznak'), cR = t.need('vysledok'), cG = t.col('skupina'), cL = t.col('odchody');
  const first = cR + 1, back = {}; Object.keys(WHY).forEach(function (k) { back[normName(WHY[k])] = k; });
  const out = [];
  t.rows.forEach(function (row, ri) {
    if (!s_(row[cN])) return;
    const g = cG >= 0 ? s_(row[cG]).toUpperCase() : '', keys = groupKeys_(test, g), km = {}, why = {};
    test.keys.forEach(function (k, i) {
      if (keys.indexOf(k) < 0) return;
      const v = row[first + i];
      if (typeof v === 'number') km[k] = v;
      else { km[k] = null; why[k] = back[normName(v)] || 'none'; }
    });
    let tips = {}; try { tips = JSON.parse(String(row[cT]) || '{}'); } catch (e) { tips = {}; }
    const rv = row[cR];
    out.push({ row: ri + 2, pupilId: pupilKey_(test.cls, row[cN]), name: s_(row[cN]), sent: s_(row[cS]), group: g, keys: keys, leaves: cL >= 0 ? num_(row[cL]) || 0 : 0,
      km: km, why: why, tips: tips, flag: cF >= 0 ? s_(row[cF]) : '',
      absent: typeof rv !== 'number' && normName(rv) === normName(ABSENT), teacher: !test.open && normName(row[cN]) === normName(TEACHER) });
  });
  return out;
}
// Zmaže riadky „neprítomný“ daného žiaka (prišiel neskôr alebo učiteľ označenie zrušil).
function clearAbsentRows_(test, label) {
  const sh = resultsGet_(test.id);
  if (!sh || sh.getLastRow() < 2) return;
  const t = tableOf_(sh), cN = t.need('ziak'), cR = t.need('vysledok');
  for (let i = t.rows.length - 1; i >= 0; i--) {
    const v = t.rows[i][cR];
    if (normName(t.rows[i][cN]) === normName(label) && typeof v !== 'number' && normName(v) === normName(ABSENT)) sh.deleteRow(i + 2);
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
  return { id: me.id, label: me.label, group: me.group };
}
// Celkový výsledok: priemer percent za objekty, za prvý odchod z testu mínus LEAVE_PENALTY (najmenej 0).
function pctOf_(km, keys, sc, leaves) {
  let s = 0; keys.forEach(function (k) { s += pctFor(km[k], sc.full, sc.zero); });
  const p = keys.length ? s / keys.length : 0;
  return Math.max(0, p - (leaves > 0 ? LEAVE_PENALTY : 0));
}
// Skupina hráča v teste so skupinami: zo stĺpca Skupina; učiteľ, externý hráč a žiak bez skupiny píšu A.
function groupOf_(test, pupilId) {
  if (!test.groups || test.open || pupilId === teacherId_(test)) return test.groups ? 'A' : '';
  const me = readPupils_().filter(function (p) { return p.cls === test.cls && p.id === pupilId; })[0];
  return me && me.group === 'B' ? 'B' : 'A';
}
/* ---------- priebežne uložené tipy (vyrovnávacia pamäť, 6 hodín) ---------- */
// Žiak ukladá tipy počas testu; pri výmene zariadenia (odomknutí) pokračuje s nimi a učiteľ v prehľade vidí, koľko má hotovo.
function progKey_(testId, pupilId) { return 'G3_' + testId + '_' + Utilities.base64EncodeWebSafe(Utilities.newBlob(pupilId).getBytes()).replace(/=+$/, '').slice(0, 180); }
function progGet_(testId, pupilId) { try { return JSON.parse(cache_().get(progKey_(testId, pupilId)) || 'null'); } catch (e) { return null; } }
function progPut_(testId, pupilId, p) { try { cache_().put(progKey_(testId, pupilId), JSON.stringify(p), 21600); } catch (e) { /* len záloha */ } }
function progDel_(testId, pupilId) { try { cache_().remove(progKey_(testId, pupilId)); } catch (e) { /* nevadí */ } }
// Tipy z aplikácie: {kľúč objektu: [dĺžka, šírka]} len pre objekty skupiny žiaka.
function cleanTips_(tips, keys) {
  const out = {};
  if (!tips || typeof tips !== 'object') return out;
  keys.forEach(function (k) {
    const c = tips[k];
    if (c && c.length === 2 && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[1]) <= 90 && Math.abs(c[0]) <= 360) out[k] = [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4];
  });
  return out;
}

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
  return { v: VERSION, id: test.id, cls: test.cls, state: test.state, open: test.open, total: test.total, n: test.keysA.length, groups: test.groups, penalty: LEAVE_PENALTY,
    lang: test.lang, title: test.title, map: test.map, names: names };
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
  // Skupina: učiteľ, externý hráč a žiak bez skupiny píšu A (učiteľ o žiakoch bez skupiny vie z formulára).
  const group = test.groups ? (me.group === 'B' ? 'B' : 'A') : '';
  const keys = groupKeys_(test, group), pack = loadPack_(testId), objects = {};
  keys.forEach(function (k) { if (pack.objects[k]) objects[k] = pack.objects[k]; });
  // Ak už žiak začal (napr. na inom zariadení pred odomknutím), pokračuje so zvyšným časom a s uloženými tipmi.
  const st = starts_(testId)[me.id], prog = progGet_(testId, me.id);
  const out = { ok: true, pid: me.id, name: me.label, group: group, total: test.total, penalty: LEAVE_PENALTY, scoring: test.scoring, keys: keys, objects: objects, begun: !!st };
  if (st) { out.left = st[0] + test.total * 60000 - Date.now(); out.leaves = st[1] || 0; }
  if (prog) { out.tips = cleanTips_(prog.tips, keys); out.marks = (prog.mk || []).filter(function (k) { return keys.indexOf(k) >= 0; }); }
  return out;
}
// Žiak ťukol na Začať: od tejto chvíle beží jeho celkový čas (na serveri, aby ho obnovenie stránky ani iné zariadenie nevrátilo).
function pupilBegin_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  return withLock_(function () {
    const e = logins_(testId).p[pupilId];
    if (!e || e.d !== device) fail_('not_logged');
    if (e.done) fail_('done');
    const S = starts_(testId);
    if (!S[pupilId]) { S[pupilId] = [Date.now(), 0]; saveStarts_(testId, S); }
    return { ok: true, left: S[pupilId][0] + test.total * 60000 - Date.now(), total: test.total, leaves: S[pupilId][1] || 0 };
  });
}
// Priebežné uloženie tipov počas písania (len vyrovnávacia pamäť, do tabuľky sa píše až pri odovzdaní).
function pupilSave_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const e = logins_(testId).p[pupilId];
  if (!e || e.d !== device) fail_('not_logged');
  if (e.done) return { ok: true };
  const tips = cleanTips_(req.tips, Object.keys(req.tips || {}).slice(0, 80));
  const mk = [].concat(req.mk || []).map(String).filter(function (k) { return k.length < 120; }).slice(0, 80);
  progPut_(testId, pupilId, { tips: tips, mk: mk, n: Object.keys(tips).length, at: now_('HH:mm:ss') });
  return { ok: true };
}
// Žiak opustil test (iná karta alebo aplikácia). Zapíše sa hneď, aby to učiteľ videl v prehľade; leave = poradie odchodu.
function pupilEvent_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  withLock_(function () {
    const L = logins_(testId), e = L.p[pupilId];
    if (!e || e.d !== device) return;
    L.f.push({ p: pupilId, t: now_('HH:mm:ss'), k: String(req.what || '').slice(0, 80) });
    saveLogins_(testId, L);
    const n = Math.min(9, Math.max(0, parseInt(req.leave, 10) || 0));
    if (n) {
      const S = starts_(testId);
      if (S[pupilId] && (S[pupilId][1] || 0) < n) { S[pupilId][1] = n; saveStarts_(testId, S); }
    }
  });
  return { ok: true };
}
// Tipy z aplikácie: {kľúč: [dĺžka, šírka]}; staršia aplikácia posielala [{k, c, why}].
function tipsIn_(tips) {
  if (!Array.isArray(tips)) return tips || {};
  const out = {};
  tips.forEach(function (x) { if (x && x.k && x.c && !x.why) out[String(x.k)] = x.c; });
  return out;
}
function pupilSubmit_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  const L0 = logins_(testId), e0 = L0.p[pupilId];
  if (!e0 || e0.d !== device) fail_('not_logged');
  if (e0.done) return { ok: true, already: true };
  let label = '', group = '';
  if (test.open) label = e0.n || '';
  else if (pupilId === teacherId_(test)) label = TEACHER;
  else { const me = readPupils_().filter(function (p) { return p.cls === test.cls && p.id === pupilId; })[0]; label = me ? me.label : ''; group = me ? me.group : ''; }
  if (!label) fail_('not_in_class');
  if (test.groups) group = group === 'B' ? 'B' : 'A'; else group = '';
  const keys = groupKeys_(test, group), pack = loadPack_(testId), tips = cleanTips_(tipsIn_(req.tips), keys);
  const st = starts_(testId)[pupilId] || null, ended = !!req.ended;
  const leaves = Math.max(Math.min(9, parseInt(req.leaves, 10) || 0), st ? st[1] || 0 : 0, ended ? 2 : 0);
  const km = {}, tipOut = {}, miss = [], cells = test.keys.map(function () { return ''; });
  keys.forEach(function (k) {
    const o = pack.objects[k], c = tips[k], i = test.keys.indexOf(k);
    if (c && o) {
      km[k] = round1(measure(o.g, c).d);
      tipOut[k] = [c[1], c[0]];
      cells[i] = km[k];
    } else {
      km[k] = null; tipOut[k] = null;
      cells[i] = ended ? WHY.ended : WHY.none;
      miss.push(o ? o.name : k);
    }
  });
  const pct = pctOf_(km, keys, test.scoring, leaves);
  withLock_(function () {
    const L = logins_(testId), e = L.p[pupilId];
    if (e && e.done) return;
    const sh = resultsSheet_(test);
    const flags = L.f.filter(function (x) { return x.p === pupilId && x.k.indexOf('odchod') !== 0; }).map(function (x) { return x.k + ' ' + x.t; });
    if (leaves > 0) flags.push('odchod z testu: ' + leaves + '× (−' + Math.round(LEAVE_PENALTY * 100) + ' %)');
    if (ended) flags.push('test ukončený po druhom odchode');
    if (st && Date.now() > st[0] + test.total * 60000 + GRACE_MS) flags.push('odovzdané po čase (+' + Math.round((Date.now() - st[0]) / 60000 - test.total) + ' min)');
    if (miss.length) flags.push((ended ? 'nedokončené: ' : 'bez tipu: ') + miss.join(', '));
    appendResult_(sh, test, { odoslane: now_(), ziak: label, skupina: group, vysledok: pct, odchody: leaves, tipy: JSON.stringify(tipOut), priznak: flags.join('; ') }, cells);
    L.p[pupilId] = { d: device, t: e ? e.t : now_('HH:mm:ss'), n: label, done: 1 };
    saveLogins_(testId, L);
  });
  progDel_(testId, pupilId);
  return { ok: true };
}
function pupilState_(req) {
  const test = testCached_(String(req.t || ''));
  if (!test) fail_('no_test');
  return { state: test.state, scoring: test.scoring };
}
// Po uzavretí testu: tipy žiaka so správnymi polohami (len objekty jeho skupiny).
function pupilResult_(req) {
  const testId = String(req.t || ''), pupilId = String(req.p || ''), device = String(req.d || '').slice(0, 32);
  const test = testCached_(testId);
  if (!test) fail_('no_test');
  if (test.state !== 'closed') fail_('not_closed');
  const e = logins_(testId).p[pupilId];
  if (!e || e.d !== device) fail_('not_logged');
  const mine = readResults_(test).filter(function (r) { return r.pupilId === pupilId.split('#')[0] && !r.absent; }).pop();
  if (!mine) fail_('no_result');
  const pack = loadPack_(testId), objects = {};
  mine.keys.forEach(function (k) { if (pack.objects[k]) objects[k] = pack.objects[k]; });
  return { name: mine.name, cls: test.cls, title: test.title, sent: mine.sent, group: mine.group, keys: mine.keys, objects: objects, km: mine.km, why: mine.why, tips: mine.tips,
    leaves: mine.leaves, penalty: LEAVE_PENALTY, scoring: test.scoring, pct: pctOf_(mine.km, mine.keys, test.scoring, mine.leaves), map: test.map };
}

/* ---------- učiteľ (s kľúčom) a dozor (s kľúčom jedného testu) ---------- */
function tInit_() {
  ensureBaseSheets_();
  // jednorazovo po aktualizácii na 2.4.2: premenovanie starých id testov a zoradenie hárkov výsledkov (v 2.4.1 sa nespustilo)
  if (ownProp_('RESORD') !== '3') { try { withLock_(function () { renameOldIds_(); organizeResults_(); }); setOwnProp_('RESORD', '3'); } catch (e) { /* skúsi sa znova nabudúce */ } }
  const pupils = readPupils_(), classes = {};
  pupils.filter(function (p) { return p.active; }).forEach(function (p) { (classes[p.cls] = classes[p.cls] || []).push(p.label); });
  const t = testsTable_();
  const tests = t.rows.map(function (r) { return testObj_(t, r); }).filter(function (x) { return x.id; })
    .map(function (x) { return { id: x.id, created: x.created, cls: x.cls, open: x.open, regions: x.regions, title: x.title, n: x.keysA.length, groups: x.groups, total: x.total, state: x.state }; });
  return { v: VERSION, classes: classes, groups: classGroups_(pupils), penalty: LEAVE_PENALTY, tests: tests, custom: readCustom_(), sheetUrl: ss_().getUrl(), sheetName: ss_().getName() };
}
// cfg: {cls, open, state, title, regions, types, diff, total (min), full, zero, diag, lang, map:{bbox, base}, names, namesB}
// pack: {keys (sada A, alebo jediná sada), keysB (sada B, pri teste bez skupín prázdna), objects: {kľúč: {name, type, diff, g}}}
function tCreateTest_(req) {
  const cfg = req.cfg || {}, pack = req.pack || {}, open = !!cfg.open;
  const cls = open ? OPEN_CLASS : String(cfg.cls || '').trim();
  const keysA = [].concat(pack.keys || []).map(String), keysB = open ? [] : [].concat(pack.keysB || []).map(String);
  if (!cls || !keysA.length || !pack.objects) fail_('bad_request');
  if (keysB.length && (keysB.length !== keysA.length || keysB.some(function (k) { return keysA.indexOf(k) >= 0; }))) fail_('bad_request', 'skupiny A a B');
  const all = keysA.concat(keysB);
  if (all.some(function (k) { return !pack.objects[k]; })) fail_('bad_request');
  const total = Math.max(1, Math.min(240, Math.round(Number(cfg.total) || 10)));
  return withLock_(function () {
    const t = testsTable_();
    // id: trieda_mesiac-deň_hodina:minúta, napr. 9A_10-23_09:58 (pri zhode sa pridá písmeno: 9A_10-23_09:58a)
    let id = (cls.replace(/[^0-9A-Za-z]/g, '').slice(0, 8) || 'test') + '_' + now_('MM-dd_HH:mm');
    const ids = t.rows.map(function (r) { return s_(r[t.need('id testu')]); });
    for (let k = 97; ids.indexOf(id) >= 0 || ss_().getSheetByName(resultsName_(id)) || ss_().getSheetByName(oldResultsName_(id)); k++) id = id.replace(/[a-z]?$/, String.fromCharCode(k));
    const row = t.head.map(function () { return ''; });
    const put = function (p, v) { const i = t.col(p); if (i >= 0) row[i] = v; };
    const names = [].concat(cfg.names || []).map(String), namesB = [].concat(cfg.namesB || []).map(String);
    put('id testu', id); put('vytvoreny', now_('yyyy-MM-dd HH:mm')); put('trieda', cls); put('oblast', String(cfg.regions || ''));
    put('typy', String(cfg.types || '')); put('obtiaznost', String(cfg.diff || '')); put('obtaznost', String(cfg.diff || '')); put('pocet', keysA.length); put('celkovy cas', total);
    put('stav', cfg.state === 'ready' ? STATE.ready : STATE.open); put('100', Number(cfg.full)); put('0 % od', Number(cfg.zero)); put('uhlopriecka', Number(cfg.diag) || '');
    put('objekty', names.join('; ')); put('id objektov', keysA.join('; ')); put('nazov', String(cfg.title || '')); put('jazyk', String(cfg.lang || 'sk'));
    put('mapa', JSON.stringify(cfg.map || null)); put('rezim', open ? MODE.open : MODE.cls);
    if (keysB.length) { put('objekty b', namesB.join('; ')); put('id objektov b', keysB.join('; ')); }
    const r = t.sheet.getLastRow() + 1;
    t.sheet.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row.map(function (v) { return typeof v === 'number' ? v : String(v); })]);
    t.sheet.getRange(r, t.col('100') + 1, 1, 3).setNumberFormat('0.0');
    createResultsSheet_({ id: id, groups: keysB.length > 0, names: names, namesB: namesB, keys: all, keysA: keysA, keysB: keysB });
    try { pruneLogins_(t); } catch (e) { /* upratovanie nie je dôležité */ }
    savePack_(id, JSON.stringify({ v: 3, keys: all, objects: pack.objects }));
    return { id: id, cls: cls, dk: dozorKey_(id), total: total };
  });
}
function tTest_(req) {
  const f = findTest_(String(req.t || ''));
  if (!f) fail_('no_test');
  const test = f.test, L = logins_(test.id), S = starts_(test.id);
  let pupils;
  if (test.open) {
    // externí hráči: zoznam vzniká z prihlásení
    pupils = Object.keys(L.p).map(function (id) { return { id: id, label: L.p[id].n || id }; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); });
  } else {
    pupils = readPupils_().filter(function (p) { return p.cls === test.cls && p.active; })
      .map(function (p) { return { id: p.id, label: p.label, group: test.groups ? p.group || 'A' : '', nogroup: test.groups && !p.group }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); });
    pupils.push({ id: teacherId_(test), label: TEACHER, teacher: true, group: test.groups ? 'A' : '' });
  }
  // Priebeh písania: koľko tipov má žiak uložených, odkedy píše a koľkokrát odišiel.
  const prog = {}, writing = Object.keys(L.p).filter(function (id) { return !L.p[id].done; });
  if (writing.length) {
    let got = {};
    try { got = cache_().getAll(writing.map(function (id) { return progKey_(test.id, id); })); } catch (e) { got = {}; }
    writing.forEach(function (id) {
      let p = null; try { p = JSON.parse(got[progKey_(test.id, id)] || 'null'); } catch (e) { p = null; }
      const st = S[id];
      if (p || st) prog[id] = { n: p ? p.n || 0 : 0, mk: p && p.mk ? p.mk.length : 0, lv: st ? st[1] || 0 : 0, left: st ? st[0] + test.total * 60000 - Date.now() : null };
    });
  }
  const out = { test: test, pupils: pupils, logins: L, prog: prog, penalty: LEAVE_PENALTY, results: readResults_(test) };
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
    const sh = resultsGet_(f.test.id);
    if (sh && sh.getLastRow() > 1) {
      const test = f.test; test.scoring = { full: full, zero: zero };
      const cR = tableOf_(sh).need('vysledok') + 1, rng = sh.getRange(2, cR, sh.getLastRow() - 1, 1), vals = rng.getValues();
      readResults_(test).forEach(function (r) { if (!r.absent) vals[r.row - 2][0] = pctOf_(r.km, r.keys, test.scoring, r.leaves); });
      rng.setValues(vals);
    }
  }
  forgetTest_(f.test.id);
  return { ok: true };
}
// Odomknutie: žiak sa prihlási na inom zariadení a pokračuje (čas aj odchody ostávajú).
// Pri žiakovi, ktorý už odovzdal, je to nový pokus: začína od začiatku, s celým časom.
function tUnlock_(req) {
  const testId = String(req.t || ''), pid = String(req.p || '');
  withLock_(function () {
    const L = logins_(testId), e = L.p[pid];
    if (e && e.done) { const S = starts_(testId); if (S[pid]) { delete S[pid]; saveStarts_(testId, S); } progDel_(testId, pid); }
    delete L.p[pid]; saveLogins_(testId, L);
  });
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
        appendResult_(resultsSheet_(test), test, { odoslane: now_(), ziak: me.label, skupina: test.groups ? me.group || 'A' : '', vysledok: ABSENT, priznak: ABSENT }, []);
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
