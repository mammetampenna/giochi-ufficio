// Illustrazioni dei piatti, a strati: al passaggio del mouse si "aprono" in 3D.
// Ogni strato è un <svg> sovrapposto (viewBox 200×140), così si può muovere da solo.

const VB = 'viewBox="0 0 200 140"';
const L = (body, i, up, extra = '') => `<div class="L" style="--n:${i};--up:${up}px${extra}"><svg ${VB} aria-hidden="true">${body}</svg></div>`;
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- ingredienti (vista di lato, centrati su y)
function band(y, h, fill, edge, wav = 3, x0 = 26, x1 = 174) {
  // fetta ondulata da x0 a x1
  let top = `M${x0} ${y}`, bot = '';
  for (let x = x0; x <= x1; x += 12) top += ` Q${x + 6} ${y - wav} ${x + 12} ${y}`;
  for (let x = x1; x >= x0; x -= 12) bot += ` Q${x - 6} ${y + h + wav} ${x - 12} ${y + h}`;
  return `<path d="${top} L${x1 + 4} ${y + h / 2}${bot} L${x0 - 4} ${y + h / 2}Z" fill="${fill}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>`;
}
function slices(y, r, fill, inner, n = 6, x0 = 34, x1 = 166, dots = '') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * i / (n - 1);
    s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .42}" fill="${fill}" stroke="${inner}" stroke-width="1.4"/>`;
    if (dots) s += `<circle cx="${x - r * .35}" cy="${y - 1}" r="1.3" fill="${dots}"/><circle cx="${x + r * .3}" cy="${y + 1}" r="1.1" fill="${dots}"/>`;
  }
  return s;
}
const ING = {
  ham: y => band(y, 6, '#f4a9a3', '#d97c78', 3),
  serrano: y => band(y, 5, '#c64b4f', '#8f2b33', 4) + band(y + 1, 1.4, '#f6d9cf', 'none', 4, 40, 160),
  iberico: y => band(y, 5, '#a8303a', '#6e1a24', 4) + band(y + 1.5, 1.2, '#f4dcd0', 'none', 4, 50, 150),
  chorizo: y => slices(y + 3, 10, '#c0392b', '#8e2219', 7, 32, 168, '#f3c6a5'),
  salchichon: y => slices(y + 3, 10, '#b84a4f', '#7d2a30', 7, 32, 168, '#fff1e6'),
  fuet: y => slices(y + 3, 8, '#9e3e3a', '#5e211f', 8, 32, 168, '#f6e7d8'),
  butifarra: y => slices(y + 3, 9, '#e8c9b3', '#b48d74', 7, 32, 168, '#c89f88'),
  sausage: y => slices(y + 3, 9, '#c47a55', '#8a4e32', 7, 32, 168),
  chistorra: y => slices(y + 3, 7, '#e0662a', '#a3421a', 9, 30, 170),
  cheese: y => band(y, 4, '#f7cf47', '#d8a51d', 1) + `<path d="M58 ${y + 4} l6 9 6-9M128 ${y + 4} l5 7 5-7" fill="#f7cf47" stroke="#d8a51d" stroke-width="1.4" stroke-linejoin="round"/>`,
  camembert: y => band(y, 5, '#fbf3e2', '#d9c7a3', 1),
  roquefort: y => band(y, 4, '#f2efe6', '#c9c4b0', 2) + Array.from({ length: 9 }, (_, i) => `<circle cx="${40 + i * 15}" cy="${y + 2}" r="1.6" fill="#6f8aa6"/>`).join(''),
  lettuce: y => { let d = `M24 ${y + 4}`; for (let x = 24; x < 176; x += 8) d += ` q4 -10 8 0`; return `<path d="${d} L176 ${y + 7} L24 ${y + 7}Z" fill="#7cc04b" stroke="#4f8f2a" stroke-width="1.6" stroke-linejoin="round"/>`; },
  tomato: y => slices(y + 3, 11, '#e2412f', '#b72a1c', 6, 38, 162, '#f6b19b'),
  tuna: y => { const r = rnd(7); let s = ''; for (let i = 0; i < 16; i++) s += `<ellipse cx="${32 + i * 9 + r() * 4}" cy="${y + 3 + r() * 3}" rx="${6 + r() * 3}" ry="3.6" fill="${i % 2 ? '#e3b6a0' : '#d39b84'}" stroke="#a96d58" stroke-width="1"/>`; return s; },
  chicken: y => { const r = rnd(3); let s = ''; for (let i = 0; i < 9; i++) s += `<rect x="${30 + i * 16}" y="${y + r() * 3}" width="16" height="8" rx="4" fill="${i % 2 ? '#e3b277' : '#d39a57'}" stroke="#a46a2c" stroke-width="1.2"/>`; return s; },
  lomo: y => slices(y + 3, 12, '#c98f6d', '#8f5a3c', 6, 36, 164, '#e9c5ad'),
  bacon: y => band(y, 3, '#e0857a', '#a94a40', 5) + band(y + 4, 3, '#f5c9bd', '#a94a40', 5),
  omelette: y => band(y, 7, '#f8d76b', '#d9ab2d', 1),
  tortilla: y => `<rect x="26" y="${y - 3}" width="148" height="14" rx="6" fill="#f3c654" stroke="#c99a26" stroke-width="1.6"/><path d="M34 ${y + 3}h20M70 ${y + 6}h16M110 ${y + 2}h22M146 ${y + 6}h14" stroke="#e6a93a" stroke-width="2" stroke-linecap="round"/>`,
  anchovy: y => Array.from({ length: 5 }, (_, i) => `<path d="M${36 + i * 27} ${y + 3}q10 -6 22 0q-10 6 -22 0z" fill="#8c8f96" stroke="#5d6066" stroke-width="1.2"/>`).join(''),
  sobrasada: y => band(y, 5, '#e9733f', '#b44d22', 2),
  onion: y => Array.from({ length: 7 }, (_, i) => `<ellipse cx="${36 + i * 21}" cy="${y + 3}" rx="9" ry="3" fill="none" stroke="#b07bc0" stroke-width="2"/>`).join(''),
  pepper: y => Array.from({ length: 6 }, (_, i) => `<path d="M${32 + i * 24} ${y + 4}q10 -7 20 0" fill="none" stroke="#4e9a2e" stroke-width="4" stroke-linecap="round"/>`).join(''),
  egg: y => `<ellipse cx="100" cy="${y + 3}" rx="62" ry="5" fill="#fffaf0" stroke="#e3d6bd" stroke-width="1.4"/><ellipse cx="100" cy="${y + 2}" rx="16" ry="4" fill="#f7b928"/>`,
  patty: y => `<rect x="34" y="${y - 3}" width="132" height="13" rx="6.5" fill="#7a4428" stroke="#4e2a17" stroke-width="1.6"/><path d="M44 ${y + 2}h12M70 ${y + 5}h10M96 ${y + 1}h14M126 ${y + 5}h12" stroke="#5c321d" stroke-width="2" stroke-linecap="round"/>`,
  moruno: y => Array.from({ length: 7 }, (_, i) => `<rect x="${28 + i * 21}" y="${y - 2}" width="18" height="11" rx="4" fill="${i % 2 ? '#b8662e' : '#c97a38'}" stroke="#7e3f16" stroke-width="1.3"/>`).join('') + `<path d="M20 ${y + 3}h162" stroke="#c9a27a" stroke-width="1.6"/>`,
};

