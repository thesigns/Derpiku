# Derpiku — Game Design Document

**Wersja:** 0.6 (wstępna)
**Data:** 18.10.2026
**Status:** MVP w budowie

### Zmiany w 0.6

- **Całe sterowanie przez głaskanie.** Usunięty przycisk „Start a walk” / „Derpiku, catch a spirit!” i łapanie duszków. Pierwsze pogłaskanie zaczyna odcinek spaceru, kolejne mówią, ile zostało, a pogłaskanie po przejściu dystansu daje haiku od duszka, który jest akurat nad graczem. Potem licznik się zeruje.
- Usunięte stany „najedzony” / „głodny” i odbieranie haiku później — haiku dostaje się na miejscu.
- Usunięte suchary. Stuknięcie w Derpiku: „Pet me!”.
- Nowa zakładka **Radar** (między Derpiku i Orbits): minimalistyczny widok bez mapy ulic z punktem startu, okręgiem celu, aktualnym położeniem i kierunkiem patrzenia (kompas).
- Duszek unoszący się nad Derpiku pokazuje, od kogo będzie haiku.
- Tryb deweloperski na localhoście (14).

### Zmiany w 0.5

- Rozstrzygnięte pytania otwarte: wybór najbliższego duszka, widoczność dymków, dokładne odliczanie, horyzont 60 dni, brak wzrostu, brak pamięci duszków, jeden wygląd Derpiku, brak onboardingu w terenie.
- 16 haiku na duszka (4 na porę roku), pora roku zależna od półkuli.
- Duszki regionalne (tropikalne, polarne) dopuszczone jako naturalny skutek orbit.
- Symulator orbit (`tools/orbit-sim/`) do doboru liczby i parametrów duszków.
- Prognoza przelotów pokazuje okna, w których duszek jest najbliższy, a nie samo wejście w zasięg.
- Konstelacja: 26 zwierzęcych duszków A–Z, z Pigeon Spirit jako duszkiem-tłem o zasięgu całej Ziemi (6.5). Konstelacja zamknięta.

### Zmiany w 0.4

- Losowe łapanie zastąpione deterministycznym spacerem: odejście na ustalony dystans w linii prostej od startu.
- Trzy długości spaceru (250 m / 500 m / 1 km), bez wpływu na nagrody.
- Filtr średniej prędkości; odcinek wygasa po 3 h.
- Brak śledzenia trasy.

---

## 1. Opis w skrócie

**PL:** Derpiku to mały, nieporadny stworek mieszkający w twoim telefonie. Pogłaszcz go, odejdź kawałek i pogłaszcz znowu — odwdzięczy się haiku od eterycznego duszka, który akurat przelatuje nad tobą.

**EN (do sklepu / strony):** A derpy pocket pet that hears haiku from spirits orbiting the Earth. Pet it, take a walk, pet it again — and it tells you a haiku from the spirit floating above you.

## 2. Filary projektu

- **Prostota** — jedna akcja (głaskanie), jedna nagroda (haiku).
- **Spacer bez celu** — gra nigdy nie wysyła gracza w konkretne miejsce. Liczy się to, że odszedł kawałek od miejsca startu, a nie dokąd idzie.
- **Bez kar za chodzenie** — każdy przebyty dystans kończy się haiku. Żadnego losowania, żadnego „chodziłem i nic”.
- **Bez przymusu** — Derpiku nie cierpi, gdy gracz nie wychodzi. Nie ma głodu, dziennych limitów ani obowiązku kolejnego spaceru.
- **Ulotność** — haiku nie są kolekcjonowane, a Derpiku nie pamięta, których duszków spotkał. Wiersze pojawiają się, wybrzmiewają i znikają, mogą się powtarzać jak powracające duszki.
- **Prywatność** — żadnej lokalizacji domu, żadnego zapisywania trasy, żadnego serwera, wszystkie dane zostają na urządzeniu.
- **Kontrast tonu** — głupkowaty stworek i ciche, poetyckie haiku.

## 3. Platforma i technologia

- **PWA** serwowana ze statycznego serwera (GitHub Pages), działająca offline (service worker).
- **Język aplikacji:** angielski.
- **Dane lokalne:** IndexedDB (ustawienia, aktywny odcinek spaceru, licznik haiku dnia).
- **Grafika:** 2D, proceduralna (canvas / WebGL), bez zewnętrznych assetów.
- **Brak backendu** — duszki, orbity i haiku są wbudowane w aplikację.
- **Brak lokalizacji w tle** — gra wie, gdzie jest gracz, tylko w chwili głaskania i wtedy, gdy aplikacja jest otwarta. Telefon może leżeć w kieszeni z wygaszonym ekranem.

