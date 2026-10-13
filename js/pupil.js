/* Slepá mapa: stránka žiaka. Odkaz z QR kódu má tvar index.html?s=<skript učiteľa>&t=<test>. */
var P = { t: '', info: null, scene: null, scenePromise: null, objs: null, keys: null, S: null, view: null, pin: null, phase: 'idle', tick: null, device: '', blurTimer: null, poll: null, rview: null, R: null, rsel: -1 };
var AWAY_HIDDEN_MS = 1000, AWAY_BLUR_MS = 4000, POLL_MS = 8000;

function pShow(id) { show(id, 'p'); $('p-wrap').hidden = id === 'p-game'; }
function pFail(msg) { $('p-fail-msg').textContent = msg; pShow('p-fail'); }
function pLoading(msg) { $('p-load-msg').textContent = msg || t('common.loading'); pShow('p-load'); }
function sessKey() { return 'sm-test-' + P.t; }
function pSave() { store(sessKey(), P.S); }
function firstName(label) { var p = String(label).split(' '); return p.length > 1 ? p.slice(1).join(' ') : label; }

async function pupilStart() {
  var s = param('s'), testId = param('t');
  try { await loadLang(param('lang') || 'sk'); } catch (e) { document.body.textContent = e.message; return; }
  applyI18n();
  if (!s || !testId) { pFail(t('p.no_link')); $('p-fail-practice').hidden = false; return; }
  API.url = scriptUrl(s); P.t = testId;
  P.device = store('sm-device') || (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5));
  store('sm-device', P.device);
  pLoading();
  pupilGuard();
  var info;
  try { info = await apiRetry('pupilInit', { t: testId }, 3); } catch (e) { pFail(errText(e)); return; }
  P.info = info;
  if (info.lang && info.lang !== I18N.lang) { await loadLang(info.lang).catch(function () {}); applyI18n(); }
  document.title = (info.title ? info.title + ' · ' : '') + t('app.title');
  var map = info.map || {};
  P.scenePromise = buildScene(map.bbox || [-180, -60, 180, 85], map.base || []).then(function (sc) { P.scene = sc; return sc; });
  var saved = store(sessKey());
  if (info.state === 'closed') {
    if (saved && saved.pupilId) pupilResults(); else pFail(t('p.closed'));
    return;
  }
  if (saved && saved.done && saved.pupilId) { P.S = saved; pupilFinish(); return; }
  if (saved && saved.pupilId) pupilLogin(saved.pupilId, saved); else pupilNames();
}

