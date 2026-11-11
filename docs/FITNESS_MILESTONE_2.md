# Fitness Milestone 2: 3D Anatomy Model & Multi-Mode Muscle Heatmap

## 1. Scope
Implement the genuine interactive 3D human anatomy model and multi-mode muscle heatmap visualization.
Key features:
- Three.js WebGL canvas rendering a segmented 3D human anatomy model.
- 360-degree rotation, pinch/wheel zoom, camera panning, and preset camera perspectives (Front, Back, Left Side, Right Side, Reset).
- Individual anatomical mesh raycasting, hover highlighting, and pointer selection.
- Multi-mode dynamic heatmap driven by real user workout logs:
  - Mode A: Training Volume (sets × reps × weight with contribution percentages).
  - Mode B: Recovery Status (fatigue dissipation curve over hours since last session).
  - Mode C: Training Frequency (sessions per 7 days).
  - Mode D: Weekly Effective Sets (direct + indirect fractional sets).
  - Mode E: Muscle Imbalance (agonist/antagonist and left/right bilateral asymmetry).
- Detailed Selected Muscle Information Panel with weekly stats, historical charts, and exercise history.
- High-contrast 2D anatomical SVG fallback and keyboard-accessible searchable muscle list for complete accessibility.

## 2. Existing Files Inspected
- `src/components/gym/MuscleHeatmap.tsx`: Legacy 2D flat group overview.
- `package.json`: Contains `"three": "^0.186.1"` and `"@types/three": "^0.186.0"`.
- `src/components/focus/Focus3DVisualizer.tsx`: Canvas rendering patterns and reduced-motion handling.

## 3. Files to Create
- `src/components/gym/Interactive3DAnatomy.tsx`: The primary Three.js WebGL 3D anatomy visualization component with orbit controls, raycaster, materials, and view camera transitions.
- `src/components/gym/MuscleDetailDrawer.tsx`: Information panel displaying detailed metrics, volume history, and related exercises for the selected muscle.
- `src/utils/muscleHeatmapEngine.ts`: Calculation engine transforming workout sessions into muscle-specific color codes and metrics across all 5 visualization modes.
- `docs/FITNESS_MILESTONE_2.md`: This milestone specification.

## 4. Files to Modify
- `src/components/gym/MuscleHeatmap.tsx`: Upgrade to host the interactive 3D anatomy model with 2D switch, mode selector, and color legend.
- `src/components/views/GymView.tsx`: Integrate the upgraded interactive 3D anatomy visualization.

## 5. Implementation Details
### Three.js 3D Architecture
- Segmented procedural humanoid geometry with distinct anatomical meshes for all primary and secondary muscle groups.
- Separate meshes for Left and Right sides (`PecMajor_L`, `PecMajor_R`, `Bicep_L`, `Bicep_R`, `Quad_L`, `Quad_R`, etc.).
- Custom MeshStandardMaterial shaders with dynamic emissive highlight on hover and selection rings.
- Camera tweening for smooth perspective transitions (`Front`: [0, 0, 5], `Back`: [0, 0, -5], `Left`: [-5, 0, 0], `Right`: [5, 0, 0]).
- Raycasting mapping intersections directly to `DetailedMuscleId`.

### Color Scales
- **Training Volume**:
  - Gray (`#334155`): 0 volume (untrained)
  - Dark Blue (`#1e3a8a`): 1 - 500 kg
  - Blue (`#2563eb`): 500 - 1500 kg
  - Cyan (`#06b6d4`): 1500 - 3000 kg
  - Yellow (`#eab308`): 3000 - 5000 kg
  - Orange (`#f97316`): 5000 - 8000 kg
  - Red (`#ef4444`): 8000+ kg
- **Recovery**:
  - Red (`#ef4444`): 0 - 30% (exhausted / acute fatigue)
  - Orange (`#f97316`): 30 - 60% (recovering)
  - Yellow (`#eab308`): 60 - 85% (partially recovered)
  - Green (`#22c55e`): 85 - 100% (ready to train)
  - Gray (`#475569`): No training history

## 6. Dependencies
- Three.js (`three` ^0.186.1, already installed in package.json).

## 7. Acceptance Criteria
- [x] Genuine 3D rotatable and zoomable humanoid model rendered via Three.js.
- [x] View buttons: Front, Back, Left Side, Right Side, Reset Camera.
- [x] Individual muscles selectable via 3D raycasting with distinct Left and Right sides.
- [x] All 5 heatmap modes (Volume, Recovery, Frequency, Sets, Imbalance) accurately reflect user workout logs.
- [x] Accessible searchable muscle list and 2D view toggle available.

## 8. Tests
- Unit and integration tests in `tests/interactive3DAnatomyAndMuscleTaxonomy.test.tsx` verifying mesh mapping, raycast handlers, metric derivations, and mode color outputs.

## 9. Completion Checklist
- [x] Three.js canvas setup with cleanup and WebGL context loss handling.
- [x] Mesh raycasting and hover state management.
- [x] 5-mode heatmap color calculation engine.
- [x] Selected muscle details drawer.

