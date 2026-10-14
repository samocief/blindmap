/* Slepá mapa: stránka učiteľa. Pripája sa odkazom z tabuľky: ucitel.html#s=<skript>&k=<kľúč>, potom si ho pamätá.
 * Dozor (suplujúci učiteľ) dostane odkaz ucitel.html?s=<skript>&t=<test>&dk=<kľúč testu>: vidí len prehľad jedného testu,
 * môže ho spustiť a uzavrieť, označiť neprítomných a skopírovať výsledky. Jeho odkaz sa nikam neukladá.
 */
var T = {
  s: '', k: '', dz: false, dk: '', init: null, oldScript: false, regions: [], poolAll: [], pool: [], slots: [], mode: 'auto', loadSeq: 0, listOpen: false,
  scene: null, sceneKey: '', pview: null, cur: null, cview: null, poll: null, tab: 'new', sub: 'over', objKey: '', showNames: false, showRes: false, classForce: false, imgRec: null
};
var FORM_KEY = 'sm-form', OPEN_CLS = '*ext*', NEED_SCRIPT = '2.1';

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
  T.oldScript = cmpVer(T.init.v, NEED_SCRIPT) < 0;
  if (T.oldScript) tStatus('t-status', t('t.old_script', { v: T.init.v || '1' }), 'bad');
  $('prepare').hidden = $('start-hint').hidden = T.oldScript;
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
function chips(box, items, checked, onchange) {
  box.innerHTML = '';
  items.forEach(function (it, i) {
    var id = box.id + '-' + i, inp = el('input', { type: 'checkbox', id: id, value: it.value, 'data-type': it.type });
    inp.checked = checked.indexOf(it.value) >= 0; inp.onchange = onchange || null;
    box.appendChild(el('label', { class: 'chip', for: id }, [inp, ' ' + it.label]));
  });
}
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
  sel.value = ''; $('f-title').value = '';
  sel.onchange = function () { sel.classList.remove('invalid'); tStatus('start-msg', ''); };
  $('f-title').oninput = function () { $('f-title').classList.remove('invalid'); tStatus('start-msg', ''); };
  tListToggle(false);
  ['f-dmin', 'f-dmax'].forEach(function (id) { var s = $(id); s.innerHTML = ''; for (var d = 1; d <= 5; d++) s.appendChild(el('option', { value: String(d), text: String(d) })); });
  $('f-dmin').value = String(F.dmin || 1); $('f-dmax').value = String(F.dmax || 5);
  $('f-n').value = F.n || 10; $('f-time').value = F.time || 20; $('f-full').value = F.pFull || 1; $('f-zero').value = F.pZero || 30;
  var codes = T.regions.map(function (r) { return r.code; }), lastR = (F.regions || []).filter(function (c) { return codes.indexOf(c) >= 0; });
  chips($('f-regions'), T.regions.map(function (r) { return { value: r.code, label: regionLabel(r.code, r.names) }; }), lastR.length ? lastR : codes.slice(0, 1), tRegionsChanged);
  $('f-dmin').onchange = $('f-dmax').onchange = function () { saveForm({ dmin: +$('f-dmin').value, dmax: +$('f-dmax').value }); tFilter(); };
  // Počet objektov: políčka sa prispôsobia už počas písania; prekresľujú sa len pri skutočnej zmene počtu.
  var nTimer = null;
  $('f-n').oninput = function () { clearTimeout(nTimer); nTimer = setTimeout(function () { var n = parseInt($('f-n').value, 10); if (n >= 1 && n <= 40 && n !== T.slots.length) { saveForm({ n: n }); tResize(); } }, 400); };
  $('f-n').onchange = function () { clearTimeout(nTimer); var n = Math.max(1, Math.min(40, parseInt($('f-n').value, 10) || 10)); $('f-n').value = n; saveForm({ n: n }); if (n !== T.slots.length) tResize(); };
  $('f-time').onchange = function () { saveForm({ time: Math.max(5, Math.min(600, parseInt($('f-time').value, 10) || 20)) }); };
  $('f-full').oninput = $('f-zero').oninput = tScoringInfo;
  $('f-full').onchange = $('f-zero').onchange = function () { saveForm({ pFull: num($('f-full').value, 1), pZero: num($('f-zero').value, 30) }); };
  T.mode = F.mode === 'manual' ? 'manual' : 'auto'; tModeButtons();
  tRegionsChanged();
}