/* ---------- výber mena ---------- */
function pupilNames(err) {
  var info = P.info;
  $('p-pick-cls').textContent = t('p.class', { cls: info.cls }) + (info.title ? ' · ' + info.title : '');
  var box = $('p-names'); box.innerHTML = '';
  info.names.forEach(function (n) {
    box.appendChild(el('button', { type: 'button', class: 'namebtn', text: n.label + (n.done ? ' ✓' : ''), disabled: n.done, title: n.done ? t('p.already_done') : null, onclick: function () { pupilPick(n); } }));
  });
  if (!info.names.length) box.appendChild(el('p', { class: 'muted', text: t('p.no_names') }));
  $('p-pick-err').textContent = err || ''; $('p-pick-err').hidden = !err;
  pShow('p-pick');
}
function pupilPick(n) {
  $('p-confirm-name').textContent = n.label;
  $('p-confirm-go').onclick = function () { pupilLogin(n.id, null); };
  $('p-confirm-back').onclick = function () { pupilNames(); };
  pShow('p-confirm');
}
async function pupilLogin(pupilId, saved) {
  pLoading();
  var r;
  try { r = await apiRetry('pupilLogin', { t: P.t, p: pupilId, d: P.device }, 3); }
  catch (e) {
    if (saved) store(sessKey(), null);
    if (e.code === 'closed') { pFail(t('p.closed')); return; }
    if (e.code === 'done' && saved) { pFail(t('err.done')); return; }
    if (e.code === 'taken' || e.code === 'done' || e.code === 'not_in_class') { pupilNames(errText(e)); return; }
    pFail(errText(e)); return;
  }
  P.objs = r.objects; P.keys = r.keys;
  var same = saved && saved.order && saved.order.length === r.keys.length && saved.order.every(function (k) { return r.keys.indexOf(k) >= 0; });
  P.S = same ? saved : { pupilId: pupilId, order: shuffle(r.keys), idx: -1, res: {}, deadline: 0, done: false, sent: false, leaves: 0, awayAt: 0, awayIdx: -1, ended: false };
  P.S.name = r.name; P.S.time = r.time; P.S.scoring = r.scoring;
  P.S.names = {}; r.keys.forEach(function (k) { P.S.names[k] = { name: r.objects[k].name, type: r.objects[k].type }; });
  pSave();
  if (P.S.done) { pupilFinish(); return; }
  if (P.S.idx >= 0) { pLoading(t('p.loading_map')); await P.scenePromise; pupilQuestion(); return; }
  pupilIntro();
}
function pupilIntro() {
  var S = P.S, go = $('p-intro-go');
  $('p-intro-hello').textContent = t('p.hello', { name: firstName(S.name) });
  $('p-intro-n').innerHTML = esc(t('p.intro_n', { n: S.order.length })).replace(/\*(.+?)\*/g, '<b>$1</b>');
  $('p-intro-time').textContent = t('p.rule_time', { n: S.time });
  go.disabled = true; go.textContent = t('p.loading_map');
  P.scenePromise.then(function (sc) {
    go.disabled = false; go.textContent = t('p.start');
    // Široké územie (napr. Slovensko) na telefóne na výšku: mapa je malá, poradíme otočiť telefón.
    var hint = $('p-intro-landscape');
    if (hint) hint.hidden = !(window.innerHeight > window.innerWidth && sc.B.w / sc.B.h > 1.3);
  });
  go.onclick = function () { P.S.idx = 0; pSave(); pupilQuestion(); };
  pShow('p-intro');
}

