// Conquista!: partita locale contro il computer o online dal vivo (l'host tiene la partita e muove i computer).
import { $, $$, esc, toast, getProfile, mountTopbar, saveRoom, saveResult, sfx, confetti, sleep, floatBackdrop } from '../shared/core.js';
import { mountLobby } from '../shared/lobby.js';
import { MAP_LIST } from './mappe.js';
import { newGame, apply, botMove, getMap, missionText, missionProgress, bestTrade, tradeValue, canAttackFrom, CARD } from './regole.js';
import { battle } from './dadi.js';

mountTopbar();
const BOTS = [['Generale Turi', '🤖'], ['Contessa Nina', '👵'], ['Zio Peppe', '🧔'], ['Ammiraglia Rosa', '🌹'], ['Cugino Tano', '🦊']];
let room = null, me = getProfile(), H = null; // H = stato completo sull'host
// sel = territorio scelto, dst = destinazione dello spostamento, draft = rinforzi ancora da confermare, mv = armate nel selettore
const C = { st: null, q: Promise.resolve(), sel: null, dst: null, draft: {}, last: null, mv: 0, myBattle: null, view: null, bpos: {}, fast: false };
try { C.fast = localStorage.conq_fast === '1'; } catch (e) {}
window.__conquista = { C, get H() { return H; }, tap: id => tapTerr(id), act: a => act(a) };
floatBackdrop(['🎲', '🎯', '🏰', '⚔️', '🪖', '🗺️'].map(e => `<span style="font-size:56px">${e}</span>`), 12);

// icone Lucide
const IC = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  cards: '<rect x="3" y="4" width="12" height="16" rx="2"/><path d="M19 7.5v11a2.5 2.5 0 0 1-2.5 2.5H9"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', minus: '<path d="M5 12h14"/>',
  fast: '<path d="m13 19 9-7-9-7z"/><path d="m2 19 9-7-9-7z"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  move: '<path d="M8 7h12"/><path d="m16 3 4 4-4 4"/><path d="M16 17H4"/><path d="m8 21-4-4 4-4"/>',
};
const ic = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
$('#goalIco').innerHTML = ic('target'); $('#cardsBtn').innerHTML = ic('cards') + '<span class="cnt hidden"></span>'; $('#fitBtn').innerHTML = ic('expand'); $('#helpBtn').innerHTML = ic('help');

/* ================= LOBBY ================= */
const mapOpts = MAP_LIST.map(m => ({ v: m.id, l: `${m.name} · ${m.n}` }));
mountLobby($('#lobby'), {
  game: 'conquista', title: 'Conquista!', colors: ['#ff5b7f', '#7b6cff'],
  hero: `<div class="hero-fan sc" style="width:200px"><div class="pc" style="font-size:70px;display:grid;place-items:center">🎲</div><div class="pc" style="font-size:70px;display:grid;place-items:center">🪖</div><div class="pc" style="font-size:70px;display:grid;place-items:center">🎲</div></div>`,
  subtitle: 'Carrarmatini, dadi e obiettivi segreti. Conquista il Mondo, l\'Europa o l\'Italia, da 2 a 6 giocatori.',
  min: 1, max: 6,
  settings: [
    { key: 'map', label: 'Mappa', options: mapOpts },
    { key: 'bots', label: 'Giocatori del computer', options: [0, 1, 2, 3, 4].map(v => ({ v, l: v ? '+' + v : 'nessuno' })) },
    { key: 'missions', label: 'Obiettivo', options: [{ v: 1, l: 'Obiettivi segreti' }, { v: 0, l: 'Conquista totale' }] },
  ],
  defaults: { map: 'europa', bots: 1, missions: 1 },
  solo: { label: 'Gioca contro il computer', start: soloPicker },
  onJoin: r => { room = r; wire(r); if (r.row.status === 'playing') r.send('hello', {}); },
  onStart: (r, settings, players, d) => { room = r; showGame(); if (r.isHost) hostStart(settings, players, d?.seed); },
});
function wire(r) {
  r.on('st', d => enqueue(d));
  r.on('act', (d, from) => { if (r.isHost && H) hostAct(from, d); });
  r.on('hello', () => { if (r.isHost && H) r.send('st', { st: H, ev: { t: 'sync' } }); });
}
// anteprima della mappa per la scelta
const mapThumb = id => { const m = getMap(id); return `<svg viewBox="0 0 ${m.w} ${m.h}" class="thumb"><path d="${m.terr.map(t => t.d).join('')}"/></svg>`; };
function soloPicker() {
  let map = 'europa', bots = 2, missions = 1;
  const s = sheet();
  const draw = () => {
    s.box.innerHTML = `<h3>Nuova partita</h3>
      <div class="mapopts">${MAP_LIST.map(m => `<button class="mapopt${m.id === map ? ' on' : ''}" data-m="${m.id}">${mapThumb(m.id)}<b>${m.name}</b><small>${m.n} territori${m.id === 'mondo' ? ' · lunga' : m.id === 'italia' ? ' · veloce' : ''}</small></button>`).join('')}</div>
      <div class="setting"><label>Avversari del computer</label><div class="pills">${[1, 2, 3, 4, 5].map(v => `<button class="pill${v === bots ? ' on' : ''}" data-b="${v}">${v}</button>`).join('')}</div></div>
      <div class="setting"><label>Come si vince</label><div class="pills"><button class="pill${missions ? ' on' : ''}" data-o="1">Obiettivo segreto</button><button class="pill${missions ? '' : ' on'}" data-o="0">Conquista totale</button></div></div>
      <button class="btn primary go">Alla conquista ${ic('arrow')}</button>`;
    $$('[data-m]', s).forEach(b => b.onclick = () => { map = b.dataset.m; sfx('click'); draw(); });
    $$('[data-b]', s).forEach(b => b.onclick = () => { bots = +b.dataset.b; sfx('click'); draw(); });
    $$('[data-o]', s).forEach(b => b.onclick = () => { missions = +b.dataset.o; sfx('click'); draw(); });
    $('.go', s).onclick = () => { s.remove(); startSolo(map, bots, missions); };
  };
  draw();
}
function startSolo(map, bots, missions) {
  const h = {}; me = getProfile();
  room = { solo: true, me, code: null, members: [me], isHost: true, hostId: me.id,
    on(t, f) { (h[t] ||= []).push(f); return this; }, emit(t, d, f) { (h[t] || []).forEach(x => x(d, f ?? me.id)); },
    send() {}, both(t, d) { this.emit(t, d, me.id); }, member(id) { return id === me.id ? me : null; } };
  wire(room); showGame();
  hostStart({ map, bots, missions }, [me.id]);
}
function showGame() { $('#lobby').classList.add('hidden'); $('#game').classList.remove('hidden'); }

