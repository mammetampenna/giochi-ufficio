// Regole della briscola e giocatore artificiale. Carta = stringa 'D1'..'B10' (seme + valore, 8 fante, 9 cavallo, 10 re).
export const SUITS = ['D', 'C', 'S', 'B'];
const PTS = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 };
const STR = { 1: 10, 3: 9, 10: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 };
export const suit = c => c[0];
export const rank = c => +c.slice(1);
export const pts = c => PTS[rank(c)] || 0;
export const obj = c => ({ s: suit(c), r: rank(c) });

export function newDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 1; r <= 10; r++) d.push(s + r);
  for (let i = d.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// la carta b batte la carta a (che sta vincendo)?
export function beats(a, b, bris) {
  if (suit(b) === suit(a)) return STR[rank(b)] > STR[rank(a)];
  return suit(b) === bris;
}
// indice (nella presa) della carta vincente
export function winIndex(table, bris) {
  let w = 0;
  for (let i = 1; i < table.length; i++) if (beats(table[w].c, table[i].c, bris)) w = i;
  return w;
}
export const sumPts = cards => cards.reduce((a, c) => a + pts(c), 0);

/*
  Giocatore artificiale, semplice ma non stupido:
  - di mano gioca il liscio più basso e tiene briscole e carichi;
  - se il compagno sta prendendo e gioca per ultimo, ci mette punti;
  - prende con la carta meno cara se sul tavolo ci sono punti, usando briscole solo se ne vale la pena.
*/
export function botChoose(hand, table, bris, seat, N) {
  const isB = c => suit(c) === bris;
  const cheap = c => pts(c) * 3 + (isB(c) ? 40 : 0) + STR[rank(c)];
  const byCheap = [...hand].sort((a, b) => cheap(a) - cheap(b));
  if (!table.length) return byCheap[0];
  const wi = winIndex(table, bris), wc = table[wi].c, wSeat = table[wi].p;
  const last = table.length === N - 1, tp = sumPts(table.map(t => t.c));
  const mate = N === 4 && wSeat % 2 === seat % 2;
  if (mate) {
    // il compagno sta prendendo: se nessuno può più superarlo, carico
    if (last) { const car = hand.filter(c => !isB(c)).sort((a, b) => pts(b) - pts(a))[0]; if (car) return car; }
    return byCheap[0];
  }
  const winners = hand.filter(c => beats(wc, c, bris)).sort((a, b) => cheap(a) - cheap(b));
  const same = winners.filter(c => !isB(c));
  if (same.length && (tp > 0 || pts(same[0]) > 0 || last)) return same[0];
  if (winners.length && (tp >= 10 || (tp >= 3 && last && pts(winners[0]) === 0))) return winners[0];
  if (same.length && last) return same[0];
  return byCheap[0];
}