/* ---------- otázky ---------- */
function pupilOverlay(v) { return P.pin ? drawDot(P.pin, v.proj, v.pal.tip, v.pal.halo, 16, 0) : ''; }
function pupilQuestion() {
  pShow('p-game');
  var S = P.S, k = S.order[S.idx], o = P.objs[k];
  $('g-name').textContent = o.name; $('g-kind').textContent = typeOne(o.type);
  $('g-i').textContent = S.idx + 1; $('g-n').textContent = S.order.length;
  P.pin = null;
  if (!P.view) {
    P.view = new MapView($('g-map'), P.scene, { overlay: pupilOverlay, onTap: function (c) {
      if (P.phase !== 'guess') return;
      P.pin = c; $('g-btn').disabled = false; $('g-msg').textContent = t('p.pin_placed'); P.view.redraw();
    } });
    mapControls($('g-mapbox'), function () { return P.view; });
  } else P.view.reset();
  if (S.res[k]) { if (S.res[k].why) pupilNext(); else pupilReveal(k); return; }
  P.phase = 'guess';
  var b = $('g-btn'); b.textContent = t('p.confirm_tip'); b.disabled = true; b.onclick = pupilConfirm;
  $('g-msg').textContent = t('p.tap_map');
  // Stránka bola počas otázky zatvorená alebo obnovená: počíta sa to ako odchod.
  if (S.deadline && S.awayAt && S.awayIdx === S.idx) { pupilCheckAway(true); return; }
  if (!S.deadline) S.deadline = Date.now() + S.time * 1000;
  S.awayAt = 0; pSave();
  clearInterval(P.tick); P.tick = setInterval(pupilTimer, 200); pupilTimer();
}
function pupilTimer() {
  var S = P.S, left = (S.deadline - Date.now()) / 1000;
  // Návrat do testu sa kontroluje aj tu: niektoré telefóny po prepnutí aplikácie nepošlú udalosť o návrate.
  if (S.awayAt && !document.hidden) { pupilCheckAway(false); if (P.phase !== 'guess') return; }
  // Systémové okno cez stránku (asistent, vyhľadávanie z obrazovky) môže zobrať stránke zameranie bez udalosti blur.
  // Len ak prehliadač zameranie vôbec hlási (inak by sa trestalo neprávom).
  if (document.hasFocus()) P.hadFocus = true;
  else if (P.hadFocus && !document.hidden && $('p-blur').hidden) pupilBlur();
  $('g-sec').textContent = t('p.seconds', { n: Math.max(0, Math.ceil(left)) });
  $('g-bar').firstElementChild.style.width = Math.max(0, left / S.time * 100) + '%';
  $('g-bar').classList.toggle('low', left <= Math.min(10, S.time / 3));
  if (left <= 0 && !S.awayAt) pupilConfirm();
}
function pupilConfirm() {
  if (P.phase !== 'guess') return;
  clearInterval(P.tick);
  var S = P.S, k = S.order[S.idx], o = P.objs[k];
  S.res[k] = P.pin ? { c: [+P.pin[0].toFixed(4), +P.pin[1].toFixed(4)], d: round1(measure(o.g, P.pin).d) } : { c: null, d: null };
  S.deadline = 0; pSave();
  pupilReveal(k);
}
// Po tipe žiak vidí len odchýlku a percentá. Správnu polohu uvidí, až keď učiteľ test uzavrie.
function pupilReveal(k) {
  P.phase = 'reveal'; clearInterval(P.tick);
  var S = P.S, r = S.res[k]; P.pin = r.c; if (P.view) P.view.redraw();
  $('g-sec').textContent = ''; $('g-bar').firstElementChild.style.width = '0%';
  var m = $('g-msg'), p = fmtPct(pctFor(r.d, S.scoring.full, S.scoring.zero));
  if (!r.c) m.innerHTML = esc(t('p.no_tip_time')) + ' <b>' + esc(fmtPct(0)) + '</b>';
  else if (r.d === 0) m.innerHTML = '<b>' + esc(t('p.exact')) + '</b> ' + esc(p);
  else m.innerHTML = esc(t('p.deviation')) + ' <b>' + esc(fmtKm(r.d)) + '</b> · ' + esc(p);
  var b = $('g-btn'); b.disabled = false; b.onclick = pupilNext;
  b.textContent = S.idx + 1 < S.order.length ? t('p.next') : t('p.submit');
}
function pupilNext() {
  var S = P.S;
  if (S.idx + 1 < S.order.length) { S.idx++; pSave(); pupilQuestion(); }
  else { S.done = true; pSave(); pupilFinish(); }
}

/* ---------- stráženie odchodu z testu ---------- */
// Odchod = skrytá karta alebo iná aplikácia na viac než 1 s, zatvorenie stránky, alebo iné okno na viac než 4 s. Stráži sa len počas otázky.
function pupilGuard() {
  document.addEventListener('visibilitychange', function () { if (document.hidden) pupilAway(); else { pupilCheckAway(false); if (P.poll) pupilPoll(); } });
  window.addEventListener('pagehide', pupilAway);
  window.addEventListener('pageshow', function () { if (!document.hidden) pupilCheckAway(false); });
  window.addEventListener('blur', pupilBlur);
  window.addEventListener('focus', function () { clearTimeout(P.blurTimer); $('p-blur').hidden = true; if (!document.hidden) pupilCheckAway(false); });
  $('p-blur').onclick = function () { window.focus(); };
}
function pupilBlur() {
  if (P.phase !== 'guess' || document.hidden) return;
  $('p-blur').hidden = false; clearTimeout(P.blurTimer);
  P.blurTimer = setTimeout(function () { if (P.phase === 'guess' && !document.hasFocus()) { $('p-blur').hidden = true; pupilLeft(); } else $('p-blur').hidden = true; }, AWAY_BLUR_MS);
}
function pupilAway() {
  var S = P.S; if (!S || P.phase !== 'guess' || S.awayAt) return;
  S.awayAt = Date.now(); S.awayIdx = S.idx; pSave();
}
function pupilCheckAway(afterReload) {
  // Mimo otázky sa odchod nevyhodnocuje (napr. hneď po obnovení stránky, kým sa test znova načíta).
  var S = P.S; if (!S || !S.awayAt || P.phase !== 'guess') return;
  var dt = Date.now() - S.awayAt, same = S.awayIdx === S.idx && !S.res[S.order[S.idx]];
  S.awayAt = 0; pSave();
  if (same && (afterReload || dt >= AWAY_HIDDEN_MS)) pupilLeft();
  else if (afterReload) { clearInterval(P.tick); P.tick = setInterval(pupilTimer, 200); pupilTimer(); }
}
function pupilLeft() {
  if (P.phase !== 'guess') return;
  var S = P.S, k = S.order[S.idx];
  clearInterval(P.tick); clearTimeout(P.blurTimer); $('p-blur').hidden = true;
  S.res[k] = { c: null, d: null, why: 'leave' }; S.leaves = (S.leaves || 0) + 1; S.deadline = 0; S.awayAt = 0; P.pin = null;
  api('pupilEvent', { t: P.t, p: S.pupilId, d: P.device, what: 'odchod z testu č. ' + S.leaves + ': ' + P.objs[k].name }).catch(function () {});
  if (S.leaves >= 2) {
    S.order.forEach(function (x) { if (!S.res[x]) S.res[x] = { c: null, d: null, why: 'ended' }; });
    S.ended = true; S.done = true; pSave(); pupilFinish(); return;
  }
  P.phase = 'left'; pSave();
  $('p-left-msg').textContent = t('p.left_msg', { obj: P.objs[k].name });
  $('p-left-go').onclick = function () { P.phase = 'reveal'; pupilNext(); };
  pShow('p-left');
}

