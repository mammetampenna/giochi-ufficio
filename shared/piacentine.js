// Mazzo piacentino in SVG: semi e figure tradizionali (figure a doppia testa, spade ricurve, bastoni nodosi),
// ridisegnati in stile piatto e minimale. Carta = { s: 'D'|'C'|'S'|'B', r: 1..10 } (8 fante, 9 cavallo, 10 re).

export const SUITS = ['D', 'C', 'S', 'B'];
export const SUIT_NAME = { D: 'Denari', C: 'Coppe', S: 'Spade', B: 'Bastoni' };
export const RANK_NAME = { 1: 'Asso', 2: 'Due', 3: 'Tre', 4: 'Quattro', 5: 'Cinque', 6: 'Sei', 7: 'Sette', 8: 'Fante', 9: 'Cavallo', 10: 'Re' };
export const cardName = c => `${RANK_NAME[c.r]} di ${SUIT_NAME[c.s]}`;

// tavolozza piacentina, appena ammorbidita
const K = { ink: '#1e1a22', red: '#c9302c', gold: '#eab53b', blue: '#2c5aa6', green: '#3b8a4c', sky: '#9dc0e2', skin: '#f4d2ac', paper: '#fbf5e7', brown: '#8a5a32' };
const SW = 3.2; // spessore dei contorni

/* ---------- simboli dei semi (definiti una volta nel documento) ---------- */
const DEFS = `
<symbol id="pc-D" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}"/>
  <circle cx="50" cy="50" r="34" fill="${K.red}" stroke="${K.ink}" stroke-width="${SW * .7}"/>
  ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${50 + Math.cos(a) * 39.5}" cy="${50 + Math.sin(a) * 39.5}" r="2.4" fill="${K.ink}"/>`; }).join('')}
  <circle cx="50" cy="50" r="22" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW * .7}"/>
  ${Array.from({ length: 8 }, (_, i) => `<ellipse cx="50" cy="38" rx="4.2" ry="9" fill="${K.green}" stroke="${K.ink}" stroke-width="1.6" transform="rotate(${i * 45} 50 50)"/>`).join('')}
  <circle cx="50" cy="50" r="6.5" fill="${K.red}" stroke="${K.ink}" stroke-width="1.8"/>
</symbol>
<symbol id="pc-C" viewBox="0 0 100 100">
  <path d="M40 78 L60 78 L72 94 L28 94 Z" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
  <rect x="44" y="56" width="12" height="24" fill="${K.red}" stroke="${K.ink}" stroke-width="${SW}"/>
  <ellipse cx="50" cy="66" rx="11" ry="5" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW * .8}"/>
  <path d="M16 12 H84 C84 40 70 56 50 58 C30 56 16 40 16 12 Z" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="M19 26 H81 C80 32 78 36 76 39 H24 C22 36 20 32 19 26 Z" fill="${K.red}" stroke="${K.ink}" stroke-width="1.8"/>
  <ellipse cx="50" cy="12" rx="34" ry="6" fill="${K.blue}" stroke="${K.ink}" stroke-width="${SW}"/>
</symbol>
<symbol id="pc-S" viewBox="0 0 40 260" overflow="visible">
  <path d="M15 196 C2 140 3 66 26 3 C19 70 22 140 27 196 Z" fill="${K.sky}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="M19 190 C12 140 12 80 22 30" fill="none" stroke="${K.ink}" stroke-width="1.4" opacity=".5"/>
  <rect x="1" y="196" width="38" height="9" rx="4.5" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}"/>
  <rect x="14" y="205" width="12" height="34" rx="3" fill="${K.red}" stroke="${K.ink}" stroke-width="${SW}"/>
  <circle cx="20" cy="245" r="8" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}"/>
</symbol>
<symbol id="pc-B" viewBox="0 0 40 260" overflow="visible">
  <path d="M14 254 L8 26 C8 6 32 6 32 26 L26 254 Z" fill="${K.green}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="M8 26 C8 6 32 6 32 26 Z" fill="${K.brown}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
  <rect x="7" y="58" width="26" height="10" rx="3" fill="${K.red}" stroke="${K.ink}" stroke-width="2.2"/>
  <rect x="9" y="200" width="22" height="10" rx="3" fill="${K.red}" stroke="${K.ink}" stroke-width="2.2"/>
  <rect x="10" y="212" width="20" height="6" rx="2" fill="${K.gold}" stroke="${K.ink}" stroke-width="1.8"/>
  <ellipse cx="13" cy="110" rx="5" ry="3" fill="${K.brown}" stroke="${K.ink}" stroke-width="1.6"/>
  <ellipse cx="27" cy="150" rx="5" ry="3" fill="${K.brown}" stroke="${K.ink}" stroke-width="1.6"/>
  <ellipse cx="15" cy="180" rx="4" ry="2.6" fill="${K.brown}" stroke="${K.ink}" stroke-width="1.6"/>
