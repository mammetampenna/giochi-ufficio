// Morra calabrese online: ognuno butta 1–5 dita e chiama un numero 2–10; chi indovina la somma fa punto.
import { $, $$, esc, toast, avatarHTML, getProfile, mountTopbar, saveRoom, saveResult, sha, sfx, confetti, sleep } from '../shared/core.js';
import { mountLobby } from '../shared/lobby.js';

const DIALETTO = { 2: 'Dui!', 3: 'Tri!', 4: 'Quattru!', 5: 'Cincu!', 6: 'Sei!', 7: 'Setti!', 8: 'Ottu!', 9: 'Novi!', 10: 'Tutta!' };
const PAROLA = { 2: 'due', 3: 'tre', 4: 'quattro', 5: 'cinque', 6: 'sei', 7: 'sette', 8: 'otto', 9: 'nove', 10: 'tutta' };
const BOT = { id: 'bot', name: 'Compare Turi', avatar: '🤖', color: '#3fd6c6' };

mountTopbar();

/* ---------- mano in SVG (punta verso l'alto, il pollice è a sinistra) ---------- */
const HAND = color => `<svg class="hand" viewBox="0 0 200 280">
  <rect x="52" y="214" width="96" height="74" rx="12" fill="${color}" stroke="#3a2440" stroke-width="5"/>
  <rect x="52" y="214" width="96" height="16" rx="6" fill="rgba(255,255,255,.35)"/>
  <g class="fg f1"><rect class="sk" x="53" y="44" width="23" height="104" rx="11.5"/></g>
  <g class="fg f2"><rect class="sk" x="78" y="32" width="23" height="116" rx="11.5"/></g>
  <g class="fg f3"><rect class="sk" x="103" y="42" width="23" height="106" rx="11.5"/></g>
  <g class="fg f4"><rect class="sk" x="127" y="64" width="21" height="84" rx="10.5"/></g>
  <rect class="sk" x="48" y="116" width="104" height="112" rx="36"/>
  <path d="M72 128 q8 6 16 0 M97 128 q8 6 16 0 M121 128 q7 5 14 0" fill="none" stroke="#c98f6a" stroke-width="3" stroke-linecap="round"/>
  <g class="th"><rect class="sk" x="30" y="118" width="28" height="78" rx="14"/></g>
</svg>`;
function setFingers(side, n) {
  const order = ['.f1', '.f2', '.f3', '.f4', '.th'];
  order.forEach((s, i) => $(s, side).classList.toggle('up', i < n));
}

/* ---------- stato ---------- */
let room = null, me = getProfile(), soundOn = true;
const G = { players: [], info: {}, scores: {}, n: 0, T: 5, target: 11, phase: 'idle', pick: { f: null, c: null }, salt: '', commits: {}, reveals: {}, timer: null, lastMsg: 0, over: false };
const L = $('#sideL'), R = $('#sideR');
window.__morra = G; // per i test

