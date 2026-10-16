/* Slepá mapa: načítanie katalógu a vrstiev z priečinka data/ v repozitári (popis formátu je v DATA.md). */
var TYPE_ALIAS = {
  country: 'countries', countries: 'countries', state: 'countries', staty: 'countries', stat: 'countries',
  region: 'regions', regions: 'regions', kraj: 'regions', kraje: 'regions',
  district: 'districts', districts: 'districts', okres: 'districts', okresy: 'districts',
  city: 'cities', cities: 'cities', town: 'cities', towns: 'cities', mesto: 'cities', mesta: 'cities', obce: 'cities',
  river: 'rivers', rivers: 'rivers', rieka: 'rivers', rieky: 'rivers',
  lake: 'lakes', lakes: 'lakes', reservoir: 'lakes', jazero: 'lakes', jazera: 'lakes',
  sea: 'seas', seas: 'seas', more: 'seas', moria: 'seas', ocean: 'oceans', oceans: 'oceans',
  mountain: 'mountains', mountains: 'mountains', pohorie: 'mountains', pohoria: 'mountains',
  peak: 'peaks', peaks: 'peaks', vrch: 'peaks', vrchy: 'peaks',
  lowland: 'lowlands', lowlands: 'lowlands', basin: 'lowlands', nizina: 'lowlands', niziny: 'lowlands', kotliny: 'lowlands',
  island: 'islands', islands: 'islands', ostrov: 'islands', ostrovy: 'islands', peninsula: 'peninsulas', peninsulas: 'peninsulas',
  desert: 'deserts', deserts: 'deserts', park: 'parks', parks: 'parks', protarea: 'parks', protectedarea: 'parks', protectedareas: 'parks', protected: 'parks',
  cave: 'caves', caves: 'caves', jaskyne: 'caves', water: 'lakes', waterbody: 'lakes', waterbodies: 'lakes',
  saddle: 'saddles', saddles: 'saddles', pass: 'saddles', passes: 'saddles', sedlo: 'saddles', sedla: 'saddles',
  plate: 'plates', plates: 'plates', ecv: 'plates'
};
// Témy, podľa ktorých sú zoskupené typy aj vrstvy na mape (poradie tém aj typov v nich).
var THEMES = ['water', 'relief', 'nature', 'people', 'states', 'admin', 'other'];
var TYPE_ORDER = ['rivers', 'lakes', 'seas', 'oceans', 'mountains', 'lowlands', 'peaks', 'saddles', 'caves', 'islands', 'peninsulas', 'deserts', 'parks', 'cities', 'countries', 'regions', 'districts', 'plates'];
var TYPE_THEME = { rivers: 'water', lakes: 'water', seas: 'water', oceans: 'water', mountains: 'relief', lowlands: 'relief', peaks: 'relief', saddles: 'relief', caves: 'relief',
  islands: 'relief', peninsulas: 'relief', deserts: 'relief', parks: 'nature', cities: 'people', countries: 'states', regions: 'admin', districts: 'admin', plates: 'admin' };
