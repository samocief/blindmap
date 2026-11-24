/* Slepá mapa: stránka učiteľa. Pripája sa odkazom z tabuľky: ucitel.html#s=<skript>&k=<kľúč>, potom si ho pamätá.
 * Dozor (suplujúci učiteľ) dostane odkaz ucitel.html?s=<skript>&t=<test>&dk=<kľúč testu>: vidí len prehľad jedného testu,
 * môže ho spustiť a uzavrieť, označiť neprítomných a skopírovať výsledky. Jeho odkaz sa nikam neukladá.
 */
var T = {
  s: '', k: '', dz: false, dk: '', init: null, oldScript: false, regions: [], poolAll: [], pool: [], slots: [], slotsB: [], groups: false, mode: 'auto', loadSeq: 0, listOpen: false,
  scene: null, sceneKey: '', pview: null, cur: null, cview: null, poll: null, tab: 'new', sub: 'over', objKey: '', showNames: false, showRes: false, classForce: false, imgRec: null
};
// NEED_SCRIPT: bez neho sa nové testy nespustia; FEAT_SCRIPT: akcie v ponuke ⋯ (premenovať, duplikovať, …), so starším skriptom sú vypnuté.
var FORM_KEY = 'sm-form', OPEN_CLS = '*ext*', NEED_SCRIPT = '2.10', FEAT_SCRIPT = '2.11';
// Názov testu je zároveň jeho id (odkaz, QR, hárok výsledkov): bez diakritiky, medzier a bodiek, unikátny bez ohľadu na veľké písmená.
var NAME_RE = /^[A-Za-z0-9_-]+$/, NAME_MAX = 40;

function tStatus(id, msg, cls) { var e = $(id); e.textContent = msg || ''; e.className = 'small ' + (cls || 'muted'); e.hidden = !msg; }
function appBase() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
function pupilUrl(id) { return appBase() + '?s=' + encodeURIComponent(T.s) + '&t=' + encodeURIComponent(id); }
function dozorUrl(id, dk) { return appBase() + 'ucitel.html?s=' + encodeURIComponent(T.s) + '&t=' + encodeURIComponent(id) + '&dk=' + encodeURIComponent(dk); }
// Prihlasovacie údaje k volaniu skriptu: kľúč učiteľa, alebo pri dozore kľúč jedného testu.
function A(x) { return Object.assign(T.dz ? { dk: T.dk } : { k: T.k }, x || {}); }
function copyText(txt, msgId, okText) {
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { tStatus(msgId, okText, 'ok'); })
    .catch(function () { var ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); tStatus(msgId, okText, 'ok'); } catch (e) { tStatus(msgId, errText(e), 'bad'); } ta.remove(); });
}
function qrSvg(text) { try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { return ''; } }
function num(v, d) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; }
function form() { return store(FORM_KEY) || {}; }
function saveForm(patch) { store(FORM_KEY, Object.assign(form(), patch)); }

/* ---------- spustenie a pripojenie tabuľky ---------- */
async function teacherStart() {
  try { await loadLang(param('lang') || 'sk'); } catch (e) { document.body.textContent = e.message; return; }
  applyI18n();
  $('t-ver').textContent = t('common.version', { v: APP.version });
  if (param('dk') && param('t') && param('s')) { dozorStart(); return; }
  var h = new URLSearchParams(location.hash.slice(1));
  if (h.get('s') && h.get('k')) {
    store('sm-teacher', { s: h.get('s'), k: h.get('k') });
    history.replaceState(null, '', location.pathname + location.search);   // kľúč nemá ostať v adrese (projektor, história)
  }
  var c = store('sm-teacher');
  if (!c || !c.s || !c.k) { tConnect(); return; }
  T.s = c.s; T.k = c.k; API.url = scriptUrl(c.s);
  show('t-load', 't');
  try { T.init = await apiRetry('tInit', A(), 3); }
  catch (e) { tConnect(e.code === 'auth' ? t('t.connect_auth') : errText(e)); return; }
  try { T.regions = await Data.index(); } catch (e) { T.regions = []; tStatus('t-status', t('t.no_index'), 'bad'); }
  // Test ako písomka (celkový čas, skupiny A/B) potrebuje skript 2.3. So starším skriptom sa dajú len otvárať doterajšie testy.
  T.oldScript = cmpVer(T.init.v, NEED_SCRIPT) < 0; T.feat = cmpVer(T.init.v, FEAT_SCRIPT) >= 0;
  if (T.oldScript) tStatus('t-status', t('t.old_script', { v: T.init.v || '1' }), 'bad');
  $('start').disabled = $('prepare').disabled = T.oldScript;
  $('t-sheet').href = T.init.sheetUrl; $('t-sheet').hidden = false;
  $('t-conn').textContent = t('t.connected', { name: T.init.sheetName || '' }); $('t-foot').hidden = false;
  show('t-app', 't');
  tForm();
  tTab('new');
}
// Dozor: bez tabuľky učiteľa, len jeden test.
function dozorStart() {
  T.dz = true; T.s = param('s'); T.dk = param('dk'); API.url = scriptUrl(T.s);
  document.body.classList.add('dozor');
  document.title = t('t.dz_title') + ' · ' + t('app.title');
  $('dz-help').hidden = false;
  show('t-app', 't');
  T.sub = 'over';
  tOpenTest(param('t'));
}
function tConnect(err) {
  $('t-connect-err').textContent = err || ''; $('t-connect-err').hidden = !err;
  $('t-sheet').hidden = true; $('t-foot').hidden = true;
  show('t-connect', 't');
}
function tTab(name) {
  T.tab = name; clearInterval(T.poll);
  ['new', 'started', 'tests', 'test'].forEach(function (n) { $('v-' + n).hidden = n !== name; });
  $('tab-new').classList.toggle('on', name === 'new' || name === 'started');
  $('tab-tests').classList.toggle('on', name === 'tests' || name === 'test');
  if (name === 'tests') tTests();
  if (name === 'new' && T.pview) setTimeout(function () { T.pview.fit(); }, 0);
  window.scrollTo(0, 0);
}

