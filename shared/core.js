// Base comune: profilo giocatore, avvisi, Supabase e stanze in tempo reale
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const SB_URL = 'https://agwmdkrkfydgfzghwspv.supabase.co';
export const SB_KEY = 'sb_publishable_5edj9ayGro2KPEgrUsaNZg_KWDi9mi_';
export const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const uid = () => crypto.randomUUID();

export const GAMES = {
  morra: { name: 'Morra calabrese', path: 'morra/' },
  briscola: { name: 'Briscola', path: 'briscola/' },
  carte: { name: 'Scarta!', path: 'carte/' },
  nerf: { name: 'Nerf in Salotto', path: 'nerf-salotto/nerf-salotto.html' },
  guessr: { name: 'ItaliaGuessr', path: 'italia-guessr/italia-guessr.html' },
  menu: { name: 'Menu', path: '' },
};
// percorso relativo alla radice del sito, valido sia dal menu sia dai giochi
export function siteRoot() { return new URL('..', import.meta.url).href; }

/* ---------- profilo (uguale in tutti i giochi) ---------- */
export const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🦉', '🐧', '🐵', '🐺', '🦝', '🐷',
  '🌶️', '🍕', '🍋', '🍉', '🥥', '🍄', '🌵', '🔥', '⚡', '🎲', '🎯', '🚀', '👻', '🤖', '👽', '🎩'];
