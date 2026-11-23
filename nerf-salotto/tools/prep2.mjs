import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const A = new URL('../assets/', import.meta.url).pathname;
for (const f of ['anims1', 'anims2']) {
  const d = await io.read(A + f + '.glb'); let drop = 0, tot = 0;
  for (const a of d.getRoot().listAnimations()) for (const c of a.listChannels()) {
    tot++; const p = c.getTargetPath(), n = c.getTargetNode()?.getName() || '';
    if (p === 'scale' || (p === 'translation' && !['root', 'pelvis'].includes(n)) || /_04_leaf|ball_leaf/.test(n)) { c.getSampler().dispose(); c.dispose(); drop++; }
  }
  await d.transform(resample({ tolerance: 2e-3 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(A + f + '_m.glb', d); console.log(f, 'tolti', drop, 'di', tot);
}
for (const f of ['Superhero_Male_FullBody', 'Superhero_Female_FullBody', 'gun_rifle', 'gun_sniper', 'gun_bazooka']) {
  const d = await io.read(A + f + '.glb'); await d.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' })); await io.write(A + f + '_m.glb', d);
}
