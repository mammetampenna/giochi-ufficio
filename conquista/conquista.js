// Conquista!: partita locale contro il computer o online dal vivo (l'host tiene la partita e muove i computer).
import { $, $$, esc, toast, avatarHTML, getProfile, mountTopbar, saveRoom, saveResult, findRoom, sfx, confetti, sleep, floatBackdrop } from '../shared/core.js';
import { mountLobby } from '../shared/lobby.js';
import { SQ3, neighbors, MAP_LIST } from './mappe.js';
import { newGame, apply, botMove, getMap, missionText, bestTrade, tradeValue, canAttackFrom, adj, COLORS, CARD } from './regole.js';
import { battle } from './dadi.js';

mountTopbar();
const BOTS = [['Generale Turi', '🤖'], ['Contessa Nina', '👵'], ['Zio Peppe', '🧔'], ['Ammiraglia Rosa', '🌹'], ['Cugino Tano', '🦊']];
let room = null, me = getProfile(), H = null; // H = stato completo sull'host
const C = { st: null, q: Promise.resolve(), sel: null, amount: 1, myBattle: null, view: null };
window.__conquista = { C, get H() { return H; } };
const TANK = `<svg viewBox="0 0 30 20"><rect x="1" y="12" width="28" height="7" rx="3.5"/><rect x="5" y="6" width="18" height="7" rx="2"/><rect x="19" y="7.5" width="10" height="2.5" rx="1"/></svg>`;
floatBackdrop(['🎲', '🎯', '🏰', '⚔️', '🪖', '🗺️'].map(e => `<span style="font-size:56px">${e}</span>`), 12);

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
  defaults: { map: 'mondo', bots: 1, missions: 1 },
  solo: { label: 'Gioca contro il computer', start: soloPicker },
  onJoin: r => { room = r; wire(r); if (r.row.status === 'playing') r.send('hello', {}); },
  onStart: (r, settings, players, d) => { room = r; showGame(); if (r.isHost) hostStart(settings, players, d?.seed); },
});
function wire(r) {
  r.on('st', d => enqueue(d));
  r.on('act', (d, from) => { if (r.isHost && H) hostAct(from, d); });
  r.on('hello', () => { if (r.isHost && H) r.send('st', { st: H, ev: { t: 'sync' } }); });
}
function soloPicker() {
  let map = 'mondo', bots = 2, missions = 1;
  const s = document.createElement('div'); s.className = 'sheet';
  const draw = () => {
    s.innerHTML = `<div class="box"><h3>Nuova partita</h3>
      <div class="mapopts">${MAP_LIST.map(m => `<button class="mapopt${m.id === map ? ' on' : ''}" data-m="${m.id}">${m.name}<small>${m.n} territori</small></button>`).join('')}</div>
      <div class="setting"><label>Avversari</label><div class="pills">${[1, 2, 3, 4, 5].map(v => `<button class="pill${v === bots ? ' on' : ''}" data-b="${v}">${v}</button>`).join('')}</div></div>
      <div class="setting"><label>Obiettivo</label><div class="pills"><button class="pill${missions ? ' on' : ''}" data-o="1">Obiettivi segreti</button><button class="pill${missions ? '' : ' on'}" data-o="0">Conquista totale</button></div></div>
      <button class="btn primary go">Alla conquista</button></div>`;
    $$('[data-m]', s).forEach(b => b.onclick = () => { map = b.dataset.m; draw(); });
    $$('[data-b]', s).forEach(b => b.onclick = () => { bots = +b.dataset.b; draw(); });
    $$('[data-o]', s).forEach(b => b.onclick = () => { missions = +b.dataset.o; draw(); });
    $('.go', s).onclick = () => { s.remove(); startSolo(map, bots, missions); };
  };
  draw(); document.body.appendChild(s);
  s.onclick = e => { if (e.target === s) s.remove(); };
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
  room.both('st', { st: H, ev });
  if (!room.solo) { clearTimeout(saveT); saveT = setTimeout(() => saveRoom(room.code, { state: H }), 1500); }
  scheduleBot();
}
function hostAct(id, a) {
  if (!H || H.winner != null) return;
  if (H.players[H.turn].id !== id) return;
  const r = apply(H, a);
  if (!r.ok) { if (id === me.id) toast(r.msg || 'Mossa non valida'); return; }
  push(r.ev);
  if (H.winner != null && !room.solo) { saveRoom(room.code, { status: 'finished' }); saveResult('conquista', room.code, H.players.map(p => ({ id: p.id, name: p.name })), H.players[H.winner].name); }
}
// i computer muovono quando le animazioni sono finite
let botBusy = false;
function scheduleBot() {
  if (botBusy || !H || H.winner != null || !H.players[H.turn].bot) return;
  botBusy = true;
  C.q.then(() => sleep(H.phase === 'reinforce' ? 500 : 350)).then(() => {
    botBusy = false;
    if (!H || H.winner != null || !H.players[H.turn].bot) return;
    hostAct(H.players[H.turn].id, botMove(H));
  });
}