## 4. Pętla rozgrywki

1. Gracz głaszcze (pociera palcem) Derpiku. Derpiku zapamiętuje punkt startu i mówi: **„Walk 500 m away and pet me — I'll tell you a haiku!”**
2. Gracz idzie, dokąd chce. Telefon może zostać w kieszeni.
3. Każde kolejne pogłaskanie pokazuje, ile jeszcze zostało w linii prostej od startu: **„Walk 237 m more and pet me — I'll tell you a haiku!”**
4. Gdy gracz jest wystarczająco daleko, pogłaskany Derpiku wypowiada haiku od duszka, który akurat jest nad graczem (ten unoszący się nad Derpiku), i świeci jego kolorem.
5. Licznik się zeruje. Kolejne pogłaskanie zaczyna nowy odcinek („Walk 500 m away…”). Kolejny spacer jest możliwy, ale nieobowiązkowy.
6. Haiku wybrzmiewa w dymku i znika po zamknięciu — nie jest nigdzie zapisywane.

Stuknięcie (bez pocierania) daje tylko: **„Pet me!”**

## 5. Mechanika spaceru

### 5.1 Odcinek spaceru

- Pierwsze pogłaskanie (albo pierwsze po haiku lub po wygaśnięciu) zapisuje pozycję i czas startu odcinka.
- Wymagana dokładność GPS: `accuracy` < **50 m** (z Geolocation API). Przy gorszym sygnale Derpiku mówi „I can't sense the sky here…” i nic się nie zmienia.
- Start może być wszędzie, także w domu — liczy się dystans, nie miejsce. Przypadkowe pogłaskanie w domu niczego nie psuje, po prostu ustawia start.

### 5.2 Długość spaceru

Gracz wybiera, jak daleko trzeba odejść od startu:

| Opcja | Dystans w linii prostej | Orientacyjny czas marszu |
|---|---|---|
| Short stroll | 250 m | ~3 min |
| Stroll (domyślna) | 500 m | ~6 min |
| Long walk | 1000 m | ~12 min |

- Wybór pojawia się raz przy pierwszym uruchomieniu (domyślnie 500 m), potem można go zmienić w ustawieniach.
- **Nie nazywamy tego poziomem trudności.** To preferencja gracza, a nie wyzwanie.
- **Długość nie wpływa na nagrody** — te same duszki i te same haiku na każdej opcji.
- Dystans jest zamrażany w momencie startu odcinka. Zmiana ustawienia działa od następnego odcinka.

### 5.3 Haiku

- Pogłaskanie daje haiku, gdy jednocześnie:
  - odległość w linii prostej od startu ≥ wybrany dystans,
  - dokładność GPS < 50 m,
  - spełniony jest filtr prędkości (5.4).
- Bez losowania — dojście na miejsce zawsze daje haiku.
- **Za blisko:** Derpiku mówi, ile metrów zostało (zaokrąglone w górę).
- **Podgląd postępu:** gdy aplikacja jest otwarta, pod Derpiku widać na żywo „237 m to go · straight line from where you started” i łapki postępu, a Radar pokazuje to na rysunku. Po zamknięciu aplikacji nic nie jest śledzone.
- Haiku trzeba odebrać na miejscu: gra nie śledzi trasy, więc po powrocie do domu gracz znów jest blisko startu.

### 5.4 Zabezpieczenia

- **Filtr średniej prędkości:** minimalny czas od startu = dystans ÷ ~12 km/h. Szybsze przemieszczenie (tramwaj, samochód) nie daje haiku — Derpiku mówi „Whoa, that was too fast — walk, don't ride!” i zaczyna odcinek od nowa w bieżącym miejscu. Da się to obejść, ale stawką jest haiku, więc prosty filtr wystarczy.
- **Dokładność GPS** < 50 m — chroni przed przeskokami lokalizacji z Wi-Fi w budynkach (zwłaszcza przy 250 m).
- **Wygasanie:** odcinek wygasa po cichu po **3 godzinach** od startu, a punkt startu jest usuwany. Następne pogłaskanie zaczyna nowy odcinek.

## 6. Duszki

### 6.1 Koncepcja