/* ---------- formulár nového testu ---------- */
function chips(box, items, checked, onchange) { renderChips(box, items, checked, onchange); }
function tCodes() { return $('f-region').value ? [$('f-region').value] : []; }
function chipVals(box) { return Array.prototype.slice.call(box.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
function regionByCode(code) { return T.regions.filter(function (r) { return r.code === code; })[0]; }
function tForm() {
  var I = T.init, F = form();
  // Trieda a názov testu sa vždy vyberajú vedome: bez predvoľby a bez pamäte z minulého testu.
  var cls = Object.keys(I.classes).sort(function (a, b) { return a.localeCompare(b, I18N.lang, { numeric: true }); }), sel = $('f-cls');
  sel.innerHTML = '';
  sel.appendChild(el('option', { value: '', text: t('t.class_ph') }));
  if (!cls.length) sel.appendChild(el('option', { value: '', text: t('t.no_classes'), disabled: true }));
  cls.forEach(function (c) { sel.appendChild(el('option', { value: c, text: t('t.class_opt', { cls: c, n: I.classes[c].length }) })); });
  if (!T.oldScript) sel.appendChild(el('option', { value: OPEN_CLS, text: t('t.class_open') }));
  sel.value = ''; $('f-title').value = ''; tNameCheck();
  sel.onchange = function () { sel.classList.remove('invalid'); tStatus('start-msg', ''); tClassChanged(); };
  $('f-title').oninput = function () { tStatus('start-msg', ''); tNameCheck(); };
  tListToggle(false);
  $('f-dmin').value = String(F.dmin || 1); $('f-dmax').value = String(F.dmax || 2);
  diffSlider($('f-diff'), $('f-dmin'), $('f-dmax'));
  $('f-n').value = F.n || 10; $('f-time').value = F.total || 10; $('f-full').value = F.pFull || 1; $('f-zero').value = F.pZero || 30;
  regionSelect($('f-region'), T.regions, (F.regions || [])[0], tRegionsChanged);
  $('f-dmin').onchange = $('f-dmax').onchange = function () { saveForm({ dmin: +$('f-dmin').value, dmax: +$('f-dmax').value }); tFilter(); };
  // Počet objektov: políčka sa prispôsobia už počas písania; prekresľujú sa len pri skutočnej zmene počtu.
  var nTimer = null;
  $('f-n').oninput = function () { clearTimeout(nTimer); nTimer = setTimeout(function () { var n = parseInt($('f-n').value, 10); if (n >= 1 && n <= 40 && n !== T.slots.length) { saveForm({ n: n }); tResize(); } }, 400); };
  $('f-n').onchange = function () { clearTimeout(nTimer); var n = Math.max(1, Math.min(40, parseInt($('f-n').value, 10) || 10)); $('f-n').value = n; saveForm({ n: n }); if (n !== T.slots.length) tResize(); };
  $('f-time').onchange = function () { var m = Math.max(1, Math.min(240, parseInt($('f-time').value, 10) || 10)); $('f-time').value = m; saveForm({ total: m }); };
  $('f-full').oninput = $('f-zero').oninput = tScoringInfo;
  $('f-full').onchange = $('f-zero').onchange = function () { saveForm({ pFull: num($('f-full').value, 1), pZero: num($('f-zero').value, 30) }); };
  T.mode = F.mode === 'manual' ? 'manual' : 'auto'; tModeButtons();
  T.groups = false; T.slotsB = []; tClassChanged();
  tRegionsChanged();
}
// Trieda so žiakmi v skupine A aj B (hárok Žiaci, stĺpec Skupina) píše v skupinách: dve sady objektov vedľa seba.
// Žiakov bez skupiny učiteľ vidí hneď pod triedou (budú písať A), nepriraďujú sa potichu.
// Šachovnica (len pri zasadacom poriadku v hárku Žiaci): v každom druhom rade sú skupiny prehodené, takže inú skupinu má aj sused vpredu a vzadu.
function altOn(g) { return !!(g && g.seat && form().alt); }
function groupCounts(g) { return altOn(g) && g.alt ? { A: g.alt.A || 0, B: g.alt.B || 0, none: g.none } : g; }
function altChip(g, after) {
  var inp = el('input', { type: 'checkbox' }); inp.checked = altOn(g);
  inp.onchange = function () { saveForm({ alt: inp.checked }); after(); };
  return el('div', { class: 'stack tight' }, [el('label', { class: 'chip', style: 'align-self:flex-start' }, [inp, ' ' + t('t.alt')]), el('p', { class: 'small muted', text: t('t.alt_hint') })]);
}
function tGroupInfo() { var c = $('f-cls').value, g = ((T.init && T.init.groups) || {})[c]; return c && c !== OPEN_CLS && g && g.A > 0 && g.B > 0 ? g : null; }
function tClassChanged() {
  var c = $('f-cls').value, g = tGroupInfo(), box = $('f-groups'), on = !!g;
  box.innerHTML = '';
  if (g) {
    var gc = groupCounts(g);
    box.appendChild(el('p', { class: 'small muted', text: t('t.groups_info', { cls: c, a: gc.A, b: gc.B }) }));
    if (g.seat) box.appendChild(altChip(g, tClassChanged));
    if (g.none.length) box.appendChild(el('p', { class: 'small bad', text: t('t.groups_missing', { names: g.none.join(', ') }) }));
  } else if (c && c !== OPEN_CLS && T.init && T.init.groups) box.appendChild(el('p', { class: 'small muted', text: t('t.groups_one', { cls: c }) }));
  box.hidden = !box.firstChild;
  if (on === T.groups) return;
  T.groups = on;
  T.slotsB = on ? T.slots.map(function () { return null; }) : [];
  if (on && T.mode === 'auto') tFillEmpty();
  tSlots();
}

// Zmena oblastí: načítajú sa objekty a ponuka vrstiev mapy.
async function tRegionsChanged() {
  var seq = ++T.loadSeq, codes = tCodes();
  saveForm({ regions: codes });
  tBaseChips(codes);
  $('pool-info').textContent = codes.length ? t('common.loading') : t('t.pick_region');
  var files = [];
  codes.forEach(function (c) { var r = regionByCode(c); if (r) r.objects.forEach(function (o) { files.push({ entry: o, region: c }); }); });
  var lists;
  try { lists = await Promise.all(files.map(function (f) { return Data.objects(f.entry, f.entry.type, f.region); })); }
  catch (e) { if (seq === T.loadSeq) tStatus('t-status', errText(e), 'bad'); lists = []; }
  if (seq !== T.loadSeq) return;
  var byId = {}, all = [];
  lists.forEach(function (list) { list.forEach(function (o) {
    if (byId[o.id]) { if (byId[o.id].regions.indexOf(o.regions[0]) < 0) byId[o.id].regions.push(o.regions[0]); return; }
    var x = Object.assign({}, o, { regions: o.regions.slice() }); byId[o.id] = x; all.push(x);
  }); });
  tCustomObjects(codes).forEach(function (o) { if (!byId[o.id]) { byId[o.id] = o; all.push(o); } });
  T.poolAll = all;
  // typy objektov
  var counts = {}; all.forEach(function (o) { counts[o.type] = (counts[o.type] || 0) + 1; });
  var items = themeItems(counts), F = form(), prev = themesOf(items, F.types || []);
  chips($('f-types'), items, prev.length ? prev : items.map(function (x) { return x.value; }), function () { saveForm({ types: checkedTypes($('f-types')) }); tFilter(); });
  $('f-types-msg').textContent = items.length ? '' : t('t.no_objects'); $('f-types-msg').hidden = !!items.length;
  // výber z minulého razu ostane, ak sa ešte dá
  T.slots = T.slots.map(function (o) { return o && byId[o.id] ? byId[o.id] : null; });
  T.slotsB = T.slotsB.map(function (o) { return o && byId[o.id] ? byId[o.id] : null; });
  tFilter();
  tScene();
}
// Vlastné objekty z tabuľky učiteľa: typ a oblasť sa porovnávajú s kódmi aj s názvami v jazyku aplikácie.
var TYPE_SYN = [[/^(stat|staty|krajina|krajiny|country|countries)$/, 'countries'], [/^(kraj|kraje|region|regiony|regions|zupa|zupy)\b/, 'regions'], [/^(okres|okresy|districts?)\b/, 'districts'],
  [/^(mesto|mesta|obec|obce|sidlo|sidla|city|cities|town|towns)\b/, 'cities'], [/^(rieka|rieky|potok|potoky|river|rivers)\b/, 'rivers'],
  [/^(jazero|jazera|nadrz|nadrze|vodna nadrz|vodne nadrze|priehrada|pleso|plesa|lake|lakes)\b/, 'lakes'], [/^(more|moria|zaliv|zalivy|prieliv|prielivy|sea|seas|bay)\b/, 'seas'],
  [/^(ocean|oceany|oceans)\b/, 'oceans'], [/^(pohorie|pohoria|mountains?)\b/, 'mountains'], [/^(vrch|vrchy|stit|stity|hora|peaks?)\b/, 'peaks'],
  [/^(nizina|niziny|kotlina|kotliny|lowlands?|basins?)\b/, 'lowlands'], [/^(sedlo|sedla|priesmyk|priesmyky|saddles?|pass|passes)\b/, 'saddles'], [/^(ostrov|ostrovy|islands?)\b/, 'islands'], [/^(polostrov|polostrovy|peninsulas?)\b/, 'peninsulas'],
  [/^(pust|puste|deserts?)\b/, 'deserts'], [/^(narodny park|narodne parky|chranene|parks?)\b/, 'parks'], [/^(jaskyna|jaskyne|caves?)\b/, 'caves']];
function typeCode(text) {
  var n = normName(text); if (!n) return 'other';
  for (var i = 0; i < TYPE_SYN.length; i++) if (TYPE_SYN[i][0].test(n)) return TYPE_SYN[i][1];
  var dict = tRaw('type') || {}; for (var k in dict) if (normName(dict[k]) === n) return k;
  return text;
}
function tCustomObjects(codes) {
  var bbox = tBBox(codes, true);
  return (T.init.custom || []).map(function (c) {
    var reg = normName(c.region), match = codes.filter(function (code) { var r = regionByCode(code); return reg && (normName(code) === reg || normName(regionLabel(code, r && r.names)) === reg); });
    if (!match.length && !(reg === '' && bbox && c.c[0] >= bbox[0] && c.c[0] <= bbox[2] && c.c[1] >= bbox[1] && c.c[1] <= bbox[3])) return null;
    var g = { t: 'pt', c: c.c };
    return { id: c.id, name: c.name, type: typeCode(c.type), diff: c.diff, g: g, bbox: geomBBox(g), regions: match.length ? match : codes.slice(0, 1), custom: true };
  }).filter(Boolean);
}
// Výrez mapy: rozsah z index.json, inak z objektov oblasti.
function tBBox(codes, noObjects) {
  var b = null;
  codes.forEach(function (c) {
    var r = regionByCode(c);
    if (r && r.bbox) b = bboxUnion(b, r.bbox);
    else if (!noObjects) T.poolAll.forEach(function (o) { if (o.regions.indexOf(c) >= 0) b = bboxUnion(b, o.bbox); });
  });
  return b && !noObjects && !codes.every(function (c) { var r = regionByCode(c); return r && r.bbox; }) ? bboxPad(b, 0.05) : b;
}
function tFilter() {
  var types = checkedTypes($('f-types')), dmin = +$('f-dmin').value, dmax = +$('f-dmax').value;
  if (dmin > dmax) { var x = dmin; dmin = dmax; dmax = x; }
  T.pool = T.poolAll.filter(function (o) { return types.indexOf(o.type) >= 0 && o.diff >= dmin && o.diff <= dmax; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, I18N.lang); });
  var ok = {}; T.pool.forEach(function (o) { ok[o.id] = 1; });
  T.slots = T.slots.map(function (o) { return o && ok[o.id] ? o : null; });
  T.slotsB = T.slotsB.map(function (o) { return o && ok[o.id] ? o : null; });
  chipCounts($('f-types'), T.poolAll, dmin, dmax);
  tLockLayers(); tScene();
  tResize();
}
function tResize() {
  var n = Math.max(1, Math.min(40, parseInt($('f-n').value, 10) || 10));
  T.slots = T.slots.slice(0, n); while (T.slots.length < n) T.slots.push(null);
  if (T.groups) { T.slotsB = T.slotsB.slice(0, n); while (T.slotsB.length < n) T.slotsB.push(null); }
  if (T.mode === 'auto') tFillEmpty();
  tSlots();
}
// Objekty a mapa s nimi sú predvolene skryté: učiteľ zvyčajne zrkadlí obrazovku na projektor.
function tListToggle(open) {
  T.listOpen = open; $('list-box').hidden = !open; $('list-hidden').hidden = open;
  $('list-toggle').textContent = t(open ? 't.hide_list' : 't.show_list') + (open ? ' ▴' : ' ▾');
  $('list-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && T.pview) setTimeout(function () { T.pview.fit(); }, 0);
}
function tModeButtons() { $('m-auto').classList.toggle('on', T.mode === 'auto'); $('m-manual').classList.toggle('on', T.mode === 'manual'); $('refill').hidden = T.mode !== 'auto'; }
function tClearAll() { T.slots = T.slots.map(function () { return null; }); T.slotsB = T.slotsB.map(function () { return null; }); }
function tSetMode(m) {
  T.mode = m; saveForm({ mode: m }); tModeButtons();
  if (m === 'manual') tClearAll(); else tFillEmpty();
  tSlots();
}
function colArr(col) { return col === 'B' ? T.slotsB : T.slots; }
// Už vybrané objekty v oboch skupinách (okrem jedného políčka): ten istý objekt nemôže byť dvakrát ani v A aj B.
function usedIds(col, except) {
  var u = {};
  [['A', T.slots], ['B', T.slotsB]].forEach(function (c) { c[1].forEach(function (o, i) { if (o && !(c[0] === col && i === except)) u[o.id] = 1; }); });
  return u;
}
function pick(list) { return list.length ? list[Math.floor(Math.random() * list.length)] : null; }
// Náhodný objekt na doplnenie prázdnych políčok (Auto): vyvažuje obtiažnosti a typy v stĺpci A.
// pair = pri skupinách vyberá len objekty, ku ktorým ostáva ďalší s rovnakým typom a obtiažnosťou (pre stĺpec B).
function tRandom(exclude, pair) {
  var avail = T.pool.filter(function (x) { return !exclude[x.id]; });
  if (pair) { var two = avail.filter(function (x) { return avail.some(function (y) { return y !== x && y.type === x.type && y.diff === x.diff; }); }); if (two.length) avail = two; }
  if (!avail.length) return null;
  var cd = {}, ct = {};
  T.slots.forEach(function (o) { if (o) { cd[o.diff] = (cd[o.diff] || 0) + 1; ct[o.type] = (ct[o.type] || 0) + 1; } });
  var m = Math.min.apply(null, avail.map(function (x) { return cd[x.diff] || 0; }));
  avail = avail.filter(function (x) { return (cd[x.diff] || 0) === m; });
  m = Math.min.apply(null, avail.map(function (x) { return ct[x.type] || 0; }));
  avail = avail.filter(function (x) { return (ct[x.type] || 0) === m; });
  return pick(avail);
}
// Objekt k susedovi v druhej skupine: rovnaký typ a obtiažnosť; ak taký nie je, rovnaký typ s najbližšou obtiažnosťou, potom rovnaká obtiažnosť.
function tMatch(ref, exclude) {
  if (!ref) return tRandom(exclude);
  var avail = T.pool.filter(function (x) { return !exclude[x.id]; }), best = avail.filter(function (x) { return x.type === ref.type && x.diff === ref.diff; });
  if (!best.length) {
    var same = avail.filter(function (x) { return x.type === ref.type; });
    if (same.length) { var m = Math.min.apply(null, same.map(function (x) { return Math.abs(x.diff - ref.diff); })); best = same.filter(function (x) { return Math.abs(x.diff - ref.diff) === m; }); }
  }
  if (!best.length) best = avail.filter(function (x) { return x.diff === ref.diff; });
  return pick(best.length ? best : avail);
}
function samePair(a, b) { return !a || !b || (a.type === b.type && a.diff === b.diff); }
// Doplnenie po riadkoch: najprv A, hneď k nemu B, aby dvojica s rovnakým typom a obtiažnosťou ostala voľná.
function tFillEmpty() {
  T.slots.forEach(function (o, i) {
    if (!T.slots[i]) T.slots[i] = tRandom(usedIds('A', i), T.groups && !T.slotsB[i]);
    if (T.groups && !T.slotsB[i]) T.slotsB[i] = tMatch(T.slots[i], usedIds('B', i));
  });
}
function tRefill() { tClearAll(); tFillEmpty(); tSlots(); }

/* ---------- políčka objektov (vyhľadávanie s ponukou, kocka, výmaz) ---------- */
function tSlots() {
  // Ak práve píšeš do niektorého políčka, po prekreslení v ňom ostaneš.
  var box = $('slots'), act = document.activeElement, keep = -1;
  if (act && box.contains(act) && act.tagName === 'INPUT') keep = Array.prototype.indexOf.call(box.querySelectorAll('input'), act);
  box.innerHTML = ''; box.classList.toggle('two', T.groups);
  if (T.groups) box.appendChild(el('li', { class: 'slot head', 'aria-hidden': 'true' }, [el('span', { text: '#' }), el('span', { text: t('t.col_a') }), el('span', { text: t('t.col_b') })]));
  T.slots.forEach(function (o, i) { box.appendChild(slotRow(i)); });
  if (keep >= 0 && box.querySelectorAll('input')[keep]) box.querySelectorAll('input')[keep].focus();
  var filled = T.slots.filter(Boolean).length + T.slotsB.filter(Boolean).length, total = T.slots.length * (T.groups ? 2 : 1);
  $('pool-info').textContent = !tCodes().length ? t('t.pick_region')
    : t('t.pool_info', { n: T.pool.length, filled: filled, total: total }) + (T.pool.length < total ? ' ' + t('t.pool_short') : '');
  $('prev-legend').hidden = !T.groups;
  if (T.pview) T.pview.redraw();
}
function slotRow(i) {
  var bad = T.groups && !samePair(T.slots[i], T.slotsB[i]);
  var kids = [el('span', { class: 'n' + (bad ? ' diff' : ''), text: (i + 1) + '.', title: bad ? t('t.pair_diff') : null })];
  kids.push(slotCell(i, 'A'));
  if (T.groups) kids.push(slotCell(i, 'B'));
  return el('li', { class: 'slot' }, kids);
}
function slotCell(i, col) {
  var arr = colArr(col), o = arr[i], act = -1, items = [];
  var inp = el('input', { type: 'text', value: o ? o.name : '', placeholder: t('t.slot_ph'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    'aria-label': (T.groups ? col + ' ' : '') + t('t.slot_aria', { n: i + 1 }), class: o ? 'filled' : '' });
  var hint = el('span', { class: 'hint' }, o ? [typeIcon(o.type), typeOne(o.type) + (o.note ? ' ' + o.note : '') + ' · ' + o.diff] : []);
  var list = el('ul', { class: 'sugg', hidden: true, role: 'listbox' });
  function render() {
    var q = normName(inp.value), used = usedIds(col, i);
    items = T.pool.filter(function (x) { if (used[x.id]) return false; if (!q) return true; var n = normName(x.name); return n.indexOf(q) === 0 || n.indexOf(' ' + q) >= 0 || (q.length > 2 && n.indexOf(q) >= 0); });
    if (q) items.sort(function (a, b) { return (normName(b.name).indexOf(q) === 0) - (normName(a.name).indexOf(q) === 0); });
    items = items.slice(0, 40);
    list.innerHTML = '';
    items.forEach(function (x, j) {
      list.appendChild(el('li', { class: j === act ? 'act' : '', role: 'option', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { choose(x); } },
        [el('b', {}, [typeIcon(x.type), x.name]), el('span', { text: typeOne(x.type) + (x.note ? ' ' + x.note : '') + ' · ' + t('t.diff_short', { n: x.diff }) + (x.custom ? ' · ' + t('t.custom') : '') })]));
    });
    if (!items.length) list.appendChild(el('li', { class: 'empty', text: T.pool.length ? t('t.no_match') : t('t.pool_empty') }));
    list.hidden = false;
    var a = list.querySelector('.act'); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function choose(x) { arr[i] = x; list.hidden = true; inp.blur(); tSlots(); }
  inp.onfocus = function () { inp.select(); hint.hidden = true; act = -1; render(); setTimeout(function () { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250); };
  inp.oninput = function () { act = 0; render(); };
  inp.onkeydown = function (e) {
    if (e.key === 'ArrowDown') { act = Math.min(act + 1, items.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (items[Math.max(0, act)]) choose(items[Math.max(0, act)]); e.preventDefault(); }
    else if (e.key === 'Escape') inp.blur();
  };
  inp.onblur = function () { list.hidden = true; var cur = arr[i]; inp.value = cur ? cur.name : ''; hint.hidden = false; };
  // Kocka: pri skupinách iný objekt s rovnakým typom a obtiažnosťou ako sused vedľa (aj keď ho učiteľ zmenil ručne),
  // bez skupín úplne náhodný iný objekt z celej ponuky filtra. Už vybrané objekty sa neopakujú.
  var other = T.groups ? colArr(col === 'A' ? 'B' : 'A')[i] : null, tip = T.groups && other ? t('t.dice_pair') : t('t.dice');
  var dice = el('button', { type: 'button', class: 'icon', title: tip, 'aria-label': tip, text: '🎲', onclick: function () {
    var ex = usedIds(col, i); if (arr[i]) ex[arr[i].id] = 1;
    var x = other ? tMatch(other, ex) : pick(T.pool.filter(function (y) { return !ex[y.id]; }));
    if (x) { arr[i] = x; tSlots(); }
  } });
  var clr = el('button', { type: 'button', class: 'icon', title: t('t.clear'), 'aria-label': t('t.clear'), text: '✕', disabled: !o, onclick: function () { arr[i] = null; tSlots(); } });
  return el('div', { class: 'cell' }, [el('span', { class: 'tag', text: col }), el('div', { class: 'combo' }, [inp, hint, list]), dice, clr]);
}

/* ---------- mapa: vrstvy, náhľad, hodnotenie ---------- */
function tBaseChips(codes) {
  var F = form(), on = F.base || [], seen = F.seen || [], items = layerItems(T.regions, codes);
  var vals = items.map(function (x) { return x.value; });
  // vrstvy, ktoré učiteľ už videl, majú jeho posledné nastavenie; nové vrstvy podľa predvoľby
  var checked = oneOfExcl(items, items.filter(function (x) { return seen.indexOf(x.value) >= 0 ? on.indexOf(x.value) >= 0 : x.def; }).map(function (x) { return x.value; }));
  chips($('f-base'), items, checked, function () { saveForm({ base: layersAfterChange($('f-base'), form().base) }); tScene(); });
  saveForm({ seen: uniq(seen.concat(vals)), base: uniq(on.filter(function (f) { return vals.indexOf(f) < 0; }).concat(checked)) });
  tLockLayers();
}
// Učiteľ má plnú kontrolu nad vrstvami: hádaný typ sa už nezošedí, môže ho zapnúť (napr. rieky pri hádaní riek).
function tLockLayers() { lockLayers($('f-base'), [], form().base); }
function tBaseRefs() { return sceneRefs(T.regions, tCodes(), chipVals($('f-base'))); }
function tScene() {
  var codes = tCodes(), bbox = tBBox(codes), refs = tBaseRefs();
  if (!bbox) { $('prev-msg').textContent = t('t.pick_region'); $('prev-map').innerHTML = ''; T.scene = null; T.pview = null; tScoringInfo(); return; }
  bbox = bbox.map(function (x) { return Math.round(x * 1000) / 1000; });
  var key = JSON.stringify([bbox, refs]); if (key === T.sceneKey) return;
  T.sceneKey = key; $('prev-msg').textContent = t('t.loading_map');
  buildScene(bbox, refs).then(function (sc) {
    if (key !== T.sceneKey) return;
    T.scene = sc; $('prev-msg').textContent = '';
    if (sc.errors.length) tStatus('t-status', t('t.layer_errors', { files: sc.errors.map(function (e) { return e.file; }).join(', ') }), 'bad');
    T.pview = new MapView(freshSvg('prev-map'), sc, { overlay: tPreviewOverlay });
    mapControls($('prev-box'), function () { return T.pview; });
    tScoringInfo();
  });
}
// Náhľad s vybranými objektmi (len keď sú objekty ukázané): skupina A zelenou, B ružovou.
function tPreviewOverlay(v) {
  if (!T.listOpen) return '';
  var s = '', u = v.uPx(), palB = Object.assign({}, v.pal, { ok: v.pal.tip }), sets = [['A', T.slots, v.pal]].concat(T.groups ? [['B', T.slotsB, palB]] : []);
  sets.forEach(function (x) { x[1].forEach(function (o) { if (o) s += drawTarget(o.g, v.proj, x[2], 0); }); });
  sets.forEach(function (x) { x[1].forEach(function (o, i) { if (o) s += drawLabel(anchorOf(o.g), v.proj, (T.groups ? x[0] : '') + (i + 1) + '. ' + o.name, v.pal.ink, v.pal.halo, u, 12, o.g.t === 'pt' ? -12 : 0, false); }); });
  return s;
}
function tScoringInfo() {
  var pf = num($('f-full').value, 1), pz = num($('f-zero').value, 30), sc = T.scene;
  if (!sc) { $('f-km').textContent = ''; return; }
  var bad = !(pz > pf && pf >= 0);
  $('f-km').textContent = bad ? t('t.scoring_bad') : t('t.scoring_km', { diag: fmtKm(sc.diag), full: fmtKm(round1(sc.diag * pf / 100)), zero: fmtKm(round1(sc.diag * pz / 100)) });
  $('f-km').className = 'small ' + (bad ? 'bad' : 'muted');
}

/* ---------- spustenie testu ---------- */
// state: 'open' = spustiť hneď, 'ready' = pripraviť na neskôr (spustí ho učiteľ alebo dozor).
async function tStart(state) {
  if (T.oldScript) { tStatus('start-msg', t('t.old_script', { v: T.init.v || '1' }), 'bad'); return; }
  var clsSel = $('f-cls').value, open = clsSel === OPEN_CLS, title = $('f-title').value.trim(), sc = T.scene, groups = T.groups && !open;
  var pf = num($('f-full').value, 1), pz = num($('f-zero').value, 30), total = Math.max(1, Math.min(240, parseInt($('f-time').value, 10) || 10));
  // Pri skupinách ide do testu len úplný riadok (A aj B); celkom prázdny riadok sa vynechá.
  var rows = T.slots.map(function (a, i) { return { a: a, b: groups ? T.slotsB[i] : null }; });
  if (groups && rows.some(function (r) { return !!r.a !== !!r.b; })) { tStatus('start-msg', t('t.err_pairs'), 'bad'); if (!T.listOpen) tListToggle(true); return; }
  rows = rows.filter(function (r) { return r.a; });
  var chosen = rows.map(function (r) { return r.a; }), chosenB = groups ? rows.map(function (r) { return r.b; }) : [];
  var nameErr = tNameCheck(true);
  $('f-cls').classList.toggle('invalid', !clsSel);
  if (nameErr && nameErr !== 'empty') { var fi = $('f-title'); fi.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { fi.focus({ preventScroll: true }); }, 300); return; }
  if (!clsSel || !title) {
    tStatus('start-msg', t(!clsSel && !title ? 't.err_required' : !clsSel ? 't.err_class' : 't.err_title'), 'bad');
    var f = !clsSel ? $('f-cls') : $('f-title'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { f.focus({ preventScroll: true }); }, 300);
    return;
  }
  if (!chosen.length) { tStatus('start-msg', t('t.err_objects'), 'bad'); return; }
  if (!sc) { tStatus('start-msg', t('t.loading_map'), 'bad'); return; }
  if (!(pz > pf && pf >= 0)) { tStatus('start-msg', t('t.scoring_bad'), 'bad'); return; }
  var gi = groups ? tGroupInfo() : null;
  if (gi && gi.none.length && !confirm(t('t.groups_confirm', { names: gi.none.join(', ') }))) return;
  var tol = bboxSpan(sc.bbox) / 6000, dec = decFor(tol), objects = {};
  chosen.concat(chosenB).forEach(function (o) { objects[o.id] = { name: o.name, type: o.type, diff: o.diff, g: simpGeom(o.g, tol, dec) }; });
  var codes = tCodes(), types = uniq(chosen.concat(chosenB).map(function (o) { return o.type; }));
  var dmin = Math.min(+$('f-dmin').value, +$('f-dmax').value), dmax = Math.max(+$('f-dmin').value, +$('f-dmax').value);
  var cfg = {
    cls: open ? '' : clsSel, open: open, state: state, title: title,
    regions: codes.map(function (c) { var r = regionByCode(c); return regionLabel(c, r && r.names); }).join(', '), types: types.map(typeLabel).join(', '),
    diff: dmin === dmax ? String(dmin) : dmin + '–' + dmax, total: total, full: round1(sc.diag * pf / 100), zero: round1(sc.diag * pz / 100), diag: Math.round(sc.diag), lang: I18N.lang,
    map: { bbox: sc.bbox, base: tBaseRefs() }, names: chosen.map(function (o) { return o.name; }), namesB: chosenB.map(function (o) { return o.name; }),
    alt: groups && altOn(tGroupInfo())
  };
  $('start').disabled = $('prepare').disabled = true; tStatus('start-msg', t('t.saving'));
  try {
    var ids = function (l) { return l.map(function (o) { return o.id; }); };
    var r = await api('tCreateTest', A({ cfg: cfg, pack: { keys: ids(chosen), keysB: ids(chosenB), objects: objects } }));
    tStatus('start-msg', '');
    var x = { id: r.id, created: r.created || nowStr(), started: r.started !== undefined ? r.started : state === 'open' ? nowStr() : '', cls: r.cls || clsSel, open: open, regions: cfg.regions, title: r.id || title, n: chosen.length, groups: groups, alt: !!cfg.alt, total: total, state: state, dk: r.dk || '' };
    T.init.tests.push(x);
    (T.init.taken = T.init.taken || []).push(String(x.id).toLowerCase());
    // ďalší test sa začína s prázdnou triedou, názvom a skrytými objektmi
    $('f-cls').value = ''; $('f-title').value = ''; tNameCheck(); tClassChanged(); tListToggle(false); if (T.pview) T.pview.redraw();
    tStarted(x);
  } catch (e) { tStatus('start-msg', t('t.err_save', { msg: errText(e) }), 'bad'); }
  $('start').disabled = $('prepare').disabled = false;
  tNameCheck();
}
// Kontrola názvu testu: vráti chybu ('empty' | 'chars' | 'long' | 'taken') alebo ''. Chybný názov je červený a test sa nedá spustiť.
// Prázdny názov sa vyznačí až pri pokuse o spustenie (show).
function nameTaken(v) {
  var k = String(v).toLowerCase(), list = (T.init && T.init.taken) || ((T.init && T.init.tests) || []).map(function (x) { return String(x.id).toLowerCase(); });
  return list.indexOf(k) >= 0;
}
// own: vlastný názov testu pri premenovaní (nie je obsadený, dá sa zmeniť aj len veľkosť písmen)
function nameErr(v, own) {
  var max = (T.init && T.init.nameMax) || NAME_MAX;
  if (!v) return 'empty';
  if (v.length > max) return 'long';
  if (!NAME_RE.test(v)) return 'chars';
  if (own && v.toLowerCase() === String(own).toLowerCase()) return '';
  return nameTaken(v) ? 'taken' : '';
}
function tNameCheck(show) {
  var inp = $('f-title'), v = inp.value.trim(), max = (T.init && T.init.nameMax) || NAME_MAX;
  var err = nameErr(v);
  var mark = !!err && (err !== 'empty' || !!show);
  inp.classList.toggle('invalid', mark);
  tStatus('f-title-msg', mark && err !== 'empty' ? t('t.name_' + err, { max: max }) : '', 'bad');
  $('start').disabled = $('prepare').disabled = T.oldScript || (!!err && err !== 'empty');
  return err;
}
function nowStr() { var d = new Date(), p = function (x) { return ('0' + x).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
// „vytvorený 18.11. 08:38 · spustený 08:41“ (pri inom dni aj s dátumom), pripravený: „· nespustený“
function whenText(x) {
  var m = function (s) { return /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(String(s || '')); };
  var c = m(x.created), s = m(x.started), day = function (a) { return (+a[3]) + '.' + (+a[2]) + '.'; }, hm = function (a) { return a[4] + ':' + a[5]; };
  var out = [];
  if (c) out.push(t('t.when_created', { when: day(c) + ' ' + hm(c) })); else if (x.created) out.push(t('t.when_created', { when: x.created }));
  if (s) out.push(t('t.when_started', { when: c && day(c) === day(s) && c[1] === s[1] ? hm(s) : day(s) + ' ' + hm(s) }));
  else if (x.state === 'ready') out.push(t('t.when_not_started'));
  return out.join(' · ');
}
function tStarted(x) {
  tTab('started');
  var ready = x.state === 'ready';
  $('started-title').textContent = t(ready ? 't.ready_title' : 't.started_title', { title: x.title || x.id });
  $('started-text').textContent = t(ready ? 't.ready_text' : 't.started_text');
  $('started-qr').innerHTML = qrSvg(pupilUrl(x.id));
  $('started-link').textContent = pupilUrl(x.id); $('started-link').href = pupilUrl(x.id);
  $('started-go').hidden = !ready;
  $('started-go').onclick = async function () {
    $('started-go').disabled = true;
    try { await api('tSetTest', A({ t: x.id, patch: { state: 'open' } })); x.state = 'open'; if (!x.started) x.started = nowStr(); tStarted(x); }
    catch (e) { tStatus('t-status', errText(e), 'bad'); }
    $('started-go').disabled = false;
  };
  $('started-dozor').hidden = !x.dk;
  $('started-dozor').onclick = function () { tDozorShow(x); };
  $('started-full').onclick = function () { tQrCover(x.id, x.title); };
  $('started-open').onclick = function () { tOpenTest(x.id); };
  $('started-new').onclick = function () { tTab('new'); };
}
function tQrCover(id, title) { tQrShow(title || id, pupilUrl(id)); }
function tQrShow(title, url, opts) {
  opts = opts || {};
  $('qr-title').textContent = title; $('qr-big').innerHTML = qrSvg(url);
  $('qr-warn').textContent = opts.warn || ''; $('qr-warn').hidden = !opts.warn;
  $('qr-print').hidden = !opts.print; $('qr-print').onclick = opts.print || null;
  $('qr-link').innerHTML = ''; $('qr-link').appendChild(el('a', { href: url, target: '_blank', rel: 'noopener', text: url }));
  $('qr-cover').hidden = false;
}
// Dozor: QR kód pre suplujúceho a papier s dvoma kódmi (pre žiakov a pre dozor).
function tDozorShow(x) {
  tQrShow(t('t.dozor_title', { title: x.title || x.id }), dozorUrl(x.id, x.dk), { warn: t('t.dozor_warn'), print: function () { tPrint(x); } });
}
function tPrint(x) {
  var box = $('print-sheet'), meta = [x.open ? t('t.open_short') : t('t.class_short', { cls: x.cls }), t('t.n_objects', { n: x.n }), t('t.time_short', { n: x.total }), x.groups ? t('t.groups_ab') : '', x.alt ? t('t.alt_short') : ''].filter(Boolean).join(' · ');
  box.innerHTML = '';
  box.appendChild(el('h1', { text: t('app.title') + ': ' + (x.title || x.id) }));
  box.appendChild(el('p', { text: meta }));
  var qrs = el('div', { class: 'pr-qrs' });
  [[t('t.pr_pupils'), pupilUrl(x.id)], [t('t.pr_dozor'), dozorUrl(x.id, x.dk)]].forEach(function (q) {
    qrs.appendChild(el('div', { class: 'pr-qr' }, [el('h2', { text: q[0] }), el('div', { class: 'qr', html: qrSvg(q[1]) }), el('p', { class: 'pr-url', text: q[1] })]));
  });
  box.appendChild(qrs);
  box.appendChild(el('h2', { text: t('t.dz_title') }));
  var ol = el('ol');
  [1, 2, 3, 4, 5].forEach(function (i) { ol.appendChild(el('li', { html: t('t.dz_' + i) })); });
  box.appendChild(ol);
  setTimeout(function () { window.print(); }, 50);
}
// Odkaz na precvičovanie s rovnakými filtrami ako formulár (oblasť, typy, obtiažnosť, počet, čas, vrstvy mapy). Bez tabuľky a bez mien.
function tPractice() {
  // Čas na tip v precvičovaní: celkový čas testu rozdelený na objekty, zaokrúhlený na najbližšiu ponúkanú možnosť.
  var a = +$('f-dmin').value, b = +$('f-dmax').value, n = parseInt($('f-n').value, 10) || 10, per = (parseInt($('f-time').value, 10) || 10) * 60 / n;
  var time = [10, 15, 20, 30, 60].reduce(function (best, x) { return Math.abs(x - per) < Math.abs(best - per) ? x : best; }, 20);
  var q = 'r=' + tCodes().join(',') + '&t=' + chipVals($('f-types')).join(',') + '&d=' + Math.min(a, b) + '-' + Math.max(a, b) +
    '&n=' + n + '&s=' + time +
    '&l=' + chipVals($('f-base')).map(encodeURIComponent).join(',');
  tQrShow(t('t.practice_title'), appBase() + '?' + q);
}

/* ---------- zoznam testov ---------- */
function stateBadge(state) { return el('span', { class: 'badge' + (state === 'open' ? ' open' : state === 'archived' ? ' arch' : ''), text: t('state.' + state) }); }
async function tTests() {
  var box = $('tests-list');
  box.innerHTML = ''; box.appendChild(el('p', { class: 'muted' }, [el('span', { class: 'spin' }), t('common.loading')]));
  try { await refreshInit(); } catch (e) { /* ukážeme, čo máme */ }
  tTestsList();
}
// Zoznam testov: pri každom jedno tlačidlo (Otvoriť, pri archivovanom Obnoviť) a ponuka ⋯ s ostatnými akciami.
function tTestsList() {
  var box = $('tests-list');
  box.innerHTML = '';
  var rows = T.init.tests.slice().reverse();
  if (!rows.length) { box.appendChild(el('p', { class: 'muted', text: t('t.no_tests') })); return; }
  var tb = el('tbody');
  rows.forEach(function (x) {
    var arch = x.state === 'archived';
    var main = arch ? el('button', { type: 'button', class: 'mini', text: t('t.restore'), onclick: function () { tRestore(x, this); } })
      : el('button', { type: 'button', class: 'mini', text: t('t.open'), onclick: function () { tOpenTest(x.id); } });
    var kebab = el('button', { type: 'button', class: 'kebab', text: '⋯', title: t('t.menu'), 'aria-label': t('t.menu_of', { title: x.title || x.id }), 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      onclick: function () { menuOpen(this, testItems(x)); } });
    var when = whenText(x) + (arch && x.archived ? ' · ' + t('t.when_archived', { when: shortWhen(x.archived) }) : '');
    tb.appendChild(el('tr', { class: arch ? 'arch' : null }, [
      el('td', {}, [el('b', { text: x.title || x.id }), el('br'), el('span', { class: 'small muted', text: [when, onlyText(x)].filter(Boolean).join(' · ') }),
        x.note ? el('div', { class: 'notetxt small', text: x.note }) : null]),
      el('td', { text: x.open ? t('t.open_short') : x.cls }), el('td', { class: 'num', text: String(x.n) }),
      el('td', {}, [stateBadge(x.state)]),
      el('td', { class: 'act' }, [main, kebab])]));
  });
  box.appendChild(el('div', { class: 'tablebox' }, [el('table', {}, [el('thead', {}, [el('tr', {}, [t('t.col_test'), t('t.col_class'), t('t.col_objects'), t('t.col_state'), ''].map(function (h, i) { return el('th', { class: i === 2 ? 'num' : '', text: h }); }))]), tb])]));
}
// Náhradný termín: „náhradný termín (3 žiaci) · z testu Geo8A“
function onlyText(x) {
  if (!x.only && !x.src) return '';
  return [x.only ? t('t.only_n', { n: x.only }) : '', x.src ? t('t.src', { src: x.src }) : ''].filter(Boolean).join(' · ');
}
function shortWhen(s) { var m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(String(s || '')); return m ? (+m[3]) + '.' + (+m[2]) + '. ' + m[4] + ':' + m[5] : String(s || ''); }
// Archivovať a obnoviť sa dá zo zoznamu aj z prehľadu testu; archivovaný test prehľad nemá, preto sa ide do zoznamu.
async function tArchive(x, btn) {
  if (btn) btn.disabled = true;
  var fromTest = T.tab === 'test';
  say(t('t.archiving', { title: x.title || x.id }));
  try {
    await api('tArchive', A({ t: x.id }));
    x.prev = x.state; x.state = 'archived'; x.archived = nowStr();
    if (fromTest) { tStatus('test-msg', ''); tTab('tests'); } else { tTestsList(); refreshInit().then(function () { if (T.tab === 'tests') tTestsList(); }).catch(function () {}); }
    tStatus('tests-msg', t('t.archived_ok', { title: x.title || x.id }), 'ok');
  } catch (e) { if (btn) btn.disabled = false; say(errText(e), 'bad'); }
}
async function tRestore(x, btn) {
  if (btn) btn.disabled = true;
  tStatus('tests-msg', t('t.restoring', { title: x.title || x.id }));
  try {
    var r = await api('tRestore', A({ t: x.id }));
    x.state = r.state || x.prev || 'closed'; x.archived = '';
    tTestsList(); tStatus('tests-msg', t('t.restored_ok', { title: x.title || x.id }), 'ok');
    refreshInit().then(function () { if (T.tab === 'tests') tTestsList(); }).catch(function () {});
  } catch (e) { if (btn) btn.disabled = false; tStatus('tests-msg', errText(e), 'bad'); }
}
async function tDeleteTest(x, btn) {
  if (!confirm(t('t.delete_confirm', { title: x.title || x.id }))) return;
  if (btn) btn.disabled = true;
  tStatus('tests-msg', t('t.deleting', { title: x.title || x.id }));
  try {
    await api('tDeleteTest', A({ t: x.id }));
    T.init.tests = T.init.tests.filter(function (y) { return y.id !== x.id; });
    if (T.init.taken) T.init.taken = T.init.taken.filter(function (k) { return k !== String(x.id).toLowerCase(); });
    tTestsList(); tStatus('tests-msg', t('t.deleted_ok', { title: x.title || x.id }), 'ok');
  } catch (e) { if (btn) btn.disabled = false; tStatus('tests-msg', errText(e), 'bad'); }
}

/* ---------- jeden test ---------- */
// sub: otvoriť rovno záložku ('over' | 'class' | 'score'); force: tipy triedy ukázať aj pred uzavretím (učiteľ ich chce vidieť z ponuky)
async function tOpenTest(id, sub, force, msg) {
  tTab('test'); $('test-body').hidden = true; tStatus('test-msg', t('common.loading'));
  try {
    var d = await apiRetry('tTest', A({ t: id, withPack: true }), 3);
    var map = d.test.map || {};
    var scene = await buildScene(map.bbox || [-180, -60, 180, 85], map.base || []);
    T.cur = { id: id, d: d, pack: d.pack, scene: scene, dk: d.dk || T.dk }; T.cview = null; T.objKey = ''; T.imgRec = null;
    T.showRes = false; $('show-res').checked = false; T.classForce = !!force;
    if (sub) T.sub = sub;
    if (T.dz) T.sub = 'over';
    tPrepResults();
    $('test-qr').innerHTML = qrSvg(pupilUrl(id));
    $('test-qr-btn').onclick = function () { tQrCover(id, d.test.title); };
    $('test-dozor-btn').hidden = T.dz || !T.cur.dk;
    $('test-dozor-btn').onclick = function () { tDozorShow(tSummary()); };
    $('test-menu').hidden = T.dz || !T.init;
    $('test-menu').onclick = function () { menuOpen(this, testItems(testRef(), true)); };
    $('test-body').hidden = false; tStatus('test-msg', '');
    $('sc-image').hidden = true;
    tSub(T.sub); tPollStart();
    if (msg) tStatus(T.sub === 'class' ? 'class-vmsg' : 'test-msg', msg, 'ok');
  } catch (e) { tStatus('test-msg', errText(e), 'bad'); }
}
function tSummary() { var x = T.cur.d.test; return { id: x.id, title: x.title, cls: x.cls, open: x.open, n: keysA(x).length, total: x.total, groups: !!x.groups, dk: T.cur.dk }; }
// Objekty jednej skupiny (test bez skupín: všetky). Testy zo staršieho skriptu nemajú keysA.
function keysA(x) { return x.keysA || x.keys; }
// c: údaje testu (predvolene práve otvorený T.cur; ponuka v zozname si ich načíta samostatne)
function keysOf(r, c) { return r && r.keys ? r.keys : (c || T.cur).d.test.keys; }
function groupOfKey(k) { var x = T.cur.d.test; return x.groups && (x.keysB || []).indexOf(k) >= 0 ? 'B' : x.groups ? 'A' : ''; }
// Poradie objektu v jeho skupine pre popis „A3.“ / „B3.“ (bez skupín „3.“).
function keyLabel(k) { var x = T.cur.d.test, g = groupOfKey(k), list = g === 'B' ? x.keysB : keysA(x); return g + (list.indexOf(k) + 1) + '. '; }
// Posledný odovzdaný pokus každého žiaka, s percentami podľa aktuálnych hraníc.
// res = všetky odovzdané testy (aj učiteľ), stat = bez učiteľa (priemer, tipy triedy), absent = neprítomní.
function tPrepResults(c) {
  c = c || T.cur;
  var d = c.d, last = {};
  d.results.forEach(function (r) { var cur = last[r.pupilId]; if (!cur || !r.absent || cur.absent) last[r.pupilId] = r; });
  c.res = []; c.absent = {};
  Object.keys(last).forEach(function (k) { var r = last[k]; if (r.absent) c.absent[k] = r; else { r.pct = resPct(r, c); c.res.push(r); } });
  c.stat = c.res.filter(function (r) { return !r.teacher; });
}
// Percentá žiaka: priemer za objekty jeho skupiny, za odchod z testu mínus strhnutie (rovnako ako skript tabuľky).
// Anulovaný objekt: 'full' = 100 % každému, 'skip' = do priemeru sa nepočíta.
function resPct(r, c) {
  c = c || T.cur;
  var sc = c.d.test.scoring, v = c.d.test.voids || {}, keys = keysOf(r, c).filter(function (k) { return v[k] !== 'skip'; }), s = 0;
  keys.forEach(function (k) { s += v[k] === 'full' ? 1 : pctFor(r.km[k], sc.full, sc.zero); });
  return Math.max(0, (keys.length ? s / keys.length : 0) - (r.leaves > 0 ? c.d.penalty || 0 : 0));
}
function classAvg() { var a = T.cur.stat; return a.length ? a.reduce(function (s, r) { return s + r.pct; }, 0) / a.length : null; }
function tRefresh() {
  return api('tTest', A({ t: T.cur.id })).then(function (d) {
    if (!T.cur || d.test.id !== T.cur.id) return;
    d.pack = T.cur.pack; T.cur.d = d; tPrepResults(); tHead();
    if (T.sub === 'over') tOverview();
    else if (T.sub === 'class') { if ($('class-body').hidden) tClass(); else if (T.cview) { tClassStats(); T.cview.redraw(); } }
  });
}
// Obnova prehľadu každých 6 s; keď niekto čaká na vrátenie do testu, každé 3 s.
function tPollStart() {
  clearInterval(T.poll); T.pollN = 0;
  T.poll = setInterval(function () {
    if (T.tab !== 'test' || !T.cur || document.hidden || T.sub === 'score') return;
    if (++T.pollN % 2 && !(T.waiting && T.waiting.length)) return;
    tRefresh().catch(function () {});
  }, 3000);
}
function tSub(name) {
  T.sub = name;
  ['over', 'class', 'score'].forEach(function (n) { $('sub-' + n).hidden = n !== name; $('sub-' + n + '-b').classList.toggle('on', n === name); });
  tHead();
  if (name === 'over') tOverview(); else if (name === 'class') tClass(); else tScore();
}
var NEXT_STATE = { ready: 'open', open: 'closed', closed: 'open' };
function tHead() {
  var x = T.cur.d.test, b = $('test-state'), st = x.state;
  $('test-title').textContent = x.title || x.id;
  b.textContent = t('state.' + st); b.className = 'badge' + (st === 'open' ? ' open' : '');
  $('test-toggle').textContent = st === 'ready' ? t('t.start_test') : st === 'open' ? t('t.close_test') : t('t.reopen_test');
  $('test-toggle').className = st === 'closed' ? '' : 'primary';
  $('test-toggle-hint').textContent = st === 'ready' ? t('t.ready_hint') : st === 'open' ? t('t.close_hint') : t('t.closed_hint');
  $('test-meta').textContent = [x.open ? t('t.open_short') : t('t.class_short', { cls: x.cls }), x.regions, t('t.n_objects', { n: keysA(x).length }), x.groups ? t('t.groups_ab') : '', x.alt ? t('t.alt_short') : '',
    x.total ? t('t.time_short', { n: x.total }) : '', whenText(x), x.id !== x.title ? x.id : '', onlyText({ only: (x.only || []).length, src: x.src })].filter(Boolean).join(' · ');
  $('test-note').textContent = x.note ? t('t.note_label', { note: x.note }) : ''; $('test-note').hidden = !x.note || T.dz;
}
async function tToggleState() {
  var x = T.cur.d.test, next = NEXT_STATE[x.state] || 'open';
  if (next === 'closed' && !confirm(t('t.close_confirm'))) return;
  $('test-toggle').disabled = true;
  try {
    await api('tSetTest', A({ t: T.cur.id, patch: { state: next } }));
    x.state = next; if (next === 'open' && !x.started) x.started = nowStr(); tHead();
    if (T.init) T.init.tests.forEach(function (y) { if (y.id === T.cur.id) { y.state = next; if (next === 'open' && !y.started) y.started = x.started; } });
    if (T.sub === 'class') tClass();
  } catch (e) { tStatus('test-msg', errText(e), 'bad'); }
  $('test-toggle').disabled = false;
}

/* prehľad */
// Riadky prehľadu: žiaci triedy (učiteľ na konci), k tomu odovzdané testy mien, ktoré už v zozname nie sú.
function tRows(c) {
  c = c || T.cur;
  var d = c.d, rows = d.pupils.map(function (p) { return { id: p.id, label: p.teacher ? t('p.teacher') : p.label, teacher: !!p.teacher, group: p.group || '', nogroup: !!p.nogroup }; });
  c.res.forEach(function (r) { if (!rows.some(function (p) { return p.id.split('#')[0] === r.pupilId; })) rows.push({ id: r.pupilId, label: r.teacher ? t('p.teacher') : r.name, teacher: r.teacher, group: r.group || '' }); });
  return rows.filter(function (p) { return !p.teacher; }).concat(rows.filter(function (p) { return p.teacher; }));
}
function tOverview() {
  var d = T.cur.d, x = d.test, by = {}, done = 0, writing = 0, absent = 0, total = 0, tb = el('tbody'), seen = {}, list = [], waiting = [];
  T.cur.res.forEach(function (r) { by[r.pupilId] = r; });
  tRows().forEach(function (p) {
    var key = p.id.split('#')[0], r = seen[key] ? null : by[key], L = d.logins.p[p.id], ab = !r && !L && !!T.cur.absent[key], st, cls = '', btn = null;
    if (r && L && !L.done) r = null;   // odovzdal, ale znova píše (pridaný čas alebo nový pokus)
    seen[key] = 1;
    if (!p.teacher) total++;
    var pr = d.prog && d.prog[p.id];
    if (r) { st = t('t.st_done', { time: (/(\d\d:\d\d)/.exec(r.sent) || [])[1] || '' }); cls = 'ok'; if (!p.teacher) done++; }
    else if (L) { st = pr ? t('t.st_writing_n', { time: String(L.t).slice(0, 5), n: pr.n, total: keysA(x).length }) : t('t.st_writing', { time: String(L.t).slice(0, 5) }); if (!p.teacher) writing++; }
    else if (ab) { st = t('t.st_absent'); cls = 'absent'; absent++; }
    else st = t('t.st_none');
    var flags = r && r.flag ? [r.flag] : d.logins.f.filter(function (f) { return f.p === p.id; }).map(function (f) { return f.k + ' ' + f.t; });
    if (!r && pr && pr.sh) flags.push(t('t.short_n', { n: pr.sh }));
    if (!r && L && pr && pr.rw) st = t('t.st_reopen');
    // zamknutý alebo práve mimo testu: čaká na učiteľa (vrátiť, vrátiť so strhnutím, ukončiť)
    var wait = !!(L && !r && pr && (pr.lock || pr.away));
    if (wait) {
      st = t(pr.lock ? 't.st_lock' : 't.st_away', { time: pr.lock || pr.away, why: pr.why || '' }); cls = 'bad';
      waiting.push({ id: p.id, label: p.label });
      btn = [el('button', { type: 'button', class: 'mini primary', text: t('t.ret_ok'), onclick: function () { tReturn(p, 'ok', this); } }),
        pr.lv ? null : el('button', { type: 'button', class: 'mini', text: t('t.ret_pen', { pct: Math.round((d.penalty || 0) * 100) }), onclick: function () { tReturn(p, 'pen', this); } }),
        el('button', { type: 'button', class: 'mini', text: t('t.ret_end'), onclick: function () { tReturn(p, 'end', this); } })];
    }
    else if (L) btn = el('button', { type: 'button', class: 'mini', text: r ? t('t.allow_retry') : t('t.unlock'), onclick: function () {
      if (r && !confirm(t('t.retry_confirm', { name: p.label }))) return;
      api('tUnlock', A({ t: T.cur.id, p: p.id })).then(function () { delete d.logins.p[p.id]; tOverview(); }).catch(function (e) { tStatus('test-msg', errText(e), 'bad'); });
    } });
    else if (!r && !p.teacher && !x.open && !T.oldScript) btn = el('button', { type: 'button', class: 'mini', text: ab ? t('t.unmark_absent') : t('t.mark_absent'), onclick: function () { tAbsent(p, !ab, this); } });
    // pridať čas: kto píše (aj zamknutý), aj kto už odovzdal (test sa mu znova otvorí s jeho tipmi)
    var writes = !!(L && !r && pr && pr.left !== null && pr.left !== undefined), again = !!(r && L && L.done && d.again && d.again[p.id]);
    if (x.state === 'open' && !T.oldScript && (writes || again)) {
      if (writes && pr.ad) st += ' · ' + t('t.added', { n: pr.ad });
      btn = [el('button', { type: 'button', class: 'mini', text: t('t.add_time', { n: d.addMin || 2 }), title: t(again ? 't.add_again_hint' : 't.add_time_hint', { n: d.addMin || 2 }),
        onclick: function () { if (again && !confirm(t('t.add_again_confirm', { name: p.label, n: d.addMin || 2 }))) return; tAddTime(p.id, this); } })].concat(btn);
    }
    // obrázok jedného žiaka rovno na Disk (napr. na rozhovor s rodičom); rovnomenný súbor sa nahradí
    if (r && !T.dz) btn = [].concat(btn, [el('button', { type: 'button', class: 'mini', text: t('t.image'), title: t('t.image_hint'), onclick: function () { tSaveOne(r, p.label, this); } })]);
    list.push({ p: p, r: r, st: st, cls: cls, flags: flags, btn: btn, wait: wait });
  });
  // stĺpec Príznak len vtedy, keď nejaký príznak je (na telefóne by inak tabuľka nevošla)
  var anyFlag = list.some(function (o) { return o.flags.length; });
  list.forEach(function (o) {
    var nm = el('td', {}, [o.p.label, x.groups && o.p.group && !o.p.teacher ? el('span', { class: 'badge' + (o.p.nogroup ? ' warn' : ''), style: 'margin-left:6px', title: o.p.nogroup ? t('t.no_group') : null, text: o.p.group }) : null]);
    var cells = [nm, el('td', { class: o.cls, text: o.st })];
    if (T.showRes) cells.push(el('td', { class: 'num', text: o.r ? fmtPct(o.r.pct) : '' }));
    if (anyFlag) cells.push(el('td', { class: o.flags.length ? 'bad small' : 'small', text: o.flags.join('; ') }));
    cells.push(el('td', { class: 'act' }, [].concat(o.btn)));
    tb.appendChild(el('tr', { class: o.wait ? 'wait' : null }, cells));
  });
  tWaiting(waiting);
  var addAll = $('over-add');
  addAll.hidden = !(x.state === 'open' && !T.oldScript && list.some(function (o) { var pr = d.prog && d.prog[o.p.id]; return !o.r && d.logins.p[o.p.id] && pr && pr.left !== null && pr.left !== undefined; }));
  addAll.textContent = t('t.add_time_all', { n: d.addMin || 2 });
  $('over-sum').textContent = t('t.over_sum', { done: done, total: total - absent, writing: writing }) + (absent ? ' ' + t('t.over_absent', { n: absent }) : '');
  var heads = [t('t.col_pupil'), t('t.col_status')].concat(T.showRes ? [t('t.col_result')] : []).concat(anyFlag ? [t('t.col_flag')] : []).concat(['']);
  var box = $('over-table'); box.innerHTML = '';
  box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, heads.map(function (h, i) { return el('th', { class: T.showRes && i === 2 ? 'num' : '', text: h }); }))]), tb]));
  var avg = classAvg();
  $('avg-label').textContent = t(x.open ? 't.avg_label_open' : 't.avg_label');
  $('avg-pct').textContent = avg === null ? '–' : fmtPct(avg);
  $('avg-note').textContent = avg === null ? t('t.no_results') : t(x.open ? 't.avg_note_open' : 't.avg_note', { pct: Math.round((d.penalty || 0) * 100) });
}
// Žiaci, ktorí čakajú na vrátenie do testu: upozornenie nad tabuľkou, počet v názve karty a pípnutie pri novom.
function tWaiting(list) {
  var old = T.waiting || [], fresh = list.some(function (w) { return !old.some(function (o) { return o.id === w.id; }); });
  T.waiting = list;
  $('over-lock').hidden = !list.length;
  if (list.length) $('over-lock').textContent = t('t.lock_wait', { names: list.map(function (w) { return w.label; }).join(', ') });
  document.title = (list.length ? '(' + list.length + ') ' : '') + document.title.replace(/^\(\d+\) /, '');
  if (fresh) tBeep();
}
function tBeep() {
  try {
    var c = T.ac || (T.ac = new (window.AudioContext || window.webkitAudioContext)()), o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 880; g.gain.value = 0.12; o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.25);
  } catch (e) { /* bez zvuku */ }
}
async function tReturn(p, m, btn) {
  if (m === 'end' && !confirm(t('t.end_confirm', { name: p.label }))) return;
  if (btn) btn.disabled = true;
  try { await api('tReturn', A({ t: T.cur.id, p: p.id, m: m })); await tRefresh(); }
  catch (e) { tStatus('test-msg', errText(e), 'bad'); if (btn) btn.disabled = false; }
}
// Pridať čas jednému žiakovi (id) alebo všetkým, ktorí práve píšu ('*'). Dá sa ťukať opakovane.
async function tAddTime(pid, btn) {
  if (pid === '*' && !confirm(t('t.add_all_confirm', { n: T.cur.d.addMin || 2 }))) return;
  if (btn) btn.disabled = true;
  try { await api('tAddTime', A({ t: T.cur.id, p: pid })); await tRefresh(); }
  catch (e) { tStatus('test-msg', errText(e), 'bad'); }
  if (btn) btn.disabled = false;
}
async function tAbsent(p, on, btn) {
  if (btn) btn.disabled = true;
  try { await api('tAbsent', A({ t: T.cur.id, p: p.id, on: on })); await tRefresh(); }
  catch (e) { tStatus('test-msg', errText(e), 'bad'); if (btn) btn.disabled = false; }
}
// Žiaci podľa abecedy (ako v hárku výsledkov), bez učiteľa.
function sortedRows(c) { return tRows(c).filter(function (p) { return !p.teacher; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); }); }
// Výsledky do Excelu: meno a percentá (bez učiteľa), neprítomní s textom. Žiaci podľa abecedy.
function tCopyResults() {
  var g = !!T.cur.d.test.groups, by = {}, seen = {}, lines = [[t('t.tsv_pupil')].concat(g ? [t('t.tsv_group')] : [], [t('t.tsv_result')]).join('\t')];
  T.cur.res.forEach(function (r) { by[r.pupilId] = r; });
  sortedRows().forEach(function (p) {
    var key = p.id.split('#')[0]; if (p.teacher || seen[key]) return; seen[key] = 1;
    var r = by[key];
    lines.push([p.label].concat(g ? [r ? r.group : p.group] : [], [r ? Math.round(r.pct * 100) : T.cur.absent[key] ? t('t.st_absent') : '']).join('\t'));
  });
  copyText(lines.join('\n'), 'over-msg', t('t.copied_results'));
}

