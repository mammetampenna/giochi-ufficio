// Accesso al database (Supabase, chiamate REST dirette: niente librerie)
export const SB_URL = 'https://agwmdkrkfydgfzghwspv.supabase.co';
export const SB_KEY = 'sb_publishable_5edj9ayGro2KPEgrUsaNZg_KWDi9mi_';
const H = { apikey: SB_KEY, 'Content-Type': 'application/json' };

export async function rpc(fn, args = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const m = (j && (j.message || j.hint)) || `http_${r.status}`;
    const e = new Error(m); e.code = (m.match(/bg:[a-z_]+/) || ['bg:error'])[0]; throw e;
  }
  return j;
}

export async function table(name, query = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${name}?${query}`, { headers: H });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

// ---- ora di Barcellona, qualunque sia il fuso del telefono ----
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function madridNow() {
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
export const hm = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const mhm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export const isoDow = day => { const w = new Date(day + 'T12:00:00Z').getUTCDay(); return w === 0 ? 7 : w; };
export const eur = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ---- stessa logica di bg_pick nel database: primo gruppo di tavoli vicini libero ----
export function busyTables(bookings, s, e) {
  const b = new Set();
  for (const x of bookings) if (x.s < e && x.e > s) x.t.forEach(t => b.add(t));
  return b;
}
export function runs(tables, k) {
  const out = [];
  const sorted = [...tables].sort((a, b) => a.zone_ord - b.zone_ord || a.pos - b.pos);
  for (const r of sorted) {
    const run = sorted.filter(t => t.zone === r.zone && t.pos >= r.pos && t.pos < r.pos + k).map(t => t.id);
    if (run.length === k) out.push(run);
  }
  return out;
}
export function pick(tables, busy, people) {
  const k = Math.ceil(people / 4);
  return runs(tables, k).find(run => run.every(id => !busy.has(id))) || null;
}
