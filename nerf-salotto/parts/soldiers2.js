// ---------- soldatini d'azione: personaggi e animazioni Quaternius (CC0), armi Polyy (CC0) ----------
function toyMat(c, rough = .55) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: .05 }); }
const CHARS = [
  { id: 'falco', name: 'SERGENTE FALCO', role: 'Assalto', desc: 'Veterano delle battaglie sul tappeto. Spara a raffica tenendo premuto.', body: 'male',
    col: { shirt: '#56703c', pants: '#46592f', boots: '#2b2520', gloves: '#2b2520', belt: '#3a2c20', gear: '#b3261e', sleeve: 'skin' }, gear: 'beret', spd: 1.05, fuel: 1,
    w: { id: 'rifle', model: 'gun_rifle', name: 'Carabina a raffica', auto: true, rate: 9, mag: 30, reload: 1.8, speed: 54, spread: .03, grav: 9, kind: 'dart' },
    stats: { Velocità: .8, Cadenza: 1, Precisione: .55, Potenza: .35, Jetpack: .6 } },
  { id: 'neve', name: 'TENENTE NEVE', role: 'Tiratrice scelta', desc: 'Pazienza glaciale. Tasto destro per il mirino: un colpo, un bersaglio.', body: 'female',
    col: { shirt: '#e4e9ee', pants: '#c3ccd5', boots: '#3b4148', gloves: '#5d6873', belt: '#5d6873', gear: '#dfe5eb', sleeve: 'shirt' }, gear: 'hood', spd: .95, fuel: 1,
    w: { id: 'sniper', model: 'gun_sniper', name: 'Fucile anti-materiale', auto: false, rate: 1.6, mag: 6, reload: 2.0, speed: 100, spread: 0, grav: 2.5, kind: 'long', zoom: true },
    stats: { Velocità: .65, Cadenza: .3, Precisione: 1, Potenza: .6, Jetpack: .6 } },
  { id: 'vulcano', name: 'CAPITANO VULCANO', role: 'Esplosivi', desc: 'Pilota col serbatoio più grande. I suoi razzi abbattono tutto quello che c\'è intorno.', body: 'male',
    col: { shirt: '#d35400', pants: '#2c2c2c', boots: '#1e1e1e', gloves: '#1e1e1e', belt: '#1e1e1e', gear: '#2c2c2c', sleeve: 'shirt' }, gear: 'helmet', spd: .9, fuel: 1.35,
    w: { id: 'bazooka', model: 'gun_bazooka', name: 'Lanciarazzi', auto: false, rate: .9, mag: 3, reload: 2.4, speed: 34, spread: 0, grav: 7, kind: 'rocket', blast: 4.5 },
    stats: { Velocità: .5, Cadenza: .15, Precisione: .7, Potenza: 1, Jetpack: 1 } }
];
const ASSETS = {}; let CLIPS = {};
async function loadAssets() {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = k => L.parseAsync(Uint8Array.from(atob(window.ASSETS_B64[k]), c => c.charCodeAt(0)).buffer, '');
  const keys = ['male', 'female', 'anims1', 'anims2', 'gun_rifle', 'gun_sniper', 'gun_bazooka'];
  const res = await Promise.all(keys.map(parse)); keys.forEach((k, i) => ASSETS[k] = res[i]);
  [...ASSETS.anims1.animations, ...ASSETS.anims2.animations].forEach(c => CLIPS[c.name] = c);
}
// parti del corpo: gambe (sotto) e busto/braccia (sopra)
const LOWER = new Set(['root', 'pelvis', 'spine_01', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r']);
const subClips = {};
function subClip(name, part) {   // part: 'full' | 'lower' | 'upper'
  const key = name + '|' + part; if (subClips[key]) return subClips[key];
  const c = CLIPS[name]; if (part === 'full') return subClips[key] = c;
  const tr = c.tracks.filter(t => { const b = t.name.split('.')[0]; return part === 'lower' ? LOWER.has(b) : !LOWER.has(b); });
  return subClips[key] = new THREE.AnimationClip(name + '_' + part, c.duration, tr);
}
// colori della divisa, dipinti sul modello in base all'osso che muove ogni punto
function outfitize(mesh, def, isBody) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones;
  const c = def.col, col = k => new THREE.Color(c[k]), n = g.attributes.position.count, arr = new Float32Array(n * 4);
  const pos = g.attributes.position, P = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
    const b = bones[best].name; let k = null;
    if (!isBody) k = null;
    else if (/^(foot|ball)/.test(b)) k = 'boots';
    else if (/^(thigh|calf)/.test(b)) k = 'pants';
    else if (b === 'pelvis') k = 'pants';
    else if (/^spine_01/.test(b)) k = 'belt';
    else if (/^spine|clavicle/.test(b)) k = 'shirt';
    else if (/^upperarm/.test(b)) k = 'shirt';
    else if (/^lowerarm/.test(b)) k = c.sleeve === 'skin' ? null : 'shirt';
    else if (/^(hand|index|middle|ring|pinky|thumb)/.test(b)) k = 'gloves';
    if (k) { const cc = col(k); cc.convertSRGBToLinear(); arr.set([cc.r, cc.g, cc.b, 1], i * 4); }
  }
  g.setAttribute('outfit', new THREE.BufferAttribute(arr, 4));
  const m = mesh.material.clone(); m.roughness = .55; m.metalness = .02; m.normalScale && m.normalScale.set(1.4, 1.4);
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 outfit;\nvarying vec4 vOutfit;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOutfit = outfit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vOutfit;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114)); float k = clamp(lum / .32, .55, 1.35);\n diffuseColor.rgb = mix(diffuseColor.rgb, vOutfit.rgb * k, vOutfit.a); }');
  };
  m.customProgramCacheKey = () => 'outfit'; mesh.material = m;
}
function buildWeapon(w) {
  const src = ASSETS[w.model].scene, g = new THREE.Group(), m = src.clone(true); g.add(m);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  // tutte le armi: canna verso -z, impugnatura all'origine
  if (w.id === 'bazooka') { m.rotation.y = Math.PI; m.scale.setScalar(1.2); m.position.set(0, -.08, .05); muzzle.position.set(0, -.08, -.6);
    m.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); }
  else if (w.id === 'sniper') { m.rotation.y = Math.PI / 2; m.scale.setScalar(1.15); m.position.set(0, .06, -.12); muzzle.position.set(0, .06, -.7); }
  else { m.rotation.y = Math.PI / 2; m.scale.setScalar(.8); m.position.set(0, .07, -.12); muzzle.position.set(0, .08, -.52); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.userData.muzzle = muzzle; return g;
}
const SOLDIER_SCALE = 1.5 / 1.82;
function gearFor(def, headBone, P) {   // P: posizione della testa nel mondo, durante la posa di riposo
  const G = new THREE.Group(), GE = toyMat(def.col.gear);
  if (def.gear === 'beret') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.115, .11, .05, 20), GE); b.position.set(-.02, .1, -.01); b.rotation.z = .25; b.rotation.x = -.1; G.add(b);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), GE); puff.scale.y = .35; puff.position.set(-.03, .12, -.01); puff.rotation.z = .25; G.add(puff);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .01, 12), toyMat('#ffd21f', .3)); badge.rotation.x = Math.PI / 2; badge.position.set(.05, .11, .1); G.add(badge);
  } else if (def.gear === 'hood') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 14, 0, Math.PI * 2, 0, Math.PI * .6), GE); h.position.set(0, .04, -.025); h.rotation.x = -.35; G.add(h);
    const fur = new THREE.Mesh(new THREE.TorusGeometry(.11, .03, 8, 22), toyMat('#f7f3ea', .95)); fur.position.set(0, .03, .07); fur.rotation.x = .25; G.add(fur);
    const gog = new THREE.Mesh(new THREE.BoxGeometry(.17, .045, .04), toyMat('#2f9be0', .15)); gog.position.set(0, .12, .085); gog.rotation.x = -.35; G.add(gog);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(.125, .01, 6, 24), toyMat('#3b4148')); strap.position.set(0, .1, 0); strap.rotation.x = Math.PI / 2 - .35; G.add(strap);
  } else {
    const h = new THREE.Mesh(new THREE.SphereGeometry(.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * .58), GE); h.position.set(0, .04, -.01); G.add(h);
    const vis = new THREE.Mesh(new THREE.SphereGeometry(.137, 20, 8, -Math.PI * .32, Math.PI * .64, Math.PI * .3, Math.PI * .16), toyMat('#ffb347', .1)); vis.position.set(0, .04, -.01); G.add(vis);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.03, .015, .27), toyMat('#d35400')); stripe.position.set(0, .175, -.01); G.add(stripe);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 14), toyMat('#d35400')); e.rotation.z = Math.PI / 2; e.position.set(s * .13, .02, -.01); G.add(e); });
  }
  G.position.copy(P); return G;
}
function buildSoldier(def) {
  const src = ASSETS[def.body].scene, model = SkeletonUtils.clone(src);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(model);
  model.rotation.y = Math.PI; model.scale.setScalar(SOLDIER_SCALE);   // il modello guarda verso +z, il gioco verso -z
  let bodyMesh = null; model.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = false; if (o.geometry.attributes.position.count > 5000) bodyMesh = o; } });
  model.traverse(o => { if (o.isSkinnedMesh) outfitize(o, def, o === bodyMesh); });
  if (def.gear !== 'beret') model.traverse(o => { if (o.isSkinnedMesh && /hair/i.test(o.material.name) && o !== bodyMesh) o.visible = false; });
  const mixer = new THREE.AnimationMixer(model), acts = {};
  const act = (name, part) => { const k = name + '|' + part; if (!acts[k]) { const a = mixer.clipAction(subClip(name, part)); a.enabled = true; a.setEffectiveWeight(0); a.play(); a.w = 0; a.tw = 0; acts[k] = a; } return acts[k]; };
  // posa di mira per montare l'arma nella mano giusta
  root.updateMatrixWorld(true);
  const bone = n => model.getObjectByName(n);
  const head = bone('Head'), spine3 = bone('spine_03'), handR = bone('hand_r'), handL = bone('hand_l');
  const hp = head.getWorldPosition(new THREE.Vector3()); const gear = gearFor(def, head, hp); root.add(gear); head.attach(gear);
  // jetpack sulla schiena
  const jet = new THREE.Group(), flames = [];
  { const tankM = toyMat('#c9ced6', .35), capM = toyMat('#ff7a1a');
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.3, .32, .05), toyMat('#3a3f45')); jet.add(plate);
    [-.085, .085].forEach(x => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .34, 16), tankM); t.position.set(x, 0, .06); jet.add(t);
      const cp = new THREE.Mesh(new THREE.SphereGeometry(.065, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM); cp.position.set(x, .17, .06); jet.add(cp);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(.045, .07, .08, 14), toyMat('#3a3f45')); n.position.set(x, -.21, .06); jet.add(n);
      const f = new THREE.Mesh(new THREE.ConeGeometry(.06, .46, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.rotation.x = Math.PI; f.position.set(x, -.48, .06); f.visible = false; jet.add(f); flames.push(f);
      const fi = new THREE.Mesh(new THREE.ConeGeometry(.032, .28, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
      fi.rotation.x = Math.PI; fi.position.set(x, -.38, .06); fi.visible = false; jet.add(fi); flames.push(fi); }); }
  const sp = spine3.getWorldPosition(new THREE.Vector3()); jet.position.set(sp.x, sp.y - .02, sp.z + .16); root.add(jet); spine3.attach(jet);
  // arma: monto nella posa di mira
  const aim = act('Pistol_Aim_Neutral', 'full'); aim.setEffectiveWeight(1); mixer.update(0); root.updateMatrixWorld(true);
  const weapon = buildWeapon(def.w);
  if (def.w.id === 'bazooka') {   // sulla spalla destra
    const sh = bone('upperarm_r').getWorldPosition(new THREE.Vector3()); weapon.position.set(sh.x + .02, sh.y + .1, sh.z - .02);
  } else { const a = handR.getWorldPosition(new THREE.Vector3()); weapon.position.copy(a); weapon.position.y += .02; }
  root.add(weapon); (def.w.id === 'bazooka' ? spine3 : handR).attach(weapon);
  aim.setEffectiveWeight(0);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { def, root, body, model, mixer, act, acts, jet, flames, weapon, gun: weapon, phase: 0, recoil: 0, fall: 0, mode: '', modeT: 0, spine3, head, upperR: bone('upperarm_r') };
}
// ---------- regia delle animazioni ----------
// sceglie quanto pesa ogni animazione: gambe secondo il movimento, braccia secondo la mira
function animSoldier(s, st, dt) {
  const T = { lower: {}, upper: {}, full: {} }, sp = st.speed || 0;
  let mode = 'move';
  if (st.stun > 0) mode = st.stun > 1.35 ? 'fall' : 'getup';
  else if (st.emote) mode = 'emote:' + st.emote;
  if (mode !== s.mode) { s.mode = mode; s.modeT = 0; const once = { fall: 'Death01', getup: 'LayToIdle', 'emote:Yes': 'Yes' }[mode];
    if (once) { const a = s.act(once, 'full'); a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); } }
  s.modeT += dt;
  if (mode === 'fall') T.full.Death01 = 1;
  else if (mode === 'getup') T.full.LayToIdle = 1;
  else if (mode.startsWith('emote:')) { const e = mode.slice(6); T.full[{ Dance: 'Dance_Loop', Wave: 'Idle_Rail_Call', ThumbsUp: 'Yes', Yes: 'Yes', Fold: 'Idle_FoldArms_Loop', Idle: 'Pistol_Idle_Loop' }[e] || 'Idle_Loop'] = 1; }
  else {
    // gambe
    if (!st.onGround) { if (st.thrusting) T.lower.NinjaJump_Idle_Loop = 1; else if (st.vy > 2) T.lower.Jump_Start = 1; else T.lower.Jump_Loop = 1; }
    else if (sp < .5) T.lower.Idle_Loop = 1;
    else if (sp < 8) { const k = THREE.MathUtils.clamp((sp - 2) / 5, 0, 1); T.lower.Walk_Loop = 1 - k; T.lower.Jog_Fwd_Loop = k; }
    else { const k = THREE.MathUtils.clamp((sp - 8) / 4, 0, 1); T.lower.Jog_Fwd_Loop = 1 - k; T.lower.Sprint_Loop = k; }
    // braccia: posa di mira mescolata secondo l'inclinazione dello sguardo
    if (st.reloading) T.upper.Pistol_Reload = 1;
    else if (st.relaxed) T.upper.Pistol_Idle_Loop = 1;
    else { const p = THREE.MathUtils.clamp((st.pitch || 0) / .9, -1, 1);
      if (p >= 0) { T.upper.Pistol_Aim_Up = p; T.upper.Pistol_Aim_Neutral = 1 - p; } else { T.upper.Pistol_Aim_Down = -p; T.upper.Pistol_Aim_Neutral = 1 + p; } }
  }
  for (const part of ['lower', 'upper', 'full']) for (const n in T[part]) s.act(n, part);
  const k = 1 - Math.exp(-dt * (mode === 'move' ? 12 : 9));
  for (const key in s.acts) {
    const a = s.acts[key], [n, part] = key.split('|'), tw = T[part][n] || 0;
    a.w += (tw - a.w) * k; if (a.w < .002 && tw === 0) a.w = 0;
    a.setEffectiveWeight(a.w);
    if (part === 'lower') a.setEffectiveTimeScale(n === 'Walk_Loop' ? Math.max(.6, sp / 3.2) : n === 'Jog_Fwd_Loop' ? Math.max(.7, sp / 7.5) : n === 'Sprint_Loop' ? sp / 11 : 1);
    if (n === 'LayToIdle') a.setEffectiveTimeScale(1.1);
  }
  s.mixer.update(dt);
  // rinculo e mira fine sopra le animazioni
  if (mode === 'move') {
    s.spine3.rotation.x -= s.recoil * .12; s.upperR.rotation.z += s.recoil * .1;
  }
  s.recoil = Math.max(0, s.recoil - dt * 6);
  s.flames.forEach(fl => { fl.visible = !!st.thrusting; if (st.thrusting) fl.scale.set(1, .8 + Math.random() * .45, 1); });
}
