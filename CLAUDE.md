# Giochi d'Ufficio: menu e giochi online

Raccolta di giochi web per i colleghi di Factorial. Interfaccia, commenti e risposte all'utente: **in italiano**.
Si gioca da computer con Chrome e, per menu, morra e briscola, **anche da telefono**: l'utente lo ha chiesto il 23/11/2026. Nerf e ItaliaGuessr restano da computer.

## Stile grafico (direzione Unslop, 23/11/2026)
- **Mondo**: il tavolino di un bar la sera.
- **Colori**: neutri caldi (`--bg #161513`, `--card`, `--raised`), testo crema `#efe9de` e un solo accento, il rosso piacentino `#c9302c`. Il colore vero sta solo negli oggetti di gioco: carte, mani, mappa, bersaglio.
- **Vietati**: niente gradienti, bagliori, testo sfumato, sfondi a macchie, emoji come icone, etichette maiuscole spaziate o punti esclamativi nell'interfaccia. Le grida in dialetto della morra fanno eccezione, perché sono contenuto del gioco.
- **Tipografia**: Bricolage Grotesque a peso 400–600, e JetBrains Mono per codici, punteggi e numeri.
- **Dettaglio firma**: i tasti (`kbd`, `.key`, le caselle del codice stanza).
- **Icone**: Lucide inline, con `icon(nome)` in `shared/core.js`.
- **Animazioni**: Anime.js 4.3.6 tramite `shared/motion.js` (`anim`, `timeline`, `enter`, `tween`). C'è una sola curva, `cubic-bezier(.22,1,.36,1)`, e "riduci movimento" viene rispettato.
  - La logica di gioco non deve mai aspettare la fine di un'animazione: con la scheda in background Anime.js si ferma. Per i tempi si usa `sleep`.
- **Oggetti condivisi**: `shared/mano.js` (mano della morra) e `shared/italia.js` (sagoma dell'Italia per il menu).
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

## Chi è online
- Tutte le pagine (anche ItaliaGuessr e Nerf, con un piccolo modulo in fondo alla pagina) entrano nel canale presence `gu:hub` con `announce({game, code, status})`.
- Il menu mostra "Online ora": cosa fa ciascuno, con i pulsanti "Entra"/"Guarda" per la sua stanza e 👋 per salutarlo.
- La lobby mostra "Invita chi è online". `ping(id, 'invite'|'wave')` fa comparire un avviso con il pulsante Entra in qualunque pagina stia guardando il destinatario.

## Uscita verso il menu
- Morra e briscola: c'è il pulsante "Giochi" nella barra in alto.
- ItaliaGuessr: "← Giochi" nel menu del gioco e 🏠 nell'HUD.
- Nerf: "← Giochi" sulle schermate. Durante la partita è nascosto, ma si esce con Esc e "Torna ai giochi" in pausa e a fine partita.

## Prossimi passi
1. **Estetica**: l'utente vuole un aspetto più moderno e minimale ma riconoscibile per tutti i giochi, e forse manderà repository o esempi da cui prendere spunto.
2. **Revisione generale** di funzioni e grafica di tutti i giochi.
3. **Scarta!**: meccaniche stile UNO, ma con nome e grafica originali, perché UNO è un marchio Mattel. Lobby da 2 a 10 giocatori.
4. **Multiplayer di Nerf**: in pausa per scelta dell'utente (23/11/2026). Il piano è in `nerf-salotto/CLAUDE.md`.

## Pubblicazione
- C'è un repository git locale (ramo `main`).
- Repository pubblico `mammetampenna/giochi-ufficio`, sito su GitHub Pages: https://mammetampenna.github.io/giochi-ufficio/ (si aggiorna da solo a ogni push su main, in circa un minuto). `gh` è autenticato.
- Nota: GitHub Pages gratuito richiede un repo pubblico, e il repo contiene la chiave Google Maps di ItaliaGuessr. Conviene limitarla ai domini autorizzati nella console di Google.
- `nerf-salotto/scan/` e `assets_src/` sono esclusi da git perché pesanti e personali.
