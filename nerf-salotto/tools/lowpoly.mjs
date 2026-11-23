import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, prune, dedup, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const io = new NodeIO();
const doc = await io.read(new URL('../scan/Scan_casa.glb', import.meta.url).pathname);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { for (const s of p.listSemantics()) if (s !== 'POSITION') p.setAttribute(s, null); p.setMaterial(null); }
for (const t of doc.getRoot().listTextures()) t.dispose();
for (const ratio of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [0.025])) {
  const d = cloneDocument(doc);
  await d.transform(weld({ tolerance: 0.0008 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: +(process.env.ERR||0.02), lockBorder: false }), prune(), dedup());
  const n = d.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
  await io.write(new URL('../models/lowpoly_' + ratio + '.glb', import.meta.url).pathname, d);
  console.log(ratio, 'triangoli', n);
}
