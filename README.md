# Slepá mapa

Testovanie slepej mapy pre celú triedu. Žiaci naskenujú QR kód, na mobile ťukajú do mapy, kde leží zadané miesto, a aplikácia hodnotí odchýlku v kilometroch percentami. Keď učiteľ test uzavrie, každý žiak uvidí na svojej obrazovke mapu so svojimi tipmi a správnymi polohami.

- **Aplikácia** (táto stránka a mapy) beží na GitHub Pages: `https://samocief.github.io/slepamapa/`
- **Údaje triedy** (žiaci, testy, výsledky) má každý učiteľ vo svojej Google tabuľke. Malý skript v tabuľke je most medzi aplikáciou a tabuľkou. Aplikácia ani autor k týmto údajom nemajú prístup.

## Súbory

| Súbor | Čo to je |
|---|---|
| `index.html` | stránka žiaka (otvára sa z QR kódu) |
| `cvicenie.html` | precvičovanie pre kohokoľvek, bez tabuľky a bez mien |
| `ucitel.html` | stránka učiteľa |
| `js/`, `css/` | kód a vzhľad |
| `lang/sk.json` | všetky texty aplikácie; preklad = kópia súboru s iným kódom jazyka |
| `data/` | mapy a objekty na hádanie, popis v [DATA.md](DATA.md) |
| `source/objekty.xlsx` | hlavný zoznam objektov, z ktorého FME vyrába `data/` |
| `apps-script/Code.gs` | skript do tabuľky učiteľa |

Ukážkové dáta v `data/` sú z Natural Earth (verejná doména) a slúžia na vyskúšanie.

---

## 1. Zverejnenie aplikácie (raz, autor)

1. V **GitHub Desktop**: File → New repository, názov `slepamapa`, umiestnenie napr. `Dokumenty/GitHub`.
2. Do vzniknutého priečinka skopíruj obsah tohto balíka (súbory `index.html`, `ucitel.html` a priečinky `js`, `css`, `lang`, `data`, `source`, `apps-script`).
3. V GitHub Desktop napíš krátky popis zmeny, klikni **Commit to main** a potom **Publish repository**. Zruš zaškrtnutie „Keep this code private“ (GitHub Pages zadarmo funguje len pre verejný repozitár; údaje žiakov v ňom nie sú).
4. Na github.com otvor repozitár → **Settings → Pages** → Source: *Deploy from a branch*, Branch: *main*, priečinok */ (root)* → **Save**.
5. O minútu až dve je aplikácia na `https://samocief.github.io/slepamapa/`. Kontrola: `…/slepamapa/data/index.json` musí ukázať text.

Každá ďalšia zmena (nové dáta z FME, oprava textu) = **Commit** a **Push origin** v GitHub Desktop. Na stránke sa prejaví do pár minút.

## 2. Tabuľka učiteľa (každý učiteľ raz)

### Nová tabuľka

1. Vytvor Google tabuľku a v nej hárok **Žiaci** so stĺpcami **Trieda | Meno | Aktívny**. Meno píš ako „Priezvisko Meno“. Aktívny: prázdne alebo „áno“, „nie“ žiaka skryje. Žiakov aj triedy stačí vložiť zo svojho Excelu.
2. **Rozšírenia → Apps Script**. Obsah súboru `Code.gs` v editore zmaž a vlož tam celý `apps-script/Code.gs`. Ulož (ikona diskety).
3. **Nasadiť → Nové nasadenie** → ozubené koliesko → **Webová aplikácia**:
   - Spustiť ako: **Ja**
   - Kto má prístup: **Ktokoľvek** (žiaci sa neprihlasujú účtom Google)
   - **Nasadiť** a povoľ prístup. Google ukáže varovanie o neoverenej aplikácii: Rozšírené → Prejsť na… (nebezpečné). Skript pristupuje len k tejto tabuľke a k Disku (ukladanie obrázkov).
4. Obnov tabuľku. V ponuke **Slepá mapa → Otvoriť aplikáciu učiteľa**. Pri prvom otvorení sa skript môže opýtať na adresu webovej aplikácie: nájdeš ju v editore skriptu cez Nasadiť → Spravovať nasadenia (končí na `/exec`).
5. Otvorí sa okno s odkazom a QR kódom. Na počítači klikni na odkaz, na telefóne naskenuj kód. Aplikácia si tabuľku zapamätá, nabudúce stačí otvoriť `https://samocief.github.io/slepamapa/ucitel.html`.

