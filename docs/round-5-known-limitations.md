# MORPH//LAB Round 5 known limitations

Date: 2026-07-22

## Accepted constraints

- Hero and Journey remain independent canvases. Two WebGL contexts can therefore coexist on desktop, although shared parsed assets and texture leases remove duplicate parse/transcode ownership.
- The reported FPS/1% low measures sustained scrolling after the target stage is resident. Cold Journey entry is measured separately as time-to-scene; a first-use shader or upload stall is not disguised as a sustained frame-rate sample.
- The Round 4 diagnostic FPS baseline used SwiftShader and is retained only as historical regression evidence. Final performance acceptance uses the identified NVIDIA D3D11 renderer and is not presented as a direct before/after GPU comparison.
- Compressed micro normals are intentionally limited to small, local detail meshes. Large surfaces and cross-object static batches use clean authored shading because the available KTX2 normal patterns produced visible striping at Journey camera distances.
- Vinext still reports a generic minified chunk-size warning. The desktop Three.js runtime remains dynamically imported behind desktop, motion, and intersection gates; mobile and Reduced Motion request zero Journey GLBs.

## Release boundary

No deployment, push, merge, or production configuration change is included in this delivery. GitHub Pages deployment remains a separate explicitly authorized operation.
