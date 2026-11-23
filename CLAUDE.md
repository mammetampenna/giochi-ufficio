# Giochi d'Ufficio: menu e giochi online

Raccolta di giochi web per i colleghi di Factorial. Interfaccia, commenti e risposte all'utente: **in italiano**.
Si gioca da computer con Chrome e, per menu, morra, briscola e Scarta!, **anche da telefono**: l'utente lo ha chiesto il 23/11/2026. Nerf e ItaliaGuessr restano da computer.

## Stile grafico: colorato e giocoso
- Il 23/11/2026 è stata provata una revisione con Unslop, sobria e con neutri caldi. **All'utente non è piaciuta** ("troppo moscia, seria"): in una giornata grigia d'ufficio vuole colori, animazioni e interazioni.
- Si è tornati allo stile di prima, tenendo alcune cose della prova:
  - la versione per telefono;
  - le schede del menu con l'oggetto vero del gioco, animato al passaggio del mouse;
  - le icone Lucide;
  - Anime.js.
- **Colori**: sfondo scuro viola `--bg #0d0b1a` con macchie colorate animate (`.aurora`, da mettere in ogni pagina), pannelli di vetro, accenti rosa, arancio, verde acqua e viola, e un gradiente `--grad` per i pulsanti principali.
- **Tipografia e movimento**: titoli a peso 800, rimbalzi (`--spring`).
- **Icone**: Lucide inline, con `icon(nome)` in `shared/core.js`.
- **Animazioni**: Anime.js 4.3.6 tramite `shared/motion.js` (`anim`, `timeline`, `enter`, `tween`). Le curve più usate sono `outBack(2)` e `outElastic(1, .55)`.
  - La logica di gioco non deve mai aspettare la fine di un'animazione: con la scheda in background Anime.js si ferma. Per i tempi si usa `sleep`.
