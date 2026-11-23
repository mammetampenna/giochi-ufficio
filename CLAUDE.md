# Giochi d'Ufficio: menu e giochi online

Raccolta di giochi web per i colleghi di Factorial. Si gioca **solo da computer, con Chrome**. Interfaccia, commenti e risposte all'utente: **in italiano**.
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

## Prossimi giochi (in ordine)
1. **Briscola**: l'utente vuole le **carte piacentine** il più fedeli possibile.
   - Va ancora deciso da dove prenderle. Opzioni: immagini con licenza libera (per esempio da Wikimedia Commons), da verificare e scaricare **solo dopo il permesso dell'utente**, oppure un ridisegno in SVG nello stile piacentino tradizionale.
   - Modalità: 1 contro 1, 2 contro 2 e contro il computer.
   - Le carte nascoste: ogni giocatore riceve solo la propria mano.
2. **Scarta!**: meccaniche stile UNO, ma con nome e grafica originali, perché UNO è un marchio Mattel. Lobby da 2 a 10 giocatori.
3. **Multiplayer di Nerf**: in pausa per scelta dell'utente (23/11/2026). Il piano è in `nerf-salotto/CLAUDE.md`.

## Pubblicazione
- C'è un repository git locale (ramo `main`).
- Il piano è GitHub Pages. La CLI `gh` è installata con Homebrew, ma l'utente deve ancora fare `gh auth login` e decidere se il repo sarà pubblico o privato.
- Nota: GitHub Pages gratuito richiede un repo pubblico, e il repo contiene la chiave Google Maps di ItaliaGuessr. Conviene limitarla ai domini autorizzati nella console di Google.
- `nerf-salotto/scan/` e `assets_src/` sono esclusi da git perché pesanti e personali.
