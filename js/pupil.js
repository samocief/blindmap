/* Slepá mapa: stránka žiaka. Odkaz z QR kódu má tvar test.html?s=<skript učiteľa>&t=<test> (alebo ?s=…&t=… na úvodnej adrese, tá presmeruje).
 * Test ako písomka (od 2.13): jeden celkový čas, žiak sa medzi miestami voľne presúva, tipy mení až do odovzdania a počas písania
 * nevidí odchýlky ani percentá. Čas beží na serveri od ťuknutia na Začať. Skupinu (A/B) určí tabuľka učiteľa.
 */
var P = { t: '', info: null, scene: null, scenePromise: null, objs: null, S: null, view: null, phase: 'idle', tick: null, device: '', blurTimer: null, wake: null, poll: null, wait: null,
  rview: null, R: null, rsel: -1, deadline: 0, saveTimer: null, penalty: 0.1 };
var AWAY_HIDDEN_MS = 1000, AWAY_BLUR_MS = 4000, POLL_MS = 8000, SAVE_MS = 3000, NEED_SCRIPT = '2.3';

function pShow(id) { show(id, 'p'); $('p-wrap').hidden = id === 'p-game'; }
function pFail(msg) { $('p-fail-msg').textContent = msg; pShow('p-fail'); }
function pLoading(msg) { $('p-load-msg').textContent = msg || t('common.loading'); pShow('p-load'); }
function sessKey() { return 'sm-test-' + P.t; }
function pSave() { store(sessKey(), P.S); }
function firstName(label) { var p = String(label).split(' '); return p.length > 1 ? p.slice(1).join(' ') : label; }
// Oslovenie: v zozname triedy je „Priezvisko Meno“, externý hráč píše „Meno Priezvisko“.
function greetName(S) { return S.extName ? String(S.name).split(' ')[0] : firstName(S.name); }
function pctText(p) { return t('common.pct', { v: Math.round(p * 100) }); }

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
  // Test ako písomka potrebuje v tabuľke učiteľa skript 2.3.
  if (cmpVer(info.v, NEED_SCRIPT) < 0) { pFail(t('p.old_script')); return; }
  P.info = info; P.penalty = typeof info.penalty === 'number' ? info.penalty : 0.1;
  if (info.lang && info.lang !== I18N.lang) { await loadLang(info.lang).catch(function () {}); applyI18n(); }
  document.title = (info.title ? info.title + ' · ' : '') + t('app.title');
  var map = info.map || {};
  P.scenePromise = buildScene(map.bbox || [-180, -60, 180, 85], map.base || []).then(function (sc) { P.scene = sc; return sc; });
  pupilRoute();
}
function pupilRoute() {
  var info = P.info, saved = store(sessKey());
  if (info.state === 'closed') {
    if (saved && saved.pupilId && saved.sent) pupilResults(); else if (saved && saved.pupilId && saved.done) { P.S = saved; pupilFinish(); } else pFail(t('p.closed'));
    return;
  }
  if (saved && saved.done && !saved.sent && saved.pupilId && saved.tips) { P.S = saved; pupilFinish(); return; }   // ešte sa neodoslalo
  if (info.state === 'ready') { pupilWait(); return; }
  // Aj po odovzdaní sa prihlási znova: ak učiteľ povolil nový pokus, začne odznova, inak ostane na obrazovke odovzdaného testu.
  if (saved && saved.pupilId && saved.tips) pupilLogin(saved.pupilId, saved, saved.extName); else pupilNames();
}

/* ---------- čakanie, kým učiteľ alebo dozor test spustí ---------- */
function pupilWait() {
  var info = P.info;
  $('p-wait-sub').textContent = [info.open ? '' : t('p.class', { cls: info.cls }), info.title].filter(Boolean).join(' · ');
  pShow('p-wait');
  clearTimeout(P.wait);
  var tick = function () {
    api('pupilState', { t: P.t }).then(function (r) {
      if (r.state === 'ready') { P.wait = setTimeout(tick, 4000 + Math.random() * 3000); return; }
      // test sa začal (alebo už skončil): načíta sa znova, zoznam mien mohol medzitým pribudnúť
      return apiRetry('pupilInit', { t: P.t }, 3).then(function (info2) { P.info = info2; pupilRoute(); });
    }).catch(function () { P.wait = setTimeout(tick, 6000); });
  };
  P.wait = setTimeout(tick, 2500 + Math.random() * 2500);
}

