// Briscola online con carte piacentine. L'host tiene il mazzo e decide; gli altri inviano solo la carta che giocano.
import { $, $$, esc, toast, avatarHTML, getProfile, mountTopbar, saveRoom, saveResult, findRoom, sfx, confetti, sleep } from '../shared/core.js';
import { mountLobby } from '../shared/lobby.js';
import { injectDefs, cardSVG, backSVG, SUIT_NAME, cardName } from '../shared/piacentine.js';
import { newDeck, winIndex, sumPts, botChoose, suit, obj } from './regole.js';

injectDefs();
mountTopbar();
const BOTS = [{ name: 'Compare Turi', avatar: '🤖', color: '#3fd6c6' }, { name: 'Comare Nina', avatar: '👵', color: '#ffb23f' }, { name: 'Zio Peppe', avatar: '🧔', color: '#7b6cff' }];
const TEAM = ['#ffb23f', '#3fd6c6'];
let room = null, me = getProfile(), H = null;          // H = stato completo, solo sull'host
const C = { st: null, hand: [], mySeat: 0, q: Promise.resolve(), pending: false }; // vista del client
window.__briscola = { C, get H() { return H; } }; // per i test

const faceHTML = c => `<div class="card" data-c="${c}">${cardSVG(obj(c))}</div>`;
const backHTML = (cls = '') => `<div class="card ${cls}">${backSVG()}</div>`;

/* ================= LOBBY ================= */
mountLobby($('#lobby'), {
  game: 'briscola', title: 'Briscola', subtitle: 'Carte piacentine. Uno contro uno o due contro due: i posti vuoti li prende il computer.',
  min: 1, max: 4,
  settings: [{ key: 'mode', label: 'Partita', options: [{ v: '1v1', l: '1 contro 1' }, { v: '2v2', l: '2 contro 2 (a coppie)' }] }],
  defaults: { mode: '1v1' },
  solo: { label: 'Gioca contro il computer', start: startSolo },
  onJoin: r => { room = r; wire(r); if (r.row.status === 'playing') r.send('hello', {}); },
  onStart: (r, settings, players) => { room = r; showBoard(); if (r.isHost) hostStart(settings, players); },
});

function wire(r) {
  r.on('st', d => enqueue(d));
  r.on('play', (d, from) => { if (r.isHost && H) hostPlay(from, d.c); });
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
  room.both('start', { settings: { mode: '1v1' }, players: [me.id] });
}
function showBoard() { $('#lobby').classList.add('hidden'); $('#board').classList.remove('hidden'); }