/* ================= HOST ================= */
function hostStart(settings, players, seed) {
  const list = players.slice(0, 6).map(id => { const m = room.member(id) || {}; return { id, name: m.name || '?', avatar: m.avatar || '❔' }; });
  const nb = Math.min(+settings.bots || 0, 6 - list.length) || (list.length < 2 ? 1 : 0);
  for (let i = 0; i < nb; i++) list.push({ id: 'bot' + i, name: BOTS[i][0], avatar: BOTS[i][1], bot: true });
  H = newGame(settings.map, list, { missions: !!+settings.missions, seed: seed || (Math.random() * 2 ** 31) | 0 });
  push({ t: 'start' });
}
let saveT;
function push(ev) {
  room.both('st', { st: structuredClone(H), ev }); // copia: la vista confronta lo stato prima e dopo, e il motore modifica H sul posto
  if (!room.solo) { clearTimeout(saveT); saveT = setTimeout(() => saveRoom(room.code, { state: H }), 1500); }
  scheduleBot();
}
function hostAct(id, a) {
  if (!H || H.winner != null) return { ok: false };
  if (H.players[H.turn].id !== id) return { ok: false };
  const r = apply(H, a);
  if (!r.ok) { if (id === me.id) toast(r.msg || 'Mossa non valida'); return r; }
  push(r.ev);
  if (H.winner != null && !room.solo) { saveRoom(room.code, { status: 'finished' }); saveResult('conquista', room.code, H.players.map(p => ({ id: p.id, name: p.name })), H.players[H.winner].name); }
  return r;
}
// i computer muovono quando le animazioni sono finite; se una mossa venisse rifiutata, il computer passa
let botBusy = false;
function scheduleBot() {
  if (botBusy || !H || H.winner != null || !H.players[H.turn].bot) return;
  botBusy = true;
  C.q.then(() => sleep(C.fast ? 40 : H.phase === 'reinforce' ? 350 : 160)).then(() => {
    botBusy = false;
    if (!H || H.winner != null || !H.players[H.turn].bot) return;
    const id = H.players[H.turn].id, r = hostAct(id, botMove(H));
    if (!r.ok) { console.warn('mossa del computer rifiutata', r.msg); hostAct(id, H.pending ? { t: 'move', n: H.pending.min } : H.phase === 'attack' ? { t: 'endAttack' } : { t: 'endTurn' }); }
  });
}

/* ================= CLIENT ================= */
// ogni evento ha al massimo 8 secondi per le sue animazioni: la coda non si blocca mai
function enqueue(d) { C.q = C.q.then(() => Promise.race([handle(d), sleep(8000)])).catch(e => console.error(e)); }
function act(a) { if (room.isHost) return hostAct(me.id, a); room.send('act', a); return null; }
const myIdx = (st = C.st) => st.players.findIndex(p => p.id === me.id);
const isMyTurn = (st = C.st) => st && st.winner == null && st.players[st.turn].id === me.id;
const T = id => M.terr.find(t => t.id === id);
const tname = id => T(id).name;
const spd = ms => C.fast ? ms * .35 : ms;

async function handle({ st, ev }) {
  const prev = C.st; C.st = st;
  const mine = ev.p != null && ev.p === myIdx(st);
  if (!prev || ev.t === 'start' || ev.t === 'sync' || prev.map !== st.map) { resetSel(); buildMap(st); render(st); if (ev.t === 'start') await intro(st); return; }
  if (ev.t === 'battle') {
    if (C.myBattle && mine) C.myBattle(ev);
    else await mapBattle(prev, st, ev);
  }
  if (ev.t === 'endTurn' || ev.t === 'fortify' || ev.t === 'phase') resetSel();
  render(st);
  if (ev.t === 'battle' && ev.conquered) $(`.land[data-t="${ev.to}"]`).style.fill = prev.players[ev.dp].color; // il nuovo colore arriva con l'onda
  if (ev.t === 'place') { bump(ev.terr); floatAt(ev.terr, '+' + ev.n); sfx('pop'); await sleep(spd(mine ? 0 : 380)); }
  if (ev.t === 'placeAll') { for (const [t, n] of Object.entries(ev.list)) { bump(t); floatAt(t, '+' + n); sfx('pop'); await sleep(spd(mine ? 90 : 200)); } }
  if (ev.t === 'battle' && ev.conquered) {
    await flood(ev.to, st.players[ev.p].color, ev.from);
    if (mine) bigText('Conquistato!');
    else if (ev.dp === myIdx(st)) { toast(`${st.players[ev.p].name} ti ha preso ${tname(ev.to)}`); shake(); }
  }
  if (ev.eliminated != null) { bigText(`${st.players[ev.eliminated].name} è fuori!`); sfx('lose'); await sleep(900); }
  if (ev.t === 'move' || ev.t === 'fortify') { await march(ev.from, ev.to, st.players[ev.p].color, ev.n); bump(ev.to); }
  if (ev.t === 'trade') { bigText(`+${ev.v} armate`); sfx('win'); }
  if (ev.t === 'endTurn' || ev.t === 'fortify') {
    if (ev.card && mine) toast(`Hai pescato una carta: ${CARD[ev.card.k]}`);
    if (isMyTurn(st)) myTurnStarts(st);
  }
  if (ev.win != null || (st.winner != null && prev.winner == null)) showEnd(st);
  // dopo una mia conquista: se c'è una sola scelta possibile la faccio io
  if (st.pending && isMyTurn(st) && st.pending.max <= st.pending.min) act({ t: 'move', n: st.pending.min });
}
function resetSel() { C.sel = C.dst = C.last = null; C.draft = {}; }
function myTurnStarts(st) {
  bigText('Tocca a te!'); sfx('win');
  try { if (navigator.userActivation?.hasBeenActive && matchMedia('(pointer: coarse)').matches) navigator.vibrate?.([40, 60, 40]); } catch (e) {}
}

