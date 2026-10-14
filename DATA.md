# Dáta pre Slepú mapu

Všetko, čo je na mape a čo sa dá hádať, leží v priečinku `data/` tohto repozitára. Aplikácia si súbory sťahuje priamo z GitHubu, takže každá oprava sa po nahratí dostane ku všetkým učiteľom.

Testy, ktoré už bežali, sa zmenou dát nepokazia: pri spustení testu sa vybrané objekty aj s polohou uložia do tabuľky učiteľa a hodnotí sa podľa nich.

## Priečinky

```
data/
  index.json              zoznam oblastí a ich súborov (jediný súbor, ktorý aplikácia hľadá sama)
  sk/                     Slovensko
    cities.json           objekty na hádanie, jeden súbor na typ
    rivers.json
    ...
    base_land.json        podkladové vrstvy, len sa kreslia
    base_relief.jpg       raster
    base_relief.jgw       world file k rastru
  eu/                     Európa
  ...
source/
  objekty.xlsx            hlavný zoznam objektov (upravuješ ručne)
  objekty.fmw             FME workspace, ktorý z neho vyrobí súbory v data/
```

Kódy oblastí sú ľubovoľné, aplikácia ich berie z `index.json`. Pre tieto kódy má pripravené názvy: `sk` Slovensko, `eu` Európa, `as` Ázia, `af` Afrika, `na` Severná Amerika, `sa` Južná Amerika, `au` Austrália a Oceánia, `an` Antarktída, `world` Svet, `ao` Atlantický oceán, `po` Tichý oceán, `io` Indický oceán, `ar` Severný ľadový oceán. Iný kód sa zobrazí veľkými písmenami, kým preň nepribudne názov v `lang/sk.json` (sekcia `region`).

Predpona oblasti v názve súboru je voliteľná: `sk/rivers.json` aj `sk/sk_rivers.json` znamenajú typ `rivers`.

## index.json

Píše sa ručne (alebo ho zapíše FME) a mení sa, len keď pribudne alebo zmizne súbor.

```json
{
  "regions": [
    {
      "code": "sk",
      "bbox": [16.75, 47.65, 22.65, 49.7],
      "objects": ["sk/regions.json", "sk/cities.json", "sk/rivers.json", "sk/peaks.json"],
      "base": ["sk/base_relief.jpg", "sk/base_land.json", "sk/base_surroundings.json", "sk/base_borders.json"]
    }
  ]
}
```

- `regions`: poradie je poradie tlačidiel v aplikácii.
- `bbox`: výrez mapy `[západ, juh, východ, sever]` v stupňoch. Nepovinný, bez neho sa výrez určí z objektov. Odporúčam ho vyplniť, mapa je potom vždy rovnaká.
- `objects`: súbory s objektmi na hádanie.
- `base`: podkladové vrstvy. Učiteľ si pri teste vyberá, ktoré budú na mape (predvolene všetky).
- Nepovinne `"name": {"sk": "Slovensko", "en": "Slovakia"}`, ak chceš oblasť pomenovať inak, než je v jazykovom súbore.

## Objekty na hádanie

Jeden súbor GeoJSON (FeatureCollection) na oblasť a typ, súradnice v **EPSG:4326** (zemepisná dĺžka, šírka).

```json
{"type": "FeatureCollection", "features": [
  {"type": "Feature",
   "properties": {"id": "rivers-hron", "name": "Hron", "difficulty": 1},
   "geometry": {"type": "LineString", "coordinates": [[19.89, 48.89], [19.85, 48.88]]}}
]}
```

| Atribút | Povinný | Význam |
|---|---|---|
| `id` | odporúčaný | Jedinečný a stály identifikátor v celom katalógu, napr. `rivers-hron`. Rovnaký objekt vo viacerých oblastiach (Dunaj v `sk` aj `eu`) má v oboch súboroch rovnaké `id`, aplikácia ho potom započíta raz. Bez `id` si ho aplikácia vytvorí z typu a názvu. |
| `name` | áno | Názov, ktorý žiak hľadá (slovensky). |
| `difficulty` | áno | Obtiažnosť 1 až 5 (aplikácia prijme aj názov `Level`). |
| `name_en`, `name_de` … | nie | Preklady názvu na neskôr. |
| `active` | nie | `0` objekt skryje (inak sa vynecháva už vo FME). |

Geometria môže byť bod, línia alebo plocha (aj Multi…). Odchýlka sa meria k najbližšiemu bodu objektu; tip vnútri plochy má odchýlku 0 km. Pri bode stačí bod, pri rieke línia, pri pohorí, kraji alebo jazere plocha.

### Typy objektov

Typ je názov súboru. Aplikácia má pre tieto typy slovenské názvy v jednotnom aj množnom čísle; iný typ funguje tiež, len sa zobrazí tak, ako je napísaný. Rozumie aj bežným iným názvom súborov, napr. `River`, `Town`, `Lake`, `Mountain`, `Lowland`, `ProtArea`, `Kraje`, `Okresy`.

| Typ | V aplikácii | Typ | V aplikácii |
|---|---|---|---|
| `countries` | štáty | `peaks` | vrchy |
| `regions` | kraje a regióny | `lowlands` | nížiny a kotliny |
| `districts` | okresy | | |
| `cities` | mestá | `islands` | ostrovy |
| `rivers` | rieky | `peninsulas` | polostrovy |
| `lakes` | jazerá a vodné nádrže | `deserts` | púšte |
| `seas` | moria a zálivy | `parks` | chránené územia |
| `oceans` | oceány | `caves` | jaskyne |
| `mountains` | pohoria | `other` | iné |

