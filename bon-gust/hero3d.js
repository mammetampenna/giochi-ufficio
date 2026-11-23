// Bocadillo 3D nella pagina iniziale: gli ingredienti cadono uno a uno, il piatto gira,
// "Otro" apre il panino e cambia ripieno. Se WebGL non c'è, resta l'illustrazione SVG.
import * as THREE from './vendor/three.module.min.js';

export const PRESETS = [
  { id: 'jamon-serrano', fill: ['tomato', 'serrano'] },
  { id: 'vegetal-pollo', fill: ['lettuce', 'tomato', 'chicken'] },
  { id: 'chorizo', fill: ['chorizo'] },
  { id: 'tortilla-patata', fill: ['tortilla'] },
  { id: 'bacon-queso', fill: ['bacon', 'cheese'] },
  { id: 'lomo-queso', fill: ['lomo', 'cheese'] },
];

const ease = {
  outBack: t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  inBack: t => 2.7 * t * t * t - 1.7 * t * t,
  inOut: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
};

export function mountHero3D(host, { onChange } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 100);
  cam.position.set(0, 4.6, 9.4); cam.lookAt(0, .5, 0);

  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x7a4a2a, 1.4));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.position.set(4, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); sun.shadow.radius = 6;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffc27a, 1.2); rim.position.set(-5, 3, -4); scene.add(rim);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: 0, ...o });

  // ---- piatto di ceramica con il bordo blu
  const world = new THREE.Group(); scene.add(world);
  const plate = new THREE.Group(); world.add(plate);
  const prof = [[0, 0], [2.3, 0], [2.55, .08], [2.95, .3], [3.05, .34], [3.0, .38], [2.5, .2], [0, .14]].map(([x, y]) => new THREE.Vector2(x, y));
  const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), mat(0xfffaf0, { roughness: .25 }));
  dish.receiveShadow = true; plate.add(dish);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.75, .035, 8, 96), mat(0x2f6aa8, { roughness: .3 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = .27; plate.add(ring);
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), mat(0x2f6aa8));
    const a = i / 24 * Math.PI * 2; d.position.set(Math.cos(a) * 2.48, .2, Math.sin(a) * 2.48); plate.add(d);
  }

  // ---- pane
  const breadGeo = (flat, top) => {
    const g = new THREE.CapsuleGeometry(.62, 3.2, 10, 28); g.rotateZ(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i);
      if (top) y = y < 0 ? y * .25 : y * flat; else y = y > 0 ? y * .2 : y * flat;
      p.setY(i, y); p.setZ(i, p.getZ(i) * .92);
    }
    g.computeVertexNormals(); return g;
  };
  const crust = mat(0xd08a3a, { roughness: .8 });
  const bottom = new THREE.Mesh(breadGeo(.55, false), crust); bottom.castShadow = true;
  const topB = new THREE.Group();
  const topMesh = new THREE.Mesh(breadGeo(.78, true), crust); topMesh.castShadow = true; topB.add(topMesh);
  for (let i = 0; i < 5; i++) {
    const cut = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .5, 4, 8), mat(0xf4d39a, { roughness: .9 }));
    cut.position.set(-1.6 + i * .8, .46, 0); cut.rotation.set(Math.PI / 2, 0, .9); cut.scale.set(1, 1, .5);
    topB.add(cut);
  }
  const sandwich = new THREE.Group(); world.add(sandwich);
  sandwich.add(bottom, topB); sandwich.position.y = .5;

  // ---- ingredienti
  const wavy = (w, h, d, amp, color, freq = 3) => {
    const g = new THREE.BoxGeometry(w, h, d, 48, 1, 10); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + Math.sin(x * freq + z * 2) * amp + Math.cos(z * 6 + x) * amp * .5); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, mat(color)); m.castShadow = true; return m;
  };
  const discs = (n, r, h, color, inner, spread = 3.3) => {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), [mat(color), mat(inner), mat(inner)]);
      m.position.set(-spread / 2 + spread * i / (n - 1), (i % 2) * .03, (i % 2 ? .12 : -.12)); m.rotation.z = (i % 2 ? .08 : -.08); m.castShadow = true; g.add(m);
    }
    return g;
  };
  const make = {
    serrano: () => { const g = new THREE.Group(); g.add(wavy(3.9, .06, 1.5, .07, 0xb83a42, 2.4)); const f = wavy(3.6, .03, .25, .07, 0xf6dcd2, 2.4); f.position.set(0, .03, .5); g.add(f); g.userData.h = .14; return g; },
    tomato: () => { const g = discs(5, .42, .09, 0xe2412f, 0xf2826b); g.userData.h = .1; return g; },
    lettuce: () => { const m = wavy(4.1, .03, 1.9, .14, 0x7cc04b, 5); m.material.side = THREE.DoubleSide; m.userData.h = .14; return m; },
    chicken: () => { const g = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(.26, 1), mat(i % 2 ? 0xe3b277 : 0xc98a45)); m.scale.set(1.2, .55, 1); m.position.set(-1.6 + i * .4, 0, (i % 3 - 1) * .25); m.castShadow = true; g.add(m); } g.userData.h = .2; return g; },
    chorizo: () => { const g = discs(7, .36, .07, 0xb8342a, 0xd9785c); g.userData.h = .09; return g; },
    tortilla: () => { const g = new THREE.CapsuleGeometry(.45, 3, 6, 20); g.rotateZ(Math.PI / 2); g.scale(1, .55, 1.05); const m = new THREE.Mesh(g, mat(0xf3c654)); m.castShadow = true; m.userData.h = .42; return m; },
    bacon: () => { const g = new THREE.Group(); for (const z of [-.25, .25]) { const s = wavy(3.9, .05, .42, .09, 0xd9776b, 4); s.position.z = z; g.add(s); } g.userData.h = .12; return g; },
    cheese: () => { const m = wavy(3.7, .05, 1.35, .02, 0xf7cf47, 1); m.userData.h = .07; return m; },
    lomo: () => { const g = discs(5, .5, .08, 0xc98f6d, 0xe9c5ad); g.userData.h = .1; return g; },
  };

  let layers = []; // ingredienti attuali
  const tweens = [];
  const tween = (dur, fn, delay = 0, done) => { tweens.push({ t0: performance.now() + delay, dur, fn, done }); };
  const BASE = .2; // altezza del pane di sotto

  function build(preset, intro) {
    let y = BASE;
    topB.position.y = 7;
    layers =preset.fill.map((k, i) => {
      const m = make[k](); const h = m.userData.h ?? .1;
      m.userData.y = y + h / 2; y += h; sandwich.add(m);
      m.position.y = 6 + i; m.rotation.y = (Math.random() - .5) * .6;
      const d = (intro ? 400 : 150) + i * 260;
      tween(700, t => { m.position.y = 6 + i + (m.userData.y - 6 - i) * ease.outBounce(t); m.rotation.y *= .9; }, d);
      return m;
    });
    const topY = y + .02;
    topB.userData.y = topY;
    const d = (intro ? 400 : 150) + layers.length * 260;
    tween(800, t => { topB.position.y = 7 + (topY - 7) * ease.outBounce(t); topB.rotation.z = (1 - t) * .3; }, d, () => squash());
  }
  function squash() {
    tween(380, t => { const s = Math.sin(t * Math.PI); sandwich.scale.set(1 + s * .06, 1 - s * .1, 1 + s * .06); });
  }
  let busy = false, idx = 0;
  function next() {
    if (busy) return; busy = true;
    // il pane di sopra salta via, gli ingredienti volano fuori
    const old = layers;
    tween(500, t => { topB.position.y = topB.userData.y + ease.outBack(t) * 2.2; topB.rotation.z = -t * .5; });
    old.forEach((m, i) => {
      const dir = i % 2 ? 1 : -1; const y0 = m.position.y;
      tween(520, t => { m.position.x = dir * ease.inBack(t) * 7; m.position.y = y0 + Math.sin(t * Math.PI) * 1.5; m.rotation.z = dir * t * 2; }, 120 + i * 70, () => { sandwich.remove(m); });
    });
    setTimeout(() => {
      idx = (idx + 1) % PRESETS.length; build(PRESETS[idx], false); onChange?.(PRESETS[idx]);
      setTimeout(() => { busy = false; }, 900 + PRESETS[idx].fill.length * 260);
    }, 650);
  }

  // ---- dimensioni, puntatore, ciclo
  const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(host); size();
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
  let drag = null, spin = 0, vel = 0;
  host.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin, t: performance.now(), moved: false }; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; spin = drag.s + dx * .012; vel = 0; });
  host.addEventListener('pointerup', e => { if (drag && !drag.moved) next(); else if (drag) vel = (e.clientX - drag.x) * .0004; drag = null; });

  let visible = true, last = performance.now();
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestAnimationFrame(loop); }).observe(host);
  function loop(now) {
    const dt = Math.min(50, now - last); last = now;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; const t = (now - tw.t0) / tw.dur;
      if (t < 0) continue;
      tw.fn(Math.min(1, t)); if (t >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    if (!drag) { spin += dt * .00025 + vel; vel *= .95; }
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    world.rotation.y = spin + mx * .5;
    world.rotation.x = my * .15;
    world.position.y = Math.sin(now * .0012) * .06;
    renderer.render(scene, cam);
    if (visible && document.visibilityState === 'visible') requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { last = performance.now(); requestAnimationFrame(loop); } });

  build(PRESETS[0], true); requestAnimationFrame(loop);
  return { next, current: () => PRESETS[idx] };
}
