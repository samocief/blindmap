# Slepá mapa

Testovanie slepej mapy pre celú triedu. Žiaci naskenujú QR kód, na mobile ťukajú do mapy, kde leží zadané miesto, a aplikácia hodnotí odchýlku v kilometroch percentami. Keď učiteľ test uzavrie, každý žiak uvidí na svojej obrazovke mapu so svojimi tipmi a správnymi polohami.

- **Aplikácia** (táto stránka a mapy) beží na GitHub Pages: `https://samocief.github.io/blindmap/`
- **Údaje triedy** (žiaci, testy, výsledky) má každý učiteľ vo svojej Google tabuľke. Malý skript v tabuľke je most medzi aplikáciou a tabuľkou. Aplikácia ani autor k týmto údajom nemajú prístup.

## Súbory

| Súbor | Čo to je |
|---|---|
| `index.html` | precvičovanie pre kohokoľvek, bez tabuľky a bez mien (úvodná adresa aplikácie) |
| `test.html` | stránka žiaka pri teste (otvára sa z QR kódu; odkaz `?s=…&t=…` na úvodnej adrese sem presmeruje) |
| `ucitel.html` | stránka učiteľa |
| `js/`, `css/` | kód a vzhľad |
| `lang/sk.json` | všetky texty aplikácie; preklad = kópia súboru s iným kódom jazyka |
| `data/` | mapy a objekty na hádanie, popis v [DATA.md](DATA.md) |
| `source/objekty.xlsx` | hlavný zoznam objektov, z ktorého FME vyrába `data/` |
| `apps-script/Code.gs` | skript do tabuľky učiteľa |
| `CHANGELOG.md` | [zoznam zmien](CHANGELOG.md) po verziách |

Ukážkové dáta v `data/` sú z Natural Earth (verejná doména) a slúžia na vyskúšanie.

---

## 1. Zverejnenie aplikácie (raz, autor)

1. V **GitHub Desktop**: File → New repository, názov `blindmap`, umiestnenie napr. `Dokumenty/GitHub`.
2. Do vzniknutého priečinka skopíruj obsah tohto balíka (súbory `index.html`, `test.html`, `ucitel.html` a priečinky `js`, `css`, `lang`, `data`, `source`, `apps-script`).
3. V GitHub Desktop napíš krátky popis zmeny, klikni **Commit to main** a potom **Publish repository**. Zruš zaškrtnutie „Keep this code private“ (GitHub Pages zadarmo funguje len pre verejný repozitár; údaje žiakov v ňom nie sú).
4. Na github.com otvor repozitár → **Settings → Pages** → Source: *Deploy from a branch*, Branch: *main*, priečinok */ (root)* → **Save**.
5. O minútu až dve je aplikácia na `https://samocief.github.io/blindmap/`. Kontrola: `…/blindmap/data/index.json` musí ukázať text.

Každá ďalšia zmena (nové dáta z FME, oprava textu) = **Commit** a **Push origin** v GitHub Desktop. Na stránke sa prejaví do pár minút.

## 2. Tabuľka učiteľa (každý učiteľ raz)

### Nová tabuľka

1. Vytvor Google tabuľku a v nej hárok **Žiaci** so stĺpcami **Trieda | Meno | Skupina | Aktívny**. Meno píš ako „Priezvisko Meno“. Skupina: „A“ alebo „B“, prázdna = trieda píše bez skupín (pozri nižšie). Aktívny: prázdne alebo „áno“, „nie“ žiaka skryje. Žiakov aj triedy stačí vložiť zo svojho Excelu.
2. **Rozšírenia → Apps Script**. Obsah súboru `Code.gs` v editore zmaž a vlož tam celý `apps-script/Code.gs`. Ulož (ikona diskety).
3. **Nasadiť → Nové nasadenie** → ozubené koliesko → **Webová aplikácia**:
   - Spustiť ako: **Ja**
   - Kto má prístup: **Ktokoľvek** (žiaci sa neprihlasujú účtom Google)
   - **Nasadiť** a povoľ prístup. Google ukáže varovanie o neoverenej aplikácii: Rozšírené → Prejsť na… (nebezpečné). Skript pristupuje len k tejto tabuľke a k Disku (ukladanie obrázkov).
