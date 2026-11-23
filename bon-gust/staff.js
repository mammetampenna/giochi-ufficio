// Pannello del personale: ordini da ritirare, prenotazioni con tavoli, carta
import { rpc, table, madridNow, hm, mhm, addDays, eur, busyTables } from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };

const S = { pass: ss.get('bg_pass'), day: madridNow().day, tab: 'orders', bookings: [], orders: [], menu: [], tables: [], cfg: null, seen: new Set(), first: true, edit: null };
const EX = { queso: 'queso', cebolla: 'cebolla', pimiento: 'pimiento' };
const ST_B = { confirmed: 'Confirmada', seated: 'En mesa', done: 'Terminada', cancelled: 'Anulada', noshow: 'No vino' };

function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
const admin = (action, p = {}) => rpc('bg_admin', { p_pass: S.pass, p_action: action, p });
const ERR = { 'bg:taken': 'Esas mesas ya están ocupadas a esa hora.', 'bg:full': 'No hay mesas libres juntas para ese grupo.', 'bg:auth': 'Contraseña incorrecta.' };
const errMsg = e => ERR[e.code] || 'Error: ' + e.message;

// ---------------------------------------------------------------- accesso
$('#login').addEventListener('submit', async e => {
  e.preventDefault(); S.pass = e.target.pass.value;
  try { await admin('login'); ss.set('bg_pass', S.pass); start(); }
  catch (ex) { $('#loginErr').textContent = errMsg(ex); }
});
$('#logout').onclick = () => { ss.set('bg_pass', null); location.reload(); };

async function start() {
  $('#login').classList.add('hide'); $('#app').classList.remove('hide'); $('#logout').classList.remove('hide');
  const [menu, tables, cfg] = await Promise.all([table('bg_menu', 'select=*&order=sort'), table('bg_tables', 'select=*&order=id'), table('bg_settings', 'select=value&key=eq.config')]);
  S.menu = menu; S.tables = tables; S.cfg = cfg[0].value;
  setDay(S.day);
  setInterval(() => { if (document.visibilityState === 'visible' && !S.edit) load(); }, 12000);
}

// ---------------------------------------------------------------- giorno e schede
function setDay(d) { S.day = d; $('#dPick').value = d; S.first = true; load(); }
$('#dPrev').onclick = () => setDay(addDays(S.day, -1));
$('#dNext').onclick = () => setDay(addDays(S.day, 1));
$('#dToday').onclick = () => setDay(madridNow().day);
$('#dPick').onchange = e => e.target.value && setDay(e.target.value);
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  S.tab = b.dataset.tab; $$('#tabs [data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b));
  ['orders', 'bookings', 'menu'].forEach(t => $('#t-' + t).classList.toggle('hide', t !== S.tab));
  render();
});

async function load() {
  try {
    const r = await admin('day', { day: S.day });
    const fresh = r.orders.filter(o => o.status === 'new' && !S.seen.has(o.id));
    if (!S.first && fresh.length) { ding(); toast(`🥖 ${fresh.length} pedido${fresh.length > 1 ? 's' : ''} nuevo${fresh.length > 1 ? 's' : ''}`); }
    r.orders.forEach(o => S.seen.add(o.id)); S.first = false;
    S.bookings = r.bookings; S.orders = r.orders;
    $('#live').classList.remove('closed'); render();
  } catch (ex) {
    $('#live').classList.add('closed');
    if (ex.code === 'bg:auth') { ss.set('bg_pass', null); location.reload(); }
  }
}
function render() {
  const n = S.orders.filter(o => o.status === 'new').length;
  $('#nNew').textContent = n; $('#nNew').classList.toggle('hide', !n);
  if (S.tab === 'orders') renderOrders(); else if (S.tab === 'bookings') renderBookings(); else renderMenu();
}
function ding() {
  try {
    const a = new AudioContext();
    [0, .18].forEach((d, i) => { const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(.25, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d + .5); o.start(a.currentTime + d); o.stop(a.currentTime + d + .5); });
  } catch {}
}

