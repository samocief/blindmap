/* Slepá mapa: precvičovanie pre kohokoľvek. Bez tabuľky a bez prihlásenia, nič sa neukladá mimo prehliadača.
 * Je na úvodnej adrese aplikácie. Odkaz môže mať prednastavené filtre: ?r=sk&t=water,relief&d=1-3&n=10&s=20&l=sk/base_relief.png,sk/rivers.json
 * (r = oblasť, t = témy alebo typy objektov, d = obtiažnosť od-do, n = počet, s = sekundy na tip, l = viditeľné vrstvy, súbory z data/index.json)
 * Odkaz na test žiaka (?s=<skript>&t=<test>) presmeruje index.html hneď na test.html.
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
  $('c-privacy').hidden = !Data.statsUrl;
  // nastavenia z odkazu majú prednosť pred zapamätanými
  var S = cSet(), d = /^(\d)\s*-\s*(\d)$/.exec(param('d') || '');
  if (param('r')) S.regions = list(param('r'));
  if (param('t')) S.types = expandTypes(list(param('t')));
  if (d) { S.dmin = +d[1]; S.dmax = +d[2]; }
  if (param('n')) S.n = +param('n');
  if (param('s') !== '') S.time = +param('s');
  if (param('l')) C.linkBase = list(param('l'));
  cSave(S);
  [0, 10, 15, 20, 30, 60].forEach(function (x) { $('c-time').appendChild(el('option', { value: String(x), text: x ? t('c.time_s', { n: x }) : t('c.time_none') })); });
  $('c-dmin').value = String(S.dmin || 1); $('c-dmax').value = String(S.dmax || 5);
  diffSlider($('c-diff'), $('c-dmin'), $('c-dmax'));
  $('c-n').value = S.n || 10; $('c-time').value = String([0, 10, 15, 20, 30, 60].indexOf(S.time) >= 0 ? S.time : 20);
  regionSelect($('c-region'), C.regions, (S.regions || [])[0], cRegions);
  $('c-dmin').onchange = $('c-dmax').onchange = $('c-n').oninput = $('c-time').onchange = function () { cSave(cForm()); cPoolInfo(); };
  $('c-go').onclick = function () { cBegin(null); };
  $('c-again').onclick = function () { cBegin(null); };
  $('c-settings').onclick = function () { cShow('c-setup'); };
  $('g-quit').onclick = cQuit;
  cShow('c-setup');
  cRegions();
}
function chipsC(box, items, checked, onchange) { renderChips(box, items, checked, onchange); }
function vals(box) { return Array.prototype.slice.call(box.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
function cCodes() { return $('c-region').value ? [$('c-region').value] : []; }
function cForm() {
  var a = +$('c-dmin').value, b = +$('c-dmax').value;
  return { regions: cCodes(), types: checkedTypes($('c-types')), dmin: Math.min(a, b), dmax: Math.max(a, b),
    n: Math.max(1, Math.min(50, parseInt($('c-n').value, 10) || 10)), time: +$('c-time').value || 0 };
}
// Popis na mape po tipe: pri EČV aj názov okresu („BJ · Bardejov“).
function objLabel(o) { return o.note ? o.name + ' · ' + o.note : o.name; }
function regionOf(code) { return C.regions.filter(function (r) { return r.code === code; })[0]; }

async function cRegions() {
  var seq = ++C.seq, codes = cCodes();
  cSave({ regions: codes });
  $('c-go').disabled = true; $('c-pool').textContent = codes.length ? t('common.loading') : t('t.pick_region');
  var files = [];
  codes.forEach(function (c) { var r = regionOf(c); if (r) r.objects.forEach(function (o) { files.push({ entry: o, region: c }); }); });
  var lists = [];
  try { lists = await Promise.all(files.map(function (f) { return Data.objects(f.entry, f.entry.type, f.region); })); } catch (e) { $('c-pool').textContent = errText(e); }
  if (seq !== C.seq) return;
  var byId = {}, all = [];
  lists.forEach(function (l) { l.forEach(function (o) { if (!byId[o.id]) { byId[o.id] = o; all.push(o); } }); });
  C.all = all;
  var counts = {}; all.forEach(function (o) { counts[o.type] = (counts[o.type] || 0) + 1; });
  var items = themeItems(counts), S = cSet(), prev = themesOf(items, S.types || []);
  chipsC($('c-types'), items, prev.length ? prev : items.map(function (x) { return x.value; }), function () { cSave({ types: checkedTypes($('c-types')) }); cPoolInfo(); });
  cBaseChips(codes);
  cPoolInfo();
}
// Viditeľné vrstvy: reliéf a skupiny objektov (vodstvo, kraje …); obrys a okolie sú na mape vždy.
// Na rozdiel od testu sa dá zapnúť aj vrstva typu, ktorý sa hádá (ľahší režim: žiak vyberá z nakreslených riek). Predvolene je vypnutá.
function cBaseChips(codes) {
  var S = cSet(), on = S.base || [], seen = S.seen || [], items = layerItems(C.regions, codes), all = items.map(function (x) { return x.value; });
  var checked = items.filter(function (x) { return C.linkBase ? layerInList(x.value, C.linkBase) : seen.indexOf(x.value) >= 0 ? on.indexOf(x.value) >= 0 : x.def; }).map(function (x) { return x.value; });
  C.linkBase = null;
  chipsC($('c-base'), items, checked, function () { cSave({ base: layersAfterChange($('c-base'), cSet().base) }); });
  cSave({ seen: uniq(seen.concat(all)), base: uniq(on.filter(function (f) { return all.indexOf(f) < 0; }).concat(checked)) });
}
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
  C.repeat = !!objects;
  if (!objs.length) { cShow('c-setup'); return; }
  $('c-load-msg').textContent = t('p.loading_map'); cShow('c-load');
  var bbox = null, refs = sceneRefs(C.regions, F.regions, vals($('c-base')));
  F.regions.forEach(function (c) { var r = regionOf(c); if (r) bbox = bboxUnion(bbox, r.bbox || geomBBox(objs[0].g)); });
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
    s += drawLabel(anchorOf(it.o.g), v.proj, objLabel(it.o), v.pal.ok, v.pal.halo, v.uPx(), 14, it.o.g.t === 'pt' ? -15 : 0, true);
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
// Ukončenie kola kedykoľvek: späť na úvodnú stránku s nastaveniami. Po prvom tipe sa najprv opýta, kolo sa nezapočíta do štatistiky.
function cQuit() {
  if ((C.idx > 0 || C.phase === 'reveal' || C.pin) && !confirm(t('c.quit_confirm'))) return;
  clearInterval(C.tick); C.phase = 'idle'; C.pin = null;
  cShow('c-setup');
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
  cLog(C.items.length ? sum / C.items.length : 0);
  var F = cSet(), wrong = C.items.filter(function (it) { return it.pct < C_WRONG; });
  $('c-end-pct').textContent = fmtPct(C.items.length ? sum / C.items.length : 0);
  $('c-end-sub').textContent = F.regions.map(function (c) { var r = regionOf(c); return regionLabel(c, r && r.names); }).join(', ');
  var w = $('c-wrong'); w.hidden = !wrong.length; w.textContent = t('c.wrong', { n: wrong.length });
  w.onclick = function () { cBegin(shuffle(wrong.map(function (it) { return it.o; }))); };
  var ul = $('r-list'); ul.innerHTML = ''; C.rsel = -1;
  C.items.forEach(function (it, i) {
    ul.appendChild(el('li', {}, [el('button', { type: 'button', onclick: function () { cSelect(i); } }, [
      el('span', { class: 'tipnum' + (it.c ? '' : ' none'), text: String(i + 1) }),
      el('span', {}, [el('span', { class: 'muted', text: typeOne(it.o.type) + ': ' }), el('b', { text: it.o.name }), it.o.note ? el('span', { class: 'muted', text: ' · ' + it.o.note }) : null]),
      el('span', { class: 'r' }, [fmtKm(it.d), el('span', { text: fmtPct(it.pct) })])])]));
  });
  cShow('c-end');
  C.rview = new MapView(freshSvg('r-map'), C.scene, { overlay: cEndOverlay });
  mapControls($('r-mapbox'), function () { return C.rview; });
}
// Anonymná štatistika (apps-script/Stats.gs): po dokončenom kole jeden záznam bez mena.
// Prehliadač sa rozlišuje len náhodným číslom, aby sa dalo odhadnúť, koľko ľudí precvičovalo.
function cLog(avg) {
  if (!Data.statsUrl || !C.items.length) return;
  var rnd = function () { return Math.random().toString(36).slice(2, 10); };
  var dev = store('sm-anon'); if (!dev) { dev = rnd() + rnd().slice(0, 4); store('sm-anon', dev); }
  var F = cSet(), r = regionOf((F.regions || [])[0]);
  var groups = Array.prototype.slice.call($('c-types').querySelectorAll('input:checked')).map(function (i) { return themeLabel(i.value); }).join(', ');
  var body = JSON.stringify({ a: 'practice', v: APP.version, game: rnd(), dev: dev, region: r ? regionLabel(r.code, r.names) : '', groups: groups,
    diff: F.dmin === F.dmax ? String(F.dmin) : F.dmin + '–' + F.dmax, time: C.time, pct: Math.round(avg * 1000) / 1000, repeat: !!C.repeat,
    items: C.items.map(function (it) { return { id: it.o.id, name: objLabel(it.o), type: typeOne(it.o.type), diff: it.o.diff, km: it.d, pct: Math.round(it.pct * 1000) / 1000 }; }) });
  try { fetch(Data.statsUrl, { method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true, body: body }).catch(function () {}); } catch (e) { /* štatistika nesmie pokaziť hru */ }
}
function cEndOverlay(v) {
  var s = '', u = v.uPx(), sel = C.rsel;
  C.items.forEach(function (it, i) { s += drawTarget(it.o.g, v.proj, v.pal, 0, i === sel); });
  C.items.forEach(function (it) { if (it.c && it.d > 0) s += drawConn(it.c, measure(it.o.g, it.c).near, v.proj, v.pal, 0); });
  C.items.forEach(function (it, i) { if (i === sel || sel < 0) s += drawLabel(anchorOf(it.o.g), v.proj, objLabel(it.o), v.pal.ok, v.pal.halo, u, i === sel ? 15 : 12, it.o.g.t === 'pt' ? -14 : 0, i === sel); });
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
