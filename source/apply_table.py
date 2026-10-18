#!/usr/bin/env python3
"""Slepá mapa: tabuľka obtiažností a názvov -> priečinok oblasti (data/<oblasť>).

Použitie:  python3 source/apply_table.py <xx_difficulty_edit.csv> data/<oblasť>

Tabuľka (class;id;name;difficulty;abbrev;subclass, oddeľovač ; alebo ,) je hlavný zdroj názvov.
Podľa `id` prepíše v GeoJSON súboroch oblasti:
  - `name` názvom z tabuľky (opravy názvov riek a pohorí z NAME_FIX platia aj tu),
  - pri okresoch `abbrev` (EČV), pri chránených územiach `subclass` (NP / CHKO, podľa neho sa kreslia na mape).
Zapíše <oblasť>/difficulty.csv s opravenými názvami; `subclass` pohorí podľa toho, či je celok
v mountains.json alebo lowlands.json. Geometriu nemení.

Spúšťa ho aj sk_upload.py. Samostatne stačí, keď sa zmenila len tabuľka (obtiažnosti, názvy).
"""
import csv
import json
import os
import sys

# trieda v tabuľke (class) -> typ v aplikácii (landform sa delí na mountains a lowlands)
CLASS_KIND = {
    'city': 'cities', 'river': 'rivers', 'water': 'lakes', 'peak': 'peaks', 'saddle': 'saddles', 'cave': 'caves',
    'protected': 'parks', 'region': 'regions', 'district': 'districts', 'country': 'countries', 'landform': 'landform',
}
# opravy názvov podľa typu (presná zhoda), platia pre názvy z FME aj z tabuľky
NAME_FIX = {
    'rivers': {'Danube': 'Dunaj', 'Латориця': 'Latorica', 'Tisza': 'Tisa'},
    'landform': {'Spišsko-šarišské medziho': 'Spišsko-šarišské medzihorie',
                 'Východoslovenská pahorkati': 'Východoslovenská pahorkatina'},
}
# pri týchto typoch sa z dvojjazyčného názvu „Ipeľ / Ipoly“ nechá prvá (slovenská) časť
FIRST_PART = {'rivers', 'landform'}
# ďalšie stĺpce tabuľky, ktoré sa podľa id zapíšu do GeoJSON (súbor -> stĺpce)
TABLE_PROPS = {'districts': ['abbrev'], 'parks': ['subclass']}


def fix_name(name, kind):
    name = ' '.join(str(name or '').split())
    name = NAME_FIX.get(kind, {}).get(name, name)
    if kind in FIRST_PART and ' / ' in name:
        name = name.split(' / ')[0].strip()
    return name


def read_table(path):
    """Riadky tabuľky a poradie stĺpcov."""
    raw = open(path, encoding='utf-8-sig').read()
    head = raw.split('\n', 1)[0]
    delim = ';' if head.count(';') >= head.count(',') else ','
    rows = list(csv.DictReader(raw.splitlines(), delimiter=delim))
    cols = list(rows[0].keys()) if rows else ['class', 'id', 'name', 'difficulty']
    return rows, cols


def table_names(rows):
    """{id: opravený názov z tabuľky}; prázdny názov v tabuľke sa ignoruje."""
    out = {}
    for r in rows:
        i, n = (r.get('id') or '').strip(), (r.get('name') or '').strip()
        if i and n:
            out[i] = fix_name(n, CLASS_KIND.get(r.get('class'), r.get('class')))
    return out


def write_fc(path, feats):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, ensure_ascii=False, separators=(',', ':'))


def apply(table, out):
    """Prenesie názvy (a TABLE_PROPS) z tabuľky do GeoJSON v priečinku out, zapíše out/difficulty.csv. Vráti hlásenie."""
    rows, cols = read_table(table)
    byid = {r['id'].strip(): r for r in rows if (r.get('id') or '').strip()}
    names = table_names(rows)
    report, where = [], {}
    for fn in sorted(os.listdir(out)):
        if not fn.endswith('.json') or fn.startswith('base_') or fn == 'index.json':
            continue
        stem, path = fn[:-5], os.path.join(out, fn)
        fc = json.load(open(path, encoding='utf-8'))
        changed = 0
        for f in fc.get('features', []):
            p = f.get('properties') or {}
            i = str(p.get('id', '')).strip()
            if not i:
                continue
            where.setdefault(i, stem)
            r = byid.get(i)
            if not r:
                continue
            if i in names and p.get('name') != names[i]:
                report.append('%s: %s -> %s' % (stem, p.get('name'), names[i]))
                p['name'] = names[i]
                changed += 1
            for k in TABLE_PROPS.get(stem, []):
                v = (r.get(k) or '').strip()
                if v and p.get(k) != v:
                    p[k] = v
                    changed += 1
            f['properties'] = p
        if changed:
            write_fc(path, fc.get('features', []))
            report.append('%s.json: %d zmien' % (stem, changed))
    for r in rows:
        i = (r.get('id') or '').strip()
        if i in names:
            r['name'] = names[i]
        if r.get('class') == 'landform' and 'subclass' in r and where.get(i) in ('mountains', 'lowlands'):
            r['subclass'] = 'highland' if where[i] == 'mountains' else 'lowland'
    missing = [i for i, r in byid.items() if i not in where and r.get('class') != 'country']
    if missing:
        report.append('v tabuľke, ale nie na mape (%d): %s' % (len(missing), ', '.join(missing[:10])))
    with open(os.path.join(out, 'difficulty.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=';', lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    report.append('difficulty.csv z %s: %d riadkov' % (os.path.basename(table), len(rows)))
    return report


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    print('\n'.join(apply(sys.argv[1], sys.argv[2])))
