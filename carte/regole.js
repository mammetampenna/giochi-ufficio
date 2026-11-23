// Scarta!: regole e giocatore artificiale. Meccaniche alla UNO, nome e grafica originali.
// Carta = stringa "colore valore . copia": colore r g y b (w = jolly), valore 0-9, skip, rev, d2, wild, d4. Es. "r7.1", "wd4.2".
export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAME = { r: 'rosso', y: 'giallo', g: 'verde', b: 'blu' };
export const col = c => c[0];
export const val = c => c.slice(1, c.indexOf('.'));
export const isWild = c => c[0] === 'w';
export const isNum = c => /^\d$/.test(val(c));

export function newDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push(`${c}0.0`);
    for (let n = 1; n <= 9; n++) d.push(`${c}${n}.0`, `${c}${n}.1`);
    for (const a of ['skip', 'rev', 'd2']) d.push(`${c}${a}.0`, `${c}${a}.1`);
  }
  for (let k = 0; k < 4; k++) d.push(`wwild.${k}`, `wd4.${k}`);
  return shuffle(d);
}
export function shuffle(d) {
  for (let i = d.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// si può giocare la carta c sopra "top" con il colore attivo "color"? pending = carte da pescare accumulate
export function canPlay(c, top, color, pending, stack) {
  if (pending > 0) {
    if (!stack) return false;
    const v = val(c);
    return v === 'd4' || (v === 'd2' && val(top) === 'd2');
  }
  if (isWild(c)) return true;
  return col(c) === color || val(c) === val(top);
}
export const points = c => isWild(c) ? 50 : isNum(c) ? +val(c) : 20;

// giocatore artificiale: tiene i jolly per ultimi, colpisce chi sta per vincere, sceglie il colore che ha di più
export function botMove(hand, top, color, pending, stack, nextCount) {
  const ok = hand.filter(c => canPlay(c, top, color, pending, stack));
  if (!ok.length) return null;
  const score = c => {
    let s = 0;
    if (isWild(c)) s -= 30;
    if (val(c) === 'd4') s -= 10;
    if (['skip', 'd2', 'rev'].includes(val(c))) s += nextCount <= 2 ? 40 : 5;
    if (isNum(c)) s += +val(c); // via prima i numeri alti
    if (!isWild(c) && col(c) === color) s += 3;
    return s;
  };
  ok.sort((a, b) => score(b) - score(a));
  if (hand.length === ok.length && ok.every(isWild)) return ok[0];
  return ok[0];
}
export function bestColor(hand) {
  const n = { r: 0, y: 0, g: 0, b: 0 };
  hand.forEach(c => { if (!isWild(c)) n[col(c)]++; });
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
}