/* ---------- mappa ---------- */
let M = null;
const NS = 'http://www.w3.org/2000/svg';
function buildMap(st) {
  M = getMap(st.map);
  const svg = $('#map'), W = M.w, Hh = M.h, all = M.terr.map(t => t.d).join('');
  let lands = '', borders = '', badges = '';
  for (const t of M.terr) {
    lands += `<path class="land" data-t="${t.id}" d="${t.d}"/>`;
    borders += t.b;
    badges += `<g class="badge" data-b="${t.id}"><line class="leader" x1="0" y1="0" x2="0" y2="0"/><g class="bi"><circle class="ring" r="15"/><circle class="disc" r="11.5"/><text class="n">0</text><text class="tname" y="25">${esc(t.name)}</text><g class="plus"><rect x="6" y="-20" width="22" height="14" rx="7"/><text x="17" y="-13">+0</text></g></g></g>`;
  }
  const links = M.links.map(([a, b]) => { const [x1, y1] = T(a).c, [x2, y2] = T(b).c; return `<path class="link" d="M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * .15} ${x2} ${y2}"/>`; }).join('');
  svg.innerHTML = `<defs><radialGradient id="seaG" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1b2a55"/><stop offset="1" stop-color="#0c1230"/></radialGradient></defs>
    <rect class="sea" x="${-W * 2}" y="${-Hh * 2}" width="${W * 5}" height="${Hh * 5}"/>
    <path class="coast" d="${all}"/>${links}<g id="lands">${lands}</g><path class="borders" d="${borders}"/>
    <g id="hl"></g><g id="flood"></g><g id="arrows"></g><g id="badges">${badges}</g><g id="fx"></g>`;
  C.full = { x: 0, y: 0, w: W, h: Hh }; C.k = 0;
  fit(true);
}
// spazio libero tra la barra in alto e il pannello in basso
function freeBox() {
  const r = $('#map').getBoundingClientRect(), top = 112, bot = ($('#panel').offsetHeight || 140) + 24;
  return { r, top, bot, vh: Math.max(160, r.height - top - bot) };
}
function fit(instant) {
  const { r, top, vh } = freeBox(), f = C.full, vw = r.width - 24;
  // in verticale (telefono) la mappa del Mondo parte più grande: si esplora trascinando
  let s = Math.min(vw / f.w, vh / f.h);
  if (vw < vh && f.w / f.h > 1.6) s = Math.min(vh / f.h * .9, vw / f.w * 2.6);
  const w = r.width / s, h = r.height / s;
  let x = f.x + f.w / 2 - w / 2;
  if (w < f.w && M) { const mx = M.terr.reduce((a, t) => a + t.c[0], 0) / M.terr.length; x = Math.max(f.x, Math.min(f.x + f.w - w, mx - w / 2)); }
  const v = { x, y: f.y + f.h / 2 - (top + vh / 2) / s, w, h };
  instant ? (C.view = v, setView()) : flyView(v);
}
function setView() {
  const v = C.view, svg = $('#map');
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  const k = v.w / (svg.clientWidth || 1); // unità della mappa per pixel
  svg.classList.toggle('names', v.w / (svg.clientWidth || 1) < C.full.w / 1000 * .42); // nomi solo da vicino
  if (Math.abs(k - C.k) / (C.k || 1) > .02) { C.k = k; layoutBadges(); }
}
// sposta la visuale con un'animazione morbida
let flyRAF = 0;
function flyView(to, ms = 450) {
  cancelAnimationFrame(flyRAF);
  const from = { ...C.view }, t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) ** 3;
    C.view = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e }; setView();
    if (p < 1) flyRAF = requestAnimationFrame(step);
  };
  flyRAF = requestAnimationFrame(step);
}
// se due territori sono fuori dallo schermo, la visuale li raggiunge
function ensureVisible(ids) {
  const { r, top, bot } = freeBox(), v = C.view, k = v.w / r.width;
  const pts = ids.map(id => C.bpos[id] || T(id).c);
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const pad = 40 * k, vis = { x: v.x + pad, y: v.y + top * k + pad, x2: v.x + v.w - pad, y2: v.y + v.h - bot * k - pad };
  if (x0 >= vis.x && x1 <= vis.x2 && y0 >= vis.y && y1 <= vis.y2) return false;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  flyView({ ...v, x: cx - v.w / 2, y: cy - (top + (r.height - top - bot) / 2) * k });
  return true;
}
$('#fitBtn').onclick = () => fit();
addEventListener('resize', () => C.full && fit(true));

// i distintivi hanno sempre la stessa grandezza sullo schermo e si scostano se si sovrappongono
function layoutBadges() {
  if (!M) return;
  const k = C.k, R = 13 * k, min = 2 * R + 2 * k, P = M.terr.map(t => [t.c[0], t.c[1]]);
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy) || .01;
      if (d < min) { const push = (min - d) / 2, nx = dx / d, ny = dy / d; P[i][0] -= nx * push; P[i][1] -= ny * push; P[j][0] += nx * push; P[j][1] += ny * push; moved = true; }
    }
    if (!moved) break;
  }
  M.terr.forEach((t, i) => {
    const [x, y] = P[i], g = $(`[data-b="${t.id}"]`); C.bpos[t.id] = P[i];
    g.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
    const l = g.firstChild, off = Math.hypot(x - t.c[0], y - t.c[1]) > R * .6;
    l.setAttribute('x2', off ? (t.c[0] - x) / k : 0); l.setAttribute('y2', off ? (t.c[1] - y) / k : 0);
  });
  drawArrows();
}

// trascinare con un dito, avvicinare con due, rotellina; un tocco senza trascinare sceglie il territorio
(() => {
  const svg = $('#map'), pts = new Map(); let start = null, downOn = null;
  const toSvg = (x, y) => { const r = svg.getBoundingClientRect(), v = C.view; return [v.x + (x - r.left) / r.width * v.w, v.y + (y - r.top) / r.height * v.h]; };
  svg.addEventListener('pointerdown', e => {
    cancelAnimationFrame(flyRAF);
    const hit = e.target.closest('[data-t],[data-b]'); downOn = pts.size ? null : hit && (hit.dataset.t || hit.dataset.b);
    svg.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) C.dragged = false;
    start = { v: { ...C.view }, p: [...pts.values()].map(p => [...p]) };
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect(), ps = [...pts.values()];
    if (ps.length === 1 && start.p.length === 1) {
      const dx = ps[0][0] - start.p[0][0], dy = ps[0][1] - start.p[0][1];
      if (!C.dragged && Math.hypot(dx, dy) < 8) return;
      C.dragged = true; svg.classList.add('drag');
      C.view = { ...start.v, x: start.v.x - dx / r.width * start.v.w, y: start.v.y - dy / r.height * start.v.h }; setView();
    } else if (ps.length === 2 && start.p.length === 2) {
      C.dragged = true;
      const d0 = Math.hypot(start.p[0][0] - start.p[1][0], start.p[0][1] - start.p[1][1]), d1 = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      const k = Math.max(.25, Math.min(4, d0 / d1)), mx = (start.p[0][0] + start.p[1][0]) / 2, my = (start.p[0][1] + start.p[1][1]) / 2;
      const fx = start.v.x + (mx - r.left) / r.width * start.v.w, fy = start.v.y + (my - r.top) / r.height * start.v.h;
      const w = Math.max(C.full.w * .12, Math.min(C.full.w * 2.5, start.v.w * k)), h = w * start.v.h / start.v.w;
      C.view = { x: fx - (fx - start.v.x) * w / start.v.w, y: fy - (fy - start.v.y) * h / start.v.h, w, h }; setView();
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId); svg.classList.remove('drag');
    if (!pts.size && !C.dragged && downOn && e.type === 'pointerup') tapTerr(downOn);
    if (!pts.size) downOn = null;
    start = { v: { ...C.view }, p: [...pts.values()].map(p => [...p]) };
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault(); cancelAnimationFrame(flyRAF);
    const [fx, fy] = toSvg(e.clientX, e.clientY), k = Math.exp(e.deltaY * .0015), v = C.view;
    const w = Math.max(C.full.w * .12, Math.min(C.full.w * 2.5, v.w * k)), h = w * v.h / v.w;
    C.view = { x: fx - (fx - v.x) * w / v.w, y: fy - (fy - v.y) * h / v.h, w, h }; setView();
  }, { passive: false });
})();

