// Genera conquista/geo.js: mappe con i confini veri.
// - Mondo ed Europa dai confini degli stati di Natural Earth (world-atlas 2.0.2, pubblico dominio), raggruppati in territori;
//   i paesi grandi si tagliano lungo meridiani o paralleli.
// - Italia dalle province di ItaliaGuessr (italia-guessr/src/catalog.js).
// Dati: tools/dati/countries-50m.json da https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json (escluso da git).
// Uso: node conquista/tools/build_geo.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const topo = JSON.parse(fs.readFileSync(here + 'dati/countries-50m.json', 'utf8'));

/* ---------- TopoJSON → poligoni [ [ [lon,lat], ... ] (anello esterno), ... ] per stato ---------- */
const { scale: [kx, ky], translate: [tx, ty] } = topo.transform;
const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * kx + tx, y * ky + ty]; }); });
const arc = i => i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
const ring = idx => idx.flatMap((i, k) => { const a = arc(i); return k ? a.slice(1) : a; });
const COUNTRY = {};
for (const g of topo.objects.countries.geometries) {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  COUNTRY[g.properties.name] = polys.map(p => ring(p[0])); // solo l'anello esterno (i laghi non servono)
}
// la Russia attraversa il meridiano 180: la Čukotka passa da -180 a +180 per avere un contorno continuo
COUNTRY.Russia = COUNTRY.Russia.map(r => r.map(([x, y]) => [x < 0 ? x + 360 : x, y]));
{
}
const ITALY = (() => { const s = fs.readFileSync(here + '../../italia-guessr/src/catalog.js', 'utf8'); return JSON.parse(s.slice(s.indexOf('['), s.lastIndexOf(']') + 1)); })();
const PROV = {}; ITALY.filter(c => c.kind === 'provincia').forEach(c => {
  const o = c.outline; PROV[c.name.replace(/^(Provincia di |Città metropolitana di )/, '')] = (o.type === 'Polygon' ? [o.coordinates] : o.coordinates).map(p => p[0]);
});