/* tipy triedy */
function objStats(k) {
  var d = T.cur.d, sc = d.test.scoring, ds = [], miss = 0, full = 0, sumP = 0, n = 0;
  T.cur.stat.forEach(function (r) {
    if (keysOf(r).indexOf(k) < 0) return;   // objekt druhej skupiny
    var v = r.km[k]; n++;
    if (v === null || v === undefined) { miss++; ds.push(Infinity); } else { ds.push(v); if (v <= sc.full) full++; }
    sumP += pctFor(v, sc.full, sc.zero);
  });
  var med = median(ds), diag = d.test.diag || T.cur.scene.diag || 1, rel = med === null ? null : med / diag;
  return { n: n, miss: miss, full: full, med: med, avg: n ? sumP / n : 0, suggest: rel === null ? null : rel < 0.01 ? 1 : rel < 0.03 ? 2 : rel < 0.07 ? 3 : rel < 0.15 ? 4 : 5 };
}
// Tipy triedy sú až po uzavretí testu (učiteľ môže mať obrazovku na projektore), inak len na požiadanie.
function tClass() {
  var gate = T.cur.d.test.state !== 'closed' && !T.classForce;
  $('class-gate').hidden = !gate; $('class-body').hidden = gate;
  if (gate) return;
  var keys = T.cur.d.test.keys, pack = T.cur.pack;
  if (keys.indexOf(T.objKey) < 0) T.objKey = keys[0];
  var sel = $('class-obj'); sel.innerHTML = '';
  var vd = T.cur.d.test.voids || {};
  keys.forEach(function (k) { sel.appendChild(el('option', { value: k, text: keyLabel(k) + (vd[k] ? '⊘ ' : '') + pack.objects[k].name })); }); sel.value = T.objKey;
  var o = pack.objects[T.objKey];
  var ck = $('class-kind'); ck.innerHTML = ''; ck.appendChild(typeIcon(o.type)); ck.appendChild(document.createTextNode(typeOne(o.type)));
  voidCtl();
  tClassStats();
  if (!T.cview) { T.cview = new MapView(freshSvg('class-map'), T.cur.scene, { overlay: tClassOverlay }); mapControls($('class-box'), function () { return T.cview; }); }
  T.cview.zoomTo(bboxUnion(geomBBox(o.g), tTipsBBox(T.objKey) || geomBBox(o.g)));
}
function tTipsBBox(k) { var b = null; T.cur.stat.forEach(function (r) { var x = r.tips[k]; if (x) b = bboxUnion(b, [x[1], x[0], x[1], x[0]]); }); return b; }
function tClassOverlay(v) {
  var o = T.cur.pack.objects[T.objKey], s = drawTarget(o.g, v.proj, v.pal, 0, true), u = v.uPx();
  T.cur.stat.forEach(function (r) {
    var x = r.tips[T.objKey]; if (!x) return;
    var c = [x[1], x[0]];
    s += drawDot(c, v.proj, v.pal.tip, v.pal.halo, 11, 0);
    if (T.showNames) s += drawLabel(c, v.proj, r.name.split(' ')[0], v.pal.ink, v.pal.halo, u, 12, -11, false);
  });
  return s;
}
function tClassStats() {
  var keys = T.cur.d.test.keys, pack = T.cur.pack, s = objStats(T.objKey);
  $('class-stats').innerHTML = '';
  [[t('t.st_tips'), (s.n - s.miss) + ' / ' + s.n], [t('t.st_median'), s.med === null ? '–' : fmtKm(s.med)], [t('t.st_full'), s.full + ' / ' + s.n],
    [t('t.st_avg'), s.n ? fmtPct(s.avg) : '–'], [t('t.st_suggest'), s.suggest === null ? '–' : String(s.suggest)]]
    .forEach(function (x) { $('class-stats').appendChild(el('div', {}, [el('span', { class: 'small muted', text: x[0] }), el('b', { text: x[1] })])); });
  var tb = el('tbody');
  keys.map(function (k) { return { k: k, s: objStats(k) }; }).sort(function (a, b) { return a.s.avg - b.s.avg; }).forEach(function (x) {
    tb.appendChild(el('tr', { class: x.k === T.objKey ? 'sel' : '' }, [
      el('td', {}, [el('button', { type: 'button', class: 'linkbtn', text: (T.cur.d.test.groups ? groupOfKey(x.k) + ': ' : '') + ((T.cur.d.test.voids || {})[x.k] ? '⊘ ' : '') + pack.objects[x.k].name, onclick: function () { T.objKey = x.k; tClass(); } })]),
      el('td', { class: 'num', text: x.s.med === null ? '–' : fmtKm(x.s.med) }), el('td', { class: 'num', text: x.s.n ? fmtPct(x.s.avg) : '–' }),
      el('td', { class: 'num', text: x.s.suggest === null ? '–' : String(x.s.suggest) })]));
  });
  var box = $('class-rank'); box.innerHTML = '';
  box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, [t('t.col_obj_hard'), t('t.st_median'), t('t.st_avg'), t('t.st_suggest')].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); }))]), tb]));
}
function tClassStep(dir) { var keys = T.cur.d.test.keys, i = keys.indexOf(T.objKey); T.objKey = keys[(i + dir + keys.length) % keys.length]; tClass(); }
// Štatistiky na vloženie vedľa tabuľky obtiažností (*_difficulty_edit.csv): id ako v tabuľke (pri EČV id okresu), typ,
// obtiažnosť, s ktorou bol objekt v teste, a návrh podľa mediánu odchýlky triedy. Oddelené tabulátorom.
function tCopyStats() {
  var pack = T.cur.pack, g = !!T.cur.d.test.groups;
  var lines = [[t('t.tsv_id'), t('t.tsv_name'), t('t.tsv_type')].concat(g ? [t('t.tsv_group')] : [], [t('t.tsv_diff'), t('t.st_tips'), t('t.st_median'), t('t.st_avg'), t('t.st_suggest')]).join('\t')];
  T.cur.d.test.keys.forEach(function (k) {
    var s = objStats(k), o = pack.objects[k], dot = function (x) { return String(x).replace('.', I18N.lang === 'en' ? '.' : ','); };
    var id = o.type && k.slice(-(o.type.length + 1)) === '-' + o.type ? k.slice(0, -(o.type.length + 1)) : k;   // odvodený typ (EČV): id okresu
    lines.push([id, o.name, typeOne(o.type)].concat(g ? [groupOfKey(k)] : [], [o.diff || '', s.n - s.miss, s.med === null || s.med === Infinity ? '' : dot(round1(s.med)), s.n ? Math.round(s.avg * 100) : '', s.suggest === null ? '' : s.suggest]).join('\t'));
  });
  copyText(lines.join('\n'), 'class-msg', t('t.copied'));
}