/* ================= HOST ================= */
function hostStart(settings, players) {
  const N = settings.mode === '2v2' ? 4 : 2, prev = H;
  const seats = [], info = {};
  let b = 0;
  for (let i = 0; i < N; i++) {
    const id = players[i];
    if (id) { const m = room.member(id) || {}; seats.push(id); info[id] = { name: m.name || '?', avatar: m.avatar || '❔', color: m.color || '#888' }; }
    else { const bid = 'bot' + i; seats.push(bid); info[bid] = { ...BOTS[b++ % 3], bot: true }; }
  }
  const deck = newDeck(), hands = Object.fromEntries(seats.map(id => [id, []]));
  for (let k = 0; k < 3; k++) seats.forEach(id => hands[id].push(deck.pop()));
  const bc = deck.pop(); deck.unshift(bc); // la briscola va sotto il mazzo: è l'ultima a essere pescata
  const same = prev && prev.seats.join() === seats.join(), first = same ? (prev.first + 1) % N : 0;
  H = { N, seats, info, deck, hands, brisCard: bc, bris: suit(bc), table: [], taken: [[], []], turn: first, first, phase: 'play', last: null, result: null,
    match: same ? prev.match : [0, 0], game: (prev?.game || 0) + 1, v: 0, away: {} };
  push();
}
function pub() {
  return { N: H.N, seats: H.seats, info: H.info, brisCard: H.brisCard, bris: H.bris, deckCount: H.deck.length, table: H.table, turn: H.turn,
    counts: H.seats.map(id => H.hands[id].length), taken: H.taken.map(t => t.length), phase: H.phase, last: H.last, result: H.result, match: H.match, game: H.game, v: ++H.v,
    h: Object.fromEntries(H.seats.filter(id => !H.info[id].bot).map(id => [id, H.hands[id]])) };
}
let saveT;
function push() {
  room.both('st', pub());
  if (!room.solo) { clearTimeout(saveT); saveT = setTimeout(() => { const { bt, ...s } = H; saveRoom(room.code, { state: s }); }, 1200); }
  botSoon();
}
function hostPlay(id, c) {
  if (!H || H.phase !== 'play' || H.resolving) return;
  const seat = H.turn; if (H.seats[seat] !== id) return;
  const hand = H.hands[id], i = hand.indexOf(c); if (i < 0) return;
  hand.splice(i, 1); H.table.push({ p: seat, c });
  if (H.table.length === H.N) { H.turn = -1; H.resolving = true; push(); setTimeout(resolveTrick, 1500); }
  else { H.turn = (seat + 1) % H.N; push(); }
}
function resolveTrick() {
  const wi = winIndex(H.table, H.bris), w = H.table[wi].p, cards = H.table.map(t => t.c);
  H.taken[w % 2].push(...cards);
  H.last = { w, cards: H.table.map(t => ({ ...t })), pts: sumPts(cards), n: (H.last?.n || 0) + 1 };
  H.table = [];
  for (let k = 0; k < H.N; k++) { const s = (w + k) % H.N; if (H.deck.length) H.hands[H.seats[s]].push(H.deck.pop()); }
  H.turn = w; H.resolving = false;
  if (H.seats.every(id => !H.hands[id].length)) {
    const p = H.taken.map(sumPts), win = p[0] > 60 ? 0 : p[1] > 60 ? 1 : -1;
    if (win >= 0) H.match[win]++;
    H.result = { pts: p, win }; H.phase = 'end'; H.turn = -1;
    if (!room.solo) {
      saveRoom(room.code, { status: 'finished' });
      saveResult('briscola', room.code, H.seats.map((id, i) => ({ id, name: H.info[id].name, team: i % 2, pts: p[i % 2] })),
        win < 0 ? 'patta' : H.seats.filter((_, i) => i % 2 === win).map(id => H.info[id].name).join(' e '));
    }
  }
  push();
}
// il computer gioca per i suoi posti, e per chi è uscito da più di 20 secondi
function botSoon() {
  clearTimeout(H.bt);
  if (H.phase !== 'play' || H.turn < 0) return;
  const id = H.seats[H.turn];
  if (!H.info[id].bot) return;
  H.bt = setTimeout(() => {
    if (!H || H.seats[H.turn] !== id || H.resolving) return;
    hostPlay(id, botChoose(H.hands[id], H.table, H.bris, H.turn, H.N));
  }, 900 + Math.random() * 700 + (H.table.length ? 0 : 400));
}
setInterval(() => {
  if (!H || !room || room.solo || !room.isHost || H.phase !== 'play' || H.turn < 0 || H.resolving) return;
  const id = H.seats[H.turn];
  if (H.info[id].bot || room.members.some(m => m.id === id)) { H.away[id] = 0; return; }
  H.away[id] ||= Date.now();
  if (Date.now() - H.away[id] > 20000) { toast(`${H.info[id].name} è offline: gioca il computer al suo posto`); H.away[id] = Date.now(); hostPlay(id, botChoose(H.hands[id], H.table, H.bris, H.turn, H.N)); }
}, 2000);
// se l'host esce, il nuovo host riprende la partita dallo stato salvato
let taking = false;
async function takeOver() {
  if (!room || room.solo || !room.isHost || H || !C.st || C.st.phase !== 'play' || taking) return;
  taking = true;
  try {
    const row = await findRoom(room.code);
    if (row?.state?.seats && !H) {
      H = { ...row.state, resolving: false, v: C.st.v, away: {} };
      toast('Ora sei tu l\'host della stanza');
      if (H.table.length === H.N) setTimeout(resolveTrick, 800); else push();
    }
  } finally { taking = false; }
}

/* ================= CLIENT: stato e animazioni ================= */
function enqueue(st) { C.q = C.q.then(() => apply(st)).catch(e => console.error(e)); }
const posOf = (seat, st = C.st) => {
  const rel = (seat - C.mySeat + st.N) % st.N;
  return st.N === 2 ? ['bottom', 'top'][rel] : ['bottom', 'right', 'top', 'left'][rel];
};
const teamName = (st, t) => st.N === 2 ? st.info[st.seats[t]].name : st.seats.filter((_, i) => i % 2 === t).map(id => st.info[id].name).join(' e ');

