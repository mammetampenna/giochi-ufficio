# ItaliaGuessr — clone di GeoGuessr sull'Italia

Gioco web in stile GeoGuessr: Street View in un punto a caso, poi si indovina il posto sulla mappa. Lo giochiamo con i colleghi di Factorial, **solo da computer**.
Lingua dell'interfaccia e dei commenti: **italiano**. Per ora è considerato **finito**: lavorarci solo su richiesta.

## Come si costruisce
- `python3 build.py` unisce `src/template.html` e i sorgenti in **`italia-guessr.html`** (~1,1 MB, file unico).
  - Il template ha i segnaposto `/*LEAFLET_CSS*/`, `/*LEAFLET_JS*/` e `/*APP_JS*/`.
  - Leaflet 1.9.4 è in `vendor/`.
  - L'ordine dei JS conta: geo.js, places.js, italy_outline.js, centri.js, famosi.js, catalog.js, app.js.
- **Chiave Google Maps** (dell'utente) precompilata in app.js: `AIzaSyBJz_SddzqricoGn85-6SJjjn2-chz_lMc`. Serve Maps JavaScript API con Street View. La quota gratuita è limitata, quindi tenere d'occhio le chiamate.

## Sorgenti (src/)
- `geo.js`: confini e dati geografici delle zone.
- `places.js`: luoghi di interesse.
- `italy_outline.js`: sagoma dell'Italia.
- `centri.js`: centri abitati e comuni.
- `famosi.js`: luoghi famosi.
- `catalog.js`: catalogo di regioni e province per il selettore su mappa.
- `app.js`: tutta la logica.

## Funzioni del gioco
- **Zone**:
  - zone fisse: Calabria, Provincia di Treviso, Umbria, Roma e Castelli Romani;
  - qualsiasi regione o provincia scelta dal selettore su mappa, a schede con pillole e gruppi richiudibili. Si possono escludere province.
- **Tipi di punto** (impostazioni valide per tutte le modalità): solo punti d'interesse, solo urbano, oppure tutto.
- **Modalità "Chi abita più vicino?"**: punto a caso in tutta l'Italia. Il giocatore esplora Street View, cammina e sceglie chi dei colleghi abita più vicino. La libreria giocatori sta nelle impostazioni, dove si possono attivare e disattivare. Giocatori:
  - Matteo, Albano Laziale;
  - Samurai, Catanzaro;
  - Giacomo, Todi;
  - Anna, Sant'Andrea di Barbarana;
  - Livraghi, Milano.

  Un bug vecchio, già corretto: i punti finivano sempre vicino a Livraghi.
- **Altre funzioni**:
  - timer da 1, 3 o 4 minuti;
  - punteggio in base alla distanza, con animazioni;
  - impostazioni per tipo di mappa e tipi di punto.
- **Minimappa**: piccola, si ingrandisce al passaggio del mouse e si richiude con un piccolo ritardo. Lo zoom con rotellina e pizzico è fluido. All'utente non piaceva sempre grande.
- **Multiplayer**: ognuno sul suo computer, stanze con codice, classifiche. La tabella online si ridisegna solo quando cambia qualcosa (prima lampeggiava di continuo).

## Supabase
- Progetto `agwmdkrkfydgfzghwspv`, URL `https://agwmdkrkfydgfzghwspv.supabase.co`, chiave pubblica `sb_publishable_5edj9ayGro2KPEgrUsaNZg_KWDi9mi_` (pubblicabile, già nel client).
- **Tabelle**: areas (colonna provinces), area_catalog, comuni, places, players, games, rounds, rooms, room_members, room_rounds, room_guesses.
- **Viste**: leaderboard, room_standings.
- Al 23/11/2026: 7856 comuni, 303 luoghi, 130 aree nel catalogo, 5 giocatori, 46 partite, 10 stanze.
- **Da fare**: eliminare la funzione RPC `seed_reference(part, data)`, che esiste ancora. I dati sono già caricati e la funzione permette scritture a chiunque abbia la chiave pubblica. Poi togliere da app.js il codice di seed (intorno a `rpc('seed_reference'`, ~riga 1427) e lanciare `get_advisors` per la sicurezza.

## Storia e preferenze dell'utente
- I fornitori di tile della mappa a volte si bloccavano: ora c'è una prova in parallelo con alternative di riserva.
- Eliminato un ciclo di ricarica dovuto all'autenticazione Google.
- Netlify non gli è piaciuto. Ospitare il gioco su GitHub Pages è possibile, se collega GitHub.
- Preferisce interfacce curate e moderne: niente liste schematiche, sì a schede, pillole e gruppi richiudibili.
