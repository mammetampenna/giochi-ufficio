// Grafica delle carte di Scarta!: corpo colorato a righe, finestra bianca squadrata al centro, simboli originali.
import { col, val } from './regole.js';

export const HEX = { r: '#ff4b5c', y: '#ffc22e', g: '#2ecc71', b: '#3b82f6', w: '#1d1a2e' };
const DARK = { r: '#a3162a', y: '#a36a00', g: '#167a40', b: '#1d4fa8', w: '#000' };
const INK = '#1d1a2e';

function symbol(v, c, size, color, stroke) {
  // simbolo centrato in (0,0), alto circa "size"
  const s = size / 100;
  if (/^\d$/.test(v)) return `<text x="0" y="${34 * s}" text-anchor="middle" font-family="'Bricolage Grotesque', system-ui, sans-serif" font-weight="800" font-size="${100 * s}" fill="${color}" stroke="${stroke}" stroke-width="${6 * s}" paint-order="stroke">${v}</text>`;
  if (v === 'skip') return `<g stroke-linecap="round"><circle r="${30 * s}" fill="none" stroke="${stroke}" stroke-width="${22 * s}"/><path d="M${-21 * s} ${21 * s} L${21 * s} ${-21 * s}" stroke="${stroke}" stroke-width="${22 * s}"/>
    <circle r="${30 * s}" fill="none" stroke="${color}" stroke-width="${12 * s}"/><path d="M${-21 * s} ${21 * s} L${21 * s} ${-21 * s}" stroke="${color}" stroke-width="${12 * s}"/></g>`;
  if (v === 'rev') {
    const arrow = `M${-28 * s} ${-6 * s} C${-28 * s} ${-30 * s} ${16 * s} ${-36 * s} ${24 * s} ${-14 * s} L${34 * s} ${-22 * s} L${32 * s} ${4 * s} L${8 * s} ${-2 * s} L${16 * s} ${-10 * s} C${8 * s} ${-24 * s} ${-14 * s} ${-20 * s} ${-14 * s} ${-6 * s} Z`;
    return `<g stroke-linejoin="round"><path d="${arrow}" fill="${color}" stroke="${stroke}" stroke-width="${6 * s}"/><path d="${arrow}" transform="rotate(180)" fill="${color}" stroke="${stroke}" stroke-width="${6 * s}"/></g>`;
  }
  if (v === 'd2' || v === 'd4') return `<text x="0" y="${30 * s}" text-anchor="middle" font-family="'Bricolage Grotesque', system-ui, sans-serif" font-weight="800" font-size="${80 * s}" fill="${color}" stroke="${stroke}" stroke-width="${6 * s}" paint-order="stroke">+${v[1]}</text>`;
  return '';
}
// girandola a quattro colori dei jolly
function pinwheel(r) {
  const q = (a, c) => { const a1 = a * Math.PI / 180, a2 = (a + 90) * Math.PI / 180;
    return `<path d="M0 0 L${r * Math.cos(a1)} ${r * Math.sin(a1)} A${r} ${r} 0 0 1 ${r * Math.cos(a2)} ${r * Math.sin(a2)} Z" fill="${HEX[c]}"/>`; };
  return `<g>${q(-90, 'r')}${q(0, 'b')}${q(90, 'y')}${q(180, 'g')}<circle r="${r}" fill="none" stroke="#fff" stroke-width="3"/></g>`;
}

const cache = new Map();
export function cardSVG(card) {
  if (cache.has(card)) return cache.get(card);
  const c = col(card), v = val(card), body = HEX[c], dark = DARK[c];
  const wild = c === 'w';
  const corner = wild ? (v === 'd4' ? '+4' : '') : v === 'd2' ? '+2' : '';
  const cornerSym = (x, y, rot) => `<g transform="translate(${x} ${y})${rot ? ' rotate(180)' : ''}">${
    wild && v === 'wild' ? pinwheel(9) : corner ? `<text x="0" y="7" text-anchor="middle" font-family="'Bricolage Grotesque', system-ui, sans-serif" font-weight="800" font-size="20" fill="#fff">${corner}</text>` : symbol(v, c, 26, '#fff', 'none')}</g>`;
  const center = wild
    ? `<g transform="translate(60 90)">${pinwheel(30)}${v === 'd4' ? symbol('d4', c, 62, '#fff', INK) : ''}</g>`
    : `<g transform="translate(60 92)">${symbol(v, c, v.length === 1 ? 82 : 76, body, INK)}</g>`;
  const svg = `<svg class="sc" viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="st-${c}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="14" height="14" fill="${body}"/><rect width="5" height="14" fill="${dark}" opacity=".35"/></pattern></defs>
    <rect x="2" y="2" width="116" height="176" rx="16" fill="#fff"/>
    <rect x="8" y="8" width="104" height="164" rx="11" fill="url(#st-${c})"/>
    <rect x="20" y="44" width="80" height="92" rx="20" fill="${wild ? '#2a2640' : '#fff'}" stroke="${INK}" stroke-width="3"/>
    ${center}
    ${cornerSym(24, 28)}${cornerSym(96, 152, true)}
  </svg>`;
  cache.set(card, svg); return svg;
}
export function backSVG() {
  return `<svg class="sc" viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="sb" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="16" height="16" fill="#2a2348"/><rect width="6" height="16" fill="#3a2f66"/></pattern></defs>
    <rect x="2" y="2" width="116" height="176" rx="16" fill="#fff"/>
    <rect x="8" y="8" width="104" height="164" rx="11" fill="url(#sb)"/>
    <g transform="translate(60 90) rotate(-18)">
      <rect x="-50" y="-20" width="100" height="40" rx="12" fill="#ffc22e" stroke="${INK}" stroke-width="3"/>
      <text x="0" y="9" text-anchor="middle" font-family="'Bricolage Grotesque', system-ui, sans-serif" font-weight="800" font-size="26" fill="${INK}">Scarta!</text>
    </g>
    <circle cx="26" cy="26" r="7" fill="#ff4b5c"/><circle cx="94" cy="26" r="7" fill="#3b82f6"/><circle cx="26" cy="154" r="7" fill="#2ecc71"/><circle cx="94" cy="154" r="7" fill="#ffc22e"/>
  </svg>`;
}