/* ---------- geometria ---------- */
// taglio di un poligono con un semipiano q[k] >= v (sg = 1) o q[k] <= v (sg = -1).
// Un poligono concavo può dividersi in più pezzi: i tratti interni si ricuciono lungo la linea di taglio,
// così non restano "ponti" spuri lungo il taglio.
function clipHalf(poly, k, v, sg) {
  const f = q => sg * (q[k] - v), n = poly.length;
  const start = poly.findIndex(q => f(q) < 0);
  if (start < 0) return [poly];
  if (poly.every(q => f(q) < 0)) return [];
  const cut = (a, b) => { const fa = f(a), fb = f(b), t = fa / (fa - fb), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; p[k] = v; return p; };
  const chains = []; let cur = null;
  for (let j = 0; j < n; j++) {
    const a = poly[(start + j) % n], b = poly[(start + j + 1) % n], fa = f(a), fb = f(b);
    if (fa < 0 && fb >= 0) cur = [cut(a, b)];
    if (fb >= 0 && cur) cur.push(b);
    if (fa >= 0 && fb < 0 && cur) { cur.push(cut(a, b)); chains.push(cur); cur = null; }
  }
  // punti d'ingresso e d'uscita ordinati lungo la linea di taglio: si accoppiano a due a due
  const nodes = chains.flatMap((c, i) => [{ t: c[0][1 - k], i, e: 1 }, { t: c.at(-1)[1 - k], i, e: 0 }]).sort((x, y) => x.t - y.t);
  const partner = new Map(); for (let i = 0; i + 1 < nodes.length; i += 2) { partner.set(nodes[i], nodes[i + 1]); partner.set(nodes[i + 1], nodes[i]); }
  const exitOf = i => nodes.find(x => x.i === i && !x.e), used = new Set(), out = [];
  for (let i = 0; i < chains.length; i++) {
    if (used.has(i)) continue;
    const poly2 = []; let j = i;
    while (!used.has(j)) { used.add(j); poly2.push(...chains[j]); const p = partner.get(exitOf(j)); if (!p || !p.e) break; j = p.i; }
    if (poly2.length >= 3) out.push(poly2);
  }
  return out;
}
function box(poly, [lo0, lo1, la0, la1]) {
  let ps = [poly];
  if (lo0 != null) ps = ps.flatMap(p => clipHalf(p, 0, lo0, 1));
  if (lo1 != null) ps = ps.flatMap(p => clipHalf(p, 0, lo1, -1));
  if (la0 != null) ps = ps.flatMap(p => clipHalf(p, 1, la0, 1));
  if (la1 != null) ps = ps.flatMap(p => clipHalf(p, 1, la1, -1));
  return ps.filter(p => p.length >= 3);
}
// bordo esterno di un territorio: si tolgono i tratti che due suoi pezzi (stati o province) hanno in comune
function outline(polys, tol) {
  const cell = 8, grid = new Map(), segs = [];
  polys.forEach((p, pi) => p.forEach((a, i) => {
    const b = p[(i + 1) % p.length], s = { a, b, pi }; segs.push(s);
    for (let x = Math.floor((Math.min(a[0], b[0]) - tol) / cell); x <= Math.floor((Math.max(a[0], b[0]) + tol) / cell); x++)
      for (let y = Math.floor((Math.min(a[1], b[1]) - tol) / cell); y <= Math.floor((Math.max(a[1], b[1]) + tol) / cell); y++)
        (grid.get(x + ',' + y) || grid.set(x + ',' + y, []).get(x + ',' + y)).push(s);
  }));
  const near = (q, pi) => (grid.get(Math.floor(q[0] / cell) + ',' + Math.floor(q[1] / cell)) || []).some(s => s.pi !== pi && segDist(q, s.a, s.b) < tol);
  const f = v => Math.round(v * 10) / 10, P = q => f(q[0]) + ' ' + f(q[1]);
  let d = '';
  polys.forEach((p, pi) => {
    const ext = p.map((a, i) => { const b = p[(i + 1) % p.length]; return ![.2, .5, .8].every(t => near([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], pi)); });
    if (ext.every(Boolean)) { d += 'M' + p.map(P).join('L') + 'Z'; return; }
    if (!ext.some(Boolean)) return;
    const s0 = ext.findIndex((e, i) => e && !ext[(i - 1 + p.length) % p.length]);
    let open = false;
    for (let j = 0; j < p.length; j++) {
      const i = (s0 + j) % p.length;
      if (ext[i]) { d += (open ? '' : 'M' + P(p[i])) + 'L' + P(p[(i + 1) % p.length]); open = true; } else open = false;
    }
  });
  return d;
}
const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
function dp(ring, eps) { // Douglas–Peucker su anello chiuso: si taglia l'anello nel punto più lontano dal primo
  let pts = ring; const [f0, f1] = pts[0], l = pts.at(-1); if (l[0] === f0 && l[1] === f1) pts = pts.slice(0, -1);
  if (pts.length < 6) return pts;
  let far = 0, fd = 0; pts.forEach((q, k) => { const d = Math.hypot(q[0] - f0, q[1] - f1); if (d > fd) { fd = d; far = k; } });
  if (far > 0 && !dp.inner) { dp.inner = 1; const a = dp(pts.slice(0, far + 1), eps), b = dp([...pts.slice(far), pts[0]], eps); dp.inner = 0; return [...a, ...b.slice(1, -1)]; }
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); let md = 0, mi = -1; const [ax, ay] = pts[i], [bx, by] = pts[j], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L; if (d > md) { md = d; mi = k; } }
    if (md > eps) { keep[mi] = 1; st.push([i, mi], [mi, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
// punto interno lontano dai bordi, per il distintivo delle armate
function inside(p, [x, y]) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function segDist([x, y], [ax, ay], [bx, by]) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - ax - t * dx, y - ay - t * dy); }
function label(p) {
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = null;
  for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
    const q = [x0 + (x1 - x0) * i / 24, y0 + (y1 - y0) * j / 24]; if (!inside(p, q)) continue;
    let d = Infinity; for (let k = 0; k < p.length; k++) d = Math.min(d, segDist(q, p[k], p[(k + 1) % p.length]));
    if (!best || d > best.d) best = { q, d };
  }
  return best ? best.q : [(x0 + x1) / 2, (y0 + y1) / 2];
}