- **Oggetti condivisi**: `shared/mano.js` (mano della morra) e `shared/italia.js` (sagoma dell'Italia per il menu).
- **Voci della morra**: le grida ("Dui!" … "Tutta!") sono MP3 generati con il connettore ElevenLabs dell'utente (piano gratuito, modello `eleven_v4`, prompt `[shouting excitedly] Setti!`). Sono in `morra/voci/`, 4 voci da 9 file:
  - `m` = Nenneri, uomo;
  - `f` = Giusy, donna con accento siciliano;
  - `a` = pap, anziano;
  - `n` = Elettra, anziana.

  A ogni partita ognuno dei due giocatori pesca una voce a caso con `pickVoices(seed)`: il seme arriva con `start`, così tutti sentono le stesse. Le voci si ascoltano in `morra/prova-voci/`.
  La voce sintetica del browser e quelle del Mac sono state scartate perché robotiche. Registrare le grida dei colleghi resta un'idea rimandata.
Ogni gioco storico ha il suo CLAUDE.md: `italia-guessr/CLAUDE.md` e `nerf-salotto/CLAUDE.md`.

## Struttura del sito
- `index.html`: menu iniziale. Ha schede animate con inclinazione 3D, anteprime in CSS e un campo per il codice stanza da 5 caselle, che porta direttamente al gioco giusto.
- `shared/ui.css`: stile comune.
  - Token dei colori su `:root`, font Bricolage Grotesque e sfondo animato `.aurora`.
  - Bottoni, lobby, finestre modali e avvisi.
  - `@view-transition { navigation: auto; }`: le transizioni tra le pagine funzionano in Chrome. Il titolo del gioco ha `view-transition-name: title-<gioco>`.
- `shared/core.js` (modulo ES):
  - client Supabase (supabase-js 2.45.4 da jsdelivr);
  - profilo unico in `localStorage.gu_profile` con id, nome, avatar emoji e colore. Si modifica con `editProfile()` / `ensureProfile()`;
  - `toast`, `sfx` (suoni WebAudio), `confetti`, `mountTopbar`;
  - stanze: `createRoom`, `findRoom`, `saveRoom`, `saveResult` e la classe `Room`.
- `shared/lobby.js`: `mountLobby(root, opts)` è la lobby generica.
  - Schermata d'apertura: illustrazione animata del gioco (`opts.hero`), titolo colorato, riquadri grandi "Crea una stanza" / "Contro il computer" / "Hai un codice?" (5 caselle), colori del gioco (`opts.colors`). Sfondo a tema con `floatBackdrop()` di core.js.
  - Sala d'attesa costruita una volta e aggiornata a pezzi; ingressi con animazioni CSS (non Anime.js), così non restano mai invisibili.
  - Supabase (`vendor/supabase.js`) e Anime.js (`vendor/anime.esm.min.js`) sono nel sito; Supabase si carica solo quando serve (`getSb()`).
  - Permette di creare una stanza, entrare con un codice o giocare contro il computer.
  - Mostra la lista dei presenti. Le impostazioni le modifica solo l'host; il pulsante Inizia invia `start` a tutti.
  - Il link della stanza è `?r=CODICE`.
- Si prova con il server locale `.claude/launch.json` (`python3 -m http.server 8765`), poi si apre http://localhost:8765.
  - Per simulare due giocatori servono due origini diverse, perché il profilo sta in localStorage: http://a.localhost:8765 e http://b.localhost:8765.

## Rete (Supabase Realtime)
- Si usa lo stesso progetto Supabase di ItaliaGuessr (`agwmdkrkfydgfzghwspv`).
- **Tabelle**:
  - `game_rooms`: code (5 caratteri, senza I, O, 0, 1), game, host_id, host_name, settings, state, status (lobby/playing/finished);
  - `game_results`: risultati finali.
  - Valgono le RLS: tutti possono leggere e inserire, solo `game_rooms` si può aggiornare. Ci sono limiti di dimensione sui campi jsonb.
- **Canale** `gu:<CODICE>`:
  - la presence dice chi è collegato (chiave = id del profilo);
  - i messaggi broadcast hanno la forma `{t: tipo, d: dati, f: mittente}`.
- **Host**: è il creatore se è collegato, altrimenti il primo entrato. Se l'host esce, un altro prende il suo posto automaticamente.
- **Fiducia**: le regole girano nel browser dell'host. Tra colleghi va bene, ma non è a prova di imbroglio.

## Morra calabrese (`morra/`)
- **Regole**: uno contro uno, eventuali altri presenti guardano la partita. Ognuno butta da 1 a 5 dita e chiama un numero da 2 a 10.
  - Chi indovina la somma fa punto. Se indovinano tutti e due, il punto non va a nessuno.
  - Chi non butta in tempo regala il punto all'avversario.
  - Si gioca a 5, 11, 16 o 21 punti. Il tempo per scegliere può essere 3, 5 o 8 secondi.
- **Mossa simultanea con "busta chiusa"**:
  - Durante la scelta si invia `commit` con lo sha256 di `n|dita|chiamata|sale`. Viene inviato solo l'hash della scelta più recente.
  - Alla scadenza, più 450 ms, si invia `reveal`. Chi riceve controlla che corrisponda.
- **Messaggi**: `round` (lo manda l'host, con i punteggi, così tutti restano allineati), `commit`, `reveal`, `over`, `hello`/`state` (per rientrare a partita in corso), `start` (anche per la rivincita).
- **Grafica**:
  - mani in SVG con le dita che si piegano;
  - le mani battono a ogni secondo del conto alla rovescia;
  - le chiamate compaiono in fumetti, con i numeri in dialetto (Dui, Tri, … Tutta!);
  - la voce italiana del browser (speechSynthesis) legge la chiamata. Si può disattivare.
- **Contro il computer**: "Compare Turi" sceglie a caso, con una stanza finta tutta locale.
- **Test**: `window.__morra` espone lo stato della partita.

## Briscola (`briscola/`)
- **Carte**: `shared/piacentine.js` ridisegna il mazzo piacentino in SVG, in stile piatto e minimale (scelta dell'utente: "visibilmente piacentine ma moderne").
  - Semi come `<symbol>` (`injectDefs()`), figure a doppia testa (8 fante, 9 cavallo, 10 re), spade ricurve e bastoni incrociati a X.
  - `cardSVG({s, r})` e `backSVG()`. L'anteprima di tutto il mazzo è in `briscola/mazzo.html`; con `?c=D9,S8` mostra solo quelle carte, in grande.
- **Regole** (`briscola/regole.js`): carte come stringhe `'D1'..'B10'`.
  - Punti: A 11, 3 10, R 4, C 3, F 2. Forza: A > 3 > R > C > F > 7 … 2.
  - La briscola sta sotto il mazzo e viene pescata per ultima. Vince chi fa più di 60 punti; 60 a 60 è patta.
  - L'IA `botChoose` batte un giocatore casuale circa 5 volte su 6 (simulazione di 4000 partite).
- **Rete**: decide tutto l'host. I client inviano solo `play {c}`; l'host invia `st` con lo stato pubblico.
  - Le mani dei giocatori umani viaggiano nel campo `h` dello stesso messaggio: chi apre gli strumenti di Chrome le vede, ed è accettato.
  - L'host salva lo stato completo in `game_rooms.state`; se esce, il nuovo host lo ricarica (`takeOver`).
  - Chi è offline da più di 20 s quando tocca a lui viene sostituito dal computer.
- **Partite**:
  - 1 contro 1 oppure 2 contro 2 (posti 0 e 2 contro 1 e 3); i posti vuoti li prende il computer.
  - Il giro va in senso antiorario: il giocatore successivo è a destra.
  - Con la rivincita si cambia chi apre e si tiene il conto delle partite vinte.
- **Grafica del tavolo**: niente panno verde. Il tavolo è un piano di vetro scuro sopra lo sfondo comune, con un alone del colore della briscola (`#board[data-bris]`).
  - Animazioni WAAPI (funzione `fly`) per distribuire, giocare, raccogliere e pescare. Tasti 1–3 per giocare.
- **Test**: `window.__briscola` espone lo stato.

## Scarta! (`carte/`)
- È il gioco di carte con meccaniche alla UNO, ma con nome e grafica originali (UNO è un marchio Mattel).
- **Mazzo** (`carte/carte.js`, `carte/regole.js`): 108 carte.
  - 4 colori, ciascuno con: uno 0, due copie da 1 a 9, due Salta, due Inverti e due +2;
  - 4 jolly e 4 +4.
  - Il codice di una carta è "colore valore . copia", per esempio `r7.1` o `wd4.2`.
- **Grafica**: le carte hanno il corpo a righe e una finestra bianca squadrata al centro; i jolly hanno una girandola a 4 colori. Non c'è l'ovale inclinato di UNO.
- **Regole**: da 2 a 10 giocatori.
  - Impostazioni: computer aggiunti (0–5), accumulo di +2 e +4 (sì/no), tempo per mossa (20 s, 40 s o senza limite).
  - Dopo aver pescato si può giocare solo la carta pescata, altrimenti si passa.
  - "Ultima!": chi resta con una carta senza averlo detto può essere "Beccato!" dagli altri e pesca 2. Anche i computer beccano.
- **Rete**: come la briscola. L'host decide; i client inviano `act {t: play|draw|pass|ultima|catch}`; lo stato pubblico `st` contiene in `h` le mani dei giocatori umani.
- **Animazioni**: carte che volano, scritte grosse a centro schermo ("+4", "Salta!", "Inverti!", "Beccato!"), timbri sui giocatori e alone del colore attivo dietro al tavolo.
- **Test**: `window.__scarta`. La simulazione di 500 partite in Node con le stesse regole non perde carte.

## Chi è online
- Tutte le pagine (anche ItaliaGuessr e Nerf, con un piccolo modulo in fondo alla pagina) entrano nel canale presence `gu:hub` con `announce({game, code, status})`.
- Il menu mostra "Online ora": cosa fa ciascuno, con i pulsanti "Entra"/"Guarda" per la sua stanza e 👋 per salutarlo.
- La lobby mostra "Invita chi è online". `ping(id, 'invite'|'wave')` fa comparire un avviso con il pulsante Entra in qualunque pagina stia guardando il destinatario.

## Uscita verso il menu
- Morra e briscola: c'è il pulsante "Giochi" nella barra in alto.
- ItaliaGuessr: "← Giochi" nel menu del gioco e 🏠 nell'HUD.
- Nerf: "← Giochi" sulle schermate. Durante la partita è nascosto, ma si esce con Esc e "Torna ai giochi" in pausa e a fine partita.

## Prossimi passi
2. **Briscola**: le grandi scritte di ogni presa ("+21", "Carico per…", "Liscio") e la vittoria con coriandoli sono fatte. I punti totali si vedono solo a fine partita: è una scelta dell'utente.
3. **Revisione generale** di funzioni e grafica di tutti i giochi, compresi ItaliaGuessr e Nerf, da allineare allo stile colorato.
4. **Multiplayer di Nerf**: in pausa per scelta dell'utente (23/11/2026). Il piano è in `nerf-salotto/CLAUDE.md`.

## Pubblicazione
- C'è un repository git locale (ramo `main`).
- Repository pubblico `mammetampenna/giochi-ufficio`, sito su GitHub Pages: https://mammetampenna.github.io/giochi-ufficio/ (si aggiorna da solo a ogni push su main, in circa un minuto). `gh` è autenticato.
- Nota: GitHub Pages gratuito richiede un repo pubblico, e il repo contiene la chiave Google Maps di ItaliaGuessr. Conviene limitarla ai domini autorizzati nella console di Google.
- `nerf-salotto/scan/` e `assets_src/` sono esclusi da git perché pesanti e personali.