4. Obnov tabuľku. V ponuke **Slepá mapa → Otvoriť aplikáciu učiteľa**. Pri prvom otvorení sa skript môže opýtať na adresu webovej aplikácie: nájdeš ju v editore skriptu cez Nasadiť → Spravovať nasadenia (končí na `/exec`).
5. Otvorí sa okno s odkazom. Na počítači klikni na odkaz. Na telefóne klikni na **QR kód pre telefón** a naskenuj ho (kód je skrytý pod tlačidlom, aby ho žiaci nenaskenovali z projektora). Aplikácia si tabuľku zapamätá, nabudúce stačí otvoriť `https://samocief.github.io/blindmap/ucitel.html`.

Odkaz aj QR kód z tohto okna sú kľúčom k tabuľke. Žiakom ich neukazuj. Ak ho predsa niekto videl, v ponuke **Slepá mapa → Nový kľúč učiteľa** vytvoríš nový: starý odkaz a QR kód prestanú platiť na všetkých zariadeniach (aj odkazy pre dozor), svoj telefón potom pripojíš znova.

### Prechod zo starej verzie (šablóna „Slepá mapa – šablóna“)

1. V editore skriptu nahraď obsah `Code.gs` novým a súbor `App.html` zmaž (už ho netreba).
2. **Nasadiť → Spravovať nasadenia** → ceruzka → Verzia: **Nová verzia** → Nasadiť. Adresa ostane rovnaká.
3. Hárky Nastavenia, Objekty, Sedenie, staré Výsledky a `_balíky` môžeš zmazať. Starý hárok Testy sa sám premenuje na „Testy (verzia 1)“. Stĺpec Skupina v hárku Žiaci sa znova používa (skupiny A a B, od verzie 2.13).

### Aktualizácia skriptu

Keď nová verzia aplikácie zmení aj skript (v [zozname zmien](CHANGELOG.md) je to napísané), aplikácia učiteľa ukáže upozornenie. Vtedy:

1. V tabuľke **Rozšírenia → Apps Script**, obsah `Code.gs` zmaž a vlož nový `apps-script/Code.gs`. Ulož.
2. **Nasadiť → Spravovať nasadenia** → ceruzka → Verzia: **Nová verzia** → **Nasadiť**. Adresa ostane rovnaká, QR kódy a odkazy platia ďalej.

Kým skript nevymeníš, aplikácia funguje po starom, len bez noviniek.

### Skupiny A a B

Trieda, v ktorej majú v hárku Žiaci niektorí žiaci skupinu **A** a niektorí **B**, píše test v dvoch skupinách. Každá skupina dostane vlastné objekty, aby nemali čo odpisovať, a vedľa seba sú vždy dva objekty s rovnakým typom a obtiažnosťou, aby žiadna skupina nemala ľahšie. Stĺpec Skupina sa do staršieho hárka Žiaci doplní sám (na koniec), stačí ho vyplniť. Žiak bez skupiny v takej triede píše skupinu A; aplikácia učiteľa ťa naňho upozorní už pri výbere triedy. Trieda bez skupín (alebo len s jednou) píše jednu spoločnú sadu.

### Vlastné objekty

Hárok **Vlastné objekty** (vytvorí sa sám): Názov | Typ | Oblasť | Obtiažnosť | Súradnice. Súradnice skopíruj z Google Máp (pravé tlačidlo na mieste, napr. `48.7297, 19.1498`). Typ môže byť „mesto“, „vrch“, „rieka“… alebo čokoľvek iné, Oblasť kód (`sk`) alebo názov (Slovensko). Tieto objekty sa v aplikácii ponúkajú spolu s katalógom, ale vidíš ich len ty.

### Zdieľanie s inými učiteľmi

Učiteľ si urobí kópiu tvojej prázdnej tabuľky (Súbor → Vytvoriť kópiu; skript sa skopíruje s ňou) a urobí kroky 3 až 5. Aplikácia aj mapy sú spoločné, každý má svoju triedu u seba.

---

## 3. Test v triede