const COLORS = ['#ff5b7f', '#ffb23f', '#3fd6c6', '#7b6cff', '#3fdc8a', '#ff7a45', '#4fb3ff', '#e86cff'];
function store(k, v) {
  try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; }
}
export function getProfile() {
  let p = store('gu_profile');
  if (!p || !p.id) {
    p = { id: uid(), name: store('cg_nick') || '', avatar: AVATARS[Math.random() * 16 | 0], color: COLORS[Math.random() * COLORS.length | 0] };
    store('gu_profile', p);
  }
  return p;
}
export function saveProfile(p) { store('gu_profile', p); window.dispatchEvent(new CustomEvent('profile', { detail: p })); }
export function avatarHTML(p, big) {
  return `<span class="avatar${big ? ' big' : ''}" style="background:${p.color}33;box-shadow:inset 0 0 0 2px ${p.color}">${p.avatar}</span>`;
}
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// finestra per scegliere nome e avatar; si risolve quando il profilo è pronto
export function editProfile(force) {
  return new Promise(res => {
    const p = { ...getProfile() };
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal glass"><h2>${p.name ? 'Il tuo profilo' : 'Come ti chiami?'}</h2>
      <input class="field" maxlength="16" placeholder="Il tuo nome" value="${esc(p.name)}">
      <div class="emoji-grid">${AVATARS.map(a => `<button class="${a === p.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <div class="pills colors">${COLORS.map(c => `<button class="pill${c === p.color ? ' on' : ''}" data-c="${c}" style="width:34px;height:34px;padding:0;background:${c}"></button>`).join('')}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px">${force ? '' : '<button class="btn x">Annulla</button>'}<button class="btn primary ok">Salva</button></div></div>`;
    document.body.appendChild(bg);
    const inp = $('input', bg); inp.focus(); inp.select();
    $$('.emoji-grid button', bg).forEach(b => b.onclick = () => { $$('.emoji-grid button', bg).forEach(x => x.classList.remove('on')); b.classList.add('on'); p.avatar = b.textContent; });
    $$('.colors .pill', bg).forEach(b => b.onclick = () => { $$('.colors .pill', bg).forEach(x => x.classList.remove('on')); b.classList.add('on'); p.color = b.dataset.c; });
    const close = ok => {
      if (ok) { const n = inp.value.trim(); if (!n) { inp.focus(); inp.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); return; } p.name = n; saveProfile(p); }
      bg.remove(); res(getProfile());
    };
    $('.ok', bg).onclick = () => close(true);
    const x = $('.x', bg); if (x) x.onclick = () => close(false);
    inp.onkeydown = e => { if (e.key === 'Enter') close(true); if (e.key === 'Escape' && !force) close(false); };
  });
}
export async function ensureProfile() { const p = getProfile(); return p.name ? p : editProfile(true); }

/* ---------- avvisi ---------- */
export function toast(msg, ms = 2600) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- stanze ---------- */
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // senza lettere che si confondono (I, O, 0, 1)
export function newCode() { let s = ''; const r = crypto.getRandomValues(new Uint8Array(5)); for (const x of r) s += ALPH[x % ALPH.length]; return s; }

export async function createRoom(game, settings = {}) {
  const me = getProfile();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { error } = await sb.from('game_rooms').insert({ code, game, host_id: me.id, host_name: me.name, settings });
    if (!error) return code;
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Impossibile creare la stanza');
}
export async function findRoom(code) {
  const { data, error } = await sb.from('game_rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
export async function saveRoom(code, patch) {
  const { error } = await sb.from('game_rooms').update(patch).eq('code', code);
  if (error) console.warn('salvataggio stanza', error.message);
}
export async function saveResult(game, room_code, players, winner) {
  const { error } = await sb.from('game_results').insert({ game, room_code, players, winner });
  if (error) console.warn('salvataggio risultato', error.message);
}

/*
  Room: canale Realtime della stanza.
  - presence: chi è collegato (con nome, avatar e ora di ingresso)
  - broadcast: i messaggi di gioco
  L'host è il creatore se è collegato, altrimenti chi è entrato per primo:
  così se l'host chiude la pagina un altro prende il suo posto.
*/
export class Room {
  constructor(code, row) {
    this.code = code; this.row = row; this.me = getProfile(); this.members = []; this.handlers = {}; this.joinedAt = Date.now();
    this.ch = sb.channel('gu:' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: this.me.id } } });
    this.ch.on('presence', { event: 'sync' }, () => this._sync());
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this._recv(payload));
  }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  emit(type, data, from) { (this.handlers[type] || []).forEach(f => f(data, from ?? this.me.id)); }
  _recv(p) { if (p && p.t) this.emit(p.t, p.d, p.f); }
  _sync() {
    const st = this.ch.presenceState();
    this.members = Object.values(st).map(a => a[0]).sort((a, b) => a.at - b.at);
    this.emit('members', this.members);
  }
  join() {
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Connessione in tempo reale non riuscita')), 10000);
      this.ch.subscribe(async st => {
        if (st === 'SUBSCRIBED') {
          clearTimeout(to);
          await this.ch.track({ id: this.me.id, name: this.me.name, avatar: this.me.avatar, color: this.me.color, at: this.joinedAt });
          res(this);
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('Canale: ' + st)); }
      });
    });
  }
  send(type, data) {
    this.ch.send({ type: 'broadcast', event: 'm', payload: { t: type, d: data, f: this.me.id } });
  }
  // invia agli altri e lo elabora anche localmente
  both(type, data) { this.send(type, data); this.emit(type, data, this.me.id); }
  get hostId() {
    if (this.members.some(m => m.id === this.row.host_id)) return this.row.host_id;
    return this.members[0]?.id ?? this.row.host_id;
  }
  get isHost() { return this.hostId === this.me.id; }
  member(id) { return this.members.find(m => m.id === id); }
  leave() { try { this.ch.untrack(); sb.removeChannel(this.ch); } catch (e) {} }
}

/* ---------- impegno e rivelazione (per mosse simultanee) ---------- */
export async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- suoni sintetizzati ---------- */
let ac;
export function sfx(kind) {
  try {
    ac ||= new AudioContext();
    if (kind === 'card') { // fruscio di carta: rumore filtrato brevissimo
      const t = ac.currentTime, len = ac.sampleRate * .09, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 800; f.Q.value = .8; g.gain.value = .35;
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t); return;
    }
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const P = {
      tick: [660, 'sine', .06, .12], thump: [90, 'triangle', .18, .5], pop: [520, 'sine', .1, .25],
      win: [880, 'triangle', .35, .25], lose: [180, 'sawtooth', .35, .12], click: [1200, 'square', .03, .05],
    }[kind] || [440, 'sine', .1, .2];
    o.type = P[1]; o.frequency.setValueAtTime(P[0], t);
    if (kind === 'thump') o.frequency.exponentialRampToValueAtTime(40, t + P[2]);
    if (kind === 'win') { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + .1); o.frequency.setValueAtTime(1320, t + .2); }
    if (kind === 'lose') o.frequency.exponentialRampToValueAtTime(80, t + P[2]);
    g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(.001, t + P[2]);
    o.start(t); o.stop(t + P[2] + .02);
  } catch (e) {}
}

