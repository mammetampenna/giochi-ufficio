// Regole di Conquista! (meccaniche alla Risiko): rinforzi, attacchi con i dadi (fino a 3 contro 3), spostamento, carte e obiettivi.
// Lo stato è un oggetto JSON semplice, così si può salvare su Supabase e riprendere.
import { buildMap } from './mappe.js';

const mapCache = {};
export const getMap = id => mapCache[id] ||= buildMap(id);
export const COLORS = ['#ff5b7f', '#3fd6c6', '#ffb23f', '#7b6cff', '#3fdc8a', '#ff7a45'];
const START = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };
export const CARD = { carro: 'Carro', aereo: 'Aereo', nave: 'Nave', jolly: 'Jolly' };

export function rngFrom(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- nuova partita ---------- */
export function newGame(mapId, players, { missions = true, seed = Date.now() } = {}) {
  const map = getMap(mapId), rnd = rngFrom(seed), n = players.length;
  const order = shuffle(players.map((p, i) => ({ ...p, color: p.color || COLORS[i], alive: true })), rnd);
  const ids = shuffle(map.terr.map(t => t.id), rnd);
  const owner = {}, armies = {};
  ids.forEach((t, i) => { owner[t] = i % n; armies[t] = 1; });
  // armate iniziali in proporzione alla grandezza della mappa, sparse a caso sui propri territori
  const total = Math.round(START[Math.min(6, Math.max(2, n))] * map.terr.length / 42);
  for (let p = 0; p < n; p++) {
    const mine = ids.filter(t => owner[t] === p);
    for (let k = total - mine.length; k > 0; k--) armies[mine[rnd() * mine.length | 0]]++;
  }
  const types = ['carro', 'aereo', 'nave'];
  const deck = shuffle(map.terr.map((t, i) => ({ t: t.id, k: types[i % 3] })).concat([{ t: null, k: 'jolly' }, { t: null, k: 'jolly' }]), rnd);
  const st = { v: 1, map: mapId, players: order, owner, armies, turn: 0, phase: 'reinforce', reinf: 0, cards: order.map(() => []), deck, used: [],
    conquered: false, pending: null, missions: missions ? dealMissions(map, order, rnd) : null, winner: null, round: 1, seed: (rnd() * 2 ** 31) | 0, log: [] };
  st.reinf = reinforcements(st, 0);
  return st;
}

/* ---------- obiettivi segreti ---------- */
function dealMissions(map, players, rnd) {
  const T = map.terr.length, R = Object.entries(map.regions).map(([id, r]) => ({ id, ...r, size: map.terr.filter(t => t.region === id).length }));
  const pool = [{ k: 'terr', n: Math.round(T * .6) }, { k: 'terr2', n: Math.round(T * .45) }];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const s = R[i].size + R[j].size;
    if (s >= T * .3 && s <= T * .5) pool.push({ k: 'regions', ids: [R[i].id, R[j].id] });
  }
  players.forEach((p, i) => { const o = players[(i + 1 + (rnd() * (players.length - 1) | 0)) % players.length]; if (o !== p) pool.push({ k: 'destroy', target: o.id, n: Math.round(T * .6) }); });
  const mis = shuffle(pool, rnd);
  return players.map((p, i) => { let m = mis.find(x => !x.taken && !(x.k === 'destroy' && x.target === p.id)) || { k: 'terr', n: Math.round(T * .6) }; m.taken = true; return { ...m, taken: undefined }; });
}
export function missionText(st, m) {
  const map = getMap(st.map);
  if (!m) return 'Conquista tutto il tabellone';
  if (m.k === 'terr') return `Conquista ${m.n} territori`;
  if (m.k === 'terr2') return `Conquista ${m.n} territori con almeno 2 armate ciascuno`;
  if (m.k === 'regions') return `Conquista ${m.ids.map(r => map.regions[r].name).join(' e ')}`;
  if (m.k === 'destroy') { const p = st.players.find(x => x.id === m.target); return `Elimina ${p?.name || 'un avversario'} (se lo elimina un altro: conquista ${m.n} territori)`; }
  return '';
}
function missionDone(st, p) {
  const map = getMap(st.map), mine = map.terr.filter(t => st.owner[t.id] === p);
  if (!st.missions) return mine.length === map.terr.length;
  const m = st.missions[p];
  if (m.k === 'terr') return mine.length >= m.n;
  if (m.k === 'terr2') return mine.filter(t => st.armies[t.id] >= 2).length >= m.n;
  if (m.k === 'regions') return m.ids.every(r => map.terr.filter(t => t.region === r).every(t => st.owner[t.id] === p));
  if (m.k === 'destroy') {
    const ti = st.players.findIndex(x => x.id === m.target);
    if (st.players[ti].alive) return false;
    return st.players[ti].killedBy === p || mine.length >= m.n;
  }
  return false;
}