// ---------------------------------------------------------------- ordini
const NEXT = { new: ['preparing', '🔥 Preparar'], preparing: ['ready', '✅ Listo'], ready: ['picked', '👋 Recogido'] };
function renderOrders() {
  const now = madridNow(); const isToday = S.day === now.day;
  const col = (title, sts) => {
    const list = S.orders.filter(o => sts.includes(o.status));
    return `<div class="col"><h3>${title}<span>${list.length}</span></h3>${list.map(o => {
      const late = isToday && o.status !== 'picked' && o.status !== 'ready' && o.pickup_min < now.min;
      return `<div class="oc ${o.status === 'new' ? 'new' : ''} ${late ? 'late' : ''}">
        <div class="hd"><div class="tm">${mhm(o.pickup_min)}</div><div class="cd">${esc(o.code)}</div></div>
        <div class="who">${esc(o.name)}${o.company ? `<span class="badge">${esc(o.company)}</span>` : ''}</div>
        <a href="tel:${esc(o.phone)}" style="font-size:14px;color:var(--muted)">${esc(o.phone)}</a>
        <ul>${o.items.map(i => `<li><b>${i.qty}×</b> ${esc(i.name)}${i.half ? ' <b>(½)</b>' : ''}${(i.extras || []).length ? `<small>+ ${i.extras.map(x => esc(EX[x] || x)).join(', ')}</small>` : ''}${i.note ? `<small>“${esc(i.note)}”</small>` : ''}</li>`).join('')}</ul>
        ${o.notes ? `<p class="sub" style="color:var(--ink)">📝 ${esc(o.notes)}</p>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center"><b>${eur(+o.total)}</b>${o.status === 'cancelled' ? '<span class="tag">Anulado</span>' : ''}</div>
        <div class="acts">${NEXT[o.status] ? `<button class="btn pri" data-o="${o.id}" data-s="${NEXT[o.status][0]}">${NEXT[o.status][1]}</button>` : ''}
          ${['new', 'preparing'].includes(o.status) ? `<button class="btn ghost" data-o="${o.id}" data-s="cancelled" data-confirm="1">Anular</button>` : ''}</div></div>`;
    }).join('') || '<p class="sub" style="color:var(--muted)">—</p>'}</div>`;
  };
  $('#t-orders').innerHTML = `<div class="cols">${col('Nuevos', ['new'])}${col('Preparando', ['preparing'])}${col('Listos', ['ready'])}</div>
    <details style="margin-top:18px"><summary style="font-weight:800;cursor:pointer">Recogidos y anulados (${S.orders.filter(o => ['picked', 'cancelled'].includes(o.status)).length})</summary>
    <div class="cols" style="margin-top:10px">${col('Recogidos', ['picked'])}${col('Anulados', ['cancelled'])}</div></details>
    <p class="sub" style="color:var(--muted);margin-top:14px">Total del día (sin anulados): <b>${eur(S.orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + +o.total, 0))}</b></p>`;
}
$('#t-orders').addEventListener('click', async e => {
  const b = e.target.closest('[data-o]'); if (!b) return;
  if (b.dataset.confirm && !confirm('¿Anular este pedido?')) return;
  b.disabled = true;
  try { await admin('order', { id: b.dataset.o, status: b.dataset.s }); await load(); }
  catch (ex) { toast(errMsg(ex)); b.disabled = false; }
});

// ---------------------------------------------------------------- prenotazioni
function renderBookings() {
  const from = 7 * 60, to = 24 * 60, span = to - from;
  const act = S.bookings.filter(b => !['cancelled', 'noshow'].includes(b.status));
  const now = madridNow();
  const rows = S.tables.map(t => `<div class="tl-row"><b>Mesa ${t.id}</b><div class="tl-track">${act.filter(b => b.tables.includes(t.id)).map(b =>
    `<div class="blk ${b.status}" data-b="${b.id}" style="left:${(b.start_min - from) / span * 100}%;width:${(b.end_min - b.start_min) / span * 100}%" title="${esc(b.name)} · ${b.people}p">${esc(b.name)} · ${b.people}p</div>`).join('')}</div></div>`).join('');
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => `<span>${(from / 60 + i)}h</span>`).join('');
  const nowLine = S.day === now.day && now.min > from && now.min < to ? `<div class="now" style="left:calc(70px + (100% - 70px) * ${(now.min - from) / span})"></div>` : '';
  const people = act.reduce((a, b) => a + b.people, 0);
  $('#t-bookings').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <h3 style="font-size:26px">${act.length} reservas · ${people} personas</h3>
      <button class="btn ink s" id="newB">＋ Nueva reserva</button></div>
    <div class="tl"><div class="tl-in"><div class="tl-hours">${hours}</div>${rows}${nowLine}</div></div>
    ${S.bookings.map(b => `<div class="bk ${b.status}">
      <div class="tm">${mhm(b.start_min)}</div>
      <div><b>${esc(b.name)}</b> · ${b.people} pers. · Mesa${b.tables.length > 1 ? 's' : ''} <b>${b.tables.join(' + ')}</b> <span class="tag">${ST_B[b.status]}</span>${b.source === 'staff' ? ' <span class="tag">teléfono</span>' : ''}<br>
        <a href="tel:${esc(b.phone)}" style="color:var(--muted);font-size:14px">${esc(b.phone)}</a> <span style="color:var(--muted);font-size:13px">· ${esc(b.code)}${b.email ? ' · ' + esc(b.email) : ''}</span>
        ${b.notes ? `<div class="sub" style="color:var(--ink)">📝 ${esc(b.notes)}</div>` : ''}</div>
      <div class="acts">${b.status === 'confirmed' ? `<button class="btn pri" data-b2="${b.id}" data-s="seated">Ha llegado</button><button class="btn ghost" data-b2="${b.id}" data-s="noshow">No vino</button>` : ''}
        ${b.status === 'seated' ? `<button class="btn pri" data-b2="${b.id}" data-s="done">Se ha ido</button>` : ''}
        ${['confirmed', 'seated'].includes(b.status) ? `<button class="btn ghost" data-edit="${b.id}">Mesas</button>` : ''}
        ${b.status === 'confirmed' ? `<button class="btn ghost" data-b2="${b.id}" data-s="cancelled" data-confirm="1" style="color:var(--red)">Anular</button>` : ''}
        ${['cancelled', 'noshow', 'done'].includes(b.status) ? `<button class="btn ghost" data-b2="${b.id}" data-s="confirmed">Reabrir</button>` : ''}</div></div>`).join('') || '<p class="sub" style="color:var(--muted)">No hay reservas este día.</p>'}`;
}
$('#t-bookings').addEventListener('click', async e => {
  const b = e.target.closest('button,.blk'); if (!b) return;
  if (b.id === 'newB') return openNew();
  if (b.dataset.edit || b.dataset.b) return openTables(S.bookings.find(x => x.id === (b.dataset.edit || b.dataset.b)));
  if (b.dataset.b2) {
    if (b.dataset.confirm && !confirm('¿Anular esta reserva?')) return;
    b.disabled = true;
    try { await admin('booking', { id: b.dataset.b2, status: b.dataset.s }); await load(); } catch (ex) { toast(errMsg(ex)); b.disabled = false; }
  }
});

