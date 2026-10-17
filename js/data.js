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
  plate: 'plates', plates: 'plates', ecv: 'plates',
  strait: 'straits', straits: 'straits', prieliv: 'straits', prielivy: 'straits', waterfall: 'waterfalls', waterfalls: 'waterfalls', vodopad: 'waterfalls', vodopady: 'waterfalls',
  archipelago: 'archipelagos', archipelagos: 'archipelagos', suostrovie: 'archipelagos', suostrovia: 'archipelagos',
  volcano: 'volcanoes', volcanoes: 'volcanoes', sopka: 'volcanoes', sopky: 'volcanoes', plateau: 'plateaus', plateaus: 'plateaus', plosina: 'plateaus', plosiny: 'plateaus',
  glacier: 'glaciers', glaciers: 'glaciers', ladovec: 'glaciers', ladovce: 'glaciers',
  capital: 'capitals', capitals: 'capitals', airport: 'airports', airports: 'airports', letisko: 'airports', letiska: 'airports', port: 'ports', ports: 'ports', pristav: 'ports', pristavy: 'ports',
  histregion: 'histregions', histregions: 'histregions', historicalregion: 'histregions', historicalregions: 'histregions'
};
// Typy objektov sa v ponuke vyberajú po témach (skupinách); konkrétny typ sa zúži obtiažnosťou.
var THEMES = ['water', 'relief', 'nature', 'people', 'states', 'admin', 'other'];
var TYPE_ORDER = ['rivers', 'lakes', 'seas', 'oceans', 'straits', 'waterfalls', 'mountains', 'lowlands', 'plateaus', 'peaks', 'volcanoes', 'saddles', 'caves', 'glaciers', 'islands', 'archipelagos', 'peninsulas', 'deserts',
  'parks', 'capitals', 'cities', 'airports', 'ports', 'countries', 'regions', 'histregions', 'districts', 'plates'];
var TYPE_THEME = { rivers: 'water', lakes: 'water', seas: 'water', oceans: 'water', mountains: 'relief', lowlands: 'relief', peaks: 'relief', saddles: 'relief', caves: 'relief',
  islands: 'relief', peninsulas: 'relief', deserts: 'relief', parks: 'nature', cities: 'people', countries: 'states', regions: 'admin', districts: 'admin', plates: 'admin',
  straits: 'water', waterfalls: 'water', archipelagos: 'relief', volcanoes: 'relief', plateaus: 'relief', glaciers: 'relief', capitals: 'people', histregions: 'admin' };
