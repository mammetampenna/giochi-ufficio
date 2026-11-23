// Sito del Bar Bon Gust: carta, carrello con ritiro, prenotazione con piantina
import { rpc, table, madridNow, hm, mhm, addDays, isoDow, eur, busyTables, runs, pick } from './api.js';
import { T } from './i18n.js';
import { dishHTML, tiltable } from './dishes.js';

document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

let lang = store.get('bg_lang', null) || (['ca', 'en', 'it'].find(l => (navigator.language || '').startsWith(l)) || 'es');
const t = (k, ...a) => { const v = T[lang][k] ?? T.es[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
const LOC = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB', it: 'it-IT' };
const CATS = ['bocadillos', 'cervezas', 'especiales', 'bikinis', 'combinados', 'bebidas'];
const EMO = { bocadillos: '🥖', cervezas: '🍺', especiales: '⭐', bikinis: '🥪', combinados: '🍳', bebidas: '☕' };

const S = {
  menu: [], tables: [], cfg: null, cat: 'bocadillos',
  cart: store.get('bg_cart', []),
  me: store.get('bg_me', { name: '', phone: '', company: '', fact: false }),
  orders: store.get('bg_orders', []),      // ordini fatti da questo browser, per seguirne lo stato
  book: { day: null, people: 2, time: null, avail: [], tables: null, round: 0 },
  pickDay: null, pickTime: null, hero: null,
};

function toast(msg, ms = 2600) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms);
}
const errMsg = e => t('e_' + String(e?.code || 'bg:error').slice(3)) || t('e_error');
function dayLabel(day, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const now = madridNow().day;
  if (day === now) return t('today').toLowerCase();
  if (day === addDays(now, 1)) return t('tomorrow').toLowerCase();
  return new Date(day + 'T12:00:00Z').toLocaleDateString(LOC[lang], { ...opts, timeZone: 'UTC' });
}
const dayCfg = day => S.cfg?.days?.[String(isoDow(day))] || null;
const item = id => S.menu.find(m => m.id === id);

// ---------------------------------------------------------------- decorazioni: tenda, comparse
function drawAwning() {
  const n = 24, w = 1200 / n; let s = '';
  for (let i = 0; i < n; i++) {
    const x = i * w, c = i % 2 ? '#fbf4e6' : '#c8553d';
    s += `<path d="M${x} 0h${w}v34a${w / 2} ${w / 2.4} 0 0 1 -${w} 0z" fill="${c}"/>`;
  }
  $('#awning').innerHTML = s + '<rect width="1200" height="6" fill="#9e3c28"/>';
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px' });
function watchReveal() { $$('.reveal:not(.in)').forEach(el => io.observe(el)); }

// ---------------------------------------------------------------- testi
function applyLang() {
  document.documentElement.lang = lang;
  $('#lang').value = lang;
  $$('[data-i]').forEach(el => { const v = T[lang][el.dataset.i]; if (typeof v === 'string') el.textContent = v; });
  if (S.cfg) { renderBeerlist(); renderCats(); renderMenu(); renderHours(); renderOpen(); renderDays(); renderPeople(); renderSlots(); renderCart(); renderRec(); }
}
$('#lang').addEventListener('change', e => { lang = e.target.value; store.set('bg_lang', lang); applyLang(); });

// ---------------------------------------------------------------- bocadillo 3D
const PRESET_IDS = ['jamon-serrano', 'vegetal-pollo', 'chorizo', 'tortilla-patata', 'bacon-queso', 'lomo-queso'];
let recId = PRESET_IDS[0];
function renderRec(swap) {
  const m = item(recId); if (!m) return;
  $('#recName').textContent = m.name; $('#recPrice').textContent = eur(m.price);
  if (swap) { const tg = $('#tag3d'); tg.classList.remove('swap'); void tg.offsetWidth; tg.classList.add('swap'); }
}
async function mountHero() {
  const host = $('#hero3d');
  const fallback = () => { host.innerHTML = `<div class="fallback">${dishHTML({ id: recId })}</div>`; host.onclick = () => nextRec(); };
  if (calm) return fallback();
  try {
    const { mountHero3D } = await import('./hero3d.js');
    S.hero = mountHero3D(host, { onChange: p => { recId = p.id; renderRec(true); } });
    if (!S.hero) fallback();
  } catch { fallback(); }
}
function nextRec() {
  if (S.hero) S.hero.next();
  else { recId = PRESET_IDS[(PRESET_IDS.indexOf(recId) + 1) % PRESET_IDS.length]; $('#hero3d .fallback').innerHTML = dishHTML({ id: recId }); renderRec(true); }
}
$('#recNext').addEventListener('click', nextRec);
$('#recAdd').addEventListener('click', e => { const m = item(recId); if (m) openOptions(m, e.currentTarget); });

// ---------------------------------------------------------------- carta
function renderCats() {
  const used = CATS.filter(c => S.menu.some(m => m.cat === c));
  $('#cats').innerHTML = used.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${c === S.cat}">${EMO[c]} ${esc(t('cat_' + c))}</button>`).join('');
}
$('#cats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  S.cat = b.dataset.cat; renderCats(); renderMenu();
  $(`#cats [data-cat="${S.cat}"]`).scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const top = $('#menu').getBoundingClientRect().top;
  if (top < 120 || top > innerHeight) scrollTo({ top: scrollY + $('#carta').getBoundingClientRect().top + 120, behavior: 'smooth' });
});
function renderMenu() {
  const list = S.menu.filter(m => m.cat === S.cat);
  $('#supNote').classList.toggle('hide', !list.some(m => m.extras || m.half));
  const showEn = lang === 'en' || lang === 'it';
  $('#menu').innerHTML = list.map((m, i) => `
    <article class="item ${m.available ? '' : 'off'}" style="animation-delay:${Math.min(i, 12) * 45}ms;--deal:${(i % 3 - 1) * 4}deg;--d:-${(i * .37) % 4.5}s">
      <div class="stagebox" data-open="${esc(m.id)}">${dishHTML(m)}</div>
      <div class="nm">${esc(m.name)}</div>
      ${showEn && m.name_en && m.name_en !== m.name ? `<div class="en">${esc(m.name_en)}</div>` : ''}
      <div class="ds">${esc(m.descr)} ${m.tags?.includes('orientativo') ? `<span class="tag">${esc(t('est'))}</span>` : ''} ${m.available ? '' : `<span class="tag">${esc(t('soldout'))}</span>`}</div>
      <div class="row">
        <div class="price">${eur(m.price)}${m.half ? `<small>½ ${esc(t('half'))} · ${eur(m.half)}</small>` : ''}</div>
        ${m.preorder ? `<button class="add" data-add="${esc(m.id)}" aria-label="${esc(t('add_to'))} ${esc(m.name)}">+</button>` : `<span class="bar-only">🍺 ${esc(t('bar_only'))}</span>`}
      </div>
    </article>`).join('');
}
tiltable($('#menu'));
$('#menu').addEventListener('click', e => {
  const st = e.target.closest('[data-open]');
  if (st) { const d = st.querySelector('.dish'); d.classList.add('open'); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('open'), 1400); return; }
  const b = e.target.closest('[data-add]'); if (!b) return;
  const m = item(b.dataset.add);
  if (m.half || m.extras) openOptions(m, b);
  else { addToCart({ id: m.id, half: false, extras: [], note: '' }, 1); flyFrom(b, m); }
});