// ---------------------------------------------------------------- pani
const BREAD = `<defs><linearGradient id="bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7a957"/><stop offset="1" stop-color="#c27a2e"/></linearGradient>
  <linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d48c3c"/><stop offset="1" stop-color="#a9621f"/></linearGradient></defs>`;
const baguetteTop = y => `${BREAD}<path d="M14 ${y}C16 ${y - 34} 58 ${y - 40} 100 ${y - 40}S184 ${y - 34} 186 ${y}C150 ${y + 6} 50 ${y + 6} 14 ${y}Z" fill="url(#bt)" stroke="#8f531a" stroke-width="2"/>
  <g stroke="#f6d59b" stroke-width="5" stroke-linecap="round" opacity=".9"><path d="M44 ${y - 22}l18 10"/><path d="M80 ${y - 30}l18 10"/><path d="M116 ${y - 30}l18 10"/><path d="M150 ${y - 22}l16 9"/></g>
  <path d="M34 ${y - 14}q20 -16 54 -20" stroke="#fff" stroke-opacity=".35" stroke-width="4" fill="none" stroke-linecap="round"/>`;
const baguetteBot = y => `${BREAD}<path d="M16 ${y}C50 ${y - 5} 150 ${y - 5} 184 ${y}C182 ${y + 18} 150 ${y + 24} 100 ${y + 24}S18 ${y + 18} 16 ${y}Z" fill="url(#bb)" stroke="#8f531a" stroke-width="2"/>`;
const bunTop = y => `${BREAD}<path d="M40 ${y}C40 ${y - 44} 160 ${y - 44} 160 ${y}Z" fill="url(#bt)" stroke="#8f531a" stroke-width="2"/>${[[70, -24], [92, -32], [112, -26], [130, -18], [84, -16], [104, -14]].map(([x, d]) => `<ellipse cx="${x}" cy="${y + d}" rx="2.4" ry="1.4" fill="#fbecc8"/>`).join('')}`;
const bunBot = y => `${BREAD}<path d="M42 ${y}h116c0 14-10 20-58 20S42 ${y + 14} 42 ${y}Z" fill="url(#bb)" stroke="#8f531a" stroke-width="2"/>`;
const toast = (y, seeds) => `<path d="M30 ${y - 13}h140c4 0 6 2 6 6v8c0 4-2 6-6 6H30c-4 0-6-2-6-6v-8c0-4 2-6 6-6z" fill="${seeds ? '#c99258' : '#f0d6a6'}" stroke="#a86f35" stroke-width="2"/>
  <path d="M26 ${y - 11}h148" stroke="#b9803f" stroke-width="3"/>${seeds ? Array.from({ length: 14 }, (_, i) => `<ellipse cx="${36 + i * 10}" cy="${y - 4 + (i % 3)}" rx="2" ry="1.1" fill="#6e4a24"/>`).join('') : `<g stroke="#b9803f" stroke-width="2.5" opacity=".7"><path d="M50 ${y - 8}l10 6M90 ${y - 8}l10 6M130 ${y - 8}l10 6"/></g>`}`;