async function apply(st) {
  const prev = C.st; C.st = st; me = getProfile();
  C.mySeat = Math.max(0, st.seats.indexOf(me.id)); C.spect = !st.seats.includes(me.id);
  const newHand = st.h?.[me.id] || [];
  C.pending = false;
  if (!prev || prev.game !== st.game) {
    $('.overlay')?.remove(); build(st);
    if (!st.last && !st.table.length) { C.hand = []; renderAll(st, true); await dealAnim(st, newHand); }
    C.hand = newHand; renderAll(st);
    if (st.phase === 'end') showEnd(st);
    return;
  }
  for (const t of st.table.slice(prev.table.length)) if (st.table.length > prev.table.length) await playAnim(t, st);
  if (st.last && st.last.n !== prev.last?.n) {
    // se mi sono perso qualche carta della presa, la metto sul tavolo prima di raccoglierla
    for (const t of st.last.cards.slice(prev.table.length)) await playAnim(t, st);
    await collectAnim(st);
    await drawAnim(st, prev, newHand);
  }
  C.hand = newHand; renderAll(st);
  if (st.phase === 'end' && prev.phase !== 'end') { await sleep(500); showEnd(st); }
}

function build(st) {
  const piles = st.N === 2 ? { bottom: 0, top: 1 } : { bottom: 0, right: 1 };
  $('#seats').innerHTML = st.seats.map((id, s) => {
    const pos = posOf(s, st), mine = pos === 'bottom';
    const team = s % 2, pile = piles[pos] !== undefined ? `<div class="pile empty" data-team="${team}"><span class="n">0</span></div>` : '';
    return `<div class="seat" data-pos="${pos}" data-seat="${s}">${pos === 'bottom' ? `<div class="who"></div>${pile}` : `<div class="who"></div>${mine ? '' : '<div class="backs"></div>'}${pile}`}</div>`;
  }).join('');
  $('#trick').classList.toggle('duo', st.N === 2);
  $('#chip').classList.remove('hidden'); $('#board').dataset.bris = st.bris;
  $('#chip').innerHTML = `<svg viewBox="0 0 100 100"><use href="#pc-${st.bris}" width="100" height="100"${st.bris === 'S' || st.bris === 'B' ? ' transform="rotate(35 50 50)"' : ''}/></svg>Briscola: ${SUIT_NAME[st.bris]}`;
  $('#chip').classList.remove('flash'); void $('#chip').offsetWidth; $('#chip').classList.add('flash');
}

function renderAll(st, dealing) {
  // giocatori
  st.seats.forEach((id, s) => {
    const el = $(`.seat[data-seat="${s}"]`); if (!el) return;
    const p = st.info[id], turn = st.turn === s;
    const sub = turn ? (s === C.mySeat && !C.spect ? 'tocca a te' : 'sta giocando…') : st.N === 4 ? `squadra ${s % 2 ? 'B' : 'A'}` : (p.bot ? 'computer' : '');
    $('.who', el).className = 'who' + (turn ? ' turn' : '');
    $('.who', el).innerHTML = `${avatarHTML(p)}<div><div class="nm">${esc(p.name)}${id === me.id ? ' (tu)' : ''}</div><div class="sub">${sub}</div></div>${st.N === 4 ? `<span class="team" style="background:${TEAM[s % 2]}"></span>` : ''}`;
    const bk = $('.backs', el);
    if (bk) bk.innerHTML = dealing ? '' : backHTML('small').repeat(st.counts[s]);
  });
  $$('.pile').forEach(p => { const n = st.taken[+p.dataset.team]; p.classList.toggle('empty', !n); p.innerHTML = (n ? backHTML('small') + backHTML('small') : '') + `<span class="n">${n}</span>`; if (n) p.lastElementChild.previousElementSibling.style.transform = 'rotate(8deg)'; });
  // mazzo
  const dc = st.deckCount;
  $('#deck .stack').innerHTML = Array.from({ length: Math.min(Math.max(dc - 1, 0), 6) }, (_, i) => `<div class="card" style="transform:translate(${-i * 1.5}px,${-i * 1.5}px)">${backSVG()}</div>`).join('');
  $('#deck .bris').innerHTML = dc > 0 ? faceHTML(st.brisCard) : '';
  $('#deck .count').textContent = dc ? `${dc} cart${dc === 1 ? 'a' : 'e'}` : 'mazzo finito';
  // tavolo
  $('#trick').innerHTML = st.table.map(t => `<div class="slot" data-pos="${posOf(t.p)}">${faceHTML(t.c)}</div>`).join('');
  renderHand(st);
}
function myTurn(st = C.st) { return st && !C.spect && st.phase === 'play' && st.turn === C.mySeat && !C.pending; }
function renderHand(st, ghosts = new Set()) {
  const my = myTurn(st);
  $('#hand').className = my ? 'my' : '';
  $('#hand').innerHTML = C.hand.map((c, i) => `<div class="card${ghosts.has(c) ? ' ghost' : ''}" data-c="${c}" title="${cardName(obj(c))}">${cardSVG(obj(c))}<span class="k">${i + 1}</span></div>`).join('');
  $$('#hand .card').forEach(el => el.onclick = () => myPlay(el.dataset.c));
  $('.banner')?.remove();
  if (my) { const b = document.createElement('div'); b.className = 'banner'; b.textContent = 'Tocca a te'; $('#board').appendChild(b); }
}
function myPlay(c) {
  if (!myTurn()) return;
  C.pending = true; $('#hand').className = ''; $('.banner')?.remove(); sfx('click');
  if (room.isHost) hostPlay(me.id, c); else room.send('play', { c });
}
document.addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  const k = +e.key; if (k >= 1 && k <= 3 && C.hand[k - 1]) myPlay(C.hand[k - 1]);
});