/* hodnotenie a obrázky */
function tScore() {
  var x = T.cur.d.test, sc = x.scoring, diag = x.diag || T.cur.scene.diag;
  $('sc-full').value = sc.full; $('sc-zero').value = sc.zero;
  var avg = classAvg();
  $('sc-info').textContent = t('t.score_info', { full: nf(sc.full / diag * 100, 1), zero: nf(sc.zero / diag * 100, 1), diag: fmtKm(diag) }) + ' ' +
    (avg === null ? t('t.no_results') : t('t.avg_class', { avg: fmtPct(avg), n: T.cur.stat.length }));
  var box = $('sc-table'); box.innerHTML = '';
  if (!T.showRes) {
    $('sc-image').hidden = true;
    box.appendChild(el('div', { style: 'padding:12px' }, [el('button', { type: 'button', text: t('t.show_results'), onclick: function () { $('show-res').checked = true; T.showRes = true; tScore(); } })]));
    return;
  }
  var tb = el('tbody');
  T.cur.res.slice().sort(function (a, b) { return a.teacher - b.teacher || a.name.localeCompare(b.name, I18N.lang); }).forEach(function (r) {
    tb.appendChild(el('tr', {}, [el('td', { text: (r.teacher ? t('p.teacher') : r.name) + (r.group ? ' (' + r.group + ')' : '') }), el('td', { class: 'num', text: fmtPct(r.pct) }),
      el('td', {}, [el('button', { type: 'button', class: 'mini', text: t('t.image'), onclick: function () { tShowImage(r); } })])]));
  });
  if (!T.cur.res.length) box.appendChild(el('p', { class: 'muted', style: 'padding:12px', text: t('t.no_results') }));
  else box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, [t('t.col_pupil'), t('t.col_result'), ''].map(function (h, i) { return el('th', { class: i === 1 ? 'num' : '', text: h }); }))]), tb]));
}
async function tSaveScoring() {
  var sc = { full: num($('sc-full').value, NaN), zero: num($('sc-zero').value, NaN) };
  if (!(sc.zero > sc.full && sc.full >= 0)) { tStatus('sc-msg', t('t.scoring_bad'), 'bad'); return; }
  try {
    await api('tSetTest', A({ t: T.cur.id, patch: { scoring: sc } }));
    T.cur.d.test.scoring = sc; tPrepResults(); tStatus('sc-msg', t('t.scoring_saved'), 'ok'); tScore();
  } catch (e) { tStatus('sc-msg', errText(e), 'bad'); }
}
function recFor(r) {
  var x = T.cur.d.test, pack = T.cur.pack;
  return { title: x.title || t('app.title'), name: r.name, cls: x.cls, when: (r.sent || '').slice(0, 10), pct: r.pct, scoring: x.scoring,
    items: keysOf(r).map(function (k) { var o = pack.objects[k], tip = r.tips[k]; return { name: o.name, type: o.type, g: o.g, c: tip ? [tip[1], tip[0]] : null, d: r.km[k], why: r.km[k] === null ? (r.why[k] || 'none') : '', void: (x.voids || {})[k] || '' }; }) };
}
function fileNameFor(r) { return (T.cur.d.test.cls + ' ' + r.name + '.png').replace(/[\\/:*?"<>|]/g, '_'); }
async function tShowImage(r) {
  var box = $('sc-image'); box.hidden = false; $('sc-img').hidden = true; tStatus('sc-img-msg', t('common.drawing'));
  try {
    var url = await sheetPng(T.cur.scene, recFor(r));
    $('sc-img').src = url; $('sc-img').alt = r.name; $('sc-img').hidden = false; tStatus('sc-img-msg', '');
    $('sc-img-dl').onclick = function () { downloadUrl(url, fileNameFor(r)); };
    $('sc-img-save').onclick = async function () {
      tStatus('sc-img-msg', t('t.saving_drive'));
      try { var s = await api('tSaveImage', A({ t: T.cur.id, name: fileNameFor(r), b64: url.split(',')[1] })); $('sc-img-msg').innerHTML = esc(t('t.saved_drive')) + ' <a target="_blank" rel="noopener" href="' + esc(s.url) + '">' + esc(fileNameFor(r)) + '</a>'; $('sc-img-msg').className = 'small ok'; }
      catch (e) { tStatus('sc-img-msg', errText(e), 'bad'); }
    };
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { tStatus('sc-img-msg', errText(e), 'bad'); }
}
async function tSaveOne(r, label, btn) {
  btn.disabled = true; tStatus('over-msg', t('t.image_one', { name: label }));
  try {
    var url = await sheetPng(T.cur.scene, recFor(r));
    var s = await apiRetry('tSaveImage', A({ t: T.cur.id, name: fileNameFor(r), b64: url.split(',')[1] }), 3);
    $('over-msg').innerHTML = esc(t('t.saved_drive')) + ' <a target="_blank" rel="noopener" href="' + esc(s.url) + '">' + esc(fileNameFor(r)) + '</a> · <a target="_blank" rel="noopener" href="' + esc(s.folderUrl) + '">' + esc(t('t.open_folder')) + '</a>';
    $('over-msg').className = 'small ok'; $('over-msg').hidden = false;
  } catch (e) { tStatus('over-msg', errText(e), 'bad'); }
  btn.disabled = false;
}
async function tExportAll() {
  var rs = T.cur.stat, folder = '';
  if (!rs.length) { tStatus('sc-msg', t('t.no_results'), 'bad'); return; }
  $('sc-export').disabled = true;
  try {
    for (var i = 0; i < rs.length; i++) {
      tStatus('sc-msg', t('t.export_progress', { i: i + 1, n: rs.length }));
      var url = await sheetPng(T.cur.scene, recFor(rs[i]));
      folder = (await apiRetry('tSaveImage', A({ t: T.cur.id, name: fileNameFor(rs[i]), b64: url.split(',')[1] }), 3)).folderUrl;
    }
    $('sc-msg').innerHTML = esc(t('t.export_done', { n: rs.length })) + ' <a target="_blank" rel="noopener" href="' + esc(folder) + '">' + esc(t('t.open_folder')) + '</a>';
    $('sc-msg').className = 'small ok'; $('sc-msg').hidden = false;
  } catch (e) { tStatus('sc-msg', t('t.export_failed', { msg: errText(e) }), 'bad'); }
  $('sc-export').disabled = false;
}

/* ---------- ponuka ⋯ pri teste ---------- */
// Jedna ponuka pre zoznam aj prehľad testu. Položka: {label, run, disabled, hint (prečo je vypnutá), danger} alebo {sep: 1}.
var MENU = { btn: null };
function menuOpen(btn, items) {
  if (MENU.btn === btn) { menuClose(true); return; }
  menuClose();
  var m = $('menu'); m.innerHTML = '';
  items.forEach(function (it) {
    if (!it) return;
    if (it.sep) { if (m.lastChild && !m.lastChild.classList.contains('sep')) m.appendChild(el('div', { class: 'sep', role: 'separator' })); return; }
    m.appendChild(el('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : null, disabled: !!it.disabled, onclick: function () { menuClose(); it.run(); } },
      [el('span', { text: it.label }), it.disabled && it.hint ? el('small', { text: it.hint }) : null]));
  });
  while (m.lastChild && m.lastChild.classList.contains('sep')) m.lastChild.remove();
  m.hidden = false; MENU.btn = btn; btn.setAttribute('aria-expanded', 'true');
  // pod tlačidlom, zarovnané k jeho pravému okraju; keď sa dole nezmestí, nad ním. Ponuka je v stránke (posúva sa s ňou).
  var r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  var top = r.bottom + 4;
  if (top + mh > vh - 8) top = r.top - mh - 4 >= 8 ? r.top - mh - 4 : Math.max(8, vh - mh - 8);
  m.style.left = (Math.max(8, Math.min(r.right - mw, vw - mw - 8)) + window.scrollX) + 'px'; m.style.top = (top + window.scrollY) + 'px';
  var first = m.querySelector('button:not([disabled])'); if (first) first.focus();
}
function menuClose(focus) {
  var m = $('menu'), b = MENU.btn;
  if (m.hidden) return;
  m.hidden = true; m.innerHTML = ''; MENU.btn = null;
  if (b) { b.setAttribute('aria-expanded', 'false'); if (focus) b.focus(); }
}
// Akcie testu x (záznam zo zoznamu). inView: ponuka v prehľade testu.
function testItems(x, inView) {
  var arch = x.state === 'archived', open = x.state === 'open', title = x.title || x.id;
  var need = function (it) { if (!T.feat) { it.disabled = true; it.hint = t('t.need_script', { v: FEAT_SCRIPT }); } return it; };
  var toClass = function (msg) { if (inView) { T.classForce = true; tSub('class'); if (msg) tStatus('class-vmsg', msg, 'ok'); } else tOpenTest(x.id, 'class', true, msg); };
  return [
    arch ? null : { label: t('t.m_class'), run: function () { toClass(''); } },
    arch ? null : { label: t('t.m_preview'), run: function () { tPupilPreview(x); } },
    { sep: 1 },
    { label: t(arch ? 't.m_open_arch' : 't.m_open_res'), run: function () { openSheet(x); } },
    { sep: 1 },
    arch ? null : { label: t('t.m_grades'), run: function () { tGradesDlg(x); } },
    arch ? null : need({ label: t('t.m_recalc'), run: function () { tRecalcDlg(x); } }),
    arch ? null : need({ label: t('t.m_void'), run: function () { toClass(t('t.void_pick')); } }),
    { sep: 1 },
    need({ label: t('t.m_note'), run: function () { tNoteDlg(x); } }),
    need({ label: t('t.m_rename'), disabled: open, hint: open ? t('t.rename_open_hint') : '', run: function () { tRenameDlg(x); } }),
    need({ label: t('t.m_duplicate'), run: function () { tDupDlg(x); } }),
    { sep: 1 },
    arch ? { label: t('t.restore'), run: function () { tRestore(x); } }
      : { label: t('t.archive'), disabled: open, hint: open ? t('t.archive_open_hint') : '', run: function () { if (confirm(t('t.archive_confirm', { title: title }))) tArchive(x); } },
    arch ? { label: t('t.delete'), danger: true, run: function () { tDeleteTest(x); } } : null
  ];
}
// Záznam testu zo zoznamu pre práve otvorený prehľad (stav a poznámka z prehľadu sú novšie).
function testRef() {
  var d = T.cur.d.test, x = (T.init && T.init.tests || []).filter(function (y) { return y.id === T.cur.id; })[0];
  if (!x) { x = { id: d.id, title: d.title, cls: d.cls, open: d.open, regions: d.regions, n: keysA(d).length, groups: d.groups, alt: d.alt, total: d.total, created: d.created, started: d.started }; if (T.init) T.init.tests.push(x); }
  x.state = d.state; x.note = d.note || ''; x.total = d.total;
  return x;
}
async function refreshInit() {
  var init = await apiRetry('tInit', A(), 2);
  ['tests', 'taken', 'classes', 'groups', 'custom', 'ssId', 'grades', 'sheetUrl'].forEach(function (k) { if (init[k] !== undefined) T.init[k] = init[k]; });
  T.feat = cmpVer(init.v, FEAT_SCRIPT) >= 0;
  return T.init;
}
// Hlásenie pod zoznamom alebo pod hlavičkou testu, podľa toho, kde učiteľ je.
function say(msg, cls) { tStatus(T.tab === 'test' ? 'test-msg' : 'tests-msg', msg, cls); }
// Údaje testu (žiaci, výsledky, balík objektov) pre akciu z ponuky: z otvoreného prehľadu, inak sa načítajú.
async function curFor(id) {
  if (T.cur && T.cur.id === id && T.cur.pack) return T.cur;
  var d = await apiRetry('tTest', A({ t: id, withPack: true }), 3);
  var c = { id: id, d: d, pack: d.pack || null, dk: d.dk };
  tPrepResults(c);
  return c;
}

/* ---------- okno s otázkou (dialóg) ---------- */
// o: {title, body: [prvky], buttons: [{text, primary, danger, run: async () => true = nechať okno otvorené}]}
var DLG = { busy: false, onclose: null };
function dlgOpen(o) {
  menuClose();
  $('dlg-title').textContent = o.title;
  var body = $('dlg-body'); body.innerHTML = '';
  [].concat(o.body || []).forEach(function (n) { if (n) body.appendChild(typeof n === 'string' ? el('p', { text: n }) : n); });
  dlgMsg(''); dlgButtons(o.buttons || [{ text: t('common.close') }]);
  DLG.busy = false; DLG.onclose = o.onclose || null;
  $('dlg').hidden = false;
  // na telefóne nie do políčka (klávesnica by zakryla okno), len na tlačidlo
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var f = (!touch && body.querySelector('input:not([type=radio]):not([type=checkbox]),textarea')) || $('dlg-btns').querySelector('button.primary:not([disabled])') || $('dlg-btns').querySelector('button');
  if (f) setTimeout(function () { f.focus({ preventScroll: true }); if (f.tagName === 'INPUT' && f.select) f.select(); }, 0);
}
function dlgButtons(list) {
  var row = $('dlg-btns'); row.innerHTML = '';
  list.forEach(function (b) {
    if (!b) return;
    var btn = el('button', { type: 'button', class: [b.primary ? 'primary' : '', b.danger ? 'danger' : ''].join(' ').trim() || null, text: b.text });
    btn.onclick = async function () {
      if (!b.run) { dlgClose(); return; }
      dlgBusy(true); dlgMsg(b.wait || t('common.working'));
      var keep;
      try { keep = await b.run(btn); if (keep !== true) dlgMsg(''); } catch (e) { dlgMsg(errText(e), 'bad'); keep = true; }
      dlgBusy(false);
      if (keep !== true) dlgClose();
    };
    b.el = btn; row.appendChild(btn);
  });
}
function dlgBusy(on) { DLG.busy = on; $('dlg-btns').querySelectorAll('button').forEach(function (b) { b.disabled = on || b.dataset.off === '1'; }); }
function dlgOff(btn, off) { if (!btn) return; btn.dataset.off = off ? '1' : ''; btn.disabled = !!off || DLG.busy; }
function dlgMsg(m, cls) { tStatus('dlg-msg', m, cls); }
function dlgClose() {
  if (DLG.busy) return;
  $('dlg').hidden = true; $('dlg-body').innerHTML = ''; $('dlg-btns').innerHTML = '';
  var f = DLG.onclose; DLG.onclose = null; if (f) f();
}
function field(label, input, extra) { return el('label', {}, [el('span', { text: label }), input].concat(extra || [])); }
function radios(name, opts, val, onchange) {
  return el('div', { class: 'chips' }, opts.map(function (o) {
    var inp = el('input', { type: 'radio', name: name, value: o[0] }); inp.checked = o[0] === val;
    inp.onchange = function () { if (onchange) onchange(o[0]); };
    return el('label', { class: 'chip' }, [inp, ' ' + o[1]]);
  }));
}
function radioVal(box) { var c = box.querySelector('input:checked'); return c ? c.value : ''; }

/* ---------- otvoriť výsledky v tabuľke ---------- */
function sheetHref(gid, row) {
  var base = T.init && T.init.ssId ? 'https://docs.google.com/spreadsheets/d/' + T.init.ssId + '/edit' : String(T.init && T.init.sheetUrl || '').split('#')[0];
  return base + (gid !== null && gid !== undefined ? '#gid=' + gid + (row ? '&range=A' + row : '') : '');
}
// Hárok výsledkov Res_…, pri archivovanom hárok Archív na prvom riadku testu.
function openSheet(x) {
  var L = x.link || {};
  if (!x.link) say(t('t.link_old'), 'muted');
  window.open(x.state === 'archived' ? sheetHref(L.aGid, L.aRow) : sheetHref(L.gid, 0), '_blank', 'noopener');
}

/* ---------- premenovať ---------- */
function tRenameDlg(x) {
  var inp = el('input', { maxlength: '40', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }), msg = el('span', { class: 'small bad', style: 'font-weight:400', hidden: true });
  inp.value = x.id;
  var go = { text: t('t.rename_go'), primary: true, wait: t('t.renaming'), run: async function () {
    var name = inp.value.trim();
    if (nameErr(name, x.id)) return true;
    if (name === x.id) return;
    var r = await api('tRename', A({ t: x.id, name: name }));
    var old = x.id;
    x.id = x.title = r.id;
    (T.init.taken = T.init.taken || []).push(r.id.toLowerCase());
    var m = t('t.renamed_ok', { old: old, title: r.id }) + (r.drive === 'exists' ? ' ' + t('t.renamed_drive_exists') : r.drive === 'error' ? ' ' + t('t.renamed_drive_err') : '');
    if (T.cur && T.cur.id === old) tOpenTest(r.id, T.sub, T.classForce, m);
    else { tTestsList(); say(m, 'ok'); }
    refreshInit().then(function () { if (T.tab === 'tests') tTestsList(); }).catch(function () {});
  } };
  var check = function () {
    var e = nameErr(inp.value.trim(), x.id);
    inp.classList.toggle('invalid', !!e && e !== 'empty');
    msg.textContent = e ? t('t.name_' + e, { max: (T.init && T.init.nameMax) || NAME_MAX }) : ''; msg.hidden = !e;
    dlgOff(go.el, !!e || inp.value.trim() === x.id);
  };
  inp.oninput = check;
  inp.onkeydown = function (e) { if (e.key === 'Enter' && !go.el.disabled) go.el.click(); };
  dlgOpen({ title: t('t.rename_title', { title: x.title || x.id }), body: [field(t('t.title'), inp, [msg]), el('p', { class: 'small muted', text: t('t.rename_hint') })],
    buttons: [go, { text: t('common.cancel') }] });
  check();
}

/* ---------- poznámka ---------- */
function tNoteDlg(x) {
  var ta = el('textarea', { rows: '4', maxlength: '500' }); ta.value = x.note || '';
  dlgOpen({ title: t('t.note_title', { title: x.title || x.id }), body: [field(t('t.note_field'), ta), el('p', { class: 'small muted', text: t('t.note_hint') })],
    buttons: [{ text: t('common.save'), primary: true, run: async function () {
      var r = await api('tNote', A({ t: x.id, note: ta.value }));
      x.note = r.note;
      if (T.cur && T.cur.id === x.id) { T.cur.d.test.note = r.note; tHead(); }
      if (T.tab === 'tests') tTestsList();
      say(t(r.note ? 't.note_saved' : 't.note_removed'), 'ok');
    } }, { text: t('common.cancel') }] });
}

/* ---------- duplikovať / náhradný termín ---------- */
// Voľný názov: Geo8A_N, Geo8A_N2, … (náhradný termín) alebo Geo8A_2, Geo8A_3, …
function freeName(base, sfx) {
  var max = (T.init && T.init.nameMax) || NAME_MAX;
  for (var i = 1; i < 100; i++) {
    var tail = sfx === 'N' ? '_N' + (i > 1 ? i : '') : '_' + (i + 1), v = base.slice(0, max - tail.length) + tail;
    if (!nameTaken(v)) return v;
  }
  return '';
}
function classHasGroups(cls) { var g = (T.init.groups || {})[cls]; return !!(g && g.A > 0 && g.B > 0); }
async function tDupDlg(x) {
  var groups = !!x.groups, open = !!x.open, title = x.title || x.id;
  var nameIn = el('input', { maxlength: '40', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }), nameMsg = el('span', { class: 'small bad', style: 'font-weight:400', hidden: true });
  var touched = false;
  nameIn.oninput = function () { touched = true; check(); };
  var clsSel = el('select');
  Object.keys(T.init.classes || {}).sort(function (a, b) { return a.localeCompare(b, I18N.lang, { numeric: true }); })
    .forEach(function (c) { clsSel.appendChild(el('option', { value: c, text: t('t.class_opt', { cls: c, n: T.init.classes[c].length }) })); });
  if (!open && !T.init.classes[x.cls]) clsSel.appendChild(el('option', { value: x.cls, text: x.cls }));
  if (!open) clsSel.value = x.cls;
  var timeIn = el('input', { type: 'number', min: '1', max: '240', inputmode: 'numeric' }); timeIn.value = x.total || 10;
  var missInfo = el('p', { class: 'small muted' });
  var whoBox = radios('dup-who', [['all', t('t.dup_all')], ['missing', t('t.dup_missing')]], 'all', function () { prefill(); modeRender(); check(); });
  var modeWrap = el('div', { class: 'stack tight' });
  var missing = null;   // mená žiakov, ktorí nepísali (null = ešte sa načítava / archivovaný)
  var prefill = function () { if (!touched) nameIn.value = freeName(x.id, radioVal(whoBox) === 'missing' ? 'N' : '2'); };
  // Ktoré objekty: len pri teste so skupinami. Trieda bez skupín nemôže písať „ako pôvodný“ ani „prehodené“.
  var modeRender = function () {
    var keep = radioVal(modeWrap) || 'same', cls = radioVal(whoBox) === 'missing' ? x.cls : clsSel.value, ab = classHasGroups(cls);
    modeWrap.innerHTML = '';
    if (!groups) return;
    var opts = [['same', t('t.dup_same')], ['swap', t('t.dup_swap')], ['A', t('t.dup_only_a', { n: x.n })], ['B', t('t.dup_only_b', { n: x.n })], ['all', t('t.dup_every', { n: x.n * 2 })]];
    if (!ab) { opts = opts.slice(2); if (keep === 'same' || keep === 'swap') keep = 'all'; }
    modeWrap.appendChild(el('p', { class: 'small', style: 'font-weight:600', text: t('t.dup_mode') }));
    modeWrap.appendChild(radios('dup-mode', opts, keep));
    if (!ab) modeWrap.appendChild(el('p', { class: 'small muted', text: t('t.dup_nogroups', { cls: cls }) }));
  };
  clsSel.onchange = function () { modeRender(); };
  var start = function (state) {
    return { text: t(state === 'open' ? 't.start' : 't.prepare'), primary: state === 'open', wait: t('t.saving'), run: async function () {
      var name = nameIn.value.trim(), who = open ? 'all' : radioVal(whoBox);
      if (nameErr(name)) { check(); return true; }
      var total = Math.max(1, Math.min(240, parseInt(timeIn.value, 10) || x.total || 10));
      var cfg = { title: name, cls: open ? '' : who === 'missing' ? x.cls : clsSel.value, mode: groups ? radioVal(modeWrap) || 'same' : 'same', who: who, total: total, state: state };
      var r = await api('tDuplicate', A({ t: x.id, cfg: cfg }));
      var y = { id: r.id, created: r.created || nowStr(), started: r.started || '', cls: r.cls || cfg.cls, open: open, regions: x.regions, title: r.id, n: r.n, groups: !!r.groups, alt: !!r.alt,
        total: r.total || total, state: state, dk: r.dk || '', only: r.only || 0, src: r.src || x.id, note: '' };
      T.init.tests.push(y); (T.init.taken = T.init.taken || []).push(r.id.toLowerCase());
      tStarted(y);
      refreshInit().catch(function () {});
    } };
  };
  var bOpen = start('open'), bReady = start('ready');
  var check = function () {
    var miss = !open && radioVal(whoBox) === 'missing', e = nameErr(nameIn.value.trim());
    nameIn.classList.toggle('invalid', !!e && e !== 'empty');
    nameMsg.textContent = e ? t('t.name_' + e, { max: (T.init && T.init.nameMax) || NAME_MAX }) : ''; nameMsg.hidden = !e;
    clsSel.disabled = miss; if (miss) clsSel.value = x.cls;
    missInfo.hidden = !miss;
    var none = miss && missing && !missing.length;
    if (miss) missInfo.textContent = missing === null ? t(x.state === 'archived' ? 't.dup_missing_arch' : 'common.loading') : missing.length ? t('t.dup_missing_list', { n: missing.length, names: missing.join(', ') }) : t('t.dup_missing_none');
    missInfo.className = 'small ' + (none ? 'bad' : 'muted');
    dlgOff(bOpen.el, !!e || none); dlgOff(bReady.el, !!e || none);
  };
  dlgOpen({ title: t('t.dup_title', { title: title }), body: [
    el('p', { class: 'small muted', text: t('t.dup_hint') }),
    open ? null : el('p', { class: 'small', style: 'font-weight:600', text: t('t.dup_who') }), open ? null : whoBox, open ? null : missInfo,
    el('div', { class: 'row' }, [field(t('t.title'), nameIn, [nameMsg]), open ? null : field(t('t.class'), clsSel), el('label', { style: 'flex:0 1 150px' }, [el('span', { text: t('t.time') }), timeIn])]),
    modeWrap], buttons: [bOpen, bReady, { text: t('common.cancel') }] });
  prefill(); modeRender(); check();
  // kto nepísal: žiaci bez výsledku (aj neprítomní); pri archivovanom to zistí až skript
  if (!open && x.state !== 'archived') {
    try {
      var c = await curFor(x.id), done = {};
      c.res.forEach(function (r) { if (!r.teacher) done[r.pupilId] = 1; });
      missing = sortedRows(c).filter(function (p) { return !done[p.id.split('#')[0]]; }).map(function (p) { return p.label; });
    } catch (e) { missing = null; missInfo.textContent = errText(e); }
    if (!$('dlg').hidden) check();
  }
}

/* ---------- prepočítať body (opravené objekty v dátach) ---------- */
// Objekty testu, ako sú teraz v dátach aplikácie (a vo Vlastných objektoch), zjednodušené rovnako ako pri vytvorení testu.
// Vráti {objects: tie, čo sa líšia od balíka testu, missing: kľúče, ktoré sa v dátach nenašli}.
async function currentObjects(c) {
  var x = c.d.test, map = x.map || {}, labels = String(x.regions || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var regs = T.regions.filter(function (r) { return labels.indexOf(regionLabel(r.code, r.names)) >= 0; });
  if (!regs.length && map.bbox) regs = T.regions.filter(function (r) { return r.bbox && bboxHit(r.bbox, map.bbox); });
  var files = [];
  regs.forEach(function (r) { r.objects.forEach(function (o) { files.push({ entry: o, region: r.code }); }); });
  var lists = await Promise.all(files.map(function (f) { return Data.objects(f.entry, f.entry.type, f.region); }));
  var byId = {};
  lists.forEach(function (l) { l.forEach(function (o) { if (!byId[o.id]) byId[o.id] = o; }); });
  (T.init.custom || []).forEach(function (o) { if (!byId[o.id]) byId[o.id] = { id: o.id, name: o.name, type: typeCode(o.type), diff: o.diff, g: { t: 'pt', c: o.c } }; });
  var tol = map.bbox ? bboxSpan(map.bbox) / 6000 : 0.01, dec = decFor(tol), out = {}, missing = [];
  x.keys.forEach(function (k) {
    var o = byId[k], old = c.pack.objects[k];
    if (!o) { missing.push(k); return; }
    var n = { name: o.name, type: o.type, diff: o.diff, g: simpGeom(o.g, tol, dec) };
    if (old && (n.name !== old.name || JSON.stringify(n.g) !== JSON.stringify(old.g))) out[k] = n;
  });
  return { objects: out, missing: missing };
}
async function tRecalcDlg(x) {
  dlgOpen({ title: t('t.recalc_title', { title: x.title || x.id }), body: [el('p', { class: 'muted' }, [el('span', { class: 'spin' }), t('t.recalc_loading')])], buttons: [{ text: t('common.cancel') }] });
  var c, cur, d;
  try { c = await curFor(x.id); cur = await currentObjects(c); d = await api('tRecalc', A({ t: x.id, objects: cur.objects, dry: true })); }
  catch (e) { dlgMsg(errText(e), 'bad'); return; }
  if ($('dlg').hidden) return;
  var pack = c.pack, body = $('dlg-body'); body.innerHTML = '';
  var label = function (k) { var b = (c.d.test.keysB || []).indexOf(k); return c.d.test.groups ? (b >= 0 ? 'B' + (b + 1) : 'A' + (c.d.test.keysA.indexOf(k) + 1)) + '. ' : (c.d.test.keys.indexOf(k) + 1) + '. '; };
  if (d.changes.length) {
    body.appendChild(el('p', { text: t('t.recalc_changes', { n: d.changes.length }) }));
    body.appendChild(el('ul', { class: 'rules small' }, d.changes.map(function (ch) {
      var parts = [];
      if (ch.name2 !== ch.name) parts.push(t('t.recalc_name', { name: ch.name2 }));
      if (ch.geo) parts.push(ch.n ? t('t.recalc_geo_n', { n: ch.n, km: fmtKm(ch.max) }) : t('t.recalc_geo_0'));
      return el('li', {}, [el('b', { text: ch.tag + ' ' + ch.name }), ': ' + parts.join(', ')]);
    })));
  } else body.appendChild(el('p', { text: t('t.recalc_none') }));
  if (cur.missing.length) {
    body.appendChild(el('p', { class: 'small bad', text: t('t.recalc_missing', { n: cur.missing.length }) }));
    body.appendChild(el('ul', { class: 'rules small' }, cur.missing.map(function (k) { return el('li', { text: label(k) + (pack.objects[k] ? pack.objects[k].name : k) }); })));
  }
  body.appendChild(el('p', { class: 'small muted', text: t('t.recalc_hint') }));
  dlgButtons([{ text: t(d.changes.length ? 't.recalc_go' : 't.recalc_go_anyway'), primary: true, wait: t('t.recalc_running'), run: async function () {
    var r = await api('tRecalc', A({ t: x.id, objects: cur.objects }));
    if (T.cur && T.cur.id === x.id) { if (r.pack) T.cur.pack = r.pack; T.cview = null; tRefresh().catch(function () {}); }
    say(t('t.recalc_done', { n: r.n || 0 }), 'ok');
  } }, { text: t('common.cancel') }]);
}

/* ---------- anulovať tip (v záložke Tipy triedy) ---------- */
function voidCtl() {
  var box = $('class-void'), k = T.objKey, v = (T.cur.d.test.voids || {})[k];
  box.innerHTML = '';
  if (v) box.appendChild(el('span', { class: 'badge warn', text: t('t.void_badge_' + v) }));
  if (!T.dz && T.feat) box.appendChild(el('button', { type: 'button', class: 'mini', text: t(v ? 't.void_change' : 't.void_btn'), onclick: function () { tVoidDlg(k); } }));
  box.hidden = !box.firstChild;
}
function tVoidDlg(k) {
  var o = T.cur.pack.objects[k], v = (T.cur.d.test.voids || {})[k];
  var set = function (mode) {
    return async function () {
      var r = await api('tVoid', A({ t: T.cur.id, q: k, mode: mode }));
      T.cur.d.test.voids = r.voids || {}; tPrepResults(); tClass();
      tStatus('class-vmsg', t('t.void_done_' + (mode || 'undo'), { n: r.n || 0 }), 'ok');
    };
  };
  dlgOpen({ title: t('t.void_title'), body: [
    el('p', { style: 'font-weight:800', text: keyLabel(k) + o.name }),
    v ? el('p', { class: 'bad', text: t('t.void_now_' + v) }) : null,
    el('ul', { class: 'rules small' }, [el('li', { html: t('t.void_full_hint') }), el('li', { html: t('t.void_skip_hint') })]),
    el('p', { class: 'small muted', text: t('t.void_hint') })],
  buttons: [v !== 'full' ? { text: t('t.void_full'), primary: true, run: set('full') } : null,
    v !== 'skip' ? { text: t('t.void_skip'), primary: !v, run: set('skip') } : null,
    v ? { text: t('t.void_undo'), run: set('') } : null,
    { text: t('common.cancel') }] });
}

/* ---------- známky ---------- */
// Stupnica: od koľkých % je 1, 2, 3, 4 (menej = 5). Percentá sa zaokrúhlia na celé ako v prehľade.
function gradeOf(pct, g) { var p = Math.round(pct * 100); return p >= g[0] ? 1 : p >= g[1] ? 2 : p >= g[2] ? 3 : p >= g[3] ? 4 : 5; }
function gradesOk(g) { return g.length === 4 && g.every(function (v, i) { return v !== null && v >= 0 && v <= 100 && Math.floor(v) === v && (i === 0 || v < g[i - 1]); }); }
async function tGradesDlg(x) {
  dlgOpen({ title: t('t.grades_title', { title: x.title || x.id }), body: [el('p', { class: 'muted' }, [el('span', { class: 'spin' }), t('common.loading')])], buttons: [{ text: t('common.cancel') }] });
  var c;
  try { c = await curFor(x.id); } catch (e) { dlgMsg(errText(e), 'bad'); return; }
  if ($('dlg').hidden) return;
  var g0 = ((T.init && T.init.grades) || store('sm-grades') || [90, 75, 50, 25]).slice(), ins = [];
  var by = {}; c.res.forEach(function (r) { by[r.pupilId] = r; });
  var list = (c.d.test.open ? c.res.filter(function (r) { return !r.teacher; }).map(function (r) { return { label: r.name, id: r.pupilId }; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'sk'); }) : sortedRows(c))
    .map(function (p) { var key = p.id.split('#')[0], r = by[key]; return { name: p.label, pct: r ? r.pct : null, absent: !r && !!c.absent[key] }; });
  var tb = el('tbody'), scale = el('div', { class: 'row scale' });
  [1, 2, 3, 4].forEach(function (n, i) {
    var inp = el('input', { type: 'number', min: '0', max: '100', inputmode: 'numeric' }); inp.value = g0[i];
    inp.oninput = render; ins.push(inp);
    scale.appendChild(el('label', {}, [el('span', { text: t('t.grade_from', { g: n }) }), inp]));
  });
  var cur = function () { return ins.map(function (i) { var v = parseInt(i.value, 10); return isNaN(v) ? null : v; }); };
  function render() {
    var g = cur(), ok = gradesOk(g);
    ins.forEach(function (i) { i.classList.toggle('invalid', !ok); });
    tb.innerHTML = '';
    list.forEach(function (p) {
      tb.appendChild(el('tr', {}, [el('td', { text: p.name }), el('td', { class: 'num', text: p.pct === null ? (p.absent ? t('t.st_absent') : '–') : fmtPct(p.pct) }),
        el('td', { class: 'num', text: p.pct === null || !ok ? '' : String(gradeOf(p.pct, g)) })]));
    });
    dlgOff(copy.el, !ok || !list.some(function (p) { return p.pct !== null; }));
    tStatus('grades-err', ok ? '' : t('t.grades_bad'), 'bad');
  }
  var copy = { text: t('t.grades_copy'), primary: true, run: async function () {
    var g = cur(), lines = list.map(function (p) { return p.name + '\t' + (p.pct === null ? '' : gradeOf(p.pct, g)); });
    copyText(lines.join('\n'), 'dlg-msg', t('t.grades_copied', { n: list.filter(function (p) { return p.pct !== null; }).length }));
    // stupnica sa zapamätá (v tabuľke, so starším skriptom v prehliadači)
    if (g.join() !== g0.join()) {
      store('sm-grades', g); if (T.init) T.init.grades = g; g0 = g.slice();
      if (T.feat) api('tGrades', A({ g: g })).catch(function (e) { tStatus('grades-err', errText(e), 'bad'); });
    }
    return true;
  } };
  var body = $('dlg-body'); body.innerHTML = '';
  body.appendChild(el('p', { class: 'small muted', text: t('t.grades_hint') }));
  body.appendChild(scale);
  body.appendChild(el('p', { id: 'grades-err', class: 'small bad', hidden: true }));
  body.appendChild(el('div', { class: 'tablebox gradebox' }, [el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { text: t('t.col_pupil') }), el('th', { class: 'num', text: t('t.col_result') }), el('th', { class: 'num', text: t('t.col_grade') })])]), tb])]));
  dlgButtons([copy, { text: t('common.close') }]);
  render();
}