/* ---------- výber mena ---------- */
// Trieda: žiak ťukne na svoje meno (na konci je Učiteľ). Externý test: hráč si napíše meno sám.
function pupilNames(err) {
  var info = P.info, box = $('p-names'), form = $('p-ext');
  $('p-pick-title').textContent = t(info.open ? 'p.open_title' : 'p.who');
  $('p-pick-cls').textContent = [info.open ? '' : t('p.class', { cls: info.cls }), info.title].filter(Boolean).join(' · ');
  box.innerHTML = ''; box.hidden = !!info.open; form.hidden = !info.open;
  if (info.open) {
    form.onsubmit = function (e) {
      e.preventDefault();
      var n = $('p-ext-name').value.replace(/\s+/g, ' ').trim();
      if (!n) { pupilNames(t('err.bad_name')); return; }
      pupilPick({ id: '', label: n, ext: true });
    };
  } else {
    var nameBtn = function (n) {
      var label = n.teacher ? t('p.teacher') : n.label;
      return el('button', { type: 'button', class: 'namebtn' + (n.teacher ? ' teacher' : ''), text: label + (n.done ? ' ✓' : ''), disabled: n.done, title: n.done ? t('p.already_done') : null, onclick: function () { pupilPick({ id: n.id, label: label }); } });
    };
    var kids = info.names.filter(function (n) { return !n.teacher; }), adults = info.names.filter(function (n) { return n.teacher; });
    kids.forEach(function (n) { box.appendChild(nameBtn(n)); });
    if (!kids.length) box.appendChild(el('p', { class: 'muted', text: t('p.no_names') }));
    if (adults.length) { box.appendChild(el('div', { class: 'sep' })); adults.forEach(function (n) { box.appendChild(nameBtn(n)); }); }
  }
  $('p-pick-err').textContent = err || ''; $('p-pick-err').hidden = !err;
  pShow('p-pick');
}
function pupilPick(n) {
  $('p-confirm-name').textContent = n.label;
  $('p-confirm-go').onclick = function () { pupilLogin(n.id, null, n.ext ? n.label : ''); };
  $('p-confirm-back').onclick = function () { pupilNames(); };
  pShow('p-confirm');
}
async function pupilLogin(pupilId, saved, extName) {
  pLoading();
  var r;
  try { r = await apiRetry('pupilLogin', { t: P.t, p: pupilId, n: extName || '', d: P.device }, 3); }
  catch (e) {
    if (e.code === 'done' && saved && saved.sent) { P.S = saved; pupilFinish(); return; }
    if (saved) store(sessKey(), null);
    if (e.code === 'not_started') { pupilWait(); return; }
    if (e.code === 'closed') { pFail(t('p.closed')); return; }
    if (e.code === 'done' && saved) { pFail(t('err.done')); return; }
    if (['taken', 'done', 'not_in_class', 'name_taken', 'bad_name'].indexOf(e.code) >= 0) { pupilNames(errText(e)); return; }
    pFail(errText(e)); return;
  }
  P.objs = r.objects;
  if (typeof r.penalty === 'number') P.penalty = r.penalty;
  var pid = r.pid || pupilId, keys = r.keys;
  var same = saved && !saved.done && saved.pupilId === pid && saved.order && saved.order.length === keys.length && saved.order.every(function (k) { return keys.indexOf(k) >= 0; });
  var S = P.S = same ? saved : { pupilId: pid, extName: extName || '', order: shuffle(keys), tips: {}, marks: {}, idx: 0, begun: false, leaves: 0, awayAt: 0, done: false, sent: false, ended: false, why: '' };
  S.name = r.name; S.group = r.group || ''; S.total = r.total; S.scoring = r.scoring;
  // Tipy uložené na serveri (písal na inom zariadení a učiteľ ho odomkol) doplnia tie, ktoré tu nie sú.
  if (r.tips) Object.keys(r.tips).forEach(function (k) { if (!S.tips[k] && keys.indexOf(k) >= 0) S.tips[k] = r.tips[k]; });
  (r.marks || []).forEach(function (k) { if (keys.indexOf(k) >= 0 && S.marks[k] === undefined) S.marks[k] = 1; });
  S.leaves = Math.max(S.leaves || 0, r.leaves || 0);
  if (r.begun) { S.begun = true; P.deadline = Date.now() + r.left; } else S.begun = false;
  pSave();
  if (S.done) { pupilFinish(); return; }
  if (S.begun) {
    if (S.leaves >= 2) { S.ended = true; S.done = true; S.why = 'ended'; pSave(); pupilFinish(); return; }
    pLoading(t('p.loading_map')); await P.scenePromise; pupilGame(true); return;
  }
  pupilIntro();
}
function pupilIntro() {
  var S = P.S, go = $('p-intro-go');
  $('p-intro-hello').textContent = t('p.hello', { name: greetName(S) });
  $('p-intro-group').textContent = S.group ? t('p.group', { g: S.group }) : ''; $('p-intro-group').hidden = !S.group;
  $('p-intro-n').innerHTML = esc(t('p.intro_n', { n: S.order.length, min: S.total })).replace(/\*(.+?)\*/g, '<b>$1</b>');
  $('p-intro-leave').textContent = t('p.rule_leave', { pct: Math.round(P.penalty * 100) });
  $('p-intro-err').hidden = true;
  go.disabled = true; go.textContent = t('p.loading_map');
  P.scenePromise.then(function (sc) {
    go.disabled = false; go.textContent = t('p.start');
    // Široké územie (napr. Slovensko) na telefóne na výšku: mapa je malá, poradíme otočiť telefón.
    var hint = $('p-intro-landscape');
    if (hint) hint.hidden = !(window.innerHeight > window.innerWidth && sc.B.w / sc.B.h > 1.3);
  });
  $('p-intro-wake').textContent = t('wakeLock' in navigator ? 'p.rule_lock' : 'p.rule_lock_old');
  go.onclick = async function () {
    go.disabled = true; go.textContent = t('common.loading');
    var r;
    try { r = await apiRetry('pupilBegin', { t: P.t, p: S.pupilId, d: P.device }, 3); }
    catch (e) { go.disabled = false; go.textContent = t('p.start'); $('p-intro-err').textContent = errText(e); $('p-intro-err').hidden = false; return; }
    S.begun = true; S.leaves = Math.max(S.leaves || 0, r.leaves || 0); P.deadline = Date.now() + r.left; S.idx = 0; pSave();
    pupilGame(false);
  };
  pShow('p-intro');
}