Fikcyjna konstelacja eterycznych duszków zwierząt (duszek-kot, duszek-żaba, duszek-wieloryb…) krążących wokół Ziemi po deterministycznych orbitach. Wszyscy gracze na świecie widzą te same duszki w tym samym czasie. Duszki niosą haiku — Derpiku powtarza wiersz duszka, który jest akurat nad graczem.

### 6.2 Orbity

- Każdy duszek ma kilka parametrów: nachylenie orbity, okres obiegu, fazę startową, długość węzła i promień zasięgu.
- Orbity są kołowe i stałe (bez precesji). Pozycja nad Ziemią liczona jest z czasu (z uwzględnieniem obrotu Ziemi), bez danych zewnętrznych.
- Duszek jest w zasięgu, jeśli punkt pod nim leży w jego promieniu zasięgu od gracza.
- **Wymóg:** nad każdym zamieszkanym miejscem (ok. 56°S – 78°N) zawsze jest w zasięgu co najmniej jeden duszek. Symulacja pokazuje, że przy rozsądnych zasięgach nie da się tego spełnić samymi „zwykłymi” duszkami (nawet przy 25 duszkach o zasięgach 0,9–4,5 tys. km luki zajmują ~21% czasu, do 120 min z rzędu). Dlatego jeden duszek-tło ma zasięg całej Ziemi (6.5).
- **Rzadkość** regulowana okresem, nachyleniem i szerokością zasięgu (duszki codzienne vs. rzadkie).
- **Duszki regionalne:** nachylenie orbity wyznacza najwyższą szerokość geograficzną, nad którą duszek przelatuje, a najwięcej czasu spędza blisko tej granicy. Duszek o małym nachyleniu jest więc „tropikalny” (nigdy nad Polską), a o nachyleniu bliskim 90° — częsty nad okolicami polarnymi. Dopuszczamy takie duszki świadomie: dla części graczy będą „Nigdy nad tobą” i staną się powodem do wypatrywania ich w podróży.
- **Zasada zamrożenia:** orbit wydanych duszków nie zmieniamy. Przy widocznych orbitach (sekcja 7) każda zmiana byłaby od razu zauważalna dla graczy.
- **Konstelacja zamknięta:** 26 duszków, po jednym na literę A–Z (6.5). Nowych duszków nie dodajemy.
- **Strojenie:** parametry dobieramy w symulatorze orbit (`tools/orbit-sim/`), sprawdzając pokrycie, częstość zmian najbliższego duszka i odstępy między przelotami w wybranych miastach.

### 6.3 Który duszek

- O tym, **kiedy** jest haiku, decyduje spacer (sekcja 5) — bez losowania.
- O tym, **od którego duszka**, decydują orbity, deterministycznie: liczy się duszek, którego punkt pod nim leży najbliżej gracza (w km), spośród duszków w zasięgu.
- Ten sam duszek unosi się nad Derpiku (10), więc gracz zawsze widzi, od kogo będzie wiersz.

### 6.4 Prognoza przelotów

Gracz może sprawdzić, kiedy dany duszek będzie nad jego położeniem (szczegóły w sekcji 7). Daje to powód do wyjścia o konkretnej porze bez wskazywania konkretnego miejsca.

- **Prognoza pokazuje okna, w których duszek jest najbliższy, nie przeloty w zasięgu.** Duszek w zasięgu nie zawsze jest tym, od którego będzie haiku — jeśli bliżej jest inny duszek, liczy się tamten (6.3).
- Przykład z symulatora (Kraków): duszek wchodzi w zasięg o 13:32 na 26 min, ale najbliższy jest dopiero od 13:41 przez 18 min. Prognoza pokazuje 13:41 i 18 min.
- Ponieważ wybór duszka jest deterministyczny, tak liczona prognoza jest wiarygodna: wystarczy zacząć odcinek kilka minut przed oknem i dojść do celu w jego trakcie.

### 6.5 Konstelacja

26 duszków zwierząt — **każdy zaczyna się na inną literę angielskiego alfabetu**, od A do Z. Parametry są wstępne (dostrojone w symulatorze; jedyne źródło: `src/spirits.js`) i mogą się jeszcze zmienić aż do wydania — potem obowiązuje zasada zamrożenia.

