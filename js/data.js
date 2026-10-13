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
  desert: 'deserts', deserts: 'deserts', park: 'parks', parks: 'parks', protarea: 'parks', protectedarea: 'parks', protectedareas: 'parks',
  cave: 'caves', caves: 'caves', jaskyne: 'caves'
};
var Data = {
  _idx: null, _json: {}, _raster: {},

  fetchJson: function (file) {
    if (!Data._json[file]) {
      Data._json[file] = fetch(APP.dataUrl + file).then(function (r) {
        if (!r.ok) throw ApiError('data_missing', file);
        return r.json();
      }).catch(function (e) { delete Data._json[file]; throw e.code ? e : ApiError('data_missing', file); });
    }
    return Data._json[file];
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
          return {
            code: code, names: r.name, bbox: Array.isArray(r.bbox) && r.bbox.length === 4 ? r.bbox.map(Number) : null,
            objects: (r.objects || []).map(function (f) { return { file: f, type: Data.typeOf(Data.stem(f, code)) }; }),
            base: (r.base || []).map(function (f) { return { file: f, name: Data.stem(f, code), raster: Data.isRaster(f) }; })
          };
        });
      });
    }
    return Data._idx;
  },

  // Objekty jedného súboru: [{id, name, type, diff, g, bbox, regions}]
  objects: function (file, type, region) {
    return Data.fetchJson(file).then(function (fc) {
      var out = [];
      (fc.features || []).forEach(function (f) {
        var p = f.properties || {}, g = geomOf(f.geometry);
        if (!g || p.active === 0 || p.active === false || p.active === '0') return;
        var name = (I18N.lang !== 'sk' && p['name_' + I18N.lang]) || p.name || p.nazov || p.NAME || '';
        if (!name) return;
        var tp = type, d = p.difficulty !== undefined ? p.difficulty : p.Difficulty !== undefined ? p.Difficulty : p.level !== undefined ? p.level : p.Level !== undefined ? p.Level : p.obtiaznost;
        var diff = Math.max(1, Math.min(5, Math.round(+d) || 3));
        out.push({ id: String(p.id || tp + '-' + normName(name).replace(/ /g, '-')), name: String(name), type: tp, diff: diff, g: g, bbox: geomBBox(g), regions: [region] });
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
  if (/cities|mesta|obce|peaks|vrchy|caves|jaskyne|points|body/.test(n)) return 'dots';
  return 'auto';
}