// ---------------------------------------------------------------- composizioni
const BOCA = {
  'jamon-dulce': ['ham', 'ham'], 'butifarra-blanca': ['butifarra'], chorizo: ['chorizo'], fuet: ['fuet'], salchichon: ['salchichon'],
  'queso-manchego': ['cheese', 'cheese'], atun: ['tuna'], 'chistorra-queso': ['chistorra', 'cheese'], anchoas: ['anchovy'],
  'vegetal-atun': ['lettuce', 'tomato', 'tuna'], 'vegetal-jamon': ['lettuce', 'tomato', 'ham'], 'vegetal-pollo': ['lettuce', 'tomato', 'chicken'],
  'tortilla-francesa': ['omelette'], 'tortilla-patata': ['tortilla'], 'bacon-queso': ['bacon', 'cheese'], 'lomo-queso': ['lomo', 'cheese'],
  'sobrasada-queso': ['sobrasada', 'cheese'], 'jamon-serrano': ['tomato', 'serrano'], 'jamon-iberico': ['tomato', 'iberico'],
  'salchichon-iberico': ['salchichon'], 'chorizo-iberico': ['chorizo'],
  aranes: ['bacon', 'roquefort', 'onion'], divino: ['lomo', 'roquefort'], trio: ['bacon', 'cheese', 'lomo'], campesino: ['serrano', 'camembert'],
  'salchichas-pais': ['sausage', 'onion', 'cheese'], 'pollo-queso-pimiento': ['chicken', 'cheese', 'pepper'], 'panceta-queso-pimiento': ['bacon', 'cheese', 'pepper'],
  'pincho-moruno': ['moruno'],
};
const BURGER = { 'new-york': ['lettuce', 'tomato', 'egg', 'cheese', 'patty', 'onion'] };
const BIKINI = { bikini: [['ham', 'cheese'], 0], 'bikini-8-cereales': [['ham', 'cheese'], 1], 'bikini-mallorquina': [['sobrasada', 'cheese'], 0],
  'bikini-doble': [['ham', 'cheese', '|', 'ham', 'cheese'], 0], 'sandwich-atun': [['lettuce', 'tomato', 'tuna'], 0] };

