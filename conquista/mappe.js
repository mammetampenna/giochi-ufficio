// Mappe di Conquista!: griglie di esagoni (punta in alto, righe dispari spostate a destra).
// Ogni territorio è disegnato con rettangoli di celle [col0, riga0, col1, riga1]; i bordi irregolari li fa il generatore.
// Le adiacenze si calcolano dalle celle che si toccano, più i collegamenti via mare in "links".

const MAPS = {
  mondo: {
    name: 'Mondo', cols: 48, rows: 25,
    regions: {
      nam: { name: 'Nord America', bonus: 5, color: '#ffb23f' },
      sam: { name: 'Sud America', bonus: 2, color: '#3fdc8a' },
      eur: { name: 'Europa', bonus: 5, color: '#4fb3ff' },
      afr: { name: 'Africa', bonus: 3, color: '#ff7a45' },
      asi: { name: 'Asia', bonus: 7, color: '#ff5b7f' },
      oce: { name: 'Oceania', bonus: 2, color: '#b78cff' },
    },
    terr: [
      ['alaska', 'Alaska', 'nam', [[1, 2, 5, 5]]],
      ['cannord', 'Canada Nord', 'nam', [[6, 2, 12, 4]]],
      ['canest', 'Canada Est', 'nam', [[10, 5, 15, 7]]],
      ['usaovest', 'USA Ovest', 'nam', [[4, 6, 9, 9]]],
      ['usaest', 'USA Est', 'nam', [[10, 8, 14, 10]]],
      ['messico', 'Messico', 'nam', [[6, 10, 11, 12]]],
      ['groenlandia', 'Groenlandia', 'nam', [[15, 0, 19, 3]]],
      ['caraibi', 'Caraibi', 'sam', [[11, 13, 15, 14]]],
      ['brasile', 'Brasile', 'sam', [[14, 15, 19, 18]]],
      ['ande', 'Ande', 'sam', [[11, 15, 13, 19]]],
      ['argentina', 'Argentina', 'sam', [[12, 19, 15, 23]]],
      ['islanda', 'Islanda', 'eur', [[21, 1, 22, 2]]],
      ['britannia', 'Regno Unito', 'eur', [[21, 4, 22, 6]]],
      ['scandinavia', 'Scandinavia', 'eur', [[25, 1, 28, 4]]],
      ['euovest', 'Europa Ovest', 'eur', [[22, 7, 24, 9]]],
      ['eucentro', 'Europa Centrale', 'eur', [[25, 5, 27, 7]]],
      ['euest', 'Europa Est', 'eur', [[28, 4, 31, 7]]],
      ['mediterraneo', 'Mediterraneo', 'eur', [[25, 8, 28, 9]]],
      ['maghreb', 'Maghreb', 'afr', [[21, 10, 25, 12]]],
      ['egitto', 'Egitto', 'afr', [[26, 10, 29, 12]]],
      ['sahel', 'Sahel', 'afr', [[20, 13, 25, 15]]],
      ['congo', 'Congo', 'afr', [[25, 14, 28, 17]]],
      ['corno', "Corno d'Africa", 'afr', [[29, 13, 31, 16]]],
      ['sudafrica', 'Sudafrica', 'afr', [[25, 18, 30, 21]]],
      ['siberiaovest', 'Siberia Ovest', 'asi', [[32, 2, 35, 5]]],
      ['siberiaest', 'Siberia Est', 'asi', [[36, 2, 40, 5]]],
      ['estremo', 'Estremo Oriente', 'asi', [[41, 2, 45, 6]]],
      ['kazakistan', 'Kazakistan', 'asi', [[32, 6, 35, 8]]],
      ['mongolia', 'Mongolia', 'asi', [[36, 6, 40, 8]]],
      ['cina', 'Cina', 'asi', [[36, 9, 41, 11]]],
      ['medioriente', 'Medio Oriente', 'asi', [[30, 9, 35, 11]]],
      ['india', 'India', 'asi', [[34, 12, 37, 14]]],
      ['sudest', 'Sud-Est Asiatico', 'asi', [[38, 12, 41, 14]]],
      ['giappone', 'Giappone', 'asi', [[44, 8, 45, 10]]],
      ['indonesia', 'Indonesia', 'oce', [[38, 16, 42, 17]]],
      ['guinea', 'Nuova Guinea', 'oce', [[43, 16, 46, 17]]],
      ['ausovest', 'Australia Ovest', 'oce', [[38, 19, 41, 22]]],
      ['ausest', 'Australia Est', 'oce', [[42, 19, 45, 22]]],
    ],
    links: [['alaska', 'estremo'], ['groenlandia', 'cannord'], ['groenlandia', 'canest'], ['groenlandia', 'islanda'], ['islanda', 'britannia'], ['islanda', 'scandinavia'],
      ['britannia', 'euovest'], ['britannia', 'scandinavia'], ['britannia', 'eucentro'], ['messico', 'caraibi'], ['brasile', 'sahel'], ['euovest', 'maghreb'],
      ['mediterraneo', 'egitto'], ['mediterraneo', 'maghreb'], ['egitto', 'medioriente'], ['corno', 'medioriente'], ['giappone', 'estremo'], ['giappone', 'mongolia'],
      ['sudest', 'indonesia'], ['indonesia', 'guinea'], ['indonesia', 'ausovest'], ['guinea', 'ausest'], ['scandinavia', 'euest'], ['euest', 'siberiaovest'],
      ['euest', 'kazakistan'], ['euest', 'medioriente'], ['usaovest', 'cannord'], ['alaska', 'cannord'], ['mediterraneo', 'medioriente'], ['caraibi', 'ande'], ['sudafrica', 'corno']],
  },
  europa: {
    name: 'Europa', cols: 30, rows: 23,
    regions: {
      atl: { name: 'Isole Atlantiche', bonus: 3, color: '#4fb3ff' },
      sca: { name: 'Scandinavia', bonus: 2, color: '#b78cff' },
      ove: { name: 'Europa Ovest', bonus: 4, color: '#ffb23f' },
      cen: { name: 'Europa Centrale', bonus: 3, color: '#3fdc8a' },
      med: { name: 'Mediterraneo', bonus: 4, color: '#ff7a45' },
      est: { name: 'Est', bonus: 4, color: '#ff5b7f' },
    },
    terr: [
      ['islanda', 'Islanda', 'atl', [[1, 1, 3, 2]]],
      ['irlanda', 'Irlanda', 'atl', [[1, 6, 2, 8]]],
      ['scozia', 'Scozia', 'atl', [[4, 4, 5, 6]]],
      ['inghilterra', 'Inghilterra', 'atl', [[4, 7, 6, 9]]],
      ['norvegia', 'Norvegia', 'sca', [[9, 1, 11, 6]]],
      ['svezia', 'Svezia', 'sca', [[12, 2, 14, 7]]],
      ['finlandia', 'Finlandia', 'sca', [[16, 1, 18, 5]]],
      ['portogallo', 'Portogallo', 'ove', [[1, 16, 2, 20]]],
      ['spagna', 'Spagna', 'ove', [[3, 15, 7, 20]]],
      ['franciaovest', 'Francia Ovest', 'ove', [[5, 11, 8, 14]]],
      ['franciaest', 'Francia Est', 'ove', [[9, 11, 10, 14]]],
      ['benelux', 'Benelux', 'ove', [[8, 9, 10, 10]]],
      ['germanianord', 'Germania Nord', 'cen', [[11, 8, 13, 10]]],
      ['germaniasud', 'Germania Sud', 'cen', [[11, 11, 13, 12]]],
      ['polonia', 'Polonia', 'cen', [[14, 8, 17, 11]]],
      ['alpi', 'Alpi', 'cen', [[11, 13, 15, 14]]],
      ['italianord', 'Italia Nord', 'med', [[11, 15, 13, 16]]],
      ['italiasud', 'Italia Sud', 'med', [[13, 17, 15, 20]]],
      ['sardegna', 'Sardegna', 'med', [[9, 18, 10, 20]]],
      ['balcani', 'Balcani', 'med', [[16, 14, 18, 17]]],
      ['grecia', 'Grecia', 'med', [[17, 18, 19, 20]]],
      ['turchia', 'Turchia', 'med', [[21, 17, 27, 19]]],
      ['baltici', 'Baltici', 'est', [[17, 6, 19, 7]]],
      ['bielorussia', 'Bielorussia', 'est', [[18, 8, 22, 9]]],
      ['ucraina', 'Ucraina', 'est', [[18, 10, 24, 12]]],
      ['romania', 'Romania', 'est', [[19, 13, 21, 15]]],
      ['russianord', 'Russia Nord', 'est', [[20, 1, 27, 6]]],
      ['russiasud', 'Russia Sud', 'est', [[25, 7, 28, 13]]],
    ],
    links: [['islanda', 'scozia'], ['islanda', 'norvegia'], ['irlanda', 'scozia'], ['irlanda', 'inghilterra'], ['inghilterra', 'franciaovest'], ['inghilterra', 'benelux'],
      ['scozia', 'norvegia'], ['svezia', 'finlandia'], ['svezia', 'germanianord'], ['finlandia', 'baltici'], ['sardegna', 'italianord'], ['sardegna', 'spagna'],
      ['italiasud', 'grecia'], ['turchia', 'grecia'], ['turchia', 'romania'], ['turchia', 'russiasud'], ['norvegia', 'svezia'], ['finlandia', 'russianord'], ['svezia', 'baltici'], ['italianord', 'italiasud'], ['italiasud', 'balcani']],
  },
  italia: {
    name: 'Italia', cols: 22, rows: 31,
    regions: {
      no: { name: 'Nord-Ovest', bonus: 4, color: '#4fb3ff' },
      ne: { name: 'Nord-Est', bonus: 3, color: '#3fdc8a' },
      ce: { name: 'Centro', bonus: 3, color: '#ffb23f' },
      su: { name: 'Sud', bonus: 4, color: '#ff7a45' },
      is: { name: 'Isole', bonus: 2, color: '#ff5b7f' },
    },
    terr: [
      ['aosta', "Valle d'Aosta", 'no', [[1, 3, 3, 4]]],
      ['piemontenord', 'Piemonte Nord', 'no', [[1, 5, 4, 6]]],
      ['piemontesud', 'Piemonte Sud', 'no', [[1, 7, 5, 9]]],
      ['liguria', 'Liguria', 'no', [[3, 10, 8, 10]]],
      ['lombardiaovest', 'Lombardia Ovest', 'no', [[5, 2, 7, 7]]],
      ['lombardiaest', 'Lombardia Est', 'no', [[8, 3, 9, 7]]],
      ['trentino', 'Trentino', 'ne', [[9, 0, 13, 2]]],
      ['veneto', 'Veneto', 'ne', [[10, 3, 13, 7]]],
      ['friuli', 'Friuli', 'ne', [[14, 2, 16, 6]]],
      ['emilia', 'Emilia-Romagna', 'ne', [[6, 8, 13, 9]]],
      ['toscana', 'Toscana', 'ce', [[7, 10, 10, 14]]],
      ['marche', 'Marche', 'ce', [[12, 10, 14, 13]]],
      ['umbria', 'Umbria', 'ce', [[11, 13, 12, 15]]],
      ['lazio', 'Lazio', 'ce', [[9, 15, 12, 18]]],
      ['abruzzo', 'Abruzzo', 'su', [[13, 14, 15, 16]]],
      ['molise', 'Molise', 'su', [[15, 17, 16, 18]]],
      ['campania', 'Campania', 'su', [[12, 19, 15, 21]]],
      ['puglianord', 'Puglia Nord', 'su', [[16, 17, 18, 19]]],
      ['pugliasud', 'Puglia Sud', 'su', [[18, 20, 21, 22]]],
      ['basilicata', 'Basilicata', 'su', [[16, 20, 17, 22]]],
      ['calabria', 'Calabria', 'su', [[15, 23, 17, 27]]],
      ['siciliaovest', 'Sicilia Ovest', 'is', [[9, 27, 12, 29]]],
      ['siciliaest', 'Sicilia Est', 'is', [[13, 27, 15, 29]]],
      ['sardegnanord', 'Sardegna Nord', 'is', [[2, 15, 4, 18]]],
      ['sardegnasud', 'Sardegna Sud', 'is', [[2, 19, 4, 22]]],
    ],
    links: [['sardegnanord', 'toscana'], ['sardegnanord', 'lazio'], ['sardegnanord', 'liguria'], ['sardegnasud', 'siciliaovest'], ['calabria', 'siciliaest'], ['sardegnasud', 'lazio'], ['friuli', 'trentino'], ['aosta', 'lombardiaovest']],
  },
};