/* ---------- calcoli ---------- */
export function reinforcements(st, p) {
  const map = getMap(st.map), mine = map.terr.filter(t => st.owner[t.id] === p);
  let n = Math.max(3, Math.floor(mine.length / 3));
  for (const [rid, r] of Object.entries(map.regions)) if (map.terr.filter(t => t.region === rid).every(t => st.owner[t.id] === p)) n += r.bonus;
  return n;
}
export function tradeValue(cards) {
  if (cards.length !== 3) return 0;
  const k = cards.map(c => c.k).sort(), j = k.filter(x => x === 'jolly').length;
  if (j === 1 && k[1] === k[2] && k[1] !== 'jolly') return 12;
  if (j) return 0;
  if (k[0] === k[1] && k[1] === k[2]) return { carro: 4, aereo: 6, nave: 8 }[k[0]];
  if (new Set(k).size === 3) return 10;
  return 0;
}
// la combinazione migliore che il giocatore può giocare (indici nella sua mano)
export function bestTrade(hand) {
  let best = null;
  for (let a = 0; a < hand.length; a++) for (let b = a + 1; b < hand.length; b++) for (let c = b + 1; c < hand.length; c++) {
    const v = tradeValue([hand[a], hand[b], hand[c]]); if (v && (!best || v > best.v)) best = { idx: [a, b, c], v };
  }
  return best;
}
export const canAttackFrom = (st, t) => st.owner[t] === st.turn && st.armies[t] >= 2 && getMap(st.map).terr.find(x => x.id === t).adj.some(a => st.owner[a] !== st.turn);
export const adj = (st, a, b) => getMap(st.map).terr.find(x => x.id === a).adj.includes(b);
export function roll(n, rnd) { return Array.from({ length: n }, () => 1 + (rnd() * 6 | 0)).sort((x, y) => y - x); }

/* ---------- mosse ---------- */
// applica una mossa del giocatore di turno; restituisce { ok, ev } con ev = evento da animare
export function apply(st, a, rnd = Math.random) {
  if (st.winner != null) return { ok: false };
  const p = st.turn, map = getMap(st.map);
  const bad = msg => ({ ok: false, msg });
  if (a.t === 'trade') {
    if (st.phase !== 'reinforce') return bad('Le carte si giocano all\'inizio del turno');
    const hand = st.cards[p], cs = a.idx.map(i => hand[i]); const v = tradeValue(cs); if (!v) return bad('Combinazione non valida');
    let bonus = 0; cs.forEach(c => { if (c.t && st.owner[c.t] === p) bonus = 2; });
    st.cards[p] = hand.filter((_, i) => !a.idx.includes(i)); st.used.push(...cs); st.reinf += v + bonus;
    return { ok: true, ev: { t: 'trade', p, v: v + bonus } };
  }
  if (a.t === 'place') {
    if (st.phase !== 'reinforce' || st.owner[a.terr] !== p) return bad('Puoi rinforzare solo i tuoi territori');
    const n = Math.min(a.n || 1, st.reinf); if (n < 1) return bad('Rinforzi finiti');
    st.armies[a.terr] += n; st.reinf -= n;
    if (st.reinf === 0 && (st.cards[p].length < 5 || !bestTrade(st.cards[p]))) st.phase = 'attack';
    return { ok: true, ev: { t: 'place', p, terr: a.terr, n } };
  }
  if (a.t === 'attack') {
    if (st.phase !== 'attack' || st.pending) return bad('Non è il momento di attaccare');
    const { from, to } = a;
    if (st.owner[from] !== p || st.owner[to] === p || !adj(st, from, to) || st.armies[from] < 2) return bad('Attacco non valido');
    const na = Math.max(1, Math.min(a.dice || 3, 3, st.armies[from] - 1)), nd = Math.min(3, st.armies[to]);
    const ra = a.rolled?.att || roll(na, rnd), rd = a.rolled?.def || roll(nd, rnd);
    let la = 0, ld = 0;
    for (let i = 0; i < Math.min(ra.length, rd.length); i++) { if (ra[i] > rd[i]) ld++; else la++; }
    st.armies[from] -= la; st.armies[to] -= ld;
    const ev = { t: 'battle', p, from, to, att: ra, def: rd, la, ld, dp: st.owner[to] };
    if (st.armies[to] === 0) {
      const dp = st.owner[to]; st.owner[to] = p; ev.conquered = true; st.conquered = true;
      st.pending = { from, to, min: na, max: st.armies[from] - 1 };
      st.armies[to] = 0;
      if (!map.terr.some(t => st.owner[t.id] === dp)) {
        st.players[dp].alive = false; st.players[dp].killedBy = p; ev.eliminated = dp;
        st.cards[p].push(...st.cards[dp]); st.cards[dp] = [];
      }
      checkWin(st, ev);
    }
    return { ok: true, ev };
  }
  if (a.t === 'move') {
    const pd = st.pending; if (!pd) return bad('Niente da spostare');
    const n = Math.max(pd.min, Math.min(pd.max, a.n ?? pd.min));
    st.armies[pd.from] -= n; st.armies[pd.to] += n; st.pending = null;
    checkWin(st, {});
    return { ok: true, ev: { t: 'move', p, from: pd.from, to: pd.to, n } };
  }
  if (a.t === 'endAttack') { if (st.phase !== 'attack' || st.pending) return bad('Prima sposta le armate'); st.phase = 'fortify'; return { ok: true, ev: { t: 'phase', p, phase: 'fortify' } }; }
  if (a.t === 'fortify') {
    if (st.phase !== 'fortify') return bad('Non è il momento');
    const { from, to } = a, n = Math.min(a.n, st.armies[from] - 1);
    if (st.owner[from] !== p || st.owner[to] !== p || !adj(st, from, to) || n < 1) return bad('Spostamento non valido');
    st.armies[from] -= n; st.armies[to] += n;
    const ev = { t: 'fortify', p, from, to, n };
    endTurn(st, ev); return { ok: true, ev };
  }
  if (a.t === 'endTurn') {
    if (st.pending) return bad('Prima sposta le armate');
    if (st.phase === 'reinforce') return bad('Prima piazza i rinforzi');
    const ev = { t: 'endTurn', p }; endTurn(st, ev); return { ok: true, ev };
  }
  return bad('Mossa sconosciuta');
}
function checkWin(st, ev) {
  const alive = st.players.filter(x => x.alive);
  if (missionDone(st, st.turn) || alive.length === 1) { st.winner = st.turn; st.phase = 'end'; ev.win = st.turn; }
}
function endTurn(st, ev) {
  const p = st.turn;
  if (st.conquered && st.deck.length) { const c = st.deck.pop(); st.cards[p].push(c); ev.card = c; }
  if (!st.deck.length && st.used.length) { st.deck = st.used; st.used = []; }
  st.conquered = false;
  let q = p; do { q = (q + 1) % st.players.length; } while (!st.players[q].alive);
  if (q <= p) st.round++;
  st.turn = q; st.phase = 'reinforce'; st.reinf = reinforcements(st, q);
  ev.next = q;
}

