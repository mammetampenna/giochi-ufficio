// Scarta! online, da 2 a 10 giocatori. L'host tiene mazzo e mani e decide; gli altri inviano solo le loro mosse.
import { $, $$, esc, toast, avatarHTML, getProfile, mountTopbar, saveRoom, saveResult, findRoom, sfx, confetti, sleep, floatBackdrop } from '../shared/core.js';
import { mountLobby } from '../shared/lobby.js';
import { anim, timeline, stagger } from '../shared/motion.js';
import { newDeck, shuffle, canPlay, botMove, bestColor, col, val, isWild, COLORS, COLOR_NAME } from './regole.js';
import { cardSVG, backSVG, HEX } from './carte.js';

mountTopbar();
floatBackdrop(['r7.0', 'y2.0', 'gskip.0', 'brev.0', 'rd2.0', 'wwild.0', 'wd4.0', 'g9.0'].map(c => cardSVG(c)).concat([backSVG()]), 14);
const BOTS = [['Compare Turi', '🤖', '#3fd6c6'], ['Comare Nina', '👵', '#ffb23f'], ['Zio Peppe', '🧔', '#7b6cff'], ['Nonna Rosa', '🌹', '#ff5b7f'], ['Cugino Tano', '🦊', '#3fdc8a'],
  ['Don Ciccio', '🎩', '#ff7a45'], ['Mastro Ninì', '🔨', '#4fb3ff'], ['Zia Concetta', '🍋', '#e86cff'], ['Peppino', '🐸', '#ffc22e']];
let room = null, me = getProfile(), H = null;
const C = { st: null, hand: [], mySeat: -1, q: Promise.resolve(), pending: false };
window.__scarta = { C, get H() { return H; } };
const face = c => `<div class="sc-card" data-c="${c}">${cardSVG(c)}</div>`;
const back = () => `<div class="sc-card">${backSVG()}</div>`;
const SPRING = 'outBack(2)';

/* ================= LOBBY ================= */
mountLobby($('#lobby'), {
  game: 'carte', title: 'Scarta!', colors: ['#3b82f6', '#2ecc71'],
  hero: `<div class="hero-fan sc">${['r7.0', 'yd2.0', 'gskip.0', 'wwild.0'].map(c => `<div class="pc">${cardSVG(c)}</div>`).join('')}</div>`,
  subtitle: 'Colori, numeri e carte cattive. Da 2 a 10 giocatori: vince chi resta senza carte.',
  min: 1, max: 10,
  settings: [
    { key: 'bots', label: 'Giocatori del computer', options: [0, 1, 2, 3, 5].map(v => ({ v, l: v ? '+' + v : 'nessuno' })) },
    { key: 'stack', label: 'Accumulare +2 e +4', options: [{ v: 1, l: 'sì' }, { v: 0, l: 'no' }] },
    { key: 'timer', label: 'Tempo per mossa', options: [{ v: 20, l: '20 s' }, { v: 40, l: '40 s' }, { v: 0, l: 'senza limite' }] },
  ],
  defaults: { bots: 1, stack: 1, timer: 20 },
  solo: { label: 'Gioca contro il computer', start: startSolo },
  onJoin: r => { room = r; wire(r); if (r.row.status === 'playing') r.send('hello', {}); },
  onStart: (r, settings, players) => { room = r; showBoard(); if (r.isHost) hostStart(settings, players); },
});
function wire(r) {
  r.on('st', d => enqueue(d));
  r.on('act', (d, from) => { if (r.isHost && H) hostAct(from, d); });
  r.on('hello', () => { if (r.isHost && H) r.send('st', pub()); });
  r.on('members', () => takeOver());
}
function startSolo() {
  const h = {}; me = getProfile();
  room = {
    solo: true, me, code: null, members: [me], isHost: true, hostId: me.id,
    on(t, f) { (h[t] ||= []).push(f); return this; }, emit(t, d, f) { (h[t] || []).forEach(x => x(d, f ?? me.id)); },
    send() {}, both(t, d) { this.emit(t, d, me.id); }, member(id) { return id === me.id ? me : null; },
  };
  wire(room);
  room.on('start', d => { showBoard(); hostStart(d.settings, d.players); });
  room.both('start', { settings: { bots: 3, stack: 1, timer: 0 }, players: [me.id] });
}
function showBoard() { $('#lobby').classList.add('hidden'); $('#board').classList.remove('hidden'); }