/* ---------- disegno dello stato ---------- */
const draftSum = () => Object.values(C.draft).reduce((a, b) => a + b, 0);
function render(st = C.st) {
  if (!M) return;
  const pl = st.players;
  for (const t of M.terr) {
    const col = pl[st.owner[t.id]].color;
    $(`.land[data-t="${t.id}"]`).style.fill = col;
    const b = $(`[data-b="${t.id}"]`), dn = C.draft[t.id] || 0;
    b.style.setProperty('--pc', col);
    b.querySelector('.n').textContent = st.armies[t.id] + dn;
    b.classList.toggle('drafted', dn > 0);
    if (dn) b.querySelector('.plus text').textContent = '+' + dn;
  }
  highlight(st);
  const mi = myIdx(st);
  $('#players').innerHTML = pl.map((p, i) => {
    const n = M.terr.filter(t => st.owner[t.id] === i), arm = n.reduce((s, t) => s + st.armies[t.id], 0);
    return `<div class="pp${i === st.turn ? ' turn' : ''}${p.alive ? '' : ' dead'}${i === mi ? ' me' : ''}" style="--pc:${p.color}"><span class="dot">${p.avatar || ''}</span><span class="nm">${esc(i === mi ? 'Tu' : p.name)}</span><small>${n.length}<i>·</i>${arm}</small></div>`;
  }).join('');
  const tp = $('.pp.turn'), bar = $('#players'); if (tp && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: tp.offsetLeft - bar.clientWidth / 2 + tp.offsetWidth / 2, behavior: 'smooth' });
  goal(st);
  const hand = mi >= 0 ? st.cards[mi].length : 0, cnt = $('#cardsBtn .cnt');
  cnt.textContent = hand; cnt.classList.toggle('hidden', !hand);
  $('#cardsBtn').classList.toggle('ready', mi >= 0 && !!bestTrade(st.cards[mi]) && isMyTurn(st) && st.phase === 'reinforce');
  panel(st);
}
// a che punto è il mio obiettivo, sempre in vista
function goal(st) {
  const i = myIdx(st), el = $('#goal');
  if (i < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const g = missionProgress(st, i), m = st.missions?.[i];
  const short = !m ? 'Conquista tutto' : m.k === 'regions' ? m.ids.map(r => M.regions[r].name).join(' + ') : m.k === 'destroy' && g.left != null ? `Elimina ${st.players.find(x => x.id === m.target)?.name}` : m.k === 'terr2' ? `${m.n} territori da 2` : `${m.n} territori`;
  const pct = g.left != null ? 0 : Math.min(100, g.have / g.need * 100);
  $('#goalTxt').innerHTML = `<b>${esc(short)}</b><span>${g.left != null ? `gli restano ${g.left} territori` : `${g.have} di ${g.need}`}</span>`;
  $('#goalBar').style.width = pct + '%';
}
function highlight(st) {
  const mine = isMyTurn(st), p = st.turn, lands = {}, badges = {};
  const set = (id, cls) => { (lands[id] ||= new Set()).add(cls); (badges[id] ||= new Set()).add(cls); };
  let arrows = [];
  if (mine && st.pending) {
    M.terr.forEach(t => set(t.id, 'dim')); lands[st.pending.from].delete('dim'); lands[st.pending.to].delete('dim');
    set(st.pending.from, 'sel'); set(st.pending.to, 'target'); arrows = [[st.pending.from, st.pending.to, 'go']];
  } else if (mine && st.phase === 'reinforce') {
    M.terr.forEach(t => { if (st.owner[t.id] !== p) set(t.id, 'dim'); else set(t.id, 'can'); });
    if (C.last) set(C.last, 'sel');
  } else if (mine && st.phase === 'attack') {
    if (!C.sel) M.terr.forEach(t => { if (canAttackFrom(st, t.id)) set(t.id, 'can'); else if (st.owner[t.id] === p) set(t.id, 'dim'); });
    else {
      const tg = T(C.sel).adj.filter(a => st.owner[a] !== p);
      M.terr.forEach(t => { if (t.id !== C.sel && !tg.includes(t.id)) set(t.id, 'dim'); });
      set(C.sel, 'sel'); tg.forEach(a => set(a, 'target')); arrows = tg.map(a => [C.sel, a, 'atk']);
    }
  } else if (mine && st.phase === 'fortify') {
    const canFrom = t => st.owner[t.id] === p && st.armies[t.id] > 1 && t.adj.some(a => st.owner[a] === p);
    if (!C.sel) M.terr.forEach(t => { if (canFrom(t)) set(t.id, 'can'); else set(t.id, 'dim'); });
    else {
      const tg = C.dst ? [C.dst] : T(C.sel).adj.filter(a => st.owner[a] === p);
      M.terr.forEach(t => { if (t.id !== C.sel && !tg.includes(t.id)) set(t.id, 'dim'); });
      set(C.sel, 'sel'); tg.forEach(a => set(a, 'target')); arrows = tg.map(a => [C.sel, a, 'go']);
    }
  }
  for (const t of M.terr) {
    const L = lands[t.id], B = badges[t.id], l = $(`.land[data-t="${t.id}"]`), b = $(`[data-b="${t.id}"]`);
    for (const c of ['dim', 'sel', 'target', 'can']) { l.classList.toggle(c, !!L?.has(c)); b.classList.toggle(c, !!B?.has(c)); }
  }
  // bordo luminoso sopra i territori scelti
  $('#hl').innerHTML = M.terr.filter(t => lands[t.id]?.has('sel') || lands[t.id]?.has('target')).map(t => `<path class="${lands[t.id].has('sel') ? 'hsel' : 'htgt'}" d="${t.d}"/>`).join('');
  C.arrows = arrows; drawArrows();
}
// frecce curve da un distintivo all'altro
function drawArrows() {
  const g = $('#arrows'); if (!g) return;
  const k = C.k || 1;
  g.innerHTML = (C.arrows || []).map(([a, b, kind]) => {
    const [x1, y1] = C.bpos[a] || T(a).c, [x2, y2] = C.bpos[b] || T(b).c, d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1) return '';
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, s = 16 * k, e = 19 * k;
    const sx = x1 + ux * s, sy = y1 + uy * s, ex = x2 - ux * e, ey = y2 - uy * e, bend = Math.min(d * .2, 40 * k);
    const cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend, ang = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
    return `<g class="arr ${kind}"><path class="shaft" d="M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}"/><path class="head" transform="translate(${ex} ${ey}) rotate(${ang}) scale(${k})" d="M2 0L-9 -7L-6 0L-9 7Z"/></g>`;
  }).join('');
}