function stack(id, fills, top, bot, gap = 9) {
  // dal basso: pane, ripieni, pane. "up" = quanto si alza lo strato all'apertura
  const n = fills.length; const base = 92;
  let html = L(bot(base + 6), 0, 4);
  fills.forEach((f, i) => { const y = base - (i + 1) * gap; html += L(ING[f](y), i + 1, -10 - i * 9); });
  html += L(top(base - n * gap - 2), n + 1, -30 - n * 9, ';--rot:-4deg');
  return html;
}
function bikini(fills, seeds) {
  let html = '', y = 106, i = 0;
  html += L(toast(y, seeds), i++, 4);
  for (const f of fills) {
    if (f === '|') { y -= 18; html += L(toast(y, seeds), i, -8 - i * 7); i++; continue; }
    y -= 7; html += L(ING[f](y), i, -8 - i * 7); i++;
  }
  html += L(toast(y - 5, seeds), i, -24 - i * 7, ';--rot:-5deg');
  return html;
}
function hotdog() {
  return L(`${BREAD}<path d="M18 86c0 26 40 34 82 34s82-8 82-34c-30 10-134 10-164 0z" fill="url(#bb)" stroke="#8f531a" stroke-width="2"/>`, 0, 4)
    + L(`<rect x="12" y="70" width="176" height="18" rx="9" fill="#c8643b" stroke="#8c3d1e" stroke-width="2"/><path d="M30 76h140" stroke="#e48e62" stroke-width="3" stroke-linecap="round"/>`, 1, -12)
    + L(`<path d="M26 72q12 -8 24 0t24 0 24 0 24 0 24 0 24 0" fill="none" stroke="#f2c230" stroke-width="3.5" stroke-linecap="round"/>`, 2, -22)
    + L(`${BREAD}<path d="M18 74c0-26 40-34 82-34s82 8 82 34c-30-8-134-8-164 0z" fill="url(#bt)" stroke="#8f531a" stroke-width="2"/>`, 3, -34, ';--rot:-4deg');
}