/* ---------- písanie testu ---------- */
function curKey() { return P.S.order[P.S.idx]; }
function pupilOverlay(v) { var c = P.S && P.S.tips[curKey()]; return c ? drawDot(c, v.proj, v.pal.tip, v.pal.halo, 16, 0) : ''; }
function pupilGame(afterReload) {
  pShow('p-game');
  P.phase = 'test';
  if (!P.view) {
    P.view = new MapView($('g-map'), P.scene, { overlay: pupilOverlay, onTap: pupilTap });
    mapControls($('g-mapbox'), function () { return P.view; });
  }
  pupilQuestion();
  clearInterval(P.tick); P.tick = setInterval(pupilTimer, 250);
  pupilWake();
  // Stránka bola počas písania zatvorená alebo obnovená: počíta sa to ako odchod.
  if (afterReload && P.S.awayAt) pupilCheckAway(true);
  if (P.phase === 'test') pupilTimer();
}
function pupilQuestion(keepView) {
  var S = P.S, k = curKey(), o = P.objs[k], last = S.idx + 1 >= S.order.length;
  taskHead($('g-name'), o);
  $('g-i').textContent = S.idx + 1; $('g-n').textContent = S.order.length;
  $('g-msg').textContent = S.tips[k] ? t('p.tip_saved') : t('p.tap_map');
  var fl = $('g-flag'); fl.classList.toggle('on', !!S.marks[k]); fl.setAttribute('aria-pressed', S.marks[k] ? 'true' : 'false');
  $('g-prev').disabled = S.idx === 0;
  $('g-btn').textContent = last ? t('p.submit') : t('p.next_short') + ' ›';
  $('g-btn').classList.toggle('primary', !last || pupilAnswered() === S.order.length);
  if (!keepView) P.view.reset(); else P.view.redraw();
  pupilNav(); pupilMeters();
}
// Mriežka čísel: s tipom (plné), bez tipu (prázdne), práve otvorené (rámik), označené na návrat (vlajka).
function pupilNav() {
  var S = P.S, box = $('g-nav'); box.innerHTML = '';
  S.order.forEach(function (k, i) {
    var has = !!S.tips[k], mk = !!S.marks[k];
    var b = el('button', { type: 'button', class: 'qn' + (has ? ' has' : '') + (mk ? ' mk' : '') + (i === S.idx ? ' cur' : ''), text: String(i + 1),
      'aria-label': t('p.nav_item', { n: i + 1 }) + ', ' + t(has ? 'p.nav_has' : 'p.nav_none') + (mk ? ', ' + t('p.nav_marked') : ''), 'aria-current': i === S.idx ? 'true' : null,
      onclick: function () { pupilGo(i); } });
    box.appendChild(b);
  });
  var cur = box.children[S.idx];
  if (cur) { var l = cur.offsetLeft - box.clientWidth / 2 + cur.offsetWidth / 2; box.scrollLeft = Math.max(0, l); }
}
function pupilGo(i) { var S = P.S; if (i < 0 || i >= S.order.length) return; S.idx = i; pSave(); pupilQuestion(); }
function pupilAnswered() { var S = P.S; return S.order.filter(function (k) { return S.tips[k]; }).length; }
function pupilTap(c) {
  if (P.phase !== 'test' || $('p-game').hidden) return;
  var S = P.S, k = curKey();
  S.tips[k] = [+c[0].toFixed(4), +c[1].toFixed(4)]; pSave();
  P.view.redraw();
  $('g-msg').textContent = t('p.tip_saved');
  if (S.idx + 1 >= S.order.length) $('g-btn').classList.toggle('primary', pupilAnswered() === S.order.length);
  pupilNav(); pupilMeters(); pupilQueueSave();
}
function pupilFlag() {
  var S = P.S, k = curKey();
  if (S.marks[k]) delete S.marks[k]; else S.marks[k] = 1;
  pSave(); pupilQuestion(true); pupilQueueSave();
}
// Dve časomiery: zostávajúci čas a zostávajúce miesta. Obe ubúdajú; keď je pás miest kratší než pás času, žiak stíha.
function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
function pupilMeters() {
  var S = P.S, total = (S.total || 1) * 60, left = Math.max(0, (P.deadline - Date.now()) / 1000), n = S.order.length, done = pupilAnswered();
  $('m-time-v').textContent = fmtClock(left);
  $('m-time').querySelector('.bar > i').style.width = Math.min(100, left / total * 100) + '%';
  $('m-tips-v').textContent = done + '/' + n;
  $('m-tips').querySelector('.bar > i').style.width = (n ? (n - done) / n * 100 : 0) + '%';
  $('s-time') && ($('s-time').textContent = fmtClock(left));
}
function pupilTimer() {
  if (P.phase !== 'test') return;
  var S = P.S;
  // Návrat do testu sa kontroluje aj tu: niektoré telefóny po prepnutí aplikácie nepošlú udalosť o návrate.
  if (S.awayAt && !document.hidden) { pupilCheckAway(false); if (P.phase !== 'test') return; }
  // Systémové okno cez stránku (asistent, vyhľadávanie z obrazovky) môže zobrať stránke zameranie bez udalosti blur.
  // Len ak prehliadač zameranie vôbec hlási (inak by sa trestalo neprávom).
  if (document.hasFocus()) P.hadFocus = true;
  else if (P.hadFocus && !document.hidden && $('p-blur').hidden) pupilBlur();
  pupilMeters();
  if (P.deadline - Date.now() <= 0 && !S.awayAt) { S.done = true; S.why = 'time'; pSave(); pupilFinish(); }
}
// Priebežné ukladanie na server: pri výmene zariadenia sa tipy nestratia a učiteľ vidí, koľko má žiak hotovo.
function pupilQueueSave() { clearTimeout(P.saveTimer); P.saveTimer = setTimeout(pupilSaveNow, SAVE_MS); }
function pupilSaveNow() {
  clearTimeout(P.saveTimer); P.saveTimer = null;
  var S = P.S; if (!S || S.done) return;
  api('pupilSave', { t: P.t, p: S.pupilId, d: P.device, tips: S.tips, mk: Object.keys(S.marks) }).catch(function () {});
}
// Pred odovzdaním: koľko miest je bez tipu a ktoré sú označené. Čas medzitým beží ďalej.
function pupilAskSubmit() {
  var S = P.S, miss = [], marked = [];
  S.order.forEach(function (k, i) { if (!S.tips[k]) miss.push(i); if (S.marks[k]) marked.push(i); });
  $('s-sum').textContent = t('p.sum_done', { done: S.order.length - miss.length, n: S.order.length });
  var list = function (box, idx) {
    box.innerHTML = '';
    idx.forEach(function (i) { box.appendChild(el('button', { type: 'button', class: 'qn' + (S.tips[S.order[i]] ? ' has' : '') + (S.marks[S.order[i]] ? ' mk' : ''), text: String(i + 1), onclick: function () { pShow('p-game'); pupilGo(i); } })); });
  };
  list($('s-miss'), miss); $('s-miss-row').hidden = !miss.length;
  list($('s-marked'), marked); $('s-marked-row').hidden = !marked.length;
  $('s-go').onclick = function () { S.done = true; S.why = ''; pSave(); pupilFinish(); };
  $('s-back').onclick = function () { pShow('p-game'); pupilQuestion(true); };
  pShow('p-submit');
  pupilMeters();
}