/* ---------- náhľad ako žiak ---------- */
// Stránka žiaka v novej karte s objektmi tohto testu. Nič sa neukladá: tipy aj vyhodnotenie sú len v prehliadači.
// Údaje idú cez úložisko prehliadača (rovnaká adresa), kľúč učiteľa sa do odkazu nedáva.
async function tPupilPreview(x) {
  var url = appBase() + 'test.html?preview=1', w = null;
  if (!(T.cur && T.cur.id === x.id && T.cur.pack)) { try { w = window.open('', '_blank'); } catch (e) { w = null; } if (w) try { w.document.title = t('common.loading'); } catch (e) { /* nevadí */ } }
  try {
    var c = await curFor(x.id), d = c.d.test;
    store('sm-preview', { id: d.id, title: d.title || d.id, cls: d.cls, open: !!d.open, total: d.total, groups: !!d.groups, keysA: keysA(d), keysB: d.keysB || [], keys: d.keys,
      objects: c.pack.objects, scoring: d.scoring, map: d.map, voids: d.voids || {}, penalty: c.d.penalty || 0.1, lang: d.lang || 'sk', at: Date.now() });
    if (w) w.location.href = url;
    else if (!window.open(url, '_blank')) say(t('t.preview_blocked'), 'bad');
  } catch (e) { if (w) w.close(); say(errText(e), 'bad'); }
}

