# Zoznam zmien

Verzia aplikácie je v `js/core.js` (`APP.version`), verzia skriptu tabuľky v `apps-script/Code.gs` (`VERSION`). Aplikácia na GitHub Pages sa aktualizuje sama. Keď sa zmení aj skript, každý učiteľ ho musí vo svojej tabuľke vymeniť (postup v [README](README.md#aktualizácia-skriptu)). Kým to neurobí, aplikácia funguje po starom a ukáže upozornenie.

## 2026-10-23 – skript tabuľky 2.4 (treba vymeniť skript tabuľky)

- **Id testu** má tvar `trieda_MM-dd_HH:mm`, napr. `9A_10-23_09:58` (rovnako v aplikácii aj v tabuľke). Staré testy si svoje id nechávajú.
- **Hárky výsledkov** sa volajú `Res_<id testu>` namiesto `Výsledky <id testu>` a nový hárok ide hneď za hárok Testy: najnovší vľavo, najstarší vpravo.
- Pri prvom otvorení aplikácie učiteľa po výmene skriptu sa staré hárky premenujú a zoradia samy. Znova sa to dá spustiť v ponuke Slepá mapa → Usporiadať hárky výsledkov.
- Mazanie starých prihlásení (po 60 dňoch) sa riadi stĺpcom „vytvorený“ v hárku Testy, lebo nové id už neobsahuje rok.

## 2.15 (2026-10-22)

- **Test: obrazovka počas písania nezhasne** (Screen Wake Lock). Zamknutie telefónu zo šetrenia batérie sa doteraz rátalo ako odchod s −10 %. Ručné zamknutie tlačidlom sa ako odchod ráta naďalej – prehliadač nevie rozlíšiť zamknutie od prepnutia do inej aplikácie. Pravidlá pred testom to žiakom hovoria; starší prehliadač bez tejto funkcie dostane radu ťukať občas na mapu.

## 2026-10-22 – vyhľadávače

- Úvodná stránka má popis, kľúčové slová (SK/EN/DE), kanonickú adresu a údaje pre Google; pribudol `sitemap.xml` pre Google Search Console.

## 2.14 (2026-10-19)

- Slovensko má druhý podkladový raster **Farebný reliéf** (mapa SHMÚ, georeferencovaná na hranicu SR, prepočítaná do WGS 84).
- Podkladové rastre sa vyberajú ako „jeden alebo žiadny“: zapnutie jedného vypne ostatné, vypnutím všetkých je mapa úplne slepá. Predvolene ostáva Reliéf.

## 2.13 (2026-10-19) – treba vymeniť skript tabuľky (verzia 2.3)

**Test ako písomka**
- **Jeden celkový čas** namiesto času na tip (vo formulári „Celkový čas (min)“). Beží od ťuknutia na Začať a drží ho skript tabuľky, takže ho obnovenie stránky ani iné zariadenie nevráti.
- **Voľný pohyb medzi miestami:** čísla miest hore (plné = s tipom, oranžová bodka = vlajka „vrátim sa“), šípka späť a Ďalšie dole. Tip sa uloží hneď po ťuknutí a dá sa presúvať až do odovzdania.
- **Dve časomiery** hore, bez farby: zostávajúci čas a zostávajúce miesta. Oba pásy ubúdajú; kým je pás miest kratší ako pás času, žiak stíha.
- Počas písania žiak nevidí odchýlky ani percentá, ani hneď po odovzdaní. Mapu a výsledok uvidí po uzavretí testu.
- **Odovzdať** (hore aj na poslednom mieste) ukáže, ktoré miesta sú bez tipu a ktoré označené, a dá sa k nim vrátiť. Keď čas vyprší, test sa odovzdá sám.
- **Odchod z testu:** prvý odchod (iná karta, aplikácia, obnovenie stránky) = varovanie a −10 % z celkového výsledku, druhý test ukončí a odovzdá.
- Tipy sa priebežne ukladajú aj do skriptu. Po odomknutí žiak na inom zariadení pokračuje so svojimi tipmi a zvyšným časom; učiteľ v prehľade vidí, koľko má kto tipov.
- Vzhľad ako precvičovanie (zadanie so symbolom, mapa, farby vrstiev, podpis).

**Skupiny A a B**
- Stĺpec **Skupina** v hárku Žiaci (do staršieho hárka sa doplní sám). Trieda so žiakmi v A aj B píše v dvoch skupinách s rôznymi objektmi.
- Vo formulári sú objekty v dvoch stĺpcoch, vedľa seba vždy rovnaký typ a obtiažnosť (na telefóne dvojica pod sebou). Kocka pri políčku vyberie objekt podľa suseda vedľa; dvojica s iným typom alebo obtiažnosťou má oranžové číslo.
- Žiaci bez skupiny sú vypísaní pod triedou a pred spustením testu sa aplikácia opýta. Píšu skupinu A.
- Prehľad, výsledky, tipy triedy, obrázky a kopírovanie pre Excel rátajú s tým, že každý žiak písal len objekty svojej skupiny.

**Ďalšie**
- Objekty aj mapa s nimi sú v aplikácii učiteľa pod jedným tlačidlom **Ukázať objekty** (predvolene skryté).
- QR kód pre telefón v okne „Otvoriť aplikáciu učiteľa“ je skrytý pod tlačidlom. Nová položka ponuky **Slepá mapa → Nový kľúč učiteľa** zneplatní starý odkaz a QR kód (ak ich videli žiaci).
- **Kopírovať štatistiky** (Tipy triedy): stĺpce id (ako v `*_difficulty_edit.csv`, pri EČV id okresu), názov, typ, skupina, obtiažnosť v teste, tipov, medián, priemer, návrh obtiažnosti.
- Odkaz na precvičovanie z aplikácie učiteľa má namiesto „nič sa neukladá“ text „bez mena a bez prihlásenia“.
- So skriptom starším ako 2.3 aplikácia učiteľa nové testy nevytvorí (doterajšie sa dajú otvárať) a žiak dostane vysvetlenie.

## 2.12 (2026-10-18)

- **Národné parky na mape sýtejšie:** pri zapnutej vrstve Chránené územia majú NP sýtejšiu zelenú výplň a hrubšiu čiaru, CHKO ostávajú svetlejšie. Vzorka pri vrstve (legenda) ukazuje oba odtiene. Typ sa berie zo stĺpca `subclass` v tabuľke (`NP` / `CHKO`), názvy s predponou ostávajú.
- **Nové obtiažnosti Slovenska** z `sk_difficulty_edit.csv` (jaskyne, okresy, vrchy, rieky, pohoria, vodné plochy). Okresy, ktoré prešli na obtiažnosť 3, majú pri EČV úroveň 5.
- **Názvy z tabuľky:** názov v `*_difficulty_edit.csv` má prednosť pred názvom z FME, priraďuje sa podľa `id` (nový skript `source/apply_table.py`, používa ho aj `sk_upload.py`). Opravy názvov riek a pohorí platia ďalej. Zmenené názvy: Babia hora / Babia Góra, Kremenec / Кременець / Krzemieniec, Prašivá (pri Ďumbieri).

## 2.11.1 (2026-10-17)

- Precvičovanie má nadpis „Slepá mapa – precvičovanie“ (aj v názve karty prehliadača) a dole malý podpis © samocief.

## 2.11 (2026-10-17)

- **Výber oblasti s miniatúrou:** namiesto bežného rozbaľovacieho zoznamu je vlastný zoznam, v ktorom má každá oblasť malý obrys (Slovensko, Európa). Funguje ťuknutím aj klávesnicou (šípky, Enter, Esc), ťuknutie mimo ho zavrie. V precvičovaní aj v aplikácii učiteľa.
- Obrysy sú v `data/index.json` (položka `thumb`), vyrába ich skript `source/thumbs.py` z `base_land.json`. Pri novom kontinente ho stačí spustiť znova.

## 2.10.2 (2026-10-17)

- Nadpisy skupín (Typy objektov, Nastavenie kola/testu, Viditeľné vrstvy) sú nad rámikom, nie v jeho čiare. Pri precvičovaní má rovnako veľký nadpis aj Oblasť.

## 2.10.1 (2026-10-17)

- Precvičovanie: bez veľkého rámika okolo celého formulára. Hore je Oblasť a pod ňou tri skupiny v rámikoch (Typy objektov, Nastavenie kola, Viditeľné vrstvy).
- Stránka sa na telefóne už nedá posúvať do strany: dlhý čip (napr. Administratívne členenie pri väčšom písme) sa radšej zalomí do dvoch riadkov.

## 2.10 (2026-10-17)

- **Skupiny vo formulári:** Typy objektov, Viditeľné vrstvy a nová skupina Nastavenie kola (v aplikácii učiteľa Nastavenie testu: obtiažnosť, počet objektov, čas na tip) majú jemný rámik a väčší nadpis v jeho hornej čiare. Rovnako v precvičovaní aj v aplikácii učiteľa.
- **Počty pri typoch podľa obtiažnosti:** číslo v zátvorke pri skupine (napr. Vodstvo (41)) je počet objektov pri zvolenej obtiažnosti a mení sa hneď pri posúvaní posuvníka, ako filtre v e-shope. Skupina, ktorá pri danej obtiažnosti nemá nič, je bledšia.
- Pri precvičovaní zmizla veta „Filtrom vyhovuje … objektov“. Pod formulárom je správa len vtedy, keď sa nedá začať (nič nevyhovuje, chyba načítania). Nastavenie kola je hneď pod typmi, aby bol posuvník pri počtoch; viditeľné vrstvy sú za ním.
- Súbory stránok sa načítajú s novým číslom verzie, aby sa zmeny (aj krivka z 2.9) hneď prejavili v telefónoch.

## 2.9 (2026-10-17) – skript tabuľky 2.2 (výmena zatiaľ nie je povinná)

- **Prísnejšie percentá za tip:** medzi hranicou 100 % a 0 % body neklesajú lineárne, ale kvadraticky, teda hneď za hranicou 100 % strmšie. Pri hraniciach 1 % a 30 % uhlopriečky dá chyba 5 % 74 % (predtým 86 %), 10 % 48 % (69 %), 15 % 27 % (52 %), 20 % 12 % (34 %). Tip „do stredu“ už nevynáša toľko bodov. Krivka sa mení konštantou `PCT_POW` v `js/geo.js` a `apps-script/Code.gs` (1 = lineárne).
- Aplikácia učiteľa prepočíta percentá podľa novej krivky aj pri starších testoch. Celkové percentá na konci testu a v hárku výsledkov ostanú lineárne, kým sa v tabuľke nevymení skript na 2.2.
- Na úvode precvičovania už nie je poznámka o anonymnej štatistike.

## 2.8.2 (2026-10-17)

- Štatistika precvičovania je zapnutá: adresa skriptu tabuľky „Slepá mapa – štatistika precvičovania“ je v `data/index.json`. Zoznam `index.json` sa načíta s číslom verzie, aby zmena hneď platila aj v telefónoch.

## 2.8.1 (2026-10-17)

- Predvolená obtiažnosť je 1–2 (precvičovanie aj nový test). Keď si ju človek pri precvičovaní posunie, zapamätá sa. Odkaz s obtiažnosťou (`&d=`) má vždy prednosť.

## 2.8 (2026-10-17)

- **Symboly typov:** každý typ objektu má vlastný symbol vo farbe svojej vrstvy na mape (vrch ▲, sedlo )(, jaskyňa, jazero, mesto ◉, EČV …). Zadanie pri precvičovaní aj v teste je teraz symbol, nad názvom malé slovo typu a pod ním veľký názov, napr. „jazero, vodná nádrž / Ružín“ namiesto „Jazero, vodná nádrž: Ružín“. Symboly sú aj vo výsledkoch a v aplikácii učiteľa.
- Pripravené typy pre kontinenty: prielivy, vodopády, súostrovia, sopky, plošiny, ľadovce, hlavné mestá, letiská, prístavy, historické regióny.
- Na úzkom telefóne je Ukončiť len krížik, aby mal názov viac miesta.

## 2.7.1 (2026-10-17)

- Pri precvičovaní je hore tlačidlo **Ukončiť**: kolo sa dá kedykoľvek skončiť a vrátiť sa na úvod. Ak už padol aspoň jeden tip, najprv sa opýta. Nedokončené kolo sa nezapočíta do štatistiky.

## 2.7 (2026-10-17)

- Obtiažnosť sa nastavuje jedným posuvníkom s dvoma bežcami (od–do) namiesto dvoch rozbaľovacích zoznamov, v precvičovaní aj pri tvorbe testu. Bežec sa dá ťahať, ťuknutím na číslo sa presunie bližší bežec a funguje aj klávesnica (šípky, Home, End).

## 2.6.1 (2026-10-17)

- Mestá na mape sú červené bodky s bielym lemom, aby boli vidieť aj na reliéfe.

## 2.6 (2026-10-17)

- Skupiny typov majú ikonu (vlnky pre vodstvo, kopec pre povrch, list pre chránené územia, budovy pre mestá, mapa pre administratívne členenie). Vrstvy majú vzorku čiary vo farbe, akou sa kreslia na mape, takže ponuka slúži aj ako legenda.

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