| Duszek | Grupa | Nachylenie | Okres | Zasięg | Kraków: % czasu jako najbliższy | Kraków: okna / tydz. | Uwagi |
|---|---|---|---|---|---|---|---|
| **A** — Axolotl Spirit | bardzo rzadkie | 63° | 1187 min | 900 km | 0,7% | ~1,3 |  |
| **B** — Bee Spirit | średnie | 33° | 151 min | 3500 km | 2,0% | ~14 | nie sięga Svalbardu, na Islandii prawie nigdy |
| **C** — Cat Spirit | częste | 48° | 97 min | 4500 km | 5,8% | ~45 |  |
| **D** — Dog Spirit | częste | 57° | 131 min | 4500 km | 7,5% | ~40 | częsty też na dalekiej północy (psy zaprzęgowe) |
| **E** — Elephant Spirit | regionalne | 30° | 541 min | 2500 km | 0,4% | ~2,2 | ciepłe szerokości, w Polsce na granicy zasięgu |
| **F** — Frog Spirit | częste | 38° | 113 min | 4500 km | 4,3% | ~30 | ukłon w stronę żaby Bashō |
| **G** — Goose Spirit | średnie | 75° | 181 min | 3500 km | 5,5% | ~30 | częsta na północy (gęsi wędrowne) |
| **H** — Hedgehog Spirit | częste | 51° | 143 min | 4500 km | 6,3% | ~35 |  |
| **I** — Iguana Spirit | regionalne | 9° | 223 min | 2500 km | nigdy | — | tylko tropiki |
| **J** — Jellyfish Spirit | średnie | 29° | 311 min | 3500 km | 1,6% | ~8,2 | ciepłe i umiarkowane szerokości |
| **K** — Koala Spirit | regionalne | 28° | 293 min | 2000 km | nigdy | — | ciepłe szerokości |
| **L** — Llama Spirit | średnie | 41° | 239 min | 3500 km | 3,8% | ~16 |  |
| **M** — Moth Spirit | średnie | 61° | 367 min | 3500 km | 5,9% | ~18 |  |
| **N** — Narwhal Spirit | polarne | 88° | 1307 min | 1500 km | 1,0% | ~2,4 | rzadki, najczęstszy blisko biegunów |
| **O** — Owl Spirit | średnie | 72° | 263 min | 3500 km | 6,0% | ~25 | częsta na północy (sowa śnieżna) |
| **P** — Pigeon Spirit | tło | 52° | 300 min | cała Ziemia | 28,9% | ~133 | zawsze i wszędzie, jak gołębie; liczy się, gdy nikogo innego nie ma bliżej |
| **Q** — Quokka Spirit | bardzo rzadkie | 45° | 977 min | 900 km | 0,3% | ~0,9 | najrzadszy w Polsce |
| **R** — Rabbit Spirit | częste | 44° | 109 min | 4500 km | 5,6% | ~38 |  |
| **S** — Snail Spirit | rzadkie | 47° | 2111 min | 2200 km | 2,4% | ~4,5 | wolny: rzadko, ale długie okna |
| **T** — Turtle Spirit | regionalne | 21° | 457 min | 2000 km | nigdy | — | ciepłe szerokości |
| **U** — Urchin Spirit | rzadkie | 59° | 1709 min | 1200 km | 1,5% | ~3,4 |  |
| **V** — Vole Spirit | średnie | 55° | 197 min | 3500 km | 5,2% | ~24 |  |
| **W** — Whale Spirit | rzadkie | 69° | 1523 min | 1500 km | 1,4% | ~3,5 |  |
| **X** — Xerus Spirit | regionalne | 14° | 331 min | 2200 km | nigdy | — | tylko tropiki (afrykańska wiewiórka ziemna) |
| **Y** — Yak Spirit | polarne | 80° | 277 min | 3000 km | 3,9% | ~19 | najczęstszy na dalekiej północy i południu |
| **Z** — Zebra Spirit | regionalne | 5° | 409 min | 2800 km | nigdy | — | tylko tropiki |