function themeOfType(type) { return TYPE_THEME[type] || 'other'; }
// Podkladová vrstva podľa názvu (časť za base_): reliéf k povrchu, obrys a okolie k štátom, hranice k členeniu.
function themeOfLayer(name, raster) {
  var n = normName(name);
  if (raster || /relief|hillshade|bathy|hlbk|vysk/.test(n)) return 'relief';
  if (/^(land|outline|obrys|uzemie)$|surround|okolie|neighbo|susedia|countr|staty/.test(n)) return 'states';
  if (/border|hranic/.test(n)) return 'admin';
  if (/water|vod/.test(n)) return 'water';
  return 'other';
}
function sortTypes(types) {
  return types.slice().sort(function (a, b) {
    var i = TYPE_ORDER.indexOf(a), j = TYPE_ORDER.indexOf(b);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || typeLabel(a).localeCompare(typeLabel(b), I18N.lang);
  });
}
// Tabuľka obtiažností (CSV): oddeľovač ; , alebo tabulátor, prvý riadok hlavička. Riadok, ktorý opakuje hlavičku, začína nový blok.
function parseCsv(txt) {
  txt = String(txt || '').replace(/^﻿/, '');
  var first = txt.split(/\r?\n/, 1)[0], delim = [';', '\t', ','].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0];
  var rows = [], row = [], cell = '', q = false, i, c;
  for (i = 0; i < txt.length; i++) {
    c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  var out = [], head = null;
  rows.forEach(function (r) {
    var cells = r.map(function (x) { return x.trim(); });
    if (!cells.some(Boolean)) return;
    var low = cells.map(function (x) { return normName(x).replace(/ /g, '_'); });
    if (low.indexOf('id') >= 0 && low.some(function (x) { return /^(difficulty|obtiaznost|obtaznost|level)$/.test(x); })) { head = low; return; }
    if (!head) return;
    var o = {}; head.forEach(function (k, j) { if (k) o[k] = cells[j] === undefined ? '' : cells[j]; });
    out.push(o);
  });
  return out;
}
var Data = {
  _idx: null, _json: {}, _raster: {}, _text: {}, _diff: {}, _reg: {}, warnings: [],

  url: function (file) { return /^https?:\/\//.test(file) ? file : APP.dataUrl + file; },
  fetchJson: function (file) {
    if (!Data._json[file]) {
      Data._json[file] = fetch(Data.url(file)).then(function (r) {
        if (!r.ok) throw ApiError('data_missing', file);
        return r.json();
      }).catch(function (e) { delete Data._json[file]; throw e.code ? e : ApiError('data_missing', file); });
    }
    return Data._json[file];
  },
  fetchText: function (file) {
    if (!Data._text[file]) {
      Data._text[file] = fetch(Data.url(file), { cache: /^https?:/.test(file) ? 'no-cache' : 'default' }).then(function (r) {
        if (!r.ok) throw ApiError('data_missing', file);
        return r.text();
      }).catch(function (e) { delete Data._text[file]; throw e.code ? e : ApiError('data_missing', file); });
    }
    return Data._text[file];
  },
  // Obtiažnosti oblasti zo súborov v index.json ("difficulty"): {id: {difficulty, abbrev, ...}}. Chýbajúca tabuľka nič nepokazí.
  difficulty: function (code) {
    if (!Data._diff[code]) {
      var r = Data._reg[code], files = r ? r.difficulty : [];
      Data._diff[code] = Promise.all(files.map(function (f) {
        return Data.fetchText(f).then(parseCsv).catch(function () { Data.warnings.push(f); console.warn('Slepá mapa: tabuľka obtiažností sa nenačítala', f); return []; });
      })).then(function (lists) {
        var map = {};
        lists.forEach(function (rows) { rows.forEach(function (row) { if (row.id) map[row.id] = row; }); });
        return map;
      });
    }
    return Data._diff[code];
  },

  // Typ objektov alebo názov vrstvy z názvu súboru: sk/sk_rivers.json -> rivers, sk/base_relief.jpg -> relief.
  stem: function (file, code) {
    var s = String(file).split('/').pop().replace(/\.[^.]+$/, '');
    if (code && s.toLowerCase().indexOf(code.toLowerCase() + '_') === 0) s = s.slice(code.length + 1);
    return s.replace(/^base_/i, '');
  },
  // Iné bežné názvy typov (jednotné číslo, angličtina, slovenčina) -> kód typu z DATA.md.
  typeOf: function (stem) {
    var n = normName(stem).replace(/ /g, '');
    return TYPE_ALIAS[n] || stem;
  },
  isRaster: function (file) { return /\.(jpe?g|png|webp)$/i.test(file); },

  index: function () {
    if (!Data._idx) {
      Data._idx = Data.fetchJson('index.json').then(function (j) {
        var list = Array.isArray(j.regions) ? j.regions : Object.keys(j.regions || {}).map(function (k) { return Object.assign({ code: k }, j.regions[k]); });
        return list.map(function (r) {
          var code = String(r.code);
          // Položka objects je názov súboru, alebo {file, type, nameField, noteField, difficultyMap} pre odvodený typ (napr. EČV z okresov).
          var reg = {
            code: code, names: r.name, bbox: Array.isArray(r.bbox) && r.bbox.length === 4 ? r.bbox.map(Number) : null,
            objects: (r.objects || []).map(function (f) {
              if (f && typeof f === 'object') return { file: f.file, type: Data.typeOf(f.type || Data.stem(f.file, code)), nameField: f.nameField, noteField: f.noteField, difficultyMap: f.difficultyMap };
              return { file: f, type: Data.typeOf(Data.stem(f, code)) };
            }).filter(function (o) { return o.file; }),
            base: (r.base || []).map(function (f) { return { file: f, name: Data.stem(f, code), raster: Data.isRaster(f) }; }),
            difficulty: [].concat(r.difficulty || []).filter(Boolean)
          };
          Data._reg[code] = reg;
          return reg;
        });
      });
    }
    return Data._idx;
  },

  // Objekty jednej položky z index.json: [{id, name, type, diff, g, bbox, regions, note}]
  // Obtiažnosť má prednosť z tabuľky obtiažností (podľa id), inak z atribútu difficulty v GeoJSON, inak 3.
  objects: function (entry, type, region) {
    if (typeof entry === 'string') entry = { file: entry, type: type };
    type = entry.type || type;
    return Promise.all([Data.fetchJson(entry.file), Data.difficulty(region)]).then(function (res) {
      var fc = res[0], D = res[1], out = [];
      (fc.features || []).forEach(function (f) {
        var p = f.properties || {}, g = geomOf(f.geometry);
        if (!g || p.active === 0 || p.active === false || p.active === '0') return;
        var name = (I18N.lang !== 'sk' && p['name_' + I18N.lang]) || p.name || p.nazov || p.NAME || '';
        if (!name) return;
        var baseId = String(p.id || type + '-' + normName(name).replace(/ /g, '-')), row = D[baseId] || null;
        if (row && row.active === '0') return;
        var field = function (k) { return k ? (p[k] !== undefined && p[k] !== '' ? p[k] : row && row[k] ? row[k] : '') : ''; };
        if (entry.nameField) { name = field(entry.nameField); if (!name) return; }
        var d = row && row.difficulty !== undefined && row.difficulty !== '' ? row.difficulty : p.difficulty !== undefined ? p.difficulty : p.Difficulty !== undefined ? p.Difficulty : p.level !== undefined ? p.level : p.Level !== undefined ? p.Level : p.obtiaznost;
        var diff = Math.max(1, Math.min(5, Math.round(+String(d).replace(',', '.')) || 3));
        if (entry.difficultyMap && entry.difficultyMap[diff] !== undefined) diff = Math.max(1, Math.min(5, +entry.difficultyMap[diff] || diff));
        var o = { id: entry.nameField ? baseId + '-' + type : baseId, name: String(name), type: type, diff: diff, g: g, bbox: geomBBox(g), regions: [region] };
        if (entry.noteField && field(entry.noteField)) o.note = String(field(entry.noteField));
        out.push(o);
      });
      return out;
    });
  },

  vector: function (file) {
    return Data.fetchJson(file).then(function (fc) {
      var feats = fc.type === 'FeatureCollection' ? fc.features || [] : fc.type === 'Feature' ? [fc] : [{ geometry: fc }];
      return feats.map(function (f) { var g = geomOf(f.geometry); return g ? { g: g, bbox: geomBBox(g) } : null; }).filter(Boolean);
    });
  },

  // Raster s world file (.jgw, .pgw, .wld …) v súradniciach WGS 84. Vracia {img, bounds:[západ, juh, východ, sever]}.
  raster: function (file) {
    if (!Data._raster[file]) {
      var stem = file.replace(/\.[^.]+$/, ''), ext = file.split('.').pop().toLowerCase();
      var cands = [stem + '.' + ext[0] + ext[ext.length - 1] + 'w', stem + '.wld', file + 'w', stem + '.' + ext[0] + 'gw'];
      var tryWorld = function (i) {
        if (i >= cands.length) return Promise.reject(ApiError('world_missing', file));
        return fetch(APP.dataUrl + cands[i]).then(function (r) { return r.ok ? r.text() : tryWorld(i + 1); }, function () { return tryWorld(i + 1); });
      };
      var img = new Promise(function (res, rej) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { res(im); }; im.onerror = function () { rej(ApiError('data_missing', file)); };
        im.src = APP.dataUrl + file;
      });
      Data._raster[file] = Promise.all([tryWorld(0), img]).then(function (r) {
        var v = r[0].trim().split(/\s+/).map(Number), im = r[1];
        if (v.length < 6 || v.some(isNaN)) throw ApiError('world_missing', file);
        var A = v[0], E = v[3], west = v[4] - A / 2, north = v[5] - E / 2;
        return { img: im, bounds: [west, north + E * im.naturalHeight, west + A * im.naturalWidth, north] };
      }).catch(function (e) { delete Data._raster[file]; throw e; });
    }
    return Data._raster[file];
  }
};