</symbol>`;

export function injectDefs() {
  if (document.getElementById('pc-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'pc-defs'; s.setAttribute('width', 0); s.setAttribute('height', 0); s.style.position = 'absolute';
  s.innerHTML = '<defs>' + DEFS + '</defs>'; document.body.prepend(s);
}

const use = (id, x, y, w, h, extra = '') => `<use href="#pc-${id}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;

/* ---------- carte numeriche ---------- */
const POS = {
  2: [[100, 92], [100, 248]],
  3: [[100, 74], [100, 170], [100, 266]],
  4: [[62, 100], [138, 100], [62, 240], [138, 240]],
  5: [[62, 92], [138, 92], [100, 170], [62, 248], [138, 248]],
  6: [[62, 80], [138, 80], [62, 170], [138, 170], [62, 260], [138, 260]],
  7: [[62, 76], [138, 76], [100, 128], [62, 190], [138, 190], [62, 266], [138, 266]],
};
const SIZE = { 2: 74, 3: 64, 4: 62, 5: 56, 6: 54, 7: 50 };

function roundPips(s, n) {
  const z = SIZE[n] * (s === 'C' ? 1.08 : 1);
  return POS[n].map(([x, y]) => use(s, x - z / 2, y - z / 2, z, z)).join('');
}
// spade e bastoni: incrociati a X (alla piacentina), con uno dritto al centro se il numero è dispari
function longPips(s, n) {
  const pairs = n >> 1, odd = n & 1, L = s === 'S' ? 232 : 236, W = L * 40 / 260;
  const offs = { 1: [0], 2: [-30, 30], 3: [-46, 0, 46] }[pairs];
  const item = (x, ang, flip) => `<g transform="translate(${x} 170) rotate(${ang})${flip ? ' scale(-1 1)' : ''}">${use(s, -W / 2, -L / 2, W, L)}</g>`;
  let out = '';
  offs.forEach(o => { out += item(100 + o, -17, false) + item(100 + o, 17, true); });
  if (odd) out += item(100, 0, false);
  return out;
}

/* ---------- assi ---------- */
function ace(s) {
  const ribbon = (y, txt) => `<path d="M48 ${y} H152 L142 ${y + 13} L152 ${y + 26} H48 L58 ${y + 13} Z" fill="${K.red}" stroke="${K.ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <text x="100" y="${y + 18}" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" letter-spacing="2" fill="${K.paper}">${txt}</text>`;
  if (s === 'D') return `<circle cx="100" cy="160" r="70" fill="none" stroke="${K.gold}" stroke-width="2" stroke-dasharray="3 6"/>` + use('D', 40, 100, 120, 120) + ribbon(262, 'DENARI');
  if (s === 'C') return use('C', 34, 72, 132, 132) + `<path d="M58 222 Q100 246 142 222" fill="none" stroke="${K.green}" stroke-width="5" stroke-linecap="round"/>` + ribbon(262, 'COPPE');
  // spada e bastone dell'asso: grandi, dritti, con un nastro avvolto
  const L = 270, W = L * 40 / 260;
  return `<g transform="translate(100 162) rotate(${s === 'S' ? 0 : 0})">${use(s, -W / 2 * 1.25, -L / 2, W * 1.25, L)}</g>
    <path d="M58 150 C80 136 120 168 142 150 L146 170 C124 188 82 156 60 172 Z" fill="${K.red}" stroke="${K.ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="100" cy="60" r="0" />`;
}