/* ---------- giocatore artificiale: una mossa alla volta ---------- */
export function botMove(st) {
  const p = st.turn, map = getMap(st.map), T = map.terr;
  const mine = T.filter(t => st.owner[t.id] === p), enemyAdj = t => t.adj.filter(a => st.owner[a] !== p);
  const threat = t => enemyAdj(t).reduce((s, a) => s + st.armies[a], 0);
  const regionGain = t => { const rs = T.filter(x => x.region === t.region); return rs.filter(x => st.owner[x.id] === p).length / rs.length; };
  if (st.pending) {
    const to = T.find(t => t.id === st.pending.to), from = T.find(t => t.id === st.pending.from);
    const n = enemyAdj(to).length >= enemyAdj(from).length ? st.pending.max : st.pending.min;
    return { t: 'move', n };
  }
  if (st.phase === 'reinforce') {
    const tr = bestTrade(st.cards[p]);
    if (tr && (st.cards[p].length >= 5 || tr.v >= 8)) return { t: 'trade', idx: tr.idx };
    const border = mine.filter(t => enemyAdj(t).length);
    const score = t => threat(t) - st.armies[t.id] + regionGain(t) * 6 + enemyAdj(t).filter(a => st.armies[a] < st.armies[t.id]).length * 2;
    const best = (border.length ? border : mine).sort((a, b) => score(b) - score(a))[0];
    return { t: 'place', terr: best.id, n: st.reinf };
  }
  if (st.phase === 'attack') {
    let best = null;
    for (const t of mine) {
      if (st.armies[t.id] < 3) continue;
      for (const a of enemyAdj(t)) {
        const target = T.find(x => x.id === a);
        const ratio = (st.armies[t.id] - 1) / st.armies[a];
        if (ratio < 1.3) continue;
        const s = ratio * 2 + (target.region === t.region ? regionGain(t) * 3 : 0) + (st.armies[a] === 1 ? 2 : 0);
        if (!best || s > best.s) best = { s, from: t.id, to: a };
      }
    }
    return best ? { t: 'attack', from: best.from, to: best.to, dice: 3 } : { t: 'endAttack' };
  }
  if (st.phase === 'fortify') {
    const inner = mine.filter(t => !enemyAdj(t).length && st.armies[t.id] > 1).sort((a, b) => st.armies[b.id] - st.armies[a.id]);
    for (const f of inner) {
      const dest = f.adj.map(a => T.find(x => x.id === a)).filter(x => st.owner[x.id] === p).sort((a, b) => threat(b) - threat(a))[0];
      if (dest) return { t: 'fortify', from: f.id, to: dest.id, n: st.armies[f.id] - 1 };
    }
    return { t: 'endTurn' };
  }
  return { t: 'endTurn' };
}