// finestra con formato, supplementi, quantità e nota
function openOptions(m, from) {
  const o = { half: false, extras: [], qty: 1, note: '' };
  const box = $('#optBox');
  const price = () => ((o.half ? m.half : m.price) + o.extras.length * (S.cfg.extra_price ?? .7)) * o.qty;
  const draw = first => {
    box.innerHTML = `
      <div style="display:flex;justify-content:flex-end"><button class="x" data-close aria-label="×">✕</button></div>
      <div class="bigdish ${first ? '' : 'still'}">${dishHTML(m)}</div>
      <h3 style="text-align:center">${esc(m.name)}</h3><div class="sub" style="text-align:center">${esc(m.descr || (lang === 'en' || lang === 'it' ? m.name_en : ''))}</div>
      ${m.half ? `<div class="field" style="margin:16px 0 0"><span>${esc(t('size'))}</span></div><div class="opt">
        <button class="chip" data-h="0" aria-pressed="${!o.half}">${esc(t('whole'))} · ${eur(m.price)}</button>
        <button class="chip" data-h="1" aria-pressed="${o.half}">${esc(t('half_l'))} · ${eur(m.half)}</button></div>` : '<div style="height:14px"></div>'}
      ${m.extras ? `<div class="field" style="margin:4px 0 0"><span>${esc(t('extras'))}</span></div><div class="opt">
        ${(S.cfg.extras || []).map(x => `<button class="chip" data-x="${x}" aria-pressed="${o.extras.includes(x)}">${esc(t('ex_' + x))}</button>`).join('')}</div>` : ''}
      <label class="field"><span>${esc(t('note_item'))}</span><input id="optNote" maxlength="120" value="${esc(o.note)}"></label>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px">
        <div class="qty"><button data-q="-1" aria-label="−">−</button><output>${o.qty}</output><button data-q="1" aria-label="+">+</button></div>
        <button class="btn pri" id="optAdd">${esc(t('add_to'))} · ${eur(price())}</button></div>`;
  };
  draw(true);
  box.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    o.note = $('#optNote')?.value ?? o.note;
    if (b.dataset.h) o.half = b.dataset.h === '1';
    else if (b.dataset.x) o.extras = o.extras.includes(b.dataset.x) ? o.extras.filter(x => x !== b.dataset.x) : [...o.extras, b.dataset.x];
    else if (b.dataset.q) o.qty = Math.max(1, Math.min(20, o.qty + +b.dataset.q));
    else if (b.id === 'optAdd') {
      addToCart({ id: m.id, half: o.half, extras: [...o.extras].sort(), note: o.note.trim() }, o.qty);
      closeModal(); flyFrom(from, m); return;
    } else return;
    const dish = box.querySelector('.bigdish').innerHTML;
    draw(false); box.querySelector('.bigdish').innerHTML = dish;
    if (b.dataset.h || b.dataset.x) box.querySelector('.bigdish .dish')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  };
  openLayer($('#optModal'));
  setTimeout(() => box.querySelector('.chip,.btn')?.focus({ preventScroll: true }), 60);
}

// ---------------------------------------------------------------- carrello
const lineKey = l => `${l.id}|${l.half ? 1 : 0}|${l.extras.join(',')}|${l.note}`;
const unitPrice = l => { const m = item(l.id); return m ? (l.half && m.half ? m.half : m.price) + l.extras.length * (S.cfg?.extra_price ?? .7) : 0; };
function addToCart(line, qty) {
  const k = lineKey(line); const ex = S.cart.find(l => lineKey(l) === k);
  if (ex) ex.qty = Math.min(20, ex.qty + qty); else S.cart.push({ ...line, qty });
  saveCart(); toast(t('added'));
  setTimeout(() => { const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }, calm ? 0 : 650);
}
function saveCart() { S.cart = S.cart.filter(l => S.menu.length === 0 || item(l.id)); store.set('bg_cart', S.cart); renderCart(); }
function flyFrom(el, m) {
  if (calm || !el) return;
  const a = el.getBoundingClientRect(), b = $('#cartBtn').getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'fly'; f.innerHTML = dishHTML(m); document.body.append(f);
  const x0 = a.left + a.width / 2 - 42, y0 = a.top + a.height / 2 - 30;
  f.style.left = x0 + 'px'; f.style.top = y0 + 'px';
  const dx = b.left + b.width / 2 - 42 - x0, dy = b.top - y0;
  f.animate([{ transform: 'translate(0,0) scale(.6) rotate(0)' }, { transform: `translate(${dx * .4}px,${Math.min(dy, 0) - 140}px) scale(1.25) rotate(-25deg)`, offset: .45 },
    { transform: `translate(${dx}px,${dy}px) scale(.25) rotate(30deg)`, opacity: .4 }], { duration: 800, easing: 'cubic-bezier(.45,0,.4,1)' }).onfinish = () => f.remove();
}

