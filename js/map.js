/* Slepá mapa: zobrazenie mapy (projekcia, podkladové vrstvy, rastre, posun a priblíženie, obrázok s tipmi). */

/* ---------- farby ---------- */
var PAL_LIGHT = { sea: '#dbe4e5', land: '#f5f7ea', landO: '#e6ebe2', border: '#3f5148', coast: '#8a9a93', water: '#4f8fb5', adm: '#8f9c95', city: '#5a5148', custom: '#8b5a2b', tip: '#b3206b', ok: '#0d7a5f', ink: '#18262a', halo: '#ffffff', muted: '#56666a' };
function cssPal() {
  var cs = getComputedStyle(document.documentElement), L = PAL_LIGHT;
  var g = function (n, d) { var v = cs.getPropertyValue(n).trim(); return v || d; };
  return { sea: g('--map-bg', L.sea), land: g('--land', L.land), landO: g('--land-o', L.landO), border: g('--border', L.border), coast: g('--nb', L.coast), water: g('--water', L.water),
    adm: g('--adm', L.adm), city: g('--city', L.city), custom: g('--custom', L.custom), tip: g('--tip', L.tip), ok: g('--ok', L.ok), ink: g('--ink', L.ink), halo: g('--panel', L.halo), muted: g('--muted', L.muted) };
}