/* ================= HOST ================= */
function hostStart(settings, players) {
  const prev = H, seats = [], info = {};
  players.slice(0, 10).forEach(id => { const m = room.member(id) || {}; seats.push(id); info[id] = { name: m.name || '?', avatar: m.avatar || '❔', color: m.color || '#888' }; });
  let nb = Math.min(+settings.bots || 0, 10 - seats.length); if (seats.length + nb < 2) nb = 2 - seats.length;
  for (let i = 0; i < nb; i++) { const id = 'bot' + i, [name, avatar, color] = BOTS[i]; seats.push(id); info[id] = { name, avatar, color, bot: true }; }
  // mescolo i posti, così i computer non sono tutti in fila
  const order = shuffle(seats.slice());
  const deck = newDeck(), hands = Object.fromEntries(order.map(id => [id, []]));
  for (let k = 0; k < 7; k++) order.forEach(id => hands[id].push(deck.pop()));
  let top = deck.pop(); while (isWild(top)) { deck.unshift(top); top = deck.pop(); }
  const same = prev && prev.seats.slice().sort().join() === order.slice().sort().join();
  H = { seats: order, info, deck, discard: [top], hands, color: col(top), dir: 1, turn: 0, pending: 0, drew: null, ultima: {}, vulnerable: null,
    phase: 'play', winner: null, last: { type: 'start', n: 0 }, n: 0, wins: same ? prev.wins : {}, game: (prev?.game || 0) + 1, v: 0,
    settings: { stack: +settings.stack, timer: +settings.timer, bots: +settings.bots }, turnAt: Date.now(), away: {} };
  // la prima carta scoperta ha effetto come se l'avesse giocata il mazziere
  const v = val(top), N = order.length;
  if (v === 'skip') H.turn = 1 % N;
  if (v === 'rev') { H.dir = -1; H.turn = N === 2 ? 1 : N - 1; }
  if (v === 'd2') { give(order[0], 2); H.turn = 1 % N; }
  push();
}
function pub() {
  return { seats: H.seats, info: H.info, top: H.discard[H.discard.length - 1], under: H.discard.slice(-4, -1), color: H.color, dir: H.dir, turn: H.turn, pending: H.pending,
    deckCount: H.deck.length, counts: H.seats.map(id => H.hands[id].length), ultima: H.ultima, vulnerable: H.vulnerable, phase: H.phase, winner: H.winner,
    last: H.last, wins: H.wins, game: H.game, settings: H.settings, turnAt: H.turnAt, drew: H.drew ? H.seats[H.turn] : null, dc: H.drew, v: ++H.v,
    h: Object.fromEntries(H.seats.filter(id => !H.info[id].bot).map(id => [id, H.hands[id]])) };
}
let saveT;
function push() {
  room.both('st', pub());
  if (!room.solo) { clearTimeout(saveT); saveT = setTimeout(() => { const { bt, ...s } = H; saveRoom(room.code, { state: s }); }, 1500); }
  botSoon();
}
function give(id, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!H.deck.length) { const top = H.discard.pop(); H.deck = shuffle(H.discard); H.discard = [top]; }
    if (!H.deck.length) break;
    got.push(H.deck.pop());
  }
  H.hands[id].push(...got);
  if (H.hands[id].length > 1) H.ultima[id] = false;
  return got;
}
const N = () => H.seats.length;
const nextSeat = (k = 1) => ((H.turn + H.dir * k) % N() + N()) % N();
function advance(k = 1) { H.turn = nextSeat(k); H.drew = null; H.turnAt = Date.now(); }