/* ================= CLIENT ================= */
function enqueue(d) { C.q = C.q.then(() => handle(d)).catch(e => console.error(e)); }
function act(a) { if (room.isHost) hostAct(me.id, a); else room.send('act', a); }
const myIdx = (st = C.st) => st.players.findIndex(p => p.id === me.id);
const isMyTurn = (st = C.st) => st && st.winner == null && st.players[st.turn].id === me.id;

async function handle({ st, ev }) {
  const prev = C.st; C.st = st;
  if (!prev || ev.t === 'start' || ev.t === 'sync' || prev.map !== st.map) { buildMap(st); render(st); if (ev.t === 'start') await intro(st); return; }
  // animazioni dell'evento, poi ridisegno
  if (ev.t === 'battle') {
    if (C.myBattle && ev.p === myIdx(st)) C.myBattle(ev);
    else await watchBattle(prev, ev);
  }
  render(st, ev);
  if (ev.t === 'place') { bump(ev.terr); floatAt(ev.terr, '+' + ev.n); sfx('pop'); await sleep(st.players[ev.p].bot ? 160 : 0); }
  if (ev.t === 'battle' && ev.conquered) { await flood(ev.to, st.players[ev.p].color, ev.from); if (ev.p === myIdx(st)) bigText('Conquistato!'); }
  if (ev.eliminated != null) { bigText(`${st.players[ev.eliminated].name} è fuori`); sfx('lose'); await sleep(900); }
  if (ev.t === 'move' || ev.t === 'fortify') { await march(ev.from, ev.to, st.players[ev.p].color); bump(ev.to); }
  if (ev.t === 'trade') { bigText(`+${ev.v} armate`); sfx('win'); }
  if (ev.t === 'endTurn' || ev.t === 'fortify') {
    if (ev.card && ev.p === myIdx(st)) toast(`Hai pescato una carta: ${CARD[ev.card.k]}`);
    if (isMyTurn(st)) { bigText('Tocca a te!'); sfx('win'); try { navigator.vibrate?.([40, 60, 40]); } catch (e) {} }
  }
  if (ev.win != null || (st.winner != null && prev.winner == null)) showEnd(st);
  // dopo una conquista mia: quante armate sposto
  if (st.pending && isMyTurn(st)) askMove(st);
}

