import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const d = await io.read(f); const r = d.getRoot();
  const tris = r.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
  console.log('##', f.split('/').pop(), 'meshes', r.listMeshes().length, 'tris', tris, 'skins', r.listSkins().length, 'joints', r.listSkins()[0]?.listJoints().length, 'anims', r.listAnimations().length, 'tex', r.listTextures().map(t => t.getImage()?.byteLength).join(','));
  if (r.listAnimations().length) console.log('  ', r.listAnimations().map(a => a.getName()).join(' | '));
  if (r.listSkins().length) console.log('  joints:', r.listSkins()[0].listJoints().map(j => j.getName()).slice(0, 70).join(' '));
}
