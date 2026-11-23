# Nerf in Salotto — gioco 3D a scala giocattolo

Sparatutto in terza/prima persona in stile Nerf, ambientato nella scansione 3D del salotto di casa (Scaniverse, iPhone).
Il giocatore è un soldatino d'azione alto pochi centimetri. Lo giochiamo con i colleghi di Factorial, **solo da computer** (Chrome).
Lingua dell'interfaccia e dei commenti: **italiano**.

## Come si costruisce e si prova
- `game.html` è il **sorgente** (modello). Contiene i segnaposto `/*ROOM_B64*/`, `/*LOW_B64*/`, `/*ASSETS_JSON*/null`.
- `python3 tools/build.py` crea **`nerf-salotto.html`** (~6,3 MB), un file unico autosufficiente con tutti i modelli in base64. Funziona anche aprendolo con doppio clic (file://).
- Librerie da CDN jsdelivr via importmap: three@0.170.0 (GLTFLoader, SkeletonUtils, MeshoptDecoder) e three-mesh-bvh@0.8.3.
- Test: `python3 tests/smoke.py` (Playwright + Chrome). Usa l'aggancio `window.__dbg`. `__dbg.sim(secondi, {KeyW:true,...})` avanza la fisica a passo fisso: serve perché senza GPU il gioco va a ~2 fps.
- Strumenti modelli (in `tools/`, `npm install` prima):
  - `npm run lowpoly` rigenera `models/lowpoly_0.08.glb` (~16k triangoli) da `scan/Scan_casa.glb` (solo posizioni, weld + meshopt simplify).
  - `npm run prep` rigenera `assets/*_m.glb` dai pacchetti originali. Vanno scompattati in `assets_src/` (vedi sotto); i nomi delle cartelle sono quelli in `prep.mjs`.
- `models/room_q.glb` è la scansione ridotta a ~81k triangoli con texture webp quantizzata (fatta con gltf-transform: weld, simplify, resize, webp, quantize).

## Struttura di game.html (un unico `<script type="module">`)
- **Costanti** (scala S=12): GRAVITY -32, JUMP 11, WALK 7, RUN 12, RADIUS .35, HEIGHT 1.55, EYE 1.35.
- **Jetpack**: FUEL_MAX 100, BURN 34, THRUST 52, MAX_UP 11, REGEN_AIR 12, REGEN_GROUND 38, REGEN_DELAY .6. In aria si tiene premuto Spazio (più di 0,22 s dopo il salto).
- **Atterraggi** in base alla velocità massima di caduta `fallV`:
  - sotto -34: BONK. Stordito 2,8 s: animazione Death01, poi LayToIdle, con stelline.
  - sotto -20: schiacciamento.
  - sotto -9: sbuffo di polvere.
- **loadRoom()**: i materiali diventano MeshBasicMaterial. Il collider è una copia Float32 delle posizioni (attenzione: le posizioni quantizzate vanno convertite prima di applyMatrix4), con MeshBVH e materiale DoubleSide (serve per i raycast).
- **Giocatore**: capsula con shapecast BVH, 3 sottopassi per fotogramma, ritorno in campo se esce dai limiti.
- **Soldatini** (codice preso da `parts/soldiers2.js`):
  - `CHARS` contiene i 3 personaggi; `loadAssets()` carica i modelli; `buildSoldier(def)` li costruisce, `animSoldier(s, stato, dt)` li anima.
  - Personaggi Quaternius Universal Base Characters (Superhero maschio/femmina), scala 1.5/1.82, ruotati di π: il modello guarda +z, il gioco -z.
  - **Divisa**: attributo `outfit` per vertice, scelto in base all'osso dominante (gambe = pantaloni, piedi = stivali, busto = maglia, mani = guanti). Uno shader (`onBeforeCompile`) mescola il colore della divisa con la luminosità della texture, per un effetto plastica.
  - Copricapo procedurale (basco / cappuccio artico con occhiali / casco con visiera) agganciato all'osso `Head`. Jetpack su `spine_03`.
  - **Animazioni a strati**: la parte bassa (root, pelvis, spine_01, gambe) fa Idle/Walk/Jog/Sprint/Jump/NinjaJump (volo). La parte alta mescola Pistol_Aim_Down/Neutral/Up in base al pitch, o Pistol_Reload. Clip intere per emote e BONK. I pesi vengono ammorbiditi a mano.
  - **Arma**: figlia del root. Ogni fotogramma si posiziona sulla mano destra (sulla spalla per il bazooka) e punta esattamente nella direzione di mira. Quando non si mira segue la mano con la presa memorizzata (`gripQ`).
- **I 3 personaggi**:
  - **Sergente Falco**: carabina a raffica, 30 colpi, si tiene premuto per sparare.
  - **Tenente Neve** (corpo femminile): fucile anti-materiale, 6 colpi, mirino col tasto destro (FOV 24 e overlay `#scope`).
  - **Capitano Vulcano**: lanciarazzi, 3 razzi, esplosione con raggio 4,5 che abbatte i bersagli vicini, salto a razzo se si esplode vicino a sé, jetpack ×1,35.
- **Proiettili**: `makeProj` / `shoot` / `updateDarts` / `explode`. In terza persona si mira con un raycast dalla camera; il colpo parte dalla canna (`weapon.userData.muzzle`).
- **Bersagli**: 14 su superfici orizzontali, distanti almeno 5; si vince colpendoli tutti. Il record viene salvato per personaggio in localStorage `nerf_best_<id>`.
- **Grafica**: "Scansione realistica" oppure "Low poly retrò". Il low poly usa `buildLowPoly()`:
  - il colore di ogni faccia è la mediana di 7 campioni presi dalla texture della scansione (punto più vicino col BVH, poi coordinate baricentriche, poi UV);
  - la tavolozza è ridotta in HSL, non in RGB (in RGB nascevano chiazze rosa e verdi);
  - pixel ratio 0,42 per i pixel grossi; il collider passa a quello low poly.
- **Schermate**: inizio (scelta grafica) → selezione soldatino (scena 3D separata `selScene`, trascina per ruotare, ← →, Invio) → partita → fine (Ancora / Cambia soldatino).
- **Comandi**: WASD, Shift corsa, Spazio salto/volo, clic spara, tasto destro mirino, R ricarica, V cambia visuale, 1 2 3 emote, Esc pausa.
- **Audio**: sintetizzato con WebAudio (`sfx`).

## Licenze degli asset
Tutti CC0: Quaternius (Universal Animation Library 1 e 2, Universal Base Characters, Sci-Fi Essentials Kit) e il pacchetto armi "3D low poly guns pack 2". "Action Man" è un marchio Hasbro: i personaggi sono originali e non devono copiarne nome o aspetto.
I pacchetti originali li ha l'utente in zip. Per rigenerare gli asset vanno scompattati in `assets_src/` con questi nomi di cartella:
- `Universal_Base_Characters_Standard_`
- `Universal_Animation_LibraryStandard`
- `Universal_Animation_Library_2Standard`
- `3D_low_poly_guns_pack_2`

Nel pacchetto Base Characters mancano due texture che il glTF richiede: copiare `T_Hair_1_Normal.png` come `T_Hair_1_Normal_png.png` e `T_Eye_Normal.png` come `T_Eye_Normal_png.png`.

## Da fare (in ordine di priorità)
1. **Multiplayer** con Supabase Realtime: stesso progetto Supabase di ItaliaGuessr, stanze con codice come in ItaliaGuessr. Modalità:
   - **Ultimo in piedi**, con potenziamenti (usare il Sci-Fi Essentials Kit: casse, kit medici, munizioni, granate, mine);
   - **Caccia al tesoro condivisa**: si spara agli oggetti per raccoglierli;
   - **Caccia al tesoro a tempo**: ognuno nella sua copia della mappa, con gli stessi oggetti, vince il tempo migliore.
2. **Ufficio low poly**: la scansione dell'ufficio richiede troppo tempo, quindi verrà rifatto low poly. Se lo si scansiona: chiedere il permesso ed evitare schermi, documenti e colleghi.
3. Un hub con almeno 3 giochi: ItaliaGuessr, Nerf, e un terzo da decidere. Idee:
   - una gara su Street View;
   - una guerra di carri armati nell'ufficio scansionato.
4. Rifiniture:
   - un vero saluto: nel pacchetto non c'è, ora il tasto 1 usa Idle_Rail_Call;
   - animazioni da fucile: il pacchetto Standard ha solo la mira con la pistola a due mani;
   - verificare in gioco reale, con GPU, la sensazione dei comandi e la sequenza BONK.