/* ---------- coriandoli ---------- */
export function confetti(n = 120) {
  const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90';
  c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const x = c.getContext('2d'), cols = ['#ff5b7f', '#ffb23f', '#3fd6c6', '#7b6cff', '#3fdc8a', '#fff'];
  const P = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: cols[Math.random() * cols.length | 0] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of P) { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(f / 6 + p.r)); x.restore(); }
    if (++f < 200) requestAnimationFrame(step); else c.remove();
  })();
}

/* ---------- barra in alto con il profilo ---------- */
export function mountTopbar({ back = true } = {}) {
  const bar = document.createElement('div'); bar.className = 'topbar';
  const draw = () => {
    const p = getProfile();
    bar.innerHTML = (back ? `<a class="back" href="${siteRoot()}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Giochi</a>` : '')
      + `<button class="me-chip">${avatarHTML(p)}<span>${esc(p.name || 'Profilo')}</span></button>`;
    $('.me-chip', bar).onclick = () => editProfile();
  };
  draw(); window.addEventListener('profile', draw);
  document.body.prepend(bar);
  return bar;
}

/* ---------- chi è online (canale comune a tutte le pagine) ---------- */
let hub = null, hubInfo = {}, online = [];
export function announce(info = {}) {
  hubInfo = { ...hubInfo, ...info };
  const p = getProfile();
  if (!p.name) return;
  if (!hub) {
    hub = sb.channel('gu:hub', { config: { presence: { key: p.id }, broadcast: { self: false } } });
    hub.on('presence', { event: 'sync' }, () => {
      online = Object.values(hub.presenceState()).map(a => a.sort((x, y) => y.at - x.at)[0]);
      window.dispatchEvent(new CustomEvent('online', { detail: online }));
    });
    hub.on('broadcast', { event: 'ping' }, ({ payload }) => { if (payload.to === getProfile().id) showPing(payload); });
    hub.subscribe(st => { if (st === 'SUBSCRIBED') track(); });
    window.addEventListener('profile', () => track());
  } else track();
}
function track() { const p = getProfile(); if (hub && p.name) hub.track({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, ...hubInfo, at: Date.now() }).catch(() => {}); }
export const onlineList = () => online;
export const describe = o => {
  const g = GAMES[o.game]?.name;
  if (!o.game || o.game === 'menu') return 'nel menu';
  if (o.status === 'lobby') return `aspetta giocatori · ${g}`;
  if (o.status === 'playing') return `sta giocando a ${g}`;
  if (o.status === 'solo') return `${g} contro il computer`;
  return `su ${g}`;
};
// invito o saluto a un collega: arriva come avviso in qualunque pagina stia guardando
export function ping(to, kind, extra = {}) {
  const p = getProfile();
  hub?.send({ type: 'broadcast', event: 'ping', payload: { to, kind, from: { id: p.id, name: p.name, avatar: p.avatar, color: p.color }, ...extra } });
}
function showPing(d) {
  const box = document.createElement('div');
  box.className = 'ping glass';
  const url = d.kind === 'invite' && GAMES[d.game] ? siteRoot() + GAMES[d.game].path + '?r=' + d.code : null;
  box.innerHTML = `${avatarHTML(d.from)}<div><b>${esc(d.from.name)}</b><span>${url ? `ti invita a ${esc(GAMES[d.game].name)}` : 'ti saluta 👋'}</span></div>
    ${url ? `<a class="btn primary small" href="${url}">Entra</a>` : ''}<button class="btn small x">${url ? 'No grazie' : 'Ciao!'}</button>`;
  document.body.appendChild(box); sfx('win');
  const close = () => { box.classList.add('out'); setTimeout(() => box.remove(), 300); };
  box.querySelector('.x').onclick = () => { if (!url && d.kind === 'wave') ping(d.from.id, 'wave-back'); close(); };
  setTimeout(close, url ? 30000 : 8000);
}
