# Bar Bon Gust: sito con prenotazioni e ordini da ritirare

Sito per il **Bar Bon Gust**, Carrer de Pujades 155, all'angolo con Carrer de la Llacuna (Poblenou, Barcellona).
Non c'entra con i giochi d'ufficio: deve vivere in un **repository suo**, con GitHub Pages.
Risposte e commenti all'utente: **in italiano**. Il sito parla castigliano (predefinito), catalano, inglese e italiano (`i18n.js`).

## Stile (richiesta dell'utente, 23/11/2026)
- "Baretto sotto casa, familiare": muro crema, tenda a righe terracotta che ondeggia, piastrelle idrauliche, lavagna verde con il gesso (font Caveat), legno, post-it.
- **Tutto animato**, interfacce pulite e divertenti, "serio ma non troppo".
- Font nel sito (`fonts/`): Fraunces (titoli), Archivo (testo), Caveat (scritte a mano). Three.js 0.160 in `vendor/`. Niente CDN.
- **Bocadillo 3D** nella pagina iniziale (`hero3d.js`): ingredienti che cadono, piatto di ceramica con il bordo blu, "Otro" lo apre e cambia ripieno. Senza WebGL o con "riduci movimento" resta l'illustrazione SVG.
- **Piatti illustrati** (`dishes.js`): ogni piatto è disegnato a strati SVG che si aprono in 3D al passaggio del mouse (o al tocco). Le composizioni sono nelle tabelle `BOCA`, `BIKINI`, `COMBO`, `DRINK`; un prodotto nuovo senza disegno usa un bocadillo generico.
- Le foto delle lavagne sono state tolte dal sito su richiesta dell'utente (23/11/2026).

## Birre e afterwork (richiesta dell'utente, 23/11/2026)
- Uno dei focus: chi esce da Factorial a fine turno e beve qualcosa con i colleghi.
- Categoria `cervezas` (seconda nella carta): caña, doble, jarra, clara, botellín, mediana, tostada, sin alcohol, cubo. Prezzi **orientativi** e senza marca: da confermare col locale.
- Le spillate (`preorder = false`) si bevono solo al bar ("en la barra"); le bottiglie si possono anche ordinare da ritirare.
- Sezione "La hora de la caña" (`#afterwork`): lucine, due cañas che si riempiono e brindano, lista delle birre, pulsante che prepara la prenotazione (primo giorno con turno dalle 18:00, 6 persone, primo giro da 6).
- Turni prenotabili: pranzo 13:00–15:30 e dal tardo pomeriggio 17:30–22:00 (venerdì dalle 17:00).
- "Primera ronda": nel modulo di prenotazione si sceglie quante cañas far trovare in tavola; finisce nelle note ("🍺 Primera ronda: N cañas."), che il personale vede.

## Dati raccolti
- Carta e prezzi: dalle due lavagne fotografate dall'utente (bocadillos interi e mezzi, supplemento queso/cebolla/pimiento +0,70 €, platos combinados).
- Le **bevande** non sono sulle lavagne: prezzi orientativi, segnati con il tag `orientativo`.
- **Orari da verificare col locale**: le fonti online non sono d'accordo. Ora: lun–ven 7:30–23:00, sab 8:00–16:00, dom chiuso. Si cambiano in `bg_settings` (chiave `config`).

## Database (Supabase, progetto `agwmdkrkfydgfzghwspv`, tabelle con prefisso `bg_`)
- Schema e funzioni: `db/schema.sql`; dati iniziali: `db/seed.sql`.
- `bg_tables`: 11 tavoli da 4. Zone `ventana` (1–4), `sala` (5–8), `terraza` (9–11). Si uniscono solo tavoli della stessa zona con posizioni consecutive.
- `bg_bookings`: turni di 90 minuti; prenotabili a pranzo e cena ogni 30 minuti. Online fino a 16 persone (4 tavoli uniti).
- `bg_orders`: ordini da ritirare, con mezzo bocadillo e supplementi; il totale lo calcola il database.
- RLS: il pubblico legge solo `bg_menu`, `bg_tables`, `bg_settings`. Prenotazioni e ordini passano dalle funzioni `security definer`:
  `bg_availability`, `bg_book`, `bg_order`, `bg_lookup`, `bg_cancel`, `bg_order_status`, `bg_admin` (con password).
- `bg_book_core` blocca il giorno con `pg_advisory_xact_lock`, così due persone non prendono lo stesso tavolo.
- La logica di scelta dei tavoli è uguale in SQL (`bg_pick`) e in JS (`api.js` → `pick`).
- **Password del personale**: è solo nel database (hash bcrypt in `bg_staff`), non nel repository. Si cambia con
  `update bg_staff set pass_hash = extensions.crypt('NUOVA', extensions.gen_salt('bf'));`

## Pagine
- `index.html` + `app.js`: carta, carrello con orario di ritiro (casella "Lavoro da Factorial"), prenotazione con piantina, consulta/annulla con codice e telefono.
- `staff.html` + `staff.js`: ordini a colonne (nuovi/preparando/pronti, con suono), prenotazioni con linea del tempo per tavolo e cambio tavoli, carta modificabile (prezzi, esaurito).
- I codici: `R….` prenotazioni, `P….` ordini.

## Prove
- Server locale: `python3 -m http.server 8765` dalla cartella, poi http://localhost:8765/.
- Dal container cloud Supabase non è raggiungibile: le prove in Playwright usano un Supabase finto in memoria; la logica SQL è stata provata direttamente sul database.
- `window.__bongust` espone lo stato.