- **Okna / tydz.** to liczba odcinków czasu, w których duszek jest najbliższy; przy częstych duszkach okna są krótkie (kilkanaście–kilkadziesiąt minut) i często przerywane przez inne duszki.
- Najbliższy duszek zmienia się średnio co ~18–23 min (63–78 zmian na dobę zależnie od miejsca), więc dwa spacery tego samego dnia zwykle dają różne duszki.
- **Zasięg geograficzny:** z Krakowa da się usłyszeć 21 z 26 duszków; nigdy nie pojawiają się tam Iguana, Koala, Turtle, Xerus i Zebra. W tropikach (Singapur, Nairobi) osiągalne są wszystkie. Na skrajnej północy (Svalbard) dominują Pigeon, Goose, Yak, Owl i Dog.
- **Regionalność jest miękka:** orbity są symetryczne względem równika, więc nie da się zrobić duszka „tylko północnego” ani „tylko południowego”. Da się zrobić duszka tylko tropikalnego (małe nachylenie) albo częstszego przy biegunach (nachylenie bliskie 90°).
- **Unikać rezonansów:** okres będący prostym ułamkiem doby gwiazdowej (~1436 min) powtarza ślad nad tymi samymi długościami geograficznymi, więc wąski duszek omijałby całe regiony. Okresy są dobrane „nierówne”; każdą zmianę sprawdzamy w analizie globalnej symulatora.

### 6.6 Wygląd duszków

- Świecące, półprzezroczyste duszki-zwierzątka rysowane proceduralnie w Canvas 2D (`src/spirit-art.js`): okrągła główka, falujący ogonek rozpływający się w powietrzu, poświata w kolorze duszka, iskierki wokół.
- Spokojne, przymknięte oczka — kontrast z wyłupiastymi oczami Derpiku.
- Każde zwierzę ma kilka charakterystycznych części: uszy (kot, królik, koala, lama…), kolce (jeż, jeżowiec, legwan), róg (narwal), skorupę (ślimak, żółw), paski (pszczoła, zebra), czułki, skrzydła, trąbę, rogi, płetwy; meduza ma dzwon z czułkami zamiast ogonka.
- Podgląd wszystkich 26: `tools/spirit-gallery.html`.

## 7. Ekran orbit

### 7.1 Koncepcja

Osobny ekran z wizualizacją konstelacji duszków: niebieska kula ziemska, wokół niej orbity duszków z ich ikonkami. Ekran tłumaczy graczowi system (dlaczego jedne duszki są częste, a inne rzadkie) i daje coś do oglądania w domu.

### 7.2 Wygląd i obsługa

- Prosta niebieska kula, orbity jako linie, duszki jako ikonki z literami poruszające się w czasie rzeczywistym.
- Obracanie kuli palcem.
- Rzut prostokątny na canvasie 2D, bez biblioteki 3D. Delikatna siatka południków i równoleżników oraz kropka położenia gracza; bez kontynentów.
- Między kulą a rzędem liter: **„Above you now”** (duszek nad graczem i jak długo jeszcze) oraz **„Next”** (kolejny duszek i na jak długo).

### 7.3 Informacja o duszku

- Tapnięcie w ikonkę lub literę pokazuje nazwę duszka i czas do najbliższego okna nad aktualnym położeniem gracza (6.4), zawsze dokładnie co do minuty, np. „Above you in 14 d 23 h 5 m, for 18 m”.
- Gdy okno właśnie trwa: „Above you now — for another 7 m”.
- Jeśli orbita duszka nigdy nie sięga szerokości geograficznej gracza: „Never above you”.
- Jeśli duszek bywa w zasięgu, ale w horyzoncie prognozy zawsze jest bliżej inny duszek: „Not anytime soon”.

### 7.4 Położenie gracza

- Odliczanie liczone od ostatniego odczytu GPS z bieżącej sesji, bez zapisywania lokalizacji na stałe.
- Komunikat odnosi się do *obecnego* położenia (zmienia się w podróży).
- Bez lokalizacji ekran pokazuje same orbity, bez odliczania.

### 7.5 Obliczanie przelotu

- Przeszukiwanie czasu do przodu z krokiem ~1 min: w każdym kroku ta sama reguła wyboru co przy haiku (najbliższy duszek w zasięgu, 6.3). Okno to ciągły odcinek czasu, w którym wybranym duszkiem jest ten, o który pyta gracz. Początek i koniec okna doprecyzowane bisekcją do sekund.
- Prognoza i haiku muszą używać **tej samej funkcji wyboru duszka** (wspólny moduł orbit, `src/orbits.js`), żeby nigdy się nie rozjechały.
- Horyzont prognozy: **60 dni**; dalej komunikat „Not anytime soon”.
- Koszt: ~86 400 kroków × liczba duszków na jedną prognozę na 60 dni. Liczymy na żądanie dla wybranego duszka, nie co klatkę.

## 8. Teksty Derpiku