// Štýl vrstvy na mape podľa jej názvu alebo typu objektov.
function layerStyle(name, raster) {
  if (raster) return 'raster';
  var n = normName(name);
  if (/^(land|outline|obrys|uzemie|countries|staty)$/.test(n)) return n === 'countries' || n === 'staty' ? 'countries' : 'land';
  if (/surround|okolie|neighbo|susedia/.test(n)) return 'surroundings';
  if (/border|hranic|regions|kraje|okresy|district/.test(n)) return 'borders';
  if (/water|voda|vody|river|rieky|lake|jazer|sea|more|ocean|reservoir|nadrz/.test(n)) return 'water';
  if (/cities|mesta|obce|peaks|vrchy|saddles|sedla|caves|jaskyne|points|body/.test(n)) return 'dots';
  return 'auto';
}
// Vrstvy na kreslenie: z každého súboru najviac raz (odvodené typy, napr. EČV, zdieľajú súbor okresov).
function sceneRefs(regions, codes, files) {
  var refs = [], seen = {};
  codes.forEach(function (c) {
    var r = regions.filter(function (x) { return x.code === c; })[0]; if (!r) return;
    r.base.forEach(function (b) { if (files.indexOf(b.file) >= 0 && !seen[b.file]) { seen[b.file] = 1; refs.push({ file: b.file, style: layerStyle(b.name, b.raster) }); } });
    r.objects.forEach(function (o) { if (files.indexOf(o.file) >= 0 && !seen[o.file]) { seen[o.file] = 1; refs.push({ file: o.file, style: layerStyle(o.type, false) }); } });
  });
  return refs;
}