/* ---------- generatore ---------- */
const hash = (c, r, s) => { let h = (c * 374761393 + r * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const SQ3 = Math.sqrt(3);
// vicini in coordinate "odd-r" (righe dispari spostate a destra), in ordine di lato
const NB = [[[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]], [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]];
export const neighbors = (c, r) => NB[r & 1].map(([dc, dr]) => [c + dc, r + dr]);

export function buildMap(id) {
  const m = MAPS[id], seed = id.length * 7;
  const grid = {}; // "c,r" -> id territorio
  m.terr.forEach(([tid, , , rects]) => rects.forEach(([c0, r0, c1, r1]) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      // solo gli angoli si smussano a caso: il territorio resta sempre tutto d'un pezzo
      const corner = (r === r0 || r === r1) && (c === c0 || c === c1);
      if (corner && c1 - c0 > 1 && r1 - r0 > 1 && hash(c, r, seed) < .6) continue;
      grid[c + ',' + r] = tid;
    }
  }));
  const T = {};
  m.terr.forEach(([tid, name, region]) => { T[tid] = { id: tid, name, region, cells: [], adj: new Set() }; });
  for (const k in grid) { const [c, r] = k.split(',').map(Number); T[grid[k]].cells.push([c, r]); }
  for (const t of Object.values(T)) for (const [c, r] of t.cells) for (const [nc, nr] of neighbors(c, r)) {
    const o = grid[nc + ',' + nr]; if (o && o !== t.id) t.adj.add(o);
  }
  m.links.forEach(([a, b]) => { T[a].adj.add(b); T[b].adj.add(a); });
  const terr = Object.values(T).filter(t => t.cells.length).map(t => ({ ...t, adj: [...t.adj] }));
  return { id, name: m.name, cols: m.cols, rows: m.rows, regions: m.regions, terr, grid, links: m.links };
}
export const MAP_LIST = Object.entries(MAPS).map(([id, m]) => ({ id, name: m.name, n: m.terr.length }));
