/* Slepá mapa: výpočty nad geometriou (bez prístupu k stránke).
 * Rovnaké funkcie hav, measure, pctFor, round1 a normName sú aj v apps-script/Code.gs, pri zmene ich treba zmeniť na oboch miestach.
 * Geometria objektu: {t:'pt', c:[lon,lat]} | {t:'line', c:[[[lon,lat],...],...]} | {t:'area', c:[[obvod, diera,...],...]}
 */
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
// Najbližší bod lomenej čiary k bodu c. best = {d2, near} sa priebežne zlepšuje.
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
// Odchýlka tipu c=[lon,lat] od objektu g v km a najbližší bod objektu. Tip vnútri plochy má odchýlku 0.
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
// Percentá za jeden objekt: 100 % do vzdialenosti full, 0 % od vzdialenosti zero, medzi nimi kvadratická krivka
// (hneď za full klesá strmšie než lineárne). PCT_POW = 1 by bolo lineárne. d=null znamená bez tipu.
var PCT_POW = 2;
function pctFor(d, full, zero) {
  if (d === null || d === undefined || d === '' || isNaN(d)) return 0;
  if (d <= full) return 1;
  if (d >= zero) return 0;
  return Math.pow((zero - d) / (zero - full), PCT_POW);
}
function round1(x) { return Math.round(x * 10) / 10; }
// Porovnávanie názvov bez diakritiky, veľkosti písmen a interpunkcie.
function normName(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`´.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ---------- GeoJSON -> vnútorná geometria ---------- */
function geomOf(g) {
  if (!g) return null;
  if (g.type === 'Point') return { t: 'pt', c: g.coordinates.slice(0, 2) };
  if (g.type === 'MultiPoint') return g.coordinates.length ? { t: 'pt', c: g.coordinates[0].slice(0, 2) } : null;
  if (g.type === 'LineString') return { t: 'line', c: [g.coordinates] };
  if (g.type === 'MultiLineString') return { t: 'line', c: g.coordinates };
  if (g.type === 'Polygon') return { t: 'area', c: [g.coordinates] };
  if (g.type === 'MultiPolygon') return { t: 'area', c: g.coordinates };
  if (g.type === 'GeometryCollection' && g.geometries) {
    var parts = g.geometries.map(geomOf).filter(Boolean);
    if (!parts.length) return null;
    var t = parts[0].t, out = { t: t, c: [] };
    parts.forEach(function (p) { if (p.t === t) out.c = t === 'pt' ? p.c : out.c.concat(p.c); });
    return out;
  }
  return null;
}
function eachPath(g, fn) {
  var i, j;
  if (g.t === 'pt') fn([g.c]);
  else if (g.t === 'line') for (i = 0; i < g.c.length; i++) fn(g.c[i]);
  else for (i = 0; i < g.c.length; i++) for (j = 0; j < g.c[i].length; j++) fn(g.c[i][j]);
}
function pathBBox(pts, b) {
  b = b || [Infinity, Infinity, -Infinity, -Infinity];
  for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }
  return b;
}
function geomBBox(g) { var b = [Infinity, Infinity, -Infinity, -Infinity]; eachPath(g, function (p) { pathBBox(p, b); }); return b; }
function bboxHit(a, b) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
function bboxUnion(a, b) { return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice(); }
function bboxPad(b, f) { var dx = (b[2] - b[0]) * f, dy = (b[3] - b[1]) * f; return [Math.max(-180, b[0] - dx), Math.max(-89, b[1] - dy), Math.min(180, b[2] + dx), Math.min(89, b[3] + dy)]; }
function bboxArea(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
// Uhlopriečka mapy v km, z nej sa počítajú hranice hodnotenia. Pri celom svete pevne 20 000 km.
function bboxDiag(b) { return (b[2] - b[0]) > 300 ? 20000 : hav([b[0], b[1]], [b[2], b[3]]); }
// Rozpätie v stupňoch po prepočte zemepisnej dĺžky na šírku, podľa neho sa zjednodušuje.
function bboxSpan(b) { return Math.max((b[2] - b[0]) * Math.cos((b[1] + b[3]) / 2 * RAD), b[3] - b[1]); }

/* ---------- zjednodušenie (Douglas-Peucker) ---------- */
function dp(pts, tol) {
  var n = pts.length; if (n < 3 || !tol) return pts.slice();
  var keep = new Uint8Array(n), stack = [[0, n - 1]], t2 = tol * tol; keep[0] = keep[n - 1] = 1;
  while (stack.length) {
    var s = stack.pop(), a = pts[s[0]], b = pts[s[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, max = -1, idx = -1;
    for (var i = s[0] + 1; i < s[1]; i++) {
      var p = pts[i], t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0, ex = p[0] - a[0] - t * dx, ey = p[1] - a[1] - t * dy, d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > t2) { keep[idx] = 1; stack.push([s[0], idx], [idx, s[1]]); }
  }
  var out = []; for (var j = 0; j < n; j++) if (keep[j]) out.push(pts[j]); return out;
}
function rndPts(pts, dec) { var k = Math.pow(10, dec); return pts.map(function (p) { return [Math.round(p[0] * k) / k, Math.round(p[1] * k) / k]; }); }
function simpLine(pts, tol, dec) { return rndPts(dp(pts, tol), dec); }
function simpPoly(poly, tol, dec) {
  var out = [];
  for (var i = 0; i < poly.length; i++) {
    var b = pathBBox(poly[i]); if (Math.max(b[2] - b[0], b[3] - b[1]) < tol * 2) { if (i === 0) return null; continue; }
    var r = simpLine(poly[i], tol, dec); if (r.length < 4) { if (i === 0) return null; continue; }
    out.push(r);
  }
  return out.length ? out : null;
}
function simpGeom(g, tol, dec) {
  if (g.t === 'pt') return { t: 'pt', c: rndPts([g.c], 4)[0] };
  if (g.t === 'line') return { t: 'line', c: g.c.map(function (l) { return simpLine(l, tol, dec); }).filter(function (l) { return l.length > 1; }) };
  var polys = g.c.map(function (p) { return simpPoly(p, tol, dec); }).filter(Boolean);
  if (!polys.length) { var big = g.c.slice().sort(function (a, b) { return bboxArea(pathBBox(b[0])) - bboxArea(pathBBox(a[0])); })[0]; polys = [[rndPts(big[0], dec)]]; }
  return { t: 'area', c: polys };
}
// Desatinné miesta podľa tolerancie: zbytočne presné súradnice len zväčšujú dáta.
function decFor(tol) { return tol < 0.0005 ? 5 : tol < 0.005 ? 4 : tol < 0.05 ? 3 : 2; }