function themeOfType(type) { return TYPE_THEME[type] || 'other'; }
// Ikony skupín typov (čiara v farbe textu) a vzorky vrstiev v ich farbe na mape (slúžia aj ako legenda).
var SVG_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
var THEME_ICONS = {
  water: '<path d="M2 9c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0"/><path d="M2 15c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0"/>',
  relief: '<path d="M2 20 9 6l4 7 2.5-3.5L22 20z"/>',
  nature: '<path d="M5 20c-1-9 5-15 15-15 0 10-5 15-14 15"/><path d="M5 20 14 11"/>',
  people: '<path d="M3 21V10l5-3v14"/><path d="M8 21V4h8v17"/><path d="M16 21v-9h5v9"/><path d="M2 21h20"/><path d="M11 8h2M11 12h2M11 16h2"/>',
  states: '<path d="M5 21V4"/><path d="M5 4h13l-2.5 4.5L18 13H5"/>',
  admin: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  other: '<circle cx="12" cy="12" r="4"/>'
};
var SVG_SW = '<svg viewBox="0 0 26 16" fill="none" stroke-linecap="round" stroke-linejoin="round">';
var LAYER_SWATCH = {
  relief: '<path d="M1 15 9 3l5 7 3-3 8 8z" style="fill:#7a7a7a"/><path d="M9 3l5 7 3-3 8 8H13z" style="fill:#c2c2c2"/>',
  landforms: '<path d="M2 14 8 3l5 6 3-3 8 8z" style="stroke:var(--celky);stroke-width:2"/>',
  parks: '<rect x="2" y="2.5" width="22" height="11" rx="3" style="fill:var(--park);fill-opacity:.22;stroke:var(--park);stroke-width:2"/>',
  water: '<path d="M1 10c3-5 6 4 9 0s6 4 9 0c2-2.5 4-1.5 6-1" style="stroke:var(--water);stroke-width:2.4"/>',
  cities: '<circle cx="5" cy="10" r="2.8" style="fill:var(--city);stroke:#fff;stroke-width:1"/><circle cx="13" cy="5" r="2.8" style="fill:var(--city);stroke:#fff;stroke-width:1"/><circle cx="21" cy="11" r="2.8" style="fill:var(--city);stroke:#fff;stroke-width:1"/>',
  countries: '<path d="M1 9h6l3-5 4 9 3-4h8" style="stroke:var(--border);stroke-width:1.8"/>',
  regions: '<path d="M1 9h6l3-5 4 9 3-4h8" style="stroke:var(--kraj);stroke-width:2.6"/>',
  districts: '<path d="M1 9h6l3-5 4 9 3-4h8" style="stroke:var(--okres);stroke-width:1.5"/>'
};
// Symbol každého typu (pri zadaní, vo výsledkoch, v zozname učiteľa). Kde sa dá, atlasové značky: vrch ▲, sedlo )(, jaskyňa, mesto ◉, hlavné mesto ★.
// Farbu dostane podľa témy (rovnaká ako vrstva na mape). Nový typ = nový riadok tu a názvy v lang/*.json.
var TYPE_ICONS = {
  rivers: '<path d="M7 3c6 3-4 6 2 9s-4 6 2 9"/><path d="M18 5c-1 3-4 5-7.5 6.5"/>',
  lakes: '<path d="M3.6 13.6c-.8-2.6.9-5 3.8-5.3 1.6-.2 2.6-1.6 4.6-1.9 2.6-.4 4.4.6 5.4 2 .8 1.1 2.6 1.1 3.2 2.7.7 1.9-.4 3.6-2.2 4.4-1.5.7-2.3 2-4.4 2.2-1.9.2-2.9-.8-4.7-.7-2.2.1-4.8-.6-5.7-3.4z" fill="currentColor" fill-opacity=".22" stroke-width="1.7"/>',
  seas: '<path d="M3 5h4c1 3 3 5 5 5s4-2 5-5h4"/><path d="M4 15c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0"/><path d="M4 20c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0"/>',
  oceans: '<circle cx="12" cy="12" r="9"/><path d="M4 10c2.5-1.5 5-1.5 8 0s5.5 1.5 8 0"/><path d="M4 15c2.5-1.5 5-1.5 8 0s5.5 1.5 8 0"/>',
  straits: '<path d="M3 3h6c-1.5 3-1.5 6 0 9-1.5 3-1.5 6 0 9H3"/><path d="M21 3h-6c1.5 3 1.5 6 0 9 1.5 3 1.5 6 0 9h6"/>',
  waterfalls: '<path d="M3 6h8c2 0 3 1 3 3v12"/><path d="M17 9v8M20 12v6"/><path d="M10 21h11"/>',
  mountains: '<path d="M2 20 7.5 8 12 15l3.5-6L22 20z"/>',
  peaks: '<path d="M12 5 20 19H4z" fill="currentColor"/>',
  saddles: '<path d="M7 4c3.5 4 3.5 12 0 16"/><path d="M17 4c-3.5 4-3.5 12 0 16"/>',
  caves: '<path d="M6.3 19h2.5v-7.3a3.2 3.2 0 0 1 6.4 0V19h2.5"/>',
  lowlands: '<path d="M2 6c2 0 3 6 6 6h8c3 0 4-6 6-6"/><path d="M6 17h12"/>',
  islands: '<path d="M5 14c1-4 4-6 7-6s6 2 7 6z"/><path d="M2 18c2-1.3 3.5-1.3 5 0s3.5 1.3 5 0 3.5-1.3 5 0 3.5 1.3 5 0"/>',
  archipelagos: '<path d="M3 11c0-2 1.5-3.5 3.5-3.5S10 9 10 11z"/><path d="M13 8c0-2 1.5-3 3-3s3 1 3 3z"/><path d="M11 15c0-2 1.5-3 3.5-3s3.5 1 3.5 3z"/><path d="M2 20c2-1.3 3.5-1.3 5 0s3.5 1.3 5 0 3.5-1.3 5 0 3.5 1.3 5 0"/>',
  peninsulas: '<path d="M3 4v16"/><path d="M3 8h8c4 0 7 2 7 4s-3 4-7 4H3"/><path d="M16 20c1.3-1 2.7-1 4 0"/>',
  deserts: '<circle cx="17" cy="6" r="2.5"/><path d="M2 18c3-4 6-4 9 0"/><path d="M8 18c3-5 7-5 12 0"/><path d="M2 21h20"/>',
  volcanoes: '<path d="M3 20 9 9h6l6 11z"/><path d="M12 6c-1-1.5 0-3 1.5-3.5"/>',
  plateaus: '<path d="M2 20 6 9h12l4 11"/><path d="M2 20h20"/>',
  glaciers: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>',
  parks: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>',
  cities: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  capitals: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z"/>',
  airports: '<path d="M10.5 4c0-1.3 3-1.3 3 0v5l7 4v2l-7-2v5l2 1.5V21L12 20l-3.5 1v-1.5l2-1.5v-5l-7 2v-2l7-4z"/>',
  ports: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M9 10h6"/>',
  countries: '<path d="M5 21V4"/><path d="M5 4h13l-2.5 4.5L18 13H5"/>',
  regions: '<path d="M4 6l6-3 5 3 5-1-1 7 2 5-6 4-6-2-5 1 1-7z"/>',
  districts: '<path d="M4 6l6-3 5 3 5-1-1 7 2 5-6 4-6-2-5 1 1-7z"/><path d="M10 3.5 11 11l-7 2M11 11l8 .5M11 11l1 8" stroke-width="1.3"/>',
  plates: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v10"/><text x="14.2" y="14.6" text-anchor="middle" font-size="6.5" font-weight="700" fill="currentColor" stroke="none">ZV</text>',
  histregions: '<path d="M4 21V9h3v2h3V9h4v2h3V9h3v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>'
};
function typeIcon(type) {
  return el('span', { class: 'tico', 'data-th': themeOfType(type), 'data-ty': type, 'aria-hidden': 'true', html: SVG_ICO + (TYPE_ICONS[type] || THEME_ICONS[themeOfType(type)] || THEME_ICONS.other) + '</svg>' });
}
// Zadanie: symbol typu, nad názvom malé slovo typu („vrch“), pod ním veľký názov.
function taskHead(box, o) {
  box.innerHTML = ''; box.classList.add('tk');
  box.appendChild(typeIcon(o.type));
  box.appendChild(el('span', {}, [el('small', { text: low(typeOne(o.type)) }), el('span', { class: 'nm', text: o.name })]));
}
// Názov v zozname: symbol (typ v bublinke pri podržaní), názov, prípadne poznámka.
function nameWithIcon(type, name, note) {
  return el('span', { class: 'iname', title: typeOne(type) }, [typeIcon(type), el('b', { text: name }), note ? el('span', { class: 'muted', text: ' · ' + note }) : null]);
}
function themeIcon(th) { return SVG_ICO + (THEME_ICONS[th] || THEME_ICONS.other) + '</svg>'; }
function layerSwatch(key) { return LAYER_SWATCH[key] ? SVG_SW + LAYER_SWATCH[key] + '</svg>' : ''; }
function themeLabel(th) { return has('theme.' + th) ? t('theme.' + th) : th; }
function sortTypes(types) {
  return types.slice().sort(function (a, b) {
    var i = TYPE_ORDER.indexOf(a), j = TYPE_ORDER.indexOf(b);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || typeLabel(a).localeCompare(typeLabel(b), I18N.lang);
  });
}
// Ponuka typov: jedna položka na tému, value = téma, type = jej typy oddelené medzerou. counts = {typ: počet objektov}.
function themeItems(counts) {
  var types = sortTypes(Object.keys(counts));
  return THEMES.map(function (th) {
    var mine = types.filter(function (x) { return themeOfType(x) === th; });
    if (!mine.length) return null;
    var n = mine.reduce(function (s, x) { return s + counts[x]; }, 0);
    return { value: th, label: (th === 'other' ? mine.map(typeLabel).join(', ') : themeLabel(th)) + ' (' + n + ')', type: mine.join(' '), icon: themeIcon(th) };
  }).filter(Boolean);
}
// Zoznam tém alebo typov (z odkazu, z pamäte) -> typy. Téma znamená všetky jej typy.
function expandTypes(list) {
  var out = [];
  (list || []).forEach(function (x) {
    if (THEMES.indexOf(x) >= 0) Object.keys(TYPE_THEME).forEach(function (ty) { if (TYPE_THEME[ty] === x) out.push(ty); });
    else out.push(x);
  });
  return uniq(out);
}
// Témy, ktoré sa majú zaškrtnúť podľa zapamätaných typov.
function themesOf(items, types) { return items.filter(function (it) { return it.type.split(' ').some(function (x) { return types.indexOf(x) >= 0; }); }).map(function (it) { return it.value; }); }
// Typy zo zaškrtnutých položiek (téma -> jej typy).
function checkedTypes(box) {
  var out = [];
  box.querySelectorAll('input:checked').forEach(function (i) { out = out.concat((i.getAttribute('data-type') || i.value).split(' ')); });
  return uniq(out);
}
// Výber oblasti: vždy práve jedna.
function regionSelect(sel, regions, current, onchange) {
  sel.innerHTML = '';
  regions.forEach(function (r) { sel.appendChild(el('option', { value: r.code, text: regionLabel(r.code, r.names) })); });
  var codes = regions.map(function (r) { return r.code; });
  sel.value = codes.indexOf(current) >= 0 ? current : codes[0] || '';
  sel.onchange = onchange || null;
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
  _idx: null, _json: {}, _raster: {}, _text: {}, _diff: {}, _reg: {}, warnings: [], statsUrl: '',

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
      Data._idx = Data.fetchJson('index.json?v=' + APP.version).then(function (j) {
        Data.statsUrl = /^https:\/\/script\.google\.com\//.test(j.stats || '') ? j.stats : '';   // anonymná štatistika precvičovania
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
  if (/okresy|district/.test(n)) return 'districts';
  if (/border|hranic|regions|kraje/.test(n)) return 'borders';
  if (/water|voda|vody|river|rieky|lake|jazer|sea|more|ocean|reservoir|nadrz/.test(n)) return 'water';
  if (/cities|mesta|obce|peaks|vrchy|saddles|sedla|caves|jaskyne|points|body/.test(n)) return 'dots';
  if (/mountain|pohori|lowland|nizin|kotlin|landform|celky/.test(n)) return 'landforms';
  if (/park|chranen|protect/.test(n)) return 'parks';
  return 'auto';
}
// Vrstvy na kreslenie. files = hodnoty z ponuky „Viditeľné vrstvy“ (súbor, alebo viac súborov oddelených |).
// Obrys územia a okolie sa kreslia vždy. Každý súbor najviac raz.
function sceneRefs(regions, codes, files) {
  var refs = [], seen = {}, want = {};
  (files || []).forEach(function (v) { String(v).split('|').forEach(function (f) { if (f) want[f] = 1; }); });
  var add = function (file, style) { if (!seen[file]) { seen[file] = 1; refs.push({ file: file, style: style }); } };
  codes.forEach(function (c) {
    var r = regions.filter(function (x) { return x.code === c; })[0]; if (!r) return;
    r.base.forEach(function (b) { var st = layerStyle(b.name, b.raster); if (st === 'land' || st === 'surroundings' || want[b.file]) add(b.file, st); });
    r.objects.forEach(function (o) { if (want[o.file]) add(o.file, layerStyle(o.type, false)); });
  });
  return refs;
}
/* ---------- ponuka vrstiev na mapu (aplikácia učiteľa aj precvičovanie) ---------- */
// Skupiny vrstiev v ponuke „Viditeľné vrstvy“ (v tomto poradí). Bodové vrstvy (vrchy, sedlá, jaskyne) sa neponúkajú.
var LAYER_GROUPS = [
  { key: 'landforms', types: ['mountains', 'lowlands'] }, { key: 'parks', types: ['parks'] }, { key: 'water', types: ['rivers', 'lakes', 'seas', 'oceans'] },
  { key: 'cities', types: ['cities'] }, { key: 'countries', types: ['countries'] }, { key: 'regions', types: ['regions'] }, { key: 'districts', types: ['districts'] }];
// Ponuka vrstiev: reliéf (predvolene zapnutý), ďalšie podkladové vrstvy okrem obrysu a okolia, potom skupiny súborov objektov.
// value = súbory oddelené |, type = typy objektov z týchto súborov (aj odvodené, napr. EČV pri okresoch).
function layerItems(regions, codes) {
  var items = [];
  codes.forEach(function (c) {
    var r = regions.filter(function (x) { return x.code === c; })[0]; if (!r) return;
    var pre = codes.length > 1 ? regionLabel(c, r.names) + ': ' : '';
    r.base.forEach(function (b) {
      var st = layerStyle(b.name, b.raster);
      if (st === 'land' || st === 'surroundings') return;
      items.push({ value: b.file, label: pre + (has('layer.' + b.name) ? t('layer.' + b.name) : b.name), def: st === 'raster', swatch: layerSwatch(st === 'raster' ? 'relief' : st === 'borders' ? 'regions' : st) });
    });
    LAYER_GROUPS.forEach(function (g) {
      var files = uniq(r.objects.filter(function (o) { return g.types.indexOf(o.type) >= 0; }).map(function (o) { return o.file; }));
      if (!files.length) return;
      var types = uniq(r.objects.filter(function (o) { return files.indexOf(o.file) >= 0; }).map(function (o) { return o.type; }));
      items.push({ value: files.join('|'), label: pre + t('layergroup.' + g.key), def: false, type: types.join(' '), swatch: layerSwatch(g.key) });
    });
  });
  return items;
}
// Je položka ponuky vrstiev zapnutá podľa zoznamu z odkazu? (hodnota celá, alebo niektorý jej súbor)
function layerInList(value, list) { var fs = String(value).split('|'); return list.some(function (f) { return f === value || fs.indexOf(f) >= 0; }); }
// Zaškrtávacie „čipy“.
function renderChips(box, items, checked, onchange) {
  box.innerHTML = '';
  items.forEach(function (it, i) {
    var id = box.id + '-' + i, inp = el('input', { type: 'checkbox', id: id, value: it.value, 'data-type': it.type });
    inp.checked = checked.indexOf(it.value) >= 0; inp.onchange = onchange || null;
    var pic = it.icon ? el('span', { class: 'ico', 'aria-hidden': 'true', html: it.icon }) : it.swatch ? el('span', { class: 'sw', 'aria-hidden': 'true', html: it.swatch }) : null;
    box.appendChild(el('label', { class: 'chip', for: id }, [inp, pic, el('span', { text: it.label })]));
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