/* ---------- pannello in basso: dice sempre cosa fare ---------- */
const PH = ['reinforce', 'attack', 'fortify'], PHN = { reinforce: 'Rinforza', attack: 'Attacca', fortify: 'Sposta' };
const VERB = { reinforce: 'mette i rinforzi', attack: 'sta attaccando', fortify: 'sposta le armate' };
function panel(st) {
  const p = st.players[st.turn], el = $('#panel'), me_ = myIdx(st);
  el.style.setProperty('--pc', p.color);
  if (st.winner != null) { el.innerHTML = `<div class="who"><span class="av">🏆</span><div><b>Ha vinto ${esc(st.players[st.winner].name)}</b></div></div>`; return; }
  if (!isMyTurn(st)) {
    el.innerHTML = `<div class="who"><span class="av">${p.avatar || ''}</span><div class="wt"><b>Turno di ${esc(p.name)}</b><small>${VERB[st.phase] || ''}<span class="dots"><i></i><i></i><i></i></span></small></div>
      <button class="fastbtn${C.fast ? ' on' : ''}" aria-pressed="${C.fast}">${ic('fast')}<span>Veloce</span></button></div>`;
    $('.fastbtn', el).onclick = () => { C.fast = !C.fast; try { localStorage.conq_fast = C.fast ? '1' : '0'; } catch (e) {} sfx('click'); panel(st); };
    return;
  }
  const steps = `<div class="steps">${PH.map((ph, i) => `<div class="step${ph === st.phase ? ' on' : ''}${PH.indexOf(st.phase) > i ? ' done' : ''}"><i>${PH.indexOf(st.phase) > i ? ic('check') : i + 1}</i>${PHN[ph]}</div>`).join('')}</div>`;
  let body = '', acts = '';
  const hand = st.cards[me_], tr = bestTrade(hand);
  if (st.pending) {
    const pd = st.pending; C.mv = Math.max(pd.min, Math.min(pd.max, C.mv || pd.max));
    body = `<div class="say"><span>Hai preso <b>${esc(tname(pd.to))}</b>. Quante armate entrano?</span></div>${stepper(pd.min, pd.max)}`;
    acts = `<button class="btn primary go">${ic('arrow')}Entra con ${C.mv}</button>`;
  } else if (st.phase === 'reinforce') {
    const left = st.reinf - draftSum();
    if (hand.length >= 5 && tr) {
      body = `<div class="say"><span>Hai ${hand.length} carte: prima gioca un tris.</span></div>`;
      acts = `<button class="btn primary trade">${ic('cards')}Gioca il tris (+${tr.v})</button>`;
    } else {
      body = `<div class="say"><span class="num">${left}</span>${left ? `<span>${left === 1 ? 'armata da mettere' : 'armate da mettere'}<small>Tocca i tuoi territori: ogni tocco ne mette una</small></span>` : '<span>Rinforzi pronti<small>Conferma, oppure sposta qualcosa</small></span>'}</div>`;
      if (C.last) body += `<div class="row"><span class="where">${esc(tname(C.last))}</span>${stepperDraft(C.last, left)}<button class="chip all" ${left ? '' : 'disabled'}>Tutte qui</button></div>`;
      acts = (tr ? `<button class="btn trade">${ic('cards')}Tris +${tr.v}</button>` : '') + (draftSum() ? `<button class="btn undo">${ic('undo')}Rifai</button>` : '')
        + `<button class="btn primary go" ${left ? 'disabled' : ''}>${ic('check')}Conferma</button>`;
    }
  } else if (st.phase === 'attack') {
    const any = M.terr.some(t => canAttackFrom(st, t.id));
    body = C.sel ? `<div class="say"><span>Da <b>${esc(tname(C.sel))}</b> (${st.armies[C.sel]}): tocca chi vuoi attaccare</span></div>`
      : any ? `<div class="say"><span>Scegli da dove attaccare<small>Brillano i tuoi territori con almeno 2 armate vicino a un nemico</small></span></div>`
      : `<div class="say"><span>Nessun attacco possibile<small>Ti servono almeno 2 armate vicino a un nemico</small></span></div>`;
    acts = (C.sel ? `<button class="btn back">${ic('x')}Cambia</button>` : '') + `<button class="btn primary go">${ic('flag')}Basta attacchi</button>`;
  } else if (st.phase === 'fortify') {
    if (C.sel && C.dst) {
      const max = st.armies[C.sel] - 1; C.mv = Math.max(1, Math.min(max, C.mv || max));
      body = `<div class="say"><span>Da <b>${esc(tname(C.sel))}</b> a <b>${esc(tname(C.dst))}</b></span></div>${stepper(1, max)}`;
      acts = `<button class="btn back">${ic('x')}Annulla</button><button class="btn primary mvgo">${ic('move')}Sposta ${C.mv} e passa</button>`;
    } else {
      body = C.sel ? `<div class="say"><span>Da <b>${esc(tname(C.sel))}</b>: tocca un tuo territorio vicino</span></div>`
        : `<div class="say"><span>Vuoi spostare armate?<small>Facoltativo: da un tuo territorio a uno vicino, poi passi il turno</small></span></div>`;
      acts = (C.sel ? `<button class="btn back">${ic('x')}Annulla</button>` : '') + `<button class="btn primary go">${ic('check')}Fine turno</button>`;
    }
  }
  el.innerHTML = steps + body + `<div class="acts">${acts}</div>`;
  wirePanel(st, el);
}
const stepper = (min, max) => `<div class="stepper"><button data-s="-1" ${C.mv <= min ? 'disabled' : ''} aria-label="Meno">${ic('minus')}</button><b>${C.mv}</b><button data-s="1" ${C.mv >= max ? 'disabled' : ''} aria-label="Più">${ic('plus')}</button>
  <span class="quick"><button class="chip" data-q="${min}">${min === 1 ? '1' : 'Min'}</button><button class="chip" data-q="${max}">Tutte</button></span></div>`;