function hostAct(id, a) {
  if (!H || H.phase !== 'play') return;
  const seat = H.seats.indexOf(id);
  if (a.t === 'ultima') { if (H.hands[id]?.length <= 2) { H.ultima[id] = true; if (H.vulnerable === id) H.vulnerable = null; H.last = { type: 'ultima', by: seat, n: ++H.n }; push(); } return; }
  if (a.t === 'catch') {
    if (H.vulnerable && H.vulnerable !== id && H.hands[H.vulnerable].length === 1) {
      const t = H.vulnerable; give(t, 2); H.vulnerable = null;
      H.last = { type: 'caught', by: H.seats.indexOf(t), catcher: seat, n: ++H.n }; push();
    }
    return;
  }
  if (seat !== H.turn) return;
  const hand = H.hands[id], top = H.discard[H.discard.length - 1];
  if (H.vulnerable && H.vulnerable !== id) H.vulnerable = null; // chi non è stato beccato in tempo si è salvato
  if (a.t === 'play') {
    const i = hand.indexOf(a.c);
    if (i < 0 || !canPlay(a.c, top, H.color, H.pending, H.settings.stack)) return;
    if (H.drew && a.c !== H.drew) return; // dopo aver pescato si può giocare solo la carta pescata
    hand.splice(i, 1); H.discard.push(a.c);
    const v = val(a.c);
    H.color = isWild(a.c) ? (COLORS.includes(a.color) ? a.color : bestColor(hand)) : col(a.c);
    const ev = { type: 'play', by: seat, card: a.c, color: H.color, n: ++H.n };
    if (hand.length === 1 && !H.ultima[id]) H.vulnerable = id;
    if (!hand.length) { finish(id, ev); return; }
    if (v === 'skip') { ev.hit = nextSeat(); advance(2); }
    else if (v === 'rev') { H.dir *= -1; if (N() === 2) { ev.hit = nextSeat(); advance(2); } else advance(); }
    else if (v === 'd2' || v === 'd4') {
      const k = v === 'd2' ? 2 : 4;
      if (H.settings.stack) { H.pending += k; advance(); }
      else { ev.hit = nextSeat(); give(H.seats[ev.hit], k); ev.drawn = k; advance(2); }
    } else advance();
    H.last = ev; push(); return;
  }
  if (a.t === 'draw') {
    if (H.drew) return;
    if (H.pending) { const k = H.pending; give(id, k); H.pending = 0; H.last = { type: 'take', by: seat, k, n: ++H.n }; advance(); push(); return; }
    const [c] = give(id, 1);
    H.last = { type: 'draw', by: seat, k: 1, n: ++H.n };
    if (c && canPlay(c, top, H.color, 0, H.settings.stack)) H.drew = c; else advance();
    push(); return;
  }
  if (a.t === 'pass' && H.drew) { H.last = { type: 'pass', by: seat, n: ++H.n }; advance(); push(); }
}
function finish(id, ev) {
  H.phase = 'end'; H.winner = id; H.wins[id] = (H.wins[id] || 0) + 1; ev.win = true; H.last = ev; H.turn = -1;
  push();
  if (!room.solo) {
    saveRoom(room.code, { status: 'finished' });
    saveResult('carte', room.code, H.seats.map(s => ({ id: s, name: H.info[s].name, cards: H.hands[s].length })), H.info[id].name);
  }
}
// computer: gioca dopo una breve pausa; dice "Ultima!" quasi sempre; ogni tanto becca chi se lo dimentica
function botSoon() {
  clearTimeout(H.bt); clearTimeout(H.bc);
  if (H.phase !== 'play') return;
  if (H.vulnerable && !H.info[H.vulnerable].bot) {
    const bots = H.seats.filter(s => H.info[s].bot);
    if (bots.length && Math.random() < .7) H.bc = setTimeout(() => hostAct(bots[Math.random() * bots.length | 0], { t: 'catch' }), 1800 + Math.random() * 2200);
  }
  const id = H.seats[H.turn];
  if (!H.info[id]?.bot) return;
  H.bt = setTimeout(() => botPlay(id), 900 + Math.random() * 700);
}
function botPlay(id) {
  if (!H || H.phase !== 'play' || H.seats[H.turn] !== id) return;
  const hand = H.hands[id], top = H.discard[H.discard.length - 1];
  if (H.drew) { hostAct(id, { t: 'play', c: H.drew, color: bestColor(hand) }); return; }
  const nextCount = H.hands[H.seats[nextSeat()]].length;
  const c = botMove(hand, top, H.color, H.pending, H.settings.stack, nextCount);
  if (c) {
    if (hand.length === 2 && Math.random() < .85) H.ultima[id] = true;
    hostAct(id, { t: 'play', c, color: bestColor(hand.filter(x => x !== c)) });
  } else hostAct(id, { t: 'draw' });
}
// tempo scaduto o giocatore uscito: pesca o passa al posto suo
setInterval(() => {
  if (!H || !room || !room.isHost || H.phase !== 'play') return;
  const id = H.seats[H.turn]; if (!id || H.info[id].bot) return;
  const away = !room.solo && !room.members.some(m => m.id === id);
  const limit = away ? 12000 : H.settings.timer ? H.settings.timer * 1000 : 0;
  if (limit && Date.now() - H.turnAt > limit) {
    if (H.drew) hostAct(id, { t: 'pass' }); else hostAct(id, { t: 'draw' });
    if (H.drew && H.seats[H.turn] === id) hostAct(id, { t: 'pass' });
  }
}, 1000);
let taking = false;
async function takeOver() {
  if (!room || room.solo || !room.isHost || H || !C.st || C.st.phase !== 'play' || taking) return;
  taking = true;
  try {
    const row = await findRoom(room.code);
    if (row?.state?.seats && !H) { H = { ...row.state, v: C.st.v, turnAt: Date.now() }; toast('Ora sei tu l\'host della stanza'); push(); }
  } finally { taking = false; }
}