Každý súbor objektov si učiteľ môže dať aj na mapu (napr. „všetky rieky“). Vodstvo sa kreslí modrou, mestá a vrchy ako bodky, štáty a kraje ako hranice, ostatné jemnou hnedou čiarou.

## objekty.xlsx

Hlavný zoznam, ktorý upravuješ ručne. Jeden riadok = jeden objekt, aj keď patrí do viacerých oblastí.

| Stĺpec | Význam |
|---|---|
| `id` | Jedinečný a stály, odporúčam `<typ>-<názov bez diakritiky>`, napr. `cities-banska-bystrica`. Po prvom použití v teste ho už nemeň. |
| `name` | Názov pre žiakov. |
| `type` | Kód typu z tabuľky vyššie. |
| `regions` | Kódy oblastí oddelené bodkočiarkou, napr. `sk;eu`. |
| `difficulty` | 1 až 5. |
| `active` | 1 = v aplikácii, 0 = vynechať. |
| `layer_name` | Názov objektu vo zdrojovej vrstve, ak je iný než `name` (napr. `Danube` pre Dunaj). Prázdne = rovnaký ako `name`. |
| `lat`, `lon` | Súradnice bodu, ak objekt vo vrstvách nie je (napr. menšie mesto). |
| `note` | Tvoja poznámka, aplikácia ju ignoruje. |

Ukážkový `source/objekty.xlsx` so všetkými stĺpcami je v repozitári. Hárok Typy v ňom je len prehľad kódov.

Štatistiky z testov dostaneš v aplikácii učiteľa: test → Tipy triedy → **Kopírovať štatistiky pre Excel**. Skopíruje sa tabuľka `id, názov, tipov, medián, priemer, návrh obtiažnosti`, ktorú vložíš vedľa svojho zoznamu a podľa `id` prenesieš obtiažnosť.

## Postup vo FME

1. **Čítanie:** Excel reader na `objekty.xlsx`, filter `active = 1`.
2. **Geometria:** FeatureMerger podľa `type` a názvu (`layer_name`, ak je vyplnený, inak `name`) so zdrojovými vrstvami. Nespárované riadky s `lat`/`lon` dostanú bod (VertexCreator). Ostatné nespárované a duplicitné zhody zapíš do `source/chyby.csv`, nech ich opravíš skôr, než sa dostanú k žiakom.
3. **Úprava:** Reprojector na EPSG:4326, Generalizer podľa mierky oblasti (pre Slovensko zhruba 50 až 100 m, pre svetadiel 1 až 2 km), CoordinateRounder na 4 desatinné miesta. Atribúty nechaj len `id`, `name`, `difficulty` (a preklady).
4. **Oblasti:** AttributeSplitter na `regions` podľa `;`, ListExploder (objekt vo viacerých oblastiach sa zapíše do každej).
5. **Zápis:** GeoJSON writer s fanoutom do `data/<oblasť>/<typ>.json`. Ak chceš, objekt pred zápisom orež na rozsah oblasti (Clipper), rovnaké `id` ostane.

Súbor má byť malý: GitHub ho pri posielaní komprimuje, ale žiaci ho sťahujú cez školskú wifi. Orientačne do 1 MB na súbor; pri objektoch, ktoré sa len hádajú, stačí jednoduchší tvar než pri podkladových vrstvách.

## Podkladové vrstvy

Kreslia sa pod objekty, nedajú sa hádať. Štýl vyberá aplikácia podľa názvu vrstvy (časť za `base_`):

| Názov | Kreslí sa ako |
|---|---|
| `land` (alebo `outline`) | hlavné územie: svetlá výplň, výrazná hranica |
| `surroundings` | okolité územie (susedné štáty): tlmenejšia výplň, tenká hranica |
| `borders` | vnútorné hranice (kraje, štáty): tenké sivé čiary |
| `water` | vodstvo: modré čiary a plochy |
| raster (`.jpg`, `.png`, `.webp`) | obrázok pod všetkým ostatným |
| iný názov | podľa geometrie, neutrálne |

Keď je na mape raster, hlavné územie sa kreslí bez výplne, aby reliéf nebol zakrytý.

### Rastre

- Formát **JPG** (reliéf, batymetria, všetko nepriehľadné), **PNG** (keď treba priehľadnosť) alebo **WebP**.
- Súradnice **EPSG:4326**, k obrázku **world file** s rovnakým menom: `base_relief.jpg` + `base_relief.jgw`, `.png` + `.pgw`, alebo `.wld`. Vo FME stačí v PNG/JPEG writeri zapnúť generovanie world file.
- Šírka do zhruba 3000 px.
- Pre malé územie (Slovensko) sa raster kreslí priamo. Pre svetadiel ho aplikácia raz pri načítaní prepočíta do projekcie mapy.

## Projekcia mapy

Vyberá sa sama podľa výrezu: malé územie valcová so stredovou rovnobežkou, svetadiel azimutálna rovnakoplochá (LAEA), celý svet Equal Earth. Vzdialenosti sa vždy počítajú na guli, projekcia ich neovplyvňuje.

## Kontrola po nahratí

1. Otvor `https://samocief.github.io/slepamapa/data/index.json`, musí sa zobraziť text.
2. V aplikácii učiteľa vyber oblasť: pri typoch objektov sa ukážu počty.
3. Ak sa niektorá vrstva nenačíta, aplikácia napíše jej názov nad formulárom.