### 8.1 Haiku

- **Pregenerowane przez AI**, po angielsku, wbudowane w aplikację.
- **16 haiku na duszka:** po 4 na każdą porę roku. Przy 26 duszkach to **416 haiku**.
- Otagowane **motywem duszka** (kot, żaba, wieloryb…) i **porą roku**.
- **Pora roku** liczona z daty i półkuli (znak szerokości geograficznej w chwili haiku) — na półkuli południowej pory są odwrócone.
- Wybór: duszek nad graczem → motyw, data i półkula → pora roku, ziarno dnia + licznik haiku tego duszka danego dnia → konkretny wiersz z czterech.
  - Pierwsze haiku danego duszka w danym dniu jest takie samo dla wszystkich graczy na tej samej półkuli („dzisiejsze haiku Kota”), kolejne tego samego dnia dają następne wiersze z puli.
- Nie trzymamy się sztywno 5-7-5 (współczesne angielskie haiku zwykle jest krótsze).
- **Ręczna selekcja:** wiersze do przejrzenia i poprawienia (`src/data/haiku.json`).
- Ton: poważna forma, treść lekko „derp”, z perspektywy małego stworka.
- **Ulotność:** haiku nie trafia do żadnej kolekcji ani historii. Może się powtarzać.
- Tekst haiku jest zaznaczalny, a obok jest dyskretny przycisk kopiowania — jeśli gracz chce zachować wiersz, robi to sam, poza aplikacją.

### 8.2 Komunikaty

- Po angielsku, w pierwszej osobie, krótko: „Walk 500 m away and pet me — I'll tell you a haiku!”, „Walk 237 m more…”, „Whoa, that was too fast — walk, don't ride!…”, „I can't sense the sky here — the GPS is too fuzzy…”, „Pet me!”.
- Sucharów nie ma.

### 8.3 Dymki

- Dymek pozostaje widoczny, dopóki gracz nie zamknie go przyciskiem **„X”** albo nie pojawi się kolejny dymek.
- Stuknięcie w Derpiku nie zamyka czytanego haiku.

## 9. Derpiku — postać

### 9.1 Wygląd

- 2D, proceduralny, zbudowany z metaballi / SDF w WebGL, twarz rysowana w 2D.
- Fałszywe cieniowanie z gradientu pola odległości: miękkie światło i połysk, efekt „żelka”.
- **Jeden wygląd dla wszystkich graczy.**
- Derpiku **nie rośnie** i nie zmienia się trwale.

### 9.2 Stany

- **Spokojny** — blady, cierpliwie czeka. Nic nie pogarsza się z upływem czasu: Derpiku nie znika, nie umiera i nie robi się smutny.
- **Na spacerze** — zaciekawiony, węszy, zerka na duszka nad sobą; gdy aplikacja jest otwarta, podskakuje tym częściej, im bliżej celu.
- **Mówi haiku** — świeci kolorem duszka, od którego je usłyszał, szczęśliwe oczka; kolor gaśnie po zamknięciu dymka.

### 9.3 Animacje (proceduralne)

Oddychanie, mruganie, squash & stretch, chwianie się, falowanie przy głaskaniu, oczy śledzące palec, zerkanie na duszka, węszenie, kręcenie głową przy odmowie.

### 9.4 Narzędzia

Do zrobienia: panel debugowy z suwakami (proporcje, oczy, sprężystość, kolory) do strojenia wyglądu.

## 10. Interfejs

Zakładki: **Derpiku | Radar | Orbits**, plus ustawienia pod ikoną zębatki.

- **Derpiku (terrarium):** sam Derpiku — bez przycisków. Głaskanie steruje grą (4). Pod nim jedna linijka stanu („Rub Derpiku with your finger.” / „237 m to go · straight line from where you started” / „Far enough! Rub Derpiku for a haiku.”) i łapki postępu. Dymki z przyciskiem „X”.
- **Duszek nad Derpiku:** przy świeżym (do 10 min) i dokładnym (< 50 m) odczycie GPS nad głową Derpiku unosi się duszek, od którego byłoby teraz haiku (6.3), z podpisem „above you for another 12 m”. Przy zmianie duszka stary odpływa, nowy spływa; w ostatniej minucie okna duszek migocze. Gdy otwarty jest dymek, duszek się chowa.
- **Radar:** minimalistyczny widok bez mapy ulic, północ u góry:
  - punkt startu odcinka i przerywany okrąg celu (promień = dystans spaceru),
  - aktualne położenie z kółkiem dokładności GPS i strzałką kierunku patrzenia (kompas telefonu; bez kompasu — kierunek ruchu z GPS),
  - ślad z bieżącej sesji (tylko w pamięci), pierścienie skali z podpisami, obracająca się wiązka radaru,
  - pod spodem ta sama linijka stanu co na ekranie Derpiku.
  - Na iPhonie kompas wymaga jednorazowej zgody — przycisk „Show which way I'm facing”.