/* ---------- stráženie odchodu z testu ---------- */
// Odchod = skrytá karta alebo iná aplikácia na viac než 1 s, zatvorenie stránky, alebo iné okno na viac než 4 s. Stráži sa celý čas písania.
function pupilGuard() {
  document.addEventListener('visibilitychange', function () { if (document.hidden) pupilAway(); else { pupilCheckAway(false); pupilWake(); if (P.poll) pupilPoll(); } });
  window.addEventListener('pagehide', pupilAway);
  window.addEventListener('pageshow', function () { if (!document.hidden) pupilCheckAway(false); });
  window.addEventListener('blur', pupilBlur);
  window.addEventListener('focus', function () { clearTimeout(P.blurTimer); $('p-blur').hidden = true; if (!document.hidden) pupilCheckAway(false); });
  $('p-blur').onclick = function () { window.focus(); };
}
// Obrazovka počas písania nezhasne sama (zhasnutie zo šetrenia batérie by sa rátalo ako odchod).
// Zámok obrazovky prehliadač po skrytí stránky uvoľní, preto sa po návrate žiada znova.
function pupilWake() {
  if (P.phase !== 'test' || document.hidden || !('wakeLock' in navigator) || (P.wake && !P.wake.released)) return;
  navigator.wakeLock.request('screen').then(function (w) {
    if (P.phase !== 'test') { w.release().catch(function () {}); return; }
    P.wake = w;
  }).catch(function () {});
}
function pupilWakeOff() { if (P.wake) { P.wake.release().catch(function () {}); P.wake = null; } }
function pupilBlur() {
  if (P.phase !== 'test' || document.hidden) return;
  $('p-blur').hidden = false; clearTimeout(P.blurTimer);
  P.blurTimer = setTimeout(function () { if (P.phase === 'test' && !document.hasFocus()) { $('p-blur').hidden = true; pupilLeft(); } else $('p-blur').hidden = true; }, AWAY_BLUR_MS);
}
function pupilAway() {
  var S = P.S; if (!S || P.phase !== 'test' || S.awayAt) return;
  S.awayAt = Date.now(); pSave();
  if (P.saveTimer) pupilSaveNow();
}
function pupilCheckAway(afterReload) {
  var S = P.S; if (!S || !S.awayAt || P.phase !== 'test') return;
  var dt = Date.now() - S.awayAt;
  S.awayAt = 0; pSave();
  if (afterReload || dt >= AWAY_HIDDEN_MS) pupilLeft();
}
// Prvý odchod: varovanie a strhnutie z celkového výsledku (počíta skript tabuľky). Druhý: test sa ukončí a odovzdá.
function pupilLeft() {
  if (P.phase !== 'test') return;
  var S = P.S;
  clearTimeout(P.blurTimer); $('p-blur').hidden = true;
  S.leaves = (S.leaves || 0) + 1; S.awayAt = 0; pSave();
  api('pupilEvent', { t: P.t, p: S.pupilId, d: P.device, leave: S.leaves, what: 'odchod z testu č. ' + S.leaves }).catch(function () {});
  if (S.leaves >= 2) { S.ended = true; S.done = true; S.why = 'ended'; pSave(); pupilFinish(); return; }
  $('p-left-msg').textContent = t('p.left_msg', { pct: Math.round(P.penalty * 100) });
  $('p-left-go').onclick = function () { pShow('p-game'); pupilQuestion(true); };
  pShow('p-left');
}