const stepperDraft = (id, left) => `<div class="stepper small"><button data-d="-1" ${C.draft[id] ? '' : 'disabled'} aria-label="Togli">${ic('minus')}</button><b>+${C.draft[id] || 0}</b><button data-d="1" ${left ? '' : 'disabled'} aria-label="Aggiungi">${ic('plus')}</button></div>`;
function wirePanel(st, el) {
  const pd = st.pending, max = pd ? pd.max : st.phase === 'fortify' && C.sel ? st.armies[C.sel] - 1 : 0, min = pd ? pd.min : 1;
  $$('[data-s]', el).forEach(b => holdRepeat(b, () => { C.mv = Math.max(min, Math.min(max, C.mv + +b.dataset.s)); sfx('tick'); panel(st); }));
  $$('[data-q]', el).forEach(b => b.onclick = () => { C.mv = +b.dataset.q; sfx('click'); panel(st); });
  $$('[data-d]', el).forEach(b => holdRepeat(b, () => addDraft(C.last, +b.dataset.d)));
  $('.all', el)?.addEventListener('click', () => addDraft(C.last, st.reinf - draftSum()));
  $('.trade', el)?.addEventListener('click', () => openCards(st));
  $('.undo', el)?.addEventListener('click', () => { C.draft = {}; C.last = null; sfx('click'); render(st); });
  $('.back', el)?.addEventListener('click', () => { C.sel = C.dst = null; C.mv = 0; sfx('click'); render(st); });
  $('.mvgo', el)?.addEventListener('click', () => { const a = { t: 'fortify', from: C.sel, to: C.dst, n: C.mv }; resetSel(); C.mv = 0; act(a); });
  $('.go', el)?.addEventListener('click', () => {
    if (pd) { const n = C.mv; C.mv = 0; C.sel = null; act({ t: 'move', n }); }
    else if (st.phase === 'reinforce') { const list = { ...C.draft }; resetSel(); act({ t: 'placeAll', list }); }
    else if (st.phase === 'attack') { resetSel(); act({ t: 'endAttack' }); }
    else if (st.phase === 'fortify') { resetSel(); act({ t: 'endTurn' }); }
  });
}
// tenendo premuto + o − il numero continua a scorrere; il pannello si ridisegna a ogni passo,
// quindi lo stop è sulla finestra e non sul pulsante (che nel frattempo è stato sostituito)
let holdT = null;
const holdStop = () => { clearTimeout(holdT); holdT = null; };
['pointerup', 'pointercancel', 'blur'].forEach(ev => addEventListener(ev, holdStop));
function holdRepeat(b, f) {
  b.addEventListener('pointerdown', e => {
    if (b.disabled) return; e.preventDefault(); holdStop(); f();
    let d = 400; const go = () => { holdT = setTimeout(() => { f(); d = Math.max(70, d * .75); go(); }, d); }; go();
  });
}
function addDraft(id, n) {
  const st = C.st, left = st.reinf - draftSum();
  n = Math.max(-(C.draft[id] || 0), Math.min(left, n)); if (!n) return;
  C.draft[id] = (C.draft[id] || 0) + n; if (!C.draft[id]) delete C.draft[id];
  C.last = id; sfx(n > 0 ? 'pop' : 'click'); render(st); if (n > 0) bump(id);
}

/* ---------- tocchi sulla mappa ---------- */
function tapTerr(id) {
  const st = C.st; if (!M || !isMyTurn(st) || document.querySelector('.battle')) return;
  const p = st.turn, mine = st.owner[id] === p;
  if (st.pending) return;
  if (st.phase === 'reinforce') {
    if (!mine) return nope(id, 'Puoi rinforzare solo i tuoi territori');
    if (st.cards[p].length >= 5 && bestTrade(st.cards[p])) return openCards(st);
    if (st.reinf - draftSum() <= 0) { C.last = id; render(st); return toast('Hai messo tutte le armate: conferma'); }
    return addDraft(id, 1);
  }
  if (st.phase === 'attack') {
    if (mine) {
      if (C.sel === id) { C.sel = null; sfx('click'); return render(st); }
      if (!canAttackFrom(st, id)) return nope(id, st.armies[id] < 2 ? 'Servono almeno 2 armate per attaccare' : 'Qui intorno non ci sono nemici');
      C.sel = id; sfx('click'); render(st); return;
    }
    // tocco un nemico: attacco dal territorio scelto, o dal mio vicino più forte
    let from = C.sel && T(C.sel).adj.includes(id) ? C.sel : null;
    if (!from) from = T(id).adj.filter(a => st.owner[a] === p && st.armies[a] >= 2).sort((a, b) => st.armies[b] - st.armies[a])[0];
    if (!from) return nope(id, C.sel ? 'Non è confinante con il territorio scelto' : 'Non hai territori vicini con almeno 2 armate');
    C.sel = from; render(st);
    return myAttack(from, id);
  }
  if (st.phase === 'fortify') {
    if (!mine) return nope(id, 'Puoi spostare solo tra i tuoi territori');
    if (C.sel && C.sel !== id && T(C.sel).adj.includes(id)) { C.dst = id; C.mv = st.armies[C.sel] - 1; sfx('click'); return render(st); }
    if (C.sel === id) { C.sel = C.dst = null; return render(st); }
    if (st.armies[id] < 2) return nope(id, 'Serve almeno 2 armate per spostarne una');
    C.sel = id; C.dst = null; sfx('click'); render(st);
  }
}
function nope(id, msg) {
  toast(msg); sfx('click');
  const b = $(`[data-b="${id}"] .bi`); b?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 260 });
}
// la mia battaglia: il bicchiere è mio, i risultati li decide l'host
async function myAttack(from, to) {
  const st = C.st, p = st.players[st.turn], d = st.players[st.owner[to]];
  const res = await battle({
    att: { name: p.name, color: p.color, terr: tname(from), armies: st.armies[from] },
    def: { name: d.name, color: d.color, terr: tname(to), armies: st.armies[to] },
    resolve: n => new Promise(r => {
      const t = setTimeout(() => { C.myBattle = null; r(null); }, 7000);
      C.myBattle = ev => { clearTimeout(t); C.myBattle = null; r(ev); };
      const out = act({ t: 'attack', from, to, dice: n });
      if (out && !out.ok) { clearTimeout(t); C.myBattle = null; r(null); }
    }),
  });
  C.myBattle = null;
  // dopo la battaglia: se posso ancora attaccare da lì resto selezionato
  if (!res.conquered) { C.sel = canAttackFrom(C.st, from) ? from : null; render(C.st); }
}
// le battaglie degli altri si vedono sulla mappa: freccia, dadi piccoli e perdite
async function mapBattle(prev, st, ev) {
  const a = prev.players[ev.p], d = prev.players[ev.dp];
  if (ensureVisible([ev.from, ev.to])) await sleep(spd(380));
  C.arrows = [[ev.from, ev.to, 'atk']]; drawArrows();
  $('#arrows').style.setProperty('--ac', a.color);
  const [x1, y1] = C.bpos[ev.from], [x2, y2] = C.bpos[ev.to], [sx, sy] = toScreen((x1 + x2) / 2, (y1 + y2) / 2);
  const box = document.createElement('div'); box.className = 'mbat';
  const die = (v, c, cls = '') => `<span class="md ${cls}" style="--dc:${c}">${pips(v)}</span>`;
  box.innerHTML = `<div class="mrow">${ev.att.map((v, i) => die(v, a.color, i < ev.def.length ? (v > ev.def[i] ? 'w' : 'l') : 'x')).join('')}</div><div class="mrow">${ev.def.map((v, i) => die(v, d.color, i < ev.att.length ? (ev.att[i] > v ? 'l' : 'w') : 'x')).join('')}</div>`;
  box.style.left = sx + 'px'; box.style.top = sy + 'px';
  if (ev.dp === myIdx(st)) box.classList.add('vsme');
  document.body.appendChild(box); sfx('card');
  await sleep(spd(420));
  box.classList.add('res'); sfx('thump');
  if (ev.la) floatAt(ev.from, '−' + ev.la, '#ff8aa5');
  if (ev.ld) floatAt(ev.to, '−' + ev.ld, '#ff8aa5');
  render(st); if (ev.conquered) $(`.land[data-t="${ev.to}"]`).style.fill = d.color;
  await sleep(spd(480));
  box.classList.add('out'); setTimeout(() => box.remove(), 300);
}
const pips = v => { const P = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v]; return Array.from({ length: 9 }, (_, i) => `<i${P.includes(i + 1) ? ' class="on"' : ''}></i>`).join(''); };
function toScreen(x, y) { const r = $('#map').getBoundingClientRect(), v = C.view; return [r.left + (x - v.x) / v.w * r.width, r.top + (y - v.y) / v.h * r.height]; }