// Zmena oblastí: načítajú sa objekty a ponuka vrstiev mapy.
async function tRegionsChanged() {
  var seq = ++T.loadSeq, codes = chipVals($('f-regions'));
  saveForm({ regions: codes });
  tBaseChips(codes);
  $('pool-info').textContent = codes.length ? t('common.loading') : t('t.pick_region');
  var files = [];
  codes.forEach(function (c) { var r = regionByCode(c); if (r) r.objects.forEach(function (o) { files.push({ file: o.file, type: o.type, region: c }); }); });
  var lists;
  try { lists = await Promise.all(files.map(function (f) { return Data.objects(f.file, f.type, f.region); })); }
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
  var order = ['countries', 'regions', 'districts', 'cities', 'rivers', 'lakes', 'seas', 'oceans', 'mountains', 'peaks', 'lowlands', 'islands', 'peninsulas', 'deserts', 'parks', 'caves'];
  var types = Object.keys(counts).sort(function (a, b) { var i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || typeLabel(a).localeCompare(typeLabel(b), I18N.lang); });
  var F = form(), prev = F.types && F.types.some(function (x) { return counts[x]; }) ? F.types : types;
  chips($('f-types'), types.map(function (x) { return { value: x, label: typeLabel(x) + ' (' + counts[x] + ')' }; }), prev, function () { saveForm({ types: chipVals($('f-types')) }); tLockLayers(); tFilter(); tScene(); });
  tLockLayers();
  $('f-types-msg').textContent = types.length ? '' : t('t.no_objects'); $('f-types-msg').hidden = !!types.length;
  // výber z minulého razu ostane, ak sa ešte dá
  T.slots = T.slots.map(function (o) { return o && byId[o.id] ? byId[o.id] : null; });
  tFilter();
  tScene();
}
// Vlastné objekty z tabuľky učiteľa: typ a oblasť sa porovnávajú s kódmi aj s názvami v jazyku aplikácie.
var TYPE_SYN = [[/^(stat|staty|krajina|krajiny|country|countries)$/, 'countries'], [/^(kraj|kraje|region|regiony|regions|zupa|zupy)\b/, 'regions'], [/^(okres|okresy|districts?)\b/, 'districts'],
  [/^(mesto|mesta|obec|obce|sidlo|sidla|city|cities|town|towns)\b/, 'cities'], [/^(rieka|rieky|potok|potoky|river|rivers)\b/, 'rivers'],
  [/^(jazero|jazera|nadrz|nadrze|vodna nadrz|vodne nadrze|priehrada|pleso|plesa|lake|lakes)\b/, 'lakes'], [/^(more|moria|zaliv|zalivy|prieliv|prielivy|sea|seas|bay)\b/, 'seas'],
  [/^(ocean|oceany|oceans)\b/, 'oceans'], [/^(pohorie|pohoria|mountains?)\b/, 'mountains'], [/^(vrch|vrchy|stit|stity|hora|peaks?)\b/, 'peaks'],
  [/^(nizina|niziny|kotlina|kotliny|lowlands?|basins?)\b/, 'lowlands'], [/^(ostrov|ostrovy|islands?)\b/, 'islands'], [/^(polostrov|polostrovy|peninsulas?)\b/, 'peninsulas'],
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
  var types = chipVals($('f-types')), dmin = +$('f-dmin').value, dmax = +$('f-dmax').value;
  if (dmin > dmax) { var x = dmin; dmin = dmax; dmax = x; }
  T.pool = T.poolAll.filter(function (o) { return types.indexOf(o.type) >= 0 && o.diff >= dmin && o.diff <= dmax; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, I18N.lang); });
  var ok = {}; T.pool.forEach(function (o) { ok[o.id] = 1; });
  T.slots = T.slots.map(function (o) { return o && ok[o.id] ? o : null; });
  tResize();
}
function tResize() {
  var n = Math.max(1, Math.min(40, parseInt($('f-n').value, 10) || 10));
  T.slots = T.slots.slice(0, n); while (T.slots.length < n) T.slots.push(null);
  if (T.mode === 'auto') tFillEmpty();
  tSlots();
}
// Zoznam objektov je predvolene skrytý: učiteľ zvyčajne zrkadlí obrazovku na projektor.
function tListToggle(open) {
  T.listOpen = open; $('list-box').hidden = !open;
  $('list-toggle').textContent = t(open ? 't.hide_list' : 't.show_list') + (open ? ' ▴' : ' ▾');
  $('list-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
function tModeButtons() { $('m-auto').classList.toggle('on', T.mode === 'auto'); $('m-manual').classList.toggle('on', T.mode === 'manual'); $('refill').hidden = T.mode !== 'auto'; }
function tSetMode(m) {
  T.mode = m; saveForm({ mode: m }); tModeButtons();
  if (m === 'manual') T.slots = T.slots.map(function () { return null; }); else tFillEmpty();
  tSlots();
}
// Náhodný objekt z ponuky. Vyvažuje obtiažnosti a typy; pri výmene uprednostní rovnaký typ a obtiažnosť.
// Náhodný objekt na doplnenie prázdnych políčok (Auto): vyvažuje obtiažnosti a typy.
function tRandom(exclude) {
  var avail = T.pool.filter(function (x) { return !exclude[x.id]; });
  if (!avail.length) return null;
  var cd = {}, ct = {};
  T.slots.forEach(function (o) { if (o) { cd[o.diff] = (cd[o.diff] || 0) + 1; ct[o.type] = (ct[o.type] || 0) + 1; } });
  var m = Math.min.apply(null, avail.map(function (x) { return cd[x.diff] || 0; }));
  avail = avail.filter(function (x) { return (cd[x.diff] || 0) === m; });
  m = Math.min.apply(null, avail.map(function (x) { return ct[x.type] || 0; }));
  avail = avail.filter(function (x) { return (ct[x.type] || 0) === m; });
  return avail[Math.floor(Math.random() * avail.length)];
}
function usedIds(except) { var u = {}; T.slots.forEach(function (o, i) { if (o && i !== except) u[o.id] = 1; }); return u; }
function tFillEmpty() { T.slots.forEach(function (o, i) { if (!o) T.slots[i] = tRandom(usedIds(i)); }); }
function tRefill() { T.slots = T.slots.map(function () { return null; }); tFillEmpty(); tSlots(); }

/* ---------- políčka objektov (vyhľadávanie s ponukou) ---------- */
function tSlots() {
  // Ak práve píšeš do niektorého políčka, po prekreslení v ňom ostaneš.
  var box = $('slots'), act = document.activeElement, keep = -1;
  if (act && box.contains(act) && act.tagName === 'INPUT') keep = Array.prototype.indexOf.call(box.querySelectorAll('input'), act);
  box.innerHTML = '';
  T.slots.forEach(function (o, i) { box.appendChild(slotRow(i)); });
  if (keep >= 0 && box.querySelectorAll('input')[keep]) box.querySelectorAll('input')[keep].focus();
  var filled = T.slots.filter(Boolean).length;
  $('pool-info').textContent = !chipVals($('f-regions')).length ? t('t.pick_region')
    : t('t.pool_info', { n: T.pool.length, filled: filled, total: T.slots.length }) + (T.pool.length < T.slots.length ? ' ' + t('t.pool_short') : '');
  if (T.pview) T.pview.redraw();
}
function slotRow(i) {
  var o = T.slots[i], act = -1, items = [];
  var inp = el('input', { type: 'text', value: o ? o.name : '', placeholder: t('t.slot_ph'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('t.slot_aria', { n: i + 1 }), class: o ? 'filled' : '' });
  var hint = el('span', { class: 'hint', text: o ? typeOne(o.type) + ' · ' + o.diff : '' });
  var list = el('ul', { class: 'sugg', hidden: true, role: 'listbox' });
  function render() {
    var q = normName(inp.value), used = usedIds(i);
    items = T.pool.filter(function (x) { if (used[x.id]) return false; if (!q) return true; var n = normName(x.name); return n.indexOf(q) === 0 || n.indexOf(' ' + q) >= 0 || (q.length > 2 && n.indexOf(q) >= 0); });
    if (q) items.sort(function (a, b) { return (normName(b.name).indexOf(q) === 0) - (normName(a.name).indexOf(q) === 0); });
    items = items.slice(0, 40);
    list.innerHTML = '';
    items.forEach(function (x, j) {
      list.appendChild(el('li', { class: j === act ? 'act' : '', role: 'option', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { pick(x); } },
        [el('b', { text: x.name }), el('span', { text: typeOne(x.type) + ' · ' + t('t.diff_short', { n: x.diff }) + (x.custom ? ' · ' + t('t.custom') : '') })]));
    });
    if (!items.length) list.appendChild(el('li', { class: 'empty', text: T.pool.length ? t('t.no_match') : t('t.pool_empty') }));
    list.hidden = false;
    var a = list.querySelector('.act'); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function pick(x) { T.slots[i] = x; list.hidden = true; inp.blur(); tSlots(); }
  inp.onfocus = function () { inp.select(); hint.hidden = true; act = -1; render(); setTimeout(function () { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250); };
  inp.oninput = function () { act = 0; render(); };
  inp.onkeydown = function (e) {
    if (e.key === 'ArrowDown') { act = Math.min(act + 1, items.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (items[Math.max(0, act)]) pick(items[Math.max(0, act)]); e.preventDefault(); }
    else if (e.key === 'Escape') inp.blur();
  };
  inp.onblur = function () { list.hidden = true; var cur = T.slots[i]; inp.value = cur ? cur.name : ''; hint.hidden = false; };
  var dice = el('button', { type: 'button', class: 'icon', title: t('t.dice'), 'aria-label': t('t.dice'), text: '🎲', onclick: function () {
    // Kocka: úplne náhodný iný objekt z celej ponuky filtra (bez ohľadu na typ a obtiažnosť), okrem už vybraných.
    var ex = usedIds(i); if (T.slots[i]) ex[T.slots[i].id] = 1;
    var avail = T.pool.filter(function (x) { return !ex[x.id]; });
    if (avail.length) { T.slots[i] = avail[Math.floor(Math.random() * avail.length)]; tSlots(); }
  } });
  var clr = el('button', { type: 'button', class: 'icon', title: t('t.clear'), 'aria-label': t('t.clear'), text: '✕', disabled: !o, onclick: function () { T.slots[i] = null; tSlots(); } });
  return el('li', { class: 'slot' }, [el('span', { class: 'n', text: (i + 1) + '.' }), el('div', { class: 'combo' }, [inp, hint, list]), dice, clr]);
}

/* ---------- mapa: vrstvy, náhľad, hodnotenie ---------- */
function tBaseChips(codes) {
  var F = form(), on = F.base || [], seen = F.seen || [], items = layerItems(T.regions, codes);
  var vals = items.map(function (x) { return x.value; });
  // vrstvy, ktoré učiteľ už videl, majú jeho posledné nastavenie; nové vrstvy podľa predvoľby
  var checked = items.filter(function (x) { return seen.indexOf(x.value) >= 0 ? on.indexOf(x.value) >= 0 : x.def; }).map(function (x) { return x.value; });
  chips($('f-base'), items, checked, function () { saveForm({ base: layersAfterChange($('f-base'), form().base) }); tScene(); });
  saveForm({ seen: uniq(seen.concat(vals)), base: uniq(on.filter(function (f) { return vals.indexOf(f) < 0; }).concat(checked)) });
  tLockLayers();
}
function tLockLayers() { lockLayers($('f-base'), chipVals($('f-types')), form().base); }
function tBaseRefs() {
  var files = chipVals($('f-base')), refs = [];
  chipVals($('f-regions')).forEach(function (c) {
    var r = regionByCode(c); if (!r) return;
    r.base.forEach(function (b) { if (files.indexOf(b.file) >= 0) refs.push({ file: b.file, style: layerStyle(b.name, b.raster) }); });
    r.objects.forEach(function (o) { if (files.indexOf(o.file) >= 0) refs.push({ file: o.file, style: layerStyle(o.type, false) }); });
  });
  return refs;
}
function tScene() {
  var codes = chipVals($('f-regions')), bbox = tBBox(codes), refs = tBaseRefs();
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
function tPreviewOverlay(v) {
  if (!$('prev-show').checked) return '';
  var s = '', u = v.uPx();
  T.slots.forEach(function (o) { if (o) s += drawTarget(o.g, v.proj, v.pal, 0); });
  T.slots.forEach(function (o, i) { if (o) s += drawLabel(anchorOf(o.g), v.proj, (i + 1) + '. ' + o.name, v.pal.ink, v.pal.halo, u, 12, o.g.t === 'pt' ? -12 : 0, false); });
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
  var clsSel = $('f-cls').value, open = clsSel === OPEN_CLS, title = $('f-title').value.trim(), chosen = T.slots.filter(Boolean), sc = T.scene;
  var pf = num($('f-full').value, 1), pz = num($('f-zero').value, 30), time = Math.max(5, Math.min(600, parseInt($('f-time').value, 10) || 20));
  $('f-cls').classList.toggle('invalid', !clsSel); $('f-title').classList.toggle('invalid', !title);
  if (!clsSel || !title) {
    tStatus('start-msg', t(!clsSel && !title ? 't.err_required' : !clsSel ? 't.err_class' : 't.err_title'), 'bad');
    var f = !clsSel ? $('f-cls') : $('f-title'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { f.focus({ preventScroll: true }); }, 300);
    return;
  }
  if (!chosen.length) { tStatus('start-msg', t('t.err_objects'), 'bad'); return; }
  if (!sc) { tStatus('start-msg', t('t.loading_map'), 'bad'); return; }
  if (!(pz > pf && pf >= 0)) { tStatus('start-msg', t('t.scoring_bad'), 'bad'); return; }
  var tol = bboxSpan(sc.bbox) / 6000, dec = decFor(tol), objects = {};
  chosen.forEach(function (o) { objects[o.id] = { name: o.name, type: o.type, g: simpGeom(o.g, tol, dec) }; });
  var codes = chipVals($('f-regions')), types = uniq(chosen.map(function (o) { return o.type; }));
  var dmin = Math.min(+$('f-dmin').value, +$('f-dmax').value), dmax = Math.max(+$('f-dmin').value, +$('f-dmax').value);
  var cfg = {
    cls: open ? '' : clsSel, open: open, state: state, title: title,
    regions: codes.map(function (c) { var r = regionByCode(c); return regionLabel(c, r && r.names); }).join(', '), types: types.map(typeLabel).join(', '),
    diff: dmin === dmax ? String(dmin) : dmin + '–' + dmax, time: time, full: round1(sc.diag * pf / 100), zero: round1(sc.diag * pz / 100), diag: Math.round(sc.diag), lang: I18N.lang,
    map: { bbox: sc.bbox, base: tBaseRefs() }, names: chosen.map(function (o) { return o.name; })
  };
  $('start').disabled = $('prepare').disabled = true; tStatus('start-msg', t('t.saving'));
  try {
    var r = await api('tCreateTest', A({ cfg: cfg, pack: { keys: chosen.map(function (o) { return o.id; }), objects: objects } }));
    tStatus('start-msg', '');
    var x = { id: r.id, created: '', cls: r.cls || clsSel, open: open, regions: cfg.regions, title: title, n: chosen.length, time: time, state: T.oldScript ? 'open' : state, dk: r.dk || '' };
    T.init.tests.push(x);
    // ďalší test sa začína s prázdnou triedou, názvom a skrytým zoznamom
    $('f-cls').value = ''; $('f-title').value = ''; tListToggle(false); $('prev-show').checked = false; if (T.pview) T.pview.redraw();
    tStarted(x);
  } catch (e) { tStatus('start-msg', t('t.err_save', { msg: errText(e) }), 'bad'); }
  $('start').disabled = $('prepare').disabled = false;
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
    try { await api('tSetTest', A({ t: x.id, patch: { state: 'open' } })); x.state = 'open'; tStarted(x); }
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
  var box = $('print-sheet'), meta = [x.open ? t('t.open_short') : t('t.class_short', { cls: x.cls }), t('t.n_objects', { n: x.n }), t('t.time_short', { n: x.time })].join(' · ');
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
  var a = +$('f-dmin').value, b = +$('f-dmax').value, time = parseInt($('f-time').value, 10) || 0;
  var q = 'r=' + chipVals($('f-regions')).join(',') + '&t=' + chipVals($('f-types')).join(',') + '&d=' + Math.min(a, b) + '-' + Math.max(a, b) +
    '&n=' + (parseInt($('f-n').value, 10) || 10) + '&s=' + ([10, 15, 20, 30, 60].indexOf(time) >= 0 ? time : 0) +
    '&l=' + chipVals($('f-base')).map(encodeURIComponent).join(',');
  tQrShow(t('t.practice_title'), appBase() + 'cvicenie.html?' + q);
}

/* ---------- zoznam testov ---------- */
function stateBadge(state) { return el('span', { class: 'badge' + (state === 'open' ? ' open' : ''), text: t('state.' + state) }); }
async function tTests() {
  var box = $('tests-list');
  box.innerHTML = ''; box.appendChild(el('p', { class: 'muted' }, [el('span', { class: 'spin' }), t('common.loading')]));
  try { var init = await apiRetry('tInit', A(), 2); T.init.tests = init.tests; T.init.classes = init.classes; T.init.custom = init.custom; } catch (e) { /* ukážeme, čo máme */ }
  box.innerHTML = '';
  var rows = T.init.tests.slice().reverse();
  if (!rows.length) { box.appendChild(el('p', { class: 'muted', text: t('t.no_tests') })); return; }
  var tb = el('tbody');
  rows.forEach(function (x) {
    tb.appendChild(el('tr', {}, [
      el('td', {}, [el('b', { text: x.title || x.id }), el('br'), el('span', { class: 'small muted', text: x.id })]),
      el('td', { text: x.open ? t('t.open_short') : x.cls }), el('td', { class: 'num', text: String(x.n) }),
      el('td', {}, [stateBadge(x.state)]),
      el('td', {}, [el('button', { type: 'button', class: 'mini', text: t('t.open'), onclick: function () { tOpenTest(x.id); } })])]));
  });
  box.appendChild(el('div', { class: 'tablebox' }, [el('table', {}, [el('thead', {}, [el('tr', {}, [t('t.col_test'), t('t.col_class'), t('t.col_objects'), t('t.col_state'), ''].map(function (h, i) { return el('th', { class: i === 2 ? 'num' : '', text: h }); }))]), tb])]));
}

/* ---------- jeden test ---------- */
async function tOpenTest(id) {
  tTab('test'); $('test-body').hidden = true; tStatus('test-msg', t('common.loading'));
  try {
    var d = await apiRetry('tTest', A({ t: id, withPack: true }), 3);
    var map = d.test.map || {};
    var scene = await buildScene(map.bbox || [-180, -60, 180, 85], map.base || []);
    T.cur = { id: id, d: d, pack: d.pack, scene: scene, dk: d.dk || T.dk }; T.cview = null; T.objKey = ''; T.imgRec = null;
    T.showRes = false; $('show-res').checked = false; T.classForce = false;
    if (T.dz) T.sub = 'over';
    tPrepResults();
    $('test-qr').innerHTML = qrSvg(pupilUrl(id));
    $('test-qr-btn').onclick = function () { tQrCover(id, d.test.title); };
    $('test-dozor-btn').hidden = T.dz || !T.cur.dk;
    $('test-dozor-btn').onclick = function () { tDozorShow(tSummary()); };
    $('test-body').hidden = false; tStatus('test-msg', '');
    $('sc-image').hidden = true;
    tSub(T.sub); tPollStart();
  } catch (e) { tStatus('test-msg', errText(e), 'bad'); }
}
function tSummary() { var x = T.cur.d.test; return { id: x.id, title: x.title, cls: x.cls, open: x.open, n: x.keys.length, time: x.time, dk: T.cur.dk }; }
// Posledný odovzdaný pokus každého žiaka, s percentami podľa aktuálnych hraníc.
// res = všetky odovzdané testy (aj učiteľ), stat = bez učiteľa (priemer, tipy triedy), absent = neprítomní.
function tPrepResults() {
  var d = T.cur.d, last = {};
  d.results.forEach(function (r) { var cur = last[r.pupilId]; if (!cur || !r.absent || cur.absent) last[r.pupilId] = r; });
  T.cur.res = []; T.cur.absent = {};
  Object.keys(last).forEach(function (k) { var r = last[k]; if (r.absent) T.cur.absent[k] = r; else { r.pct = resPct(r); T.cur.res.push(r); } });
  T.cur.stat = T.cur.res.filter(function (r) { return !r.teacher; });
}
function resPct(r) { var sc = T.cur.d.test.scoring, keys = T.cur.d.test.keys, s = 0; keys.forEach(function (k) { s += pctFor(r.km[k], sc.full, sc.zero); }); return keys.length ? s / keys.length : 0; }
function classAvg() { var a = T.cur.stat; return a.length ? a.reduce(function (s, r) { return s + r.pct; }, 0) / a.length : null; }
function tRefresh() {
  return api('tTest', A({ t: T.cur.id })).then(function (d) {
    if (!T.cur || d.test.id !== T.cur.id) return;
    d.pack = T.cur.pack; T.cur.d = d; tPrepResults(); tHead();
    if (T.sub === 'over') tOverview();
    else if (T.sub === 'class') { if ($('class-body').hidden) tClass(); else if (T.cview) { tClassStats(); T.cview.redraw(); } }
  });
}
function tPollStart() {
  clearInterval(T.poll);
  T.poll = setInterval(function () {
    if (T.tab !== 'test' || !T.cur || document.hidden || T.sub === 'score') return;
    tRefresh().catch(function () {});
  }, 6000);
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
  $('test-meta').textContent = [x.open ? t('t.open_short') : t('t.class_short', { cls: x.cls }), x.regions, t('t.n_objects', { n: x.keys.length }), t('t.time_short', { n: x.time }), x.created, x.id].filter(Boolean).join(' · ');
}
async function tToggleState() {
  var x = T.cur.d.test, next = NEXT_STATE[x.state] || 'open';
  if (next === 'closed' && !confirm(t('t.close_confirm'))) return;
  $('test-toggle').disabled = true;
  try {
    await api('tSetTest', A({ t: T.cur.id, patch: { state: next } }));
    x.state = next; tHead();
    if (T.init) T.init.tests.forEach(function (y) { if (y.id === T.cur.id) y.state = next; });
    if (T.sub === 'class') tClass();
  } catch (e) { tStatus('test-msg', errText(e), 'bad'); }
  $('test-toggle').disabled = false;
}

/* prehľad */
// Riadky prehľadu: žiaci triedy (učiteľ na konci), k tomu odovzdané testy mien, ktoré už v zozname nie sú.
function tRows() {
  var d = T.cur.d, rows = d.pupils.map(function (p) { return { id: p.id, label: p.teacher ? t('p.teacher') : p.label, teacher: !!p.teacher }; });
  T.cur.res.forEach(function (r) { if (!rows.some(function (p) { return p.id.split('#')[0] === r.pupilId; })) rows.push({ id: r.pupilId, label: r.teacher ? t('p.teacher') : r.name, teacher: r.teacher }); });
  return rows.filter(function (p) { return !p.teacher; }).concat(rows.filter(function (p) { return p.teacher; }));
}
function tOverview() {
  var d = T.cur.d, x = d.test, by = {}, done = 0, writing = 0, absent = 0, total = 0, tb = el('tbody'), seen = {}, list = [];
  T.cur.res.forEach(function (r) { by[r.pupilId] = r; });
  tRows().forEach(function (p) {
    var key = p.id.split('#')[0], r = seen[key] ? null : by[key], L = d.logins.p[p.id], ab = !r && !L && !!T.cur.absent[key], st, cls = '', btn = null;
    seen[key] = 1;
    if (!p.teacher) total++;
    if (r) { st = t('t.st_done', { time: (/(\d\d:\d\d)/.exec(r.sent) || [])[1] || '' }); cls = 'ok'; if (!p.teacher) done++; }
    else if (L) { st = t('t.st_writing', { time: String(L.t).slice(0, 5) }); if (!p.teacher) writing++; }
    else if (ab) { st = t('t.st_absent'); cls = 'absent'; absent++; }
    else st = t('t.st_none');
    var flags = r && r.flag ? [r.flag] : d.logins.f.filter(function (f) { return f.p === p.id; }).map(function (f) { return f.k + ' ' + f.t; });
    if (L) btn = el('button', { type: 'button', class: 'mini', text: r ? t('t.allow_retry') : t('t.unlock'), onclick: function () {
      if (r && !confirm(t('t.retry_confirm', { name: p.label }))) return;
      api('tUnlock', A({ t: T.cur.id, p: p.id })).then(function () { delete d.logins.p[p.id]; tOverview(); }).catch(function (e) { tStatus('test-msg', errText(e), 'bad'); });
    } });
    else if (!r && !p.teacher && !x.open && !T.oldScript) btn = el('button', { type: 'button', class: 'mini', text: ab ? t('t.unmark_absent') : t('t.mark_absent'), onclick: function () { tAbsent(p, !ab, this); } });
    list.push({ p: p, r: r, st: st, cls: cls, flags: flags, btn: btn });
  });
  // stĺpec Príznak len vtedy, keď nejaký príznak je (na telefóne by inak tabuľka nevošla)
  var anyFlag = list.some(function (o) { return o.flags.length; });
  list.forEach(function (o) {
    var cells = [el('td', { text: o.p.label }), el('td', { class: o.cls, text: o.st })];
    if (T.showRes) cells.push(el('td', { class: 'num', text: o.r ? fmtPct(o.r.pct) : '' }));
    if (anyFlag) cells.push(el('td', { class: o.flags.length ? 'bad small' : 'small', text: o.flags.join('; ') }));
    cells.push(el('td', { class: 'act' }, [o.btn]));
    tb.appendChild(el('tr', {}, cells));
  });
  $('over-sum').textContent = t('t.over_sum', { done: done, total: total - absent, writing: writing }) + (absent ? ' ' + t('t.over_absent', { n: absent }) : '');
  var heads = [t('t.col_pupil'), t('t.col_status')].concat(T.showRes ? [t('t.col_result')] : []).concat(anyFlag ? [t('t.col_flag')] : []).concat(['']);
  var box = $('over-table'); box.innerHTML = '';
  box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, heads.map(function (h, i) { return el('th', { class: T.showRes && i === 2 ? 'num' : '', text: h }); }))]), tb]));
  var avg = classAvg();
  $('avg-label').textContent = t(x.open ? 't.avg_label_open' : 't.avg_label');
  $('avg-pct').textContent = avg === null ? '–' : fmtPct(avg);
  $('avg-note').textContent = avg === null ? t('t.no_results') : t(x.open ? 't.avg_note_open' : 't.avg_note');
}
async function tAbsent(p, on, btn) {
  if (btn) btn.disabled = true;
  try { await api('tAbsent', A({ t: T.cur.id, p: p.id, on: on })); await tRefresh(); }
  catch (e) { tStatus('test-msg', errText(e), 'bad'); if (btn) btn.disabled = false; }
}
// Výsledky do Excelu: meno a percentá (bez učiteľa), neprítomní s textom.
function tCopyResults() {
  var by = {}, seen = {}, lines = [[t('t.tsv_pupil'), t('t.tsv_result')].join('\t')];
  T.cur.res.forEach(function (r) { by[r.pupilId] = r; });
  tRows().forEach(function (p) {
    var key = p.id.split('#')[0]; if (p.teacher || seen[key]) return; seen[key] = 1;
    var r = by[key];
    lines.push([p.label, r ? Math.round(r.pct * 100) : T.cur.absent[key] ? t('t.st_absent') : ''].join('\t'));
  });
  copyText(lines.join('\n'), 'over-msg', t('t.copied_results'));
}

/* tipy triedy */
function objStats(k) {
  var d = T.cur.d, sc = d.test.scoring, ds = [], miss = 0, full = 0, sumP = 0, n = 0;
  T.cur.stat.forEach(function (r) {
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
  keys.forEach(function (k, i) { sel.appendChild(el('option', { value: k, text: (i + 1) + '. ' + pack.objects[k].name })); }); sel.value = T.objKey;
  var o = pack.objects[T.objKey];
  $('class-kind').textContent = typeOne(o.type);
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
      el('td', {}, [el('button', { type: 'button', class: 'linkbtn', text: pack.objects[x.k].name, onclick: function () { T.objKey = x.k; tClass(); } })]),
      el('td', { class: 'num', text: x.s.med === null ? '–' : fmtKm(x.s.med) }), el('td', { class: 'num', text: x.s.n ? fmtPct(x.s.avg) : '–' }),
      el('td', { class: 'num', text: x.s.suggest === null ? '–' : String(x.s.suggest) })]));
  });
  var box = $('class-rank'); box.innerHTML = '';
  box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, [t('t.col_obj_hard'), t('t.st_median'), t('t.st_avg'), t('t.st_suggest')].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); }))]), tb]));
}
function tClassStep(dir) { var keys = T.cur.d.test.keys, i = keys.indexOf(T.objKey); T.objKey = keys[(i + dir + keys.length) % keys.length]; tClass(); }
// Štatistiky na vloženie do objekty.xlsx (oddelené tabulátorom).
function tCopyStats() {
  var pack = T.cur.pack, lines = [[t('t.tsv_id'), t('t.tsv_name'), t('t.st_tips'), t('t.st_median'), t('t.st_avg'), t('t.st_suggest')].join('\t')];
  T.cur.d.test.keys.forEach(function (k) {
    var s = objStats(k), dot = function (x) { return String(x).replace('.', I18N.lang === 'en' ? '.' : ','); };
    lines.push([k, pack.objects[k].name, s.n - s.miss, s.med === null || s.med === Infinity ? '' : dot(round1(s.med)), s.n ? Math.round(s.avg * 100) : '', s.suggest === null ? '' : s.suggest].join('\t'));
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
    tb.appendChild(el('tr', {}, [el('td', { text: r.teacher ? t('p.teacher') : r.name }), el('td', { class: 'num', text: fmtPct(r.pct) }),
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
    items: x.keys.map(function (k) { var o = pack.objects[k], tip = r.tips[k]; return { name: o.name, type: o.type, g: o.g, c: tip ? [tip[1], tip[0]] : null, d: r.km[k], why: r.km[k] === null ? (r.why[k] || 'none') : '' }; }) };
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

/* ---------- tlačidlá ---------- */
(function () {
  function on(id, fn, ev) { var e = $(id); if (e) e[ev || 'onclick'] = fn; }
  on('tab-new', function () { tTab('new'); });
  on('tab-tests', function () { tTab('tests'); });
  on('m-auto', function () { tSetMode('auto'); });
  on('m-manual', function () { tSetMode('manual'); });
  on('refill', tRefill);
  on('clear-all', function () { T.slots = T.slots.map(function () { return null; }); tSlots(); });
  on('prev-show', function () { if (T.pview) T.pview.redraw(); }, 'onchange');
  on('start', function () { tStart('open'); });
  on('prepare', function () { tStart('ready'); });
  on('list-toggle', function () { tListToggle(!T.listOpen); });
  on('show-res', function () { T.showRes = this.checked; if (T.sub === 'over') tOverview(); else if (T.sub === 'score') tScore(); }, 'onchange');
  on('over-copy', tCopyResults);
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
  window.addEventListener('afterprint', function () { $('print-sheet').innerHTML = ''; });
  on('qr-cover', function (e) { if (e.target === $('qr-cover')) $('qr-cover').hidden = true; });
  on('t-disconnect', function () { if (confirm(t('t.disconnect_confirm'))) { store('sm-teacher', null); location.reload(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('qr-cover').hidden = true; });
  // odkaz z tabuľky vložený do už otvorenej stránky mení len časť za #, stránka sa preto načíta znova
  window.addEventListener('hashchange', function () { if (/[#&]k=/.test(location.hash)) location.reload(); });
})();
teacherStart();
