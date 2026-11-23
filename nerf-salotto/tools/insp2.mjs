import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) { const d = await io.read(f); const r = d.getRoot();
  console.log('##', f.split('/').pop());
  r.listMeshes().forEach(m => console.log('  mesh', m.getName(), m.listPrimitives().map(p => (p.getIndices()?.getCount()/3) + ' mat:' + p.getMaterial()?.getName()).join(';')));
  r.listTextures().forEach(t => console.log('  tex', t.getName(), t.getMimeType(), t.getSize(), t.getImage()?.byteLength));
  r.listNodes().filter(n=>n.getMesh()).forEach(n=>console.log('  node', n.getName(), n.getTranslation(), n.getScale()));
}