/* ---------- koniec, odoslanie a čakanie na výsledky ---------- */
function pupilItems() {
  var S = P.S;
  return S.order.map(function (k) { var r = S.res[k] || { c: null, d: null }; return { k: k, c: r.c, d: r.d, why: r.why || '' }; });
}
function pupilFinish() {
  P.phase = 'idle'; clearInterval(P.tick);
  var S = P.S, items = pupilItems(), sum = 0;
  items.forEach(function (it) { sum += pctFor(it.why ? null : it.d, S.scoring.full, S.scoring.zero); });
  $('p-end-title').textContent = S.ended ? t('p.end_ended') : t('p.end_done', { name: firstName(S.name) });
  $('p-end-ended').hidden = !S.ended;
  $('p-end-pct').textContent = fmtPct(items.length ? sum / items.length : 0);
  pShow('p-end');
  pupilSend(0);
}
function pupilSend(attempt) {
  var S = P.S, st = $('p-end-status'), again = $('p-end-retry');
  if (S.sent) {
    st.className = 'ok'; st.textContent = t('p.sent'); again.hidden = true; $('p-end-wait').hidden = false;
    pupilPollStart(); return;
  }
  st.className = 'muted'; st.innerHTML = '<span class="spin"></span>' + esc(t('p.sending')); again.hidden = true;
  var tips = pupilItems().map(function (it) { return { k: it.k, c: it.c, why: it.why }; });
  api('pupilSubmit', { t: P.t, p: S.pupilId, d: P.device, tips: tips }).then(function (r) {
    S.sent = true; pSave();
    $('p-end-pct').textContent = fmtPct(r.pct);
    pupilSend(0);
  }).catch(function (e) {
    if (attempt < 5 && ['network', 'http', 'bad_response', 'busy', 'server'].indexOf(e.code) >= 0) {
      st.textContent = t('p.send_retry'); setTimeout(function () { pupilSend(attempt + 1); }, 1500 * (attempt + 1)); return;
    }
    st.className = 'bad'; st.textContent = t('p.send_failed', { msg: errText(e) });
    again.hidden = false; again.onclick = function () { pupilSend(0); };
  });
}
function pupilPollStart() { clearTimeout(P.poll); P.poll = setTimeout(pupilPoll, POLL_MS * (0.6 + Math.random() * 0.8)); }
function pupilPoll() {
  clearTimeout(P.poll); P.poll = null;
  if (document.hidden) { pupilPollStart(); return; }
  api('pupilState', { t: P.t }).then(function (r) {
    if (r.state === 'closed') pupilResults(); else pupilPollStart();
  }).catch(function () { pupilPollStart(); });
}