function pickupDays() {
  const out = []; const now = madridNow();
  for (let i = 0; i < 8 && out.length < 4; i++) { const d = addDays(now.day, i); if (dayCfg(d) && pickupTimes(d).length) out.push(d); }
  return out;
}
function pickupTimes(day) {
  const c = dayCfg(day); if (!c) return [];
  const now = madridNow(); let from = hm(c.open) + 15; const to = hm(c.close) - 15;
  if (day === now.day) from = Math.max(from, Math.ceil((now.min + (S.cfg.order_lead ?? 15) + 2) / 5) * 5);
  from = Math.ceil(from / 5) * 5;
  const out = [];
  for (let m = from; m <= to; m += m < from + 60 ? 5 : 15) out.push(m);
  return out;
}

function renderCart() {
  const n = S.cart.reduce((a, l) => a + l.qty, 0);
  $('#cartN').textContent = n;
  const body = $('#cartBody'), foot = $('#cartFoot');
  const live = S.orders.filter(o => o.day >= madridNow().day && !['picked', 'cancelled'].includes(o.status));
  const tracker = live.map(o => orderTicket(o, true)).join('');
  if (!S.cart.length) {
    body.innerHTML = tracker + `<div class="empty"><div class="big">🥖</div><h3 style="margin:8px 0">${esc(t('cart_empty'))}</h3><p>${esc(t('cart_empty_p'))}</p>
      <a class="btn ink s" href="#carta" data-close>${esc(t('see_menu'))}</a></div>`;
    foot.innerHTML = ''; return;
  }
  const days = pickupDays();
  if (!days.includes(S.pickDay)) S.pickDay = days[0] || null;
  const times = S.pickDay ? pickupTimes(S.pickDay) : [];
  if (!times.includes(S.pickTime)) S.pickTime = times[0] ?? null;
  const total = S.cart.reduce((a, l) => a + unitPrice(l) * l.qty, 0);
  body.innerHTML = tracker + S.cart.map((l, i) => {
    const m = item(l.id); if (!m) return '';
    const opts = [l.half ? t('half_l') : (m.half ? t('whole') : ''), ...l.extras.map(x => '+' + t('ex_' + x)), l.note ? `“${l.note}”` : ''].filter(Boolean).join(' · ');
    return `<div class="line" style="animation-delay:${i * 40}ms"><div class="thumb">${dishHTML(m)}</div><div class="t">${esc(m.name)}</div><div class="pr">${eur(unitPrice(l) * l.qty)}</div>
      <div class="o">${esc(opts)}</div><div class="q"><button data-dq="${i}" data-d="-1" aria-label="−">−</button><b>${l.qty}</b><button data-dq="${i}" data-d="1" aria-label="+">+</button></div></div>`;
  }).join('') + `
    <form id="orderForm" style="margin-top:18px" autocomplete="on">
      <div class="field"><span>${esc(t('pickup'))}</span></div>
      <div class="times" style="margin-bottom:6px">${days.map(d => `<button type="button" class="chip" data-pd="${d}" aria-pressed="${d === S.pickDay}">${esc(dayLabel(d, { weekday: 'short', day: 'numeric' }))}</button>`).join('')}</div>
      <div class="times" id="pTimes" style="margin-bottom:12px">${times.length ? times.map(m => `<button type="button" class="chip" data-pt="${m}" aria-pressed="${m === S.pickTime}">${mhm(m)}</button>`).join('') : `<span class="sub">${esc(t('no_times'))}</span>`}</div>
      <label class="fchip"><input type="checkbox" name="fact" ${S.me.fact ? 'checked' : ''}> 💼 ${esc(t('f_fact'))}</label>
      <div class="two">
        <label class="field"><span>${esc(t('f_name'))}</span><input name="name" required minlength="2" maxlength="80" autocomplete="name" value="${esc(S.me.name)}"></label>
        <label class="field"><span>${esc(t('f_phone'))}</span><input name="phone" required type="tel" minlength="6" maxlength="30" autocomplete="tel" value="${esc(S.me.phone)}"></label>
      </div>
      <label class="field ${S.me.fact ? 'hide' : ''}" id="compField"><span>${esc(t('f_company'))}</span><input name="company" maxlength="80" autocomplete="organization" value="${esc(S.me.fact ? '' : S.me.company)}"></label>
      <label class="field"><span>${esc(t('note_item'))}</span><textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <div class="err" id="orderErr"></div>
    </form>`;
  foot.innerHTML = `<div class="total"><span>${esc(t('total'))}</span><span>${eur(total)}</span></div>
    <button class="btn pri" style="width:100%" id="sendOrder" ${S.pickTime == null ? 'disabled' : ''}>${esc(t('send_order'))}${S.pickTime != null ? ' · ' + mhm(S.pickTime) : ''}</button>
    <p class="sub" style="text-align:center;margin:8px 0 0">${esc(t('pay_note'))}</p>`;
  const sel = $('#pTimes [aria-pressed=true]'); if (sel) $('#pTimes').scrollLeft = sel.offsetLeft - 60;
}
$('#cartBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.dq != null) { const l = S.cart[+b.dataset.dq]; l.qty += +b.dataset.d; if (l.qty < 1) S.cart.splice(+b.dataset.dq, 1); keepForm(); saveCart(); }
  else if (b.dataset.pd) { keepForm(); S.pickDay = b.dataset.pd; S.pickTime = null; renderCart(); }
  else if (b.dataset.pt) { keepForm(); S.pickTime = +b.dataset.pt; const sc = $('#pTimes').scrollLeft; renderCart(); $('#pTimes').scrollLeft = sc; }
  else if (b.dataset.forget) { S.orders = S.orders.filter(o => o.code !== b.dataset.forget); store.set('bg_orders', S.orders); renderCart(); }
});
$('#cartBody').addEventListener('change', e => {
  if (e.target.name === 'fact') { $('#compField').classList.toggle('hide', e.target.checked); keepForm(); }
});
function keepForm() {
  const f = $('#orderForm'); if (!f) return;
  S.me = { name: f.name.value.trim(), phone: f.phone.value.trim(), fact: f.fact.checked, company: f.fact.checked ? 'Factorial' : f.company.value.trim() };
  store.set('bg_me', S.me);
}
$('#cartFoot').addEventListener('click', async e => {
  if (!e.target.closest('#sendOrder')) return;
  const f = $('#orderForm'); if (!f.reportValidity()) return;
  keepForm();
  const btn = $('#sendOrder'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const r = await rpc('bg_order', { p: {
      day: S.pickDay, time: mhm(S.pickTime), name: S.me.name, phone: S.me.phone, company: S.me.company || null,
      notes: f.notes.value, items: S.cart.map(l => ({ id: l.id, qty: l.qty, half: l.half, extras: l.extras, note: l.note })) } });
    const o = { code: r.code, day: r.day, time: r.time, total: r.total, status: 'new', phone: S.me.phone };
    S.orders = [o, ...S.orders].slice(0, 6); store.set('bg_orders', S.orders);
    S.cart = []; saveCart();
    $('#cartBody').scrollTop = 0;
    celebrate();
  } catch (err) {
    $('#orderErr').textContent = errMsg(err);
    btn.disabled = false; btn.textContent = t('send_order') + ' · ' + mhm(S.pickTime);
  }
});