/* ---------- mappa ---------- */
const R = 12;
const cellXY = (c, r) => [R * SQ3 * (c + .5 * (r & 1)) + R, R * 1.5 * r + R];
const corner = (x, y, i) => { const a = (-90 + 60 * i) * Math.PI / 180; return [x + R * Math.cos(a), y + R * Math.sin(a)]; };
let M = null, centers = {};
function buildMap(st) {
  M = getMap(st.map);
  const svg = $('#map'), W = M.cols * R * SQ3 + R * 2, Hh = M.rows * R * 1.5 + R * 2;
  let cells = '', borders = '', coast = '', links = '', badges = '';
  for (const t of M.terr) {
    let sx = 0, sy = 0;
    const polys = t.cells.map(([c, r]) => {
      const [x, y] = cellXY(c, r); sx += x; sy += y;
      // lati: bordo tra territori diversi o costa verso il mare
      neighbors(c, r); const nb = neighbors(c, r), ORDER = [5, 0, 1, 2, 3, 4];
      for (let s = 0; s < 6; s++) {
        const [nc, nr] = nb[ORDER[s]], o = M.grid[nc + ',' + nr];
        if (o === t.id) continue;
        const [x1, y1] = corner(x, y, s), [x2, y2] = corner(x, y, s + 1), seg = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
        if (!o) coast += seg; else if (o > t.id) borders += seg;
      }
      return `<polygon class="cell" points="${Array.from({ length: 6 }, (_, i) => corner(x, y, i).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
    }).join('');
    const cx = sx / t.cells.length, cy = sy / t.cells.length;
    // il distintivo va sulla cella più vicina al centro
    const best = t.cells.map(([c, r]) => cellXY(c, r)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
    centers[t.id] = best;
    cells += `<g class="terr" data-t="${t.id}">${polys}</g>`;
    badges += `<g class="badge" data-b="${t.id}" transform="translate(${best[0].toFixed(1)} ${best[1].toFixed(1)})"><g class="bi"><circle r="9"/><text>0</text></g></g><text class="tname" x="${best[0].toFixed(1)}" y="${(best[1] + 17).toFixed(1)}">${esc(t.name)}</text>`;
  }
  M.links.forEach(([a, b]) => { const [x1, y1] = centers[a], [x2, y2] = centers[b]; links += `<path class="link" d="M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - 20} ${x2} ${y2}"/>`; });
  svg.innerHTML = `<rect class="sea" x="-2000" y="-2000" width="${W + 4000}" height="${Hh + 4000}"/>
    <defs><pattern id="waves" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q6 0 12 6 T24 6" fill="none" stroke="rgba(120,160,255,.08)" stroke-width="1.2"/></pattern></defs>
    <rect x="-2000" y="-2000" width="${W + 4000}" height="${Hh + 4000}" fill="url(#waves)"/>
    ${links}${cells}<path class="tborder" d="${borders}"/><path class="coast" d="${coast}"/><g id="badges">${badges}</g><g id="fx"></g>`;
  C.full = { x: 0, y: 0, w: W, h: Hh };
  fit();
  $$('.terr', svg).forEach(g => g.addEventListener('click', e => { if (!C.dragged) tapTerr(g.dataset.t); }));
}
function fit() {
  const svg = $('#map'), r = svg.getBoundingClientRect(), f = C.full;
  // lascio spazio per la barra in alto e il pannello in basso
  const padTop = 100, padBot = 150, vw = r.width, vh = Math.max(200, r.height - padTop - padBot);
  // in verticale (telefono) la mappa parte più grande: si esplora trascinando
  const s = vw < vh ? Math.min(vh / f.h * .85, vw / f.w * 2.1) : Math.min(vw / f.w, vh / f.h);
  const w = r.width / s, h = r.height / s;
  C.view = { x: f.x - (w - f.w) / 2, y: f.y - padTop / s - (vh / s - f.h) / 2, w, h };
  setView();
}
function setView() { const v = C.view; $('#map').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }
$('#fitBtn').onclick = () => fit();
addEventListener('resize', () => C.full && fit());

// trascinare con un dito, avvicinare con due, rotellina
(() => {
  const svg = $('#map'), pts = new Map(); let start = null;
  const toSvg = (x, y) => { const r = svg.getBoundingClientRect(), v = C.view; return [v.x + (x - r.left) / r.width * v.w, v.y + (y - r.top) / r.height * v.h]; };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); C.dragged = false; start = { v: { ...C.view }, p: [...pts.values()].map(p => [...p]) }; });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect(), ps = [...pts.values()];
    if (ps.length === 1 && start.p.length === 1) {
      const dx = ps[0][0] - start.p[0][0], dy = ps[0][1] - start.p[0][1];
      if (Math.hypot(dx, dy) > 6) { C.dragged = true; svg.classList.add('drag'); }
      C.view = { ...start.v, x: start.v.x - dx / r.width * start.v.w, y: start.v.y - dy / r.height * start.v.h }; setView();
    } else if (ps.length === 2 && start.p.length === 2) {
      C.dragged = true;
      const d0 = Math.hypot(start.p[0][0] - start.p[1][0], start.p[0][1] - start.p[1][1]), d1 = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      const k = Math.max(.25, Math.min(4, d0 / d1)), mx = (start.p[0][0] + start.p[1][0]) / 2, my = (start.p[0][1] + start.p[1][1]) / 2;
      const fx = start.v.x + (mx - r.left) / r.width * start.v.w, fy = start.v.y + (my - r.top) / r.height * start.v.h;
      const w = Math.max(80, Math.min(C.full.w * 2.5, start.v.w * k)), h = w * start.v.h / start.v.w;
      C.view = { x: fx - (fx - start.v.x) * w / start.v.w, y: fy - (fy - start.v.y) * h / start.v.h, w, h }; setView();
    }
  });
  const up = e => { pts.delete(e.pointerId); svg.classList.remove('drag'); start = { v: { ...C.view }, p: [...pts.values()].map(p => [...p]) }; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault(); const [fx, fy] = toSvg(e.clientX, e.clientY), k = Math.exp(e.deltaY * .0015), v = C.view;
    const w = Math.max(80, Math.min(C.full.w * 2.5, v.w * k)), h = w * v.h / v.w;
    C.view = { x: fx - (fx - v.x) * w / v.w, y: fy - (fy - v.y) * h / v.h, w, h }; setView();
  }, { passive: false });
})();

/* ---------- disegno dello stato ---------- */
function render(st) {
  const pl = st.players;
  for (const t of M.terr) {
    const g = $(`.terr[data-t="${t.id}"]`), col = pl[st.owner[t.id]].color;
    g.querySelectorAll('.cell').forEach((c, i) => { c.style.fill = shade(col, ((i * 37) % 9) / 60 - .07); c.style.stroke = shade(col, -.15); });
    const b = $(`[data-b="${t.id}"]`);
    b.querySelector('circle').style.fill = shade(col, -.35); b.querySelector('text').textContent = st.armies[t.id];
    g.classList.toggle('sel', C.sel === t.id);
  }
  highlight(st);
  $('#players').innerHTML = pl.map((p, i) => `<div class="pp${i === st.turn ? ' turn' : ''}${p.alive ? '' : ' dead'}" style="--pc:${p.color}"><span class="dot" style="background:${p.color}">${p.avatar || ''}</span>${esc(p.name)}<small>${M.terr.filter(t => st.owner[t.id] === i).length}</small></div>`).join('');
  panel(st);
}
function highlight(st) {
  const mine = isMyTurn(st);
  $$('.terr').forEach(g => g.classList.remove('target', 'dim'));
  if (!mine) return;
  if (st.phase === 'attack' && C.sel) M.terr.find(t => t.id === C.sel).adj.filter(a => st.owner[a] !== st.turn).forEach(a => $(`.terr[data-t="${a}"]`).classList.add('target'));
  if (st.phase === 'fortify' && C.sel) M.terr.find(t => t.id === C.sel).adj.filter(a => st.owner[a] === st.turn).forEach(a => $(`.terr[data-t="${a}"]`).classList.add('target'));
  if (st.phase === 'reinforce') M.terr.filter(t => st.owner[t.id] !== st.turn).forEach(t => $(`.terr[data-t="${t.id}"]`).classList.add('dim'));
}
function panel(st) {
  const p = st.players[st.turn], el = $('#panel');
  if (st.winner != null) { el.innerHTML = `<div class="msg">Ha vinto ${esc(st.players[st.winner].name)}</div>`; return; }
  if (!isMyTurn(st)) { el.innerHTML = `<div class="msg"><span class="dot" style="width:14px;height:14px;border-radius:50%;background:${p.color};display:inline-block"></span>Tocca a ${esc(p.name)} · ${phaseName(st.phase)}</div>`; return; }
  const cards = st.cards[st.turn].length, tr = bestTrade(st.cards[st.turn]);
  if (st.phase === 'reinforce') {
    el.innerHTML = `<div class="msg"><span class="big">${st.reinf}</span><span>armate da piazzare: tocca i tuoi territori</span></div>
      <div class="acts"><div class="chips">${[1, 3, 'tutte'].map(v => `<button data-a="${v}" class="${C.amount == v ? 'on' : ''}">${v === 'tutte' ? 'Tutte' : '+' + v}</button>`).join('')}</div>
      ${tr ? `<button class="btn small trade">Gioca carte (+${tr.v})</button>` : ''}${st.reinf === 0 ? '<button class="btn small" disabled>Prima gioca le carte</button>' : ''}</div>`;
    $$('[data-a]', el).forEach(b => b.onclick = () => { C.amount = b.dataset.a; panel(st); });
    el.querySelector('.trade')?.addEventListener('click', () => openCards(st));
  } else if (st.phase === 'attack') {
    el.innerHTML = `<div class="msg"><span>${C.sel ? `Da <b>${esc(tname(C.sel))}</b>: tocca un nemico lampeggiante` : 'Attacco: tocca un tuo territorio con almeno 2 armate'}</span></div>
      <div class="acts"><button class="btn endatk">Basta attacchi</button></div>`;
    $('.endatk', el).onclick = () => { C.sel = null; act({ t: 'endAttack' }); };
  } else if (st.phase === 'fortify') {
    el.innerHTML = `<div class="msg"><span>${C.sel ? `Sposta da <b>${esc(tname(C.sel))}</b>: tocca un tuo territorio vicino` : 'Spostamento: puoi spostare armate una volta, oppure finire il turno'}</span></div>
      <div class="acts"><button class="btn primary endturn">Fine turno</button></div>`;
    $('.endturn', el).onclick = () => { C.sel = null; act({ t: 'endTurn' }); };
  }
}
const phaseName = ph => ({ reinforce: 'rinforzi', attack: 'attacco', fortify: 'spostamento' }[ph] || '');
const tname = id => M.terr.find(t => t.id === id).name;

/* ---------- tocchi sulla mappa ---------- */
async function tapTerr(id) {
  const st = C.st; if (!isMyTurn(st) || st.pending) return;
  const mine = st.owner[id] === st.turn;
  if (st.phase === 'reinforce') {
    if (!mine) return;
    act({ t: 'place', terr: id, n: C.amount === 'tutte' ? st.reinf : +C.amount }); return;
  }
  if (st.phase === 'attack') {
    if (mine) { C.sel = canAttackFrom(st, id) ? id : null; if (!C.sel) toast('Da qui non puoi attaccare'); sfx('click'); render(st); return; }
    if (C.sel && adj(st, C.sel, id)) return myAttack(C.sel, id);
    return;
  }
  if (st.phase === 'fortify') {
    if (!mine) return;
    if (C.sel && C.sel !== id && adj(st, C.sel, id) && st.armies[C.sel] > 1) return askFortify(C.sel, id);
    C.sel = st.armies[id] > 1 ? id : null; sfx('click'); render(st);
  }
}
// la mia battaglia: il bicchiere è mio, i risultati li decide l'host
async function myAttack(from, to) {
  const st = C.st, p = st.players[st.turn], d = st.players[st.owner[to]];
  const res = await battle({
    att: { name: p.name, color: p.color, terr: tname(from), armies: st.armies[from] },
    def: { name: d.name, color: d.color, terr: tname(to), armies: st.armies[to] },
    resolve: n => new Promise(r => { C.myBattle = ev => { C.myBattle = null; r(ev); }; act({ t: 'attack', from, to, dice: n }); }),
  });
  if (!res.conquered) { C.sel = from; render(C.st); }
}
// le battaglie degli altri si guardano in versione veloce
async function watchBattle(prev, ev) {
  const a = prev.players[ev.p], d = prev.players[ev.dp];
  await battle({ auto: true, fast: true, again: async () => false,
    att: { name: a.name, color: a.color, terr: tname(ev.from), armies: prev.armies[ev.from] },
    def: { name: d.name, color: d.color, terr: tname(ev.to), armies: prev.armies[ev.to] },
    resolve: async () => ev });
}
function askMove(st) {
  const pd = st.pending; if ($('.sheet')) return;
  if (pd.max <= pd.min) { act({ t: 'move', n: pd.min }); return; }
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="box"><h3>Quante armate entrano in ${esc(tname(pd.to))}?</h3>
    <input type="range" class="slider" min="${pd.min}" max="${pd.max}" value="${pd.max}"><div class="msg" style="font:800 28px var(--font);text-align:center"><span class="v">${pd.max}</span></div>
    <button class="btn primary ok">Avanti</button></div>`;
  document.body.appendChild(s);
  const sl = $('.slider', s); sl.oninput = () => $('.v', s).textContent = sl.value;
  $('.ok', s).onclick = () => { s.remove(); C.sel = pd.to; act({ t: 'move', n: +sl.value }); };
}
function askFortify(from, to) {
  const st = C.st, max = st.armies[from] - 1;
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="box"><h3>Sposta da ${esc(tname(from))} a ${esc(tname(to))}</h3>
    <input type="range" class="slider" min="1" max="${max}" value="${max}"><div class="msg" style="font:800 28px var(--font);text-align:center"><span class="v">${max}</span></div>
    <div class="acts" style="display:flex;gap:8px"><button class="btn x" style="flex:1">Annulla</button><button class="btn primary ok" style="flex:2">Sposta e finisci il turno</button></div></div>`;
  document.body.appendChild(s);
  const sl = $('.slider', s); sl.oninput = () => $('.v', s).textContent = sl.value;
  $('.x', s).onclick = () => s.remove();
  $('.ok', s).onclick = () => { s.remove(); C.sel = null; act({ t: 'fortify', from, to, n: +sl.value }); };
}
function openCards(st = C.st) {
  const i = myIdx(st); if (i < 0) return;
  const hand = st.cards[i], picked = new Set(), ICON = { carro: '🪖', aereo: '✈️', nave: '🚢', jolly: '⭐' };
  const s = document.createElement('div'); s.className = 'sheet';
  const draw = () => {
    const v = picked.size === 3 ? tradeValue([...picked].map(k => hand[k])) : 0, can = isMyTurn(st) && st.phase === 'reinforce';
    s.innerHTML = `<div class="box"><h3>Le tue carte</h3>
      ${hand.length ? `<div class="cardsrow">${hand.map((c, k) => `<button class="gcard${picked.has(k) ? ' on' : ''}" data-k="${k}"><span class="ic">${ICON[c.k]}</span>${CARD[c.k]}<small>${c.t ? esc(tname(c.t)) : ''}</small></button>`).join('')}</div>` : '<p class="hint">Nessuna carta: conquista almeno un territorio nel tuo turno per pescarne una.</p>'}
      <p class="hint">Tris: 3 carri = 4, 3 aerei = 6, 3 navi = 8, uno per tipo = 10, jolly + 2 uguali = 12 (+2 se possiedi un territorio della carta).</p>
      <div style="display:flex;gap:8px"><button class="btn x" style="flex:1">Chiudi</button>${can ? `<button class="btn primary ok" style="flex:2" ${v ? '' : 'disabled'}>Gioca${v ? ' (+' + v + ')' : ''}</button>` : ''}</div></div>`;
    $$('[data-k]', s).forEach(b => b.onclick = () => { const k = +b.dataset.k; picked.has(k) ? picked.delete(k) : picked.size < 3 && picked.add(k); draw(); });
    $('.x', s).onclick = () => s.remove();
    const ok = $('.ok', s); if (ok) ok.onclick = () => { s.remove(); act({ t: 'trade', idx: [...picked] }); };
  };
  const tr = bestTrade(hand); if (tr) tr.idx.forEach(k => picked.add(k));
  draw(); document.body.appendChild(s);
}
$('#cardsBtn').onclick = () => C.st && openCards();
$('#missionBtn').onclick = () => {
  const st = C.st; if (!st) return; const i = myIdx(st);
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="box"><h3>Il tuo obiettivo segreto</h3><div class="mission">${esc(i < 0 ? 'Stai guardando la partita' : missionText(st, st.missions?.[i]))}</div><button class="btn x">Chiudi</button></div>`;
  document.body.appendChild(s); $('.x', s).onclick = () => s.remove(); s.onclick = e => { if (e.target === s) s.remove(); };
};

/* ---------- effetti sulla mappa ---------- */
function bump(id) { const b = $(`[data-b="${id}"] .bi`); if (!b) return; b.classList.remove('bump'); void b.getBBox(); b.classList.add('bump'); }
function floatAt(id, txt) {
  const [x, y] = centers[id], t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x); t.setAttribute('y', y - 12); t.setAttribute('class', 'tname'); t.style.cssText = 'font-size:12px;font-weight:800;fill:#ffc53d';
  t.textContent = txt; $('#fx').appendChild(t);
  t.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-18px)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).finished.then(() => t.remove(), () => t.remove());
  setTimeout(() => t.remove(), 1200);
}
// il colore del vincitore si allarga cella per cella dal punto d'attacco
async function flood(id, color, fromId) {
  const g = $(`.terr[data-t="${id}"]`), t = M.terr.find(x => x.id === id), [ox, oy] = centers[fromId];
  const cs = [...g.querySelectorAll('.cell')];
  cs.forEach((c, i) => { const [x, y] = cellXY(...t.cells[i]); const d = Math.hypot(x - ox, y - oy); c.style.transition = 'none'; c.style.fill = '#fff';
    setTimeout(() => { c.style.transition = 'fill .45s ease'; c.style.fill = shade(color, ((i * 37) % 9) / 60 - .07); }, d * 4); });
  sfx('pop'); await sleep(450);
}
// un carrarmatino attraversa dalla partenza all'arrivo
async function march(a, b, color) {
  const [x1, y1] = centers[a], [x2, y2] = centers[b], g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = `<g transform="translate(-9 -6) scale(.6)" fill="${color}" stroke="#fff" stroke-width="1.5">${TANK.replace(/<\/?svg[^>]*>/g, '')}</g>`;
  $('#fx').appendChild(g); sfx('card');
  const anim = g.animate([{ transform: `translate(${x1}px, ${y1}px)` }, { transform: `translate(${x2}px, ${y2}px)` }], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' });
  await Promise.race([anim.finished.catch(() => {}), sleep(800)]); g.remove();
}
function bigText(txt) { const t = document.createElement('div'); t.className = 'toastbig'; t.textContent = txt; document.body.appendChild(t); setTimeout(() => t.remove(), 1700); }
async function intro(st) {
  bigText(`${getMap(st.map).name}: si parte`); sfx('win');
  if (isMyTurn(st)) setTimeout(() => { bigText('Tocca a te!'); }, 1400);
  if (st.missions) setTimeout(() => $('#missionBtn').animate([{ transform: 'scale(1.6) rotate(-10deg)' }, { transform: 'none' }], { duration: 800, iterations: 2 }), 600);
}
function showEnd(st) {
  const w = st.players[st.winner], won = w.id === me.id;
  confetti(160); setTimeout(() => confetti(120), 700); sfx(won ? 'win' : 'lose');
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="box" style="text-align:center"><div style="font-size:60px">🏆</div><h3 style="font-size:34px">${won ? 'Hai conquistato!' : `Vince ${esc(w.name)}`}</h3>
    <div class="mission">${esc(missionText(st, st.missions?.[st.winner]))}</div>
    <div style="display:flex;gap:8px"><a class="btn" style="flex:1" href="../">Menu</a>${room.isHost ? '<button class="btn primary again" style="flex:2">Rivincita</button>' : ''}</div></div>`;
  document.body.appendChild(s);
  const again = $('.again', s);
  if (again) again.onclick = () => { s.remove(); if (room.solo) { hostStart({ map: st.map, bots: st.players.filter(p => p.bot).length, missions: st.missions ? 1 : 0 }, [me.id]); } else room.both('start', { settings: { map: st.map, bots: st.players.filter(p => p.bot).length, missions: st.missions ? 1 : 0 }, players: st.players.filter(p => !p.bot).map(p => p.id), seed: (Math.random() * 2 ** 31) | 0 }); };
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