/* ---------- výsledky po uzavretí testu ---------- */
async function pupilResults() {
  clearTimeout(P.poll); P.poll = null;
  var saved = P.S || store(sessKey()) || {};
  pLoading(t('p.loading_results'));
  var R;
  try { R = await apiRetry('pupilResult', { t: P.t, p: saved.pupilId, d: P.device }, 3); }
  catch (e) { pFail(e.code === 'no_result' || e.code === 'not_logged' ? t('p.no_result') : errText(e)); return; }
  try { await P.scenePromise; } catch (e) { /* mapa bez podkladu */ }
  var order = saved.order && saved.order.length === R.keys.length ? saved.order : R.keys;
  P.R = R; P.rsel = -1;
  P.ritems = order.map(function (k) {
    var o = R.objects[k], tip = R.tips[k];
    return { k: k, name: o.name, type: o.type, g: o.g, c: tip ? [tip[1], tip[0]] : null, d: R.km[k], why: R.km[k] === null ? (R.why[k] || 'none') : '' };
  });
  $('r-title').textContent = R.name;
  $('r-sub').textContent = [R.title, R.cls].filter(Boolean).join(' · ');
  $('r-pct').textContent = fmtPct(R.pct);
  var list = $('r-list'); list.innerHTML = '';
  P.ritems.forEach(function (it, i) {
    var pc = pctFor(it.why ? null : it.d, R.scoring.full, R.scoring.zero);
    var b = el('button', { type: 'button', onclick: function () { pupilSelect(i); } }, [
      el('span', { class: 'tipnum' + (it.c ? '' : ' none'), text: String(i + 1) }),
      el('span', {}, [el('b', { text: it.name }), ' ', el('span', { class: 'small muted', text: typeOne(it.type) })]),
      el('span', { class: 'r' }, [it.why ? t('why.' + it.why) : fmtKm(it.d), el('span', { text: fmtPct(pc) })])]);
    list.appendChild(el('li', {}, [b]));
  });
  pShow('p-results');
  P.rview = new MapView(freshSvg('r-map'), P.scene, { overlay: pupilResultsOverlay });
  mapControls($('r-mapbox'), function () { return P.rview; });
  $('r-img').onclick = pupilImage;
}
function pupilResultsOverlay(v) {
  var s = '', u = v.uPx(), sel = P.rsel;
  P.ritems.forEach(function (it, i) { s += drawTarget(it.g, v.proj, v.pal, 0, i === sel); });
  P.ritems.forEach(function (it, i) {
    if (!it.c) return;
    if (it.d > 0) s += drawConn(it.c, measure(it.g, it.c).near, v.proj, v.pal, 0);
  });
  P.ritems.forEach(function (it, i) { if (i === sel || sel < 0) s += drawLabel(anchorOf(it.g), v.proj, it.name, v.pal.ok, v.pal.halo, u, i === sel ? 15 : 12, it.g.t === 'pt' ? -14 : 0, i === sel); });
  P.ritems.forEach(function (it, i) { if (it.c) s += drawNumDot(it.c, v.proj, i + 1, v.pal.tip, u, i === sel ? 28 : 22); });
  return s;
}
function pupilSelect(i) {
  P.rsel = P.rsel === i ? -1 : i;
  var btns = $('r-list').querySelectorAll('button');
  btns.forEach(function (b, j) { b.classList.toggle('sel', j === P.rsel); });
  if (P.rsel < 0) { P.rview.reset(); return; }
  var it = P.ritems[i], b = geomBBox(it.g);
  if (it.c) b = bboxUnion(b, [it.c[0], it.c[1], it.c[0], it.c[1]]);
  P.rview.zoomTo(b);
  $('r-mapbox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function pupilImage() {
  var R = P.R, st = $('r-img-status');
  st.hidden = false; st.textContent = t('common.drawing');
  try {
    var url = await sheetPng(P.scene, { title: R.title || t('app.title'), name: R.name, cls: R.cls, when: (R.sent || '').slice(0, 10), pct: R.pct, scoring: R.scoring, items: P.ritems });
    downloadUrl(url, (R.name + ' ' + (R.title || 'slepa-mapa')).replace(/[\\/:*?"<>|]/g, '_') + '.png');
    st.hidden = true;
  } catch (e) { st.textContent = errText(e); }
}

pupilStart();