try { soundOn = localStorage.getItem('morra_sound') !== '0'; } catch (e) {}
const sb = $('#sound'); sb.textContent = soundOn ? '🔊' : '🔇';
sb.onclick = () => { soundOn = !soundOn; sb.textContent = soundOn ? '🔊' : '🔇'; try { localStorage.setItem('morra_sound', soundOn ? '1' : '0'); } catch (e) {} };
const play = k => soundOn && sfx(k);
function say(text, pitch = 1) {
  if (!soundOn || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; u.rate = 1.25; u.pitch = pitch;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('it')); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ---------- lobby ---------- */
const lobby = mountLobby($('#lobby'), {
  game: 'morra', title: 'Morra calabrese', subtitle: 'Uno contro uno. Butta da 1 a 5 dita e chiama la somma: chi indovina fa punto.',
  min: 2, max: 2,
  settings: [
    { key: 'target', label: 'Si vince a', options: [5, 11, 16, 21].map(v => ({ v, l: v + ' punti' })) },
    { key: 'speed', label: 'Velocità', options: [{ v: 3, l: 'Lampo · 3 s' }, { v: 5, l: 'Normale · 5 s' }, { v: 8, l: 'Calma · 8 s' }] },
  ],
  defaults: { target: 11, speed: 5 },
  solo: { label: 'Gioca contro il computer', start: startSolo },
  onJoin: r => {
    room = r; wire(r);
    // se la partita è già in corso chiedo lo stato all'host (rientro o spettatore)
    if (r.row.status === 'playing') r.send('hello', {});
  },
  onStart: (r, settings, players) => { room = r; begin(settings, players, r.members); },
});

function wire(r) {
  r.on('round', d => onRound(d));
  r.on('commit', (d, from) => { if (d.n === G.n && (G.phase === 'pick' || (G.phase === 'lock' && performance.now() < G.deadline + 400))) { G.commits[from] = d.h; status(from, 'ha buttato ✓', true); } });
  r.on('reveal', (d, from) => onReveal(d, from));
  r.on('over', d => onOver(d));
  r.on('hello', () => { if (r.isHost && G.players.length) r.send('state', snapshot()); });
  r.on('state', d => { if (!G.players.length) { r.started = true; Object.assign(G, { info: d.info, scores: d.scores, n: d.n }); begin(d.settings, d.players, null, true); } });
  r.on('members', () => checkPresence());
}
function snapshot() { return { players: G.players, info: G.info, scores: G.scores, n: G.n, settings: { target: G.target, speed: G.T } }; }

/* ---------- partita contro il computer: una "stanza" finta tutta locale ---------- */
function startSolo() {
  const h = {}; me = getProfile();
  room = {
    solo: true, me, code: null, members: [me, BOT], isHost: true, hostId: me.id,
    on(t, f) { (h[t] ||= []).push(f); return this; }, emit(t, d, f) { (h[t] || []).forEach(x => x(d, f ?? me.id)); },
    send() {}, both(t, d) { this.emit(t, d, me.id); }, member(id) { return id === BOT.id ? BOT : me; },
  };
  wire(room);
  room.on('start', d => begin(d.settings, d.players, room.members));
  room.both('start', { settings: { target: 11, speed: 5 }, players: [me.id, BOT.id] });
}

/* ---------- inizio partita ---------- */
function begin(settings, players, members, resume) {
  me = getProfile(); G.lastMsg = performance.now() + 2000;
  G.players = players; G.target = settings.target; G.T = settings.speed; G.over = false;
  if (members) members.forEach(m => { if (players.includes(m.id)) G.info[m.id] = { id: m.id, name: m.name, avatar: m.avatar, color: m.color }; });
  if (!resume) { G.scores = Object.fromEntries(players.map(p => [p, 0])); G.n = 0; }
  $('#lobby').classList.add('hidden'); $('#game').classList.remove('hidden'); $('#sound').classList.remove('hidden');
  $('.overlay')?.remove(); $('#history').innerHTML = '';
  // a sinistra ci sono io (o il primo giocatore se sto guardando)
  const mine = players.includes(me.id);
  G.left = mine ? me.id : players[0]; G.right = players.find(p => p !== G.left);
  G.spectator = !mine;
  $('.hand-wrap', L).innerHTML = HAND(G.info[G.left]?.color || '#7b6cff');
  $('.hand-wrap', R).innerHTML = HAND(G.info[G.right]?.color || '#3fd6c6');
  setFingers(L, 0); setFingers(R, 0);
  buildControls(); drawScore();
  $('#controls').classList.toggle('hidden', G.spectator);
  if (resume) { G.phase = 'idle'; G.lastMsg = performance.now(); watchdog(); return; }
  intro().then(() => { if (room.isHost) nextRound(); });
  watchdog();
}
async function intro() {
  const o = document.createElement('div'); o.className = 'overlay'; o.style.background = 'transparent'; o.style.backdropFilter = 'none';
  o.innerHTML = '<div class="intro">Pronti?</div>'; document.body.appendChild(o); play('pop');
  await sleep(1100); o.remove();
}

function drawScore() {
  const pl = (id, el) => {
    const p = G.info[id] || { name: '?', avatar: '❔', color: '#888' }, s = G.scores[id] || 0;
    el.innerHTML = `${avatarHTML(p)}<div class="info"><div class="name">${esc(p.name)}${id === me.id ? ' (tu)' : ''}</div><div class="status"></div><div class="bar"><i style="width:${Math.min(100, s / G.target * 100)}%"></i></div></div><div class="pts">${s}</div>`;
  };
  pl(G.left, $('#plL')); pl(G.right, $('#plR'));
  $('#roundinfo').innerHTML = `<b>${G.n ? 'Mano ' + G.n : 'Si comincia'}</b>a ${G.target} punti`;
}
function status(id, txt, ok) {
  const el = id === G.left ? $('#plL .status') : id === G.right ? $('#plR .status') : null;
  if (el) { el.textContent = txt; el.classList.toggle('ready', !!ok); }
}

/* ---------- comandi ---------- */
function buildControls() {
  $('#optF').innerHTML = [1, 2, 3, 4, 5].map(n => `<button class="opt" data-f="${n}">${n}<span class="dots">${'●'.repeat(n)}</span></button>`).join('');
  $('#optC').innerHTML = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="opt" data-c="${n}">${n}</button>`).join('');
  $$('#optF .opt').forEach(b => b.onclick = () => choose('f', +b.dataset.f));
  $$('#optC .opt').forEach(b => b.onclick = () => choose('c', +b.dataset.c));
}
function drawPick() {
  const { f, c } = G.pick;
  $$('#optF .opt').forEach(b => b.classList.toggle('on', +b.dataset.f === f));
  // i numeri impossibili con le mie dita vengono sbiaditi (ma restano cliccabili)
  $$('#optC .opt').forEach(b => { const v = +b.dataset.c; b.classList.toggle('on', v === c); b.classList.toggle('dim', !!f && (v < f + 1 || v > f + 5)); });
  if (!G.spectator) setFingers(L, 0);
}
async function choose(k, v) {
  if (G.phase !== 'pick' || G.spectator) return;
  G.pick[k] = v; play('click'); drawPick();
  if (G.pick.f) {
    // gli hash si calcolano in modo asincrono: invio solo quello della scelta più recente
    const ver = G.ver = (G.ver || 0) + 1, n = G.n;
    const h = await sha([n, G.pick.f, G.pick.c, G.salt].join('|'));
    if (ver !== G.ver || n !== G.n) return;
    room.send('commit', { n, h });
    status(me.id, G.pick.c ? `${G.pick.f} dita · chiami ${G.pick.c}` : `${G.pick.f} dita · scegli il numero`, !!G.pick.c);
  }
}
document.addEventListener('keydown', e => {
  if (G.phase !== 'pick' || G.spectator || e.target.matches('input')) return;
  if (e.key === 'Backspace') { G.pick = { f: null, c: null }; drawPick(); status(me.id, ''); return; }
  if (!/^[0-9]$/.test(e.key)) return;
  const d = +e.key;
  if (!G.pick.f && d >= 1 && d <= 5) choose('f', d);
  else if (G.pick.f) { const c = d === 0 ? 10 : d; if (c >= 2) choose('c', c); }
});

/* ---------- svolgimento di una mano ---------- */
function nextRound() {
  room.both('round', { n: G.n + 1, scores: G.scores, T: G.T });
}
function onRound(d) {
  G.lastMsg = performance.now();
  if (G.over) return;
  G.n = d.n; G.scores = d.scores; G.T = d.T;
  G.phase = 'pick'; G.pick = { f: null, c: null }; G.commits = {}; G.reveals = {};
  G.salt = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16)).join('');
  drawScore(); drawPick();
  status(G.left, 'sta pensando…'); status(G.right, 'sta pensando…');
  [L, R].forEach(s => { s.classList.remove('winner', 'thrown'); s.classList.add('pumping'); $('.bubble', s).className = 'bubble'; setFingers(s, 0); });
  $('#sum').innerHTML = ''; $('#verdict').textContent = '';
  $('#controls').classList.remove('off');
  // conto alla rovescia: la mano batte una volta al secondo
  const start = performance.now(); G.deadline = start + G.T * 1000;
  document.documentElement.style.setProperty('--beat', '1s');
  const span = $('#count span'), ring = $('#count .fg');
  let last = -1;
  clearInterval(G.timer);
  G.timer = setInterval(() => {
    const left = Math.max(0, G.deadline - performance.now()), s = Math.ceil(left / 1000);
    ring.style.strokeDashoffset = 402 * (1 - left / (G.T * 1000));
    if (s !== last) { last = s; span.textContent = s || '!'; span.classList.remove('tick'); void span.offsetWidth; span.classList.add('tick'); play(s ? 'thump' : 'pop'); }
    if (left <= 0) { clearInterval(G.timer); lock(); }
  }, 40);
}
async function lock() {
  G.phase = 'lock';
  $('#controls').classList.add('off');
  await sleep(450); // margine perché arrivino le ultime "buste chiuse"
  if (G.spectator) return;
  room.both('reveal', { n: G.n, f: G.pick.f, c: G.pick.c, salt: G.salt });
  if (room.solo) {
    const f = 1 + Math.random() * 5 | 0, c = Math.min(10, f + 1 + (Math.random() * 5 | 0));
    await sleep(80); room.emit('reveal', { n: G.n, f, c, bot: true }, BOT.id);
  }
}
async function onReveal(d, from) {
  if (d.n !== G.n || G.reveals[from] || !G.players.includes(from)) return;
  let ok = true;
  if (from !== me.id && !d.bot) {
    // controllo che la mossa rivelata sia quella "imbustata" prima della scadenza
    const h = d.f ? await sha([d.n, d.f, d.c, d.salt].join('|')) : null;
    if (d.f && G.commits[from] !== h) { ok = false; toast(`La mossa di ${G.info[from]?.name || '?'} non era valida`); }
  }
  G.reveals[from] = ok && d.f ? { f: d.f, c: d.c || null } : { f: null, c: null };
  G.lastMsg = performance.now();
  if (G.players.every(p => G.reveals[p])) resolve();
}

async function resolve() {
  if (G.phase === 'reveal') return;
  G.phase = 'reveal'; clearInterval(G.timer);
  const a = G.reveals[G.left], b = G.reveals[G.right];
  [L, R].forEach(s => { s.classList.remove('pumping'); s.classList.add('thrown'); });
  setFingers(L, a.f || 0); setFingers(R, b.f || 0);
  play('thump');
  await sleep(250);
  const bub = (side, r) => { const el = $('.bubble', side); el.innerHTML = r.c ? `<b>${r.c}</b><small>${DIALETTO[r.c]}</small>` : `<b>…</b><small>${r.f ? 'zitto' : 'non ha buttato'}</small>`; el.classList.add('on'); };
  bub(L, a); play('pop');
  if (a.c) say(PAROLA[a.c] + '!', 1.05);
  await sleep(320); bub(R, b); play('pop');
  if (b.c) say(PAROLA[b.c] + '!', .8);
  await sleep(420);

  let winner = null, sum = null, txt;
  if (a.f && b.f) {
    sum = a.f + b.f;
    const wa = a.c === sum, wb = b.c === sum;
    if (wa && !wb) winner = G.left; else if (wb && !wa) winner = G.right;
    txt = wa && wb ? 'Tutti e due! Nessun punto' : winner ? `Punto a ${G.info[winner].name}` : 'Nessuno indovina';
    $('#sum').innerHTML = `${a.f} + ${b.f}<span class="eq">${sum}</span>`;
  } else if (a.f || b.f) {
    winner = a.f ? G.left : G.right;
    txt = `${G.info[a.f ? G.right : G.left].name} non ha buttato: punto a ${G.info[winner].name}`;
    $('#sum').innerHTML = '<span class="eq">—</span>';
  } else { txt = 'Nessuno ha buttato'; $('#sum').innerHTML = '<span class="eq">—</span>'; }
  $('#verdict').textContent = txt;
  if (sum) [[L, a], [R, b]].forEach(([s, r]) => r.c === sum && $('.bubble', s).classList.add('right-call'));

  const h = document.createElement('div');
  h.innerHTML = sum ? `${a.f}+${b.f}=${sum} ${winner ? '· <span class="w">' + esc(G.info[winner].name) + '</span>' : ''}` : '—';
  $('#history').prepend(h); while ($('#history').children.length > 6) $('#history').lastChild.remove();

  if (winner) {
    G.scores[winner] = (G.scores[winner] || 0) + 1;
    const side = winner === G.left ? L : R, pl = winner === G.left ? $('#plL') : $('#plR');
    side.classList.add('winner'); drawScore(); pl.classList.add('scored'); $('.pts', pl).classList.add('bump');
    setTimeout(() => pl.classList.remove('scored'), 1200);
    play(winner === me.id ? 'win' : G.spectator ? 'pop' : 'lose');
  }
  G.lastMsg = performance.now();
  await sleep(2400);
  if (!room.isHost || G.phase !== 'reveal') return;
  const champ = G.players.find(p => G.scores[p] >= G.target);
  if (champ) {
    room.both('over', { scores: G.scores, winner: champ });
    if (!room.solo) {
      saveRoom(room.code, { status: 'finished', state: { scores: G.scores } });
      saveResult('morra', room.code, G.players.map(p => ({ id: p, name: G.info[p]?.name, score: G.scores[p] })), G.info[champ]?.name);
    }
  } else if (allPresent()) nextRound();
}

function onOver(d) {
  G.over = true; G.phase = 'over'; G.scores = d.scores; drawScore(); clearInterval(G.timer);
  const won = d.winner === me.id, w = G.info[d.winner];
  if (won || G.spectator) confetti(); play(won ? 'win' : 'lose');
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal glass">${avatarHTML(w, true)}
    <h2>${won ? 'Hai vinto!' : G.spectator ? `Vince ${esc(w.name)}` : `Ha vinto ${esc(w.name)}`}</h2>
    <div class="final">${G.players.map(p => `<div>${esc(G.info[p]?.name)}<b>${G.scores[p]}</b></div>`).join('')}</div>
    <div style="display:flex;gap:10px;justify-content:center">
      ${room.isHost ? '<button class="btn primary again">Rivincita</button>' : '<span class="hint" style="align-self:center">L\'host può proporre la rivincita</span>'}
      <a class="btn" href="../">Menu</a></div></div>`;
  document.body.appendChild(o);
  const again = $('.again', o);
  if (again) again.onclick = () => {
    if (!room.solo) saveRoom(room.code, { status: 'playing' });
    room.both('start', { settings: { target: G.target, speed: G.T }, players: G.players });
  };
}

/* ---------- presenza e subentro dell'host ---------- */
function allPresent() { return room.solo || G.players.every(p => room.members.some(m => m.id === p)); }
function checkPresence() {
  if (!G.players.length || room.solo) return;
  const missing = G.players.filter(p => !room.members.some(m => m.id === p));
  let o = $('#waitbox');
  if (missing.length && !G.over) {
    if (!o) { o = document.createElement('div'); o.id = 'waitbox'; o.className = 'overlay'; document.body.appendChild(o); }
    o.innerHTML = `<div class="modal glass"><h2>In pausa</h2><p class="hint">Aspetto ${missing.map(p => esc(G.info[p]?.name || '?')).join(', ')}: si è disconnesso. La partita riprende appena rientra.</p><a class="btn" href="../">Esci</a></div>`;
  } else if (o) { o.remove(); }
}
// se l'host sparisce, chi resta riprende il gioco dopo qualche secondo di silenzio
function watchdog() {
  clearInterval(G.wd);
  G.wd = setInterval(() => {
    if (!room || room.solo || G.over || !G.players.length) return;
    const quiet = performance.now() - G.lastMsg;
    if (room.isHost && allPresent() && (G.phase === 'idle' || G.phase === 'reveal') && quiet > 4500) { G.lastMsg = performance.now(); nextRound(); }
    if (room.isHost && allPresent() && G.phase === 'lock' && quiet > 3500) {
      // qualcuno non ha rivelato: lo considero "non ha buttato"
      G.players.forEach(p => G.reveals[p] ||= { f: null, c: null }); resolve();
    }
  }, 1000);
}
