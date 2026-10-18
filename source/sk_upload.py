#!/usr/bin/env python3
"""Slepá mapa: príprava dát Slovenska z výstupu FME do priečinka data/sk.

Použitie:  python3 source/sk_upload.py <priečinok s výstupom FME> [data/sk]

Vstup (názvy súborov z FME):
  city, river, water, peak, saddle, cave, protected, region, district, landform, country .json
  hillshade.png + hillshade.wld
  sk_difficulty_edit.csv (alebo sk_difficulty.csv)  tabuľka obtiažností a názvov: class;id;name;difficulty;abbrev;subclass

Výstup:
  cities, rivers, lakes, mountains, lowlands, peaks, saddles, caves, parks, regions, districts .json
  base_land.json (obrys SR z country.json), base_borders.json (hranice krajov vnútri SR, potrebuje shapely),
  base_relief.png + base_relief.pgw, difficulty.csv

Čo sa pri tom opraví:
  - názvy sa berú z tabuľky podľa id (kde je v tabuľke vyplnený), inak z FME (pozri apply_table.py)
  - názvy riek: cudzie a dvojjazyčné tvary na slovenské (Danube -> Dunaj, Ipeľ / Ipoly -> Ipeľ ...)
  - orezané názvy pohorí, zaradenie Východoslovenskej pahorkatiny a Dolnomoravského úvalu do nížin
  - geometria: MultiPoint -> Point, GeometryCollection -> Multi..., vypustia sa pomocné atribúty
  - v GeoJSON ostáva len id, name (abbrev pri okresoch, subclass NP/CHKO pri chránených územiach); obtiažnosť je v difficulty.csv
Názvy vrchov a sediel (aj dvojjazyčné) a nádrží sa nemenia.
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apply_table import apply as apply_table, fix_name, read_table, table_names, write_fc  # noqa: E402

# súbor z FME -> typ v aplikácii
LAYERS = {
    'city': 'cities', 'river': 'rivers', 'water': 'lakes', 'peak': 'peaks', 'saddle': 'saddles',
    'cave': 'caves', 'protected': 'parks', 'region': 'regions', 'district': 'districts',
}
# landform sa delí podľa subclass
LANDFORM = {'highland': 'mountains', 'lowland': 'lowlands'}
# pohoria, ktoré FME zaradilo do highland, hoci sú to nížiny
TO_LOWLAND = {'Východoslovenská pahorkatina', 'Dolnomoravský úval'}

# atribúty, ktoré ostanú v GeoJSON (ďalšie doplní z tabuľky apply_table.py)
KEEP = {'districts': ['id', 'name', 'abbrev']}
TABLES = ('sk_difficulty_edit.csv', 'sk_difficulty.csv', 'difficulty.csv')


def flat(g):
    """GeoJSON geometria bez GeometryCollection; MultiPoint -> Point (prvý bod)."""
    if not g:
        return None
    t = g['type']
    if t == 'GeometryCollection':
        polys, lines, pts = [], [], []
        for x in g.get('geometries') or []:
            x = flat(x)
            if not x:
                continue
            if x['type'] == 'Polygon':
                polys.append(x['coordinates'])
            elif x['type'] == 'MultiPolygon':
                polys += x['coordinates']
            elif x['type'] == 'LineString':
                lines.append(x['coordinates'])
            elif x['type'] == 'MultiLineString':
                lines += x['coordinates']
            elif x['type'] == 'Point':
                pts.append(x['coordinates'])
        if polys:
            return {'type': 'MultiPolygon', 'coordinates': polys} if len(polys) > 1 else {'type': 'Polygon', 'coordinates': polys[0]}
        if lines:
            return {'type': 'MultiLineString', 'coordinates': lines} if len(lines) > 1 else {'type': 'LineString', 'coordinates': lines[0]}
        if pts:
            return {'type': 'Point', 'coordinates': pts[0]}
        return None
    if t == 'MultiPoint':
        return {'type': 'Point', 'coordinates': g['coordinates'][0][:2]} if g['coordinates'] else None
    if t == 'MultiPolygon' and len(g['coordinates']) == 1:
        return {'type': 'Polygon', 'coordinates': g['coordinates'][0]}
    if t == 'MultiLineString' and len(g['coordinates']) == 1:
        return {'type': 'LineString', 'coordinates': g['coordinates'][0]}
    return {'type': t, 'coordinates': g['coordinates']}


def feature(p, g, kind):
    props = {k: p[k] for k in KEEP.get(kind, ['id', 'name']) if p.get(k) not in (None, '')}
    return {'type': 'Feature', 'properties': props, 'geometry': g}


def polys_of(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    if g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [p for x in g.geoms for p in polys_of(x)]
    return []


def rings(p):
    r = lambda ring: [[round(x, 4), round(y, 4)] for x, y in ring.coords]
    return [r(p.exterior)] + [r(i) for i in p.interiors]


def clip_relief(out, land):
    """Priehľadnosť reliéfu mimo obrysu SR (s rezervou pol pixela), aby okraj sedel s čiarou hranice."""
    from PIL import Image, ImageDraw
    png, wld = os.path.join(out, 'base_relief.png'), os.path.join(out, 'base_relief.pgw')
    if not (os.path.exists(png) and os.path.exists(wld)):
        return []
    A, _, _, E, X, Y = [float(x) for x in open(wld).read().split()[:6]]
    im = Image.open(png)
    im.load()
    mode = im.mode
    im = im.convert('LA') if mode in ('L', 'LA', 'P') else im.convert('RGBA')
    W, H = im.size
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    px = lambda c: ((c[0] - X) / A + 0.5, (c[1] - Y) / E + 0.5)
    for p in polys_of(land.buffer(abs(A) * 0.5)):
        d.polygon([px(c) for c in p.exterior.coords], fill=255)
        for i in p.interiors:
            d.polygon([px(c) for c in i.coords], fill=0)
    from PIL import ImageChops
    alpha = ImageChops.multiply(im.getchannel('A'), mask)
    im.putalpha(alpha)
    im.save(png, optimize=True)
    return ['base_relief.png orezaný podľa obrysu SR (%d kB)' % (os.path.getsize(png) // 1024)]


def fit_surroundings(out, land, grow=0.05):
    """Susedné štáty (base_surroundings.json) dorastú k novému obrysu SR a neprekrývajú ho."""
    from shapely.geometry import shape
    from shapely.validation import make_valid
    from shapely.ops import unary_union
    path = os.path.join(out, 'base_surroundings.json')
    if not os.path.exists(path):
        return []
    fc = json.load(open(path, encoding='utf-8'))
    ring = land.buffer(grow).difference(land)
    done, feats = None, []
    for f in fc['features']:
        n = make_valid(shape(f['geometry']))
        n = unary_union([n, n.buffer(grow).intersection(ring)]).difference(land)
        if done is not None:
            n = n.difference(done)
        done = n if done is None else unary_union([done, n])
        ps = [p for p in polys_of(n) if p.area > 1e-6]
        if not ps:
            continue
        geom = {'type': 'Polygon', 'coordinates': rings(ps[0])} if len(ps) == 1 else {'type': 'MultiPolygon', 'coordinates': [rings(p) for p in ps]}
        feats.append({'type': 'Feature', 'properties': f.get('properties') or {}, 'geometry': geom})
    write_fc(path, feats)
    return ['base_surroundings.json prispôsobený obrysu SR (%d kB)' % (os.path.getsize(path) // 1024)]


def main(src, out):
    os.makedirs(out, exist_ok=True)
    report = []
    table = next((os.path.join(src, n) for n in TABLES if os.path.exists(os.path.join(src, n))), None)
    names = table_names(read_table(table)[0]) if table else {}
    for fme, kind in list(LAYERS.items()) + [('landform', None)]:
        path = os.path.join(src, fme + '.json')
        if not os.path.exists(path):
            report.append('chýba ' + fme + '.json')
            continue
        fc = json.load(open(path, encoding='utf-8'))
        groups, seen = {}, set()
        for f in fc.get('features', []):
            p = dict(f.get('properties') or {})
            g = flat(f.get('geometry'))
            if not g or not p.get('id') or not p.get('name'):
                report.append('%s: vynechaný objekt bez id, názvu alebo geometrie (%s)' % (fme, p.get('id') or p.get('name')))
                continue
            if p['id'] in seen:
                report.append('%s: dvojité id %s, druhý výskyt vynechaný' % (fme, p['id']))
                continue
            seen.add(p['id'])
            old = p['name']
            p['name'] = names.get(str(p['id'])) or fix_name(old, kind or 'landform')
            if p['name'] != old:
                report.append('%s: %s -> %s' % (fme, old, p['name']))
            k = kind
            if fme == 'landform':
                sub = 'lowland' if p['name'] in TO_LOWLAND else p.get('subclass')
                if sub != p.get('subclass'):
                    report.append('landform: %s preradené do nížin' % p['name'])
                k = LANDFORM.get(sub, 'mountains')
            groups.setdefault(k, []).append(feature(p, g, k))
        for k, feats in groups.items():
            write_fc(os.path.join(out, k + '.json'), feats)
            report.append('%s.json: %d objektov' % (k, len(feats)))

    # obrys územia
    cpath = os.path.join(src, 'country.json')
    if os.path.exists(cpath):
        fc = json.load(open(cpath, encoding='utf-8'))
        write_fc(os.path.join(out, 'base_land.json'), [{'type': 'Feature', 'properties': {}, 'geometry': flat(f['geometry'])} for f in fc['features']])
        report.append('base_land.json z country.json')

    # vnútorné hranice krajov
    rpath = os.path.join(src, 'region.json')
    try:
        from shapely.geometry import shape, mapping
        from shapely.ops import unary_union, linemerge
        from shapely.validation import make_valid
        regs = [make_valid(shape(flat(f['geometry']))) for f in json.load(open(rpath, encoding='utf-8'))['features']]
        land = unary_union(regs)
        inner = unary_union([r.boundary for r in regs]).difference(land.boundary.buffer(0.003))
        inner = linemerge(inner) if inner.geom_type != 'LineString' else inner
        geom = mapping(inner)
        lines = [geom['coordinates']] if geom['type'] == 'LineString' else list(geom['coordinates'])
        lines = [[[round(x, 4), round(y, 4)] for x, y in l] for l in lines if len(l) > 1]
        write_fc(os.path.join(out, 'base_borders.json'), [{'type': 'Feature', 'properties': {}, 'geometry': {'type': 'MultiLineString', 'coordinates': lines}}])
        report.append('base_borders.json: %d čiar hraníc krajov' % len(lines))
    except ImportError:
        report.append('base_borders.json nezmenený (chýba knižnica shapely)')
    except FileNotFoundError:
        pass
    except Exception as e:  # neplatná geometria a pod.: hranice ostanú staré
        report.append('base_borders.json nezmenený (%s)' % e)

    # reliéf
    for ext, oext in (('png', 'png'), ('wld', 'pgw')):
        p = os.path.join(src, 'hillshade.' + ext)
        if os.path.exists(p):
            shutil.copyfile(p, os.path.join(out, 'base_relief.' + oext))
    if os.path.exists(os.path.join(src, 'hillshade.png')):
        report.append('base_relief.png + .pgw z hillshade')

    # reliéf orezaný presne podľa obrysu SR a susedné štáty prispôsobené novému obrysu (bez presahov a medzier)
    try:
        from shapely.geometry import shape
        from shapely.validation import make_valid
        land = make_valid(shape(json.load(open(os.path.join(out, 'base_land.json'), encoding='utf-8'))['features'][0]['geometry']))
        report += clip_relief(out, land)
        report += fit_surroundings(out, land)
    except ImportError:
        report.append('reliéf a okolie nezmenené (chýba knižnica shapely alebo Pillow)')
    except Exception as e:
        report.append('reliéf a okolie nezmenené (%s)' % e)

    # tabuľka obtiažností a názvov (názvy, EČV, NP/CHKO do GeoJSON podľa id; difficulty.csv)
    if table:
        report += apply_table(table, out)
    print('\n'.join(report))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'data', 'sk'))