Test je ako písomka: jeden celkový čas, žiak sa medzi miestami voľne presúva a tipy mení až do odovzdania.

1. **Nový test:** trieda a názov testu (obe povinné, vždy začínajú prázdne), oblasť, typy objektov, obtiažnosť, počet objektov (pri skupinách v každej skupine) a **celkový čas v minútach**. Posledná možnosť v zozname tried je **Externí**: hráči bez zoznamu, každý si napíše svoje meno (napr. kamaráti alebo iná skupina). Pod triedou je napísané, či píše v skupinách a kto nemá skupinu.
2. **Výber objektov:** objekty aj mapa s nimi sú predvolene skryté, aby ich žiaci nevideli na projektore. Ukážeš ich tlačidlom **Ukázať objekty**.
   - **Auto** namieša objekty podľa filtrov (vyvážene podľa obtiažnosti a typov). Pri triede so skupinami sú dva stĺpce, A a B, a v každom riadku dva objekty s rovnakým typom a obtiažnosťou. Na telefóne je dvojica pod sebou.
   - Písaním do políčka si objekt vyberieš sám (diakritika ani veľké písmená nevadia). **Kocka** pri políčku vyberie náhodne iný objekt: pri skupinách s rovnakým typom a obtiažnosťou ako sused vedľa (aj keď si ho zmenil ručne), bez skupín hocijaký z ponuky. Riadok, v ktorom sa typ alebo obtiažnosť dvojice líši, má oranžové číslo.
   - **Manuál** začne s prázdnymi políčkami.
3. **Mapa a hodnotenie:** viditeľné vrstvy (reliéf, povrchové celky, chránené územia, vodstvo, mestá, kraje, okresy; obrys a okolité štáty sú na mape vždy) a hranice percent v % uhlopriečky mapy. Vrstva typu, ktorý sa v teste môže hádať, sa na mapu dať nedá (je zošedená).
4. **Spustiť test** → QR kód. Alebo **Pripraviť na neskôr**: žiaci po naskenovaní čakajú, kým test spustíš ty alebo dozor (pozri nižšie).
5. Žiaci vyberú svoje meno, test sa zamkne na ich zariadenie. Na konci zoznamu je **Učiteľ**, ak chceš hrať s triedou (píše skupinu A). Do priemeru sa nepočíta.
6. **Písanie:** čas beží od ťuknutia na Začať a obnovenie stránky ho nevráti. Hore sú dve časomiery: zostávajúci čas a zostávajúce miesta (kým je pás miest kratší ako pás času, žiak stíha), pod nimi čísla miest. Tip sa uloží hneď po ťuknutí a dá sa presunúť; miesto si žiak môže označiť vlajkou „vrátim sa“. Počas písania nevidí odchýlky ani percentá. **Odovzdať** ukáže, koľko miest je bez tipu; keď čas vyprší, test sa odovzdá sám.
7. **Odchod z testu** (iná karta alebo aplikácia, obnovenie stránky): prvýkrát varovanie a z celkového výsledku sa strhne 10 %, druhýkrát sa test ukončí a odovzdá. Strhnutie je v skripte tabuľky (`LEAVE_PENALTY`).
8. V **Prehľade** vidíš, kto píše (aj koľko má tipov), kto odovzdal a jeho skupinu, a veľké číslo **Priemer triedy**. Percentá jednotlivých žiakov ukáže až prepínač **Zobraziť výsledky žiakov**. Pri neprihlásenom žiakovi ťukni **Neprítomný**: v tabuľke dostane „neprítomný“ a nepočíta sa do priemeru (ak sa predsa prihlási, označenie zmizne). **Odomknúť** pri píšucom žiakovi mu dovolí prihlásiť sa z iného zariadenia: pokračuje so svojimi tipmi a so zvyšným časom. **Kopírovať výsledky pre Excel** skopíruje mená, skupiny a percentá.
9. **Uzavrieť test a ukázať výsledky:** všetkým žiakom sa zobrazí ich mapa s tipmi a správnymi polohami.
10. **Tipy triedy** (až po uzavretí testu): tipy celej triedy pri každom objekte, medián a návrh obtiažnosti. **Kopírovať štatistiky** dá tabuľku s rovnakým `id` ako v `*_difficulty_edit.csv` (pri EČV id okresu), typom, skupinou, obtiažnosťou v teste a návrhom, takže ju vložíš vedľa tabuľky obtiažností. **Hodnotenie a obrázky:** zmena hraníc percent (prepočíta sa aj tabuľka), obrázky žiakov na stiahnutie alebo uloženie na Disk.