Odkaz aj QR kód z tohto okna sú kľúčom k tabuľke. Žiakom ich neukazuj.

### Prechod zo starej verzie (šablóna „Slepá mapa – šablóna“)

1. V editore skriptu nahraď obsah `Code.gs` novým a súbor `App.html` zmaž (už ho netreba).
2. **Nasadiť → Spravovať nasadenia** → ceruzka → Verzia: **Nová verzia** → Nasadiť. Adresa ostane rovnaká.
3. Hárky Nastavenia, Objekty, Sedenie, staré Výsledky a `_balíky` môžeš zmazať. Starý hárok Testy sa sám premenuje na „Testy (verzia 1)“. Stĺpec Skupina v hárku Žiaci sa ignoruje.

### Vlastné objekty

Hárok **Vlastné objekty** (vytvorí sa sám): Názov | Typ | Oblasť | Obťažnosť | Súradnice. Súradnice skopíruj z Google Máp (pravé tlačidlo na mieste, napr. `48.7297, 19.1498`). Typ môže byť „mesto“, „vrch“, „rieka“… alebo čokoľvek iné, Oblasť kód (`sk`) alebo názov (Slovensko). Tieto objekty sa v aplikácii ponúkajú spolu s katalógom, ale vidíš ich len ty.

### Zdieľanie s inými učiteľmi

Učiteľ si urobí kópiu tvojej prázdnej tabuľky (Súbor → Vytvoriť kópiu; skript sa skopíruje s ňou) a urobí kroky 3 až 5. Aplikácia aj mapy sú spoločné, každý má svoju triedu u seba.

---

## 3. Test v triede

1. **Nový test:** trieda, oblasť, typy objektov, obťažnosť, počet, čas na tip.
2. **Výber objektov:**
   - **Auto** namieša objekty podľa filtrov (vyvážene podľa obťažnosti a typov). Kockou pri objekte ho vymeníš za iný, najradšej rovnakého typu a obťažnosti; písaním do políčka si ho vyberieš sám.
   - **Manuál** začne s prázdnymi políčkami. Píš názov (diakritika ani veľké písmená nevadia) a vyber z ponuky, ktorá obsahuje len objekty vyhovujúce filtrom.
3. **Mapa a hodnotenie:** čo bude na mape (obrys, okolie, hranice, reliéf, prípadne všetky rieky…) a hranice percent v % uhlopriečky mapy. Náhľad ukazuje vybrané objekty.
4. **Spustiť test** → QR kód. Žiaci vyberú svoje meno, test sa zamkne na ich zariadenie.
5. Počas testu žiak po každom tipe vidí len odchýlku v km a percentá, nie správnu polohu. Odchod z aplikácie: prvýkrát 0 % za dané miesto, druhýkrát koniec testu.
6. V **Prehľade** vidíš, kto píše a kto odovzdal. **Uzavrieť test a ukázať výsledky:** všetkým žiakom sa zobrazí ich mapa s tipmi a správnymi polohami.
7. **Tipy triedy:** tipy celej triedy pri každom objekte, medián a návrh obťažnosti. **Hodnotenie a obrázky:** zmena hraníc percent (prepočíta sa aj tabuľka), obrázky žiakov na stiahnutie alebo uloženie na Disk.

Výsledky sú v tabuľke v hárku „Výsledky <id testu>“: percentá, odchýlky v km pri každom objekte a príznaky (odchod z testu, pokus o prihlásenie z iného zariadenia).

## 4. Precvičovanie

`https://samocief.github.io/slepamapa/cvicenie.html` môže otvoriť ktokoľvek. Vyberie si oblasť, typy objektov, obťažnosť, počet a čas na tip (predvolene 20 s, dá sa aj bez limitu). Po každom tipe hneď vidí správnu polohu, na konci mapu so všetkými tipmi a môže si zopakovať objekty, ktoré mu nešli (pod 70 %). Nič sa neukladá a tabuľka učiteľa sa nepoužíva.

V aplikácii učiteľa tlačidlo **Odkaz na precvičovanie** vytvorí odkaz a QR kód s nastavením z formulára, napríklad ako prípravu na test. Filtre sa dajú zadať aj priamo v adrese: `cvicenie.html?r=sk&t=rivers,mountains&d=1-3&n=10&s=20` (oblasť, typy, obťažnosť od-do, počet, sekundy na tip, 0 = bez limitu).