/* ---------- ponuka vrstiev na mapu (aplikácia učiteľa aj precvičovanie) ---------- */
// Podkladové vrstvy vybraných oblastí (predvolene zapnuté) a celé súbory objektov, napr. „Všetky rieky“ (predvolene vypnuté).
// type = typy objektov zo súboru oddelené medzerou (okresy aj EČV), theme = skupina v ponuke.
function layerItems(regions, codes) {
  var items = [];
  codes.forEach(function (c) {
    var r = regions.filter(function (x) { return x.code === c; })[0]; if (!r) return;
    var pre = codes.length > 1 ? regionLabel(c, r.names) + ': ' : '', byFile = {};
    r.base.forEach(function (b) { items.push({ value: b.file, label: pre + (has('layer.' + b.name) ? t('layer.' + b.name) : b.name), def: true, theme: themeOfLayer(b.name, b.raster), rank: 0 }); });
    r.objects.forEach(function (o) {
      if (byFile[o.file]) { byFile[o.file].type += ' ' + o.type; return; }
      var it = { value: o.file, label: pre + t('t.layer_all', { type: low(typeLabel(o.type)) }), def: false, type: o.type, theme: themeOfType(o.type), rank: 1 + Math.max(0, TYPE_ORDER.indexOf(o.type)) };
      byFile[o.file] = it; items.push(it);
    });
  });
  return items;
}
// Zaškrtávacie „čipy“; ak majú položky tému, zoskupia sa pod nadpisy tém. Ťuknutie na nadpis zapne alebo vypne celú tému.
function renderChips(box, items, checked, onchange) {
  box.innerHTML = '';
  var grouped = items.some(function (it) { return it.theme; });
  box.classList.toggle('grouped', grouped);
  var chip = function (it, i) {
    var id = box.id + '-' + i, inp = el('input', { type: 'checkbox', id: id, value: it.value, 'data-type': it.type });
    inp.checked = checked.indexOf(it.value) >= 0; inp.onchange = onchange || null;
    return el('label', { class: 'chip', for: id }, [inp, ' ' + it.label]);
  };
  if (!grouped) { items.forEach(function (it, i) { box.appendChild(chip(it, i)); }); return; }
  var idx = items.map(function (it, i) { return { it: it, i: i }; });
  THEMES.forEach(function (th) {
    var mine = idx.filter(function (x) { return (x.it.theme || 'other') === th; });
    if (!mine.length) return;
    mine.sort(function (a, b) { return (a.it.rank || 0) - (b.it.rank || 0) || a.i - b.i; });
    var grp = el('div', { class: 'chipgroup', 'data-theme': th });
    var head = el('button', { type: 'button', class: 'grouphead', text: has('theme.' + th) ? t('theme.' + th) : th, title: t('t.theme_toggle'), onclick: function () {
      var ins = Array.prototype.slice.call(grp.querySelectorAll('input:not(:disabled)')), on = !ins.every(function (x) { return x.checked; });
      ins.forEach(function (x) { x.checked = on; });
      if (onchange) onchange.call(ins[0]);
    } });
    grp.appendChild(head);
    mine.forEach(function (x) { grp.appendChild(chip(x.it, x.i)); });
    box.appendChild(grp);
  });
}
// Test: typ, ktorý sa práve hádá, nemôže byť na mape celý: jeho vrstva sa zošedí a vypne (precvičovanie to nepoužíva).
// Keď sa typ odškrtne, vrstva dostane späť zapamätaný stav (remembered = zoznam zapnutých súborov).
function lockLayers(box, types, remembered) {
  box.querySelectorAll('input[data-type]').forEach(function (i) {
    var off = i.getAttribute('data-type').split(' ').some(function (x) { return types.indexOf(x) >= 0; });
    if (off) i.checked = false; else if (i.disabled) i.checked = (remembered || []).indexOf(i.value) >= 0;
    i.disabled = off;
    i.parentNode.title = off ? t('t.layer_locked') : '';
  });
}
// Zapamätané zapnuté vrstvy po zmene: zošedené vrstvy si nechajú svoj predošlý stav.
function layersAfterChange(box, remembered) {
  var en = [], on = [];
  box.querySelectorAll('input').forEach(function (i) { if (!i.disabled) { en.push(i.value); if (i.checked) on.push(i.value); } });
  return uniq((remembered || []).filter(function (f) { return en.indexOf(f) < 0; }).concat(on));
}
