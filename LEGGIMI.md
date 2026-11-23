# Giochi per l'ufficio: passaggio a Claude Code

Questa cartella contiene due progetti, ognuno con il suo `CLAUDE.md`, che Claude Code legge da solo:

- **italia-guessr/**: GeoGuessr sull'Italia con multiplayer su Supabase. È finito.
- **nerf-salotto/**: sparatutto 3D a scala giocattolo nel salotto scansionato. È in sviluppo.

## Come iniziare
1. Scompatta lo zip, per esempio in `~/Progetti/giochi-ufficio`.
2. Apri il terminale in quella cartella e lancia `claude`.
3. Incolla il messaggio qui sotto.
4. Per rigenerare i modelli 3D, scompatta i pacchetti Quaternius e quello delle armi in `nerf-salotto/assets_src/`. Le istruzioni sono in `nerf-salotto/CLAUDE.md`. Per giocare e modificare il codice non servono.

## Messaggio da incollare in Claude Code

```
Ciao! Continuo qui un lavoro iniziato in un'altra chat. In questa cartella ci sono due giochi
per i colleghi di Factorial, ognuno col suo CLAUDE.md: leggili entrambi prima di fare qualsiasi cosa.

- italia-guessr/: clone di GeoGuessr sull'Italia (Leaflet + Google Street View + Supabase). È finito.
  Unico lavoro rimasto: eliminare l'RPC seed_reference da Supabase e il codice di seed in app.js.
- nerf-salotto/: sparatutto 3D a scala giocattolo nella scansione del mio salotto
  (three.js 0.170 + three-mesh-bvh, soldatini Quaternius CC0 con animazioni, jetpack,
  3 personaggi con armi diverse, grafica realistica o low poly retrò).
  Si costruisce con `python3 tools/build.py` → nerf-salotto.html (file unico).

Rispondimi sempre in italiano. Gioco solo da computer, con Chrome.

Prossimo obiettivo: il multiplayer di Nerf in Salotto con Supabase Realtime (stesso progetto
Supabase di ItaliaGuessr, stanze con codice). Modalità:
1) ultimo in piedi con potenziamenti;
2) caccia al tesoro condivisa (si spara agli oggetti per raccoglierli);
3) caccia al tesoro a tempo, ognuno sulla sua copia della mappa con gli stessi oggetti.
Prima di scrivere codice proponimi un piano (architettura di rete, cosa sincronizzare, come
ospitare i file) e aspetta il mio ok. Ora che sei sul mio computer puoi anche avviare un server
locale e provare il gioco nel browser con la GPU vera.
```

## Cosa c'è dentro
- `italia-guessr/`:
  - `italia-guessr.html`: il gioco pronto;
  - `src/`: sorgenti;
  - `vendor/`: Leaflet;
  - `build.py`.
- `nerf-salotto/`:
  - `nerf-salotto.html`: il gioco pronto;
  - `game.html`: il sorgente;
  - `parts/soldiers2.js`: modulo dei soldatini, già copiato dentro game.html;
  - `assets/`: personaggi, animazioni e armi ottimizzati;
  - `models/`: salotto realistico e low poly;
  - `scan/Scan_casa.glb`: scansione originale;
  - `tools/`: script di build e di conversione dei modelli;
  - `tests/smoke.py`: test automatico.

Rifacendo la build da questi file si ottengono due HTML identici a quelli già consegnati.