function busyFor(s, e, except) {
  return busyTables(S.bookings.filter(b => ['confirmed', 'seated'].includes(b.status) && b.id !== except).map(b => ({ s: b.start_min, e: b.end_min, t: b.tables })), s, e);
}
function pickerHTML(sel, busy) {
  return `<div class="pick">${S.tables.map(t => `<button type="button" data-pt="${t.id}" aria-pressed="${sel.includes(t.id)}" class="${busy.has(t.id) ? 'busy' : ''}" title="${t.label}">${t.id}</button>`).join('')}</div>
    <p class="sub" style="color:var(--muted)">Rojo = ocupada a esa hora. Personal: se puede unir cualquier mesa.</p>`;
}
function openLayer() { S.edit = true; $('#optModal').classList.add('open'); }
function closeLayer() { S.edit = null; $('#optModal').classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLayer(); });

function openTables(b) {
  let sel = [...b.tables]; const busy = busyFor(b.start_min, b.end_min, b.id);
  const draw = () => {
    $('#optBox').innerHTML = `<div style="display:flex;justify-content:space-between"><h3>${esc(b.name)} · ${b.people}p · ${mhm(b.start_min)}</h3><button class="x" data-close>✕</button></div>
      <p class="sub" style="color:var(--muted)">Toca las mesas para cambiarlas o juntar más.</p>${pickerHTML(sel, busy)}
      <div class="acts"><button class="btn pri" id="saveT">Guardar mesas (${sel.length * 4} plazas)</button></div>`;
  };
  draw(); openLayer();
  $('#optBox').onclick = async e => {
    const p = e.target.closest('[data-pt]');
    if (p) { const id = +p.dataset.pt; sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].sort((a, c) => a - c); return draw(); }
    if (e.target.id === 'saveT') {
      if (!sel.length) return toast('Elige al menos una mesa');
      try { await admin('booking', { id: b.id, tables: sel }); closeLayer(); load(); toast('Mesas cambiadas'); } catch (ex) { toast(errMsg(ex)); }
    }
  };
}