// ---------------------------------------------------------------- piatti combinati (vista dall'alto, piatto ovale)
const plate = `<ellipse cx="100" cy="78" rx="92" ry="54" fill="#fffdf8" stroke="#d9d2c2" stroke-width="2"/><ellipse cx="100" cy="78" rx="80" ry="45" fill="none" stroke="#2f6aa8" stroke-width="2.5" stroke-dasharray="1 5" stroke-linecap="round"/><ellipse cx="100" cy="78" rx="70" ry="38" fill="#fbf7ee"/>`;
const P = {
  fries: (x, y) => Array.from({ length: 11 }, (_, i) => `<rect x="${x - 22 + (i * 7) % 40}" y="${y - 14 + (i * 5) % 20}" width="5" height="${20 + (i % 3) * 4}" rx="2" fill="${i % 2 ? '#f7cb4d' : '#f3b93a'}" stroke="#c98d1d" stroke-width="1" transform="rotate(${(i * 37) % 70 - 35} ${x} ${y})"/>`).join(''),
  egg: (x, y) => `<path d="M${x - 18} ${y}c-2-12 10-18 20-16s18 4 16 14-8 16-20 15-15-4-16-13z" fill="#fff" stroke="#e8dfcd" stroke-width="1.5"/><circle cx="${x}" cy="${y - 1}" r="7.5" fill="#f6a41c"/><circle cx="${x - 2}" cy="${y - 3}" r="2.2" fill="#ffd27a"/>`,
  bacon: (x, y) => [0, 8].map(d => `<path d="M${x - 24} ${y + d}q8 -6 16 0t16 0 16 0" fill="none" stroke="#c9574a" stroke-width="6" stroke-linecap="round"/><path d="M${x - 24} ${y + d}q8 -6 16 0t16 0 16 0" fill="none" stroke="#f3c2b6" stroke-width="2" stroke-linecap="round"/>`).join(''),
  patty: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="15" fill="#7a4428" stroke="#4e2a17" stroke-width="2"/><path d="M${x - 12} ${y - 4}h8M${x + 2} ${y + 3}h10M${x - 6} ${y + 6}h6" stroke="#5c321d" stroke-width="2" stroke-linecap="round"/>`,
  skewer: (x, y) => `<path d="M${x - 34} ${y + 10}L${x + 36} ${y - 10}" stroke="#c9a27a" stroke-width="2.5"/>` + [-24, -8, 8, 24].map((d, i) => `<rect x="${x + d - 7}" y="${y - d * .28 - 7}" width="14" height="14" rx="4" fill="${i % 2 ? '#c27a38' : '#d89048'}" stroke="#7e3f16" stroke-width="1.3"/>`).join(''),
  lomo: (x, y) => [0, 1].map(i => `<ellipse cx="${x - 8 + i * 14}" cy="${y - 4 + i * 8}" rx="16" ry="10" fill="#d8a47e" stroke="#9b643f" stroke-width="1.5"/><path d="M${x - 16 + i * 14} ${y - 6 + i * 8}l14 4" stroke="#b77c52" stroke-width="2"/>`).join(''),
  croquetas: (x, y) => [0, 1, 2].map(i => `<rect x="${x - 20 + i * 13}" y="${y - 10 + (i % 2) * 6}" width="12" height="20" rx="6" fill="#c9843a" stroke="#8a5420" stroke-width="1.4"/>`).join(''),
  sausages: (x, y) => [0, 1].map(i => `<rect x="${x - 26}" y="${y - 8 + i * 11}" width="50" height="9" rx="4.5" fill="#a8583a" stroke="#6b3220" stroke-width="1.4" transform="rotate(${i * 8 - 6} ${x} ${y})"/>`).join(''),
  butifarra: (x, y) => `<path d="M${x - 30} ${y + 6}q30 -26 60 -6" fill="none" stroke="#6b3220" stroke-width="13" stroke-linecap="round"/><path d="M${x - 30} ${y + 6}q30 -26 60 -6" fill="none" stroke="#b36b45" stroke-width="10" stroke-linecap="round"/>`,
  beans: (x, y) => Array.from({ length: 14 }, (_, i) => `<ellipse cx="${x - 16 + (i * 9) % 34}" cy="${y - 10 + (i * 7) % 22}" rx="4.5" ry="3" fill="#f3ead6" stroke="#cbbd9c" stroke-width="1"/>`).join(''),
  rings: (x, y) => [[-12, -6], [8, -8], [-2, 6], [16, 6], [-18, 8]].map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="9" ry="7" fill="none" stroke="#e7b354" stroke-width="5"/>`).join('') + `<path d="M${x + 20} ${y - 16}a6 6 0 1 0 8 6z" fill="#f4e04d" stroke="#c9b22a" stroke-width="1"/>`,
  salad: (x, y) => `<path d="M${x - 18} ${y + 6}q-6 -18 10 -16q4 -12 16 -4q14 -4 12 10q8 10 -6 14q-8 8 -18 2q-14 4 -14 -6z" fill="#86c656" stroke="#4f8f2a" stroke-width="1.5"/><circle cx="${x - 4}" cy="${y}" r="5" fill="#e2412f"/><circle cx="${x + 8}" cy="${y + 4}" r="4" fill="#e2412f"/><path d="M${x - 10} ${y - 6}h6M${x + 4} ${y - 8}h5" stroke="#f3d34a" stroke-width="3" stroke-linecap="round"/>`,
  steak: (x, y) => `<path d="M${x - 26} ${y - 4}c4-14 30-16 44-8s12 22-6 24-42 2-38-16z" fill="#8a4a2e" stroke="#5a2c18" stroke-width="2"/><g stroke="#5a2c18" stroke-width="3" opacity=".6"><path d="M${x - 16} ${y - 8}l20 14M${x - 6} ${y - 12}l20 14"/></g>`,
  chicken: (x, y) => `<path d="M${x - 24} ${y}c0-12 18-16 32-12s18 14 8 20-40 6-40-8z" fill="#e7b981" stroke="#b07a3c" stroke-width="2"/><g stroke="#c6863f" stroke-width="3" opacity=".7"><path d="M${x - 14} ${y - 6}l16 10M${x - 4} ${y - 9}l16 10"/></g>`,
};
const COMBO = {
  'bacon-huevos': [['bacon', 72, 58], ['egg', 120, 56], ['egg', 128, 92], ['fries', 72, 94]],
  'hamburguesa-huevo': [['patty', 76, 64], ['egg', 126, 60], ['fries', 104, 96]],
  'pincho-pollo': [['skewer', 92, 64], ['fries', 116, 94]],
  'lomo-croquetas': [['lomo', 74, 66], ['croquetas', 128, 66], ['fries', 100, 98]],
  'salchichas-huevos': [['sausages', 76, 62], ['egg', 128, 64], ['fries', 100, 98]],
  'butifarra-judias': [['butifarra', 80, 70], ['beans', 132, 66], ['egg', 104, 98]],
  calamares: [['rings', 80, 70], ['fries', 126, 62], ['salad', 124, 96]],
  'pollo-ensalada': [['chicken', 78, 70], ['fries', 128, 62], ['salad', 126, 98]],
  bistec: [['steak', 80, 72], ['fries', 130, 62], ['salad', 128, 98]],
};
const steam = `<g class="steam" fill="none" stroke="#c9bfae" stroke-width="3" stroke-linecap="round"><path d="M86 34c-6-8 6-12 0-22"/><path d="M100 30c-6-8 6-12 0-22"/><path d="M114 34c-6-8 6-12 0-22"/></g>`;

