# MORPH//LAB Round 3 intersection report

- High: 0
- Medium: 0
- Low accepted contacts: 211
- Animation samples per stage: 21
- Meshes audited: 289

## Method

All exported mesh objects are sampled at 5% progress increments. World-space AABB broad phase is followed by evaluated-mesh BVH overlap checks; containment candidates are retained when broad-phase penetration exceeds the contact tolerance. Low contacts require a named pair rule and a maximum allowed depth.

## Unresolved intersections

None. High and Medium acceptance gates are clear.

## Topology

```json
{
  "observe": {
    "meshObjects": 57,
    "negativeScale": 0,
    "zeroAreaFaces": 0,
    "looseVertices": 0
  },
  "structure": {
    "meshObjects": 81,
    "negativeScale": 0,
    "zeroAreaFaces": 0,
    "looseVertices": 0
  },
  "prototype": {
    "meshObjects": 86,
    "negativeScale": 0,
    "zeroAreaFaces": 0,
    "looseVertices": 0
  },
  "release": {
    "meshObjects": 65,
    "negativeScale": 0,
    "zeroAreaFaces": 0,
    "looseVertices": 0
  }
}
```
