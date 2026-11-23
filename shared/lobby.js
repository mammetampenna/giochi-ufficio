// Lobby comune: schermata d'apertura (crea / codice / contro il computer) e sala d'attesa della stanza
import { $, $$, esc, toast, avatarHTML, ensureProfile, createRoom, findRoom, saveRoom, Room, sfx, GAMES, announce, onlineList, ping, icon } from './core.js';
import { anim, stagger } from './motion.js';

/*
  opts = {
    game: 'morra', title, subtitle, min, max,
    hero: '<html>'                 // illustrazione animata del gioco, sopra il titolo
    colors: ['#ff5b7f', '#ffb23f'] // colori del gioco per riquadri e pulsanti
    settings: [{ key, label, options: [{ v, l }] }], defaults: {},
    solo: { label, start() }        // facoltativo: partita contro il computer
    onStart(room, settings, playerIds, data)
    onJoin(room)
  }
*/
const SPRING = 'outBack(1.8)';
export function mountLobby(root, opts) {
  let room = null, settings = { ...opts.defaults };
  const url = new URL(location.href);
  const [c1, c2] = opts.colors || ['#ff5b7f', '#ffb23f'];
  root.style.setProperty('--g1', c1); root.style.setProperty('--g2', c2);
  const title = () => `<h1 class="lob-title" style="view-transition-name:title-${opts.game}">${esc(opts.title)}</h1>`;

  /* ---------- schermata d'apertura ---------- */
  function home() {
    root.innerHTML = `<div class="lob">
      <div class="lob-hero">${opts.hero || ''}</div>
      ${title()}
      <p class="lob-sub">${esc(opts.subtitle || '')}</p>
      <div class="lob-actions">
        <button class="tile t-create"><span class="ti">${icon('plus')}</span><span class="tt"><b>Crea una stanza</b><small>poi mandi il codice ai colleghi</small></span></button>
        ${opts.solo ? `<button class="tile t-solo"><span class="ti">${icon('bot')}</span><span class="tt"><b>${esc(opts.solo.label)}</b><small>si parte subito, da solo</small></span></button>` : ''}
        <div class="tile t-join"><span class="tt"><b>Hai un codice?</b><small>scrivilo qui sotto</small></span>
          <div class="boxes">${'<input maxlength="1" autocomplete="off" autocapitalize="characters" inputmode="text">'.repeat(5)}</div></div>
      </div></div>`;
    animateIn();
    $('.t-create', root).onclick = async e => {
      const b = e.currentTarget; b.disabled = true; b.classList.add('busy');
      try { await ensureProfile(); const code = await createRoom(opts.game, settings); go(code); }
      catch (err) { toast('Errore: ' + err.message); b.disabled = false; b.classList.remove('busy'); }
    };
    if (opts.solo) $('.t-solo', root).onclick = async () => { await ensureProfile(); announce({ game: opts.game, code: null, status: 'solo' }); opts.solo.start(); };
    // caselle del codice: avanzano da sole, si può incollare tutto
    const boxes = $$('.boxes input', root);
    const check = () => { const c = boxes.map(b => b.value).join(''); if (c.length === 5) { sfx('pop'); go(c); } };
    boxes.forEach((b, k) => {
      b.addEventListener('input', () => { b.value = b.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-1); if (b.value && k < 4) boxes[k + 1].focus(); check(); });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && k) boxes[k - 1].focus(); });
      b.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData.getData('text') || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5);
        [...t].forEach((ch, j) => boxes[j] && (boxes[j].value = ch)); boxes[Math.min(t.length, 4)].focus(); check(); });
    });
  }
  // ingresso con animazioni CSS (non si bloccano mai, anche se la pagina va a scatti): basta dare l'ordine a ogni pezzo
  function animateIn() {
    $$('.lob-sub, .tile, .lob-card, .lob-go', root).forEach((el, i) => el.style.setProperty('--i', i));
  }

  function go(code) { url.searchParams.set('r', code); history.replaceState(null, '', url); enter(code); }

  async function enter(code) {
    await ensureProfile();
    root.innerHTML = `<div class="lob"><div class="lob-hero">${opts.hero || ''}</div><p class="lob-sub">Entro nella stanza <b class="num">${esc(code)}</b>…</p></div>`;
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

  /* ---------- sala d'attesa: costruita una volta, poi aggiorno solo le parti che cambiano ---------- */
  let built = false;
  const seen = new Set();
  function build() {
    const code = room.code;
    root.innerHTML = `<div class="lob room">
      ${title()}
      <div class="lob-card">
        <div class="code-row">
          <div class="code-big" title="Copia il link">${[...code].map(c => `<span>${c}</span>`).join('')}</div>
          <button class="btn small share">${icon('copy')}<span>Condividi</span></button>
        </div>
        <p class="hint">Manda il codice o il link ai colleghi: entrano e si gioca.</p>
      </div>
      <div class="lob-card"><div class="lob-lbl">Al tavolo <span class="cnt"></span></div><div class="lseats"></div></div>
      <div class="lob-card set-card ${(opts.settings || []).length ? '' : 'hidden'}"></div>
      <div class="lob-card inv-card hidden"></div>
      <div class="lob-go"></div>
    </div>`;
    built = true;
    animateIn();
    const share = () => {
      const link = location.href;
      if (navigator.share && matchMedia('(hover: none)').matches) navigator.share({ title: opts.title, text: `Giochiamo a ${opts.title}? Codice ${code}`, url: link }).catch(() => {});
      else navigator.clipboard.writeText(link).then(() => toast('Link copiato'));
    };
    $('.code-big', root).onclick = share; $('.share', root).onclick = share;
    $$('.code-big span', root).forEach((el, i) => el.style.setProperty('--i', i));
  }
  function draw() {
    if (!room || room.started) return;
    if (!built) build();
    const m = room.members, host = room.isHost;
    const n = m.length, can = n >= opts.min && n <= opts.max;
    // posti al tavolo: i presenti, più i posti liberi che servono per iniziare
    const free = Math.max(0, Math.min(opts.max, Math.max(opts.min, 2)) - n);
    $('.cnt', root).textContent = `${n}/${opts.max}`;
    $('.lseats', root).innerHTML = m.map(x => `<div class="lseat${seen.has(x.id) ? '' : ' new'}" data-id="${x.id}">${avatarHTML(x, true)}<b>${esc(x.name)}</b>
        <small>${x.id === room.hostId ? 'host' : ''}${x.id === room.me.id ? (x.id === room.hostId ? ' · tu' : 'tu') : ''}</small></div>`).join('')
      + Array.from({ length: free }, () => '<div class="lseat empty"><span class="avatar big">?</span><b>in attesa</b><small>&nbsp;</small></div>').join('');
    const fresh = $$('.lseat.new', root);
    fresh.forEach((el, i) => el.style.setProperty('--i', i));
    if (fresh.length && seen.size) sfx('pop');
    m.forEach(x => seen.add(x.id));
    // impostazioni (le cambia solo l'host)
    if ((opts.settings || []).length) $('.set-card', root).innerHTML = opts.settings.map(s => `<div class="setting"><label>${esc(s.label)}</label><div class="pills">${s.options.map(o =>
      `<button class="pill${settings[s.key] == o.v ? ' on' : ''}" data-k="${s.key}" data-v="${o.v}" ${host ? '' : 'disabled'}>${esc(o.l)}</button>`).join('')}</div></div>`).join('')
      + (host ? '' : '<p class="hint">Le impostazioni le sceglie l\'host</p>');
    $$('.pill[data-k]', root).forEach(b => b.onclick = () => {
      const s = opts.settings.find(x => x.key === b.dataset.k), v = s.options.find(o => String(o.v) === b.dataset.v).v;
      settings[b.dataset.k] = v; room.send('settings', { [b.dataset.k]: v }); saveRoom(room.code, { settings }); sfx('click'); draw();
    });
    // inviti a chi è online
    const inv = invitable();
    $('.inv-card', root).classList.toggle('hidden', !inv.length);
    $('.inv-card', root).innerHTML = `<div class="lob-lbl">Invita chi è online</div><div class="people">${inv.map(o => `<div class="person">${avatarHTML(o)}<div class="t"><b>${esc(o.name)}</b></div>
      <button class="act" data-inv="${o.id}" ${invited.has(o.id) ? 'disabled' : ''}>${invited.has(o.id) ? 'Invitato ✓' : 'Invita'}</button></div>`).join('')}</div>`;
    $$('[data-inv]', root).forEach(b => b.onclick = () => { ping(b.dataset.inv, 'invite', { game: opts.game, code: room.code }); invited.add(b.dataset.inv); b.textContent = 'Invitato ✓'; b.disabled = true; sfx('pop'); });
    // pulsante di avvio
    $('.lob-go', root).innerHTML = host
      ? `<button class="btn primary start${can ? ' ready' : ''}" ${can ? '' : 'disabled'}>${icon('play')}Inizia la partita</button>
         <span class="hint">${n < opts.min ? `Servono almeno ${opts.min} giocatori` : n > opts.max ? `Massimo ${opts.max} giocatori` : 'Tutto pronto'}</span>`
      : `<div class="waiting"><i></i><i></i><i></i></div><span class="hint">Aspettiamo che l'host avvii la partita</span>`;
    const st = $('.start', root);
    if (st) st.onclick = () => {
      const players = room.members.slice(0, opts.max).map(x => x.id);
      saveRoom(room.code, { status: 'playing', settings });
      room.both('start', { settings, players, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
    };
  }

  const invited = new Set();
  function invitable() { const inRoom = new Set(room.members.map(m => m.id)); return onlineList().filter(o => !inRoom.has(o.id)); }

  const r = url.searchParams.get('r');
  if (!r) announce({ game: opts.game, code: null, status: 'menu' });
  if (r) enter(r.toUpperCase()); else home();
  return { get room() { return room; }, home };
}