// ---------------------------------------------------------------- bevande
const DRINK = {
  'cafe-solo': `<ellipse cx="100" cy="116" rx="44" ry="9" fill="#fffdf8" stroke="#d9d2c2" stroke-width="2"/><path d="M76 72h48l-6 38H82z" fill="#fff" stroke="#cfc6b3" stroke-width="2"/><path d="M124 80q16 2 8 18" fill="none" stroke="#cfc6b3" stroke-width="5"/><ellipse cx="100" cy="72" rx="24" ry="5" fill="#5a3418"/><ellipse cx="96" cy="71" rx="8" ry="2" fill="#a9754b"/>`,
  cortado: `<path d="M80 58h40l-4 56H84z" fill="#f6ead8" fill-opacity=".55" stroke="#b9ad97" stroke-width="2"/><path d="M82 82h36l-2 30H84z" fill="#8a5a33"/><path d="M81 66h38l-1 16H82z" fill="#efd7b2"/><ellipse cx="100" cy="116" rx="36" ry="7" fill="#fffdf8" stroke="#d9d2c2" stroke-width="2"/>`,
  'cafe-leche': `<ellipse cx="100" cy="118" rx="52" ry="10" fill="#fffdf8" stroke="#d9d2c2" stroke-width="2"/><path d="M66 60h68l-8 52H74z" fill="#fff" stroke="#cfc6b3" stroke-width="2"/><path d="M134 70q20 4 8 26" fill="none" stroke="#cfc6b3" stroke-width="6"/><ellipse cx="100" cy="60" rx="34" ry="6" fill="#c89a6a"/><path d="M92 58q8 -6 16 0q-8 4 -16 0z" fill="#f3e2c8"/>`,
  refresco: `<rect x="78" y="40" width="44" height="78" rx="8" fill="#d8452b" stroke="#9b2c18" stroke-width="2"/><rect x="78" y="62" width="44" height="22" fill="#fff" opacity=".9"/><path d="M86 74q14 -10 28 0" stroke="#d8452b" stroke-width="4" fill="none"/><ellipse cx="100" cy="42" rx="20" ry="4" fill="#c9c9c9"/><path d="M84 50v60" stroke="#fff" stroke-opacity=".35" stroke-width="4"/>`,
  agua: `<path d="M90 24h20v12q14 8 14 22v56q0 6-6 6H82q-6 0-6-6V58q0-14 14-22z" fill="#cfe8f7" fill-opacity=".8" stroke="#6aa4c9" stroke-width="2"/><rect x="88" y="16" width="24" height="10" rx="3" fill="#2f6aa8"/><rect x="76" y="70" width="48" height="22" fill="#2f6aa8" opacity=".85"/><path d="M84 46v62" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>`,
  cana: `<path d="M76 46h48l-6 70H82z" fill="#f2b632" stroke="#c48a12" stroke-width="2"/><path d="M74 40q6 -12 16 -6q8 -10 18 -2q10 -6 16 6v10H74z" fill="#fffaf0" stroke="#e3d6bd" stroke-width="2"/><path d="M86 56v52" stroke="#fff" stroke-opacity=".4" stroke-width="4"/><g class="bubbles" fill="#fff6d6">${[0, 1, 2, 3].map(i => `<circle cx="${92 + i * 6}" cy="104" r="1.6" style="animation-delay:${i * .45}s"/>`).join('')}</g>`,
};


