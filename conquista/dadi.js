// La battaglia: bicchiere da scuotere, dadi 3D che volano e rimbalzano sul tavolo, scontro a coppie con esplosioni.
// I risultati arrivano da fuori (regole locali o server): l'animazione atterra sempre sulle facce giuste.
import { sfx, sleep, esc } from '../shared/core.js';

const ROT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] }; // rotateX, rotateY per mostrare la faccia
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const FACES = [['f1', 1], ['f6', 6], ['f3', 3], ['f4', 4], ['f5', 5], ['f2', 2]];
const vibrate = p => { try { if (navigator.userActivation?.hasBeenActive && matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(p); } catch (e) {} };

function dieHTML(color) {
  return `<div class="die" style="--dc:${color}"><div class="cube">${FACES.map(([cls, v]) => `<div class="face ${cls}">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i + 1) ? ' class="on"' : ''}></i>`).join('')}</div>`).join('')}</div></div>`;
}

/*
  battle({ att: { name, color, terr, armies }, def: {...}, maxDice(n armate) , resolve(nDice) -> Promise<{att, def, la, ld, conquered}>,
           auto: true se a lanciare è il computer / un altro giocatore })
  Risolve con { conquered, retreat }.
*/
export function battle(o) {
  const vib = p => { if (!o.auto) vibrate(p); };
  return new Promise(done => {
    const el = document.createElement('div'); el.className = 'battle';
    el.innerHTML = `<div class="bt-box">
      <div class="bt-head">
        <div class="side att" style="--pc:${o.att.color}"><b>${esc(o.att.name)}</b><small>${esc(o.att.terr)}</small><span class="tanks"><span class="n">${o.att.armies}</span></span></div>
        <div class="vs">VS</div>
        <div class="side def" style="--pc:${o.def.color}"><b>${esc(o.def.name)}</b><small>${esc(o.def.terr)}</small><span class="tanks"><span class="n">${o.def.armies}</span></span></div>
      </div>
      <div class="tray"><div class="felt"></div><div class="cup def-cup" style="--pc:${o.def.color}"></div><div class="cup att-cup" style="--pc:${o.att.color}"></div><div class="banner"></div></div>
      <div class="bt-ctrl">
        <div class="ndice"></div>
        <button class="throw"><span class="cupico"></span><span class="lbl">${o.auto ? 'Si lancia…' : 'Tieni premuto e lancia'}</span></button>
        <div class="more"><button class="btn small blitz">Fino in fondo</button><button class="btn small stop">Ritirata</button></div>
      </div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const tray = el.querySelector('.tray'), btn = el.querySelector('.throw');
    let A = o.att.armies, D = o.def.armies, nd = Math.min(3, A - 1), busy = false, blitz = false, over = false;
    const ndBox = el.querySelector('.ndice');
    const drawN = () => {
      const max = Math.min(3, A - 1); nd = Math.min(nd, max);
      ndBox.innerHTML = o.auto ? '' : [1, 2, 3].map(k => `<button class="nd${k === nd ? ' on' : ''}" ${k > max ? 'disabled' : ''} data-k="${k}">${'<i></i>'.repeat(k)}</button>`).join('');
      ndBox.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { nd = +b.dataset.k; sfx('click'); drawN(); });
    };
    drawN();
    if (o.auto) el.querySelector('.more').classList.add('hidden');

    /* --- scuotere il bicchiere --- */
    let shaking = null, shakeT = 0;
    const startShake = () => {
      if (busy || over) return;
      el.querySelector('.att-cup').classList.add('shake'); btn.classList.add('hold'); shakeT = performance.now();
      shaking = setInterval(() => { sfx('card'); vib(15); }, 110);
    };
    const stopShake = () => { clearInterval(shaking); shaking = null; el.querySelector('.att-cup').classList.remove('shake'); btn.classList.remove('hold'); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); startShake(); });
    btn.addEventListener('pointerup', () => { if (!shaking) return; const power = Math.min(1, (performance.now() - shakeT) / 900); stopShake(); throwDice(.6 + power * .8); });
    btn.addEventListener('pointerleave', () => { if (shaking) { stopShake(); throwDice(.8); } });
    el.querySelector('.stop').onclick = () => close(false, true);
    el.querySelector('.blitz').onclick = () => { blitz = true; el.querySelector('.blitz').disabled = true; if (!busy) throwDice(1.2); };
    window.addEventListener('keydown', key);
    function key(e) { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startShake(); } }
    window.addEventListener('keyup', keyUp);
    function keyUp(e) { if (e.code === 'Space' && shaking) { const power = Math.min(1, (performance.now() - shakeT) / 900); stopShake(); throwDice(.6 + power * .8); } }

    /* --- il lancio --- */
    async function throwDice(power) {
      if (busy || over) return; busy = true;
      $$('.die, .boom-x, .pairline', tray).forEach(x => x.remove()); banner('');
      const res = await o.resolve(nd);
      const fast = blitz || o.fast ? .45 : 1;
      const decisive = res.conquered;
      const tr = tray.getBoundingClientRect(), W = tr.width, H = tr.height, S = Math.min(56, W / 7);
      tray.style.setProperty('--ds', S + 'px');
      vib([30, 40, 30]);
      const mk = (vals, side) => vals.map((v, i) => {
        const d = document.createElement('div'); d.innerHTML = dieHTML(side === 'att' ? o.att.color : o.def.color); const die = d.firstElementChild; tray.appendChild(die);
        const fromAtt = side === 'att';
        const b = { el: die, cube: die.firstElementChild, v, side, x: (fromAtt ? W * .15 : W * .85) + (fromAtt ? 1 : -1) * i * S * .9, y: (fromAtt ? H * .78 : H * .22) + (fromAtt ? -1 : 1) * i * S * .4,
          vx: (fromAtt ? 1 : -1) * (6 + Math.random() * 7) * power, vy: (fromAtt ? -1 : 1) * (5 + Math.random() * 6) * power,
          rx: Math.random() * 360, ry: Math.random() * 360, wx: (Math.random() - .5) * 40, wy: (Math.random() - .5) * 40, i };
        return b;
      });
      const dA = mk(res.att, 'att'), dD = mk(res.def, 'def'), all = [...dA, ...dD];
      el.querySelector('.def-cup').classList.add('tip'); el.querySelector('.att-cup').classList.add('tip');
      setTimeout(() => el.querySelectorAll('.cup').forEach(c => c.classList.remove('tip')), 500);
      // la traiettoria si calcola tutta prima (60 passi al secondo) e poi la esegue il browser da solo:
      // così il movimento è fluido anche se la pagina è impegnata
      const dur = (decisive && !blitz ? 1500 : 1000) * fast, steps = Math.round(dur / 1000 * 60), STEP = 2;
      const track = all.map(() => []), hits = [];
      for (let f = 0; f <= steps; f++) {
        for (const [k, b] of all.entries()) {
          b.x += b.vx; b.y += b.vy; b.vx *= .965; b.vy *= .965;
          if (b.x < S / 2 || b.x > W - S / 2) { b.vx *= -.75; b.x = Math.max(S / 2, Math.min(W - S / 2, b.x)); hits.push(f); }
          if (b.y < S / 2 || b.y > H - S / 2) { b.vy *= -.75; b.y = Math.max(S / 2, Math.min(H - S / 2, b.y)); hits.push(f); }
          const sp = Math.hypot(b.vx, b.vy) / 8; b.rx += b.wx * sp; b.ry += b.wy * sp;
          if (f % STEP === 0 || f === steps) track[k].push([b.x - S / 2, b.y - S / 2, b.rx, b.ry]);
        }
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
          const a = all[i], c = all[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < S) { const nx = dx / d, ny = dy / d, push = (S - d) / 2; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
            const tvx = a.vx; a.vx = c.vx * .8; c.vx = tvx * .8; const tvy = a.vy; a.vy = c.vy * .8; c.vy = tvy * .8; hits.push(f); }
        }
      }
      // rumore dei dadi che sbattono, al momento giusto (al massimo 6 colpi)
      [...new Set(hits.map(f => Math.round(f / 6) * 6))].slice(0, 6).forEach(f => setTimeout(() => sfx('card'), f / 60 * 1000));
      const anims = all.map((b, k) => {
        const t = track[k];
        b.el.style.transform = `translate(${t[0][0]}px, ${t[0][1]}px)`;
        const a1 = b.el.animate(t.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })), { duration: dur, easing: 'linear', fill: 'forwards' });
        const a2 = b.cube.animate(t.map(([, , rx, ry]) => ({ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` })), { duration: dur, easing: 'linear', fill: 'forwards' });
        return [a1, a2];
      });
      await Promise.race([Promise.all(anims.flat().map(a => a.finished.catch(() => {}))), sleep(dur + 300)]);
      // atterraggio sulla faccia giusta, con qualche giro in più (anche questo eseguito dal browser)
      for (const [k, b] of all.entries()) {
        const t = track[k].at(-1), [x, y] = ROT[b.v];
        const fx = x + 360 * Math.round(t[2] / 360), fy = y + 360 * Math.round(t[3] / 360);
        b.el.style.transform = `translate(${t[0]}px, ${t[1]}px)`; anims[k][0].cancel();
        const land = (decisive && !blitz && b === all[all.length - 1] ? 900 : 450) * fast;
        b.cube.style.transform = `rotateX(${fx}deg) rotateY(${fy}deg)`; anims[k][1].cancel();
        b.cube.animate([{ transform: `rotateX(${t[2]}deg) rotateY(${t[3]}deg)` }, { transform: `rotateX(${fx}deg) rotateY(${fy}deg)` }], { duration: land, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        b.x = t[0] + S / 2; b.y = t[1] + S / 2;
      }
      sfx('thump'); vib(25);
      await sleep((decisive && !blitz ? 1000 : 520) * fast);
      // si mettono in fila: attaccante sotto, difensore sopra, dal più alto al più basso
      const line = (arr, y) => arr.forEach((b, k) => { const x = W / 2 + (k - (arr.length - 1) / 2) * S * 1.35; b.el.style.transition = `transform ${380 * fast}ms cubic-bezier(.34,1.56,.64,1)`;
        b.x = x; b.y = y; b.el.style.transform = `translate(${x - S / 2}px, ${y - S / 2}px)`; });
      line(dA, H * .7); line(dD, H * .3);
      await sleep(420 * fast);
      // scontri a coppie
      for (let k = 0; k < Math.min(dA.length, dD.length); k++) {
        const a = dA[k], d = dD[k], winA = a.v > d.v;
        const ln = document.createElement('div'); ln.className = 'pairline'; ln.style.cssText = `left:${a.x}px;top:${d.y + S / 2}px;height:${a.y - d.y - S}px`; tray.appendChild(ln);
        const w = winA ? a : d, l = winA ? d : a;
        w.el.classList.add('win');
        w.el.animate([{ transform: w.el.style.transform }, { transform: `translate(${w.x - S / 2}px, ${(w.y + l.y) / 2 - S / 2}px) scale(1.15)` }, { transform: w.el.style.transform }], { duration: 360 * fast, easing: 'ease-in-out' });
        await sleep(180 * fast);
        l.el.classList.add('lose'); boomAt(l.x, l.y, winA ? o.att.color : o.def.color); sfx('thump'); vib(40);
        if (a.v === d.v) floatText(a.x, (a.y + d.y) / 2, 'Pari: difesa', '#fff');
        loseTank(winA ? 'def' : 'att');
        await sleep(320 * fast);
      }
      // dadi in più (non confrontati) si spengono
      [...dA, ...dD].slice().forEach(b => { if (!b.el.classList.contains('win') && !b.el.classList.contains('lose')) b.el.classList.add('idle'); });
      // effetti speciali
      const sixes = res.att.filter(x => x === 6).length;
      if (res.att.length === 3 && res.att[0] === res.att[2]) special('Tris!');
      else if (sixes >= 2) special('Doppio sei!');
      A -= res.la; D -= res.ld;
      el.querySelector('.att .n').textContent = A; el.querySelector('.def .n').textContent = D;
      if (res.conquered) { banner('Conquistato!', 'big'); sfx('win'); vib([60, 40, 120]); await sleep(1300 * (blitz ? .6 : 1)); return close(true); }
      banner(res.ld > res.la ? 'Sfondato!' : res.ld === res.la ? 'Pari e patta' : 'Difeso!', res.ld > res.la ? 'good' : 'bad');
      busy = false;
      if (A < 2) { await sleep(900); return close(false); }
      drawN();
      if (blitz || o.auto) { await sleep(blitz ? 380 : 900); if (!over) { if (o.auto && !(await o.again?.())) return close(false, true); throwDice(1.1); } }
    }
    if (o.auto) setTimeout(() => { startShake(); setTimeout(() => { stopShake(); throwDice(1.1); }, o.fast ? 350 : 700); }, o.fast ? 250 : 500);

    function loseTank(side) {
      const s = el.querySelector('.' + side + ' .tanks'), r = s.getBoundingClientRect(), t = document.createElement('div');
      t.className = 'flytank'; t.style.cssText = `left:${r.left + r.width / 2 - 14}px;top:${r.top}px;--pc:${side === 'att' ? o.att.color : o.def.color}`;
      document.body.appendChild(t); setTimeout(() => t.remove(), 900);
      s.animate([{ transform: 'scale(1.35)' }, { transform: 'none' }], { duration: 400 });
    }
    function boomAt(x, y, color) {
      const b = document.createElement('div'); b.className = 'boom-x'; b.style.cssText = `left:${x}px;top:${y}px;--bc:${color}`;
      b.innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg;--d:${30 + Math.random() * 30}px"></i>`).join(''); tray.appendChild(b);
      setTimeout(() => b.remove(), 700);
    }
    function floatText(x, y, txt, c) { const f = document.createElement('div'); f.className = 'ftxt'; f.textContent = txt; f.style.cssText = `left:${x}px;top:${y}px;color:${c}`; tray.appendChild(f); setTimeout(() => f.remove(), 1200); }
    function banner(txt, cls = '') { const b = el.querySelector('.banner'); b.className = 'banner ' + cls; b.textContent = txt; if (txt) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } }
    function special(txt) { floatText(tray.clientWidth / 2, tray.clientHeight * .5, txt, '#ffc53d'); sfx('win'); }
    function close(conquered, retreat) {
      if (over) return; over = true; stopShake();
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', keyUp);
      el.classList.remove('on'); setTimeout(() => el.remove(), 350);
      done({ conquered, retreat: !!retreat });
    }
  });
}
const $$ = (s, el) => [...el.querySelectorAll(s)];