const STEPS = ['new', 'preparing', 'ready', 'picked'];
function orderTicket(o, small) {
  const i = Math.max(0, STEPS.indexOf(o.status));
  return `<div class="ticket" style="margin-bottom:16px">
    ${small ? '' : '<div class="ok">✓</div>'}
    <div class="kicker">${esc(small ? t('your_order') : t('ordered_t'))}</div>
    <div class="code">${esc(o.code)}</div>
    <p>${esc(t('ordered_p', dayLabel(o.day), mhm(o.time)))} · <b>${eur(o.total)}</b></p>
    ${o.status === 'cancelled' ? `<p><b>${esc(t('st_cancelled'))}</b></p>` : `
    <div class="track"><div class="bar" style="width:calc(${(i / 3) * 100}% - ${i === 3 ? 28 : 0}px)"></div>
      ${STEPS.map((s, k) => `<div class="s ${k <= i ? 'on' : ''} ${k === i && k < 3 ? 'now' : ''}"><i>${['📝', '🔥', '🥖', '✓'][k]}</i>${esc(t('st_' + s))}</div>`).join('')}</div>`}
    ${small ? `<p style="margin-top:10px"><button class="chip sm" data-forget="${esc(o.code)}">${esc(t('close'))}</button></p>` : ''}
  </div>`;
}
function celebrate() {
  const o = S.orders[0];
  $('#cartBody').innerHTML = orderTicket(o, false) + `<p class="sub" style="text-align:center">${esc(t('keep_code'))}</p>`;
  $('#cartFoot').innerHTML = `<button class="btn ink" style="width:100%" data-close>${esc(t('close'))}</button>`;
  confetti();
}
async function pollOrders() {
  const live = S.orders.filter(o => o.day >= madridNow().day && !['picked', 'cancelled'].includes(o.status));
  let changed = false;
  for (const o of live) {
    try {
      const st = await rpc('bg_order_status', { p_code: o.code });
      if (st && st !== o.status) { if (st === 'ready') { toast(t('ready_toast'), 6000); ding(); } o.status = st; changed = true; }
    } catch {}
  }
  if (changed) { store.set('bg_orders', S.orders); if (!$('#orderForm')) renderCart(); }
}
setInterval(() => { if (document.visibilityState === 'visible') pollOrders(); }, 15000);