- **Orbits:** kula ziemska z orbitami duszków i prognozą przelotów (sekcja 7).
- **Ustawienia:** długość spaceru (Short stroll / Stroll / Long walk), informacja o użyciu GPS i kompasu.
- **Pierwsze uruchomienie:** krótkie wyjaśnienie („Rub Derpiku…”), po co GPS, i wybór długości spaceru.

## 11. Prywatność i bezpieczeństwo

- Brak ustawiania lokalizacji domu.
- Trasa nie jest zapisywana. Ślad na Radarze istnieje tylko w pamięci do zamknięcia aplikacji.
- Punkt startu odcinka (często de facto dom) jest przechowywany tylko do haiku albo do wygaśnięcia po 3 h.
- Wszystkie dane przechowywane wyłącznie lokalnie.
- Położenie jest odczytywane przy głaskaniu oraz — tylko gdy aplikacja jest na pierwszym planie — w trakcie odcinka, na Radarze i co 5 minut dla duszka nad Derpiku (gdy dostęp jest już przyznany). Nie jest zapisywane na stałe.
- Kompas jest używany tylko na Radarze.
- Gra nigdy nie wskazuje celu ani miejsca, do którego trzeba pójść — okrąg na Radarze pokazuje tylko odległość, każdy kierunek jest dobry.
- Telefon może zostać w kieszeni w trakcie spaceru.

## 12. Pytania otwarte

- Ostateczne parametry orbit 26 duszków (wstępne w 6.5, dalsze strojenie w symulatorze).
- Ręczna selekcja i poprawki 416 haiku.
- Weryfikacja w terenie: filtra 12 km/h, progu 50 m i dystansów 250 / 500 / 1000 m; zachowanie kompasu na różnych telefonach.
- Szary Pigeon Spirit słabo odróżnia się od bladego Derpiku — czy zmienić mu kolor?

## 13. Zakres MVP

1. Derpiku (proceduralny żelek) sterowany wyłącznie głaskaniem, z dymkami i stuknięciem „Pet me!”.
2. Odcinek spaceru: start przy pierwszym pogłaskaniu, licznik pozostałych metrów, haiku po dojściu, trzy długości, filtr średniej prędkości, wygasanie po 3 h.
3. 26 duszków zwierząt A–Z (6.5), z Pigeon Spirit jako gwarancją zasięgu; duszek nad Derpiku.
4. 416 haiku (16 na duszka, 4 na porę roku), kopiowanie.
5. Radar: start, okrąg celu, położenie, kierunek.
6. Ekran orbit: kula, orbity, obracanie, „Above you now / Next”, prognoza dla wybranego duszka.

## 14. Narzędzia deweloperskie

- **Gra** — główny katalog repozytorium (`index.html`, `src/`), PWA bez kroku budowania; uruchomienie opisane w `README.md`.
- **Tryb deweloperski** — tylko na localhoście, w ustawieniach (`src/dev.js`, ładowany dynamicznie): symulowany GPS z gotowymi lokalizacjami i dokładnością, pasek DEV na ekranach gry (chodzenie strzałkami po 100 m, skok za okrąg celu, automatyczny spacer ×1/×10/×60, przełącznik słabego GPS), przesuwanie zegara (do +30 dni — pory roku, wygasanie odcinka), reset odcinka, podgląd dowolnego haiku, ponowny onboarding, pełny reset, odczyt stanu na żywo. Na localhoście service worker jest domyślnie wyłączony (`?sw` go włącza).
- **Symulator orbit** (`tools/orbit-sim/index.html`) — edycja parametrów duszków, mapa śladów orbit, analiza pokrycia i zmian duszków na świecie, oś czasu i przeloty dla wybranego miasta, eksport konfiguracji do JSON.
- **Galeria duszków** (`tools/spirit-gallery.html`) — wszystkie 26 duszków w ruchu, na jasnym i nocnym tle.
