// Lobby comune: crea/entra in una stanza, mostra chi c'è, impostazioni dell'host, pulsante Inizia
import { $, $$, esc, toast, avatarHTML, ensureProfile, createRoom, findRoom, saveRoom, Room, sfx, GAMES, announce, onlineList, ping } from './core.js';

/*
  opts = {
    game: 'morra', title, subtitle, min, max,
    settings: [{ key, label, options: [{ v, l }] }], defaults: {},
    solo: { label, start() }        // facoltativo: partita contro il computer
    onStart(room, settings, playerIds)  // chiamato su tutti i client quando l'host avvia
    onJoin(room)                     // chiamato appena entrati nel canale (prima dell'avvio)
  }
*/
export function mountLobby(root, opts) {
  let room = null, settings = { ...opts.defaults };
  const url = new URL(location.href);

  function home() {
    root.innerHTML = `<div class="lobby glass">
      <h1 style="view-transition-name:title-${opts.game}">${esc(opts.title)}</h1>
      <p class="hint">${esc(opts.subtitle || '')}</p>
      <div style="display:grid;gap:12px;margin-top:22px">
        <button class="btn primary create">Crea una stanza</button>
        <div style="display:flex;gap:8px"><input class="field code" maxlength="5" placeholder="Codice" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:.08em">
          <button class="btn join">Entra</button></div>
        ${opts.solo ? `<button class="btn solo">${esc(opts.solo.label)}</button>` : ''}
      </div></div>`;
    $('.create', root).onclick = async e => {
      e.target.disabled = true;
      try { await ensureProfile(); const code = await createRoom(opts.game, settings); go(code); }
      catch (err) { toast('Errore: ' + err.message); e.target.disabled = false; }
    };
    const inp = $('.code', root);
    const join = () => { const c = inp.value.trim().toUpperCase(); if (c.length >= 4) go(c); else inp.focus(); };
    $('.join', root).onclick = join; inp.onkeydown = e => e.key === 'Enter' && join();
    if (opts.solo) $('.solo', root).onclick = async () => { await ensureProfile(); announce({ game: opts.game, code: null, status: 'solo' }); opts.solo.start(); };
  }

  function go(code) { url.searchParams.set('r', code); history.replaceState(null, '', url); enter(code); }

  async function enter(code) {
    await ensureProfile();
    root.innerHTML = `<div class="lobby glass"><p class="hint">Entro nella stanza ${esc(code)}…</p></div>`;
    let row;
    try { row = await findRoom(code); } catch (e) { toast('Database non raggiungibile'); return home(); }
    if (!row) { toast('Stanza ' + code + ' non trovata'); url.searchParams.delete('r'); history.replaceState(null, '', url); return home(); }
    if (row.game !== opts.game) { location.href = new URL('../' + GAMES[row.game].path + '?r=' + code, location.href).href; return; }
    settings = { ...opts.defaults, ...row.settings };
    room = new Room(code, row);
    room.on('members', () => draw());
    room.on('settings', s => { settings = { ...settings, ...s }; draw(); });
    room.on('start', d => { room.started = true; announce({ game: opts.game, code, status: 'playing' }); opts.onStart(room, d.settings, d.players, d); });
    announce({ game: opts.game, code, status: row.status === 'playing' ? 'playing' : 'lobby' });
    window.addEventListener('online', () => draw());
    try { await room.join(); } catch (e) { toast(e.message); return home(); }
    window.addEventListener('pagehide', () => room.leave());
    opts.onJoin && opts.onJoin(room);
    if (!room.started) draw();
  }

  let lastIds = '';
  function draw() {
    if (!room || room.started) return;
    const m = room.members, host = room.isHost, code = room.code;
    const n = m.length, can = n >= opts.min && n <= opts.max;
    const ids = m.map(x => x.id).join();
    if (ids !== lastIds && lastIds) sfx('pop'); lastIds = ids;
    root.innerHTML = `<div class="lobby glass">
      <h1 style="view-transition-name:title-${opts.game}">${esc(opts.title)}</h1>
      <div class="code-big" title="Copia il link">${[...code].map(c => `<span>${c}</span>`).join('')}</div>
      <p class="hint">Clicca il codice per copiare il link da mandare ai colleghi.</p>
      <div class="members">${m.map(x => `<div class="member">${avatarHTML(x)}<b>${esc(x.name)}</b>${x.id === room.hostId ? '<span class="tag">host</span>' : ''}${x.id === room.me.id ? '<span class="tag">tu</span>' : ''}</div>`).join('')}</div>
      ${(opts.settings || []).map(s => `<div class="setting"><label>${esc(s.label)}</label><div class="pills">${s.options.map(o =>
        `<button class="pill${settings[s.key] == o.v ? ' on' : ''}" data-k="${s.key}" data-v="${o.v}" ${host ? '' : 'disabled'}>${esc(o.l)}</button>`).join('')}</div></div>`).join('')}
      ${invitable().length ? `<div class="setting"><label>Invita chi è online</label><div class="people">${invitable().map(o => `<div class="person">${avatarHTML(o)}<div class="t"><b>${esc(o.name)}</b></div><button class="act" data-inv="${o.id}">Invita</button></div>`).join('')}</div></div>` : ''}
      <div style="display:flex;gap:10px;align-items:center;margin-top:22px">
        ${host ? `<button class="btn primary start" ${can ? '' : 'disabled'}>Inizia</button>` : '<span class="hint">In attesa che l\'host avvii la partita…</span>'}
        <span class="hint" style="margin-left:auto">${n < opts.min ? `Servono almeno ${opts.min} giocatori` : n > opts.max ? `Massimo ${opts.max} giocatori` : `${n} giocator${n === 1 ? 'e' : 'i'}`}</span>
      </div></div>`;
    $('.code-big', root).onclick = () => { navigator.clipboard.writeText(location.href).then(() => toast('Link copiato')); };
    $$('.pill[data-k]', root).forEach(b => b.onclick = () => {
      const s = opts.settings.find(x => x.key === b.dataset.k), v = s.options.find(o => String(o.v) === b.dataset.v).v;
      settings[b.dataset.k] = v; room.send('settings', { [b.dataset.k]: v }); saveRoom(room.code, { settings }); draw();
    });
    $$('[data-inv]', root).forEach(b => b.onclick = () => { ping(b.dataset.inv, 'invite', { game: opts.game, code }); invited.add(b.dataset.inv); b.textContent = 'Invitato ✓'; b.disabled = true; sfx('pop'); });
    $$('[data-inv]', root).forEach(b => { if (invited.has(b.dataset.inv)) { b.textContent = 'Invitato ✓'; b.disabled = true; } });
    const st = $('.start', root);
    if (st) st.onclick = () => {
      const players = room.members.slice(0, opts.max).map(x => x.id);
      saveRoom(room.code, { status: 'playing', settings });
      room.both('start', { settings, players, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
    };
  }

  // chi è online ma non è in questa stanza
  const invited = new Set();
  function invitable() { const inRoom = new Set(room.members.map(m => m.id)); return onlineList().filter(o => !inRoom.has(o.id)); }

  const r = url.searchParams.get('r');
  if (!r) announce({ game: opts.game, code: null, status: 'menu' });
  if (r) enter(r.toUpperCase()); else home();
  return { get room() { return room; }, home };
}