function openNew() {
  let sel = [];
  const st = { time: '13:30', people: 2, name: '', phone: '', notes: '' };
  const draw = () => {
    const s = hm(st.time || '13:30'); const busy = busyFor(s, s + (S.cfg.dur || 90));
    $('#optBox').innerHTML = `<div style="display:flex;justify-content:space-between"><h3>Nueva reserva · ${esc(S.day)}</h3><button class="x" data-close>✕</button></div>
      <form id="nf" style="margin-top:12px">
        <div class="two"><label class="field"><span>Hora</span><input type="time" name="time" value="${st.time}" step="300" required></label>
        <label class="field"><span>Personas</span><input type="number" name="people" min="1" max="44" value="${st.people}" required></label></div>
        <div class="two"><label class="field"><span>Nombre</span><input name="name" value="${esc(st.name)}" required minlength="2"></label>
        <label class="field"><span>Teléfono</span><input name="phone" type="tel" value="${esc(st.phone)}" required minlength="6"></label></div>
        <label class="field"><span>Notas</span><input name="notes" value="${esc(st.notes)}"></label>
        <div class="field"><span>Mesas (vacío = las asigna el sistema)</span></div>${pickerHTML(sel, busy)}
        <div class="err" id="nfErr"></div><button class="btn pri" style="width:100%">Reservar</button></form>`;
  };
  draw(); openLayer();
  const keep = () => { const f = $('#nf'); Object.assign(st, { time: f.time.value, people: +f.people.value, name: f.name.value, phone: f.phone.value, notes: f.notes.value }); };
  $('#optBox').onclick = e => { const p = e.target.closest('[data-pt]'); if (!p) return; keep(); const id = +p.dataset.pt; sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].sort((a, c) => a - c); draw(); };
  $('#optBox').onchange = e => { if (e.target.name === 'time') { keep(); draw(); } };
  $('#optBox').onsubmit = async e => {
    e.preventDefault(); keep();
    try {
      const r = await admin('book', { day: S.day, time: st.time, people: st.people, name: st.name, phone: st.phone, notes: st.notes, tables: sel });
      closeLayer(); load(); toast(`Reserva ${r.code}: mesa${r.tables.length > 1 ? 's' : ''} ${r.tables.join(' + ')}`);
    } catch (ex) { $('#nfErr').textContent = errMsg(ex); }
  };
}

// ---------------------------------------------------------------- carta
const CATS = ['bocadillos', 'especiales', 'bikinis', 'combinados', 'bebidas'];
function renderMenu() {
  const row = m => `<tr data-id="${esc(m.id)}">
    <td><input type="text" name="name" value="${esc(m.name)}"><input type="text" name="descr" value="${esc(m.descr)}" placeholder="descripción" style="font-size:12px;color:var(--muted)"></td>
    <td><select name="cat">${CATS.map(c => `<option ${c === m.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    <td><input type="number" name="price" step="0.05" min="0" value="${(+m.price).toFixed(2)}" style="width:80px"></td>
    <td><input type="number" name="half" step="0.05" min="0" value="${m.half == null ? '' : (+m.half).toFixed(2)}" style="width:80px"></td>
    <td style="text-align:center"><input class="sw" type="checkbox" name="extras" ${m.extras ? 'checked' : ''}></td>
    <td style="text-align:center"><input class="sw" type="checkbox" name="available" ${m.available ? 'checked' : ''}></td>
    <td style="text-align:center"><input class="sw" type="checkbox" name="preorder" ${m.preorder ? 'checked' : ''}></td>
    <td><button class="btn ink s" data-save style="padding:7px 12px">Guardar</button></td></tr>`;
  $('#t-menu').innerHTML = `<p class="sub" style="color:var(--muted);margin-bottom:10px">Cambia precios o marca algo como agotado: el sitio se actualiza al momento. "Medio" vacío = no hay medio bocadillo.</p>
    <div style="overflow-x:auto"><table class="mt"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Medio</th><th>Supl.</th><th>Disponible</th><th>Para recoger</th><th></th></tr></thead>
    <tbody>${S.menu.map(row).join('')}</tbody></table></div>
    <button class="btn pri s" id="addItem" style="margin-top:12px">＋ Añadir producto</button>`;
}
$('#t-menu').addEventListener('input', e => e.target.closest('tr')?.classList.add('dirty'));
$('#t-menu').addEventListener('click', async e => {
  if (e.target.id === 'addItem') {
    const name = prompt('Nombre del producto'); if (!name) return;
    const id = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-3);
    try { const r = await admin('menu', { id, name, cat: 'bocadillos', price: 0, sort: (S.menu.at(-1)?.sort || 0) + 10 }); S.menu.push(r); renderMenu(); toast('Añadido: pon el precio y guarda'); } catch (ex) { toast(errMsg(ex)); }
    return;
  }
  const b = e.target.closest('[data-save]'); if (!b) return;
  const tr = b.closest('tr'); const m = S.menu.find(x => x.id === tr.dataset.id);
  const v = n => tr.querySelector(`[name=${n}]`);
  const p = { ...m, name: v('name').value.trim(), descr: v('descr').value.trim(), cat: v('cat').value, price: +v('price').value, half: v('half').value === '' ? '' : +v('half').value,
    extras: v('extras').checked, available: v('available').checked, preorder: v('preorder').checked };
  try { const r = await admin('menu', p); Object.assign(m, r); tr.classList.remove('dirty'); toast('Guardado ✓'); } catch (ex) { toast(errMsg(ex)); }
});

// ---------------------------------------------------------------- avvio
if (S.pass) admin('login').then(start).catch(() => { ss.set('bg_pass', null); $('#login').classList.remove('hide'); });
else $('#login').classList.remove('hide');