// ---------------------------------------------------------------- birre
const bub = (x0, x1, y, n = 5, col = '#fff6d6') => `<g class="bubbles" fill="${col}">${Array.from({ length: n }, (_, i) => `<circle cx="${x0 + (x1 - x0) * i / (n - 1)}" cy="${y}" r="${1.4 + (i % 2) * .5}" style="animation-delay:${(i * .37) % 1.8}s"/>`).join('')}</g>`;
const foam = (x0, x1, y) => `<path d="M${x0 - 3} ${y + 6}q-2 -12 10 -12q4 -9 14 -4q8 -8 16 0q10 -6 14 4q12 -2 ${x1 - x0 - 50} 12z" fill="#fffaf0" stroke="#e3d6bd" stroke-width="1.8"/>`;
function glass(x0, x1, xb0, xb1, top, bot, beerTop, color = '#f2b632', edge = '#c48a12') {
  return `<path d="M${x0} ${top}L${x1} ${top}L${xb1} ${bot}L${xb0} ${bot}Z" fill="#fff" fill-opacity=".35" stroke="#b9ad97" stroke-width="2"/>
    <path d="M${x0 + (xb0 - x0) * (beerTop - top) / (bot - top) + 2} ${beerTop}L${x1 - (x1 - xb1) * (beerTop - top) / (bot - top) - 2} ${beerTop}L${xb1 - 2} ${bot - 2}L${xb0 + 2} ${bot - 2}Z" fill="${color}" stroke="${edge}" stroke-width="1"/>
    <path d="M${x0 + 10} ${beerTop + 6}L${xb0 + 8} ${bot - 6}" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>`;
}
function bottle(h, body, label, labelTxt = '', cap = '#c8553d') {
  const top = 118 - h;
  const b = `<path d="M92 ${top + 8}h16v${h * .22}q16 8 16 26V114q0 6-6 6H82q-6 0-6-6V${top + 8 + h * .22 + 26}q0-18 16-26z" fill="${body}" stroke="#3d2410" stroke-width="2"/>
    <rect x="77" y="${top + h * .55}" width="46" height="${h * .26}" rx="3" fill="${label}"/>${labelTxt ? `<text x="100" y="${top + h * .55 + h * .17}" text-anchor="middle" font-size="${h * .13}" font-weight="900" font-family="Archivo,sans-serif" fill="#fff">${labelTxt}</text>` : `<circle cx="100" cy="${top + h * .68}" r="${h * .08}" fill="#fff" opacity=".9"/>`}
    <path d="M84 ${top + 50}v${h * .5}" stroke="#fff" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>`;
  return L(b + `<ellipse cx="100" cy="122" rx="40" ry="5" fill="rgba(0,0,0,.08)"/>`, 0, -4, ';--rot:-3deg') + L(`<rect x="90" y="${top}" width="20" height="9" rx="2" fill="${cap}" stroke="#7a2a18" stroke-width="1.5"/><path d="M90 ${top + 9}h20" stroke="#fff" stroke-opacity=".5"/>`, 1, -46, ';--rot:50deg');
}
const BEER = {
  'cana-cerveza': () => L(glass(76, 124, 84, 116, 52, 118, 64) + bub(88, 112, 112), 0, -4) + L(foam(76, 124, 54), 1, -16),
  doble: () => L(glass(70, 130, 82, 118, 34, 120, 48) + bub(86, 114, 114, 6), 0, -4) + L(foam(70, 130, 36), 1, -18),
  clara: () => L(glass(76, 124, 84, 116, 52, 118, 64, '#f7e08a', '#d6b84a') + bub(88, 112, 112) + `<circle cx="126" cy="58" r="13" fill="#f4e04d" stroke="#c9b22a" stroke-width="2"/><path d="M126 46v24M114 58h24M117 50l18 16M135 50l-18 16" stroke="#fff6b0" stroke-width="1.5"/>`, 0, -4) + L(foam(76, 124, 54), 1, -14),
  jarra: () => L(`<path d="M128 62q26 0 24 24t-24 22" fill="none" stroke="#b9ad97" stroke-width="7"/>` + glass(66, 130, 68, 128, 46, 120, 58) + `<g stroke="#fff" stroke-opacity=".35" stroke-width="3">${[80, 96, 112].map(x => `<path d="M${x} 66v46"/>`).join('')}</g>` + bub(78, 118, 114, 6), 0, -4, ';--rot:-5deg') + L(foam(66, 130, 48), 1, -16),
  botellin: () => bottle(74, '#6b3a12', '#c8553d'),
  mediana: () => bottle(96, '#5a3010', '#c8553d'),
  tostada: () => bottle(96, '#3e200a', '#b8782c'),
  'sin-alcohol': () => bottle(96, '#4a3a18', '#2f6aa8', '0,0', '#2f6aa8'),
  cubo: () => L(`${[70, 86, 102, 118, 130].map((x, i) => `<path d="M${x} ${30 + (i % 2) * 8}h8v18q6 6 6 14v20h-20v-20q0-8 6-14z" fill="#6b3a12" stroke="#3d2410" stroke-width="1.5"/><rect x="${x}" y="${26 + (i % 2) * 8}" width="8" height="5" rx="1" fill="#c8553d"/>`).join('')}`, 1, -18)
    + L(`<path d="M56 66h88l-10 52H66z" fill="#c9cdd2" stroke="#7d8590" stroke-width="2"/><path d="M56 66h88" stroke="#e9ecef" stroke-width="5"/><path d="M62 80h76M66 100h68" stroke="#9aa1a9" stroke-width="2"/>${[[74, 62], [96, 60], [118, 63]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="9" rx="2" fill="#e8f6ff" stroke="#9cc9e4" stroke-width="1.5" transform="rotate(15 ${x} ${y})"/>`).join('')}`, 2, -2),
};

// ---------------------------------------------------------------- API
export function dishHTML(m) {
  let kind = 'boca', layers = '';
  if (BOCA[m.id]) layers = stack(m.id, BOCA[m.id], baguetteTop, baguetteBot);
  else if (BURGER[m.id]) { kind = 'burger'; layers = stack(m.id, BURGER[m.id].slice(0, 4), bunTop, bunBot, 9); }
  else if (m.id === 'frankfurt') layers = hotdog();
  else if (BIKINI[m.id]) { kind = 'bikini'; layers = bikini(...BIKINI[m.id]); }
  else if (COMBO[m.id]) {
    kind = 'plate';
    layers = L(plate, 0, 0) + COMBO[m.id].map(([f, x, y], i) => L(P[f](x, y), i + 1, -14 - i * 4)).join('') + L(steam, 9, -6);
  } else if (BEER[m.id]) {
    kind = 'beer'; layers = BEER[m.id]();
  } else if (DRINK[m.id]) {
    kind = 'drink';
    layers = L(DRINK[m.id], 0, -6) + (['cafe-solo', 'cortado', 'cafe-leche'].includes(m.id) ? L(steam.replace(/M(\d+) 3[04]/g, (s, x) => `M${x} ${m.id === 'cafe-leche' ? 44 : 56}`), 1, -10) : '');
  } else {
    // prodotto nuovo aggiunto dal personale: un bocadillo generico
    layers = stack(m.id, ['lettuce', 'ham'], baguetteTop, baguetteBot);
  }
  return `<div class="dish k-${kind}"><div class="shadow"></div><div class="stage">${layers}</div></div>`;
}

// inclinazione 3D che segue il puntatore
export function tiltable(root) {
  root.addEventListener('pointermove', e => {
    const card = e.target.closest('.item'); if (!card || e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 16 + 'deg');
    card.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 12 + 'deg');
  });
  root.addEventListener('pointerout', e => {
    const card = e.target.closest('.item'); if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); }
  });
}
