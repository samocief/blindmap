#!/usr/bin/env python3
"""Slepá mapa: miniatúry oblastí (obrys) pre výber oblasti.

Použitie:  python3 source/thumbs.py [data]

Pre každú oblasť v data/index.json zoberie jej podklad base_land.json, spojí ho do jedného obrysu,
zjednoduší a zapíše ako cestu SVG (viewBox 0 0 64 48) do položky "thumb" v index.json.
Zvyšok index.json sa nemení (riadok "thumb" sa vloží alebo nahradí hneď za riadkom "code").
Spusti po pridaní novej oblasti alebo po zmene jej obrysu. Potrebuje shapely (pip install shapely).
"""
import json
import math
import os
import re
import sys

from shapely.geometry import shape
from shapely.ops import unary_union

W, H, PAD = 64, 48, 2


def thumb(land_path, bbox):
    d = json.load(open(land_path, encoding='utf-8'))
    g = unary_union([shape(f['geometry']) for f in d['features'] if f.get('geometry')])
    minx, miny, maxx, maxy = g.bounds
    lat = (bbox[1] + bbox[3]) / 2 if bbox else (miny + maxy) / 2
    k = math.cos(math.radians(lat))           # jednoduchá projekcia: dĺžky skrátené podľa šírky
    w, h = (maxx - minx) * k, maxy - miny
    s = min((W - 2 * PAD) / w, (H - 2 * PAD) / h)
    ox, oy = (W - w * s) / 2, (H - h * s) / 2
    g = g.simplify(1.0 / s)                    # asi 1 px na miniatúre
    parts = []
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty or p.area * k * s * s < 3:   # drobné ostrovy by boli len šum
            continue
        pts = list(p.exterior.coords)[:-1]
        parts.append('M' + 'L'.join('%.1f %.1f' % (ox + (x - minx) * k * s, oy + (maxy - y) * s) for x, y in pts) + 'Z')
    return ''.join(parts)


def main(data):
    path = os.path.join(data, 'index.json')
    txt = open(path, encoding='utf-8').read()
    idx = json.loads(txt)
    for r in idx['regions']:
        code = r['code']
        land = next((f for f in r.get('base', []) if re.search(r'(^|/)base_land\.json$', f)), None)
        if not land:
            print(code, ': bez base_land.json, miniatúra sa nerobí'); continue
        t = thumb(os.path.join(data, land), r.get('bbox'))
        m = re.search(r'^([ \t]*)"code":\s*"' + re.escape(code) + r'",[ \t]*\n(?:[ \t]*"thumb":\s*"[^"]*",[ \t]*\n)?', txt, re.M)
        if not m:
            print(code, ': v index.json chýba riadok "code"'); continue
        txt = txt[:m.start()] + m.group(1) + '"code": "' + code + '",\n' + m.group(1) + '"thumb": "' + t + '",\n' + txt[m.end():]
        print(code, ':', len(t), 'znakov')
    json.loads(txt)  # kontrola, že index.json ostal platný
    open(path, 'w', encoding='utf-8').write(txt)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data')
