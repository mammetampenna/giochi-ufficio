// Mappe di Conquista!: confini veri, generati da tools/build_geo.mjs in geo.js.
// Ogni mappa: { id, name, w, h, regions: {id: {name, bonus}}, terr: [{id, name, region, adj, c: [x, y], d, b}], links }
//   d = contorno da riempire, b = solo i bordi esterni (senza i confini interni tra stati o province dello stesso territorio)
import { GEO } from './geo.js';

export function buildMap(id) {
  const m = GEO[id];
  if (!m) throw new Error('Mappa sconosciuta: ' + id);
  return { id, ...m };
}
export const MAP_LIST = Object.entries(GEO).map(([id, m]) => ({ id, name: m.name, n: m.terr.length }));