/* ================= CLIENT ================= */
function enqueue(st) { C.q = C.q.then(() => apply(st)).catch(e => console.error(e)); }
function act(a) { if (room.isHost) hostAct(me.id, a); else room.send('act', a); }
const name = (st, s) => st.info[st.seats[s]]?.name || '?';

async function apply(st) {
  const prev = C.st; C.st = st; me = getProfile();
  C.mySeat = st.seats.indexOf(me.id); C.spect = C.mySeat < 0;
  const newHand = st.h?.[me.id] || [];
  C.pending = false;
  if (!prev || prev.game !== st.game) {
    $('.overlay')?.remove();
    C.hand = []; render(st, true);
    if (st.last.type === 'start') await dealAnim(st, newHand);
    C.hand = newHand; render(st);
    if (st.phase === 'end') showEnd(st);
    return;
  }
  if (st.last.n !== prev.last.n) await eventAnim(st, prev, newHand);
  C.hand = newHand; render(st);
  if (st.phase === 'end' && prev.phase !== 'end') { await sleep(400); showEnd(st); }
}

/* ---------- disegno ---------- */
function render(st, dealing) {
  document.documentElement.style.setProperty('--tint', HEX[st.color]);
  $('#colorDot').style.background = HEX[st.color];
  $('#dir').className = st.dir < 0 ? 'ccw' : '';
  // avversari in ordine di gioco a partire da me
  const base = Math.max(C.mySeat, 0), N = st.seats.length;
  const order = Array.from({ length: N }, (_, k) => (base + k) % N).filter(s => s !== C.mySeat);
  $('#opps').innerHTML = order.map(s => {
    const id = st.seats[s], p = st.info[id], n = dealing ? 0 : st.counts[s];
    const catchable = st.vulnerable === id && id !== me.id && !C.spect;
    return `<div class="opp${st.turn === s ? ' turn' : ''}" data-seat="${s}">${avatarHTML(p)}<div><div class="nm">${esc(p.name)}</div>
      <div class="cnt"><span class="mini">${'<i></i>'.repeat(Math.min(n, 7))}</span>${n}</div></div>
      ${st.ultima[id] && st.counts[s] === 1 ? '<span class="flag">Ultima!</span>' : ''}
      ${catchable ? `<button class="catch" data-catch="${id}">Beccato!</button>` : ''}</div>`;
  }).join('');
  $$('[data-catch]').forEach(b => b.onclick = e => { e.stopPropagation(); act({ t: 'catch' }); sfx('click'); });
  // mazzo e scarti
  $('#deck').innerHTML = `${back()}${st.deckCount > 1 ? back() : ''}<span class="lbl">${st.deckCount} carte</span>`;
  const dk = $$('#deck .sc-card'); if (dk[1]) dk[0].style.transform = 'translate(-3px,-3px)';
  $('#pile').innerHTML = (st.under || []).map((c, i) => `<div class="sc-card" style="transform:rotate(${(i * 37 % 30) - 15}deg)">${cardSVG(c)}</div>`).join('')
    + `<div class="sc-card top" style="transform:rotate(${(st.last.n * 23 % 24) - 12}deg)">${cardSVG(st.top)}</div><div id="colorDot" style="background:${HEX[st.color]}"></div>`
    + (st.pending ? `<div id="pending">+${st.pending} in arrivo</div>` : '');
  renderMe(st, dealing);
}
function myTurn(st = C.st) { return st && !C.spect && st.phase === 'play' && st.turn === C.mySeat && !C.pending; }
function renderMe(st, dealing, ghosts = new Set()) {
  const my = myTurn(st), drew = st.drew === me.id;
  const playable = c => my && (!drew || c === st.dc) && canPlay(c, st.top, st.color, st.pending, st.settings.stack);
  // con tante carte si sovrappongono di più
  const n = C.hand.length, ov = n > 14 ? -46 : n > 10 ? -38 : n > 7 ? -28 : -14;
  $('#hand').style.setProperty('--ov', ov + 'px'); $('#hand').style.setProperty('--ovm', Math.min(ov, -30) - 8 + 'px');
  $('#hand').className = my ? 'my' : '';
  $('#hand').innerHTML = C.hand.map(c => `<div class="sc-card ${playable(c) ? 'ok' : 'no'}${ghosts.has(c) ? ' ghost' : ''}" data-c="${c}">${cardSVG(c)}</div>`).join('');
  $$('#hand .sc-card').forEach(el => el.onclick = () => tryPlay(el.dataset.c));
  const canDraw = my && !drew;
  $('#deck').classList.toggle('can', canDraw && !C.hand.some(c => canPlay(c, st.top, st.color, st.pending, st.settings.stack)));
  $('#deck').onclick = () => { if (myTurn() && st.drew !== me.id) { C.pending = true; act({ t: 'draw' }); sfx('card'); } };
  const p = st.info[me.id];
  const showUltima = !C.spect && st.phase === 'play' && n <= 2 && n > 0 && !st.ultima[me.id] && (n === 1 ? st.vulnerable === me.id : my);
  const left = st.settings.timer && my ? Math.max(0, st.settings.timer - (Date.now() - st.turnAt) / 1000) : 0;
  $('#bar').innerHTML = C.spect ? '<span class="hint">Stai guardando la partita</span>' : `
    <div class="who${my ? ' turn' : ''}">${avatarHTML(p)}<span>${my ? (st.pending ? `Rilancia o pesca ${st.pending}` : drew ? 'Gioca la carta pescata o passa' : 'Tocca a te') : 'Tu'}</span></div>
    ${left ? `<div class="timer"><i id="tbar"></i></div>` : ''}
    ${my && !drew ? `<button class="btn small" id="drawBtn">${st.pending ? 'Pesca ' + st.pending : 'Pesca'}</button>` : ''}
    ${my && drew ? '<button class="btn small" id="passBtn">Passa</button>' : ''}
    ${showUltima ? '<button class="btn small" id="ultima">Ultima!</button>' : ''}`;
  $('#drawBtn')?.addEventListener('click', () => $('#deck').onclick());
  $('#passBtn')?.addEventListener('click', () => { C.pending = true; act({ t: 'pass' }); });
  $('#ultima')?.addEventListener('click', () => { act({ t: 'ultima' }); sfx('win'); });
  if (left) { const tb = $('#tbar'); tb.style.transform = `scaleX(${left / st.settings.timer})`; tb.animate([{ transform: `scaleX(${left / st.settings.timer})` }, { transform: 'scaleX(0)' }], { duration: left * 1000, fill: 'forwards' }); }
}
async function tryPlay(c) {
  const st = C.st;
  if (!myTurn() || !canPlay(c, st.top, st.color, st.pending, st.settings.stack)) { const el = $(`#hand [data-c="${c}"]`); el && anim(el, { translateX: [0, -6, 6, -3, 0], duration: 300 }); return; }
  if (st.drew === me.id && c !== st.dc) return;
  let color;
  if (isWild(c)) { color = await pickColor(); if (!color) return; }
  // se ho 2 carte e non ho detto "Ultima!" rischio di essere beccato
  C.pending = true; act({ t: 'play', c, color }); sfx('click');
}
function pickColor() {
  return new Promise(res => {
    const o = document.createElement('div'); o.className = 'picker';
    o.innerHTML = `<div class="box glass"><h3>Scegli il colore</h3><div class="cols">${COLORS.map(c => `<button data-c="${c}" style="background:${HEX[c]}">${COLOR_NAME[c]}</button>`).join('')}</div>
      <button class="btn small" style="margin-top:14px" data-x>Annulla</button></div>`;
    document.body.appendChild(o);
    anim($$('.cols button', o), { scale: [0, 1], rotate: [-30, 0], duration: 500, delay: stagger(60), ease: SPRING });
    o.onclick = e => { const b = e.target.closest('button'); if (!b) return; o.remove(); res(b.dataset.c || null); };
  });
}

