# MORPH//LAB Round 4 geometry and intersection audit

- High: 0
- Medium: 0
- Allow-listed Low: 250
- States per stage: 41
- Meshes audited: 324

## Unresolved intersections

None. High and Medium gates are clear.

## Topology

```json
{
  "observe": {
    "meshCount": 61,
    "negativeScale": 0,
    "unappliedRotationScale": 0,
    "looseVertices": 0,
    "zeroAreaFaces": 0,
    "nonManifoldEdges": 0,
    "internalFaces": 0,
    "coplanarPairs": 0,
    "duplicateMaterialSlots": 0,
    "invalidMeshes": 0,
    "solidMeshesUsingDoubleSide": 0
  },
  "structure": {
    "meshCount": 86,
    "negativeScale": 0,
    "unappliedRotationScale": 0,
    "looseVertices": 0,
    "zeroAreaFaces": 0,
    "nonManifoldEdges": 0,
    "internalFaces": 0,
    "coplanarPairs": 0,
    "duplicateMaterialSlots": 0,
    "invalidMeshes": 0,
    "solidMeshesUsingDoubleSide": 0
  },
  "prototype": {
    "meshCount": 97,
    "negativeScale": 0,
    "unappliedRotationScale": 0,
    "looseVertices": 0,
    "zeroAreaFaces": 0,
    "nonManifoldEdges": 0,
    "internalFaces": 0,
    "coplanarPairs": 0,
    "duplicateMaterialSlots": 0,
    "invalidMeshes": 0,
    "solidMeshesUsingDoubleSide": 0
  },
  "release": {
    "meshCount": 80,
    "negativeScale": 0,
    "unappliedRotationScale": 0,
    "looseVertices": 0,
    "zeroAreaFaces": 0,
    "nonManifoldEdges": 0,
    "internalFaces": 0,
    "coplanarPairs": 0,
    "duplicateMaterialSlots": 0,
    "invalidMeshes": 0,
    "solidMeshesUsingDoubleSide": 0
  }
}
```

## Environment checks

```json
{
  "observe": {
    "cameraNearPlane": {
      "status": "pass",
      "clipStart": 0.1,
      "nearestObjectOrigin": 12.608485
    },
    "monitorPanelWorkbenchProxy": {
      "status": "pass",
      "objects": [
        "OBS_research_table",
        "OBS_monitor_frame"
      ],
      "missing": []
    },
    "externalOcclusion": {
      "status": "pass",
      "externalMeshes": []
    },
    "internalSurfaceExposure": {
      "status": "pass",
      "doubleSidedSolids": []
    },
    "stageRootOwnership": {
      "status": "pass",
      "stageRoot": "ROOT_OBSERVE",
      "exportedTopLevelObjects": [
        "ROOT_OBSERVE"
      ],
      "offenders": []
    }
  },
  "structure": {
    "cameraNearPlane": {
      "status": "pass",
      "clipStart": 0.1,
      "nearestObjectOrigin": 12.566583
    },
    "monitorPanelWorkbenchProxy": {
      "status": "pass",
      "objects": [
        "STR_console",
        "STR_grid_board"
      ],
      "missing": []
    },
    "externalOcclusion": {
      "status": "pass",
      "externalMeshes": []
    },
    "internalSurfaceExposure": {
      "status": "pass",
      "doubleSidedSolids": []
    },
    "stageRootOwnership": {
      "status": "pass",
      "stageRoot": "ROOT_STRUCTURE",
      "exportedTopLevelObjects": [
        "ROOT_STRUCTURE"
      ],
      "offenders": []
    }
  },
  "prototype": {
    "cameraNearPlane": {
      "status": "pass",
      "clipStart": 0.1,
      "nearestObjectOrigin": 11.84897
    },
    "monitorPanelWorkbenchProxy": {
      "status": "pass",
      "objects": [
        "PRO_test_bench",
        "PRO_monitor_frame"
      ],
      "missing": []
    },
    "externalOcclusion": {
      "status": "pass",
      "externalMeshes": []
    },
    "internalSurfaceExposure": {
      "status": "pass",
      "doubleSidedSolids": []
    },
    "stageRootOwnership": {
      "status": "pass",
      "stageRoot": "ROOT_PROTOTYPE",
      "exportedTopLevelObjects": [
        "ROOT_PROTOTYPE"
      ],
      "offenders": []
    }
  },
  "release": {
    "cameraNearPlane": {
      "status": "pass",
      "clipStart": 0.1,
      "nearestObjectOrigin": 13.574999
    },
    "monitorPanelWorkbenchProxy": {
      "status": "pass",
      "objects": [
        "REL_delivery_station",
        "REL_monitor_frame",
        "REL_qa_panel"
      ],
      "missing": []
    },
    "externalOcclusion": {
      "status": "pass",
      "externalMeshes": []
    },
    "internalSurfaceExposure": {
      "status": "pass",
      "doubleSidedSolids": []
    },
    "stageRootOwnership": {
      "status": "pass",
      "stageRoot": "ROOT_RELEASE",
      "exportedTopLevelObjects": [
        "ROOT_RELEASE"
      ],
      "offenders": []
    }
  }
}
```
