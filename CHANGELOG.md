# Zoznam zmien

Verzia aplikácie je v `js/core.js` (`APP.version`), verzia skriptu tabuľky v `apps-script/Code.gs` (`VERSION`). Aplikácia na GitHub Pages sa aktualizuje sama. Keď sa zmení aj skript, každý učiteľ ho musí vo svojej tabuľke vymeniť (postup v [README](README.md#aktualizácia-skriptu)). Kým to neurobí, aplikácia funguje po starom a ukáže upozornenie.

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