/* ---------- animazioni ---------- */
const rectOf = el => el.getBoundingClientRect();
function fly(html, from, to, { ms = 420, rot = 0 } = {}) {
  const el = document.createElement('div'); el.className = 'fly';
  Object.assign(el.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  el.innerHTML = html; el.firstElementChild.style.cssText = 'width:100%;height:100%';
  document.body.appendChild(el);
  const s = from.width / to.width, dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const a = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(${rot}deg)` }, { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.22,1,.36,1)' });
  return Promise.race([a.finished, sleep(ms + 200)]).then(() => el.remove());
}
const seatEl = s => s === C.mySeat ? $('#bar .who') : $(`.opp[data-seat="${s}"]`);
const small = r => ({ left: r.left + r.width / 2 - 20, top: r.top + r.height / 2 - 30, width: 40, height: 60 });

async function dealAnim(st, newHand) {
  const deckR = rectOf($('#deck'));
  for (let k = 0; k < 7; k++) {
    C.hand = newHand.slice(0, k + 1); renderMe(st, true, new Set([newHand[k]]));
    const el = $(`#hand [data-c="${newHand[k]}"]`);
    if (el) { sfx('card'); await fly(back(), deckR, rectOf(el), { ms: 200 }); el.classList.remove('ghost'); }
  }
}
async function eventAnim(st, prev, newHand) {
  const e = st.last, pileR = rectOf($('#pile')), deckR = rectOf($('#deck'));
  if (e.type === 'play') {
    const mine = $(`#hand [data-c="${e.card}"]`);
    const from = mine ? rectOf(mine) : small(rectOf(seatEl(e.by) || $('#opps')));
    if (mine) mine.style.visibility = 'hidden';
    sfx('card'); await fly(face(e.card), from, pileR, { ms: 380, rot: 160 });
    C.hand = newHand; render(st);
    const v = val(e.card);
    if (isWild(e.card)) { burst(innerWidth / 2, innerHeight * .46, 26, [HEX[e.color], '#fff']); await boom(v === 'd4' ? '+4' : COLOR_NAME[e.color], `${name(st, e.by)} sceglie il ${COLOR_NAME[e.color]}`, HEX[e.color]); }
    else if (v === 'd2') await boom('+2', st.settings.stack ? `${name(st, (e.by + st.dir + st.seats.length) % st.seats.length)} rilancia o pesca` : `${name(st, e.hit)} pesca 2`, HEX[e.color]);
    else if (v === 'skip') { stamp(e.hit, 'Salta!'); await boom('Salta!', `${name(st, e.hit)} salta il turno`, HEX[e.color]); }
    else if (v === 'rev') { anim('#dir svg', { rotate: [0, st.dir < 0 ? -360 : 360], duration: 900, ease: SPRING }); await boom('Inverti!', st.seats.length === 2 ? `${name(st, e.hit)} salta il turno` : 'si gira dall\'altra parte', HEX[e.color]); }
    if (e.drawn) await drawTo(e.hit, e.drawn, prev, st, newHand);
    if (e.win) { burst(innerWidth / 2, innerHeight * .46, 40); await boom('Scarta!', `${name(st, e.by)} ha finito le carte`, '#3fdc8a', 1400); }
  } else if (e.type === 'take') {
    await boom('+' + e.k, `${name(st, e.by)} pesca ${e.k} carte`, '#ff5b7f');
    await drawTo(e.by, e.k, prev, st, newHand);
  } else if (e.type === 'draw') {
    await drawTo(e.by, 1, prev, st, newHand);
  } else if (e.type === 'ultima') {
    stamp(e.by, 'Ultima!', '#ffb23f'); sfx('win');
    await boom('Ultima!', `${name(st, e.by)} ha una carta sola`, '#ffb23f', 800);
  } else if (e.type === 'caught') {
    await boom('Beccato!', `${name(st, e.catcher)} becca ${name(st, e.by)}: +2 carte`, '#ff5b7f');
    await drawTo(e.by, 2, prev, st, newHand);
  }
}
// le carte volano dal mazzo a chi pesca (a me scoperte, agli altri coperte)
async function drawTo(seat, k, prev, st, newHand) {
  const deckR = rectOf($('#deck'));
  if (seat === C.mySeat) {
    const fresh = newHand.filter(c => !C.hand.includes(c));
    for (const c of fresh.slice(0, 8)) {
      C.hand = C.hand.concat(c); renderMe(st, false, new Set([c]));
      const el = $(`#hand [data-c="${c}"]`); if (!el) continue;
      el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      sfx('card'); await fly(back(), deckR, rectOf(el), { ms: 260 }); el.classList.remove('ghost');
      el.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 220 });
    }
  } else {
    const t = seatEl(seat); if (!t) return;
    for (let i = 0; i < Math.min(k, 6); i++) { sfx('card'); await fly(back(), deckR, small(rectOf(t)), { ms: 220 }); }
  }
}
// scritta grande al centro
function boom(text, tag, color = '#ffc53d', hold = 700) {
  const b = document.createElement('div'); b.className = 'boom';
  b.style.setProperty('--bg-grad', `linear-gradient(180deg, #fff, ${color} 55%, color-mix(in srgb, ${color} 60%, #000))`);
  b.innerHTML = `<span class="big">${esc(text)}</span>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}`;
  document.body.appendChild(b);
  timeline()
    .add($('.big', b), { scale: [0, 1], rotate: [-12, 0], duration: 700, ease: 'outElastic(1, .55)' })
    .add($('.tag', b) || [], { opacity: [0, 1], translateY: [14, 0], duration: 320, ease: SPRING }, '-=520');
  sfx('pop');
  return sleep(hold + 300).then(() => { anim(b, { opacity: 0, scale: 1.3, duration: 220 }); return sleep(230); }).then(() => b.remove());
}
// timbro sul giocatore colpito
function stamp(seat, text, bg) {
  const t = seatEl(seat); if (!t) return;
  const r = rectOf(t), el = document.createElement('div'); el.className = 'stamp'; el.textContent = text; if (bg) el.style.background = bg;
  el.style.left = r.left + r.width / 2 - 40 + 'px'; el.style.top = r.top + r.height - 10 + 'px'; document.body.appendChild(el);
  anim(el, { scale: [3, 1], opacity: [0, 1], rotate: [-30, -10], duration: 420, ease: 'outBack(2)' });
  setTimeout(() => { anim(el, { opacity: 0, duration: 300 }); setTimeout(() => el.remove(), 320); }, 1500);
}
function burst(x, y, n, cols = ['#ff4b5c', '#ffc22e', '#2ecc71', '#3b82f6', '#fff']) {
  const ps = Array.from({ length: n }, (_, i) => { const el = document.createElement('div'); el.className = 'spark';
    el.style.left = x - 6 + 'px'; el.style.top = y - 6 + 'px'; el.style.background = cols[i % cols.length]; document.body.appendChild(el); return el; });
  anim(ps, { translateX: () => (Math.random() - .5) * 560, translateY: () => (Math.random() - .7) * 440, rotate: () => Math.random() * 720,
    scale: [{ to: 1.3, duration: 200 }, { to: 0, duration: 700 }], duration: 900, ease: 'outCubic' });
  setTimeout(() => ps.forEach(p => p.remove()), 1000);
}

