// Animazioni coreografate con Anime.js. Una sola curva per tutto; con "riduci movimento" le durate vanno a zero.
import { animate, stagger, createTimeline, cubicBezier, utils } from 'https://cdn.jsdelivr.net/npm/animejs@4.3.6/+esm';

export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EASE = cubicBezier(.22, 1, .36, 1);
const calm = p => reduce ? { ...p, duration: 0, delay: 0 } : p;

export function anim(targets, params) { return animate(targets, calm({ ease: EASE, ...params })); }
export function timeline(params = {}) { return createTimeline(calm({ defaults: { ease: EASE }, ...params })); }
export { stagger, utils };

// ingresso standard: dissolvenza e salita di pochi pixel, scaglionata
export function enter(targets, { delay = 0, step = 50, y = 10, duration = 420 } = {}) {
  return anim(targets, { opacity: [0, 1], translateY: [y, 0], duration, delay: stagger(step, { start: delay }) });
}
// un numero che scorre da un valore all'altro
export function tween(el, from, to, { duration = 700, delay = 0, format = v => Math.round(v) } = {}) {
  const o = { v: from };
  if (reduce) { el.textContent = format(to); return Promise.resolve(); }
  return animate(o, { v: to, duration, delay, ease: EASE, onUpdate: () => { el.textContent = format(o.v); } }).then(() => {});
}