/* ---------- finestre ---------- */
function sheet() {
  const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = '<div class="box"></div>'; s.box = s.firstChild;
  document.body.appendChild(s); s.onclick = e => { if (e.target === s) s.remove(); }; return s;
}
function openCards(st = C.st) {
  const i = myIdx(st); if (i < 0) return;
  const hand = st.cards[i], picked = new Set(), ICON = { carro: '🪖', aereo: '✈️', nave: '🚢', jolly: '⭐' };
  const s = sheet();
  const draw = () => {
    const v = picked.size === 3 ? tradeValue([...picked].map(k => hand[k])) : 0, can = isMyTurn(st) && st.phase === 'reinforce' && !st.pending;
    s.box.innerHTML = `<h3>Le tue carte</h3>
      ${hand.length ? `<div class="cardsrow">${hand.map((c, k) => `<button class="gcard k-${c.k}${picked.has(k) ? ' on' : ''}" data-k="${k}"><span class="ic">${ICON[c.k]}</span><b>${CARD[c.k]}</b><small>${c.t ? esc(tname(c.t)) : ''}</small></button>`).join('')}</div>` : '<p class="hint">Nessuna carta. Ne peschi una alla fine di ogni turno in cui conquisti almeno un territorio.</p>'}
      <div class="tris"><span>🪖🪖🪖 <b>4</b></span><span>✈️✈️✈️ <b>6</b></span><span>🚢🚢🚢 <b>8</b></span><span>🪖✈️🚢 <b>10</b></span><span>⭐ + 2 uguali <b>12</b></span></div>
      <p class="hint">+2 se possiedi un territorio di una delle carte. Il tris si gioca all'inizio del turno; con 5 carte è obbligatorio.</p>
      <div class="acts"><button class="btn x">Chiudi</button>${can ? `<button class="btn primary ok" ${v ? '' : 'disabled'}>${v ? `Gioca (+${v})` : 'Scegli 3 carte'}</button>` : ''}</div>`;
    $$('[data-k]', s).forEach(b => b.onclick = () => { const k = +b.dataset.k; picked.has(k) ? picked.delete(k) : picked.size < 3 && picked.add(k); sfx('card'); draw(); });
    $('.x', s).onclick = () => s.remove();
    const ok = $('.ok', s); if (ok) ok.onclick = () => { s.remove(); act({ t: 'trade', idx: [...picked] }); };
  };
  const tr = bestTrade(hand); if (tr && isMyTurn(st) && st.phase === 'reinforce') tr.idx.forEach(k => picked.add(k));
  draw();
}
$('#cardsBtn').onclick = () => C.st && openCards();
$('#goal').onclick = () => {
  const st = C.st; if (!st) return; const i = myIdx(st), g = missionProgress(st, i);
  const s = sheet();
  s.box.innerHTML = `<h3>Il tuo obiettivo segreto</h3><div class="mission">${ic('target')}<span>${esc(missionText(st, st.missions?.[i]))}</span></div>
    <p class="hint">${g.left != null ? `Gli restano ${g.left} territori.` : `Sei a ${g.have} su ${g.need}.`} Gli altri non sanno qual è: nemmeno tu conosci il loro.</p>
    <div class="regions">${Object.entries(M.regions).map(([rid, r]) => { const ts = M.terr.filter(t => t.region === rid), n = ts.filter(t => st.owner[t.id] === i).length; return `<div class="reg${n === ts.length ? ' full' : ''}"><b>${esc(r.name)}</b><span>${n}/${ts.length}</span><small>+${r.bonus} a turno se è tutta tua</small></div>`; }).join('')}</div>
    <button class="btn x">Chiudi</button>`;
  $('.x', s).onclick = () => s.remove();
};
$('#helpBtn').onclick = () => tutorial();
function tutorial(then) {
  const s = sheet(); let k = 0;
  const pages = [
    ['🎯', 'Lo scopo', 'Hai un <b>obiettivo segreto</b>: lo vedi sempre in alto a sinistra, con quanto ti manca. Chi lo completa per primo vince.'],
    ['🪖', '1 · Rinforza', 'A inizio turno ricevi armate: <b>un tocco su un tuo territorio = una armata</b>. Poi premi Conferma. Più territori e regioni intere hai, più armate ricevi.'],
    ['🎲', '2 · Attacca', 'Tocca un tuo territorio che brilla, poi un nemico confinante. <b>Tieni premuto il bicchiere</b> e lascia: i dadi più alti vincono, il pari va a chi difende.'],
    ['🚚', '3 · Sposta', 'Se vuoi, sposta armate tra due tuoi territori vicini. Poi il turno passa. Se hai conquistato qualcosa peschi una carta: tre carte giuste valgono armate extra.'],
  ];
  const draw = () => {
    const [e, h, t] = pages[k];
    s.box.innerHTML = `<div class="tuto"><div class="te">${e}</div><h3>${h}</h3><p>${t}</p></div>
      <div class="pg">${pages.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>
      <div class="acts">${k ? '<button class="btn prev">Indietro</button>' : '<button class="btn x">Salta</button>'}<button class="btn primary nx">${k < pages.length - 1 ? 'Avanti' : 'Si gioca!'}</button></div>`;
    $('.prev', s)?.addEventListener('click', () => { k--; draw(); });
    $('.x', s)?.addEventListener('click', () => { s.remove(); then?.(); });
    $('.nx', s).onclick = () => { if (k < pages.length - 1) { k++; sfx('card'); draw(); } else { s.remove(); then?.(); } };
  };
  draw();
}