/* ---------- figure a doppia testa ---------- */
const GARB = { D: [K.blue, K.gold], C: [K.red, K.gold], S: [K.green, K.red], B: [K.gold, K.red] };
function half(s, r) {
  const [g1, g2] = GARB[s];
  // oggetto in mano: piccolo simbolo del seme
  const held = s === 'D' || s === 'C' ? use(s, 128, 92, 46, 46)
    : `<g transform="translate(150 118) rotate(28)">${use(s, -9, -62, 18, 118)}</g>`;
  const body = `<path d="M52 170 C52 120 68 98 100 96 C132 98 148 120 148 170 Z" fill="${g1}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M100 98 L100 170" stroke="${K.ink}" stroke-width="2"/>
    <path d="M78 102 L100 124 L122 102" fill="${g2}" stroke="${K.ink}" stroke-width="2.4" stroke-linejoin="round"/>
    ${[132, 146, 160].map(y => `<circle cx="100" cy="${y}" r="2.6" fill="${g2}" stroke="${K.ink}" stroke-width="1.2"/>`).join('')}`;
  const face = `<rect x="92" y="80" width="16" height="18" fill="${K.skin}" stroke="${K.ink}" stroke-width="2.4"/>
    <ellipse cx="100" cy="66" rx="19" ry="21" fill="${K.skin}" stroke="${K.ink}" stroke-width="${SW}"/>
    <circle cx="93" cy="65" r="2.2" fill="${K.ink}"/><circle cx="107" cy="65" r="2.2" fill="${K.ink}"/>
    <path d="M95 76 Q100 79 105 76" fill="none" stroke="${K.ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  let hat = '', extra = '';
  if (r === 8) { // fante: berretto piumato
    hat = `<path d="M78 56 C80 36 122 34 124 54 L130 58 C112 50 92 50 74 58 Z" fill="${g2}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M118 42 C134 26 148 30 150 22 C150 36 136 44 122 48 Z" fill="${K.paper}" stroke="${K.ink}" stroke-width="2"/>`;
  } else if (r === 9) { // cavallo: cavaliere con la testa del cavallo accanto
    hat = `<path d="M80 60 C80 36 120 36 120 60 L120 52 C110 44 90 44 80 52 Z" fill="${K.sky}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M100 38 C104 26 114 22 118 24 C112 28 106 32 104 40 Z" fill="${g2}" stroke="${K.ink}" stroke-width="2"/>`;
    extra = `<path d="M24 170 C20 140 26 116 36 100 C30 92 30 82 36 76 L44 84 C56 80 68 86 72 98 C76 112 70 120 62 120 C58 132 60 152 66 170 Z" fill="${K.paper}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
      <circle cx="60" cy="98" r="2.6" fill="${K.ink}"/>
      <path d="M36 100 C30 112 30 130 32 150" fill="none" stroke="${g2}" stroke-width="7" stroke-linecap="round"/>
      <path d="M46 116 L70 112" stroke="${K.red}" stroke-width="4" stroke-linecap="round"/>`;
  } else { // re: corona e barba
    hat = `<path d="M78 52 L80 30 L90 42 L100 26 L110 42 L120 30 L122 52 Z" fill="${K.gold}" stroke="${K.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
      <circle cx="100" cy="44" r="3" fill="${K.red}"/>`;
    extra = `<path d="M82 72 C84 92 116 92 118 72 C114 80 86 80 82 72 Z" fill="${K.brown}" stroke="${K.ink}" stroke-width="2"/>`;
  }
  return extra + body + held + face + (r === 10 ? `<path d="M82 72 C84 94 116 94 118 72 C112 82 88 82 82 72 Z" fill="${K.paper}" stroke="${K.ink}" stroke-width="2.2"/><path d="M93 77 Q100 74 107 77" fill="none" stroke="${K.ink}" stroke-width="1.8"/>` : '') + hat;
}
function figure(s, r) {
  const h = half(s, r);
  return `<clipPath id="fc${s}${r}"><rect x="16" y="16" width="168" height="308" rx="8"/></clipPath>
    <g clip-path="url(#fc${s}${r})">
      <rect x="16" y="16" width="168" height="308" rx="8" fill="${GARB[s][0]}" opacity=".1"/>
      <g>${h}</g><g transform="rotate(180 100 170)">${h}</g>
    </g>
    <rect x="16" y="16" width="168" height="308" rx="8" fill="none" stroke="${K.ink}" stroke-width="2"/>
    <path d="M16 170 H184" stroke="${K.ink}" stroke-width="2"/>
    <path d="M100 162 L108 170 L100 178 L92 170 Z" fill="${K.gold}" stroke="${K.ink}" stroke-width="1.6"/>`;
}

/* ---------- carta completa ---------- */
const cache = new Map();
export function cardSVG(c) {
  const k = c.s + c.r;
  if (cache.has(k)) return cache.get(k);
  const art = c.r === 1 ? ace(c.s) : c.r >= 8 ? figure(c.s, c.r) : (c.s === 'S' || c.s === 'B' ? longPips(c.s, c.r) : roundPips(c.s, c.r));
  const idx = (x, y, rot) => `<g transform="translate(${x} ${y})${rot ? ' rotate(180)' : ''}"><text x="0" y="0" text-anchor="middle" font-family="'Bricolage Grotesque', system-ui, sans-serif" font-weight="800" font-size="22" fill="${K.ink}">${c.r}</text></g>`;
  const svg = `<svg class="pc" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${cardName(c)}">
    <rect x="1.5" y="1.5" width="197" height="337" rx="16" fill="${K.paper}" stroke="#d9cdb2" stroke-width="3"/>
    ${art}
    ${c.r < 8 ? idx(20, 30) + idx(180, 310, true) : `<rect x="4" y="6" width="22" height="30" rx="6" fill="${K.paper}"/>${idx(15, 29)}<rect x="174" y="304" width="22" height="30" rx="6" fill="${K.paper}"/>${idx(185, 311, true)}`}
  </svg>`;
  cache.set(k, svg); return svg;
}
export function backSVG() {
  return `<svg class="pc" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="pcb" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="20" height="20" fill="#a3242b"/><rect width="10" height="10" fill="#8c1c23"/><rect x="10" y="10" width="10" height="10" fill="#8c1c23"/></pattern></defs>
    <rect x="1.5" y="1.5" width="197" height="337" rx="16" fill="${K.paper}" stroke="#d9cdb2" stroke-width="3"/>
    <rect x="12" y="12" width="176" height="316" rx="9" fill="url(#pcb)"/>
    <rect x="12" y="12" width="176" height="316" rx="9" fill="none" stroke="${K.gold}" stroke-width="2.5"/>
    <circle cx="100" cy="170" r="34" fill="${K.paper}" stroke="${K.gold}" stroke-width="3"/>
    <text x="100" y="182" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="32" fill="#a3242b">B</text>
  </svg>`;
}