/* ---------- animazioni ---------- */
function fly(html, from, to, { ms = 420, rot = 0, flip = false } = {}) {
  const el = document.createElement('div'); el.className = 'fly';
  Object.assign(el.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  el.innerHTML = html; el.firstElementChild.style.cssText = 'width:100%;height:100%';
  document.body.appendChild(el);
  const s = from.width / to.width, dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const a = el.animate([
    { transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(${rot}deg)${flip ? ' rotateY(180deg)' : ''}` },
    { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.22,1,.36,1)' });
  return a.finished.then(() => el.remove());
}
const rectOf = el => el.getBoundingClientRect();
const center = (r, w, h) => ({ left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h });
function cardSize() { const r = $('#deck').getBoundingClientRect(); return { w: r.width, h: r.height }; }

async function playAnim(t, st) {
  const pos = posOf(t.p, st);
  const slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.pos = pos; slot.innerHTML = faceHTML(t.c);
  slot.style.visibility = 'hidden'; $('#trick').appendChild(slot);
  const to = rectOf(slot.firstElementChild);
  let from;
  const mine = $(`#hand .card[data-c="${t.c}"]`);
  if (mine) { from = rectOf(mine); mine.style.visibility = 'hidden'; }
  else { const bk = $(`.seat[data-seat="${t.p}"] .backs`) || $(`.seat[data-seat="${t.p}"] .who`); from = bk ? center(rectOf(bk), to.width * .5, to.height * .5) : to;
    const last = $(`.seat[data-seat="${t.p}"] .backs .card:last-child`); if (last) last.remove(); }
  sfx('card');
  await fly(faceHTML(t.c), from, to, { ms: 380, rot: pos === 'bottom' ? 0 : 20 });
  slot.style.visibility = '';
}
async function collectAnim(st) {
  const { w, pts } = st.last, team = w % 2;
  const wi = st.last.cards.findIndex(t => t.p === w), slots = $$('#trick .slot');
  if (slots[wi]) slots[wi].classList.add('win');
  const line = document.createElement('div'); line.className = 'toastline';
  line.textContent = `Prende ${st.info[st.seats[w]].name}${pts ? ` · ${pts} punt${pts === 1 ? 'o' : 'i'}` : ' · liscio'}`;
  $('#board').appendChild(line);
  sfx(team === C.mySeat % 2 && !C.spect ? 'pop' : 'tick');
  await sleep(850);
  const pile = $(`.pile[data-team="${team}"]`);
  const target = pile ? rectOf(pile) : rectOf($(`.seat[data-seat="${w}"] .who`));
  const { w: cw, h: ch } = cardSize();
  // le carte volano dal tavolo alla pila di chi ha preso
  const rects = slots.map(s => rectOf(s.firstElementChild)); slots.forEach(s => s.remove());
  await Promise.all(rects.map((r, i) => sleep(i * 60).then(() => fly(backHTML(), r, center(target, cw * .5, ch * .5), { ms: 420, rot: -10 }))));
  line.remove(); sfx('card');
}
async function drawAnim(st, prev, newHand) {
  if (!prev.deckCount) return;
  const deckR = rectOf($('#deck'));
  const fresh = newHand.filter(c => !C.hand.includes(c));
  const keep = C.hand.filter(c => newHand.includes(c));
  const missed = st.last.cards.slice(prev.table.length).map(t => t.p);
  for (let k = 0; k < st.N; k++) {
    const s = (st.last.w + k) % st.N;
    const afterPlay = prev.counts[s] - (missed.includes(s) ? 1 : 0);
    if (st.counts[s] <= afterPlay) continue; // questo giocatore non ha pescato
    if (s === C.mySeat && !C.spect) {
      const c = fresh.shift(); if (!c) continue;
      keep.push(c); C.hand = keep.slice(); renderHand(st, new Set([c]));
      const el = $(`#hand .card[data-c="${c}"]`);
      sfx('card'); await fly(backHTML(), deckR, rectOf(el), { ms: 360 });
      el.classList.remove('ghost'); el.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    } else {
      const bk = $(`.seat[data-seat="${s}"] .backs`);
      if (!bk) continue;
      const { w: cw, h: ch } = cardSize();
      sfx('card'); await fly(backHTML(), deckR, center(rectOf(bk), cw * .5, ch * .5), { ms: 340 });
      bk.insertAdjacentHTML('beforeend', backHTML('small'));
    }
  }
  if (!st.deckCount) $('#deck .bris').innerHTML = '';
}

async function dealAnim(st, newHand) {
  const deckR = rectOf($('#deck')), { w: cw, h: ch } = cardSize();
  const mineFinal = newHand.slice();
  for (let k = 0; k < 3; k++) for (let i = 0; i < st.N; i++) {
    const s = (Math.max(st.turn, 0) + i) % st.N;
    if (s === C.mySeat && !C.spect) {
      C.hand = mineFinal.slice(0, k + 1); renderHand(st, new Set([mineFinal[k]]));
      const el = $(`#hand .card[data-c="${mineFinal[k]}"]`);
      sfx('card'); await fly(backHTML(), deckR, rectOf(el), { ms: 260 });
      el.classList.remove('ghost'); el.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 220 });
    } else {
      const bk = $(`.seat[data-seat="${s}"] .backs`); if (!bk) continue;
      sfx('card'); await fly(backHTML(), deckR, center(rectOf(bk), cw * .5, ch * .5), { ms: 240 });
      bk.insertAdjacentHTML('beforeend', backHTML('small'));
    }
  }
  // la briscola si gira
  const b = $('#deck .bris .card'); if (b) b.animate([{ transform: 'rotateY(90deg) scale(.8)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  sfx('pop');
}

/* ---------- fine smazzata ---------- */
function showEnd(st) {
  const r = st.result, myTeam = C.mySeat % 2;
  const won = !C.spect && r.win === myTeam, lost = !C.spect && r.win === 1 - myTeam;
  const title = r.win < 0 ? 'Patta! 60 a 60' : C.spect ? `Vince ${teamName(st, r.win)}` : won ? (st.N === 4 ? 'Avete vinto!' : 'Hai vinto!') : (st.N === 4 ? 'Hanno vinto loro' : `Ha vinto ${teamName(st, r.win)}`);
  if (won || C.spect && r.win >= 0) confetti();
  sfx(won ? 'win' : lost ? 'lose' : 'pop');
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal glass"><h2>${title}</h2>
    <div class="teams">${[0, 1].map(t => `<div class="tm${r.win === t ? ' w' : ''}"><div class="row1">${st.seats.filter((_, i) => i % 2 === t).map(id => avatarHTML(st.info[id])).join('')}
      <span>${esc(teamName(st, t))}</span><b data-to="${r.pts[t]}">0</b></div><div class="bar"><i style="background:${TEAM[t]}" data-w="${r.pts[t] / 120 * 100}"></i></div></div>`).join('')}</div>
    <p class="match">Partite vinte: ${esc(teamName(st, 0))} ${st.match[0]} – ${st.match[1]} ${esc(teamName(st, 1))}</p>
    <div style="display:flex;gap:10px;justify-content:center">${room.isHost ? '<button class="btn primary again">Rivincita</button>' : '<span class="hint" style="align-self:center">L\'host può avviare la rivincita</span>'}<a class="btn" href="../">Menu</a></div></div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => $$('.bar i', o).forEach(i => i.style.width = i.dataset.w + '%'));
  $$('b[data-to]', o).forEach(b => { const to = +b.dataset.to, t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / 1600); b.textContent = Math.round(to * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); })(t0); });
  const again = $('.again', o);
  if (again) again.onclick = () => {
    if (!room.solo) saveRoom(room.code, { status: 'playing' });
    room.both('start', { settings: { mode: st.N === 4 ? '2v2' : '1v1' }, players: st.seats.filter(id => !st.info[id].bot) });
  };
}