/* ---------- effetti sulla mappa ---------- */
function bump(id) { const b = $(`[data-b="${id}"] .bi`); if (!b) return; b.classList.remove('bump'); void b.getBBox(); b.classList.add('bump'); }
function floatAt(id, txt, color = '#ffd24a') {
  const [x, y] = C.bpos[id] || T(id).c, t = document.createElementNS(NS, 'text'), k = C.k || 1;
  t.setAttribute('class', 'floaty'); t.setAttribute('transform', `translate(${x} ${y - 16 * k}) scale(${k})`); t.style.fill = color;
  t.textContent = txt; $('#fx').appendChild(t);
  t.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0', offset: .2 }, { opacity: 0, translate: `0 ${-26 * k}px` }], { duration: 1000, easing: 'ease-out' });
  setTimeout(() => t.remove(), 1000);
}
// il colore del vincitore si allarga a cerchio dal punto d'attacco, dentro i confini del territorio
async function flood(id, color, fromId) {
  const t = T(id), [x0, y0] = T(fromId)?.c || t.c;
  const g = document.createElementNS(NS, 'g'), cid = 'fl' + Math.random().toString(36).slice(2, 8);
  const far = Math.max(...t.d.match(/-?[\d.]+ -?[\d.]+/g).map(p => { const [x, y] = p.split(' ').map(Number); return Math.hypot(x - x0, y - y0); })) + 4;
  g.innerHTML = `<clipPath id="${cid}"><path d="${t.d}"/></clipPath><g clip-path="url(#${cid})"><circle class="f1" cx="${x0}" cy="${y0}" r="${far}" fill="#fff"/><circle class="f2" cx="${x0}" cy="${y0}" r="${far}" fill="${color}"/></g>`;
  $('#flood').appendChild(g);
  g.querySelectorAll('circle').forEach(c => Object.assign(c.style, { transformBox: 'fill-box', transformOrigin: 'center' }));
  const dur = spd(650), ease = 'cubic-bezier(.3,.7,.4,1)';
  g.querySelector('.f1').animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: dur * .7, easing: ease, fill: 'forwards' });
  g.querySelector('.f2').animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: dur, delay: 100, easing: ease, fill: 'both' });
  sfx('pop'); bump(id); await sleep(dur + 120);
  const land = $(`.land[data-t="${id}"]`); land.style.transition = 'none'; land.style.fill = color;
  setTimeout(() => { g.remove(); land.style.transition = ''; }, 60);
}
// i carrarmatini attraversano dalla partenza all'arrivo
async function march(a, b, color, n = 1) {
  const [x1, y1] = C.bpos[a] || T(a).c, [x2, y2] = C.bpos[b] || T(b).c, k = C.k || 1, many = Math.min(3, n);
  sfx('card');
  const anims = [];
  for (let i = 0; i < many; i++) {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<g transform="scale(${k}) translate(-11 -7)" fill="${color}" stroke="#15122b" stroke-width="1.6"><rect x="1" y="9" width="21" height="6" rx="3"/><rect x="4" y="4" width="13" height="6" rx="2"/><rect x="15" y="5.5" width="8" height="2.2" rx="1"/></g>`;
    $('#fx').appendChild(g);
    const an = g.animate([{ transform: `translate(${x1}px, ${y1}px)` }, { transform: `translate(${x2}px, ${y2}px)` }], { duration: spd(650), delay: i * spd(110), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    anims.push(an.finished.catch(() => {}).then(() => g.remove()));
    setTimeout(() => g.remove(), spd(650 + i * 110) + 200);
  }
  await Promise.race([Promise.all(anims), sleep(spd(900) + 200)]);
}
function shake() { $('#map').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(0,0)' }], { duration: 320 }); }
function bigText(txt) { const t = document.createElement('div'); t.className = 'toastbig'; t.textContent = txt; document.body.appendChild(t); setTimeout(() => t.remove(), 1700); }
async function intro(st) {
  let seen = false; try { seen = localStorage.conq_tuto === '1'; localStorage.conq_tuto = '1'; } catch (e) {}
  const go = () => {
    bigText(`${getMap(st.map).name}: si parte!`); sfx('win');
    if (st.missions) setTimeout(() => $('#goal').animate([{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 500, iterations: 3 }), 600);
    if (isMyTurn(st)) setTimeout(() => myTurnStarts(st), 1500);
  };
  if (!seen && myIdx(st) >= 0) tutorial(go); else go();
}
function showEnd(st) {
  const w = st.players[st.winner], won = w.id === me.id;
  confetti(160); setTimeout(() => confetti(120), 700); sfx(won ? 'win' : 'lose');
  const s = sheet(); s.onclick = null;
  s.box.innerHTML = `<div style="text-align:center;display:grid;gap:8px"><div style="font-size:64px">${won ? '🏆' : w.avatar || '🏳️'}</div><h3 style="font-size:34px">${won ? 'Hai conquistato!' : `Vince ${esc(w.name)}`}</h3>
    <div class="mission">${ic('target')}<span>${esc(missionText(st, st.missions?.[st.winner]))}</span></div></div>
    <div class="acts"><a class="btn" href="../">Menu</a>${room.isHost ? '<button class="btn primary again">Rivincita</button>' : ''}</div>`;
  const again = $('.again', s);
  if (again) again.onclick = () => { s.remove(); const settings = { map: st.map, bots: st.players.filter(p => p.bot).length, missions: st.missions ? 1 : 0 }; if (room.solo) hostStart(settings, [me.id]); else room.both('start', { settings, players: st.players.filter(p => !p.bot).map(p => p.id), seed: (Math.random() * 2 ** 31) | 0 }); };
}