/* ---------- costruzione di una mappa ---------- */
function build(def) {
  const { proj, W, eps, minArea } = def;
  // proiezione e scala in pixel
  const raw = def.terr.map(([id, name, region, parts]) => {
    const polys = [];
    for (const part of parts) {
      const [src, clipBox] = Array.isArray(part) ? part : [part, null];
      const geo = def.source(src); if (!geo) { console.warn('manca', src); continue; }
      for (const poly of geo) (clipBox ? box(poly, clipBox) : [poly]).forEach(c => polys.push(c.map(proj)));
    }
    return { id, name, region, polys };
  });
  const all = raw.flatMap(t => t.polys.flat()), X0 = Math.min(...all.map(p => p[0])), X1 = Math.max(...all.map(p => p[0])), Y0 = Math.min(...all.map(p => p[1])), Y1 = Math.max(...all.map(p => p[1]));
  const s = W / (X1 - X0), H = Math.round((Y1 - Y0) * s);
  const terr = raw.map(t => {
    let polys = t.polys.map(p => dp(p.map(([x, y]) => [(x - X0) * s, (y - Y0) * s]), eps)).filter(p => p.length >= 3);
    const big = Math.max(...polys.map(area)); polys = polys.filter(p => area(p) >= Math.min(minArea, big * .5));
    if (!polys.length) throw new Error("vuoto: " + t.id);
    const main = polys.reduce((a, b) => area(b) > area(a) ? b : a);
    const fix = def.labels?.[t.id], c = fix ? (([x, y]) => [(x - X0) * s, (y - Y0) * s])(proj(fix)) : label(main);
    return { ...t, polys, c };
  });
  // adiacenze: due territori sono vicini se hanno punti di confine quasi coincidenti
  const tol = def.tol, cell = tol * 2, grid = new Map();
  terr.forEach((t, ti) => t.polys.forEach(p => p.forEach(([x, y]) => { const k = Math.floor(x / cell) + ',' + Math.floor(y / cell); (grid.get(k) || grid.set(k, []).get(k)).push([x, y, ti]); })));
  const adj = terr.map(() => new Set());
  for (const [k, list] of grid) {
    const [gx, gy] = k.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const o = grid.get((gx + dx) + ',' + (gy + dy)); if (!o) continue;
      for (const a of list) for (const b of o) if (a[2] !== b[2] && Math.hypot(a[0] - b[0], a[1] - b[1]) < tol) { adj[a[2]].add(b[2]); adj[b[2]].add(a[2]); }
    }
  }
  def.links.forEach(([a, b]) => { const i = terr.findIndex(t => t.id === a), j = terr.findIndex(t => t.id === b); if (i < 0 || j < 0) throw new Error('link ' + a + ' ' + b); adj[i].add(j); adj[j].add(i); });
  (def.cut || []).forEach(([a, b]) => { const i = terr.findIndex(t => t.id === a), j = terr.findIndex(t => t.id === b); adj[i].delete(j); adj[j].delete(i); });
  const f = v => Math.round(v * 10) / 10;
  return {
    name: def.name, w: Math.round(W), h: H, regions: def.regions, links: def.links,
    terr: terr.map((t, i) => ({ id: t.id, name: t.name, region: t.region, adj: [...adj[i]].map(j => terr[j].id),
      c: t.c.map(f), d: t.polys.map(p => 'M' + p.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z').join(''), b: outline(t.polys, def.seam) })),
  };
}
const R = Math.PI / 180;
const miller = ([lon, lat]) => [lon, -1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * lat * R)) / R];
const flatEU = ([lon, lat]) => [lon * Math.cos(52 * R), -lat];
const flatIT = ([lon, lat]) => [lon * Math.cos(42 * R), -lat];
const C = n => COUNTRY[n];

const MONDO = {
  name: 'Mondo', proj: miller, W: 1000, eps: .7, minArea: 12, seam: 1.6, tol: .6, source: C,
  regions: { nam: { name: 'Nord America', bonus: 5 }, sam: { name: 'Sud America', bonus: 2 }, eur: { name: 'Europa', bonus: 5 }, afr: { name: 'Africa', bonus: 3 }, asi: { name: 'Asia', bonus: 7 }, oce: { name: 'Oceania', bonus: 2 } },
  terr: [
    ['alaska', 'Alaska', 'nam', [['United States of America', [-170, -129, 50, null]]]],
    ['canovest', 'Canada Ovest', 'nam', [['Canada', [null, -100, null, null]]]],
    ['canest', 'Canada Est', 'nam', [['Canada', [-100, null, null, null]]]],
    ['groenlandia', 'Groenlandia', 'nam', ['Greenland']],
    ['usaovest', 'USA Ovest', 'nam', [['United States of America', [-130, -100, 24, 50]]]],
    ['usaest', 'USA Est', 'nam', [['United States of America', [-100, -60, 24, 50]]]],
    ['messico', 'Messico e Centro America', 'nam', ['Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama']],
    ['caraibi', 'Caraibi', 'nam', ['Cuba', 'Haiti', 'Dominican Rep.', 'Jamaica', 'Puerto Rico', 'Bahamas']],
    ['venezuela', 'Venezuela e Colombia', 'sam', ['Venezuela', 'Colombia', 'Guyana', 'Suriname', ['France', [-55, -50, 0, 7]]]],
    ['ande', 'Ande', 'sam', ['Peru', 'Ecuador', 'Bolivia']],
    ['brasilenord', 'Brasile Nord', 'sam', [['Brazil', [null, null, -10, null]]]],
    ['brasilesud', 'Brasile Sud', 'sam', [['Brazil', [null, null, null, -10]], 'Paraguay', 'Uruguay']],
    ['argentina', 'Argentina e Cile', 'sam', ['Argentina', 'Chile']],
    ['isole', 'Isole Britanniche', 'eur', ['United Kingdom', 'Ireland', 'Iceland']],
    ['scandinavia', 'Scandinavia', 'eur', ['Norway', 'Sweden', 'Finland', 'Denmark']],
    ['iberia', 'Penisola Iberica', 'eur', ['Spain', 'Portugal']],
    ['francia', 'Francia e Benelux', 'eur', [['France', [-6, 10, 40, 52]], 'Belgium', 'Netherlands', 'Luxembourg', 'Switzerland']],
    ['germania', 'Germania e Polonia', 'eur', ['Germany', 'Poland', 'Austria', 'Czechia']],
    ['italia', 'Italia e Balcani', 'eur', ['Italy', 'Slovenia', 'Croatia', 'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Kosovo', 'Albania', 'Macedonia', 'Greece']],
    ['europaest', 'Europa Est', 'eur', ['Belarus', 'Ukraine', 'Moldova', 'Romania', 'Bulgaria', 'Hungary', 'Slovakia', 'Lithuania', 'Latvia', 'Estonia']],
    ['russia', 'Russia Europea', 'eur', [['Russia', [27, 60, null, null]]]],
    ['maghreb', 'Maghreb', 'afr', ['Morocco', 'W. Sahara', 'Algeria', 'Tunisia']],
    ['egitto', 'Egitto e Libia', 'afr', ['Egypt', 'Libya', 'Sudan']],
    ['africaovest', 'Africa Ovest', 'afr', ['Mauritania', 'Mali', 'Senegal', 'Gambia', 'Guinea', 'Guinea-Bissau', 'Sierra Leone', 'Liberia', "Côte d'Ivoire", 'Burkina Faso', 'Ghana', 'Togo', 'Benin', 'Niger', 'Nigeria']],
    ['congo', 'Africa Centrale', 'afr', ['Chad', 'Cameroon', 'Central African Rep.', 'Congo', 'Dem. Rep. Congo', 'Gabon', 'Eq. Guinea']],
    ['africaest', 'Africa Est', 'afr', ['Ethiopia', 'Eritrea', 'Djibouti', 'Somalia', 'Somaliland', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'Tanzania', 'S. Sudan']],
    ['africasud', 'Africa del Sud', 'afr', ['Angola', 'Zambia', 'Malawi', 'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia', 'South Africa', 'Lesotho', 'eSwatini', 'Madagascar']],
    ['medioriente', 'Medio Oriente', 'asi', ['Turkey', 'Syria', 'Iraq', 'Iran', 'Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Jordan', 'Israel', 'Palestine', 'Lebanon', 'Georgia', 'Armenia', 'Azerbaijan']],
    ['asiacentrale', 'Asia Centrale', 'asi', ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan']],
    ['india', 'India', 'asi', ['India', 'Pakistan', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka']],
    ['siberia', 'Siberia', 'asi', [['Russia', [60, 100, null, null]]]],
    ['siberiaest', 'Siberia Est', 'asi', [['Russia', [100, 140, null, null]]]],
    ['estremo', 'Estremo Oriente', 'asi', [['Russia', [140, null, null, null]]]],
    ['mongolia', 'Mongolia', 'asi', ['Mongolia']],
    ['cinaovest', 'Cina Ovest', 'asi', [['China', [null, 102, null, null]]]],
    ['cinaest', 'Cina Est', 'asi', [['China', [102, null, null, null]], 'Taiwan']],
    ['giappone', 'Giappone e Corea', 'asi', ['Japan', 'North Korea', 'South Korea']],
    ['sudest', 'Sud-Est Asiatico', 'asi', ['Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Philippines']],
    ['indonesia', 'Indonesia', 'oce', ['Indonesia', 'Timor-Leste']],
    ['guinea', 'Nuova Guinea', 'oce', ['Papua New Guinea', 'Solomon Is.']],
    ['ausovest', 'Australia Ovest', 'oce', [['Australia', [null, 135, null, null]]]],
    ['ausest', 'Australia Est', 'oce', [['Australia', [135, null, null, null]], 'New Zealand']],
  ],
  // distintivi spostati a mano dove l'Europa è affollata
  labels: { isole: [-2, 53], scandinavia: [15, 63], francia: [2, 46.5], germania: [14, 51.5], italia: [21, 43], europaest: [29, 50], iberia: [-4, 40], russia: [43, 57] },
  links: [['alaska', 'estremo'], ['groenlandia', 'canest'], ['groenlandia', 'canovest'], ['groenlandia', 'isole'], ['isole', 'scandinavia'], ['isole', 'francia'], ['isole', 'iberia'],
    ['messico', 'caraibi'], ['caraibi', 'venezuela'], ['caraibi', 'usaest'], ['brasilenord', 'africaovest'], ['iberia', 'maghreb'], ['italia', 'maghreb'], ['italia', 'egitto'],
    ['egitto', 'medioriente'], ['africaest', 'medioriente'], ['giappone', 'estremo'], ['sudest', 'indonesia'], ['indonesia', 'guinea'], ['indonesia', 'ausovest'],
    ['guinea', 'ausest'], ['scandinavia', 'germania'], ['africasud', 'africaest'], ['italia', 'medioriente'], ['india', 'indonesia']],
};

const EUROPA = {
  name: 'Europa', proj: flatEU, W: 1000, eps: .6, minArea: 10, seam: 1.6, tol: .6, source: C,
  regions: { atl: { name: 'Isole Atlantiche', bonus: 3 }, sca: { name: 'Scandinavia', bonus: 3 }, ove: { name: 'Europa Ovest', bonus: 4 }, cen: { name: 'Europa Centrale', bonus: 4 }, med: { name: 'Mediterraneo', bonus: 4 }, est: { name: 'Est', bonus: 5 } },
  terr: [
    ['islanda', 'Islanda', 'atl', ['Iceland']],
    ['irlanda', 'Irlanda', 'atl', ['Ireland', ['United Kingdom', [-9, -5.3, 54, 55.4]]]],
    ['scozia', 'Scozia', 'atl', [['United Kingdom', [-9, 2, 55, 61]]]],
    ['inghilterra', 'Inghilterra', 'atl', [['United Kingdom', [-5.3, 2, 49, 55]]]],
    ['norvegia', 'Norvegia', 'sca', [['Norway', [null, null, null, 72]]]],
    ['svezia', 'Svezia', 'sca', ['Sweden']],
    ['finlandia', 'Finlandia', 'sca', ['Finland']],
    ['danimarca', 'Danimarca', 'sca', ['Denmark']],
    ['portogallo', 'Portogallo', 'ove', [['Portugal', [-10, null, 36, null]]]],
    ['spagnanord', 'Spagna Nord', 'ove', [['Spain', [-10, 5, 40.5, null]]]],
    ['spagnasud', 'Spagna Sud', 'ove', [['Spain', [-10, 5, 35.5, 40.5]]]],
    ['francianord', 'Francia Nord', 'ove', [['France', [-6, 10, 46.5, 52]]]],
    ['franciasud', 'Francia Sud', 'ove', [['France', [-6, 10, 41, 46.5]]]],
    ['benelux', 'Benelux', 'ove', ['Belgium', 'Netherlands', 'Luxembourg']],
    ['germanianord', 'Germania Nord', 'cen', [['Germany', [null, null, 51, null]]]],
    ['germaniasud', 'Germania Sud', 'cen', [['Germany', [null, null, null, 51]]]],
    ['alpi', 'Svizzera e Austria', 'cen', ['Switzerland', 'Austria', 'Liechtenstein']],
    ['polonia', 'Polonia', 'cen', ['Poland']],
    ['centroest', 'Cechia, Slovacchia e Ungheria', 'cen', ['Czechia', 'Slovakia', 'Hungary']],
    ['italianord', 'Italia Nord', 'med', [['Italy', [null, null, 43.6, null]]]],
    ['italiasud', 'Italia Sud', 'med', [['Italy', [null, null, null, 43.6]]]],
    ['balcani', 'Balcani', 'med', ['Slovenia', 'Croatia', 'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Kosovo', 'Albania', 'Macedonia']],
    ['grecia', 'Grecia', 'med', ['Greece', 'Cyprus', 'N. Cyprus']],
    ['turchia', 'Turchia', 'med', [['Turkey', [null, 40, null, null]]]],
    ['nordafrica', 'Nord Africa', 'med', [['Morocco', [null, null, 32, null]], ['Algeria', [null, null, 33, null]], 'Tunisia']],
    ['baltici', 'Baltici', 'est', ['Lithuania', 'Latvia', 'Estonia', ['Russia', [19, 23, 54, 56]]]],
    ['bielorussia', 'Bielorussia', 'est', ['Belarus']],
    ['ucraina', 'Ucraina', 'est', ['Ukraine', 'Moldova']],
    ['romania', 'Romania', 'est', ['Romania']],
    ['bulgaria', 'Bulgaria', 'est', ['Bulgaria']],
    ['russianord', 'Russia Nord', 'est', [['Russia', [27, 45, 57, 69]]]],
    ['russiasud', 'Russia Sud', 'est', [['Russia', [27, 45, 43, 57]]]],
  ],
  links: [['islanda', 'scozia'], ['islanda', 'norvegia'], ['scozia', 'norvegia'], ['inghilterra', 'francianord'], ['inghilterra', 'benelux'], ['danimarca', 'svezia'], ['danimarca', 'norvegia'],
    ['svezia', 'finlandia'], ['finlandia', 'baltici'], ['svezia', 'baltici'], ['svezia', 'polonia'], ['spagnasud', 'nordafrica'], ['italiasud', 'nordafrica'], ['italiasud', 'grecia'],
    ['italiasud', 'balcani'], ['franciasud', 'italiasud'], ['grecia', 'turchia'], ['turchia', 'bulgaria'], ['turchia', 'russiasud'], ['ucraina', 'turchia'], ['danimarca', 'germanianord']],
};

// Italia: gruppi di province
const P = (...names) => names;
const ITALIA = {
  name: 'Italia', proj: flatIT, W: 700, eps: .5, minArea: 6, seam: 2.2, tol: 3, source: n => PROV[n],
  regions: { no: { name: 'Nord-Ovest', bonus: 5 }, ne: { name: 'Nord-Est', bonus: 5 }, ce: { name: 'Centro', bonus: 5 }, su: { name: 'Sud', bonus: 6 }, is: { name: 'Isole', bonus: 3 } },
  terr: [
    ['aosta', "Valle d'Aosta", 'no', P("Valle d'Aosta/Vallée d'Aoste")],
    ['piemontenord', 'Piemonte Nord', 'no', P('Torino', 'Vercelli', 'Novara', 'Biella', 'Verbano-Cusio-Ossola')],
    ['piemontesud', 'Piemonte Sud', 'no', P('Cuneo', 'Asti', 'Alessandria')],
    ['liguria', 'Liguria', 'no', P('Imperia', 'Savona', 'Genova', 'La Spezia')],
    ['lombardiaovest', 'Lombardia Ovest', 'no', P('Varese', 'Como', 'Milano', 'Pavia', 'Lodi', 'Monza e della Brianza', 'Lecco')],
    ['lombardiaest', 'Lombardia Est', 'no', P('Sondrio', 'Bergamo', 'Brescia', 'Cremona', 'Mantova')],
    ['trentino', 'Trentino-Alto Adige', 'ne', P('Bolzano/Bozen', 'Trento')],
    ['venetoovest', 'Veneto Ovest', 'ne', P('Verona', 'Vicenza', 'Padova', 'Rovigo')],
    ['venetoest', 'Veneto Est', 'ne', P('Belluno', 'Treviso', 'Venezia')],
    ['friuli', 'Friuli-Venezia Giulia', 'ne', P('Udine', 'Gorizia', 'Trieste', 'Pordenone')],
    ['emilia', 'Emilia', 'ne', P('Piacenza', 'Parma', "Reggio nell'Emilia", 'Modena')],
    ['romagna', 'Romagna e Bologna', 'ne', P('Bologna', 'Ferrara', 'Ravenna', 'Forlì-Cesena', 'Rimini')],
    ['toscananord', 'Toscana Nord', 'ce', P('Massa-Carrara', 'Lucca', 'Pistoia', 'Firenze', 'Prato', 'Pisa', 'Livorno')],
    ['toscanasud', 'Toscana Sud', 'ce', P('Arezzo', 'Siena', 'Grosseto')],
    ['marche', 'Marche', 'ce', P('Pesaro e Urbino', 'Ancona', 'Macerata', 'Ascoli Piceno', 'Fermo')],
    ['umbria', 'Umbria', 'ce', P('Perugia', 'Terni')],
    ['lazionord', 'Lazio Nord e Roma', 'ce', P('Viterbo', 'Rieti', 'Roma')],
    ['laziosud', 'Lazio Sud', 'ce', P('Latina', 'Frosinone')],
    ['abruzzo', 'Abruzzo', 'su', P("L'Aquila", 'Teramo', 'Pescara', 'Chieti')],
    ['molise', 'Molise', 'su', P('Campobasso', 'Isernia')],
    ['campanianord', 'Campania Nord', 'su', P('Caserta', 'Benevento', 'Napoli')],
    ['campaniasud', 'Campania Sud', 'su', P('Avellino', 'Salerno')],
    ['puglianord', 'Puglia Nord', 'su', P('Foggia', 'Barletta-Andria-Trani', 'Bari')],
    ['salento', 'Salento', 'su', P('Taranto', 'Brindisi', 'Lecce')],
    ['basilicata', 'Basilicata', 'su', P('Potenza', 'Matera')],
    ['calabria', 'Calabria', 'su', P('Cosenza', 'Catanzaro', 'Reggio Calabria', 'Crotone', 'Vibo Valentia')],
    ['siciliaovest', 'Sicilia Ovest', 'is', P('Trapani', 'Palermo', 'Agrigento', 'Caltanissetta')],
    ['siciliaest', 'Sicilia Est', 'is', P('Messina', 'Enna', 'Catania', 'Ragusa', 'Siracusa')],
    ['sardegnanord', 'Sardegna Nord', 'is', P('Sassari', 'Gallura Nord-Est Sardegna', 'Nuoro')],
    ['sardegnasud', 'Sardegna Sud', 'is', P('Oristano', 'Ogliastra', 'Medio Campidano', 'Cagliari', 'Sulcis Iglesiente')],
  ],
  links: [['sardegnanord', 'toscananord'], ['sardegnanord', 'lazionord'], ['sardegnanord', 'liguria'], ['sardegnasud', 'siciliaovest'], ['calabria', 'siciliaest'], ['sardegnasud', 'laziosud']],
};

const out = { mondo: build(MONDO), europa: build(EUROPA), italia: build(ITALIA) };
for (const [k, m] of Object.entries(out)) {
  const lonely = m.terr.filter(t => !t.adj.length).map(t => t.id);
  console.log(k, m.terr.length, 'territori', m.w + 'x' + m.h, 'adiacenze medie', (m.terr.reduce((s, t) => s + t.adj.length, 0) / m.terr.length).toFixed(1), lonely.length ? 'ISOLATI: ' + lonely : '');
}
const js = '// Generato da tools/build_geo.mjs: non modificare a mano.\n// Confini: Natural Earth (pubblico dominio) via world-atlas; province italiane da ItaliaGuessr.\nexport const GEO = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(here + '../geo.js', js);
console.log('geo.js', Math.round(js.length / 1024), 'KB');