/* ---------- tlačidlá ---------- */
(function () {
  function on(id, fn, ev) { var e = $(id); if (e) e[ev || 'onclick'] = fn; }
  on('tab-new', function () { tTab('new'); });
  on('tab-tests', function () { tTab('tests'); });
  on('m-auto', function () { tSetMode('auto'); });
  on('m-manual', function () { tSetMode('manual'); });
  on('refill', tRefill);
  on('clear-all', function () { tClearAll(); tSlots(); });
  on('start', function () { tStart('open'); });
  on('prepare', function () { tStart('ready'); });
  on('list-toggle', function () { tListToggle(!T.listOpen); });
  on('show-res', function () { T.showRes = this.checked; if (T.sub === 'over') tOverview(); else if (T.sub === 'score') tScore(); }, 'onchange');
  on('over-copy', tCopyResults);
  on('over-add', function () { tAddTime('*', $('over-add')); });
  on('class-force', function () { T.classForce = true; tClass(); });
  on('practice', tPractice);
  on('test-toggle', tToggleState);
  on('sub-over-b', function () { tSub('over'); });
  on('sub-class-b', function () { tSub('class'); });
  on('sub-score-b', function () { tSub('score'); });
  on('class-prev', function () { tClassStep(-1); });
  on('class-next', function () { tClassStep(1); });
  on('class-obj', function () { T.objKey = this.value; tClass(); }, 'onchange');
  on('class-names', function () { T.showNames = this.checked; if (T.cview) T.cview.redraw(); }, 'onchange');
  on('class-copy', tCopyStats);
  on('sc-save', tSaveScoring);
  on('sc-export', tExportAll);
  on('qr-close', function () { $('qr-cover').hidden = true; });
  // ponuka ⋯ sa zatvorí klikom mimo nej, Esc alebo zmenou šírky okna (posúva sa so stránkou)
  document.addEventListener('pointerdown', function (e) { if (!$('menu').hidden && !$('menu').contains(e.target) && e.target !== MENU.btn) menuClose(); }, true);
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (window.innerWidth !== lastW) { lastW = window.innerWidth; menuClose(); } });
  $('menu').addEventListener('keydown', function (e) {
    var list = [].slice.call($('menu').querySelectorAll('button:not([disabled])')), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.length) list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); if (list.length) list[e.key === 'Home' ? 0 : list.length - 1].focus(); }
    else if (e.key === 'Tab') menuClose();
  });
  window.addEventListener('afterprint', function () { $('print-sheet').innerHTML = ''; });
  on('qr-cover', function (e) { if (e.target === $('qr-cover')) $('qr-cover').hidden = true; });
  on('t-disconnect', function () { if (confirm(t('t.disconnect_confirm'))) { store('sm-teacher', null); location.reload(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('menu').hidden) { menuClose(true); return; }
    if (!$('dlg').hidden) { dlgClose(); return; }
    $('qr-cover').hidden = true;
  });
  // odkaz z tabuľky vložený do už otvorenej stránky mení len časť za #, stránka sa preto načíta znova
  window.addEventListener('hashchange', function () { if (/[#&]k=/.test(location.hash)) location.reload(); });
})();
teacherStart();
