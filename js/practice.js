/* Slepá mapa: precvičovanie pre kohokoľvek. Bez tabuľky a bez prihlásenia, nič sa neukladá mimo prehliadača.
 * Odkaz môže mať prednastavené filtre: cvicenie.html?r=sk&t=rivers,mountains&d=1-3&n=10&s=20&l=sk/base_land.json,sk/rivers.json
 * (l = vrstvy na mape, súbory z data/index.json)
 */
var C = { regions: [], pool: [], all: [], items: [], idx: 0, scene: null, sceneKey: '', view: null, rview: null, pin: null, phase: 'idle', tick: null, deadline: 0, time: 0, scoring: null, rsel: -1, seq: 0, linkBase: null };
var C_KEY = 'sm-practice2', C_PFULL = 1, C_PZERO = 30, C_WRONG = 0.7;

function cShow(id) { show(id, 'c'); $('c-wrap').hidden = id === 'c-game'; }
function cSet() { return store(C_KEY) || {}; }
function cSave(p) { store(C_KEY, Object.assign(cSet(), p)); }
function list(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

async function practiceStart() {
  try { await loadLang(param('lang') || 'sk'); } catch (e) { document.body.textContent = e.message; return; }
  applyI18n();
  try { C.regions = await Data.index(); } catch (e) { $('c-fail-msg').textContent = t('t.no_index'); cShow('c-fail'); return; }
  // nastavenia z odkazu majú prednosť pred zapamätanými
  var S = cSet(), d = /^(\d)\s*-\s*(\d)$/.exec(param('d') || '');
  if (param('r')) S.regions = list(param('r'));
  if (param('t')) S.types = list(param('t'));
  if (d) { S.dmin = +d[1]; S.dmax = +d[2]; }
  if (param('n')) S.n = +param('n');
  if (param('s') !== '') S.time = +param('s');
  if (param('l')) C.linkBase = list(param('l'));
  cSave(S);
  ['c-dmin', 'c-dmax'].forEach(function (id) { var s = $(id); for (var i = 1; i <= 5; i++) s.appendChild(el('option', { value: String(i), text: String(i) })); });
  [0, 10, 15, 20, 30, 60].forEach(function (x) { $('c-time').appendChild(el('option', { value: String(x), text: x ? t('c.time_s', { n: x }) : t('c.time_none') })); });
  $('c-dmin').value = String(S.dmin || 1); $('c-dmax').value = String(S.dmax || 5);
  $('c-n').value = S.n || 10; $('c-time').value = String([0, 10, 15, 20, 30, 60].indexOf(S.time) >= 0 ? S.time : 20);
  var codes = C.regions.map(function (r) { return r.code; }), sel = (S.regions || []).filter(function (c) { return codes.indexOf(c) >= 0; });
  chipsC($('c-regions'), C.regions.map(function (r) { return { value: r.code, label: regionLabel(r.code, r.names) }; }), sel.length ? sel : codes.slice(0, 1), cRegions);
  $('c-dmin').onchange = $('c-dmax').onchange = $('c-n').oninput = $('c-time').onchange = function () { cSave(cForm()); cPoolInfo(); };
  $('c-go').onclick = function () { cBegin(null); };
  $('c-again').onclick = function () { cBegin(null); };
  $('c-settings').onclick = function () { cShow('c-setup'); };
  cShow('c-setup');
  cRegions();
}
function chipsC(box, items, checked, onchange) {
  box.innerHTML = '';
  items.forEach(function (it, i) {
    var id = box.id + '-' + i, inp = el('input', { type: 'checkbox', id: id, value: it.value, 'data-type': it.type });
    inp.checked = checked.indexOf(it.value) >= 0; inp.onchange = onchange || null;
    box.appendChild(el('label', { class: 'chip', for: id }, [inp, ' ' + it.label]));
  });
}
function vals(box) { return Array.prototype.slice.call(box.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
function cForm() {
  var a = +$('c-dmin').value, b = +$('c-dmax').value;
  return { regions: vals($('c-regions')), types: vals($('c-types')), dmin: Math.min(a, b), dmax: Math.max(a, b),
    n: Math.max(1, Math.min(50, parseInt($('c-n').value, 10) || 10)), time: +$('c-time').value || 0 };
}
function regionOf(code) { return C.regions.filter(function (r) { return r.code === code; })[0]; }

async function cRegions() {
  var seq = ++C.seq, codes = vals($('c-regions'));
  cSave({ regions: codes });
  $('c-go').disabled = true; $('c-pool').textContent = codes.length ? t('common.loading') : t('t.pick_region');
  var files = [];
  codes.forEach(function (c) { var r = regionOf(c); if (r) r.objects.forEach(function (o) { files.push({ file: o.file, type: o.type, region: c }); }); });
  var lists = [];
  try { lists = await Promise.all(files.map(function (f) { return Data.objects(f.file, f.type, f.region); })); } catch (e) { $('c-pool').textContent = errText(e); }
  if (seq !== C.seq) return;
  var byId = {}, all = [];
  lists.forEach(function (l) { l.forEach(function (o) { if (!byId[o.id]) { byId[o.id] = o; all.push(o); } }); });
  C.all = all;
  var counts = {}; all.forEach(function (o) { counts[o.type] = (counts[o.type] || 0) + 1; });
  var order = ['countries', 'regions', 'districts', 'cities', 'rivers', 'lakes', 'seas', 'oceans', 'mountains', 'peaks', 'lowlands', 'islands', 'peninsulas', 'deserts', 'parks', 'caves'];
  var types = Object.keys(counts).sort(function (a, b) { var i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  var S = cSet(), prev = (S.types || []).filter(function (x) { return counts[x]; });
  chipsC($('c-types'), types.map(function (x) { return { value: x, label: typeLabel(x) + ' (' + counts[x] + ')' }; }), prev.length ? prev : types, function () { cSave({ types: vals($('c-types')) }); cLock(); cPoolInfo(); });
  cBaseChips(codes);
  cPoolInfo();
}
// Čo bude na mape: podkladové vrstvy a celé typy objektov („Všetky rieky“). Typ, ktorý sa hádá, je zošedený.
function cBaseChips(codes) {
  var S = cSet(), on = S.base || [], seen = S.seen || [], items = layerItems(C.regions, codes), all = items.map(function (x) { return x.value; });
  var checked = items.filter(function (x) { return C.linkBase ? C.linkBase.indexOf(x.value) >= 0 : seen.indexOf(x.value) >= 0 ? on.indexOf(x.value) >= 0 : x.def; }).map(function (x) { return x.value; });
  C.linkBase = null;
  chipsC($('c-base'), items, checked, function () { cSave({ base: layersAfterChange($('c-base'), cSet().base) }); });
  cSave({ seen: uniq(seen.concat(all)), base: uniq(on.filter(function (f) { return all.indexOf(f) < 0; }).concat(checked)) });
  cLock();
}
function cLock() { lockLayers($('c-base'), vals($('c-types')), cSet().base); }
function cPoolOf(F) { return C.all.filter(function (o) { return F.types.indexOf(o.type) >= 0 && o.diff >= F.dmin && o.diff <= F.dmax; }); }
function cPoolInfo() {
  var F = cForm(), n = cPoolOf(F).length;
  $('c-pool').textContent = F.regions.length ? t('c.pool', { n: n }) : t('t.pick_region');
  $('c-go').disabled = !n;
}
// Náhodný výber vyvážený podľa obtiažnosti a typu (ako Auto v aplikácii učiteľa).
function cPick(pool, n) {
  var chosen = [], used = {}, cd = {}, ct = {};
  while (chosen.length < n) {
    var avail = pool.filter(function (x) { return !used[x.id]; });
    if (!avail.length) break;
    var m = Math.min.apply(null, avail.map(function (x) { return cd[x.diff] || 0; }));
    avail = avail.filter(function (x) { return (cd[x.diff] || 0) === m; });
    m = Math.min.apply(null, avail.map(function (x) { return ct[x.type] || 0; }));
    avail = avail.filter(function (x) { return (ct[x.type] || 0) === m; });
    var o = avail[Math.floor(Math.random() * avail.length)];
    chosen.push(o); used[o.id] = 1; cd[o.diff] = (cd[o.diff] || 0) + 1; ct[o.type] = (ct[o.type] || 0) + 1;
  }
  return shuffle(chosen);
}

/* ---------- hra ---------- */
async function cBegin(objects) {
  var F = cForm(); cSave(F);
  var objs = objects || cPick(cPoolOf(F), F.n);
  if (!objs.length) { cShow('c-setup'); return; }
  $('c-load-msg').textContent = t('p.loading_map'); cShow('c-load');
  var bbox = null, refs = [], files = vals($('c-base'));
  F.regions.forEach(function (c) {
    var r = regionOf(c); if (!r) return;
    bbox = bboxUnion(bbox, r.bbox || geomBBox(objs[0].g));
    r.base.forEach(function (b) { if (files.indexOf(b.file) >= 0) refs.push({ file: b.file, style: layerStyle(b.name, b.raster) }); });
    r.objects.forEach(function (o) { if (files.indexOf(o.file) >= 0) refs.push({ file: o.file, style: layerStyle(o.type, false) }); });
  });
  var key = JSON.stringify([bbox, refs]);
  if (key !== C.sceneKey) { C.scene = await buildScene(bbox, refs); C.sceneKey = key; C.view = null; }
  C.scoring = { full: round1(C.scene.diag * C_PFULL / 100), zero: round1(C.scene.diag * C_PZERO / 100) };
  C.time = F.time; C.items = objs.map(function (o) { return { o: o, c: null, d: null }; }); C.idx = 0;
  cQuestion();
}
function cOverlay(v) {
  var it = C.items[C.idx], s = '';
  if (C.phase === 'reveal' && it) {
    s += drawTarget(it.o.g, v.proj, v.pal, 0, true);
    if (it.c && it.d > 0) s += drawConn(it.c, measure(it.o.g, it.c).near, v.proj, v.pal, 0);
    s += drawLabel(anchorOf(it.o.g), v.proj, it.o.name, v.pal.ok, v.pal.halo, v.uPx(), 14, it.o.g.t === 'pt' ? -15 : 0, true);
  }
  if (C.pin) s += drawDot(C.pin, v.proj, v.pal.tip, v.pal.halo, 16, 0);
  return s;
}
function cQuestion() {
  cShow('c-game');
  var it = C.items[C.idx];
  $('g-name').textContent = taskText(it.o);
  $('g-i').textContent = C.idx + 1; $('g-n').textContent = C.items.length;
  C.pin = null; C.phase = 'guess';
  if (!C.view) {
    C.view = new MapView(freshSvg('g-map'), C.scene, { overlay: cOverlay, onTap: function (c) {
      if (C.phase !== 'guess') return;
      C.pin = c; $('g-btn').disabled = false; $('g-msg').textContent = t('p.pin_placed'); C.view.redraw();
    } });
    mapControls($('g-mapbox'), function () { return C.view; });
  } else C.view.reset();
  var b = $('g-btn'); b.textContent = t('p.confirm_tip'); b.disabled = true; b.onclick = cConfirm;
  $('g-msg').textContent = t('p.tap_map');
  clearInterval(C.tick);
  $('g-bar').hidden = !C.time; $('g-sec').textContent = '';
  if (C.time) { C.deadline = Date.now() + C.time * 1000; C.tick = setInterval(cTimer, 200); cTimer(); }
}
function cTimer() {
  var left = (C.deadline - Date.now()) / 1000;
  $('g-sec').textContent = t('p.seconds', { n: Math.max(0, Math.ceil(left)) });
  $('g-bar').firstElementChild.style.width = Math.max(0, left / C.time * 100) + '%';
  $('g-bar').classList.toggle('low', left <= Math.min(10, C.time / 3));
  if (left <= 0) cConfirm();
}
// Po tipe sa hneď ukáže správna poloha a mapa sa priblíži, aby bolo vidieť tip aj objekt.
function cConfirm() {
  if (C.phase !== 'guess') return;
  clearInterval(C.tick);
  var it = C.items[C.idx];
  if (C.pin) { it.c = [+C.pin[0].toFixed(4), +C.pin[1].toFixed(4)]; it.d = round1(measure(it.o.g, C.pin).d); }
  C.phase = 'reveal';
  var b = geomBBox(it.o.g); if (it.c) b = bboxUnion(b, [it.c[0], it.c[1], it.c[0], it.c[1]]);
  C.view.zoomTo(b);
  $('g-sec').textContent = ''; $('g-bar').firstElementChild.style.width = '0%';
  var p = fmtPct(pctFor(it.d, C.scoring.full, C.scoring.zero)), m = $('g-msg');
  if (!it.c) m.innerHTML = esc(t('p.no_tip_time')) + ' <b>' + esc(fmtPct(0)) + '</b>';
  else if (it.d === 0) m.innerHTML = '<b>' + esc(t('p.exact')) + '</b> ' + esc(p);
  else m.innerHTML = esc(t('p.deviation')) + ' <b>' + esc(fmtKm(it.d)) + '</b> · ' + esc(p);
  var btn = $('g-btn'); btn.disabled = false;
  btn.textContent = C.idx + 1 < C.items.length ? t('p.next') : t('c.show_results');
  btn.onclick = function () { if (C.idx + 1 < C.items.length) { C.idx++; cQuestion(); } else cEnd(); };
}

/* ---------- výsledky ---------- */
function cEnd() {
  C.phase = 'idle';
  var sum = 0; C.items.forEach(function (it) { it.pct = pctFor(it.d, C.scoring.full, C.scoring.zero); sum += it.pct; });
  var F = cSet(), wrong = C.items.filter(function (it) { return it.pct < C_WRONG; });
  $('c-end-pct').textContent = fmtPct(C.items.length ? sum / C.items.length : 0);
  $('c-end-sub').textContent = F.regions.map(function (c) { var r = regionOf(c); return regionLabel(c, r && r.names); }).join(', ');
  var w = $('c-wrong'); w.hidden = !wrong.length; w.textContent = t('c.wrong', { n: wrong.length });
  w.onclick = function () { cBegin(shuffle(wrong.map(function (it) { return it.o; }))); };
  var ul = $('r-list'); ul.innerHTML = ''; C.rsel = -1;
  C.items.forEach(function (it, i) {
    ul.appendChild(el('li', {}, [el('button', { type: 'button', onclick: function () { cSelect(i); } }, [
      el('span', { class: 'tipnum' + (it.c ? '' : ' none'), text: String(i + 1) }),
      el('span', {}, [el('span', { class: 'muted', text: typeOne(it.o.type) + ': ' }), el('b', { text: it.o.name })]),
      el('span', { class: 'r' }, [fmtKm(it.d), el('span', { text: fmtPct(it.pct) })])])]));
  });
  cShow('c-end');
  C.rview = new MapView(freshSvg('r-map'), C.scene, { overlay: cEndOverlay });
  mapControls($('r-mapbox'), function () { return C.rview; });
}
function cEndOverlay(v) {
  var s = '', u = v.uPx(), sel = C.rsel;
  C.items.forEach(function (it, i) { s += drawTarget(it.o.g, v.proj, v.pal, 0, i === sel); });
  C.items.forEach(function (it) { if (it.c && it.d > 0) s += drawConn(it.c, measure(it.o.g, it.c).near, v.proj, v.pal, 0); });
  C.items.forEach(function (it, i) { if (i === sel || sel < 0) s += drawLabel(anchorOf(it.o.g), v.proj, it.o.name, v.pal.ok, v.pal.halo, u, i === sel ? 15 : 12, it.o.g.t === 'pt' ? -14 : 0, i === sel); });
  C.items.forEach(function (it, i) { if (it.c) s += drawNumDot(it.c, v.proj, i + 1, v.pal.tip, u, i === sel ? 28 : 22); });
  return s;
}
function cSelect(i) {
  C.rsel = C.rsel === i ? -1 : i;
  $('r-list').querySelectorAll('button').forEach(function (b, j) { b.classList.toggle('sel', j === C.rsel); });
  if (C.rsel < 0) { C.rview.reset(); return; }
  var it = C.items[i], b = geomBBox(it.o.g);
  if (it.c) b = bboxUnion(b, [it.c[0], it.c[1], it.c[0], it.c[1]]);
  C.rview.zoomTo(b);
  $('r-mapbox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

practiceStart();
