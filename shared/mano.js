// La mano della morra in SVG (punta verso l'alto, pollice a sinistra). Usata dal gioco e dall'anteprima nel menu.
const CSS = `
.hand { width: 100%; height: 100%; overflow: visible; }
.hand .sk { fill: #f2cfa8; stroke: #1e1a22; stroke-width: 5; stroke-linejoin: round; }
.hand .fg, .hand .th { transition: transform .35s cubic-bezier(.22,1,.36,1); transform-box: view-box; }
.hand .fg { transform: scaleY(.42); }
.hand .fg.up { transform: scaleY(1); }
.hand .th { transform: rotate(40deg); transform-origin: 54px 190px; }
.hand .th.up { transform: rotate(-26deg); }
.hand .f1 { transform-origin: 64.5px 140px; } .hand .f2 { transform-origin: 89.5px 140px; }
.hand .f3 { transform-origin: 114.5px 140px; } .hand .f4 { transform-origin: 137.5px 140px; }`;

export function handStyles() {
  if (document.getElementById('hand-css')) return;
  const s = document.createElement('style'); s.id = 'hand-css'; s.textContent = CSS; document.head.appendChild(s);
}
export const HAND = color => `<svg class="hand" viewBox="0 0 200 280" aria-hidden="true">
  <rect x="52" y="214" width="96" height="74" rx="12" fill="${color}" stroke="#1e1a22" stroke-width="5"/>
  <rect x="52" y="214" width="96" height="14" rx="6" fill="rgba(255,255,255,.3)"/>
  <g class="fg f1"><rect class="sk" x="53" y="44" width="23" height="104" rx="11.5"/></g>
  <g class="fg f2"><rect class="sk" x="78" y="32" width="23" height="116" rx="11.5"/></g>
  <g class="fg f3"><rect class="sk" x="103" y="42" width="23" height="106" rx="11.5"/></g>
  <g class="fg f4"><rect class="sk" x="127" y="64" width="21" height="84" rx="10.5"/></g>
  <rect class="sk" x="48" y="116" width="104" height="112" rx="36"/>
  <path d="M72 128 q8 6 16 0 M97 128 q8 6 16 0 M121 128 q7 5 14 0" fill="none" stroke="#c98f6a" stroke-width="3" stroke-linecap="round"/>
  <g class="th"><rect class="sk" x="30" y="118" width="28" height="78" rx="14"/></g>
</svg>`;
// alza le prime n dita (1 = indice … 5 = anche il pollice)
export function setFingers(el, n) {
  ['.f1', '.f2', '.f3', '.f4', '.th'].forEach((s, i) => el.querySelector(s)?.classList.toggle('up', i < n));
}