function ding() {
  try {
    const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .8); o.start(); o.stop(a.currentTime + .8);
  } catch {}
}
function confetti() {
  if (calm) return;
  const bits = ['🥖', '🍅', '🧀', '🥓', '☕', '🍳', '🫒'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    const emoji = i % 3 === 0;
    p.textContent = emoji ? bits[i % bits.length] : '';
    p.style.cssText = `position:fixed;z-index:99;left:${50 + (Math.random() - .5) * 16}%;top:42%;pointer-events:none;font-style:normal;font-size:24px;${emoji ? '' : `width:9px;height:14px;border-radius:2px;background:${['#c8553d', '#f2b632', '#2f6aa8', '#6f7d3c'][i % 4]}`}`;
    document.body.append(p);
    const dx = (Math.random() - .5) * 760, dy = -220 - Math.random() * 320;
    p.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)`, offset: .4 },
      { transform: `translate(${dx * 1.3}px,${dy + 1000}px) rotate(${Math.random() * 1440}deg)`, opacity: 0 }], { duration: 2000 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => p.remove();
  }
}

// ---------------------------------------------------------------- livelli (carrello, finestra, foto)
let lastFocus = null;
function openLayer(el) { lastFocus = document.activeElement; el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
function closeLayer(el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); if (!$('.drawer.open,.modal.open,.lightbox.open')) document.body.style.overflow = ''; lastFocus?.focus?.({ preventScroll: true }); }
const closeModal = () => closeLayer($('#optModal'));
$('#cartBtn').addEventListener('click', () => { renderCart(); openLayer($('#drawer')); });
$('#factBtn').addEventListener('click', () => { S.me.fact = true; S.me.company = 'Factorial'; store.set('bg_me', S.me); });
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { const l = e.target.closest('.drawer,.modal'); if (l) closeLayer(l); }
  const pol = e.target.closest('[data-big]');
  if (pol) { const lb = $('#lightbox'); lb.querySelector('img').src = pol.dataset.big; lb.querySelector('img').alt = pol.querySelector('img').alt; openLayer(lb); }
  else if (e.target.closest('#lightbox')) closeLayer($('#lightbox'));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const l = $('.lightbox.open') || $('.modal.open') || $('.drawer.open'); if (l) closeLayer(l); } });

// ---------------------------------------------------------------- prenotazione
function bookDays() { const now = madridNow(); return Array.from({ length: 21 }, (_, i) => addDays(now.day, i)); }
function slotsFor(day) {
  const c = dayCfg(day); if (!c) return [];
  const now = madridNow(); const out = [];
  for (const [a, b] of c.book || []) for (let m = hm(a); m <= hm(b); m += 30) {
    if (day === now.day && m < now.min + (S.cfg.book_lead ?? 30)) continue;
    out.push(m);
  }
  return out;
}
function renderDays() {
  const days = bookDays();
  if (!S.book.day || !days.includes(S.book.day)) S.book.day = days.find(d => slotsFor(d).length) || days[0];
  $('#days').innerHTML = days.map(d => {
    const dt = new Date(d + 'T12:00:00Z'); const ok = slotsFor(d).length > 0;
    return `<button class="day" data-day="${d}" aria-pressed="${d === S.book.day}" ${ok ? '' : 'disabled'} title="${ok ? '' : esc(t('closed_day'))}">
      <small>${esc(dt.toLocaleDateString(LOC[lang], { weekday: 'short', timeZone: 'UTC' }))}</small><b>${dt.getUTCDate()}</b>
      <small>${esc(dt.toLocaleDateString(LOC[lang], { month: 'short', timeZone: 'UTC' }))}</small></button>`;
  }).join('');
}
$('#days').addEventListener('click', e => {
  const b = e.target.closest('[data-day]'); if (!b || b.disabled) return;
  S.book.day = b.dataset.day; S.book.time = null; S.book.tables = null; renderDays(); loadAvail();
});
const FACES = ['🙂', '😄', '🤓', '😎', '🥳', '😋', '🧔', '👩', '👨‍🦰', '👵', '🧑‍💻', '👱'];
function renderPeople() {
  const n = S.book.people; const k = Math.ceil(n / 4);
  $('#pOut').innerHTML = `${n} <small>${esc(t('people', n).replace(/^\d+\s*/, ''))}</small>`;
  $('#pSub').textContent = n >= (S.cfg?.max_online ?? 16) ? t('more16') : t('tables_n', k);
  $('#pMinus').disabled = n <= 1; $('#pPlus').disabled = n >= (S.cfg?.max_online ?? 16);
  const h = $('#heads'); const cur = h.children.length;
  if (cur > n) [...h.children].slice(n).forEach(c => c.remove());
  for (let i = cur; i < n; i++) { const s = document.createElement('span'); s.textContent = FACES[i % FACES.length]; h.append(s); }
}
function setPeople(d) {
  S.book.people = Math.max(1, Math.min(S.cfg?.max_online ?? 16, S.book.people + d));
  S.book.tables = null; renderPeople(); renderSlots();
}
holdRepeat($('#pMinus'), () => setPeople(-1));
holdRepeat($('#pPlus'), () => setPeople(1));
function holdRepeat(btn, fn) {
  let tm;
  const stop = () => clearTimeout(tm);
  btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); const loop = d => { tm = setTimeout(() => { fn(); loop(Math.max(70, d * .8)); }, d); }; loop(380); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
}

async function loadAvail() {
  const day = S.book.day;
  $('#slots').innerHTML = '<span class="spinner"></span>';
  try { S.book.avail = await rpc('bg_availability', { p_day: day }) || []; }
  catch { S.book.avail = []; }
  if (day === S.book.day) renderSlots();
}
const dur = () => S.cfg?.dur ?? 90;
function renderSlots() {
  const slots = slotsFor(S.book.day);
  const free = slots.map(m => {
    const busy = busyTables(S.book.avail, m, m + dur());
    return { m, busy, run: pick(S.tables, busy, S.book.people), left: S.tables.length - busy.size };
  });
  if (S.book.time != null && !free.find(f => f.m === S.book.time && f.run)) { S.book.time = null; S.book.tables = null; }
  if (S.book.time == null) { const f = free.find(f => f.run); if (f) S.book.time = f.m; }
  $('#slots').innerHTML = free.length ? free.map(f => `<button class="slot" data-m="${f.m}" aria-pressed="${f.m === S.book.time}" ${f.run ? '' : 'disabled'}>${mhm(f.m)}${f.run && f.left <= 3 ? `<span class="few">${esc(t('few'))}</span>` : ''}</button>`).join('')
    : `<span class="sub">${esc(t('no_slots'))}</span>`;
  $('#slotSub').textContent = free.length && !free.some(f => f.run) ? t('e_full') : '';
  renderPlan();
}
$('#slots').addEventListener('click', e => {
  const b = e.target.closest('[data-m]'); if (!b || b.disabled) return;
  S.book.time = +b.dataset.m; S.book.tables = null; renderSlots();
});

function currentBusy() { return S.book.time == null ? new Set() : busyTables(S.book.avail, S.book.time, S.book.time + dur()); }
function currentRun() {
  if (S.book.time == null) return null;
  return S.book.tables || pick(S.tables, currentBusy(), S.book.people);
}
// piantina: pavimento a piastrelle, tavoli di legno; quelli uniti scivolano uno verso l'altro
function planBase() {
  const tile = `<pattern id="floor" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e9dcc4"/><rect width="4" height="4" fill="#d9c7a6"/><rect x="4" y="4" width="4" height="4" fill="#d9c7a6"/><circle cx="4" cy="4" r=".9" fill="#c8553d" opacity=".5"/></pattern>
    <pattern id="deck" width="4" height="100" patternUnits="userSpaceOnUse"><rect width="4" height="100" fill="#b98a5c"/><rect width=".4" height="100" fill="#8b5a36"/></pattern>
    <linearGradient id="woodT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b37a4b"/><stop offset="1" stop-color="#8b5a36"/></linearGradient>`;
  return `<defs>${tile}</defs>
    <rect x="1" y="5" width="98" height="64" rx="2.5" fill="url(#floor)" stroke="#5e3a20" stroke-width="1"/>
    <rect x="1" y="5" width="83" height="2.4" fill="#9cc9e4"/><path d="M8 5v2.4M22 5v2.4M36 5v2.4M50 5v2.4M64 5v2.4M78 5v2.4" stroke="#5e3a20" stroke-width=".4"/>
    <text x="4" y="11.8" font-size="2.8" fill="#7d6b5c" font-family="Archivo,sans-serif" font-weight="800" letter-spacing=".3">${esc(t('z_ventana').toUpperCase())} · C/ PUJADES</text>
    <text x="4" y="40" font-size="2.8" fill="#7d6b5c" font-family="Archivo,sans-serif" font-weight="800" letter-spacing=".3">${esc(t('z_sala').toUpperCase())}</text>
    <rect x="84" y="9" width="11" height="50" rx="2" fill="url(#woodT)" stroke="#5e3a20" stroke-width=".5"/>
    <rect x="84" y="9" width="11" height="2" rx="1" fill="#d9a86d"/>
    ${[16, 26, 36, 46].map(y => `<circle cx="81" cy="${y}" r="1.6" fill="#c8553d" stroke="#9e3c28" stroke-width=".4"/>`).join('')}
    <text x="89.5" y="34" font-size="3.4" fill="#fbf4e6" font-family="Caveat,cursive" font-weight="700" text-anchor="middle" transform="rotate(90 89.5 34)" letter-spacing=".6">${esc(t('bar'))} ☕</text>
    <rect x="77" y="67.5" width="13" height="4" fill="#2b211a"/>
    <text x="83.5" y="70.5" font-size="2.6" fill="#fbf4e6" text-anchor="middle" font-family="Archivo,sans-serif" font-weight="700">${esc(t('door'))}</text>
    <rect x="1" y="75" width="98" height="24" rx="2.5" fill="url(#deck)" stroke="#5e3a20" stroke-width=".8"/>
    <g>${Array.from({ length: 14 }, (_, i) => `<path d="M${1 + i * 7} 75h7v2.4a3.5 2.2 0 0 1-7 0z" fill="${i % 2 ? '#fbf4e6' : '#c8553d'}"/>`).join('')}</g>
    <text x="96" y="96" font-size="3.2" fill="#fbf4e6" font-family="Caveat,cursive" font-weight="700" text-anchor="end">${esc(t('z_terraza'))} · C/ Llacuna 🌿</text>
    <g id="tbls"></g>`;
}
let planBuilt = false;
function renderPlan() {
  const svg = $('#planSvg');
  if (!planBuilt) { svg.innerHTML = planBase(); planBuilt = true; }
  const busy = currentBusy(); const run = currentRun() || []; const sel = new Set(run);
  const W = 12, Hh = 9;
  const z = id => S.tables.find(x => x.id === id);
  // quanto si sposta ogni tavolo unito: le distanze tra loro si chiudono
  const shift = {};
  if (run.length > 1) { const c = run.reduce((a, id) => a + z(id).x, 0) / run.length; run.forEach(id => { shift[id] = (c - z(id).x) * (1 - W / 18); }); }
  const g = $('#tbls', svg);
  if (!g.children.length || g.dataset.lang !== lang) {
    g.dataset.lang = lang;
    g.innerHTML = S.tables.map(x => `<g class="tbl" data-t="${x.id}" role="button" tabindex="0" aria-label="${esc(t('table'))} ${x.id}"><g class="mv">
      ${[[-3, -1], [3, -1], [-3, 1], [3, 1]].map(([dx, dy]) => `<rect class="ch" x="${x.x + dx - 2.1}" y="${x.y + dy * (Hh / 2 + 2.3) - 1.2}" width="4.2" height="2.4" rx="1.1"/>`).join('')}
      <rect class="top" x="${x.x - W / 2}" y="${x.y - Hh / 2}" width="${W}" height="${Hh}" rx="1.8" stroke-width=".5"/>
      <text x="${x.x}" y="${x.y + 1.6}" text-anchor="middle" font-size="4.6" font-family="Caveat,cursive" font-weight="700">${x.id}</text></g></g>`).join('');
  }
  S.tables.forEach(x => {
    const el = $(`[data-t="${x.id}"]`, g); const st = sel.has(x.id) ? 'mine' : busy.has(x.id) ? 'busy' : 'free';
    el.setAttribute('class', 'tbl ' + st); el.setAttribute('tabindex', st === 'busy' ? -1 : 0);
    el.querySelector('.mv').style.transform = `translateX(${shift[x.id] || 0}px)`;
    el.querySelector('.top').setAttribute('fill', { mine: '#f2b632', busy: '#4b423b', free: '#a0704a' }[st]);
    el.querySelector('.top').setAttribute('stroke', { mine: '#c98f12', busy: '#2b211a', free: '#5e3a20' }[st]);
    el.querySelectorAll('.ch').forEach(c => c.setAttribute('fill', st === 'busy' ? '#3a332d' : st === 'mine' ? '#c8553d' : '#6e4527'));
    el.querySelector('text').setAttribute('fill', st === 'mine' ? '#2b211a' : '#fbf4e6');
  });
  const msg = $('#planMsg');
  if (S.book.time == null) msg.textContent = slotsFor(S.book.day).length ? t('pick_slot') : t('no_slots');
  else if (!run.length) msg.textContent = t('slot_full');
  else msg.innerHTML = t('plan_yours', `${run.length > 1 ? t('tables') : t('table')} ${run.join(' + ')} · ${t('z_' + z(run[0]).zone)}`, run.length * 4);
}
function choose(id) {
  if (S.book.time == null) return;
  const busy = currentBusy(); const k = Math.ceil(S.book.people / 4);
  const cands = runs(S.tables, k).filter(r => r.includes(id) && r.every(x => !busy.has(x)));
  if (!cands.length) { toast(busy.has(id) ? t('lg_busy') : t('plan_cant')); return; }
  cands.sort((a, b) => Math.abs(a.indexOf(id) - (k - 1) / 2) - Math.abs(b.indexOf(id) - (k - 1) / 2));
  S.book.tables = cands[0]; renderPlan();
}
$('#planSvg').addEventListener('click', e => { const g = e.target.closest('[data-t]'); if (g) choose(+g.dataset.t); });
$('#planSvg').addEventListener('keydown', e => { const g = e.target.closest('[data-t]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(+g.dataset.t); } });

$('#bookForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target; const err = $('#bookErr'); err.textContent = '';
  if (S.book.time == null) { err.textContent = t('pick_slot'); return; }
  const btn = $('#bookBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  S.me.name = f.name.value.trim(); S.me.phone = f.phone.value.trim(); store.set('bg_me', S.me);
  try {
    const r = await rpc('bg_book', { p: { day: S.book.day, time: mhm(S.book.time), people: S.book.people, tables: currentRun(),
      name: f.name.value, phone: f.phone.value, email: f.email.value,
      notes: (S.book.round ? `🍺 Primera ronda: ${S.book.round} cañas. ` : '') + f.notes.value } });
    f.classList.add('hide'); $$('#bookPanel .step:not(form)').forEach(s => s.classList.add('hide'));
    const done = $('#bookDone'); done.classList.remove('hide');
    done.innerHTML = `<div class="ticket"><div class="ok">✓</div><div class="kicker">${esc(t('booked_t'))}</div>
      <div class="code">${esc(r.code)}</div>
      <p><b style="color:var(--ink)">${esc(t('booked_p', dayLabel(r.day), mhm(r.start), t('people', r.people), `${r.tables.length > 1 ? t('tables') : t('table')} ${r.tables.join(' + ')}`))}</b></p>
      <hr><p>${esc(t('keep_code'))}</p></div>
      <button class="btn ghost s" style="margin-top:18px" id="again">${esc(t('new_booking'))}</button>`;
    confetti();
    S.book.avail.push({ s: r.start, e: r.end, t: r.tables }); S.book.tables = r.tables; renderPlan();
    $('#again').onclick = () => { done.classList.add('hide'); f.classList.remove('hide'); f.reset(); prefill(); $$('#bookPanel .step').forEach(s => s.classList.remove('hide')); S.book.tables = null; renderSlots(); };
  } catch (ex) {
    err.textContent = errMsg(ex);
    if (['bg:taken', 'bg:full'].includes(ex.code)) { S.book.tables = null; loadAvail(); }
  } finally { btn.disabled = false; btn.textContent = t('b_confirm'); }
});
function prefill() { const f = $('#bookForm'); if (S.me.name && !f.name.value) f.name.value = S.me.name; if (S.me.phone && !f.phone.value) f.phone.value = S.me.phone; }


// ---------------------------------------------------------------- afterwork
function drawLights() {
  const W = 1200, n = 26; let path = 'M0 10', bulbs = '';
  for (let i = 0; i < 3; i++) { const x0 = i * W / 3, x1 = (i + 1) * W / 3; path += ` Q${(x0 + x1) / 2} 90 ${x1} 10`; }
  const colors = ['#ffe28a', '#ffb36b', '#ff8f7a', '#fff1c2'];
  for (let i = 0; i <= n; i++) {
    const x = i * W / n, seg = Math.min(2, Math.floor(x / (W / 3))), u = (x - seg * W / 3) / (W / 3);
    const y = (1 - u) * (1 - u) * 10 + 2 * (1 - u) * u * 90 + u * u * 10;
    const c = colors[i % 4];
    bulbs += `<g class="bulb"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="#2b211a" stroke-width="2"/><circle cx="${x}" cy="${y + 16}" r="14" fill="${c}" opacity=".25"/><ellipse cx="${x}" cy="${y + 15}" rx="5" ry="7" fill="${c}"/></g>`;
  }
  $('#lights').innerHTML = `<svg viewBox="0 0 ${W} 110" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#2b211a" stroke-width="2.5"/>${bulbs}</svg>`;
}
function renderBeerlist() {
  $('#beerlist').innerHTML = S.menu.filter(m => m.cat === 'cervezas' && m.available).slice(0, 8)
    .map(m => `<li>${dishHTML(m)}<div><b>${esc(m.name)}</b><span>${eur(m.price)}</span></div></li>`).join('');
}
$('#awSee').addEventListener('click', () => { S.cat = 'cervezas'; renderCats(); renderMenu(); $('#carta').scrollIntoView({ behavior: 'smooth' }); });
$('#awBook').addEventListener('click', () => {
  // il primo giorno con un turno dalle 18:00 in poi, 6 persone, primo giro da 6
  const days = bookDays();
  const day = days.find(d => slotsFor(d).some(m => m >= 18 * 60)) || S.book.day;
  S.book.day = day; S.book.people = 6; S.book.tables = null;
  const late = slotsFor(day).filter(m => m >= 18 * 60);
  S.book.time = late[0] ?? null; S.book.round = 6;
  renderDays(); renderPeople(); renderRound();
  loadAvail().then(() => {
    const free = slotsFor(day).filter(m => m >= 18 * 60).find(m => pick(S.tables, busyTables(S.book.avail, m, m + dur()), S.book.people));
    if (free != null) { S.book.time = free; renderSlots(); }
  });
  $('#reservar').scrollIntoView({ behavior: 'smooth' });
  $(`#days [data-day="${day}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
function renderRound() {
  $('#rOut').textContent = S.book.round;
  $('#round').classList.toggle('on', S.book.round > 0);
  $('#rMinus').disabled = S.book.round <= 0;
}
$('#rMinus').addEventListener('click', () => { S.book.round = Math.max(0, S.book.round - 1); renderRound(); });
$('#rPlus').addEventListener('click', () => { S.book.round = Math.min(40, S.book.round + 1); renderRound(); });

// ---------------------------------------------------------------- orari e cartello "aperto"
function renderHours() {
  const today = isoDow(madridNow().day);
  const base = '2026-11-23'; // un lunedì
  $('#hours').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(d => {
    const c = S.cfg.days[String(d)];
    const name = new Date(addDays(base, d - 1) + 'T12:00:00Z').toLocaleDateString(LOC[lang], { weekday: 'long', timeZone: 'UTC' });
    return `<tr class="${d === today ? 'today' : ''}"><td style="text-transform:capitalize">${esc(name)}</td><td>${c ? `${c.open} – ${c.close}` : esc(t('closed_day'))}</td></tr>`;
  }).join('');
}
function renderOpen() {
  const now = madridNow(); const c = dayCfg(now.day);
  const open = c && now.min >= hm(c.open) && now.min < hm(c.close);
  $('#openTxt').innerHTML = `<i class="${open ? '' : 'off'}"></i>${esc(open ? t('open_until', c.close) : t('closed_sign'))}`;
}

// ---------------------------------------------------------------- consulta / annulla
$('#lookForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target; const out = $('#lookRes'); out.innerHTML = '<span class="spinner"></span>';
  try {
    const r = await rpc('bg_lookup', { p_code: f.code.value, p_phone: f.phone.value });
    if (!r) { out.innerHTML = `<p class="err">${esc(t('not_found'))}</p>`; return; }
    const canCancel = (r.kind === 'booking' && r.status === 'confirmed') || (r.kind === 'order' && r.status === 'new');
    const what = r.kind === 'booking'
      ? t('booked_p', dayLabel(r.day), mhm(r.start), t('people', r.people), `${r.tables.length > 1 ? t('tables') : t('table')} ${r.tables.join(' + ')}`)
      : `${t('ordered_p', dayLabel(r.day), mhm(r.time))} · ${eur(r.total)}`;
    out.innerHTML = `<div class="ticket" style="text-align:left;max-width:520px"><div class="code" style="font-size:34px">${esc(r.code)}</div>
      <p><b style="color:var(--ink)">${esc(what)}</b></p>${r.kind === 'order' ? `<p>${r.items.map(i => `${i.qty}× ${esc(i.name)}${i.half ? ' (½)' : ''}`).join(', ')}</p>` : ''}
      <p><span class="tag">${esc(t('st_' + r.status))}</span></p>
      ${canCancel ? `<button class="btn ghost s" id="doCancel" style="color:var(--terra)">${esc(t('cancel'))}</button>` : ''}</div>`;
    $('#doCancel')?.addEventListener('click', async () => {
      if (!confirm(t('cancel_q'))) return;
      const ok = await rpc('bg_cancel', { p_code: f.code.value, p_phone: f.phone.value }).catch(() => false);
      toast(ok ? t('cancelled') : t('e_error'));
      if (ok) { f.requestSubmit(); S.orders.forEach(o => { if (o.code === f.code.value.toUpperCase().trim()) o.status = 'cancelled'; }); store.set('bg_orders', S.orders); loadAvail(); }
    });
  } catch (ex) { out.innerHTML = `<p class="err">${esc(errMsg(ex))}</p>`; }
});

// ---------------------------------------------------------------- avvio
async function init() {
  drawAwning(); drawLights(); applyLang(); watchReveal();
  try {
    const [menu, tables, cfg] = await Promise.all([
      table('bg_menu', 'select=*&order=sort'),
      table('bg_tables', 'select=*&order=id'),
      table('bg_settings', 'select=value&key=eq.config'),
    ]);
    S.menu = menu.map(m => ({ ...m, price: +m.price, half: m.half == null ? null : +m.half }));
    S.tables = tables; S.cfg = cfg[0].value;
  } catch {
    $('#menu').innerHTML = `<div class="empty"><div class="big">😕</div><b>${esc(t('e_error'))}</b></div>`; mountHero(); return;
  }
  saveCart(); prefill(); renderRound(); applyLang(); loadAvail(); pollOrders(); mountHero(); watchReveal();
  setInterval(renderOpen, 60000);
  if (location.hash === '#pedido') { renderCart(); openLayer($('#drawer')); }
}
init();
window.__bongust = S;