/* ---------- projekcia ---------- */
// Malé územie (napr. Slovensko): valcová so stredovou rovnobežkou, raster v WGS 84 sedí bez prepočtu.
// Svetadiel: azimutálna rovnakoplochá (LAEA). Celý svet: Equal Earth. Výstup je v km, os Y smeruje nadol.
function projKind(bbox) { return (bbox[2] - bbox[0]) > 200 ? 'eqearth' : bboxSpan(bbox) <= 25 ? 'eqc' : 'laea'; }
function makeProj(bbox, kind) {
  var lon0 = (bbox[0] + bbox[2]) / 2, lat0 = (bbox[1] + bbox[3]) / 2;
  kind = kind || projKind(bbox);
  var f0 = lat0 * RAD, s0 = Math.sin(f0), c0 = Math.cos(f0);
  if (kind === 'eqc') {
    return { kind: kind,
      fwd: function (c) { return [wrapLon(c[0] - lon0) * c0 * KM_DEG, -(c[1] - lat0) * KM_DEG]; },
      inv: function (p) { return [lon0 + p[0] / (c0 * KM_DEG), lat0 - p[1] / KM_DEG]; } };
  }
  if (kind === 'eqearth') {
    var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    if ((bbox[2] - bbox[0]) > 350) lon0 = 0;
    return { kind: kind,
      fwd: function (c) {
        var l = wrapLon(c[0] - lon0) * RAD, th = Math.asin(M * Math.sin(c[1] * RAD)), t2 = th * th, t6 = t2 * t2 * t2;
        return [R_EARTH * l * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -R_EARTH * th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
      },
      inv: function (p) {
        var x = p[0] / R_EARTH, y = -p[1] / R_EARTH, th = y, i, t2, t6;
        for (i = 0; i < 12; i++) {
          t2 = th * th; t6 = t2 * t2 * t2;
          var fy = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y, dy = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
          var dt = fy / dy; th -= dt; if (Math.abs(dt) < 1e-9) break;
        }
        t2 = th * th; t6 = t2 * t2 * t2;
        var l = M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)) / Math.cos(th);
        return [lon0 + l / RAD, Math.asin(Math.max(-1, Math.min(1, Math.sin(th) / M))) / RAD];
      } };
  }
  return { kind: 'laea',
    fwd: function (c) {
      var l = wrapLon(c[0] - lon0) * RAD, f = c[1] * RAD, sf = Math.sin(f), cf = Math.cos(f), cl = Math.cos(l);
      var k = Math.sqrt(2 / Math.max(1e-9, 1 + s0 * sf + c0 * cf * cl));
      return [R_EARTH * k * cf * Math.sin(l), -R_EARTH * k * (c0 * sf - s0 * cf * cl)];
    },
    inv: function (p) {
      var x = p[0] / R_EARTH, y = -p[1] / R_EARTH, rho = Math.sqrt(x * x + y * y);
      if (rho < 1e-12) return [lon0, lat0];
      if (rho > 2) return [NaN, NaN];
      var c = 2 * Math.asin(Math.min(1, rho / 2)), sc = Math.sin(c), cc = Math.cos(c);
      return [lon0 + Math.atan2(x * sc, rho * c0 * cc - y * s0 * sc) / RAD, Math.asin(Math.max(-1, Math.min(1, cc * s0 + y * sc * c0 / rho))) / RAD];
    } };
}
// Obdĺžnik v rovine mapy, ktorý pokryje zemepisný rozsah bbox.
function projBounds(proj, bbox) {
  var a = Infinity, b = Infinity, c = -Infinity, d = -Infinity, i, n = 24;
  function add(lon, lat) { var p = proj.fwd([lon, lat]); a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }
  var w = bbox[0], s = bbox[1], e = bbox[2], tp = bbox[3];
  if (e - w > 359.9) { w += 0.01; e -= 0.01; }
  for (i = 0; i <= n; i++) { var u = i / n; add(w + (e - w) * u, s); add(w + (e - w) * u, tp); add(w, s + (tp - s) * u); add(e, s + (tp - s) * u); }
  return { x: a, y: b, w: c - a, h: d - b };
}
function pathOf(proj, pts, close) {
  var s = '', i, p;
  for (i = 0; i < pts.length; i++) { p = proj.fwd(pts[i]); s += (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
  return s + (close ? 'Z' : '');
}
function polysPath(proj, polys) { var s = '', i, j; for (i = 0; i < polys.length; i++) for (j = 0; j < polys[i].length; j++) s += pathOf(proj, polys[i][j], true); return s; }
function linesPath(proj, lines) { var s = '', i; for (i = 0; i < lines.length; i++) s += pathOf(proj, lines[i], false); return s; }
function dotsPath(proj, pts) { var s = '', i, p; for (i = 0; i < pts.length; i++) { p = proj.fwd(pts[i]); s += 'M' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + 'h0'; } return s; }
// Šírka čiary: v živej mape v pixeloch (nemení sa pri priblížení), v obrázku prepočítaná na km cez u.
function SW(px, u) { return u ? 'stroke-width="' + (px * u).toFixed(3) + '"' : 'stroke-width="' + px + '" vector-effect="non-scaling-stroke"'; }

/* ---------- scéna: podkladové vrstvy pripravené pre jednu mapu ---------- */
// refs = [{file, style}]; style je land | surroundings | borders | countries | water | dots | auto | raster.
var STYLE_RANK = { raster: 0, surroundings: 1, land: 2, auto: 3, countries: 4, borders: 5, water: 6, dots: 7 };
function buildScene(bbox, refs) {
  var proj = makeProj(bbox), view = bboxPad(bbox, 0.35), tol = bboxSpan(bbox) / 2500, dec = decFor(tol);
  return Promise.all((refs || []).map(function (ref) {
    var p = ref.style === 'raster' ? rasterLayer(ref, proj, view) : vectorLayer(ref, view, tol, dec);
    return p.catch(function (e) { return { kind: 'error', file: ref.file, error: e }; });
  })).then(function (layers) {
    var errors = layers.filter(function (l) { return l && l.kind === 'error'; });
    layers = layers.filter(function (l) { return l && l.kind !== 'error'; }).map(function (l, i) { l.order = i; return l; });
    var rank = function (st) { return st in STYLE_RANK ? STYLE_RANK[st] : 3; };
    layers.sort(function (a, b) { return rank(a.style) - rank(b.style) || a.order - b.order; });
    return { bbox: bbox, proj: proj, B: projBounds(proj, bbox), diag: bboxDiag(bbox), layers: layers, errors: errors, hasRaster: layers.some(function (l) { return l.kind === 'raster'; }) };
  });
}
function vectorLayer(ref, view, tol, dec) {
  return Data.vector(ref.file).then(function (feats) {
    var L = { kind: 'vec', style: ref.style || 'auto', polys: [], lines: [], pts: [] };
    feats.forEach(function (f) {
      if (!bboxHit(f.bbox, view)) return;
      var g = f.g;
      if (g.t === 'pt') L.pts.push(g.c);
      else if (g.t === 'line') g.c.forEach(function (l) { if (bboxHit(pathBBox(l), view)) { var s = simpLine(l, tol, dec); if (s.length > 1) L.lines.push(s); } });
      else g.c.forEach(function (poly) { if (bboxHit(pathBBox(poly[0]), view)) { var s = simpPoly(poly, tol, dec); if (s) L.polys.push(s); } });
    });
    return L;
  });
}
function rasterLayer(ref, proj, view) {
  return Data.raster(ref.file).then(function (r) {
    var b = r.bounds;
    if (proj.kind === 'eqc') {
      var p1 = proj.fwd([b[0], b[3]]), p2 = proj.fwd([b[2], b[1]]);
      return { kind: 'raster', style: 'raster', img: r.img, href: r.img.src, x: p1[0], y: p1[1], w: p2[0] - p1[0], h: p2[1] - p1[1] };
    }
    return reprojectRaster(r, proj, view);
  });
}
// Raster v WGS 84 prepočítaný do projekcie mapy (pixel po pixeli, raz pri načítaní).
function reprojectRaster(r, proj, view) {
  var b = r.bounds, clip = [Math.max(b[0], view[0]), Math.max(b[1], view[1]), Math.min(b[2], view[2]), Math.min(b[3], view[3])];
  if (clip[0] >= clip[2] || clip[1] >= clip[3]) return Promise.resolve(null);
  var R = projBounds(proj, clip), srcW = r.img.naturalWidth, srcH = r.img.naturalHeight;
  var W = Math.round(Math.min(2048, Math.max(400, srcW * (clip[2] - clip[0]) / (b[2] - b[0]) * 1.2))), H = Math.round(W * R.h / R.w);
  if (H > 2048) { W = Math.round(W * 2048 / H); H = 2048; }
  var sc = document.createElement('canvas'); sc.width = srcW; sc.height = srcH;
  var sctx = sc.getContext('2d'); sctx.drawImage(r.img, 0, 0);
  var src = sctx.getImageData(0, 0, srcW, srcH).data;
  var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  var octx = oc.getContext('2d'), out = octx.createImageData(W, H), od = out.data;
  var kx = srcW / (b[2] - b[0]), ky = srcH / (b[3] - b[1]), i, j, ll, sx, sy, si, oi;
  for (j = 0; j < H; j++) {
    var y = R.y + (j + 0.5) * R.h / H;
    for (i = 0; i < W; i++) {
      ll = proj.inv([R.x + (i + 0.5) * R.w / W, y]);
      sx = (ll[0] - b[0]) * kx; sy = (b[3] - ll[1]) * ky;
      if (!(sx >= 0 && sy >= 0 && sx < srcW && sy < srcH)) continue;
      si = ((sy | 0) * srcW + (sx | 0)) * 4; oi = (j * W + i) * 4;
      od[oi] = src[si]; od[oi + 1] = src[si + 1]; od[oi + 2] = src[si + 2]; od[oi + 3] = src[si + 3];
    }
  }
  octx.putImageData(out, 0, 0);
  return new Promise(function (res) {
    var done = function (href) { res({ kind: 'raster', style: 'raster', canvas: oc, href: href, x: R.x, y: R.y, w: R.w, h: R.h }); };
    if (oc.toBlob) oc.toBlob(function (blob) { done(blob ? URL.createObjectURL(blob) : oc.toDataURL('image/png')); }, 'image/png');
    else done(oc.toDataURL('image/png'));
  });
}
function drawScene(scene, pal, u, noRaster) {
  var s = '', proj = scene.proj, hasR = scene.hasRaster;
  scene.layers.forEach(function (L) {
    if (L.kind === 'raster') { if (!noRaster) s += '<image href="' + esc(L.href) + '" x="' + L.x + '" y="' + L.y + '" width="' + L.w + '" height="' + L.h + '" preserveAspectRatio="none"/>'; return; }
    var P = L.polys.length ? polysPath(proj, L.polys) : '', Ln = L.lines.length ? linesPath(proj, L.lines) : '', D = L.pts.length ? dotsPath(proj, L.pts) : '';
    var path = function (d, attrs) { return d ? '<path d="' + d + '" fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="round" ' + attrs + '/>' : ''; };
    switch (L.style) {
      case 'land':
        s += path(P, 'fill="' + (hasR ? 'none' : pal.land) + '" stroke="' + pal.border + '" ' + SW(1.6, u)) + path(Ln, 'fill="none" stroke="' + pal.border + '" ' + SW(1.6, u)); break;
      case 'surroundings':
        s += path(P, 'fill="' + pal.landO + '"' + (hasR ? ' fill-opacity="0.55"' : '') + ' stroke="' + pal.coast + '" ' + SW(1, u)) + path(Ln, 'fill="none" stroke="' + pal.coast + '" ' + SW(1, u)); break;
      case 'borders':
        s += path(P, 'fill="none" stroke="' + pal.adm + '" ' + SW(0.9, u)) + path(Ln, 'fill="none" stroke="' + pal.adm + '" ' + SW(0.9, u)); break;
      case 'countries':
        s += path(P, 'fill="none" stroke="' + pal.border + '" ' + SW(1, u)) + path(Ln, 'fill="none" stroke="' + pal.border + '" ' + SW(1, u)); break;
      case 'water':
        s += path(P, 'fill="' + pal.water + '" fill-opacity="0.55" stroke="none"') + path(Ln, 'fill="none" stroke="' + pal.water + '" ' + SW(1.3, u)); break;
      default:
        s += path(P, 'fill="' + pal.custom + '" fill-opacity="0.08" stroke="' + pal.custom + '" ' + SW(1, u)) + path(Ln, 'fill="none" stroke="' + pal.custom + '" ' + SW(1.2, u));
    }
    if (D) s += path(D, 'fill="none" stroke="' + (L.style === 'water' ? pal.water : L.style === 'dots' ? pal.city : pal.custom) + '" ' + SW(5, u));
  });
  return s;
}

/* ---------- prekrytie: správne polohy, tipy, čiary odchýlok ---------- */
function drawTarget(g, proj, pal, u, strong) {
  if (g.t === 'area') return '<path d="' + polysPath(proj, g.c) + '" fill-rule="evenodd" fill="' + pal.ok + '" fill-opacity="' + (strong ? 0.45 : 0.3) + '" stroke="' + pal.ok + '" ' + SW(strong ? 2.5 : 1.8, u) + ' stroke-linejoin="round"/>';
  if (g.t === 'line') return '<path d="' + linesPath(proj, g.c) + '" fill="none" stroke="' + pal.ok + '" ' + SW(strong ? 5 : 4, u) + ' stroke-linecap="round" stroke-linejoin="round"/>';
  return drawDot(g.c, proj, pal.ok, pal.halo, strong ? 18 : 15, u);
}
function drawDot(c, proj, color, halo, px, u) {
  var d = dotsPath(proj, [c]);
  return '<path d="' + d + '" fill="none" stroke="' + halo + '" ' + SW(px + 4, u) + ' stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + color + '" ' + SW(px, u) + ' stroke-linecap="round"/>';
}
function drawConn(a, b, proj, pal, u) {
  var p = proj.fwd(a), q = proj.fwd(b), k = u || 1;
  return '<path d="M' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + 'L' + q[0].toFixed(2) + ' ' + q[1].toFixed(2) + '" fill="none" stroke="' + pal.ink + '" ' + SW(1.5, u) + (u ? ' stroke-dasharray="' + (5 * k) + ' ' + (4 * k) + '"' : ' stroke-dasharray="5 4"') + '/>';
}
// Text s pevnou veľkosťou v pixeloch; uPx = koľko km pripadá na pixel v aktuálnom pohľade.
function drawLabel(c, proj, text, color, halo, uPx, px, dy, bold) {
  var p = proj.fwd(c);
  return '<text x="' + p[0].toFixed(2) + '" y="' + (p[1] + (dy || 0) * uPx).toFixed(2) + '" font-size="' + (px * uPx).toFixed(3) + '" text-anchor="middle" font-family="Atkinson Hyperlegible Next,system-ui,sans-serif"' +
    (bold ? ' font-weight="800"' : '') + ' fill="' + color + '"' + (halo ? ' stroke="' + halo + '" stroke-width="' + (3 * uPx).toFixed(3) + '" paint-order="stroke"' : '') + '>' + esc(text) + '</text>';
}
// Očíslovaný tip v živej mape (čiary v pixeloch, číslo podľa uPx).
function drawNumDot(c, proj, n, color, uPx, sizePx) {
  sizePx = sizePx || 24;
  return drawDot(c, proj, color, '#ffffff', sizePx, 0) + drawLabel(c, proj, String(n), '#ffffff', null, uPx, sizePx * 0.62, sizePx * 0.22, true);
}
// Bod na objekte, ku ktorému sa dá priblížiť alebo dať popis: stred bodu, stred obdĺžnika čiary/plochy.
function anchorOf(g) { if (g.t === 'pt') return g.c; var b = geomBBox(g); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }

/* ---------- živá mapa ---------- */
// opts.overlay(view) vracia SVG prekrytie, opts.onTap([lon,lat]) reaguje na ťuknutie.
function MapView(svg, scene, opts) {
  var self = this; opts = opts || {};
  this.svg = svg; this.scene = scene; this.opts = opts; this.proj = scene.proj; this.B = scene.B;
  this.pal = cssPal(); this.maxZoom = opts.maxZoom || 24;
  svg.innerHTML = '<g class="mv-base"></g><g class="mv-ov"></g>';
  this.gBase = svg.firstChild; this.gOv = svg.lastChild;
  this.gBase.innerHTML = drawScene(scene, this.pal, 0);
  this.vb = { x: 0, y: 0, w: 1, h: 1 }; this.full = null; this.atFull = true;
  var ptrs = {}, n = 0, moved = false, st = null, pz = null;
  function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  svg.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    try { svg.setPointerCapture(e.pointerId); } catch (x) { /* nevadí */ }
    if (!(e.pointerId in ptrs)) n++;
    ptrs[e.pointerId] = [e.clientX, e.clientY];
    if (n === 1) { moved = false; st = [e.clientX, e.clientY, self.vb.x, self.vb.y]; }
    else { moved = true; var p = pts(); pz = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) || 1, w: self.vb.w, m: self.toMap((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2) }; }
  });
  svg.addEventListener('pointermove', function (e) {
    if (!(e.pointerId in ptrs)) return;
    ptrs[e.pointerId] = [e.clientX, e.clientY];
    var r = svg.getBoundingClientRect();
    if (n === 1 && st) {
      var dx = e.clientX - st[0], dy = e.clientY - st[1];
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (moved) { self.vb.x = st[2] - dx / r.width * self.vb.w; self.vb.y = st[3] - dy / r.height * self.vb.h; self.atFull = false; self.apply(); }
    } else if (n >= 2 && pz) {
      var p = pts(), d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) || 1, mx = (p[0][0] + p[1][0]) / 2, my = (p[0][1] + p[1][1]) / 2;
      self.vb.w = pz.w * pz.d / d; self.clampW(); self.vb.h = self.vb.w * self.aspect();
      self.vb.x = pz.m[0] - (mx - r.left) / r.width * self.vb.w; self.vb.y = pz.m[1] - (my - r.top) / r.height * self.vb.h; self.atFull = false; self.apply();
    }
  });
  function up(e) {
    if (!(e.pointerId in ptrs)) return;
    if (e.type === 'pointerup' && n === 1 && !moved && opts.onTap) {
      var ll = self.proj.inv(self.toMap(e.clientX, e.clientY));
      if (isFinite(ll[0]) && isFinite(ll[1])) opts.onTap(ll);
    }
    delete ptrs[e.pointerId]; n--; pz = null;
    if (n === 1) { var p = pts()[0]; st = [p[0], p[1], self.vb.x, self.vb.y]; moved = true; }
  }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', function (e) { e.preventDefault(); self.zoom(e.deltaY > 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
  if (window.ResizeObserver) { var last = ''; new ResizeObserver(function () { var r = svg.getBoundingClientRect(), k = Math.round(r.width) + 'x' + Math.round(r.height); if (k !== last && r.width) { last = k; if (self.atFull) self.fit(); else self.apply(); } }).observe(svg); }
  this.fit();
}
MapView.prototype.aspect = function () { var r = this.svg.getBoundingClientRect(); return r.width && r.height ? r.height / r.width : 0.6; };
MapView.prototype.clampW = function () { this.vb.w = Math.max(this.full.w / this.maxZoom, Math.min(this.full.w, this.vb.w)); };
MapView.prototype.fit = function () {
  var a = this.aspect(), B = this.B, w = B.w * 1.04, h = w * a;
  if (h < B.h * 1.04) { h = B.h * 1.04; w = h / a; }
  this.full = { x: B.x + B.w / 2 - w / 2, y: B.y + B.h / 2 - h / 2, w: w, h: h };
  this.vb = { x: this.full.x, y: this.full.y, w: w, h: h }; this.atFull = true; this.apply();
};
MapView.prototype.apply = function () {
  var v = this.vb, B = this.B; this.clampW(); v.h = v.w * this.aspect();
  v.x = Math.max(B.x - v.w / 2, Math.min(B.x + B.w - v.w / 2, v.x)); v.y = Math.max(B.y - v.h / 2, Math.min(B.y + B.h - v.h / 2, v.y));
  this.svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h); this.redraw();
};
MapView.prototype.uPx = function () { return this.vb.w / (this.svg.getBoundingClientRect().width || 800); };
MapView.prototype.redraw = function () { this.gOv.innerHTML = this.opts.overlay ? this.opts.overlay(this) : ''; };
MapView.prototype.toMap = function (cx, cy) { var r = this.svg.getBoundingClientRect(); return [this.vb.x + (cx - r.left) / r.width * this.vb.w, this.vb.y + (cy - r.top) / r.height * this.vb.h]; };
MapView.prototype.zoom = function (f, cx, cy) {
  var r = this.svg.getBoundingClientRect(); if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  var m = this.toMap(cx, cy); this.vb.w *= f; this.clampW(); this.vb.h = this.vb.w * this.aspect();
  this.vb.x = m[0] - (cx - r.left) / r.width * this.vb.w; this.vb.y = m[1] - (cy - r.top) / r.height * this.vb.h; this.atFull = false; this.apply();
};
MapView.prototype.reset = function () { this.fit(); };
// Priblíži mapu na zemepisný obdĺžnik bbox (s okrajom).
MapView.prototype.zoomTo = function (bbox) {
  var P = projBounds(this.proj, bbox), a = this.aspect(), min = this.full.w / 10;
  var w = Math.max(min, P.w * 1.6, P.h * 1.6 / a), h = w * a;
  this.vb = { x: P.x + P.w / 2 - w / 2, y: P.y + P.h / 2 - h / 2, w: w, h: h }; this.atFull = false; this.apply();
};
function mapControls(box, getView) {
  if (box.querySelector('.zoom')) return;
  var d = el('div', { class: 'zoom' }, [
    el('button', { type: 'button', 'aria-label': t('map.zoom_in'), text: '+' }), el('button', { type: 'button', 'aria-label': t('map.zoom_out'), text: '−' }),
    el('button', { type: 'button', 'aria-label': t('map.zoom_all'), title: t('map.zoom_all'), text: '⤢' })]);
  var b = d.querySelectorAll('button');
  b[0].onclick = function () { var v = getView(); if (v) v.zoom(0.6); };
  b[1].onclick = function () { var v = getView(); if (v) v.zoom(1 / 0.6); };
  b[2].onclick = function () { var v = getView(); if (v) v.reset(); };
  box.appendChild(d);
}
// Nový prázdny <svg> namiesto starého (zahodí poslucháčov udalostí starej mapy).
function freshSvg(id) { var old = $(id), n = old.cloneNode(false); old.parentNode.replaceChild(n, old); return n; }