Výsledky sú v tabuľke v hárku „Res_<id testu>“ (napr. `Res_9A_10-23_09:58`), hárky idú hneď za hárkom Testy, najnovší vľavo: skupina, percentá, odchýlky v km pri každom objekte (pri skupinách najprv objekty A, potom B), počet odchodov, tipy a príznaky (odchod z testu, odovzdanie po čase, pokus o prihlásenie z iného zariadenia).

### Dozor a suplovanie

Test môžeš pripraviť pre inú triedu alebo na hodinu, keď nebudeš v škole:

1. Vytvor test tlačidlom **Pripraviť na neskôr**.
2. Klikni **Dozor** (hneď po vytvorení alebo neskôr v Testy → Otvoriť) a **Vytlačiť papier pre dozor**. Na papieri sú dva QR kódy: pre žiakov a pre dozor, a krátky návod.
3. Dozor naskenuje svoj kód. Vidí len prehľad tohto jedného testu: spustí ho, označí neprítomných, na konci ho uzavrie a skopíruje výsledky do Excelu. K iným testom ani k tabuľke sa nedostane.

Výsledky sa zapíšu do tvojej tabuľky ako pri každom inom teste.

## 4. Precvičovanie

`https://samocief.github.io/blindmap` môže otvoriť ktokoľvek. Vyberie si oblasť (vždy jednu), skupiny objektov, obtiažnosť, počet a čas na tip (predvolene 20 s, dá sa aj bez limitu). Po každom tipe hneď vidí správnu polohu, na konci mapu so všetkými tipmi a môže si zopakovať objekty, ktoré mu nešli (pod 70 %). Tabuľka učiteľa sa nepoužíva a mená sa nezisťujú.

**Štatistika precvičovania:** ak je v `data/index.json` vyplnené `"stats"`, každé dokončené kolo sa anonymne zapíše do tabuľky „Slepá mapa – štatistika precvičovania“ (skript `apps-script/Stats.gs`, postup nasadenia je na jeho začiatku). V hárku Prehľad je počet kôl a ľudí (podľa náhodného čísla prehliadača), priemerná úspešnosť, vývoj po dňoch a podľa skupín, v hárku Objekty objekty od najťažšieho, čo pomáha pri nastavovaní obtiažností.

Objekty sa vyberajú po skupinách (vodstvo, povrch, chránené územia, mestá, štáty, administratívne členenie), konkrétny typ sa zúži obtiažnosťou. Pri Slovensku sa dajú precvičovať aj EČV okresov (administratívne členenie, obtiažnosť 4–5): zadanie je napríklad „EČV okresu: BJ“ a žiak ťukne do okresu.

Rovnako ako učiteľ si vyberie viditeľné vrstvy (reliéf, vodstvo, kraje…). Na rozdiel od testu si môže zapnúť aj vrstvu, ktorú práve hádá, napríklad vodstvo pri precvičovaní riek. Je to ľahší režim: nehľadá, kde rieka tečie, ale ktorá z nakreslených je tá správna. Predvolene je táto vrstva vypnutá.

V aplikácii učiteľa tlačidlo **Odkaz na precvičovanie** vytvorí odkaz a QR kód s nastavením z formulára vrátane vrstiev mapy, napríklad ako prípravu na test. Filtre sa dajú zadať aj priamo v adrese: `https://samocief.github.io/blindmap/?r=sk&t=water,relief&d=1-3&n=10&s=20&l=sk/base_relief.png` (oblasť, skupiny `water`, `relief`, `nature`, `people`, `states`, `admin` alebo typy, obtiažnosť od-do, počet, sekundy na tip, 0 = bez limitu, súbory vrstiev mapy).

