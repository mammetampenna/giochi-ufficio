/* ================= UTIL ================= */
const DEFAULT_GKEY = 'AIzaSyBJz_SddzqricoGn85-6SJjjn2-chz_lMc';
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const show = (el, on = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => Math.round(n).toLocaleString('it-IT');
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
function bearing(a, b) {
  const r = x => x * Math.PI / 180, y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat)), x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function haversine(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = km => km < 1 ? Math.round(km * 1000) + ' m' : (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km';
async function fetchJSON(url, { timeout = 9000, retries = 2 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
      if (r.status === 401 || r.status === 403) { const e = new Error('accesso negato (' + r.status + ')'); e.fatal = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { clearTimeout(t); last = e; if (e.fatal) throw e; if (i < retries) await sleep(500 * 2 ** i); }
  }
  throw last;
}
function preloadImg(src, timeout = 15000) {
  return new Promise((res, rej) => {
    const i = new Image(); const t = setTimeout(() => rej(new Error('immagine lenta')), timeout);
    i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(new Error('immagine non caricata')); };
    i.src = src;
  });
}
let nomiChain = Promise.resolve(), nomiLast = 0;
function nomi(url) {
  const p = nomiChain.then(async () => {
    const w = nomiLast + 1100 - Date.now(); if (w > 0) await sleep(w);
    nomiLast = Date.now(); return fetchJSON(url, { timeout: 8000, retries: 0 });
  });
  nomiChain = p.catch(() => {}); return p;
}

/* ================= GEOGRAFIA (confini ISTAT/openpolis incorporati) ================= */
function ringsOf(g) { return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; }
function inRing(x, y, r) { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
function inGeom(lat, lng, g) { return ringsOf(g).some(p => inRing(lng, lat, p[0]) && !p.slice(1).some(h => inRing(lng, lat, h))); }
function bboxOf(g) { let s = 90, w = 180, n = -90, e = -180; ringsOf(g).forEach(p => p[0].forEach(([x, y]) => { if (y < s) s = y; if (y > n) n = y; if (x < w) w = x; if (x > e) e = x; })); return [s, w, n, e]; }
function labelPoint(g) { // punto interno: centro del bbox se dentro, altrimenti un vertice mediato
  const [s, w, n, e] = bboxOf(g); const c = [(s + n) / 2, (w + e) / 2];
  if (inGeom(c[0], c[1], g)) return c;
  const big = ringsOf(g).sort((a, b) => b[0].length - a[0].length)[0][0];
  for (let i = 0; i < 40; i++) { const a = big[Math.floor(Math.random() * big.length)], b = big[Math.floor(Math.random() * big.length)]; const p = [(a[1] + b[1]) / 2, (a[0] + b[0]) / 2]; if (inGeom(p[0], p[1], g)) return p; }
  return [big[0][1], big[0][0]];
}
/* ---- modalità "Chi abita più vicino?" ---- */
const DEFAULT_PLAYERS = [
  { id: 'matteo', name: 'Matteo', home: 'Albano Laziale', lat: 41.7291, lng: 12.6587, col: '#ff6b4a', on: true },
  { id: 'samurai', name: 'Samurai', home: 'Catanzaro', lat: 38.9060, lng: 16.5944, col: '#5aa9ff', on: true },
  { id: 'giacomo', name: 'Giacomo', home: 'Todi', lat: 42.7822, lng: 12.4069, col: '#5ee3a1', on: true },
  { id: 'anna', name: 'Anna', home: "Sant'Andrea di Barbarana", lat: 45.7008, lng: 12.4567, col: '#c084fc', on: true },
  { id: 'livraghi', name: 'Livraghi', home: 'Milano', lat: 45.4668, lng: 9.1903, col: '#ffb547', on: true }
];
const PALETTE = ['#ff6b4a', '#5aa9ff', '#5ee3a1', '#c084fc', '#ffb547', '#f472b6', '#2dd4bf', '#a3e635', '#fb923c', '#93c5fd', '#fca5a5', '#e879f9'];
let PLAYERS = DEFAULT_PLAYERS.map(p => ({ ...p }));
try { const sp = JSON.parse(localStorage.getItem('cg_players') || 'null'); if (Array.isArray(sp) && sp.length) PLAYERS = sp; } catch (e) {}
const savePlayers = () => { try { localStorage.setItem('cg_players', JSON.stringify(PLAYERS)); } catch (e) {} };
let PEOPLE = PLAYERS.filter(p => p.on);
const refreshPeople = () => { PEOPLE = PLAYERS.filter(p => p.on); };
const nearestIdx = (pt, list = PEOPLE) => { let b = 0, bd = Infinity; list.forEach((pp, i) => { const d = haversine(pp, pt); if (d < bd) { bd = d; b = i; } }); return b; };
GEO.italia = { outline: ITALY_OUTLINE, comuni: [] };
REGIONS.italia = { name: 'Italia', scale: 0, towns: [], places: [] };
let AREAS = ['calabria', 'treviso', 'umbria', 'roma'];       // zone classiche attive (si aggiorna da impostazioni/database)
const AREA_META = {};                                          // id -> { kind, enabled, sort }
['calabria', 'treviso', 'umbria', 'roma'].forEach((k, i) => AREA_META[k] = { kind: 'curated', enabled: true, sort: i + 1 });
function inArea(k, lat, lng) {
  if (GEO[k] && GEO[k].comuni.length) { const c = comuneAt(lat, lng); return !!c && c.region === k; }
  return !!GEO[k] && inGeom(lat, lng, GEO[k].outline);
}
const isChi = () => cfg.region === 'italia';
function randomInItaly() {
  const [s, w, n, e] = bboxOf(ITALY_OUTLINE);
  for (let i = 0; i < 500; i++) { const lat = s + Math.random() * (n - s), lng = w + Math.random() * (e - w); if (inGeom(lat, lng, ITALY_OUTLINE)) return { lat, lng }; }
  return { lat: 42.5, lng: 12.5 };
}
const COMUNI = [];
Object.keys(GEO).forEach(k => {
  const b = bboxOf(GEO[k].outline); REGIONS[k].bounds = [[b[0], b[1]], [b[2], b[3]]];
  GEO[k].comuni.forEach(([name, g]) => COMUNI.push({ name, region: k, g, bb: bboxOf(g), n: norm(name) }));
});
function comuneAt(lat, lng) {
  for (const c of COMUNI) { const [s, w, n, e] = c.bb; if (lat >= s && lat <= n && lng >= w && lng <= e && inGeom(lat, lng, c.g)) return c; }
  return null;
}

/* ================= AUDIO ================= */
let actx = null, muted = store('cg_mute') === '1';
function beep(freq = 660, dur = .08, type = 'sine', vol = .12, delay = 0) {
  if (muted || !actx) return;
  const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + .02);
}
const sfx = {
  pin: () => beep(880, .06, 'triangle', .1), tick: () => beep(1000, .05, 'square', .05),
  win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, .18, 'triangle', .12, i * .09)),
  ok: () => [523, 659].forEach((f, i) => beep(f, .15, 'triangle', .1, i * .1)),
  bad: () => [300, 220].forEach((f, i) => beep(f, .2, 'sawtooth', .06, i * .14)),
  count: () => beep(1400, .025, 'square', .03),
  timeup: () => [440, 330, 220].forEach((f, i) => beep(f, .22, 'square', .07, i * .18)),
  whoosh: () => { if (muted || !actx) return; const t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(200, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + .35); g.gain.setValueAtTime(.06, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .42); }
};

/* ================= CONFETTI ================= */
const confetti = (() => {
  const cv = $('confetti'), ctx = cv.getContext('2d'); let parts = [], raf = null;
  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; }; addEventListener('resize', resize); resize();
  function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.y < cv.height + 20 && p.life-- > 0);
    for (const p of parts) { p.vy += .18; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    raf = parts.length ? requestAnimationFrame(loop) : null;
  }
  return (n = 160) => {
    const cols = ['#ff6b4a', '#ffb547', '#5ee3a1', '#5aa9ff', '#ffffff'];
    for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 240, y: innerHeight * .6, vx: (Math.random() - .5) * 17, vy: -Math.random() * 15 - 6,
      r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 8, c: cols[i % cols.length], life: 260 });
    if (!raf) loop();
  };
})();
function countUp(el, from, to, ms = 900, onTick) {
  return new Promise(res => {
    const t0 = performance.now(); let lt = 0;
    (function step(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (onTick && t - lt > 55 && k < 1) { onTick(); lt = t; }
      k < 1 ? requestAnimationFrame(step) : res(); })(t0);
  });
}

/* ================= STATO ================= */
const cfg = { region: 'calabria', timer: 180, rounds: 5, mode: 'sv', noMove: false, theme: 'notte', places: 'mix', showComuni: true, hoverNames: true, showTowns: true };
try { Object.assign(cfg, JSON.parse(store('cg_cfg3') || '{}')); } catch (e) {}
cfg.theme = 'satellite'; // le altre mappe non caricavano: resta solo il satellite
let game = null, preGame = null, cur = null, pending = null, guess = null, roundToken = 0;
let menuMap, gmap, rmap, gPin = null, rLayer = null;
let svService = null, svPanorama = null, mlyViewer = null;
const selRegions = () => cfg.region === 'mix' ? AREAS : [cfg.region];
function selBounds() { const b = L.latLngBounds([]); selRegions().forEach(k => b.extend(REGIONS[k].bounds)); return b; }