/* ---------- fine partita ---------- */
function showEnd(st) {
  const w = st.winner, won = w === me.id;
  const title = won ? 'Hai vinto!' : `Vince ${st.info[w].name}`;
  if (won) { confetti(160); setTimeout(() => confetti(120), 700); setTimeout(() => confetti(120), 1400); } else confetti(80);
  sfx(won ? 'win' : 'lose');
  const rank = st.seats.map((id, s) => ({ id, n: st.counts[s] })).sort((a, b) => a.n - b.n);
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal glass">${won ? '<div style="font-size:56px">🏆</div>' : ''}<h2 class="${won ? 'win' : ''}">${[...title].map(ch => `<span class="l">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</h2>
    <div class="rank">${rank.map((r, i) => `<div class="rk${i === 0 ? ' first' : ''}"><span class="pos">${i + 1}</span>${avatarHTML(st.info[r.id])}<span>${esc(st.info[r.id].name)}</span><b>${r.n ? r.n + (r.n === 1 ? ' carta' : ' carte') : (st.wins[r.id] || 0) + ' vinte'}</b></div>`).join('')}</div>
    <div class="row-actions" style="justify-content:center">${room.isHost ? '<button class="btn primary again">Rivincita</button>' : '<span class="hint">L\'host può avviare la rivincita</span>'}<a class="btn" href="../">Menu</a></div></div>`;
  document.body.appendChild(o);
  anim($$('h2 .l', o), { translateY: [40, 0], scale: [.3, 1], rotate: [-20, 0], opacity: [0, 1], duration: 700, delay: stagger(35), ease: 'outBack(2.2)' });
  anim($$('.rk', o), { translateX: [-30, 0], opacity: [0, 1], duration: 500, delay: stagger(70, { start: 300 }), ease: SPRING });
  const again = $('.again', o);
  if (again) again.onclick = () => {
    if (!room.solo) saveRoom(room.code, { status: 'playing' });
    room.both('start', { settings: st.settings, players: st.seats.filter(id => !st.info[id].bot) });
  };
}
