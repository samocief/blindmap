# Zoznam zmien

Verzia aplikácie je v `js/core.js` (`APP.version`), verzia skriptu tabuľky v `apps-script/Code.gs` (`VERSION`). Aplikácia na GitHub Pages sa aktualizuje sama. Keď sa zmení aj skript, každý učiteľ ho musí vo svojej tabuľke vymeniť (postup v [README](README.md#aktualizácia-skriptu)). Kým to neurobí, aplikácia funguje po starom a ukáže upozornenie.

## 2.5.1 (2026-10-17)

- Skupina typov Ochrana prírody sa volá Chránené územia, rovnako ako vrstva.

## 2.5 (2026-10-17)

Skript tabuľky učiteľa sa nemení.

- **Anonymná štatistika precvičovania:** po každom dokončenom kole pošle úvodná stránka záznam do tabuľky „Slepá mapa – štatistika precvičovania“: čas, náhodné číslo prehliadača (na odhad počtu ľudí), oblasť, skupiny, obtiažnosť, výsledok a tipy pri objektoch. Bez mien. Tabuľka má prehľad (kolá, ľudia, priemerná úspešnosť, po dňoch, podľa skupín) a hárok Objekty zoradený od najťažšieho. Skript je v `apps-script/Stats.gs`, adresa jeho webovej aplikácie patrí do `data/index.json` ako `"stats"`. Kým tam nie je, nič sa neposiela a nezobrazí sa ani upozornenie o štatistike.

## 2.4 (2026-10-17)

- Farby vrstiev: kraje červenou čiarou, okresy tenšou čiernou, povrchové celky hnedou, chránené územia zelenou so slabou zelenou výplňou. Predtým boli kraje a okresy na reliéfe (a v tmavom režime telefónu) takmer neviditeľné.
- Skupina Obyvateľstvo sa volá Mestá.
- Súbory aplikácie majú v odkaze číslo verzie, takže prehliadač po aktualizácii hneď načíta novú verziu (nie starú z vyrovnávacej pamäte).

## 2.3 (2026-10-17)

Skript tabuľky sa nemení (okrem novej adresy z 2.2).

- **Krátka adresa:** precvičovanie je na úvodnej adrese `https://samocief.github.io/blindmap`. Stránka žiaka pri teste je `test.html`; odkazy a QR kódy testov (`…/blindmap/?s=…&t=…`) fungujú ďalej, úvodná stránka ich presmeruje. Stará `cvicenie.html` presmeruje na úvod.
- **Oblasť** sa vyberá z rozbaľovacieho zoznamu, vždy len jedna (v precvičovaní aj pri tvorbe testu).
- **Typy objektov** sa vyberajú len po skupinách: Vodstvo, Povrch, Ochrana prírody, Mestá, Štáty, Administratívne členenie. Konkrétny typ sa zúži obtiažnosťou (napr. Administratívne členenie s obtiažnosťou 4–5 sú len EČV).
- **Viditeľné vrstvy** (predtým „Čo bude na mape“): Reliéf, Povrchové celky, Chránené územia, Vodstvo, Mestá, Kraje, Okresy (pri Európe aj Štáty). Obrys územia a okolité štáty sú na mape vždy. Predvolene je zapnutý len reliéf. Kraje a okresy sú na reliéfe lepšie vidieť, okresy tenšou čiarou.
- V teste sa zošedí vrstva typu, ktorý sa podľa skupín a obtiažnosti môže hádať.

## 2.2 (2026-10-17)

**Nová adresa aplikácie:** repozitár sa premenoval na `blindmap`, aplikácia je na `https://samocief.github.io/blindmap/`. Stará adresa `…/slepamapa/` už nefunguje (ani staré odkazy a QR kódy). V skripte tabuľky sa zmenila len adresa (`APP_URL`): v tabuľke ju prepíš alebo vlož nový `Code.gs` a nasaď novú verziu (Deploy → Manage deployments → Edit → New version), inak menu tabuľky otvára starú adresu.

**Dáta Slovenska**
- Nové dáta z FME: rieky, vodné plochy, pohoria, nížiny a kotliny, vrchy, **sedlá a priesmyky** (nový typ), **jaskyne**, chránené územia, mestá, kraje a okresy. Nový reliéf, obrys SR a hranice krajov; susedné štáty sú prispôsobené novému obrysu.
- Obtiažnosť je oddelená od geometrie: aplikácia ju berie z tabuľky `data/sk/difficulty.csv` podľa `id` (v teste aj v precvičovaní). Neskôr sa dá namiesto nej zadať odkaz na zverejnený Google Sheet.
- **EČV okresov** ako samostatný typ: hľadá sa okres podľa EČV (napr. „EČV okresu: BJ“). Obtiažnosť 4 pre okresy s obtiažnosťou 1–2, 5 pre okresy s 3. V precvičovaní sa po tipe ukáže aj názov okresu.
- Príprava dát je v skripte `source/sk_upload.py` (premenovanie súborov, opravy názvov riek a pohorí, úprava geometrie).

**Vzhľad**
- Typy objektov aj vrstvy „Čo bude na mape“ sú zoskupené do tém: vodstvo, povrch, ochrana prírody, obyvateľstvo, štáty, administratívne členenie. Ťuknutím na názov témy sa zapne alebo vypne celá skupina.

## 2.1.1 (2026-10-15)

Skript tabuľky sa nemení.

- Precvičovanie: typ, ktorý sa hádá, už nie je vo vrstvách zošedený. Žiak si môže zapnúť napríklad všetky rieky pri precvičovaní riek (ľahší režim). Predvolene je vrstva vypnutá. V aplikácii učiteľa pri teste zošedenie ostáva, odkaz na precvičovanie od učiteľa ju preto nezapne.

## 2.1 (2026-10-14)

Úpravy po prvom teste so žiakmi. **Skript tabuľky treba vymeniť.**

**Tvorba testu**
- Trieda a názov testu sú povinné, vždy začínajú prázdne a nepamätajú si minulý test.
- Na konci zoznamu tried je **Externí**: hráči bez zoznamu (kamaráti, iná skupina), každý si napíše meno sám. Dve rovnaké mená naraz nejdú.
- Zoznam objektov je predvolene skrytý (Zobraziť zoznam / Skryť zoznam), aby ho žiaci nevideli na projektore.
- Typ, ktorý sa hádá, nemôže byť na mape celý: jeho vrstva („Všetky rieky“) sa zošedí.
- Nové tlačidlo **Pripraviť na neskôr**: test čaká v stave Pripravený, žiaci vidia čakaciu obrazovku a pokračujú sami, keď ho učiteľ alebo dozor spustí. Pripravených testov môže byť naraz viac.

**Počas testu**
- V zozname mien je navyše **Učiteľ**, aby mohol hrať s triedou. Do priemeru ani do tipov triedy sa nepočíta.
- Pri neprihlásenom žiakovi je tlačidlo **Neprítomný**. V hárku výsledkov dostane riadok s textom „neprítomný“, do priemeru sa nepočíta. Ak žiak predsa príde a prihlási sa, označenie zmizne samo.
- Veľké číslo **Priemer triedy** (bez učiteľa a neprítomných).
- Percentá jednotlivých žiakov sú skryté za prepínačom **Zobraziť výsledky žiakov**, Tipy triedy sa ukážu až po uzavretí testu (alebo cez Zobraziť aj tak).
- **Kopírovať výsledky pre Excel**: meno a percentá celej triedy, neprítomní s textom.

**Dozor a suplovanie**
- Každý test má odkaz pre dozor (tlačidlo **Dozor**) a **papier pre dozor** na tlač s dvoma QR kódmi: pre žiakov a pre dozor.
- Dozor vidí len prehľad toho jedného testu: spustí ho, označí neprítomných, uzavrie ho a skopíruje výsledky. Nič iné v tabuľke nevidí a nič sa mu neukladá.

**Precvičovanie**
- Výber, čo bude na mape (reliéf, hranice, „Všetky rieky“…), rovnako ako v aplikácii učiteľa. Odkaz na precvičovanie od učiteľa prenesie aj vrstvy.

**Vzhľad**
- Zadanie počas hry je jedným veľkým písmom: „Rieka: Nitra“. Rovnako v zozname výsledkov aj na obrázku.
- Všetky texty v rozhraní začínajú veľkým písmenom.
- Verzia aplikácie je v pätičke aplikácie učiteľa.

## 2.0 (2026-10-13)

- Celá aplikácia (žiak aj učiteľ) beží na GitHub Pages. Skript v tabuľke učiteľa je len most k jeho údajom (žiaci, testy, výsledky).
- Katalóg objektov a mapy sú v repozitári (`data/`), vyrába ich FME zo `source/objekty.xlsx`.
- Výber objektov Auto (vyvážene podľa typov a obtiažnosti, kocka na výmenu) a Manuál (vyhľadávanie podľa filtrov).
- Bez skupín A/B: všetci majú rovnaké objekty v náhodnom poradí. Počas testu žiak vidí len odchýlku v km, mapu so správnymi polohami až po uzavretí testu.
- Hodnotenie v percentách podľa odchýlky v % uhlopriečky mapy.
- Odchod z aplikácie: prvýkrát 0 % za dané miesto, druhýkrát koniec testu.
- Tipy triedy pri každom objekte s mediánom a návrhom obtiažnosti, obrázky žiakov na stiahnutie alebo na Disk.
- Precvičovanie pre kohokoľvek (`cvicenie.html`) a odkaz na precvičovanie z aplikácie učiteľa.

## 1 (prototyp)

- Prvá verzia ako webová aplikácia Apps Script priamo v tabuľke (šablóna „Slepá mapa – šablóna“), so skupinami A/B.