/* ================= STILI MAPPA ================= */
const CB = 'https://{s}.basemaps.cartocdn.com/', EB = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const cO = { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap © CARTO' };
const eO = { maxZoom: 19, attribution: 'Tiles © Esri' }, eC = { maxZoom: 19, maxNativeZoom: 16, attribution: 'Tiles © Esri' };
const EST = [[EB + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', eO]];
const OSM = [['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }]];
const GOO = [['https://mt{s}.google.com/vt/lyrs=m&hl=it&x={x}&y={y}&z={z}', { subdomains: '0123', maxZoom: 20, attribution: '© Google' }]];
const GOS = [['https://mt{s}.google.com/vt/lyrs=y&hl=it&x={x}&y={y}&z={z}', { subdomains: '0123', maxZoom: 20, attribution: '© Google' }]];
// per ogni stile: fonti in ordine di preferenza; se una non risponde passo alla successiva
const THEMES = {
  notte: { label: '🌙 Notte', dark: true, chain: [
    ['CARTO', [[CB + 'dark_nolabels/{z}/{x}/{y}{r}.png', cO], [CB + 'dark_only_labels/{z}/{x}/{y}{r}.png', cO]]],
    ['Esri', [[EB + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', eC], [EB + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', eC]]],
    ['Esri Street', EST], ['OpenStreetMap', OSM]] },
  giorno: { label: '☀️ Giorno', dark: false, chain: [
    ['CARTO', [[CB + 'rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', cO], [CB + 'rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', cO]]],
    ['Esri Street', EST], ['OpenStreetMap', OSM]] },
  satellite: { label: '🛰️ Satellite', dark: true, chain: [
    ['Esri', [[EB + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', eO], [EB + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', eO]]]] },
  rilievo: { label: '⛰️ Rilievo', dark: false, chain: [
    ['Esri', [[EB + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}', eO]]], ['OpenStreetMap', OSM]] }
};
const provIdx = {}; Object.keys(THEMES).forEach(k => { const v = +store('cg_prov_' + k); provIdx[k] = v > 0 && v < THEMES[k].chain.length ? v : 0; });
const curSet = () => THEMES[cfg.theme].chain[provIdx[cfg.theme]] || THEMES[cfg.theme].chain[0];
const allMaps = [];
function tileUrl(tpl, o, x, y, z) { const sd = o.subdomains || 'abc'; return L.Util.template(tpl, { s: sd[Math.abs(x + y) % sd.length], x, y, z: Math.min(z, o.maxNativeZoom || 99), r: L.Browser.retina ? '@2x' : '' }); }
// prova una tessera (Italia centrale, zoom 6) con timeout: così scopro subito se la fonte risponde
function probe(set) {
  return new Promise(res => {
    const [tpl, o] = set[1][0]; const img = new Image(); const t = setTimeout(() => { img.src = ''; res(false); }, 4000);
    img.onload = () => { clearTimeout(t); res(img.naturalWidth > 0); }; img.onerror = () => { clearTimeout(t); res(false); };
    img.src = tileUrl(tpl, o, 34, 23, 6) + (tpl.includes('?') ? '&' : '?') + '_p=' + Date.now();
  });
}
let probing = {};
async function ensureProvider(theme = cfg.theme, from = provIdx[theme]) {
  if (probing[theme]) return probing[theme];
  probing[theme] = (async () => {
    const chain = THEMES[theme].chain;
    mapStatus('loading', 'Carico la mappa…');
    // provo tutte le fonti in parallelo; scelgo la prima (in ordine di preferenza) che risponde
    const tries = chain.slice(from).map(probe);
    for (let j = 0; j < tries.length; j++) {
      if (await tries[j]) {
        const i = from + j, changed = provIdx[theme] !== i; provIdx[theme] = i; store('cg_prov_' + theme, i);
        if (changed && cfg.theme === theme) { allMaps.forEach(applyTheme); warmTiles(); }
        mapStatus('ok', 'Mappa: ' + chain[i][0]); return true;
      }
    }
    mapStatus('err', 'Le mappe non rispondono: controlla la connessione o un blocco pubblicità'); return false;
  })();
  const r = await probing[theme]; probing[theme] = null; return r;
}
function failover() { const th = cfg.theme; if (probing[th]) return; if (provIdx[th] + 1 < THEMES[th].chain.length) ensureProvider(th, provIdx[th] + 1); else mapStatus('err', 'Le mappe non rispondono'); }
function mapStatus(kind, txt) {
  const el = $('mapStatus'); if (!el) return;
  el.className = 'glass ' + kind; el.querySelector('span').textContent = txt;
  show(el.querySelector('button'), kind === 'err');
  clearTimeout(el._h); if (kind === 'ok') el._h = setTimeout(() => el.classList.add('gone'), 2500);
}
// zoom fluido: segue la rotellina e le dita sul trackpad, un passo per fotogramma, centrato sul cursore
function smoothZoom(m) {
  let acc = 0, raf = null, pt = null;
  m.getContainer().addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    acc += -dy * (e.ctrlKey ? .011 : .0028);   // ctrlKey = pizzico del trackpad
    pt = m.mouseEventToContainerPoint(e);
    if (!raf) raf = requestAnimationFrame(() => {
      raf = null;
      const z = Math.max(m.getMinZoom(), Math.min(m.getMaxZoom(), m.getZoom() + Math.max(-1, Math.min(1, acc))));
      acc = 0; if (Math.abs(z - m.getZoom()) > .001) m.setZoomAround(pt, z, { animate: false });
    });
  }, { passive: false });
}
function makeMap(id, attrib, fast) {
  const m = L.map(id, { zoomControl: false, attributionControl: attrib, zoomSnap: 0, zoomDelta: .75, scrollWheelZoom: false, worldCopyJump: false, preferCanvas: !!fast });
  smoothZoom(m);
  m.createPane('labels'); Object.assign(m.getPane('labels').style, { zIndex: 650, pointerEvents: 'none' });
  m.createPane('deco'); m.getPane('deco').style.zIndex = 420;
  m._cg = { tiles: [], deco: L.layerGroup().addTo(m), com: null, towns: L.layerGroup().addTo(m), canvas: L.canvas({ padding: .5 }) };
  m.on('zoomend', () => {
    m.getContainer().classList.toggle('zhi', m.getZoom() >= 10);
    if (m._cg.com) m._cg.com.setStyle(comStyle(m));
  });
  m.setView([42.2, 13.5], 6);
  allMaps.push(m); applyTheme(m); return m;
}
function applyTheme(m) {
  m._cg.tiles.forEach(l => m.removeLayer(l)); m._cg.tiles = [];
  const th = THEMES[cfg.theme], set = curSet();
  m.getContainer().classList.toggle('day', !th.dark);
  let ok = 0, err = 0;
  set[1].forEach((d, i) => {
    const l = L.tileLayer(d[0], { ...d[1], pane: i ? 'labels' : 'tilePane', keepBuffer: 8, updateWhenZooming: false }).addTo(m);
    m._cg.tiles.push(l);
    if (i === 0) {
      l.on('tileload', () => ok++);
      l.on('tileerror', () => { if (++err >= 4 && ok === 0) failover(); });
      // se dopo 7 secondi non è arrivata nessuna tessera (richieste bloccate o appese) cambio fonte
      setTimeout(() => { if (ok === 0 && m._cg.tiles.includes(l) && m.getContainer().offsetWidth) failover(); }, 7000);
    }
  });
}
function setTheme(t) {
  cfg.theme = t; store('cg_cfg3', JSON.stringify(cfg));
  allMaps.forEach(m => { applyTheme(m); decorate(m, m._cg.opts); });
  ensureProvider(t);
  document.querySelectorAll('#themeChips .theme').forEach(c => c.classList.toggle('sel', c.dataset.v === t));
  warmTiles();
}
function comStyle(m) {
  const dark = THEMES[cfg.theme].dark, z = m.getZoom();
  return { color: dark ? '#ffffff' : '#1d2a3a', weight: z >= 10 ? 1 : .6, opacity: z >= 11 ? .45 : z >= 9 ? .3 : .14, fill: true, fillOpacity: 0, fillColor: '#ff6b4a' };
}
// spotlight sulla zona di gioco + bordo luminoso + comuni + etichette città
function decorate(m, opts = {}) {
  m._cg.opts = opts;
  m._cg.deco.clearLayers(); m._cg.towns.clearLayers();
  if (m._cg.com) { m.removeLayer(m._cg.com); m._cg.com = null; }
  const dark = THEMES[cfg.theme].dark, regs = opts.regions || selRegions();
  const holes = [];
  regs.forEach(k => ringsOf(GEO[k].outline).forEach(p => holes.push(p[0].map(([x, y]) => [y, x]))));
  L.polygon([[[85, -180], [85, 180], [-85, 180], [-85, -180]], ...holes],
    { pane: 'deco', stroke: false, fillColor: dark ? '#03060b' : '#0b1626', fillOpacity: dark ? .62 : .42, interactive: false }).addTo(m._cg.deco);
  regs.forEach(k => {
    L.geoJSON(GEO[k].outline, { pane: 'deco', interactive: false, style: { color: '#ff6b4a', weight: 9, opacity: .18, fill: false } }).addTo(m._cg.deco);
    L.geoJSON(GEO[k].outline, { pane: 'deco', interactive: false, style: { color: '#ff6b4a', weight: 2.5, fill: false } }).addTo(m._cg.deco);
  });
  if (opts.comuni !== false && cfg.showComuni) {
    const feats = [];
    regs.forEach(k => GEO[k].comuni.forEach(([name, g]) => feats.push({ type: 'Feature', properties: { name, region: k }, geometry: g })));
    m._cg.com = L.geoJSON({ type: 'FeatureCollection', features: feats }, { renderer: m._cg.canvas, style: () => comStyle(m),
      onEachFeature: (f, l) => {
        if (!opts.hover || !cfg.hoverNames) return;
        l.bindTooltip(f.properties.name, { sticky: true, className: 'comtip', direction: 'top', offset: [0, -8] });
        l.on('mouseover', () => l.setStyle({ fillOpacity: .16, opacity: .9, weight: 1.5, color: '#ff6b4a' }));
        l.on('mouseout', () => l.setStyle(comStyle(m)));
      } }).addTo(m);
  }
  if (opts.towns !== false && regs.includes('italia')) PEOPLE.forEach(pp => L.marker([pp.lat, pp.lng], { interactive: false,
    icon: L.divIcon({ className: '', html: '<div class="hchip" style="--c:' + pp.col + '"><b>' + pp.name[0] + '</b>' + esc(pp.name) + '</div>', iconSize: [0, 0] }) }).addTo(m._cg.towns));
  if (opts.towns !== false && cfg.showTowns) regs.forEach(k => REGIONS[k].towns.forEach(t =>
    L.marker([t[1], t[2]], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="tchip">' + esc(t[0]) + '</div>', iconSize: [0, 0] }) }).addTo(m._cg.towns)));
  m.getContainer().classList.toggle('zhi', m.getZoom() >= 10);
}

/* ---- precaricamento tessere: scarico in anticipo la zona, ai livelli di zoom usati ---- */
const warmCache = new Set(); let warmQueue = [], warmBusy = 0;
function lng2x(l, z) { return Math.floor((l + 180) / 360 * 2 ** z); }
function lat2y(a, z) { const r = a * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); }
function warmTiles() {
  const set = curSet()[1], b = selBounds();
  const zooms = cfg.region === 'italia' ? [5, 6] : cfg.region === 'mix' ? [5, 6, 7] : cfg.region === 'roma' ? [9, 10, 11] : [7, 8, 9];
  const urls = [];
  zooms.forEach(z => {
    for (let x = lng2x(b.getWest(), z); x <= lng2x(b.getEast(), z); x++)
      for (let y = lat2y(b.getNorth(), z); y <= lat2y(b.getSouth(), z); y++)
        set.forEach(([tpl, o]) => urls.push(tileUrl(tpl, o, x, y, z)));
  });
  warmQueue = urls.filter(u => !warmCache.has(u)).slice(0, 260);
  for (let i = 0; i < 6; i++) warmNext();
}
function warmNext() {
  if (warmBusy >= 6 || !warmQueue.length) return;
  const u = warmQueue.shift(); warmCache.add(u); warmBusy++;
  const img = new Image(); img.onload = img.onerror = () => { warmBusy--; setTimeout(warmNext, 15); }; img.src = u;
}

/* ================= MENU ================= */
function chipGroup(id, key, cast = x => x, after) {
  const box = $(id);
  box.querySelectorAll('[data-v]').forEach(b => {
    b.classList.toggle('sel', String(cfg[key]) === b.dataset.v);
    b.addEventListener('click', () => {
      box.querySelectorAll('[data-v]').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
      cfg[key] = cast(b.dataset.v); store('cg_cfg3', JSON.stringify(cfg)); onCfgChange(); after && after();
    });
  });
}
const THEME_PREV = { notte: 'linear-gradient(135deg,#0b111b 0%,#1a2533 55%,#ff6b4a 56%,#0b111b 60%)', giorno: 'linear-gradient(135deg,#eef1f4 0%,#d8e2ea 55%,#ff6b4a 56%,#cfe3d6 60%)',
  satellite: 'linear-gradient(135deg,#1f3b2a 0%,#3d5a3a 40%,#6b7c5a 55%,#1d4e6b 60%)', rilievo: 'linear-gradient(135deg,#f3eedb 0%,#d9d2b0 45%,#b9c79a 55%,#a7cbe0 62%)' };
$('themeChips').innerHTML = Object.entries(THEMES).map(([k, t]) => '<button class="theme" data-v="' + k + '"><i style="background:' + THEME_PREV[k] + '"></i><b>' + t.label + '</b></button>').join('');
$('themeChips').querySelectorAll('.theme').forEach(c => c.onclick = () => { setTheme(c.dataset.v); renderSummary(); });

chipGroup('timerChips', 'timer', Number); chipGroup('roundChips', 'rounds', Number);
chipGroup('modes', 'mode', x => x, () => prewarmRound());
document.querySelectorAll('#themeChips .theme').forEach(c => c.classList.toggle('sel', c.dataset.v === cfg.theme));
chipGroup('placesOpts', 'places', x => x, () => prewarmRound());
$('noMove').checked = !!cfg.noMove;
$('mlyToken').value = store('cg_mly') || '';
$('apiKey').value = store('cg_key') || DEFAULT_GKEY;
const recKey = () => 'cg_rec_' + cfg.region + '_' + cfg.timer + '_' + cfg.rounds + (cfg.places === 'mix' ? '' : '_' + cfg.places);
function onCfgChange() {
  show('mlyBox', cfg.mode === 'mly'); show('svBox', cfg.mode === 'sv');
  const r = +store(recKey()) || 0;
  $('recordTxt').textContent = r ? '🏆 Record con queste impostazioni: ' + fmt(r) + ' punti' : '';
  try { renderSummary(); } catch (e) {}
}
onCfgChange();
function menuFocus() {
  const tag = $('regionTag'); tag.classList.add('swap');
  setTimeout(() => { const tn = isChi() ? 'Chi abita più vicino?' : REGIONS[cfg.region] ? REGIONS[cfg.region].name : ''; tag.querySelector('span').textContent = tn; tag.style.fontSize = tn.length > 34 ? '30px' : tn.length > 22 ? '40px' : ''; tag.classList.remove('swap'); }, 250);
  if (zoneEditing) return;
  decorate(menuMap, { comuni: true, hover: false });
  const wide = innerWidth > 900;
  menuMap.flyToBounds(selBounds(), { paddingTopLeft: [wide ? 640 : 20, 40], paddingBottomRight: [wide ? 60 : 20, wide ? 110 : 20], duration: wide ? 1.4 : .8 });
  warmTiles();
}
menuMap = makeMap('menuMap', true);
ensureProvider();
$('mapStatus').querySelector('button').onclick = () => ensureProvider(cfg.theme, 0);
menuMap.setView([42.2, 13.5], 6);
setTimeout(menuFocus, 150);
addEventListener('resize', () => { if (!$('menu').classList.contains('hidden')) menuMap.invalidateSize(); });

$('playBtn').onclick = async () => {
  $('menuErr').textContent = ''; cfg.noMove = $('noMove').checked;
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (cfg.mode === 'mly') {
    const t = $('mlyToken').value.trim(); if (!t) return $('menuErr').textContent = 'Inserisci il token Mapillary.';
    store('cg_mly', t);
    for (let i = 0; i < 20 && !window.mapillary; i++) await sleep(250);
    if (!window.mapillary) return $('menuErr').textContent = 'Libreria Mapillary non caricata: controlla la connessione.';
  }
  if (cfg.mode === 'sv') {
    const k = $('apiKey').value.trim(); if (!k) return $('menuErr').textContent = 'Inserisci la chiave Google Maps.';
    if (gAuthFailed) return $('menuErr').textContent = 'Google ha rifiutato la chiave: controlla in Google Cloud che la Maps JavaScript API sia abilitata e che la chiave non abbia restrizioni per siti web.';
    store('cg_key', k); setPlay(true, 'Carico Google Maps…');
    try { await loadGoogle(k); } catch (e) { $('menuErr').textContent = 'Google Maps non si carica: ' + e.message; return setPlay(false); }
    setPlay(false);
  }
  store('cg_cfg3', JSON.stringify(cfg));
  startGame();
};
function setPlay(busy, txt) { $('playBtn').disabled = busy; $('playBtn').textContent = busy ? txt : 'Gioca'; }
let gLoading = null, gAuthFailed = false;
function loadGoogle(key) {
  if (window.google && google.maps && google.maps.StreetViewService) return Promise.resolve();
  if (gLoading) return gLoading;
  gLoading = new Promise((res, rej) => {
    window.__gmOk = res;
    window.gm_authFailure = () => {
      gAuthFailed = true; preGame = null;
      const msg = 'Google non accetta la chiave (API non abilitata, fatturazione non attiva o restrizione per siti web). Usa "Foto reali" o "Mapillary", oppure sistema la chiave.';
      if (!$('menu').classList.contains('hidden')) $('menuErr').textContent = msg; else { toMenu(); $('menuErr').textContent = msg; }
    };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=__gmOk&v=weekly';
    s.onerror = () => { gLoading = null; rej(new Error('script non caricato')); }; document.head.appendChild(s);
    setTimeout(() => { gLoading = null; rej(new Error('timeout')); }, 15000);
  });
  return gLoading;
}
// preparo già il primo round mentre sei nel menu
function newGame() { return { round: 0, total: 0, streak: 0, history: [], deck: [], usedImg: new Set(), usedPlace: new Set(), region: cfg.region, mode: cfg.mode, places: cfg.places, pkey: playersKey() }; }
async function prewarmRound() {
  preGame = null;
  if (cfg.mode === 'mly') return;
  if (cfg.mode === 'sv') { const k = $('apiKey').value.trim(); if (!k) return; try { await loadGoogle(k); } catch (e) { return; } }
  const g = newGame(); g.pending = prepareRound(g); g.pending.catch(() => {}); preGame = g;
}
setTimeout(prewarmRound, 400);

/* ================= MAPPA DI GIOCO ================= */
function initMaps() {
  if (gmap) return;
  gmap = makeMap('gmap', false, true);
  rmap = makeMap('rmap', true);
  gmap.on('click', e => setGuess(e.latlng.lat, e.latlng.lng));
  $('zIn').onclick = () => gmap.zoomIn(); $('zOut').onclick = () => gmap.zoomOut();
  $('fitBtn').onclick = () => gmap.flyToBounds(selBounds(), { duration: .7, padding: [10, 10] });
  $('themeBtn').onclick = () => { const ks = Object.keys(THEMES); const t = ks[(ks.indexOf(cfg.theme) + 1) % ks.length]; setTheme(t); toast('Stile mappa: ' + THEMES[t].label); };
  $('bigBtn').onclick = () => { $('guessBox').classList.toggle('big'); $('bigBtn').classList.toggle('on'); };
  // si ingrandisce al passaggio del mouse; si rimpicciolisce solo un attimo dopo che esci, mai mentre zoomi o trascini
  const box = $('guessBox'); let hovT = null, busyUntil = 0;
  const refit = () => gmap.invalidateSize({ pan: true, animate: false, debounceMoveend: true });
  const setHov = on => {
    if (box.classList.contains('hov') === on) return;
    box.classList.toggle('hov', on); setTimeout(refit, 160);
  };
  box.addEventListener('mouseenter', () => { if (isPhone()) return; clearTimeout(hovT); setHov(true); });
  box.addEventListener('mouseleave', () => {
    if (isPhone()) return; clearTimeout(hovT);
    const tryClose = () => {
      const stillBusy = Date.now() < busyUntil || document.activeElement === $('search') || !$('sugg').classList.contains('hidden');
      if (stillBusy) hovT = setTimeout(tryClose, 400); else setHov(false);
    };
    hovT = setTimeout(tryClose, 650);
  });
  gmap.on('zoom move', () => { busyUntil = Date.now() + 700; });
  box.addEventListener('transitionend', e => { if (e.target === $('gmap') || e.target === box) refit(); });
}
function pinIcon() { return L.divIcon({ className: '', html: '<div class="gpin"><i></i></div>', iconSize: [0, 0] }); }
function setGuess(lat, lng, label) {
  if (!cur || cur.done) return;
  guess = { lat, lng };
  if (gPin) gmap.removeLayer(gPin);
  gPin = L.marker([lat, lng], { icon: pinIcon(), interactive: false }).addTo(gmap);
  sfx.pin();
  const c = comuneAt(lat, lng);
  $('gInfo').innerHTML = c ? '📍 <b>' + esc(c.name) + '</b> · ' + esc(REGIONS[c.region].name) : '📍 ' + (label ? '<b>' + esc(label) + '</b> · ' : '') + 'fuori dalle zone di gioco';
  const b = $('guessBtn'); b.disabled = false; b.textContent = 'Indovina'; b.classList.add('ready'); syncFab(); buzz(15);
}
$('guessBtn').onclick = () => submit(false);

/* ---- ricerca: comuni istantanei + luoghi (Nominatim) ---- */
let sTimer = null, sQ = '', sIdx = -1;
$('search').addEventListener('input', () => {
  clearTimeout(sTimer); const q = $('search').value.trim();
  if (q.length < 2) return show('sugg', false);
  renderSugg(q, localMatches(q), null);
  sTimer = setTimeout(() => remoteSearch(q), 550);
});
function localMatches(q) {
  const extra = selRegions().filter(k => !GEO[k].comuni.length);
  if (extra.length) {
    const n0 = norm(q), seen = new Set();
    const loc = CENTRI.filter(c => norm(c[0]).includes(n0) && extra.some(k => inArea(k, c[1], c[2])))
      .sort((a, b) => (norm(b[0]).startsWith(n0) - norm(a[0]).startsWith(n0)) || b[4] - a[4]).slice(0, 6)
      .map(c => ({ name: c[0], region: extra.find(k => inArea(k, c[1], c[2])), lp: [c[1], c[2]], n: norm(c[0]) }));
    loc.forEach(c => seen.add(c.name));
    const cur = COMUNI.filter(c => selRegions().includes(c.region) && c.n.includes(n0) && !seen.has(c.name)).slice(0, 6 - loc.length);
    return loc.concat(cur);
  }
  const n = norm(q), regs = selRegions();
  return COMUNI.filter(c => regs.includes(c.region) && c.n.includes(n))
    .sort((a, b) => (b.n.startsWith(n) - a.n.startsWith(n)) || a.name.length - b.name.length).slice(0, 6);
}
function renderSugg(q, local, remote) {
  if (q !== $('search').value.trim()) return;
  sQ = q; sIdx = -1; const box = $('sugg'); box.innerHTML = '';
  const add = (html, fn) => { const d = document.createElement('div'); d.innerHTML = html; d.dataset.i = 1; d.onclick = fn; box.appendChild(d); };
  if (local.length) {
    box.insertAdjacentHTML('beforeend', '<div class="sec">Comuni</div>');
    local.forEach(c => add(esc(c.name) + '<small>' + esc(REGIONS[c.region].name) + '</small>', () => {
      const p = c.lp || (c.lp = labelPoint(c.g)); pick(p[0], p[1], c.name);
    }));
  }
  if (remote === null) box.insertAdjacentHTML('beforeend', '<div class="muted">Cerco frazioni e luoghi…</div>');
  else if (remote.length) {
    box.insertAdjacentHTML('beforeend', '<div class="sec">Luoghi</div>');
    remote.forEach(d => add(esc(d.name || d.display_name.split(',')[0]) + '<small>' + esc(d.display_name.split(',').slice(1, 3).join(',')) + '</small>',
      () => pick(+d.lat, +d.lon, d.name || d.display_name.split(',')[0])));
  } else if (!local.length) box.insertAdjacentHTML('beforeend', '<div class="muted">Nessun risultato</div>');
  show(box);
}
function pick(lat, lng, name) {
  setGuess(lat, lng, name); gmap.flyTo([lat, lng], 12, { duration: .9 });
  show('sugg', false); $('search').value = name; $('search').blur();
}
async function remoteSearch(q) {
  let url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=it&countrycodes=it&q=' + encodeURIComponent(q);
  const b = selBounds(); url += '&bounded=1&viewbox=' + [b.getWest() - .05, b.getNorth() + .05, b.getEast() + .05, b.getSouth() - .05].join(',');
  let remote = [];
  try { remote = (await nomi(url)).filter(d => comuneAt(+d.lat, +d.lon) && d.addresstype !== 'municipality' && d.type !== 'administrative'); } catch (e) {}
  renderSugg(q, localMatches(q), remote);
}
$('search').addEventListener('keydown', e => {
  const items = [...$('sugg').querySelectorAll('div[data-i]')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return;
    sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('act', i === sIdx)); }
  else if (e.key === 'Enter') { e.preventDefault(); if (items.length && !$('sugg').classList.contains('hidden')) (items[sIdx] || items[0]).click(); else if (guess) submit(false); }
  else if (e.key === 'Escape') show('sugg', false);
});
document.addEventListener('click', e => { if (!$('searchRow').contains(e.target)) show('sugg', false); });
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || document.activeElement.tagName === 'INPUT') return;
  if ($('result').classList.contains('show')) { e.preventDefault(); if (!$('nextBtn').classList.contains('hidden')) $('nextBtn').click(); }
  else if (guess && cur && !cur.done) { e.preventDefault(); submit(false); }
});

/* ================= PREPARAZIONE ROUND ================= */
function nearTown(lat, lng, km) { for (const c of CENTRI) { if (Math.abs(c[1] - lat) < .1 && Math.abs(c[2] - lng) < .13 && haversine({ lat, lng }, { lat: c[1], lng: c[2] }) < km) return true; } return false; }
function inItaly(lat, lng) { return inGeom(lat, lng, ITALY_OUTLINE) || nearTown(lat, lng, 6); }
function okLoc(e, lat, lng) {
  if (e.region !== 'italia') return inArea(e.region, lat, lng);
  if (!inItaly(lat, lng)) return false;
  // nella modalità "chi abita più vicino" il posto deve restare nella "zona" del giocatore estratto
  return e.who == null || nearestIdx({ lat, lng }) === e.who;
}
const BAD = /(map|mappa|carta|stemma|coat.of.arms|logo|flag|bandiera|\.svg|\.pdf|\.tiff?|locator|diagram|plan|pianta|schema|\.webm|\.ogv|\.ogg|\.gif|ritratto|portrait|targa|lapide|insegna|epigrafe|document|libro|book|francobollo|interno|interior|affresco|fresco|dipinto|painting|statua|statue|scultura|sculpture|detail|dettaglio|reperto|museo|museum)/i;
/* ---- scelta del posto in base a "Dove ti posso lanciare" ---- */
const POI_NAMES = new Set(['Santuario di San Francesco di Paola', 'Capo Colonna', 'Parco archeologico di Scolacium', 'Sibari', 'Capo Vaticano', 'Le Castella',
  'Tempio Canoviano di Possagno', 'Villa di Maser', 'Abbazia di Follina', 'Castello di San Salvatore', 'Molinetto della Croda', 'Cascata delle Marmore', 'Fonti del Clitunno',
  'Colosseo', 'Fontana di Trevi', 'Pantheon', 'Piazza Navona', 'Piazza di Spagna', 'Piazza del Popolo', "Castel Sant'Angelo", "Campo de' Fiori", 'Altare della Patria',
  'Circo Massimo', 'Terme di Caracalla', 'Villa Borghese', 'Gianicolo', 'Giardino degli Aranci', 'Piramide Cestia', 'San Paolo fuori le Mura', 'EUR — Palazzo della Civiltà',
  'San Giovanni in Laterano', 'Santa Maria Maggiore', 'Via Appia Antica', 'Parco degli Acquedotti', 'Foro Italico', 'Ponte Milvio', 'Ostia Antica', 'Lago di Nemi', 'Lago Albano']);
function randomIn(k) {
  const g = GEO[k].outline, [s, w, n, e] = bboxOf(g);
  for (let i = 0; i < 800; i++) { const lat = s + Math.random() * (n - s), lng = w + Math.random() * (e - w); if (inGeom(lat, lng, g)) return { lat, lng }; }
  const b = REGIONS[k].bounds; return { lat: (b[0][0] + b[1][0]) / 2, lng: (b[0][1] + b[1][1]) / 2 };
}
const centriCache = {};
function centriFor(k) {   // centri dei comuni dentro la zona, con peso ~ radice della popolazione
  if (centriCache[k]) return centriCache[k];
  const list = k === 'italia' ? CENTRI.filter(c => inGeom(c[1], c[2], ITALY_OUTLINE)) : CENTRI.filter(c => inArea(k, c[1], c[2]));
  let acc = 0; const cum = list.map(c => (acc += Math.sqrt(Math.max(c[4], 50))));
  return centriCache[k] = { list, cum, tot: acc };
}
const centriWho = {};
function centriForWho(who) {   // centri dei comuni nella "zona" di un giocatore (quelli più vicini a lui che agli altri)
  const key = PEOPLE.map(p => p.id || p.name).join('|') + '#' + who;
  if (centriWho[key]) return centriWho[key];
  const list = centriFor('italia').list.filter(c => nearestIdx({ lat: c[1], lng: c[2] }) === who);
  let acc = 0; const cum = list.map(c => (acc += Math.sqrt(Math.max(c[4], 50))));
  return centriWho[key] = { list, cum, tot: acc };
}
function pickCentro(k, g, who) {
  const { list, cum, tot } = who != null ? centriForWho(who) : centriFor(k);
  if (!list.length) return centriFor(k).list[0];
  for (let i = 0; i < 30; i++) {
    const r = Math.random() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    const c = list[lo]; if (!g.usedPlace.has(c[0])) { g.usedPlace.add(c[0]); return c; }
  }
  return list[Math.floor(Math.random() * list.length)];
}
function nextDeckEntry(g) {
  const regs = g.region === 'mix' ? AREAS : [g.region];
  const k = regs[Math.floor(Math.random() * regs.length)];
  let type = g.places || 'mix';
  if (type === 'mix') type = k === 'italia' || !(REGIONS[k].places || []).length ? (Math.random() < .5 ? 'urban' : 'poi') : 'curated';
  // modalità persone: estraggo prima CHI deve risultare il più vicino, così ogni giocatore esce con la stessa frequenza
  const who = k === 'italia' && PEOPLE.length ? Math.floor(Math.random() * PEOPLE.length) : null;
  if (type === 'all') {
    let p = k === 'italia' ? randomInItaly() : randomIn(k);
    if (who != null) for (let i = 0; i < 3000 && nearestIdx(p) !== who; i++) p = randomInItaly();
    return { region: k, place: ['', p.lat, p.lng], random: true, who };
  }
  if (type === 'urban') { const c = pickCentro(k, g, who); return { region: k, place: [c[0], c[1], c[2]], prov: c[3], who }; }
  if (type === 'poi' && k === 'italia') return { region: k, wiki: true, who };
  if (type === 'poi') {
    const cur = k === 'italia' ? [] : REGIONS[k].places.filter(p => POI_NAMES.has(p[0]) && !g.usedPlace.has(p[0]));
    if (cur.length && Math.random() < .35) { const p = cur[Math.floor(Math.random() * cur.length)]; g.usedPlace.add(p[0]); return { region: k, place: p, poi: true }; }
    return { region: k, wiki: true };
  }
  // curated (misto nelle zone)
  if (!g.deck.length) { const all = []; regs.forEach(r => (REGIONS[r].places || []).forEach(p => all.push({ region: r, place: p }))); g.deck = shuffle(all); }
  if (!g.deck.length) return { region: k, wiki: true };
  return g.deck.pop();
}
// castelli, cattedrali, basiliche, siti archeologici, palazzi, piazze, fontane, templi, fortificazioni, fari, torri, abbazie, monasteri,
// giardini, attrazioni turistiche, monumenti, cascate, ponti, porte, teatri, chiese
const WD_TYPES = ['Q23413', 'Q2977', 'Q163687', 'Q839954', 'Q16560', 'Q174782', 'Q483453', 'Q44539', 'Q57821', 'Q39715', 'Q12518', 'Q160742', 'Q44613',
  'Q1107656', 'Q570116', 'Q4989906', 'Q34038', 'Q12280', 'Q53060', 'Q24354', 'Q1088552', 'Q16970'];
let POIS = null, poisLoading = null;
function loadPois() {
  if (POIS) return Promise.resolve(POIS);
  if (poisLoading) return poisLoading;
  poisLoading = (async () => {
    try { const c = JSON.parse(localStorage.getItem('cg_pois2') || 'null'); if (c && c.t > Date.now() - 30 * 864e5 && c.d.length > 200) return POIS = c.d; } catch (e) {}
    try {
      const q = 'SELECT ?item ?l ?lat ?lon ?sl WHERE { VALUES ?type { ' + WD_TYPES.map(t => 'wd:' + t).join(' ') + ' } ?item wdt:P31 ?type; wdt:P17 wd:Q38; wikibase:sitelinks ?sl. FILTER(?sl >= 6) '
        + '?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat; wikibase:geoLongitude ?lon ]. ?item rdfs:label ?l. FILTER(LANG(?l) = "it") }';
      const d = await fetchJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { timeout: 45000, retries: 1 });
      const seen = new Set(), out = [];
      for (const b of d.results.bindings) {
        const id = b.item.value; if (seen.has(id)) continue; seen.add(id);
        const lat = +b.lat.value, lon = +b.lon.value, sl = +b.sl.value;
        if (!isFinite(lat) || !isFinite(lon) || /^Q\d+$/.test(b.l.value)) continue;
        out.push([b.l.value, +lat.toFixed(5), +lon.toFixed(5), sl]);
      }
      if (out.length > 200) { try { localStorage.setItem('cg_pois2', JSON.stringify({ t: Date.now(), d: out })); } catch (e) {} return POIS = out; }
    } catch (e) {}
    return POIS = FAMOSI.map(f => [f[0], f[1], f[2], 40]).concat(Object.values(REGIONS).flatMap(r => r.places.filter(p => POI_NAMES.has(p[0])).map(p => [p[0], p[1], p[2], 20])));
  })();
  return poisLoading;
}
loadPois();
function weightedPick(list, w) { let tot = 0; const cum = list.map(x => (tot += w(x))); const r = Math.random() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return list[lo]; }
// punto di interesse famoso dentro la zona (e, nella modalità persone, nella zona del giocatore estratto)
async function resolvePoi(e, g) {
  const all = await loadPois();
  let list = all.filter(p => !g.usedPlace.has(p[0]) && (e.region === 'italia' ? inItaly(p[1], p[2]) && (e.who == null || nearestIdx({ lat: p[1], lng: p[2] }) === e.who) : inArea(e.region, p[1], p[2])));
  if (e.region === 'italia' && list.length > 60) { const famous = list.filter(p => p[3] >= 15); if (famous.length > 25) list = famous; }
  if (e.region !== 'italia' && list.length > 8) {
    for (const km of [25, 50, 90]) { const c = randomIn(e.region), near = list.filter(p => haversine(c, { lat: p[1], lng: p[2] }) < km); if (near.length >= 2) { list = near; break; } }
  }
  if (!list.length) return false;
  const p = weightedPick(list, x => Math.sqrt(x[3])); g.usedPlace.add(p[0]);
  e.place = [p[0], p[1], p[2]]; e.poi = true; return true;
}
const WIKI_BAD = /^(Stazione|Ferrovia|Strada|Autostrada|Diocesi|Battaglia|Aeroporto|Porto di|Linea|Galleria|Svincolo|Casello|Raccordo|Tangenziale|Elettrodotto|Centrale)/i;
async function resolveWiki(e, g) {
  const p = e.region === 'italia' ? randomInItaly() : randomIn(e.region);
  const d = await fetchJSON('https://it.wikipedia.org/w/api.php?action=query&list=geosearch&format=json&origin=*&gsradius=10000&gslimit=100&gsprop=type&gscoord=' + p.lat + '%7C' + p.lng);
  const list = ((d.query && d.query.geosearch) || []).filter(x => x.type === 'landmark' && !WIKI_BAD.test(x.title) && !g.usedPlace.has(x.title) && okLoc(e, x.lat, x.lon));
  if (!list.length) return false;
  const x = list[Math.floor(Math.random() * list.length)]; g.usedPlace.add(x.title);
  e.place = [x.title, x.lat, x.lon]; e.wikiUrl = 'https://it.wikipedia.org/?curid=' + x.pageid; return true;
}
async function prepareRound(g, onStatus = () => {}) {
  let lastErr = null;
  for (let a = 0; a < 14; a++) {
    const e = nextDeckEntry(g); onStatus(a);
    if (e.wiki) { try { if (!(await resolvePoi(e, g))) continue; } catch (err) { lastErr = err; continue; } }
    try { const r = g.mode === 'sv' ? await prepSV(g, e) : g.mode === 'mly' ? await prepMly(g, e) : await prepPhoto(g, e); if (r) return r; }
    catch (err) { lastErr = err; if (err.fatal) throw err; }
  }
  throw lastErr || new Error('nessuna immagine trovata');
}
async function prepPhoto(g, e) {
  const [, lat, lng] = e.place;
  for (const radius of e.random ? [10000] : e.poi ? [350, 900] : [1200, 3500]) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsnamespace=6&ggslimit=60&ggsradius=' + radius
      + '&ggscoord=' + lat + '%7C' + lng + '&prop=coordinates%7Cimageinfo&iiprop=url%7Cmime%7Csize%7Cextmetadata&iiurlwidth=1920&iiextmetadatafilter=Artist%7CLicenseShortName';
    const d = await fetchJSON(url);
    const pages = Object.values((d.query && d.query.pages) || {}).filter(pg => {
      const ii = pg.imageinfo && pg.imageinfo[0], c = pg.coordinates && pg.coordinates[0];
      return ii && c && /image\/(jpeg|png)/.test(ii.mime) && ii.width >= 1000 && ii.height >= 600 && ii.width / ii.height < 3.2 && ii.width >= ii.height * .9
        && !BAD.test(pg.title) && !g.usedImg.has(pg.pageid) && okLoc(e, c.lat, c.lon);
    });
    if (!pages.length) continue;
    const pg = pages[Math.floor(Math.random() * pages.length)]; g.usedImg.add(pg.pageid);
    const ii = pg.imageinfo[0], c = pg.coordinates[0], md = ii.extmetadata || {}, src = ii.thumburl || ii.url;
    await preloadImg(src);
    const artist = md.Artist ? md.Artist.value.replace(/<[^>]+>/g, '').trim() : 'autore sconosciuto', lic = md.LicenseShortName ? md.LicenseShortName.value : '';
    return { ...e, kind: 'photo', src, target: { lat: c.lat, lng: c.lon },
      credit: 'Foto: <a href="' + esc(ii.descriptionurl) + '" target="_blank">' + esc(pg.title.replace(/^File:/, '')) + '</a> — ' + esc(artist) + (lic ? ' (' + esc(lic) + ')' : '') + ', Wikimedia Commons' };
  }
  return null;
}
async function prepMly(g, e) {
  const [, lat, lng] = e.place, tok = store('cg_mly');
  for (const [half, pano] of e.random ? [[.03, true], [.05, false]] : e.poi ? [[.0025, true], [.0025, false], [.005, false]] : [[.006, true], [.015, true], [.008, false]]) {
    const bbox = [lng - half, lat - half, lng + half, lat + half].map(x => x.toFixed(5)).join(',');
    const d = await fetchJSON('https://graph.mapillary.com/images?access_token=' + encodeURIComponent(tok) + '&fields=id,geometry,computed_geometry&limit=50&bbox=' + bbox + (pano ? '&is_pano=true' : ''));
    const list = (d.data || []).map(x => { const c = (x.computed_geometry || x.geometry).coordinates; return { id: x.id, lat: c[1], lng: c[0] }; })
      .filter(x => !g.usedImg.has(x.id) && okLoc(e, x.lat, x.lng));
    if (!list.length) continue;
    const img = list[Math.floor(Math.random() * list.length)]; g.usedImg.add(img.id);
    return { ...e, kind: 'mly', id: img.id, target: { lat: img.lat, lng: img.lng }, credit: 'Immagine: <a href="https://www.mapillary.com/app/?pKey=' + esc(img.id) + '" target="_blank">Mapillary</a> (CC BY-SA)' };
  }
  return null;
}
function svGet(loc, radius) {
  return new Promise(res => {
    const t = setTimeout(() => res(null), 8000);
    svService.getPanorama({ location: loc, radius, source: google.maps.StreetViewSource.OUTDOOR, preference: google.maps.StreetViewPreference.NEAREST },
      (d, st) => { clearTimeout(t); res(st === 'OK' ? d : null); });
  });
}
async function prepSV(g, e) {
  if (!svService) svService = new google.maps.StreetViewService();
  const [, lat, lng] = e.place, jit = () => e.random || e.poi ? 0 : (Math.random() - .5) * .004;
  for (const [radius, needGoogle] of e.random ? [[5000, true], [25000, true], [25000, false]] : e.poi ? [[90, true], [220, true], [400, false]] : [[250, true], [900, true], [1500, false]]) {
    const d = await svGet({ lat: lat + jit(), lng: lng + jit() }, radius);
    if (!d || g.usedImg.has(d.location.pano)) continue;
    if (needGoogle && d.copyright && !/google/i.test(d.copyright)) continue;
    const ll = d.location.latLng; if (!okLoc(e, ll.lat(), ll.lng())) continue;
    g.usedImg.add(d.location.pano);
    // per i monumenti giro la visuale verso il monumento
    const heading = e.poi ? bearing({ lat: ll.lat(), lng: ll.lng() }, { lat, lng }) : null;
    return { ...e, kind: 'sv', pano: d.location.pano, heading, target: { lat: ll.lat(), lng: ll.lng() }, credit: 'Immagini © Google Street View' };
  }
  return null;
}

/* ================= RENDER ================= */
function renderRound(r) {
  show('viewer'); ['photoWrap', 'mly', 'pano'].forEach(id => show(id, false));
  if (r.kind === 'photo') {
    show('photoWrap'); const img = $('photo'); img.classList.remove('in', 'zoom'); img.src = r.src;
    $('photoBg').style.backgroundImage = 'url("' + r.src.replace(/"/g, '%22') + '")';
    requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('in')));
  } else if (r.kind === 'mly') {
    show('mly'); if (mlyViewer) { try { mlyViewer.remove(); } catch (e) {} mlyViewer = null; } $('mly').innerHTML = '';
    mlyViewer = new mapillary.Viewer({ accessToken: store('cg_mly'), container: 'mly', imageId: r.id, component: { cover: false, sequence: !cfg.noMove, direction: !cfg.noMove, zoom: true } });
  } else {
    show('pano');
    const o = { pano: r.pano, pov: { heading: r.heading != null ? r.heading : Math.random() * 360, pitch: r.heading != null ? 8 : 0 }, zoom: 0, addressControl: false, showRoadLabels: false, fullscreenControl: false,
      motionTracking: false, motionTrackingControl: false, linksControl: !cfg.noMove, clickToGo: !cfg.noMove, enableCloseButton: false };
    if (!svPanorama) svPanorama = new google.maps.StreetViewPanorama($('pano'), o);
    else { svPanorama.setOptions(o); svPanorama.setPano(r.pano); svPanorama.setPov(o.pov); }
    svPanorama.setVisible(true);
  }
}
$('photo').onclick = e => { const img = $('photo'), rc = img.getBoundingClientRect();
  img.style.transformOrigin = ((e.clientX - rc.left) / rc.width * 100) + '% ' + ((e.clientY - rc.top) / rc.height * 100) + '%'; img.classList.toggle('zoom'); };

/* ================= LOADING ================= */
const LOAD_LINES = ['Accendo la Panda…', 'Cerco parcheggio in piazza…', 'Chiedo indicazioni al bar…', 'Evito una buca…', 'Seguo il navigatore (sbagliato)…',
  'Mi fermo per un caffè…', 'Aspetto che passi il trattore…', 'Supero un motorino in curva…'];
let loadIv = null, loadT0 = 0;
function loadingOn() {
  const el = $('loading'); show(el); el.classList.remove('fade');
  let i = Math.floor(Math.random() * LOAD_LINES.length); $('loadTxt').textContent = LOAD_LINES[i]; $('loadSub').textContent = ''; show('loadCancel', false); loadT0 = Date.now();
  clearInterval(loadIv); loadIv = setInterval(() => { i = (i + 1) % LOAD_LINES.length; $('loadTxt').textContent = LOAD_LINES[i]; if (Date.now() - loadT0 > 12000) show('loadCancel'); }, 1800);
}
async function loadingOff() { clearInterval(loadIv); const el = $('loading'); el.classList.add('fade'); await sleep(450); show(el, false); }
$('loadCancel').onclick = () => toMenu();

/* ================= GIOCO ================= */
function startGame(opts = {}) {
  if (MP.code && MP.people) PEOPLE = MP.people; else refreshPeople();
  renderPeopleCards();
  if (isChi() && PEOPLE.length < 2) { toMenu(); $('menuErr').textContent = 'Attiva almeno 2 giocatori in Impostazioni → Giocatori.'; return; }
  if (!opts.multi && preGame && preGame.region === cfg.region && preGame.mode === cfg.mode && preGame.places === cfg.places && preGame.pkey === playersKey()) { game = preGame; pending = game.pending; }
  else { game = newGame(); pending = null; }
  preGame = null;
  show('menu', false); show('regionTag', false); show('hud'); show('guessBox', !isChi()); show('peopleBox', isChi()); show('menuMap', false);
  initMaps();
  setTimeout(() => {
    gmap.invalidateSize(); rmap.invalidateSize();
    decorate(gmap, { hover: true });
    decorate(rmap, { hover: false, towns: false });
    gmap.fitBounds(selBounds(), { animate: false, padding: [6, 6] });
  }, 30);
  $('hScore').textContent = '0'; updStreak(false); show('hTimerBox', !!cfg.timer);
  if (opts.multi) { game.multi = true; game.code = MP.code; }
  dbStartGame(game);
  show('hRoom', !!opts.multi); if (opts.multi) $('hRoom').querySelector('b').textContent = MP.code;
  if (!opts.noRound) nextRound();
}
function toMenu() {
  if (MP.code) return mpLeave();
  roundToken++; stopTimer(); pending = null;
  $('result').classList.remove('show');
  ['hud', 'guessBox', 'peopleBox', 'loading', 'viewer', 'mapFab'].forEach(id => show(id, false)); openMapSheet(false);
  show('menu'); show('regionTag'); show('menuMap'); menuMap.invalidateSize(); onCfgChange(); setPlay(false);
  setTimeout(menuFocus, 50); prewarmRound();
}
$('menuBtn').onclick = () => { if (confirm('Tornare al menu? La partita in corso si perde.')) toMenu(); };
$('muteBtn').onclick = () => { muted = !muted; store('cg_mute', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; $('optSound').checked = !muted; };
$('muteBtn').textContent = muted ? '🔇' : '🔊';

function resetRoundUI() {
  $('result').classList.remove('show'); show('guessBox', !isChi()); show('peopleBox', isChi()); pickPerson(-1); openMapSheet(false); show('mapFab', false);
  guess = null; if (gPin) { gmap.removeLayer(gPin); gPin = null; }
  $('search').value = ''; show('sugg', false); $('gInfo').textContent = 'Clicca sulla mappa o scrivi un comune';
  const gb = $('guessBtn'); gb.disabled = true; gb.textContent = 'Indovina'; gb.classList.remove('ready');
  $('hRound').textContent = game.round + '/' + cfg.rounds; resetTimerDisplay();
}
async function nextRound() {
  const tok = ++roundToken; game.round++;
  resetRoundUI();
  let r = null; const p = pending; pending = null;
  if (p) { const quick = await Promise.race([p.catch(() => null), sleep(250).then(() => 'slow')]); if (quick === 'slow') { loadingOn(); r = await p.catch(() => null); } else r = quick; }
  if (!r) {
    loadingOn();
    try { r = await prepareRound(game, a => { $('loadSub').textContent = a ? 'tentativo ' + (a + 1) : ''; }); }
    catch (e) {
      if (tok !== roundToken) return;
      clearInterval(loadIv); $('loadTxt').textContent = e.fatal ? 'Accesso negato: controlla token o chiave.' : 'Problema di rete: ' + e.message;
      $('loadSub').textContent = e.fatal ? '' : 'Riprovo tra poco…'; show('loadCancel');
      if (e.fatal) return; await sleep(3000); if (tok !== roundToken) return; game.round--; return nextRound();
    }
  }
  if (tok !== roundToken) return;
  if (game.multi) {   // multigiocatore: chi ospita pubblica il round, tutti lo iniziano insieme
    try { await mpPublishRound(game.round, r); } catch (e) { $('loadTxt').textContent = 'Non riesco a inviare il round: ' + e.message; show('loadCancel'); return; }
    if (game.round < cfg.rounds) { pending = prepareRound(game); pending.catch(() => {}); }
    return mpTick();
  }
  await beginRound(r, tok);
  if (game.round < cfg.rounds) { pending = prepareRound(game); pending.catch(() => {}); }
}
async function beginRound(r, tok = roundToken) {
  cur = r; cur.done = false;
  renderRound(r);
  gmap.invalidateSize({ pan: false });
  try { gmap.fitBounds(selBounds(), { animate: false, padding: [6, 6] }); } catch (e) {}
  if (!$('loading').classList.contains('hidden')) await loadingOff();
  if (tok !== roundToken) return;
  playIntro(); sfx.whoosh(); startTimer(); syncFab();
}
function playIntro() {
  const el = $('intro'), d = el.firstElementChild;
  d.innerHTML = '<small>' + esc(cfg.region === 'mix' ? 'Dove sarà? 🎲' : isChi() ? 'Chi abita più vicino? 🧭' : REGIONS[cfg.region].name) + '</small>Round ' + game.round;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

/* ================= TIMER ================= */
let tEnd = 0, tIv = null, tLastSec = -1;
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function resetTimerDisplay() { stopTimer(); $('hTimerBox').classList.remove('urgent'); $('hTimer').textContent = cfg.timer ? mmss(cfg.timer) : '∞'; $('hTimerBar').style.width = '100%'; }
function startTimer() {
  if (!cfg.timer) return;
  tEnd = Date.now() + cfg.timer * 1000; tLastSec = -1;
  tIv = setInterval(() => {
    const left = (tEnd - Date.now()) / 1000;
    $('hTimer').textContent = mmss(left); $('hTimerBar').style.width = Math.max(0, left / cfg.timer * 100) + '%';
    const urgent = left <= 10; $('hTimerBox').classList.toggle('urgent', urgent);
    const sec = Math.ceil(left); if (urgent && sec !== tLastSec && sec > 0) { tLastSec = sec; sfx.tick(); }
    if (left <= 0) { stopTimer(); timeUp(); }
  }, 200);
}
function stopTimer() { clearInterval(tIv); tIv = null; }
const timeLeft = () => cfg.timer ? Math.max(0, (tEnd - Date.now()) / 1000) : 0;
function timeUp() { if (!cur || cur.done) return; sfx.timeup(); toast(guess ? '⏰ Tempo scaduto! Uso la tua ultima risposta' : '⏰ Tempo scaduto!'); submit(true); }

/* ================= PUNTEGGIO ================= */
const baseScore = (km, scale) => km <= .15 ? 5000 : Math.round(5000 * Math.exp(-km / scale));
function tierOf(base, has) {
  if (!has) return ['Tempo scaduto', '#3a4556', '#fff'];
  if (base >= 4800) return ['🎯 Perfetto', '#ff6b4a', '#1b0d07'];
  if (base >= 4000) return ['Eccellente', '#5ee3a1', '#06231a'];
  if (base >= 2800) return ['Molto bene', '#5aa9ff', '#04182d'];
  if (base >= 1500) return ['Non male', '#8d9bb0', '#0b1220'];
  if (base >= 400) return ['Lontano', '#3a4556', '#fff'];
  return ['Disperso 😅', '#2a3240', '#fff'];
}
const starsOf = b => b >= 4500 ? 5 : b >= 3500 ? 4 : b >= 2200 ? 3 : b >= 900 ? 2 : b > 0 ? 1 : 0;
function updStreak(bump) { const el = $('hStreak'); el.querySelector('b').textContent = '🔥 ' + (game ? game.streak : 0);
  if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
function starsHtml(n, d = .08) { return [0, 1, 2, 3, 4].map(i => '<i class="' + (i < n ? 'on' : '') + '" style="animation-delay:' + (i * d + .2) + 's">★</i>').join(''); }
function flyTo(m, bounds, opt) { m.invalidateSize({ pan: false }); return new Promise(res => { let done = false; const f = () => { if (!done) { done = true; res(); } }; m.once('moveend', f); try { m.flyToBounds(bounds, opt); } catch (e) { f(); } setTimeout(f, (opt.duration || 1) * 1000 + 400); }); }

async function submit(timedOut) {
  openMapSheet(false); show('mapFab', false);
  if (isChi()) return submitChi(timedOut);
  if (!cur || cur.done || (!guess && !timedOut)) return;
  cur.done = true; stopTimer();
  const tok = roundToken, left = timeLeft(), reg = REGIONS[cur.region], t = cur.target, g = guess;
  const km = g ? haversine(g, t) : null, base = g ? baseScore(km, reg.scale) : 0;
  const speed = g && cfg.timer ? Math.round(base * .25 * (left / cfg.timer)) : 0;
  let tc = comuneAt(t.lat, t.lng), gc = g ? comuneAt(g.lat, g.lng) : null;
  if (g && (!tc || !gc)) {   // fuori dalle 4 zone con confini incorporati: chiedo il nome a OpenStreetMap
    const [a, b] = await Promise.all([tc ? null : placeNameAt(t), gc ? null : placeNameAt(g)]);
    if (!tc && a && a.com) tc = { name: a.com, region: cur.region };
    if (!gc && b && b.com) gc = { name: b.com, region: cur.region };
  }
  const comHit = !!(tc && gc && norm(tc.name) === norm(gc.name));
  if (base >= 3000) game.streak++; else game.streak = 0;
  const streakBonus = game.streak >= 2 ? Math.min(1000, (game.streak - 1) * 250) : 0;

  show('guessBox', false);
  const res = $('result');
  show('finalList', false); show('toMenuBtn', false); show('nextBtn', false);
  const tierEl = $('rTier'); tierEl.className = 'tier'; tierEl.textContent = '';
  $('rPts').textContent = '0'; $('rStars').innerHTML = starsHtml(0); $('rBreak').innerHTML = ''; $('credit').innerHTML = cur.credit || '';
  const placeName = cur.place[0] || (tc ? tc.name : 'In mezzo al nulla'), comName = tc ? tc.name : (cur.place[3] || placeName);
  $('rWhere').innerHTML = esc(placeName) + '<small>' + (norm(comName) !== norm(placeName) ? esc(comName) + ' · ' : '') + esc(reg.name) + (g ? ' — eri a <b>' + fmtKm(km) + '</b>' : '') + '</small>';

  // mappa risultato
  if (rLayer) rLayer.remove(); rLayer = L.layerGroup().addTo(rmap);
  rmap.setView(g ? [g.lat, g.lng] : [t.lat, t.lng], g ? 11 : 9, { animate: false });
  res.classList.add('show'); await sleep(50); rmap.invalidateSize();
  if (tc && tc.g) L.geoJSON(tc.g, { interactive: false, style: { color: '#5ee3a1', weight: 2, fillColor: '#5ee3a1', fillOpacity: .1 } }).addTo(rLayer);
  if (gc && gc.g && !comHit) L.geoJSON(gc.g, { interactive: false, style: { color: '#ff6b4a', weight: 1.5, dashArray: '4 4', fillColor: '#ff6b4a', fillOpacity: .1 } }).addTo(rLayer);
  if (g) L.marker([g.lat, g.lng], { icon: pinIcon(), interactive: false }).addTo(rLayer);
  const padB = $('rpanel').offsetHeight + 50;
  if (g) await flyTo(rmap, L.latLngBounds([t, g]), { paddingTopLeft: [60, 90], paddingBottomRight: [60, padB], maxZoom: 14, duration: 1.1 });
  else await flyTo(rmap, L.latLngBounds([t, t]).pad(.02), { paddingBottomRight: [0, padB], maxZoom: 12, duration: 1.1 });
  if (tok !== roundToken) return;
  if (g) await animateLine(rLayer, g, t, 850);
  L.marker([t.lat, t.lng], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="tgt"><span></span><span></span><b></b></div>', iconSize: [0, 0] }) }).addTo(rLayer);
  if (g) L.marker([(g.lat + t.lat) / 2, (g.lng + t.lng) / 2], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="dchip">' + fmtKm(km) + '</div>', iconSize: [0, 0] }) }).addTo(rLayer);

  const [tierTxt, tierBg, tierFg] = tierOf(base, !!g);
  tierEl.textContent = tierTxt; tierEl.style.background = tierBg; tierEl.style.color = tierFg; tierEl.classList.add('in');
  const ns = starsOf(base); $('rStars').innerHTML = starsHtml(ns);
  buzz(base >= 4000 ? [30, 40, 30] : base < 1500 ? 120 : 20);
  if (base >= 4000) { sfx.win(); confetti(base >= 4800 ? 260 : 140); }
  else if (base >= 1500) sfx.ok();
  else { sfx.bad(); const p = $('rpanel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }

  const box = $('rBreak');
  const addRow = async (label, val, plus, cls = '') => {
    const d = document.createElement('div'); d.className = 'bk ' + (val > 0 ? (plus ? 'plus' : '') : 'zero') + ' ' + cls;
    const pre = plus && val > 0 ? '+' : '';
    d.innerHTML = '<span>' + label + '</span><b>' + pre + '0</b>'; box.appendChild(d); await sleep(30); d.classList.add('in');
    const b = d.querySelector('b'); await countUp({ set textContent(v) { b.textContent = pre + v; } }, 0, val, val ? 480 : 1, sfx.count); await sleep(110);
  };
  await addRow('📏 Distanza' + (g ? ' · ' + fmtKm(km) : ''), base, false);
  if (cfg.timer) await addRow('⚡ Velocità' + (g ? ' · ' + mmss(cfg.timer - left) : ''), speed, true);
  if (tok !== roundToken) return;
  const comBonus = comHit ? 750 : 0;
  if (g) {
    await addRow(comHit ? '🏛️ Comune esatto · ' + esc(gc.name) : '🏛️ Comune · ' + (gc ? 'hai detto ' + esc(gc.name) : 'fuori zona'), comBonus, true);
    if (comHit) { sfx.ok(); toast('🏛️ Comune giusto! +750'); }
  }
  if (streakBonus) await addRow('🔥 Serie x' + game.streak, streakBonus, true);
  const total = base + speed + comBonus + streakBonus;
  await addRow('Totale round', total, false, 'total');
  if (tok !== roundToken) return;
  updStreak(base >= 3000);
  game.history.push({ name: placeName, region: cur.region, target: t, guess: g, km, base, total, stars: ns });
  dbRound({ round_no: game.round, area_id: cur.region, place_name: placeName, place_kind: cur.poi ? 'poi' : cur.random ? 'ovunque' : 'centro', target: t, guess: g, distance_km: km, base, speed_bonus: speed, extra_bonus: comBonus, streak_bonus: streakBonus, total, time_s: cfg.timer ? cfg.timer - left : null, image_ref: cur.pano || cur.id || cur.src || null });
  const before = game.total; game.total += total;
  countUp($('rPts'), 0, total, 700); countUp($('hScore'), before, game.total, 900);
  const last = game.round >= cfg.rounds, nb = $('nextBtn'); show(nb);
  nb.textContent = last ? 'Risultato finale 🏁' : 'Prossimo round →';
  nb.onclick = last ? showFinal : nextRound;
  if (game.multi) mpAfterGuess(g ? { lat: g.lat, lng: g.lng } : null, total, { km, base, speed, bonus: comBonus, streak: streakBonus }, last);
}
function animateLine(layer, a, b, ms, color = '#ffffff') {
  return new Promise(res => {
    const line = L.polyline([[a.lat, a.lng]], { color, weight: 3.5, className: 'trail', interactive: false }).addTo(layer);
    const t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 2);
      line.setLatLngs([[a.lat, a.lng], [a.lat + (b.lat - a.lat) * e, a.lng + (b.lng - a.lng) * e]]); k < 1 ? requestAnimationFrame(step) : res(); })(t0);
  });
}

/* ================= FINALE ================= */
async function showFinal() {
  dbFinishGame(game);
  if (game.multi) { MP.finalShown = true; setTimeout(mpRenderStandings, 1800); }
  if (isChi()) return showFinalChi();
  const tok = roundToken, h = game.history, maxBase = cfg.rounds * 5000;
  if (rLayer) rLayer.remove(); rLayer = L.layerGroup().addTo(rmap);
  const pts = [];
  h.forEach((r, i) => {
    pts.push(r.target);
    if (r.guess) { pts.push(r.guess);
      L.polyline([r.guess, r.target], { color: '#fff', weight: 2.5, className: 'trail', interactive: false }).addTo(rLayer);
      L.marker([r.guess.lat, r.guess.lng], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="gdot"></div>', iconSize: [0, 0] }) }).addTo(rLayer); }
    L.marker([r.target.lat, r.target.lng], { icon: L.divIcon({ className: '', html: '<div class="nchip">' + (i + 1) + '</div>', iconSize: [0, 0] }) })
      .bindTooltip(esc(r.name), { className: 'comtip', direction: 'top', offset: [0, -14] }).addTo(rLayer);
  });
  flyTo(rmap, L.latLngBounds(pts), { paddingTopLeft: [60, 60], paddingBottomRight: [60, 0], maxZoom: 12, duration: 1.2 });
  const baseSum = h.reduce((s, r) => s + r.base, 0), pct = baseSum / maxBase, gs = h.filter(r => r.guess);
  const avgKm = gs.length ? gs.reduce((s, r) => s + r.km, 0) / gs.length : null;
  const best = h.reduce((b, r, i) => r.total > h[b].total ? i : b, 0);
  const rk = recKey(), oldRec = +store(rk) || 0, isRec = oldRec > 0 && game.total > oldRec;
  if (game.total > oldRec) store(rk, game.total);
  const tierEl = $('rTier'); tierEl.className = 'tier';
  tierEl.textContent = pct > .85 ? 'Del posto 🏅' : pct > .65 ? 'Esperto' : pct > .45 ? 'Viaggiatore' : pct > .25 ? 'Turista' : 'Disperso';
  tierEl.style.background = pct > .65 ? '#ff6b4a' : '#5aa9ff'; tierEl.style.color = '#0b1220'; void tierEl.offsetWidth; tierEl.classList.add('in');
  $('rStars').innerHTML = starsHtml(Math.round(pct * 5), .12);
  $('rWhere').innerHTML = 'Partita finita' + (isRec ? '<span class="newrec">🏆 Nuovo record</span>' : '')
    + '<small>' + (avgKm != null ? 'Distanza media <b>' + fmtKm(avgKm) + '</b> · ' : '') + 'Precisione <b>' + Math.round(pct * 100) + '%</b>' + (oldRec && !isRec ? ' · Record ' + fmt(oldRec) : '') + '</small>';
  $('rBreak').innerHTML = ''; $('credit').innerHTML = ''; show('nextBtn', false);
  const fl = $('finalList'); show(fl);
  fl.innerHTML = '<table>' + h.map((r, i) => '<tr class="' + (i === best ? 'best' : '') + '" style="animation-delay:' + (i * .1) + 's"><td><b>' + (i + 1) + '</b></td><td>' + esc(r.name)
    + (cfg.region === 'mix' ? ' <small style="color:var(--mut)">· ' + esc(REGIONS[r.region].name) + '</small>' : '') + '</td><td class="st">' + '★'.repeat(r.stars)
    + '<span style="opacity:.2">' + '★'.repeat(5 - r.stars) + '</span></td><td>' + (r.guess ? fmtKm(r.km) : '⏰') + '</td><td style="text-align:right"><b>' + fmt(r.total) + '</b>'
    + (i === best ? ' 👑' : '') + '</td></tr>').join('') + '</table>';
  await sleep(60); flyTo(rmap, L.latLngBounds(pts), { paddingTopLeft: [60, 60], paddingBottomRight: [60, $('rpanel').offsetHeight + 50], maxZoom: 12, duration: 1 });
  if (pct > .65 || isRec) { sfx.win(); confetti(300); }
  $('rPts').textContent = '0'; await countUp($('rPts'), 0, game.total, 1600, sfx.count);
  if (tok !== roundToken) return;
  if (game.multi) return;
  const nb = $('nextBtn'); show(nb); nb.textContent = 'Rigioca 🔁'; nb.onclick = () => { $('result').classList.remove('show'); startGame(); };
  show('toMenuBtn');
}
$('toMenuBtn').onclick = toMenu;


/* ================= MODALITÀ "CHI ABITA PIÙ VICINO?" ================= */
function renderPeopleCards() {
  const box = $('peopleCards'); box.style.setProperty('--n', Math.min(PEOPLE.length, 5));
  box.innerHTML = PEOPLE.map((pp, i) => '<button class="pcard" data-i="' + i + '" style="--c:' + pp.col + '"><span class="pav">' + esc(pp.name[0].toUpperCase())
    + '</span><b>' + esc(pp.name) + '</b><small>' + esc(pp.home) + '</small><kbd>' + (i + 1) + '</kbd></button>').join('');
  box.querySelectorAll('.pcard').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (guess && guess.person === i) return submit(false); pickPerson(i); });
}
renderPeopleCards();
function pickPerson(i) {
  if (i >= 0 && (!cur || cur.done)) return;
  guess = i >= 0 ? { person: i } : null;
  $('peopleCards').querySelectorAll('.pcard').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
  const b = $('pConfirm'); b.disabled = i < 0; b.classList.toggle('ready', i >= 0);
  b.textContent = i >= 0 ? 'Conferma: ' + PEOPLE[i].name + ' →' : 'Scegli una persona';
  if (i >= 0) sfx.pin();
}
$('pConfirm').onclick = () => submit(false);
document.addEventListener('keydown', e => {
  if (!isChi() || !cur || cur.done || document.activeElement.tagName === 'INPUT') return;
  const n = parseInt(e.key, 10); if (n >= 1 && n <= Math.min(9, PEOPLE.length)) pickPerson(n - 1);
  if (e.key === 'Enter' && guess) submit(false);
});
async function placeNameAt(p) {
  try {
    const d = await Promise.race([nomi('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=it&lat=' + p.lat + '&lon=' + p.lng), sleep(6000).then(() => null)]);
    const a = (d && d.address) || {};
    const com = a.municipality || a.city || a.town || a.village || a.hamlet || '';
    const prov = (a.county || a.province || '').replace(/^(Provincia|Città metropolitana|Libero consorzio comunale) (di |del |della |dell'|de )?/i, '');
    return { com, prov, reg: a.state || '' };
  } catch (e) { return { com: '', prov: '', reg: '' }; }
}
async function submitChi(timedOut) {
  if (!cur || cur.done || (!guess && !timedOut)) return;
  cur.done = true; stopTimer();
  const tok = roundToken, left = timeLeft(), t = cur.target, pick = guess ? guess.person : -1;
  const dist = PEOPLE.map(pp => haversine(pp, t));
  const order = PEOPLE.map((_, i) => i).sort((a, b) => dist[a] - dist[b]);
  const win = order[0];
  const correct = pick >= 0 && dist[pick] - dist[win] <= 2;           // pari merito entro 2 km
  const rank = pick >= 0 ? order.indexOf(pick) : -1;
  const base = pick < 0 ? 0 : correct ? 5000 : ([5000, 2000, 800, 250][rank] || 0);
  const speed = pick >= 0 && cfg.timer ? Math.round(base * .25 * (left / cfg.timer)) : 0;
  const close = correct && (dist[order[1]] - dist[win] < Math.max(25, dist[win] * .15));
  const closeBonus = close ? 500 : 0;
  if (correct) game.streak++; else game.streak = 0;
  const streakBonus = game.streak >= 2 ? Math.min(1000, (game.streak - 1) * 250) : 0;
  const namePromise = placeNameAt(t);

  show('peopleBox', false);
  show('finalList', false); show('toMenuBtn', false); show('nextBtn', false);
  const tierEl = $('rTier'); tierEl.className = 'tier'; tierEl.textContent = '';
  $('rPts').textContent = '0'; $('rStars').innerHTML = starsHtml(0); $('rBreak').innerHTML = ''; $('credit').innerHTML = cur.credit || '';
  $('rWhere').innerHTML = 'Cerco il nome del posto…<small>&nbsp;</small>';
  if (rLayer) rLayer.remove(); rLayer = L.layerGroup().addTo(rmap);
  rmap.setView([t.lat, t.lng], 9, { animate: false });
  $('result').classList.add('show'); await sleep(50); rmap.invalidateSize();
  // case delle persone
  PEOPLE.forEach((pp, i) => L.marker([pp.lat, pp.lng], { interactive: false, zIndexOffset: i === win ? 500 : 0,
    icon: L.divIcon({ className: '', html: '<div class="hpin' + (i === win ? ' win' : '') + (i === pick && !correct ? ' miss' : '') + '" style="--c:' + pp.col + '"><b>' + pp.name[0] + '</b><span>' + esc(pp.name) + ' · ' + fmtKm(dist[i]) + '</span></div>', iconSize: [0, 0] }) }).addTo(rLayer));
  PEOPLE.forEach((pp, i) => { if (i !== win && i !== pick) L.polyline([pp, t], { color: pp.col, weight: 1.5, opacity: .35, dashArray: '3 7', interactive: false }).addTo(rLayer); });
  const padB = $('rpanel').offsetHeight + 50;
  await flyTo(rmap, L.latLngBounds([t, ...PEOPLE]), { paddingTopLeft: [70, 70], paddingBottomRight: [70, padB], maxZoom: 9, duration: 1.1 });
  if (tok !== roundToken) return;
  if (pick >= 0 && pick !== win) await animateLine(rLayer, PEOPLE[pick], t, 600, '#ff5a5a');
  await animateLine(rLayer, PEOPLE[win], t, 800, '#5ee3a1');
  L.marker([t.lat, t.lng], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="tgt"><span></span><span></span><b></b></div>', iconSize: [0, 0] }) }).addTo(rLayer);

  tierEl.textContent = pick < 0 ? 'Tempo scaduto' : correct ? '🎯 Giusto!' : rank === 1 ? 'Quasi!' : 'Sbagliato';
  tierEl.style.background = pick < 0 ? '#3a4556' : correct ? '#5ee3a1' : rank === 1 ? '#ffb547' : '#ff5a5a'; tierEl.style.color = '#0b1220'; tierEl.classList.add('in');
  const ns = correct ? 5 : rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0; $('rStars').innerHTML = starsHtml(ns);
  buzz(correct ? [30, 40, 30] : 120);
  if (correct) { sfx.win(); confetti(close ? 260 : 150); } else if (rank === 1) sfx.ok();
  else { sfx.bad(); const p = $('rpanel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }

  const nm = await namePromise; if (tok !== roundToken) return;
  const comLabel = nm.com ? nm.com + (nm.prov && nm.prov !== nm.com ? ' (' + nm.prov + ')' : '') : '';
  const label = cur.place[0] || comLabel || 'In mezzo al nulla';
  $('rWhere').innerHTML = esc(label) + '<small>' + (cur.place[0] && comLabel && norm(comLabel) !== norm(cur.place[0]) ? esc(comLabel) + ' · ' : '') + (nm.reg ? esc(nm.reg) + ' · ' : '') + 'più vicino: <b style="color:' + PEOPLE[win].col + '">' + esc(PEOPLE[win].name) + '</b> a ' + fmtKm(dist[win]) + '</small>';
  // classifica distanze
  const box = $('rBreak');
  box.insertAdjacentHTML('beforeend', '<div class="prank">' + order.map((i, k) => '<span class="' + (i === win ? 'w ' : '') + (i === pick ? 'p' : '') + '" style="--c:' + PEOPLE[i].col + ';animation-delay:' + (k * .08) + 's">'
    + (['🥇', '🥈', '🥉'][k] || (k + 1) + '°') + ' ' + esc(PEOPLE[i].name) + ' <i>' + fmtKm(dist[i]) + '</i></span>').join('') + '</div>');
  const addRow = async (label, val, plus, cls = '') => {
    const d = document.createElement('div'); d.className = 'bk ' + (val > 0 ? (plus ? 'plus' : '') : 'zero') + ' ' + cls;
    const pre = plus && val > 0 ? '+' : '';
    d.innerHTML = '<span>' + label + '</span><b>' + pre + '0</b>'; box.appendChild(d); await sleep(30); d.classList.add('in');
    const b = d.querySelector('b'); await countUp({ set textContent(v) { b.textContent = pre + v; } }, 0, val, val ? 480 : 1, sfx.count); await sleep(110);
  };
  await addRow(pick < 0 ? '⏰ Nessuna risposta' : '🧭 Hai scelto ' + esc(PEOPLE[pick].name) + (correct ? '' : ' (' + (rank + 1) + '° più vicino)'), base, false);
  if (cfg.timer) await addRow('⚡ Velocità' + (pick >= 0 ? ' · ' + mmss(cfg.timer - left) : ''), speed, true);
  if (close) { await addRow('🤏 Testa a testa con ' + esc(PEOPLE[order[1]].name), closeBonus, true); toast('🤏 Era un testa a testa! +500'); }
  if (streakBonus) await addRow('🔥 Serie x' + game.streak, streakBonus, true);
  const total = base + speed + closeBonus + streakBonus;
  await addRow('Totale round', total, false, 'total');
  if (tok !== roundToken) return;
  updStreak(correct);
  game.history.push({ name: label, region: 'italia', target: t, pick, win, correct, km: pick >= 0 ? dist[pick] : null, base, total, stars: ns });
  dbRound({ round_no: game.round, area_id: 'italia', place_name: label, place_kind: cur.poi ? 'poi' : cur.random ? 'ovunque' : 'centro', target: t, guessed_player: pick >= 0 ? PEOPLE[pick].id : null, closest_player: PEOPLE[win].id, correct, distance_km: pick >= 0 ? dist[pick] : null, base, speed_bonus: speed, extra_bonus: closeBonus, streak_bonus: streakBonus, total, time_s: cfg.timer ? cfg.timer - left : null, image_ref: cur.pano || cur.id || cur.src || null });
  const before = game.total; game.total += total;
  countUp($('rPts'), 0, total, 700); countUp($('hScore'), before, game.total, 900);
  const last = game.round >= cfg.rounds, nb = $('nextBtn'); show(nb);
  nb.textContent = last ? 'Risultato finale 🏁' : 'Prossimo round →';
  nb.onclick = last ? showFinal : nextRound;
  if (game.multi) mpAfterGuess({ person: pick, name: pick >= 0 ? PEOPLE[pick].name : null }, total, { km: pick >= 0 ? dist[pick] : null, base, speed, bonus: closeBonus, streak: streakBonus, correct }, last);
}
async function showFinalChi() {
  const tok = roundToken, h = game.history;
  if (rLayer) rLayer.remove(); rLayer = L.layerGroup().addTo(rmap);
  PEOPLE.forEach(pp => L.marker([pp.lat, pp.lng], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="hpin" style="--c:' + pp.col + '"><b>' + pp.name[0] + '</b><span>' + esc(pp.name) + '</span></div>', iconSize: [0, 0] }) }).addTo(rLayer));
  h.forEach((r, i) => {
    const w = PEOPLE[r.win];
    L.polyline([w, r.target], { color: w.col, weight: 2, opacity: .7, className: 'trail', interactive: false }).addTo(rLayer);
    L.marker([r.target.lat, r.target.lng], { icon: L.divIcon({ className: '', html: '<div class="nchip" style="background:' + w.col + ';box-shadow:0 0 14px ' + w.col + '">' + (i + 1) + '</div>', iconSize: [0, 0] }) })
      .bindTooltip(esc(r.name), { className: 'comtip', direction: 'top', offset: [0, -14] }).addTo(rLayer);
  });
  const right = h.filter(r => r.correct).length, pct = right / h.length;
  const best = h.reduce((b, r, i) => r.total > h[b].total ? i : b, 0);
  const rk = recKey(), oldRec = +store(rk) || 0, isRec = oldRec > 0 && game.total > oldRec;
  if (game.total > oldRec) store(rk, game.total);
  const wins = PEOPLE.map((pp, i) => ({ pp, n: h.filter(r => r.win === i).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const tierEl = $('rTier'); tierEl.className = 'tier';
  tierEl.textContent = pct >= .8 ? 'Conosci tutti 🏅' : pct >= .6 ? 'Ottimo fiuto' : pct >= .4 ? 'Discreto' : 'Da ripassare';
  tierEl.style.background = pct >= .6 ? '#5ee3a1' : '#ffb547'; tierEl.style.color = '#0b1220'; void tierEl.offsetWidth; tierEl.classList.add('in');
  $('rStars').innerHTML = starsHtml(Math.round(pct * 5), .12);
  $('rWhere').innerHTML = 'Partita finita' + (isRec ? '<span class="newrec">🏆 Nuovo record</span>' : '') + '<small>Risposte giuste <b>' + right + '/' + h.length + '</b> · Più vicino più spesso: '
    + wins.map(x => '<b style="color:' + x.pp.col + '">' + esc(x.pp.name) + '</b> ' + x.n).join(' · ') + (oldRec && !isRec ? ' · Record ' + fmt(oldRec) : '') + '</small>';
  $('rBreak').innerHTML = ''; $('credit').innerHTML = ''; show('nextBtn', false);
  const fl = $('finalList'); show(fl);
  fl.innerHTML = '<table>' + h.map((r, i) => '<tr class="' + (i === best ? 'best' : '') + '" style="animation-delay:' + (i * .1) + 's"><td><b>' + (i + 1) + '</b></td><td>' + esc(r.name)
    + '</td><td>più vicino: <b style="color:' + PEOPLE[r.win].col + '">' + esc(PEOPLE[r.win].name) + '</b></td><td>' + (r.pick < 0 ? '⏰' : (r.correct ? '✅ ' : '❌ ') + esc(PEOPLE[r.pick].name))
    + '</td><td style="text-align:right"><b>' + fmt(r.total) + '</b>' + (i === best ? ' 👑' : '') + '</td></tr>').join('') + '</table>';
  await sleep(60);
  flyTo(rmap, L.latLngBounds([...h.map(r => r.target), ...PEOPLE]), { paddingTopLeft: [60, 60], paddingBottomRight: [60, $('rpanel').offsetHeight + 50], maxZoom: 9, duration: 1 });
  if (pct >= .6 || isRec) { sfx.win(); confetti(300); }
  $('rPts').textContent = '0'; await countUp($('rPts'), 0, game.total, 1600, sfx.count);
  if (tok !== roundToken) return;
  if (game.multi) return;
  const nb = $('nextBtn'); show(nb); nb.textContent = 'Rigioca 🔁'; nb.onclick = () => { $('result').classList.remove('show'); startGame(); };
  show('toMenuBtn');
}


/* ================= IMPOSTAZIONI ================= */
const PLACES_LBL = { mix: '🎯 Misto', poi: '🏛️ Punti di interesse', urban: '🏘️ Centri urbani', all: '🌍 Ovunque' };
const MODE_LBL = { sv: '🌐 Street View', mly: '🛣️ Mapillary', photo: '📷 Foto' };
function renderSummary() {
  const items = [['partita', '⏱', cfg.timer ? cfg.timer / 60 + ' min' : 'Senza timer'], ['partita', '🔁', cfg.rounds + ' round'], ['luoghi', '', PLACES_LBL[cfg.places]],
    ['immagini', '', MODE_LBL[cfg.mode] + (cfg.noMove ? ' · fermo' : '')]];
  if (isChi()) items.splice(3, 0, ['giocatori', '👥', PLAYERS.filter(p => p.on).length + ' giocatori']);
  $('summary').innerHTML = items.map(([t, ic, v]) => '<button data-t="' + t + '">' + (ic ? '<span>' + ic + '</span>' : '') + esc(v) + '</button>').join('');
  $('summary').querySelectorAll('button').forEach(b => b.onclick = () => openSettings(b.dataset.t));
}
function openSettings(tab = 'partita') {
  show('settings'); selTab(tab);
}
function closeSettings() {
  show('settings', false); cfg.noMove = $('noMove').checked; store('cg_cfg3', JSON.stringify(cfg)); renderSummary();
  const k = $('apiKey').value.trim(); if (k) store('cg_key', k); const m = $('mlyToken').value.trim(); if (m) store('cg_mly', m);
}
function selTab(t) {
  $('sTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.sbody section').forEach(s => show(s, s.dataset.t === t));
}
$('sTabs').querySelectorAll('button').forEach(b => b.onclick = () => selTab(b.dataset.t));
$('setBtn').onclick = () => openSettings(); $('hudSetBtn').onclick = () => openSettings('mappa');
$('sClose').onclick = $('sBack').onclick = $('sDone').onclick = closeSettings;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('settings').classList.contains('hidden')) closeSettings(); });
$('noMove').onchange = () => { cfg.noMove = $('noMove').checked; store('cg_cfg3', JSON.stringify(cfg)); renderSummary(); };
function redecorateAll() { allMaps.forEach(m => m._cg.opts && decorate(m, m._cg.opts)); }
[['optComuni', 'showComuni'], ['optHover', 'hoverNames'], ['optTowns', 'showTowns']].forEach(([id, key]) => {
  $(id).checked = !!cfg[key];
  $(id).onchange = () => { cfg[key] = $(id).checked; store('cg_cfg3', JSON.stringify(cfg)); redecorateAll(); };
});
$('optSound').checked = !muted;
$('optSound').onchange = () => { muted = !$('optSound').checked; store('cg_mute', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; if (!muted) { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } sfx.ok(); } };
$('resetRec').onclick = () => {
  if (!confirm('Azzerare tutti i record?')) return;
  try { Object.keys(localStorage).filter(k => k.startsWith('cg_rec_')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  onCfgChange(); toast('Record azzerati');
};
renderSummary();


/* ================= TELEFONO ================= */
const isPhone = () => matchMedia('(max-width:760px),(pointer:coarse) and (max-width:1024px)').matches;
function openMapSheet(on) {
  $('guessBox').classList.toggle('open', on);
  if (on) { setTimeout(() => gmap && gmap.invalidateSize({ pan: false }), 60); setTimeout(() => gmap && gmap.invalidateSize({ pan: false }), 420); }
}
$('mapFab').onclick = () => openMapSheet(true);
$('gbClose').onclick = () => openMapSheet(false);
function syncFab() { show('mapFab', isPhone() && !isChi() && !!cur && !cur.done && !$('hud').classList.contains('hidden')); $('mapFab').classList.toggle('has', !!guess && !isChi()); }
addEventListener('resize', () => { syncFab(); gmap && gmap.invalidateSize({ pan: false }); rmap && rmap.invalidateSize({ pan: false }); });
// vibrazione leggera dove supportata
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }


/* ================= LIBRERIA GIOCATORI ================= */
function playersKey() { return PLAYERS.filter(p => p.on).map(p => p.id + p.lat + p.lng).join('|'); }
function playersChanged() {
  savePlayers();
  if (!game || $('hud').classList.contains('hidden')) { refreshPeople(); renderPeopleCards(); if (isChi()) { decorate(menuMap, { comuni: false, hover: false }); prewarmRound(); } }
  else toast('Le modifiche ai giocatori valgono dalla prossima partita');
  renderPlayers(); renderSummary();
}
function renderPlayers() {
  const on = PLAYERS.filter(p => p.on).length;
  $('plList').innerHTML = PLAYERS.map((p, i) => '<div class="plrow' + (p.on ? '' : ' off') + '"><span class="pav" data-c="' + i + '" style="--c:' + p.col + '" title="Cambia colore">' + esc(p.name[0].toUpperCase()) + '</span>'
    + '<span class="pinfo"><b>' + esc(p.name) + '</b><small>📍 ' + esc(p.home) + '</small></span>'
    + '<label class="tgl"><input type="checkbox" data-t="' + i + '"' + (p.on ? ' checked' : '') + '><i></i></label>'
    + '<button class="pldel" data-d="' + i + '" title="Elimina">✕</button></div>').join('')
    + '<p class="hint">' + on + ' attiv' + (on === 1 ? 'o' : 'i') + (on < 2 ? ' — ne servono almeno 2' : '') + '</p>';
  $('plList').querySelectorAll('[data-t]').forEach(x => x.onchange = () => { const p = PLAYERS[+x.dataset.t]; p.on = x.checked; dbPlayerSave(p); playersChanged(); });
  $('plList').querySelectorAll('[data-d]').forEach(x => x.onclick = () => { const p = PLAYERS[+x.dataset.d]; PLAYERS.splice(+x.dataset.d, 1); dbPlayerDelete(p); playersChanged(); toast(p.name + ' eliminato'); });
  $('plList').querySelectorAll('[data-c]').forEach(x => x.onclick = () => { const p = PLAYERS[+x.dataset.c]; p.col = PALETTE[(PALETTE.indexOf(p.col) + 1) % PALETTE.length]; dbPlayerSave(p); playersChanged(); });
}
let plPlace = null, plTimer = null;
function plCheck() { $('plAdd').disabled = !($('plName').value.trim() && plPlace); }
$('plName').oninput = plCheck;
$('plHome').oninput = () => {
  plPlace = null; plCheck(); clearTimeout(plTimer);
  const q = $('plHome').value.trim(); if (q.length < 2) return show('plSugg', false);
  const n = norm(q);
  const local = CENTRI.filter(c => norm(c[0]).includes(n)).sort((a, b) => (norm(b[0]).startsWith(n) - norm(a[0]).startsWith(n)) || b[4] - a[4]).slice(0, 6)
    .map(c => ({ name: c[0], sub: c[3], lat: c[1], lng: c[2] }));
  plRender(local, true);
  plTimer = setTimeout(async () => {
    try {
      const d = await nomi('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=it&countrycodes=it&q=' + encodeURIComponent(q));
      if (q !== $('plHome').value.trim() || plPlace) return;
      const remote = d.filter(x => x.addresstype !== 'municipality' && x.type !== 'administrative').map(x => ({ name: x.name || x.display_name.split(',')[0], sub: x.display_name.split(',').slice(1, 3).join(','), lat: +x.lat, lng: +x.lon }));
      plRender(local.concat(remote), false);
    } catch (e) { plRender(local, false); }
  }, 600);
};
function plRender(list, loading) {
  const box = $('plSugg'); box.innerHTML = list.map((x, i) => '<div data-i="' + i + '">' + esc(x.name) + '<small>' + esc(x.sub || '') + '</small></div>').join('') + (loading ? '<div style="color:var(--mut);cursor:default">Cerco anche frazioni…</div>' : '');
  if (!list.length && !loading) box.innerHTML = '<div style="color:var(--mut);cursor:default">Nessun luogo trovato</div>';
  box.querySelectorAll('[data-i]').forEach(d => d.onclick = () => { clearTimeout(plTimer); plPlace = list[+d.dataset.i]; $('plHome').value = plPlace.name; show(box, false); plCheck(); });
  show(box);
}
$('plAdd').onclick = () => {
  const name = $('plName').value.trim(); if (!name || !plPlace) return;
  const used = new Set(PLAYERS.map(p => p.col));
  const np = { id: uuid(), name, home: plPlace.name, lat: plPlace.lat, lng: plPlace.lng, col: PALETTE.find(c => !used.has(c)) || PALETTE[PLAYERS.length % PALETTE.length], on: true };
  PLAYERS.push(np); dbPlayerSave(np, true);
  $('plName').value = ''; $('plHome').value = ''; plPlace = null; plCheck();
  $('plMsg').textContent = name + ' aggiunto ✓'; setTimeout(() => $('plMsg').textContent = '', 2500);
  playersChanged();
};
$('plReset').onclick = () => { if (!confirm('Riattivare i 5 giocatori iniziali?')) return; DEFAULT_PLAYERS.forEach(d => { let p = PLAYERS.find(x => x.slug === d.id || x.id === d.id); if (!p) { p = { ...d, slug: d.id, id: uuid() }; PLAYERS.push(p); dbPlayerSave(p, true); } else { p.on = true; dbPlayerSave(p); } }); playersChanged(); };
renderPlayers();

document.addEventListener('click', e => { if (!e.target.closest('.plhome')) show('plSugg', false); });


/* ================= DATABASE (Supabase) ================= */
const SB_URL = 'https://agwmdkrkfydgfzghwspv.supabase.co', SB_KEY = 'sb_publishable_5edj9ayGro2KPEgrUsaNZg_KWDi9mi_';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const isUuid = x => /^[0-9a-f-]{36}$/i.test(x || '');
let dbOk = null;
async function sb(path, { method = 'GET', body, prefer, timeout = 12000 } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + path, { method, signal: ctl.signal,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error('DB ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const txt = await r.text(); return txt ? JSON.parse(txt) : null;
  } finally { clearTimeout(t); }
}
const rpc = (fn, args, timeout) => sb('rpc/' + fn, { method: 'POST', body: args, timeout });
// coda di scritture: se il database non risponde le salvo e riprovo dopo
let outbox = []; try { outbox = JSON.parse(localStorage.getItem('cg_outbox') || '[]'); } catch (e) {}
let flushing = false;
function dbWrite(path, method, body, prefer) { outbox.push({ path, method, body, prefer }); saveOutbox(); flushOutbox(); }
function saveOutbox() { try { localStorage.setItem('cg_outbox', JSON.stringify(outbox.slice(-500))); } catch (e) {} }
async function flushOutbox() {
  if (flushing || !outbox.length) return; flushing = true;
  try {
    while (outbox.length) {
      const w = outbox[0];
      try { await sb(w.path, { method: w.method, body: w.body, prefer: w.prefer }); }
      catch (e) { if (/DB 4\d\d/.test(e.message) && !/DB 40[89]/.test(e.message)) { console.warn('scrittura scartata', e.message); } else { dbState(false); break; } }
      outbox.shift(); saveOutbox();
    }
  } finally { flushing = false; }
}
setInterval(flushOutbox, 30000);
function dbState(ok, extra) {
  dbOk = ok; const b = $('dbBox'); if (!b) return;
  b.className = 'dbbox ' + (ok ? 'ok' : 'off');
  b.querySelector('span').textContent = ok ? 'Collegato a Supabase: giocatori, aree e partite vengono salvati.' + (extra || '') : 'Database non raggiungibile: salvo sul dispositivo e invio appena torna la connessione.';
}
// --- partite e round ---
function dbStartGame(g) {
  g.dbId = uuid();
  dbWrite('games', 'POST', { id: g.dbId, mode: isChi() ? 'chi' : 'classic', area: g.region, place_type: g.places, image_source: g.mode, timer_s: cfg.timer, rounds: cfg.rounds,
    player_ids: isChi() ? PEOPLE.map(p => p.id).filter(isUuid) : null, device: isPhone() ? 'telefono' : 'computer' }, 'return=minimal');
}
function dbRound(r) {
  if (!game || !game.dbId) return;
  dbWrite('rounds', 'POST', { game_id: game.dbId, round_no: r.round_no, area_id: r.area_id, place_name: r.place_name || null, place_kind: r.place_kind,
    target_lat: r.target.lat, target_lng: r.target.lng, guess_lat: r.guess ? r.guess.lat : null, guess_lng: r.guess ? r.guess.lng : null,
    guessed_player: isUuid(r.guessed_player) ? r.guessed_player : null, closest_player: isUuid(r.closest_player) ? r.closest_player : null, correct: r.correct ?? null,
    distance_km: r.distance_km != null ? +r.distance_km.toFixed(3) : null, base: r.base, speed_bonus: r.speed_bonus || 0, extra_bonus: r.extra_bonus || 0, streak_bonus: r.streak_bonus || 0,
    total: r.total, time_s: r.time_s != null ? +r.time_s.toFixed(1) : null, image_ref: r.image_ref ? String(r.image_ref).slice(0, 300) : null }, 'return=minimal');
}
function dbFinishGame(g) {
  if (!g || !g.dbId || g.dbDone) return; g.dbDone = true;
  dbWrite('games?id=eq.' + g.dbId, 'PATCH', { total: g.total, correct: isChi() ? g.history.filter(r => r.correct).length : null, finished_at: new Date().toISOString() }, 'return=minimal');
  setTimeout(loadHistory, 3000);
}
// --- giocatori ---
const dbPlayerRow = p => ({ id: p.id, slug: p.slug || null, name: p.name, home: p.home, lat: p.lat, lng: p.lng, color: p.col, active: !!p.on });
function dbPlayerSave(p, isNew) {
  if (!isUuid(p.id)) return;
  if (isNew) dbWrite('players', 'POST', dbPlayerRow(p), 'return=minimal,resolution=merge-duplicates');
  else dbWrite('players?id=eq.' + p.id, 'PATCH', { name: p.name, home: p.home, lat: p.lat, lng: p.lng, color: p.col, active: !!p.on }, 'return=minimal');
}
function dbPlayerDelete(p) { if (isUuid(p.id)) dbWrite('players?id=eq.' + p.id, 'DELETE', null, 'return=minimal'); }
// --- aree ---
function areaScale(b) { const km = haversine({ lat: b[0][0], lng: b[0][1] }, { lat: b[1][0], lng: b[1][1] }); return Math.max(5, Math.min(40, Math.round(km / 12))); }
function addAreaLocal(a) {     // a: { id, name, kind, outline, scale_km, enabled, sort, towns? }
  if (!a.outline) return;
  if (!GEO[a.id]) GEO[a.id] = { outline: a.outline, comuni: [] };
  const bb = bboxOf(a.outline), bounds = [[bb[0], bb[1]], [bb[2], bb[3]]];
  if (!REGIONS[a.id]) {
    const towns = CENTRI.filter(c => inGeom(c[1], c[2], a.outline)).sort((x, y) => y[4] - x[4]).slice(0, 5).map(c => [c[0], c[1], c[2]]);
    REGIONS[a.id] = { name: a.name, scale: a.scale_km || areaScale(bounds), osm: a.name, bounds, towns, places: [] };
  }
  AREA_META[a.id] = { kind: a.kind, enabled: a.enabled !== false, sort: a.sort ?? 100 };
}
function refreshAreas() {
  AREAS = Object.keys(AREA_META).filter(k => k !== 'italia' && k !== 'sel' && !AREA_META[k].temp && AREA_META[k].enabled && REGIONS[k]).sort((a, b) => AREA_META[a].sort - AREA_META[b].sort);
  if (cfg.region === 'mix') cfg.region = AREAS[0] || 'calabria';
  if (cfg.region !== 'italia' && cfg.region !== 'sel' && !AREAS.includes(cfg.region)) cfg.region = AREAS[0] || 'italia';
  try { localStorage.setItem('cg_areas', JSON.stringify(Object.entries(AREA_META).filter(([id, m]) => id !== 'sel' && !m.temp).map(([id, m]) => ({ id, ...m, name: REGIONS[id] && REGIONS[id].name, outline: m.kind === 'curated' ? null : GEO[id] && GEO[id].outline })))); } catch (e) {}
  renderRegionChips(); renderAreas();
}
var AREA_EMOJI = { calabria: '🌶️', treviso: '🍷', umbria: '🌳', roma: '🏛️' };
var ZONE_READY = false;
function renderRegionChips() { if (ZONE_READY) renderZoneMenu(); }
function areaThumb(g) {   // mini sagoma della zona
  const [s, w, n, e] = bboxOf(g), sx = 34 / Math.max(e - w, (n - s) * 1.3), pts = [];
  ringsOf(g).forEach(p => pts.push('M' + p[0].map(([x, y]) => ((x - w) * sx * 1.3 / 1.3 + 2).toFixed(1) + ',' + ((n - y) * sx * 1.3 + 2).toFixed(1)).join('L') + 'Z'));
  return '<svg viewBox="0 0 38 38"><path d="' + pts.join('') + '" fill="rgba(255,107,74,.25)" stroke="#ff6b4a" stroke-width="1.2"/></svg>';
}
function renderAreas() {
  const box = $('arList'); if (!box) return;
  const ids = Object.keys(AREA_META).filter(k => k !== 'italia' && REGIONS[k]).sort((a, b) => AREA_META[a].sort - AREA_META[b].sort);
  box.innerHTML = ids.map(k => { const m = AREA_META[k];
    return '<div class="arrow' + (m.enabled ? '' : ' off') + '">' + areaThumb(GEO[k].outline) + '<span class="pinfo"><b>' + esc(REGIONS[k].name) + '</b><small>'
      + (m.kind === 'curated' ? 'Zona con posti scelti a mano' : m.kind === 'regione' ? 'Regione aggiunta' : 'Provincia aggiunta') + '</small></span>'
      + '<label class="tgl"><input type="checkbox" data-a="' + k + '"' + (m.enabled ? ' checked' : '') + '><i></i></label>'
      + (m.kind === 'curated' ? '' : '<button class="pldel" data-ad="' + k + '" title="Elimina">✕</button>') + '</div>'; }).join('');
  box.querySelectorAll('[data-a]').forEach(x => x.onchange = () => {
    const k = x.dataset.a; AREA_META[k].enabled = x.checked;
    if (!AREAS.filter(a => a !== k).length && !x.checked) { x.checked = true; AREA_META[k].enabled = true; return toast('Tieni almeno una zona attiva'); }
    dbWrite('areas?id=eq.' + k, 'PATCH', { enabled: x.checked }, 'return=minimal'); refreshAreas(); menuFocus();
  });
  box.querySelectorAll('[data-ad]').forEach(x => x.onclick = () => {
    const k = x.dataset.ad; if (AREAS.length <= 1 && AREAS[0] === k) return toast('Tieni almeno una zona attiva');
    delete AREA_META[k]; delete REGIONS[k]; delete GEO[k]; dbWrite('areas?id=eq.' + k, 'DELETE', null, 'return=minimal'); refreshAreas(); menuFocus(); toast('Zona eliminata');
  });
}
if ($('arSearch')) $('arSearch').oninput = () => {
  const n = norm($('arSearch').value); const box = $('arSugg');
  if (n.length < 2) return show(box, false);
  const list = CATALOG.filter(c => norm(c.name).includes(n) || norm(c.region).includes(n)).sort((a, b) => (a.kind === 'regione' ? 0 : 1) - (b.kind === 'regione' ? 0 : 1)).slice(0, 10);
  box.innerHTML = list.length ? list.map((c, i) => '<div data-i="' + i + '">' + esc(c.name) + '<small>' + (c.kind === 'regione' ? 'regione' : esc(c.region)) + (AREA_META[c.id] ? ' · già presente' : '') + '</small></div>').join('')
    : '<div style="color:var(--mut);cursor:default">Nessuna regione o provincia</div>';
  box.querySelectorAll('[data-i]').forEach(d => d.onclick = () => {
    const c = list[+d.dataset.i]; show(box, false); $('arSearch').value = '';
    if (AREA_META[c.id]) { AREA_META[c.id].enabled = true; dbWrite('areas?id=eq.' + c.id, 'PATCH', { enabled: true }, 'return=minimal'); refreshAreas(); return toast(c.name + ' riattivata'); }
    const bb = bboxOf(c.outline), bounds = [[bb[0], bb[1]], [bb[2], bb[3]]];
    const a = { id: c.id, name: c.name, kind: c.kind, outline: c.outline, scale_km: areaScale(bounds), enabled: true, sort: 10 + Object.keys(AREA_META).length };
    addAreaLocal(a);
    dbWrite('areas', 'POST', { ...a, bounds, towns: REGIONS[c.id].towns }, 'return=minimal,resolution=merge-duplicates');
    refreshAreas(); toast(c.name + ' aggiunta ✓');
  });
  show(box);
};

// zone salvate sul dispositivo (funziona anche senza database)
try { (JSON.parse(localStorage.getItem('cg_areas') || '[]')).forEach(a => { if (a.kind === 'curated') { if (AREA_META[a.id]) AREA_META[a.id].enabled = a.enabled; } else if (a.id !== 'italia' && a.outline) addAreaLocal(a); }); } catch (e) {}
refreshAreas();
// --- storico ---
const MODE_NAME = { classic: 'Classica', chi: 'Chi abita più vicino?' };
async function loadHistory() {
  const box = $('histList'); if (!box) return;
  try {
    const rows = await sb('games?select=mode,area,place_type,total,correct,rounds,finished_at&finished_at=not.is.null&order=finished_at.desc&limit=12');
    box.innerHTML = rows.length ? rows.map(r => '<div class="hrow"><span>' + esc(MODE_NAME[r.mode] || r.mode) + ' · ' + esc(r.area === 'mix' ? 'Tutte' : REGIONS[r.area] ? REGIONS[r.area].name : r.area) + '</span><b>' + fmt(r.total) + '</b><small>'
      + new Date(r.finished_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + r.rounds + ' round' + (r.correct != null ? ' · ' + r.correct + ' giuste' : '') + ' · ' + esc(PLACES_LBL[r.place_type] || r.place_type) + '</small></div>').join('')
      : '<p class="hint">Ancora nessuna partita salvata.</p>';
  } catch (e) { box.innerHTML = '<p class="hint">Storico non disponibile senza database.</p>'; }
}
// --- avvio: leggo dal database, carico i dati di riferimento se mancano ---
async function dbInit() {
  try {
    const areas = await sb('areas?select=id,name,kind,scale_km,enabled,sort,outline,towns&order=sort');
    const pl = await sb('players?select=*&order=created_at');
    dbState(true);
    // aree
    areas.forEach(a => {
      if (a.kind === 'curated') { if (AREA_META[a.id]) { AREA_META[a.id].enabled = a.enabled; AREA_META[a.id].sort = a.sort; } }
      else if (a.kind !== 'italia') addAreaLocal(a);
    });
    Object.keys(AREA_META).forEach(k => { if (AREA_META[k].kind !== 'curated' && !areas.find(a => a.id === k)) { const m = AREA_META[k];
      dbWrite('areas', 'POST', { id: k, name: REGIONS[k].name, kind: m.kind, outline: GEO[k].outline, scale_km: REGIONS[k].scale, enabled: m.enabled, sort: m.sort }, 'return=minimal,resolution=merge-duplicates'); } });
    refreshAreas(); if (!$('menu').classList.contains('hidden')) menuFocus();
    // giocatori: il database è la fonte; i giocatori creati solo qui vengono caricati
    if (pl.length) {
      const local = PLAYERS;
      PLAYERS = pl.map(r => ({ id: r.id, slug: r.slug, name: r.name, home: r.home, lat: r.lat, lng: r.lng, col: r.color, on: r.active }));
      local.filter(p => !pl.find(r => r.id === p.id || (r.slug && r.slug === (p.slug || p.id)))).forEach(p => { if (!isUuid(p.id)) p.id = uuid(); PLAYERS.push(p); dbPlayerSave(p, true); });
      savePlayers(); if ($('hud').classList.contains('hidden')) { refreshPeople(); renderPeopleCards(); } renderPlayers(); renderSummary();
    }
    flushOutbox(); loadHistory();
    const cnt = await sb('games?select=id&finished_at=not.is.null', { prefer: 'count=exact' }).catch(() => null);
    if (cnt) dbState(true, ' ' + cnt.length + ' partite salvate.');
  } catch (e) { console.warn('database', e.message); dbState(false); loadHistory(); }
}
dbInit();


/* ================= MULTIGIOCATORE ================= */
const MP = { code: null, me: null, host: false, room: null, members: [], guesses: [], lastRound: 0, poll: null, savedCfg: null, people: null, finalShown: false, drawn: new Set(), beat: 0, busy: false };
MP.me = store('cg_me') || uuid(); store('cg_me', MP.me);
$('mpNick').value = store('cg_nick') || '';
const mpColor = id => PALETTE[parseInt(String(id).replace(/-/g, '').slice(0, 6), 16) % PALETTE.length];
function mpCfgText(st) {
  const s = st || cfg;
  const zona = s.region === 'italia' ? 'Chi abita più vicino?' : s.region === 'mix' ? 'Tutte le zone' : (REGIONS[s.region] || (st && st.area) || { name: s.region }).name;
  return [zona, s.timer ? s.timer / 60 + ' min' : 'senza timer', s.rounds + ' round', PLACES_LBL[s.places], MODE_LBL[s.mode]];
}
function mpOpen() {
  if (MP.code) return mpShowLobby();
  show('mp'); show('mpStart'); show('mpLobby', false); $('mpErr').textContent = '';
  $('mpCfg').textContent = 'Con le impostazioni attuali: ' + mpCfgText().join(' · ') + '.';
  if (cfg.mode === 'mly') $('mpCfg').textContent += ' (Mapillary: ogni giocatore deve avere il token)';
}
$('mpOpen').onclick = mpOpen;
$('mpClose').onclick = $('mpBack').onclick = () => show('mp', false);
$('mpCode').oninput = () => { $('mpCode').value = $('mpCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
function mpNick() { const n = $('mpNick').value.trim(); if (!n) { $('mpErr').textContent = 'Scrivi il tuo nome.'; $('mpNick').focus(); return null; } store('cg_nick', n); return n; }
async function mpAssets(st) {   // ciò che serve sul dispositivo per vedere le immagini
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (st.mode === 'sv') await loadGoogle($('apiKey').value.trim() || store('cg_key') || DEFAULT_GKEY);
  if (st.mode === 'mly') { if (!store('cg_mly')) throw new Error('serve il token Mapillary (Impostazioni → Immagini)'); for (let i = 0; i < 20 && !window.mapillary; i++) await sleep(250); }
}
$('mpCreate').onclick = async () => {
  const nick = mpNick(); if (!nick) return;
  if (isChi() && PLAYERS.filter(p => p.on).length < 2) return $('mpErr').textContent = 'Per "Chi abita più vicino?" attiva almeno 2 persone in Impostazioni → Giocatori.';
  $('mpCreate').disabled = true; $('mpErr').textContent = '';
  try {
    const st = { region: cfg.region, places: cfg.places, mode: cfg.mode, timer: cfg.timer, rounds: cfg.rounds, noMove: cfg.noMove };
    await mpAssets(st);
    const regs = cfg.region === 'mix' ? AREAS : [cfg.region];
    st.areas = regs.filter(k => AREA_META[k] && AREA_META[k].kind !== 'curated' && k !== 'italia').map(k => ({ id: k, name: REGIONS[k].name, kind: AREA_META[k].kind, outline: GEO[k].outline, scale_km: REGIONS[k].scale }));
    if (cfg.region === 'mix') st.mixAreas = AREAS.slice();
    if (isChi()) st.people = PLAYERS.filter(p => p.on).map(p => ({ id: p.id, name: p.name, home: p.home, lat: p.lat, lng: p.lng, col: p.col }));
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = '';
    for (let i = 0; i < 5; i++) code += A[Math.floor(Math.random() * A.length)];
    await sb('rooms', { method: 'POST', body: { code, host_id: MP.me, settings: st }, prefer: 'return=minimal' });
    await mpJoin(code, nick);
  } catch (e) { $('mpErr').textContent = 'Non riesco a creare la stanza: ' + e.message; }
  $('mpCreate').disabled = false;
};
$('mpJoin').onclick = async () => {
  const nick = mpNick(); if (!nick) return;
  const code = $('mpCode').value.trim(); if (code.length !== 5) return $('mpErr').textContent = 'Il codice ha 5 caratteri.';
  $('mpJoin').disabled = true; $('mpErr').textContent = '';
  try { await mpJoin(code, nick); } catch (e) { $('mpErr').textContent = e.message; }
  $('mpJoin').disabled = false;
};
async function mpJoin(code, nick) {
  const rows = await sb('rooms?code=eq.' + code + '&select=*');
  if (!rows.length) throw new Error('Stanza ' + code + ' non trovata. Controlla il codice.');
  const room = rows[0];
  if (room.status === 'finished') throw new Error('Questa partita è già finita.');
  await mpAssets(room.settings);
  await sb('room_members', { method: 'POST', body: { room_code: code, member_id: MP.me, nickname: nick, color: mpColor(MP.me) }, prefer: 'return=minimal,resolution=merge-duplicates' });
  MP.code = code; MP.room = room; MP.host = room.host_id === MP.me; MP.lastRound = 0; MP.finalShown = false; MP.drawn = new Set();
  mpApply(room.settings);
  mpShowLobby();
  clearInterval(MP.poll); MP.poll = setInterval(mpTick, 1500); mpTick();
}
function mpApply(st) {   // uso le impostazioni della stanza senza toccare le mie
  if (!MP.savedCfg) MP.savedCfg = { ...cfg };
  Object.assign(cfg, { region: st.region, places: st.places, mode: st.mode, timer: st.timer, rounds: st.rounds, noMove: !!st.noMove });
  (st.areas || []).forEach(a => {
    if (a.id === 'sel' && REGIONS.sel) { MP.savedSel = { r: REGIONS.sel, g: GEO.sel, m: AREA_META.sel }; delete REGIONS.sel; delete GEO.sel; delete centriCache.sel; }
    if (!REGIONS[a.id]) { addAreaLocal({ ...a, enabled: false }); AREA_META[a.id].temp = true; }
  });
  if (st.mixAreas) MP.savedAreas = AREAS.slice(), AREAS = st.mixAreas.filter(k => REGIONS[k]);
  MP.people = st.people || null;
}
function mpRestore() {
  if (MP.savedCfg) { Object.assign(cfg, MP.savedCfg); MP.savedCfg = null; }
  Object.keys(AREA_META).forEach(k => { if (AREA_META[k].temp) { delete AREA_META[k]; delete REGIONS[k]; delete GEO[k]; delete centriCache[k]; } });
  if (MP.savedSel) { REGIONS.sel = MP.savedSel.r; GEO.sel = MP.savedSel.g; AREA_META.sel = MP.savedSel.m; MP.savedSel = null; }
  if (MP.savedAreas) { AREAS = MP.savedAreas; MP.savedAreas = null; }
  MP.people = null; refreshPeople(); renderPeopleCards();
}
function mpShowLobby() {
  mpLobbySig = '';
  show('mp'); show('mpStart', false); show('mpLobby');
  $('mpBig').textContent = MP.code;
  $('mpSets').innerHTML = mpCfgText(MP.room && MP.room.settings).map(x => '<span>' + esc(x) + '</span>').join('');
  mpRenderLobby();
}
let mpLobbySig = '';
function mpRenderLobby() {
  if ($('mpLobby').classList.contains('hidden')) return;
  const now = Date.now();
  const sig = JSON.stringify([MP.room && MP.room.status, MP.host, MP.members.map(m => [m.member_id, m.nickname, now - new Date(m.last_seen).getTime() < 25000])]);
  if (sig === mpLobbySig) return; mpLobbySig = sig;
  const seen = new Set([...$('mpMembers').querySelectorAll('[data-m]')].map(x => x.dataset.m));
  $('mpMembers').innerHTML = MP.members.map(m => '<div class="mpm' + (seen.has(m.member_id) ? ' still' : '') + '" data-m="' + m.member_id + '"><span class="pav" style="--c:' + m.color + '">' + esc(m.nickname[0].toUpperCase()) + '</span><b>' + esc(m.nickname) + (m.member_id === MP.me ? ' (tu)' : '') + '</b>'
    + (MP.room && m.member_id === MP.room.host_id ? '<span class="host">host</span>' : '') + '<small>' + (now - new Date(m.last_seen).getTime() < 25000 ? '🟢' : '⚪') + '</small></div>').join('') || '<p class="hint">Nessuno ancora…</p>';
  show('mpGo', MP.host && MP.room && MP.room.status === 'lobby');
  const hostName = (MP.members.find(m => MP.room && m.member_id === MP.room.host_id) || {}).nickname || "l'host";
  $('mpWait').textContent = MP.host ? (MP.members.length < 2 ? 'Condividi il codice: gli altri entrano da "Gioca con gli amici". Puoi anche iniziare da solo per provare.' : '') : MP.room && MP.room.status === 'playing' ? 'Partita in corso: entri dal prossimo round…' : 'In attesa che ' + hostName + ' inizi la partita…';
}
$('mpCopy').onclick = async () => { try { await navigator.clipboard.writeText(MP.code); toast('Codice copiato: ' + MP.code); } catch (e) { toast('Il codice è ' + MP.code); } };
$('mpGo').onclick = async () => {
  $('mpGo').disabled = true;
  try {
    await sb('rooms?code=eq.' + MP.code, { method: 'PATCH', body: { status: 'playing' }, prefer: 'return=minimal' });
    MP.room.status = 'playing'; show('mp', false);
    startGame({ multi: true, noRound: true }); nextRound();
  } catch (e) { toast('Errore: ' + e.message); }
  $('mpGo').disabled = false;
};
$('mpLeave').onclick = () => mpLeave();
async function mpLeave(silent) {
  clearInterval(MP.poll); MP.poll = null;
  const code = MP.code; MP.code = null; MP.room = null; MP.members = []; MP.host = false;
  if (code) sb('room_members?room_code=eq.' + code + '&member_id=eq.' + MP.me, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  mpRestore(); show('mp', false); show('mpBoard', false); show('hRoom', false);
  if (game) game.multi = false;
  if (!silent) toMenu();
}
// round: l'host lo pubblica, tutti lo ricevono
async function mpPublishRound(n, r) {
  const data = { region: r.region, place: r.place, kind: r.kind, src: r.src || null, id: r.id || null, pano: r.pano || null, heading: r.heading ?? null, target: r.target,
    credit: r.credit || '', poi: !!r.poi, random: !!r.random, who: r.who ?? null, prov: r.prov || null };
  await sb('room_rounds', { method: 'POST', body: { room_code: MP.code, round_no: n, data }, prefer: 'return=minimal,resolution=ignore-duplicates' });
  await sb('rooms?code=eq.' + MP.code, { method: 'PATCH', body: { current_round: n, round_started_at: new Date().toISOString() }, prefer: 'return=minimal' });
}
async function mpBeginRound(n, data) {
  if (!game || !game.multi) { show('mp', false); startGame({ multi: true, noRound: true }); }
  const tok = ++roundToken; game.round = n; resetRoundUI(); MP.drawn = new Set(); show('mpBoard', false); mpBoardSig = '';
  if (data.kind === 'photo') { loadingOn(); try { await preloadImg(data.src); } catch (e) {} }
  if (tok !== roundToken) return;
  await beginRound({ ...data }, tok);
}
async function mpAfterGuess(guessData, points, detail, last) {
  sb('room_guesses', { method: 'POST', body: { room_code: MP.code, round_no: game.round, member_id: MP.me, guess: guessData, points, detail }, prefer: 'return=minimal,resolution=ignore-duplicates' })
    .catch(e => toast('Risposta non inviata: ' + e.message));
  show('mpBoard'); mpBoardSig = ''; mpRenderBoard(); mpNextButton(last);
}
function mpNextButton(last) {
  const nb = $('nextBtn'); show(nb);
  if (MP.host) {
    nb.disabled = false; nb.textContent = last ? 'Classifica finale 🏁' : 'Prossimo round per tutti →';
    nb.onclick = last ? async () => { nb.disabled = true; await sb('rooms?code=eq.' + MP.code, { method: 'PATCH', body: { status: 'finished' }, prefer: 'return=minimal' }).catch(() => {}); mpTick(); }
      : () => { nb.disabled = true; nextRound(); };
  } else {
    const hostName = (MP.members.find(m => MP.room && m.member_id === MP.room.host_id) || {}).nickname || "l'host";
    nb.disabled = true; nb.textContent = last ? 'In attesa della classifica…' : 'In attesa di ' + hostName + '…';
  }
}
let mpBoardSig = '';
function mpRenderBoard() {
  if (!game || !game.multi || $('mpBoard').classList.contains('hidden')) return;
  const n = game.round, gs = MP.guesses.filter(g => g.round_no === n);
  const sig = JSON.stringify([n, MP.members.map(m => [m.member_id, m.nickname]), MP.guesses.map(g => [g.member_id, g.round_no, g.points])]);
  if (sig === mpBoardSig) return; mpBoardSig = sig;
  const before = new Set([...$('mpBoard').querySelectorAll('[data-g]')].map(x => x.dataset.g));
  const tot = {}; MP.guesses.forEach(g => tot[g.member_id] = (tot[g.member_id] || 0) + g.points);
  const rows = MP.members.map(m => ({ m, g: gs.find(x => x.member_id === m.member_id), t: tot[m.member_id] || 0 }))
    .sort((a, b) => (b.g ? b.g.points : -1) - (a.g ? a.g.points : -1) || b.t - a.t);
  const done = gs.length, all = MP.members.length;
  $('mpBoard').innerHTML = '<h4>Round ' + n + ' · ' + done + '/' + all + ' hanno risposto</h4>' + rows.map((x, i) => {
    const d = x.g && x.g.detail || {}, gu = x.g && x.g.guess;
    const ans = !x.g ? 'sta ancora pensando…' : isChi() ? (gu && gu.name ? (d.correct ? '✅ ' : '❌ ') + esc(gu.name) : '⏰ tempo scaduto') : gu && gu.lat != null ? fmtKm(d.km) : '⏰ tempo scaduto';
    const key = x.m.member_id + (x.g ? ':ok' : ':wait');
    return '<div data-g="' + key + '" class="mpb' + (before.has(key) ? ' still' : '') + (x.m.member_id === MP.me ? ' me' : '') + (x.g ? '' : ' wait') + '" style="--c:' + x.m.color + '"><span class="pos">' + (x.g ? i + 1 : '·') + '</span><span class="who"><i></i><span>' + esc(x.m.nickname) + '</span></span><span class="ans">' + ans + '</span>'
      + '<span class="pts">' + (x.g ? fmt(x.g.points) : '—') + '<small>tot ' + fmt(x.t) + '</small></span></div>'; }).join('');
  // sulla mappa: le risposte degli altri
  if (!isChi() && rLayer) gs.forEach(g => {
    if (g.member_id === MP.me || MP.drawn.has(g.member_id) || !g.guess || g.guess.lat == null || !cur) return; MP.drawn.add(g.member_id);
    const m = MP.members.find(x => x.member_id === g.member_id) || { nickname: '?', color: '#fff' };
    L.polyline([g.guess, cur.target], { color: m.color, weight: 2, opacity: .7, dashArray: '4 6', interactive: false }).addTo(rLayer);
    L.marker([g.guess.lat, g.guess.lng], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="mpdot" style="--c:' + m.color + '"><i></i>' + esc(m.nickname) + '</div>', iconSize: [0, 0] }) }).addTo(rLayer);
  });
}
async function mpRenderStandings() {
  if (!MP.code) return;
  let st = [];
  try { st = await sb('room_standings?room_code=eq.' + MP.code + '&select=*&order=total.desc'); } catch (e) {}
  if (!st.length) return;
  const fl = $('finalList'); show(fl); show('mpBoard', false);
  const top = st.slice(0, 3), order = [1, 0, 2].filter(i => top[i]), max = top[0].total || 1;
  fl.innerHTML = '<div class="podium">' + order.map(i => '<div><b>' + esc(top[i].nickname) + '</b><small>' + fmt(top[i].total) + '</small><span class="bar" style="--c:' + top[i].color + ';height:' + Math.round(50 + 70 * top[i].total / max) + 'px">' + (i + 1) + '</span></div>').join('') + '</div>'
    + st.map((r, i) => '<div class="mpb' + (r.member_id === MP.me ? ' me' : '') + '" style="--c:' + r.color + ';animation-delay:' + i * .06 + 's"><span class="pos">' + (i + 1) + '</span><span class="who"><i></i><span>' + esc(r.nickname) + '</span></span><span class="ans">' + r.answered + ' round</span><span class="pts">' + fmt(r.total) + '</span></div>').join('');
  const me = st.findIndex(r => r.member_id === MP.me);
  if (me === 0) { sfx.win(); confetti(320); toast('🏆 Hai vinto la stanza!'); }
  const nb = $('nextBtn'); show(nb); nb.disabled = false;
  if (MP.host) { nb.textContent = 'Nuova partita con gli stessi amici 🔁'; nb.onclick = mpRematch; } else { nb.textContent = 'In attesa di una nuova partita…'; nb.disabled = true; }
  show('toMenuBtn'); $('toMenuBtn').textContent = 'Esci dalla stanza'; $('toMenuBtn').onclick = () => { $('toMenuBtn').textContent = 'Menu'; $('toMenuBtn').onclick = toMenu; mpLeave(); };
}
async function mpRematch() {   // nuova stanza con le stesse impostazioni: gli altri ci entrano da soli
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 5; i++) code += A[Math.floor(Math.random() * A.length)];
  const st = { ...MP.room.settings }; delete st.next;
  try {
    await sb('rooms', { method: 'POST', body: { code, host_id: MP.me, settings: st }, prefer: 'return=minimal' });
    await sb('rooms?code=eq.' + MP.code, { method: 'PATCH', body: { settings: { ...MP.room.settings, next: code } }, prefer: 'return=minimal' });
    const nick = store('cg_nick'); const saved = MP.savedCfg; MP.savedCfg = null;
    await mpLeave(true); MP.savedCfg = saved; await mpJoin(code, nick);
    $('result').classList.remove('show'); ['hud', 'guessBox', 'peopleBox', 'viewer', 'mapFab'].forEach(id => show(id, false));
  } catch (e) { toast('Errore: ' + e.message); }
}
async function mpTick() {
  if (!MP.code || MP.busy) return; MP.busy = true;
  try {
    const code = MP.code;
    const [rooms, members] = await Promise.all([sb('rooms?code=eq.' + code + '&select=*'), sb('room_members?room_code=eq.' + code + '&select=*&order=joined_at')]);
    if (code !== MP.code || !rooms.length) return;
    MP.room = rooms[0]; MP.members = members;
    if (Date.now() - MP.beat > 10000) { MP.beat = Date.now(); sb('room_members?room_code=eq.' + code + '&member_id=eq.' + MP.me, { method: 'PATCH', body: { last_seen: new Date().toISOString() }, prefer: 'return=minimal' }).catch(() => {}); }
    mpRenderLobby();
    const room = MP.room;
    // l'host ha creato una nuova partita: ci entro anch'io
    if (room.settings.next && !MP.host && MP.finalShown) {
      const nick = store('cg_nick'), saved = MP.savedCfg; MP.savedCfg = null;
      await mpLeave(true); MP.savedCfg = saved; $('result').classList.remove('show'); ['hud', 'guessBox', 'peopleBox', 'viewer', 'mapFab'].forEach(id => show(id, false));
      await mpJoin(room.settings.next, nick); toast('Nuova partita! Stanza ' + room.settings.next); return;
    }
    if (room.current_round > 0) MP.guesses = await sb('room_guesses?room_code=eq.' + code + '&select=member_id,round_no,guess,points,detail');
    if (room.status !== 'lobby' && room.current_round > MP.lastRound) {
      const rr = await sb('room_rounds?room_code=eq.' + code + '&round_no=eq.' + room.current_round + '&select=data');
      if (rr.length) { MP.lastRound = room.current_round; mpBeginRound(room.current_round, rr[0].data); }
    }
    mpRenderBoard();
    if (room.status === 'finished' && game && game.multi && !MP.finalShown && cur && cur.done) showFinal();
    else if (room.status === 'finished' && MP.finalShown) { if (!$('finalList').querySelector('.podium')) mpRenderStandings(); }
    const hr = code + ' · ' + members.length; if ($('hRoom').querySelector('b').textContent !== hr) $('hRoom').querySelector('b').textContent = hr;
  } catch (e) { console.warn('stanza', e.message); }
  finally { MP.busy = false; }
}


/* ================= SCELTA DELLE ZONE ================= */
const PROVS = CATALOG.filter(c => c.kind === 'provincia'), REGS = CATALOG.filter(c => c.kind === 'regione');
const PROV_BY = Object.fromEntries(PROVS.map(p => [p.id, p]));
const provsOf = reg => PROVS.filter(p => p.region === reg).map(p => p.id);
const GROUPS = {
  'Tutta Italia': REGS.map(r => r.name),
  'Nord': ['Piemonte', "Valle d'Aosta/Vallée d'Aoste", 'Liguria', 'Lombardia', 'Trentino-Alto Adige/Südtirol', 'Veneto', 'Friuli-Venezia Giulia', 'Emilia-Romagna'],
  'Centro': ['Toscana', 'Umbria', 'Marche', 'Lazio'],
  'Sud': ['Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria'],
  'Isole': ['Sicilia', 'Sardegna']
};
const shortReg = n => n.split('/')[0];
let zoneEditing = false, zoneSel = new Set(), zoneLayer = null, zoneClick = 'prov';
let COMBOS = []; try { COMBOS = JSON.parse(localStorage.getItem('cg_combos') || '[]'); } catch (e) {}
const saveCombos = () => { try { localStorage.setItem('cg_combos', JSON.stringify(COMBOS)); } catch (e) {} };
if (!Array.isArray(cfg.sel)) cfg.sel = [];
// nome leggibile di una selezione di province
const provShort = id => PROV_BY[id].name.replace(/^Provincia di /, '').replace(/^Città metropolitana di /, '').split('/')[0];
function selName(ids) {
  const set = new Set(ids);
  const combo = COMBOS.find(c => c.provs.length === set.size && c.provs.every(x => set.has(x))); if (combo) return combo.name;
  for (const [g, regs] of Object.entries(GROUPS)) {
    const all = regs.flatMap(provsOf), miss = all.filter(x => !set.has(x)), extra = ids.filter(x => !all.includes(x));
    const gn = g === 'Tutta Italia' ? g : g + ' Italia';
    if (!miss.length && !extra.length) return gn;
    if (miss.length + extra.length <= 3 && miss.length < all.length / 2) return gn + (miss.length ? ' senza ' + miss.map(provShort).join(', ') : '') + (extra.length ? ' + ' + extra.map(provShort).join(', ') : '');
  }
  const parts = []; const left = new Set(ids);
  REGS.forEach(r => { const ps = provsOf(r.name); if (ps.length && ps.every(x => set.has(x))) { parts.push(shortReg(r.name)); ps.forEach(x => left.delete(x)); } });
  left.forEach(x => parts.push(provShort(x)));
  return parts.length > 3 ? parts.slice(0, 3).join(', ') + ' e altre ' + (parts.length - 3) : parts.join(' + ') || 'Nessuna zona';
}
// costruisce l'area di gioco "sel" dall'elenco di province (o usa una zona già pronta se coincide)
function applySel(ids) {
  const set = new Set(ids);
  const same = reg => { const ps = provsOf(reg); return ps.length === set.size && ps.every(x => set.has(x)); };
  if (same('Calabria')) return 'calabria';
  if (same('Umbria')) return 'umbria';
  if (set.size === 1 && set.has('prov-treviso')) return 'treviso';
  const coords = [];
  ids.forEach(id => { const g = PROV_BY[id] && PROV_BY[id].outline; if (!g) return; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(c => coords.push(c)); });
  if (!coords.length) return null;
  delete REGIONS.sel; delete GEO.sel; delete centriCache.sel;
  addAreaLocal({ id: 'sel', name: selName(ids), kind: 'custom', outline: { type: 'MultiPolygon', coordinates: coords }, enabled: true, sort: 999 });
  return 'sel';
}
function setZone(region, ids) {
  if (ids) { cfg.sel = ids.slice(); const r = applySel(ids); if (!r) return toast('Scegli almeno una provincia'); region = r; }
  cfg.region = region; cfg.lastClassic = region; store('cg_cfg3', JSON.stringify(cfg));
  renderZoneMenu(); onCfgChange(); menuFocus(); prewarmRound();
}
if (cfg.region === 'sel' && !applySel(cfg.sel)) cfg.region = 'calabria';
// menu: modalità, zona attuale, scelte rapide
function renderZoneMenu() {
  const chi = isChi();
  document.querySelectorAll('#modeChips .chip').forEach(b => b.classList.toggle('sel', (b.dataset.v === 'chi') === chi));
  show('zoneBox', !chi);
  if (chi) return;
  const r = REGIONS[cfg.region];
  $('zName').textContent = r ? r.name : '—';
  $('zSub').textContent = cfg.region === 'sel' ? cfg.sel.length + (cfg.sel.length === 1 ? ' provincia' : ' province') : AREA_META[cfg.region] && AREA_META[cfg.region].kind === 'curated' ? 'Zona con posti scelti a mano' : '';
  const items = [['calabria', '🌶️ Calabria'], ['treviso', '🍷 Treviso'], ['umbria', '🌳 Umbria'], ['roma', '🏛️ Roma e Castelli']].filter(([k]) => REGIONS[k]);
  AREAS.filter(k => AREA_META[k].kind !== 'curated').forEach(k => items.push([k, '📍 ' + REGIONS[k].name.replace(/^Provincia di /, '')]));
  Object.keys(GROUPS).forEach(g => items.push(['g:' + g, (g === 'Tutta Italia' ? '🇮🇹 ' : '🧭 ') + g]));
  COMBOS.forEach((c, i) => items.push(['c:' + i, '⭐ ' + c.name]));
  const selKey = cfg.region === 'sel' ? (() => { const g = Object.keys(GROUPS).find(g => selName(cfg.sel) === (g === 'Tutta Italia' ? g : g + ' Italia')); if (g) return 'g:' + g;
    const i = COMBOS.findIndex(c => c.provs.length === cfg.sel.length && c.provs.every(x => cfg.sel.includes(x))); return i >= 0 ? 'c:' + i : ''; })() : cfg.region;
  $('regionChips').innerHTML = items.map(([k, l]) => '<button class="chip' + (k === selKey ? ' sel' : '') + '" data-v="' + k + '">' + esc(l) + (k.startsWith('c:') ? '<span class="x" data-x="' + k.slice(2) + '" title="Elimina">✕</span>' : '') + '</button>').join('');
  $('regionChips').querySelectorAll('.chip').forEach(b => b.onclick = e => {
    const k = b.dataset.v;
    if (e.target.dataset.x != null) { const c = COMBOS.splice(+e.target.dataset.x, 1)[0]; saveCombos(); if (c && c.dbId) dbWrite('areas?id=eq.' + c.dbId, 'DELETE', null, 'return=minimal'); renderZoneMenu(); return toast('Combinazione eliminata'); }
    if (k.startsWith('g:')) return setZone(null, GROUPS[k.slice(2)].flatMap(provsOf));
    if (k.startsWith('c:')) return setZone(null, COMBOS[+k.slice(2)].provs);
    setZone(k);
  });
}
document.querySelectorAll('#modeChips .chip').forEach(b => b.onclick = () => {
  if (b.dataset.v === 'chi') { if (!isChi()) cfg.lastClassic = cfg.region; cfg.region = 'italia'; }
  else cfg.region = cfg.lastClassic && (REGIONS[cfg.lastClassic] || cfg.lastClassic === 'sel') ? cfg.lastClassic : 'calabria';
  if (cfg.region === 'sel') applySel(cfg.sel);
  store('cg_cfg3', JSON.stringify(cfg)); renderZoneMenu(); onCfgChange(); menuFocus(); prewarmRound();
});
// ---- modifica sulla mappa ----
function curProvSet() {   // province che corrispondono alla zona attuale
  if (cfg.region === 'sel') return new Set(cfg.sel);
  if (cfg.region === 'calabria') return new Set(provsOf('Calabria'));
  if (cfg.region === 'umbria') return new Set(provsOf('Umbria'));
  if (cfg.region === 'treviso') return new Set(['prov-treviso']);
  if (cfg.region === 'roma') return new Set(['prov-roma']);
  const a = REGIONS[cfg.region]; if (a && PROV_BY[cfg.region]) return new Set([cfg.region]);
  const rg = REGS.find(r => r.id === cfg.region); if (rg) return new Set(provsOf(rg.name));
  return new Set();
}
function zoneStyle(id) {
  const on = zoneSel.has(id), dark = THEMES[cfg.theme].dark;
  return { color: on ? '#ff6b4a' : (dark ? 'rgba(255,255,255,.35)' : 'rgba(20,30,45,.4)'), weight: on ? 1.6 : .8, fillColor: on ? '#ff6b4a' : '#0b1626', fillOpacity: on ? .32 : (dark ? .45 : .18) };
}
function openZoneEdit() {
  zoneEditing = true; zoneSel = curProvSet();
  show('menu', false); show('regionTag', false); show('zonePanel');
  menuMap._cg.deco.clearLayers(); menuMap._cg.towns.clearLayers(); if (menuMap._cg.com) { menuMap.removeLayer(menuMap._cg.com); menuMap._cg.com = null; }
  zoneLayer = L.geoJSON({ type: 'FeatureCollection', features: PROVS.map(p => ({ type: 'Feature', properties: { id: p.id, name: p.name, region: p.region }, geometry: p.outline })) }, {
    renderer: menuMap._cg.canvas, style: f => zoneStyle(f.properties.id),
    onEachFeature: (f, l) => {
      l.bindTooltip(() => (zoneClick === 'reg' ? shortReg(f.properties.region) : f.properties.name.replace(/^Provincia di /, '').replace(/^Città metropolitana di /, '')), { sticky: true, className: 'ztip', direction: 'top', offset: [0, -8] });
      l.on('mouseover', () => l.setStyle({ weight: 2.4, color: '#ffb547' }));
      l.on('mouseout', () => l.setStyle(zoneStyle(f.properties.id)));
      l.on('click', () => {
        const ids = zoneClick === 'reg' ? provsOf(f.properties.region) : [f.properties.id];
        const turnOn = ids.some(x => !zoneSel.has(x)); ids.forEach(x => turnOn ? zoneSel.add(x) : zoneSel.delete(x)); sfx.pin(); zoneRefresh();
      });
    } }).addTo(menuMap);
  const b = L.latLngBounds([]); PROVS.forEach(p => { const bb = bboxOf(p.outline); b.extend([[bb[0], bb[1]], [bb[2], bb[3]]]); });
  menuMap.flyToBounds(b, { paddingTopLeft: [innerWidth > 900 ? 460 : 20, 30], paddingBottomRight: [30, 30], duration: 1 });
  $('zQuick').innerHTML = Object.keys(GROUPS).map(g => '<button class="chip" data-g="' + g + '">' + g + '</button>').join('') + '<button class="chip" data-g="">Nessuna</button>';
  $('zQuick').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const g = b.dataset.g; zoneSel = new Set(g ? GROUPS[g].flatMap(provsOf) : []); zoneRefresh(); });
  zoneRefresh(true);
}
const REG_THUMB = {}; REGS.forEach(r => REG_THUMB[r.name] = areaThumb(r.outline));
const zOpen = new Set(), zShut = new Set(); let zFind = '';
const triCls = (n, tot) => n === 0 ? '' : n === tot ? 'full' : 'part';
function zoneRefresh(rebuild) {
  if (zoneLayer) zoneLayer.eachLayer(l => l.setStyle(zoneStyle(l.feature.properties.id)));
  if (rebuild) { zOpen.clear(); REGS.forEach(r => { const ps = provsOf(r.name), n = ps.filter(x => zoneSel.has(x)).length; if (n && n < ps.length) zOpen.add(r.name); }); }
  const q = norm(zFind), scroll = $('zTree').scrollTop;
  let html = '';
  Object.entries(GROUPS).filter(([g]) => g !== 'Tutta Italia').forEach(([g, regs]) => {
    const rows = regs.map(rn => REGS.find(r => r.name === rn)).filter(Boolean).map(r => {
      const ps = provsOf(r.name), hits = q ? ps.filter(id => norm(provShort(id)).includes(q)) : [];
      if (q && !norm(r.name).includes(q) && !hits.length) return '';
      const n = ps.filter(x => zoneSel.has(x)).length, cls = triCls(n, ps.length), open = zOpen.has(r.name) || hits.length > 0;
      return '<div class="zr ' + cls + (open ? ' open' : '') + '" data-r="' + esc(r.name) + '"><div class="zrh">' + REG_THUMB[r.name]
        + '<span class="zri"><b>' + esc(shortReg(r.name)) + '</b><span class="zbar"><i style="width:' + Math.round(100 * n / ps.length) + '%"></i></span></span>'
        + '<span class="zn">' + n + '/' + ps.length + '</span><button class="tri ' + cls + '" data-tri="' + esc(r.name) + '" title="Tutta la regione"></button><button class="zexp" data-exp title="Mostra le province">›</button></div>'
        + '<div class="zps">' + ps.map(id => '<button class="pp' + (zoneSel.has(id) ? ' on' : '') + (hits.includes(id) ? ' hit' : '') + '" data-p="' + id + '">' + esc(provShort(id)) + '</button>').join('') + '</div></div>';
    }).join('');
    if (!rows) return;
    const gp = regs.flatMap(provsOf), gn = gp.filter(x => zoneSel.has(x)).length;
    html += '<div class="zgrp' + (zShut.has(g) && !q ? ' shut' : '') + '" data-g="' + g + '"><div class="zgh"><span class="chev">▾</span><h4>' + g + '</h4><small>' + gn + '/' + gp.length + '</small>'
      + '<button class="tri ' + triCls(gn, gp.length) + '" data-gtri="' + g + '" title="Tutto il gruppo"></button></div><div class="zregs">' + rows + '</div></div>';
  });
  $('zTree').innerHTML = html || '<div class="zempty">Nessuna regione o provincia con "' + esc(zFind) + '"</div>';
  $('zTree').scrollTop = scroll;
  const n = zoneSel.size;
  $('zCount').innerHTML = n ? '<b>' + esc(selName([...zoneSel])) + '</b> · ' + n + (n === 1 ? ' provincia' : ' province') : 'Nessuna provincia selezionata';
  $('zDone').disabled = !n; $('zSave').disabled = !n;
}
// un solo gestore per tutto l'elenco: più veloce e niente problemi di ridisegno
$('zTree').addEventListener('click', e => {
  const t = e.target.closest('button, .zrh, .zgh'); if (!t) return;
  const set = (ids, on) => { ids.forEach(x => on ? zoneSel.add(x) : zoneSel.delete(x)); sfx.pin(); zoneRefresh(); };
  if (t.dataset.p) return set([t.dataset.p], !zoneSel.has(t.dataset.p));
  if (t.dataset.tri) { const ps = provsOf(t.dataset.tri); return set(ps, ps.some(x => !zoneSel.has(x))); }
  if (t.dataset.gtri) { const ps = GROUPS[t.dataset.gtri].flatMap(provsOf); return set(ps, ps.some(x => !zoneSel.has(x))); }
  if (t.classList.contains('zgh')) { const g = t.parentElement.dataset.g; zShut.has(g) ? zShut.delete(g) : zShut.add(g); return zoneRefresh(); }
  const r = t.closest('.zr'); if (r) { const rn = r.dataset.r; zOpen.has(rn) ? zOpen.delete(rn) : zOpen.add(rn); r.classList.toggle('open'); }
});
$('zFind').oninput = () => { zFind = $('zFind').value.trim(); show('zFindX', !!zFind); zoneRefresh(); };
$('zFindX').onclick = () => { $('zFind').value = ''; zFind = ''; show('zFindX', false); zoneRefresh(); $('zFind').focus(); };
$('zOpenAll').onclick = () => { REGS.forEach(r => zOpen.add(r.name)); zShut.clear(); zoneRefresh(); };
$('zCloseAll').onclick = () => { zOpen.clear(); zoneRefresh(); };
$('zMin').onclick = () => $('zonePanel').classList.toggle('mini');
$('zTree').addEventListener('mouseover', e => {
  const p = e.target.closest('[data-p]'), r = e.target.closest('.zr'); if (!zoneLayer) return;
  const ids = p ? [p.dataset.p] : r ? provsOf(r.dataset.r) : [];
  zoneLayer.eachLayer(l => l.setStyle(ids.includes(l.feature.properties.id) ? { weight: 2.6, color: '#ffb547' } : zoneStyle(l.feature.properties.id)));
});
$('zTree').addEventListener('mouseleave', () => { if (zoneLayer) zoneLayer.eachLayer(l => l.setStyle(zoneStyle(l.feature.properties.id))); });
document.querySelectorAll('#zClick button').forEach(b => b.onclick = () => { zoneClick = b.dataset.v; document.querySelectorAll('#zClick button').forEach(x => x.classList.toggle('on', x === b)); });
function closeZoneEdit(apply) {
  zoneEditing = false;
  if (zoneLayer) { menuMap.removeLayer(zoneLayer); zoneLayer = null; }
  show('zonePanel', false); show('menu'); show('regionTag');
  const cur0 = curProvSet(), same = cur0.size === zoneSel.size && [...zoneSel].every(x => cur0.has(x));
  if (apply && zoneSel.size && !(same && cfg.region !== 'sel' && cfg.region !== 'roma')) setZone(null, [...zoneSel]); else menuFocus();
}
$('zEdit').onclick = openZoneEdit;
$('zDone').onclick = () => closeZoneEdit(true);
$('zSave').onclick = () => {
  const name = $('zSaveName').value.trim() || selName([...zoneSel]);
  const c = { name, provs: [...zoneSel], dbId: 'combo-' + uuid().slice(0, 8) };
  COMBOS.push(c); saveCombos(); $('zSaveName').value = '';
  dbWrite('areas', 'POST', { id: c.dbId, name, kind: 'custom', provinces: c.provs, enabled: true, sort: 500 }, 'return=minimal,resolution=merge-duplicates');
  toast('⭐ Salvata: ' + name); renderZoneMenu();
};
document.addEventListener('keydown', e => { if (zoneEditing && e.key === 'Escape') closeZoneEdit(false); });
// combinazioni salvate nel database (anche quelle create da altri dispositivi)
(async () => {
  try {
    const rows = await sb('areas?kind=eq.custom&select=id,name,provinces&order=created_at');
    rows.filter(r => r.provinces && r.provinces.length).forEach(r => { if (!COMBOS.find(c => c.dbId === r.id)) COMBOS.push({ name: r.name, provs: r.provinces, dbId: r.id }); });
    saveCombos(); if (!zoneEditing) renderZoneMenu();
  } catch (e) {}
})();
ZONE_READY = true;
renderZoneMenu();