/* ---------- obrázok s tipmi jedného žiaka (PNG) ---------- */
// rec = {title, name, cls, when, pct, scoring:{full,zero}, items:[{name, type, g, c:[lon,lat]|null, d, why}]}
function sheetPng(scene, rec) {
  var W = 1600, MH = 900, top = 112, pal = PAL_LIGHT, rows = Math.ceil(rec.items.length / 2), H = top + MH + 44 + rows * 44 + 64;
  var B = scene.B, proj = scene.proj, u = Math.max(B.w * 1.04 / (W - 80), B.h * 1.04 / MH), vw = (W - 80) * u, vh = MH * u, vx = B.x + B.w / 2 - vw / 2, vy = B.y + B.h / 2 - vh / 2;
  var F = 'font-family="Atkinson Hyperlegible Next,system-ui,sans-serif"';
  var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
  s += '<text x="40" y="54" font-size="34" font-weight="800" fill="' + pal.ink + '" ' + F + '>' + esc(rec.title || t('app.title')) + '</text>';
  s += '<text x="40" y="92" font-size="24" fill="' + pal.ink + '" ' + F + '>' + esc([rec.name, rec.cls, rec.when].filter(Boolean).join(' · ')) + '</text>';
  s += '<text x="' + (W - 40) + '" y="62" font-size="46" font-weight="800" text-anchor="end" fill="' + pal.ink + '" ' + F + '>' + esc(fmtPct(rec.pct)) + '</text>';
  s += '<text x="' + (W - 40) + '" y="92" font-size="20" text-anchor="end" fill="' + pal.muted + '" ' + F + '>' + esc(t('img.scoring', { full: fmtKm(rec.scoring.full), zero: fmtKm(rec.scoring.zero) })) + '</text>';
  s += '<svg x="40" y="' + top + '" width="' + (W - 80) + '" height="' + MH + '" viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '">';
  s += drawScene(scene, pal, u, true);
  rec.items.forEach(function (it) { if (it.g) s += drawTarget(it.g, proj, pal, u); });
  rec.items.forEach(function (it, i) {
    if (!it.c || !it.g) return;
    if (it.d > 0) s += drawConn(it.c, measure(it.g, it.c).near, proj, pal, u);
    s += drawDot(it.c, proj, pal.tip, '#ffffff', 28, u) + drawLabel(it.c, proj, String(i + 1), '#ffffff', null, u, 18, 6, true);
  });
  s += '</svg><rect x="40" y="' + top + '" width="' + (W - 80) + '" height="' + MH + '" fill="none" stroke="' + pal.coast + '"/>';
  var ty = top + MH + 52;
  rec.items.forEach(function (it, i) {
    var col = i < rows ? 0 : 1, x = 40 + col * (W / 2 - 20), y = ty + (i % rows) * 44;
    s += '<circle cx="' + (x + 15) + '" cy="' + (y - 8) + '" r="15" fill="' + pal.tip + '"/><text x="' + (x + 15) + '" y="' + (y - 2) + '" font-size="18" font-weight="800" text-anchor="middle" fill="#fff" ' + F + '>' + (i + 1) + '</text>';
    s += '<text x="' + (x + 44) + '" y="' + y + '" font-size="24" font-weight="600" fill="' + pal.ink + '" ' + F + '>' + esc(it.name) + '<tspan font-size="19" font-weight="400" fill="' + pal.muted + '" dx="10">' + esc(typeOne(it.type)) + '</tspan></text>';
    s += '<text x="' + (x + W / 2 - 80) + '" y="' + y + '" font-size="24" font-weight="800" text-anchor="end" fill="' + pal.ink + '" ' + F + '>' + esc(it.why ? t('why.' + it.why) : fmtKm(it.d)) +
      '<tspan font-weight="400" fill="' + pal.muted + '" dx="14">' + esc(fmtPct(pctFor(it.why ? null : it.d, rec.scoring.full, rec.scoring.zero))) + '</tspan></text>';
  });
  s += '<text x="40" y="' + (H - 22) + '" font-size="18" fill="' + pal.muted + '" ' + F + '>' + esc(t('img.legend')) + '</text></svg>';
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = pal.sea; ctx.fillRect(40, top, W - 80, MH);
        ctx.save(); ctx.beginPath(); ctx.rect(40, top, W - 80, MH); ctx.clip();
        scene.layers.forEach(function (L) { if (L.kind === 'raster') ctx.drawImage(L.canvas || L.img, 40 + (L.x - vx) / u, top + (L.y - vy) / u, L.w / u, L.h / u); });
        ctx.restore();
        ctx.drawImage(img, 0, 0, W, H);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = function () { reject(new Error('image')); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
function downloadUrl(url, name) { var a = el('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); }
