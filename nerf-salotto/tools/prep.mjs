import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, quantize, resample, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SRC = new URL('../assets_src/', import.meta.url).pathname; // qui i pacchetti Quaternius/Polyy scompattati
const OUT = new URL('../assets/', import.meta.url).pathname;
const BC = SRC + 'Universal_Base_Characters_Standard_/Universal Base Characters[Standard]/Base Characters/Godot - UE/';
const G = SRC + '3D_low_poly_guns_pack_2/3D_low_poly_guns_pack_2/models/';
const UAL1 = SRC + 'Universal_Animation_LibraryStandard/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const UAL2 = SRC + 'Universal_Animation_Library_2Standard/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';
// personaggi
for (const n of ['Superhero_Male_FullBody', 'Superhero_Female_FullBody']) {
  const d = await io.read(BC + n + '.gltf');
  for (const m of d.getRoot().listMaterials()) { const t = m.getMetallicRoughnessTexture(); if (t) { m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(.6); } }
  await d.transform(prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82, pattern: /BaseColor|Dark|Brown/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 75 }),
    quantize());
  await io.write(OUT + n + '.glb', d);
}
// animazioni: solo scheletro + clip scelte
const keep1 = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Death01', 'Hit_Chest', 'Dance_Loop', 'Roll', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Idle_Loop', 'Pistol_Shoot', 'Pistol_Reload', 'Crouch_Idle_Loop', 'Idle_Talking_Loop', 'Interact', 'Spell_Simple_Shoot', 'Punch_Cross', 'PickUp_Table'];
const keep2 = ['Yes', 'LayToIdle', 'Hit_Knockback', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'Idle_FoldArms_Loop', 'Idle_Rail_Call', 'Idle_No_Loop', 'OverhandThrow', 'Slide_Loop'];
for (const [f, keep, o] of [[UAL1, keep1, 'anims1.glb'], [UAL2, keep2, 'anims2.glb']]) {
  const d = await io.read(f); const r = d.getRoot();
  for (const a of r.listAnimations()) if (!keep.includes(a.getName())) a.dispose();
  for (const n of r.listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); }
  for (const m of r.listMeshes()) m.dispose(); for (const s of r.listSkins()) s.dispose();
  await d.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true }), dedup());
  await io.write(OUT + o, d); console.log(o, r.listAnimations().map(a => a.getName()).join(','));
}
// armi
for (const [n, out] of [['helical_mag_carbine', 'gun_rifle'], ['anti_materiel_rifle', 'gun_sniper'], ['recoilless_rifle', 'gun_bazooka']]) {
  const d = await io.read(G + n + '.glb');
  await d.transform(weld({ tolerance: .0005 }), simplify({ simplifier: MeshoptSimplifier, ratio: .08, error: .004 }), prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }), quantize());
  const tris = d.getRoot().listMeshes()[0].listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
  await io.write(OUT + out + '.glb', d); console.log(out, tris);
}