/* ---------- odovzdanie a čakanie na výsledky ---------- */
function pupilFinish() {
  P.phase = 'idle'; pupilWakeOff(); clearInterval(P.tick); clearTimeout(P.saveTimer); clearTimeout(P.blurTimer); $('p-blur').hidden = true;
  var S = P.S;
  $('p-end-title').textContent = S.why === 'time' ? t('p.end_time') : S.ended ? t('p.end_ended') : t('p.end_done', { name: greetName(S) });
  $('p-end-ended').hidden = !S.ended;
  $('p-end-time').hidden = S.why !== 'time';
  $('p-end-n').textContent = t('p.end_n', { done: S.order.filter(function (k) { return S.tips[k]; }).length, n: S.order.length });
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
  api('pupilSubmit', { t: P.t, p: S.pupilId, d: P.device, tips: S.tips, leaves: S.leaves || 0, ended: !!S.ended }).then(function () {
    S.sent = true; pSave();
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
  var order = saved.order && saved.order.length === R.keys.length && saved.order.every(function (k) { return R.keys.indexOf(k) >= 0; }) ? saved.order : R.keys;
  P.R = R; P.rsel = -1;
  P.ritems = order.map(function (k) {
    var o = R.objects[k], tip = R.tips[k];
    return { k: k, name: o.name, type: o.type, g: o.g, c: tip ? [tip[1], tip[0]] : null, d: R.km[k], why: R.km[k] === null ? (R.why[k] || 'none') : '' };
  });
  $('r-title').textContent = R.name;
  $('r-sub').textContent = [R.title, R.cls, R.group ? t('p.group', { g: R.group }) : ''].filter(Boolean).join(' · ');
  $('r-pct').textContent = fmtPct(R.pct);
  $('r-penalty').textContent = R.leaves > 0 ? t('p.res_penalty', { pct: Math.round((R.penalty || P.penalty) * 100) }) : '';
  $('r-penalty').hidden = !(R.leaves > 0);
  var list = $('r-list'); list.innerHTML = '';
  P.ritems.forEach(function (it, i) {
    var pc = pctFor(it.why ? null : it.d, R.scoring.full, R.scoring.zero);
    var b = el('button', { type: 'button', onclick: function () { pupilSelect(i); } }, [
      el('span', { class: 'tipnum' + (it.c ? '' : ' none'), text: String(i + 1) }),
      nameWithIcon(it.type, it.name),
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
  P.ritems.forEach(function (it) {
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

/* ---------- tlačidlá ---------- */
(function () {
  $('g-prev').onclick = function () { pupilGo(P.S.idx - 1); };
  $('g-btn').onclick = function () { var S = P.S; if (S.idx + 1 < S.order.length) pupilGo(S.idx + 1); else pupilAskSubmit(); };
  $('g-flag').onclick = pupilFlag;
  $('g-submit').onclick = pupilAskSubmit;
})();
pupilStart();
