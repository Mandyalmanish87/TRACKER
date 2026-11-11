import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { WorkoutSession } from '../../types/fitness';
import { HeatmapMode } from '../../types/muscleAnatomy';
import { DETAILED_MUSCLES } from '../../data/muscleTaxonomy';
import BUILTIN_EXERCISES from '../../data/exerciseLibrary.json';
import {
  calculateAllMuscleMetrics,
  getMuscleHeatmapColor,
} from '../../utils/muscleHeatmapEngine';
import { MuscleDetailDrawer } from './MuscleDetailDrawer';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Search,
} from 'lucide-react';

interface Interactive3DAnatomyProps {
  sessions: WorkoutSession[];
  bodyModelPreference: 'male' | 'female';
  onSelectExercise?: (exerciseId: string) => void;
}

const MUSCLE_NAME_ALIASES: Record<string, string[]> = {
  deltoid_anterior: ['clavicular part deltoid'],
  deltoid_lateral: ['acromial part deltoid'],
  deltoid_posterior: ['spinal part deltoid'],
  trapezius_upper: ['descending trapezius'],
  trapezius_middle: ['transverse trapezius'],
  trapezius_lower: ['ascending trapezius'],
  erector_spinae: ['iliocostalis', 'longissimus', 'spinalis'],
  forearm_flexors: ['flexor carpi', 'flexor digitorum', 'flexor pollicis'],
  forearm_extensors: ['extensor carpi', 'extensor digitorum', 'extensor pollicis'],
  peroneal_muscles: ['fibularis'],
};

function muscleTokens(value: string): Set<string> {
  return new Set(
    value.toLowerCase()
      .replace(/sternocostal/g, 'sternal')
      .replace(/pectoralis/g, 'pec')
      .replace(/fibularis/g, 'peroneal')
      .replace(/brachii/g, '')
      .split(/[^a-z]+/)
      .filter((word) => word && !['left', 'right', 'muscle', 'muscles', 'of', 'the', 'part', 'head', 'and'].includes(word))
  );
}

function taxonomyIdsForModelMuscle(name: string, side: string): string[] {
  const sourceWords = muscleTokens(name);
  if (sourceWords.size === 0) return [];

  const scores = DETAILED_MUSCLES
    .filter((muscle) => muscle.side === side)
    .map((muscle) => {
      const baseId = muscle.id.replace(/_(left|right)$/, '');
      const targetWords = muscleTokens(`${baseId.replace(/_/g, ' ')} ${muscle.name}`);
      const aliases = MUSCLE_NAME_ALIASES[baseId] || [];
      let overlap = [...sourceWords].filter((word) => targetWords.has(word)).length;
      if (aliases.some((alias) => {
        const aliasWords = muscleTokens(alias);
        return [...aliasWords].every((word) => sourceWords.has(word));
      })) overlap += 3;
      return { id: muscle.id, overlap };
    });

  const maxOverlap = Math.max(0, ...scores.map((score) => score.overlap));
  const winners = scores.filter((score) => score.overlap === maxOverlap);
  return maxOverlap >= 1 ? winners.map((score) => score.id) : [];
}

export const Interactive3DAnatomy: React.FC<Interactive3DAnatomyProps> = ({
  sessions,
  bodyModelPreference,
  onSelectExercise,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const muscleTagRef = useRef<HTMLDivElement | null>(null);
  const taggedPointRef = useRef<{ mesh: THREE.Mesh; localPoint: THREE.Vector3 } | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesMapRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const muscleMeshesRef = useRef<THREE.Mesh[]>([]);
  const reqAnimFrameRef = useRef<number | null>(null);

  // Interaction State
  const [activeMode, setActiveMode] = useState<HeatmapMode>('volume');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>('pec_major_sternal_left');
  const [hoveredMuscleId, setHoveredMuscleId] = useState<string | null>(null);
  const [viewAngle, setViewAngle] = useState<'front' | 'back' | 'left' | 'right'>('front');
  const [is2DFallback, setIs2DFallback] = useState<boolean>(false);
  const [modelReady, setModelReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [taggedMuscleId, setTaggedMuscleId] = useState<string | null>(null);
  const [poppedMesh, setPoppedMesh] = useState<THREE.Mesh | null>(null);

  // Target camera positions for smooth view switching
  const targetCamPos = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.88, z: 3.15 });
  const targetLookAt = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.88, z: 0 });

  // Calculate live muscle metrics from sessions
  const metricsMap = useMemo(() => {
    return calculateAllMuscleMetrics(sessions, 7);
  }, [sessions]);

  // Selected muscle object
  const selectedMuscle = useMemo(() => {
    return DETAILED_MUSCLES.find((m) => m.id === selectedMuscleId) || null;
  }, [selectedMuscleId]);

  // Selected muscle metrics
  const selectedMuscleMetric = useMemo(() => {
    return selectedMuscleId ? metricsMap.get(selectedMuscleId) : undefined;
  }, [selectedMuscleId, metricsMap]);
  const taggedMuscle = useMemo(
    () => DETAILED_MUSCLES.find((muscle) => muscle.id === taggedMuscleId) || null,
    [taggedMuscleId]
  );
  const taggedExerciseName = useMemo(() => {
    if (!taggedMuscle) return '';
    const groupByRegion: Record<string, string[]> = {
      chest: ['chest'], shoulders: ['front_delts', 'side_delts', 'rear_delts'],
      arms: ['biceps', 'triceps', 'forearms'], back: ['lats', 'traps', 'upper_back', 'lower_back'],
      core: ['abs', 'obliques'], legs: ['quads', 'hamstrings', 'glutes', 'calves'], calves: ['calves'],
      neck: ['traps', 'upper_back'],
    };
    const targets = groupByRegion[taggedMuscle.region] || [taggedMuscle.region];
    const exercises = BUILTIN_EXERCISES as Array<{ name: string; primaryMuscle: string; secondaryMuscles: string[] }>;
    return exercises.find((exercise) => targets.includes(exercise.primaryMuscle))?.name || 'See workout guide';
  }, [taggedMuscle]);

  // Filtered muscles for search
  const filteredMuscles = useMemo(() => {
    if (!searchQuery.trim()) return DETAILED_MUSCLES;
    const q = searchQuery.toLowerCase();
    return DETAILED_MUSCLES.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.commonName.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Load the detailed, individually named Ecorche anatomy asset.
  useEffect(() => {
    if (is2DFallback) return;
    const container = mountRef.current;
    const canvasHost = canvasHostRef.current;
    if (!container || !canvasHost) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 550;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100);
    camera.position.set(targetCamPos.current.x, targetCamPos.current.y, targetCamPos.current.z);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setIs2DFallback(true);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    canvasHost.innerHTML = '';
    canvasHost.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8edf7, 0x3b3334, 2.0));
    const keyLight = new THREE.DirectionalLight(0xfff4ed, 2.4);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa9c4ff, 1.7);
    rimLight.position.set(3, 3, -4);
    scene.add(rimLight);
    const sideLight = new THREE.DirectionalLight(0xffa27b, 0.7);
    sideLight.position.set(4, 0.4, 2);
    scene.add(sideLight);

    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);
    const meshesMap = new Map<string, THREE.Mesh[]>();
    const muscleMeshes: THREE.Mesh[] = [];
    meshesMapRef.current = meshesMap;
    muscleMeshesRef.current = muscleMeshes;
    let disposed = false;
    let hasLoadedModel = false;

    const disposeModel = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      '/models/ecorche.meshopt.glb',
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }

        const model = gltf.scene;
        model.traverse((object) => {
          let layer = object.userData.layer as string | undefined;
          let anatomyName = object.userData.name as string | undefined;
          let anatomySide = object.userData.side as string | undefined;
          let parent = object.parent;
          while (parent && (!layer || !anatomyName || !anatomySide)) {
            layer ||= parent.userData.layer as string | undefined;
            anatomyName ||= parent.userData.name as string | undefined;
            anatomySide ||= parent.userData.side as string | undefined;
            parent = parent.parent;
          }
          if (layer === 'skeleton') {
            object.visible = false;
            return;
          }
          if (!(object instanceof THREE.Mesh)) return;
          if (layer !== 'deep muscles' && layer !== 'superficial muscles') return;

          const name = String(anatomyName || object.name || '');
          const side = String(anatomySide || (name.toLowerCase().includes('right') ? 'right' : 'left'));
          const muscleIds = taxonomyIdsForModelMuscle(name, side);
          object.geometry.computeBoundingSphere();
          const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
          const clonedMaterials = sourceMaterials.map((material) => material.clone());
          clonedMaterials.forEach((material) => {
            if ('color' in material) {
              const sculptMaterial = material as THREE.MeshStandardMaterial;
              sculptMaterial.color.set(layer === 'deep muscles' ? '#99545a' : '#c66b70');
              sculptMaterial.vertexColors = false;
              sculptMaterial.roughness = 0.68;
              sculptMaterial.metalness = 0.02;
              sculptMaterial.emissive.setHex(0x000000);
            }
          });
          object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
          if (muscleIds.length === 0) return;

          object.userData.basePosition = object.position.clone();
          object.userData.muscleIds = muscleIds;
          object.userData.muscleId = muscleIds[0];
          muscleMeshes.push(object);
          muscleIds.forEach((muscleId) => {
            const group = meshesMap.get(muscleId) || [];
            group.push(object);
            meshesMap.set(muscleId, group);
          });
        });

        // The same named muscle structures are used for both anatomy profiles.
        // Female presentation gently adjusts shoulder, waist, and pelvic width;
        // the original detailed muscle catalog and heatmap mapping stay intact.
        if (bodyModelPreference === 'female') {
          model.updateWorldMatrix(true, true);
          const anatomyBounds = new THREE.Box3().setFromObject(model);
          const height = Math.max(anatomyBounds.max.y - anatomyBounds.min.y, 0.001);
          const point = new THREE.Vector3();
          model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            let layer = object.userData.layer as string | undefined;
            let parent = object.parent;
            while (parent && !layer) {
              layer = parent.userData.layer as string | undefined;
              parent = parent.parent;
            }
            if (layer !== 'deep muscles' && layer !== 'superficial muscles') return;
            object.geometry = object.geometry.clone();
            const positions = object.geometry.getAttribute('position');
            object.updateWorldMatrix(true, false);
            for (let index = 0; index < positions.count; index += 1) {
              point.fromBufferAttribute(positions, index);
              object.localToWorld(point);
              const heightRatio = (point.y - anatomyBounds.min.y) / height;
              const gaussian = (center: number, width: number) => Math.exp(-Math.pow((heightRatio - center) / width, 2));
              const widthScale =
                1 - 0.12 * gaussian(0.82, 0.075) - 0.07 * gaussian(0.61, 0.05) + 0.09 * gaussian(0.50, 0.07);
              point.x *= widthScale;
              object.worldToLocal(point);
              positions.setXYZ(index, point.x, point.y, point.z);
            }
            positions.needsUpdate = true;
            object.geometry.computeVertexNormals();
            object.geometry.computeBoundingSphere();
          });
        }

        const bounds = new THREE.Box3().setFromObject(model);
        if (Number.isFinite(bounds.min.y)) {
          const center = bounds.getCenter(new THREE.Vector3());
          model.position.set(-center.x, -bounds.min.y, -center.z);
        }
        bodyGroup.add(model);
        hasLoadedModel = true;
        setModelReady(true);
      },
      undefined,
      () => {
        if (!disposed) setIs2DFallback(true);
      }
    );

    const raycaster = new THREE.Raycaster();
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    const pointerPosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      );
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      isDragging = true;
      container.focus({ preventScroll: true });
      const point = 'touches' in event ? event.touches[0] : event;
      prevMouseX = point.clientX;
      prevMouseY = point.clientY;
    };
    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      const point = 'touches' in event ? event.touches[0] : event;
      if (isDragging) {
        const deltaX = point.clientX - prevMouseX;
        const deltaY = point.clientY - prevMouseY;
        prevMouseX = point.clientX;
        prevMouseY = point.clientY;
        bodyGroup.rotation.y += deltaX * 0.009;
        bodyGroup.rotation.x = Math.max(-0.35, Math.min(0.35, bodyGroup.rotation.x + deltaY * 0.004));
        return;
      }
      if (!('clientX' in event) || !hasLoadedModel) return;
      raycaster.setFromCamera(pointerPosition(point.clientX, point.clientY), camera);
      const hit = raycaster.intersectObjects(muscleMeshes, false)[0]?.object as THREE.Mesh | undefined;
      const muscleId = hit?.userData.muscleId as string | undefined;
      setHoveredMuscleId(muscleId || null);
      container.style.cursor = muscleId ? 'pointer' : 'grab';
    };
    const onPointerUp = () => { isDragging = false; };
    const onClick = (event: MouseEvent) => {
      if (!hasLoadedModel) return;
      raycaster.setFromCamera(pointerPosition(event.clientX, event.clientY), camera);
      const hit = raycaster.intersectObjects(muscleMeshes, false)[0]?.object as THREE.Mesh | undefined;
      const muscleId = hit?.userData.muscleId as string | undefined;
      if (muscleId && hit) {
        const intersection = raycaster.intersectObjects(muscleMeshes, false)[0];
        if (intersection) taggedPointRef.current = { mesh: hit, localPoint: hit.worldToLocal(intersection.point.clone()) };
        setPoppedMesh(hit);
        setTaggedMuscleId(muscleId);
        setSelectedMuscleId(muscleId);
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!hasLoadedModel || event.deltaY === 0) return;
      raycaster.setFromCamera(pointerPosition(event.clientX, event.clientY), camera);
      const focus = raycaster.intersectObjects(muscleMeshes, false)[0]?.point || targetLookAt.current;
      zoomToward(focus, event.deltaY < 0 ? 0.88 : 1.14);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const zoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
      const zoomOut = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
      if (zoomIn) {
        event.preventDefault();
        zoomToward(targetLookAt.current, 0.88);
      } else if (zoomOut) {
        event.preventDefault();
        zoomToward(targetLookAt.current, 1.14);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        bodyGroup.rotation.y += event.key === 'ArrowLeft' ? -0.12 : 0.12;
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('mousemove', onPointerMove);
    dom.addEventListener('click', onClick);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    dom.addEventListener('touchmove', onPointerMove, { passive: true });
    dom.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('keydown', onKeyDown);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    const animate = () => {
      reqAnimFrameRef.current = requestAnimationFrame(animate);
      camera.position.x += (targetCamPos.current.x - camera.position.x) * 0.08;
      camera.position.y += (targetCamPos.current.y - camera.position.y) * 0.08;
      camera.position.z += (targetCamPos.current.z - camera.position.z) * 0.08;
      camera.lookAt(targetLookAt.current.x, targetLookAt.current.y, targetLookAt.current.z);
      if (taggedPointRef.current && muscleTagRef.current) {
        const { mesh, localPoint } = taggedPointRef.current;
        const screenPoint = mesh.localToWorld(localPoint.clone()).project(camera);
        const rect = container.getBoundingClientRect();
        const x = (screenPoint.x * 0.5 + 0.5) * rect.width;
        const y = (-screenPoint.y * 0.5 + 0.5) * rect.height;
        muscleTagRef.current.style.left = `${THREE.MathUtils.clamp(x, 16, rect.width - 16)}px`;
        muscleTagRef.current.style.top = `${THREE.MathUtils.clamp(y, 24, rect.height - 12)}px`;
        muscleTagRef.current.style.opacity = screenPoint.z < 1 ? '1' : '0';
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      if (reqAnimFrameRef.current) cancelAnimationFrame(reqAnimFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
      dom.removeEventListener('mousedown', onPointerDown);
      dom.removeEventListener('mousemove', onPointerMove);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('touchstart', onPointerDown);
      dom.removeEventListener('touchmove', onPointerMove);
      dom.removeEventListener('wheel', onWheel);
      container.removeEventListener('keydown', onKeyDown);
      disposeModel(scene);
      renderer.dispose();
      if (canvasHost) canvasHost.innerHTML = '';
      muscleMeshesRef.current = [];
      meshesMapRef.current.clear();
    };
  }, [is2DFallback, bodyModelPreference]);

  // Update Mesh Colors when Heatmap Mode, Metrics, or Hover changes
  useEffect(() => {
    if (is2DFallback || !modelReady) return;
    muscleMeshesRef.current.forEach((mesh) => {
      const muscleIds = (mesh.userData.muscleIds || []) as string[];
      const activeMetric = muscleIds
        .map((id) => metricsMap.get(id))
        .filter((metric) => metric && metric.sessionsCount > 0)
        .sort((a, b) => (b?.totalVolumeKg || 0) - (a?.totalVolumeKg || 0))[0];
      const mappedMuscle = muscleIds.includes(selectedMuscleId || '')
        ? selectedMuscleId
        : muscleIds[0];
      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materialList.forEach((material) => {
        const mat = material as THREE.MeshStandardMaterial;
        mat.color.set(activeMetric ? getMuscleHeatmapColor(activeMetric, activeMode).hex : '#c66b70');
        if (muscleIds.includes(selectedMuscleId || '') && selectedMuscleId === mappedMuscle) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.18;
        } else if (muscleIds.includes(hoveredMuscleId || '')) {
          mat.emissive.setHex(0xff8a5c);
          mat.emissiveIntensity = 0.24;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      });
    });
  }, [activeMode, metricsMap, selectedMuscleId, hoveredMuscleId, is2DFallback, modelReady]);

  // Pull the exact clicked muscle mesh clearly into 3D space, then return the prior one.
  useEffect(() => {
    if (is2DFallback || !modelReady) return;
    let frame = 0;
    const animatePopout = () => {
      let stillMoving = false;
      muscleMeshesRef.current.forEach((mesh) => {
        const base = mesh.userData.basePosition as THREE.Vector3 | undefined;
        if (!base) return;
        const isSelected = mesh === poppedMesh;
        const target = base.clone();
        if (isSelected && mesh.parent) {
          const currentPosition = mesh.position.clone();
          mesh.position.copy(base);
          mesh.updateWorldMatrix(true, false);
          const center = mesh.geometry.boundingSphere?.center.clone().applyMatrix4(mesh.matrixWorld) || mesh.getWorldPosition(new THREE.Vector3());
          const radial = center.clone().sub(new THREE.Vector3(0, 0.88, 0)).normalize();
          const camera = cameraRef.current;
          const towardViewer = camera ? camera.position.clone().sub(center).normalize() : radial;
          const outward = radial.multiplyScalar(0.65).add(towardViewer.multiplyScalar(0.35)).normalize();
          const parentRotation = mesh.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
          target.add(outward.applyQuaternion(parentRotation).multiplyScalar(0.48));
          mesh.position.copy(currentPosition);
        }
        mesh.position.lerp(target, 0.16);
        if (mesh.position.distanceToSquared(target) > 0.0001) stillMoving = true;
      });
      if (stillMoving) frame = requestAnimationFrame(animatePopout);
    };
    frame = requestAnimationFrame(animatePopout);
    return () => cancelAnimationFrame(frame);
  }, [poppedMesh, modelReady, is2DFallback]);

  // Camera Presets
  const setCameraView = (view: 'front' | 'back' | 'left' | 'right') => {
    setViewAngle(view);
    targetLookAt.current = { x: 0, y: 0.88, z: 0 };
    if (view === 'front') {
      targetCamPos.current = { x: 0, y: 0.88, z: 3.15 };
    } else if (view === 'back') {
      targetCamPos.current = { x: 0, y: 0.88, z: -3.15 };
    } else if (view === 'left') {
      targetCamPos.current = { x: -3.15, y: 0.88, z: 0 };
    } else if (view === 'right') {
      targetCamPos.current = { x: 3.15, y: 0.88, z: 0 };
    }
  };

  const handleZoom = (delta: number) => {
    const current = targetCamPos.current;
    const point = targetLookAt.current;
    const distance = Math.hypot(current.x - point.x, current.y - point.y, current.z - point.z);
    zoomToward(point, (distance + delta) / Math.max(distance, 0.001));
  };

  const zoomToward = (point: { x: number; y: number; z: number }, requestedRatio: number) => {
    const camera = targetCamPos.current;
    const currentDistance = Math.hypot(camera.x - point.x, camera.y - point.y, camera.z - point.z);
    const nextDistance = THREE.MathUtils.clamp(currentDistance * requestedRatio, 1.25, 6.5);
    const ratio = nextDistance / Math.max(currentDistance, 0.001);
    targetCamPos.current = {
      x: point.x + (camera.x - point.x) * ratio,
      y: point.y + (camera.y - point.y) * ratio,
      z: point.z + (camera.z - point.z) * ratio,
    };
    const focus = targetLookAt.current;
    targetLookAt.current = {
      x: point.x + (focus.x - point.x) * ratio,
      y: point.y + (focus.y - point.y) * ratio,
      z: point.z + (focus.z - point.z) * ratio,
    };
  };

  const handleResetCamera = () => {
    setCameraView('front');
    targetCamPos.current = { x: 0, y: 0.88, z: 3.15 };
    targetLookAt.current = { x: 0, y: 0.88, z: 0 };
  };

  return (
    <div className="space-y-6">
      {/* ── Visualizer Controls & Mode Header ── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-terracotta-500 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-terracotta-600 dark:text-terracotta-400">
                3D Kinetic Chain Engine
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-ivory-50 tracking-tight mt-0.5">
              Interactive 3D Muscle Anatomy &amp; Heatmap
            </h2>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              {bodyModelPreference === 'female' ? 'Female body proportions with the same detailed muscle structures, training heatmaps, and selectable exercise guidance.' : 'Male body proportions with detailed, rotatable muscle structures, training heatmaps, and selectable exercise guidance.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                { id: 'volume', label: 'Volume (kg)' },
                { id: 'recovery', label: 'Recovery %' },
                { id: 'frequency', label: 'Frequency' },
                { id: 'sets', label: 'Sets' },
                { id: 'imbalance', label: 'Imbalance' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                aria-pressed={activeMode === mode.id}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  activeMode === mode.id
                    ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-xs'
                    : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Views & Fallback Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ivory-200 dark:border-espresso-750 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase font-bold text-espresso-400 mr-1">Views:</span>
            {(['front', 'back', 'left', 'right'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setCameraView(v)}
                aria-pressed={viewAngle === v}
                className={`px-2.5 py-1 rounded-lg font-medium transition capitalize ${
                  viewAngle === v
                    ? 'bg-terracotta-50 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800/60 font-semibold'
                    : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
                }`}
              >
                {v}
              </button>
            ))}

            <button
              onClick={handleResetCamera}
              aria-label="Reset camera orientation and zoom"
              className="p-1 rounded-lg bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100 ml-1"
              title="Reset Camera Orientation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(-0.5)}
              aria-label="Zoom in"
              className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(0.5)}
              aria-label="Zoom out"
              className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIs2DFallback(!is2DFallback)}
              aria-pressed={is2DFallback}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 font-medium text-espresso-700 dark:text-ivory-200 hover:bg-ivory-50"
            >
              <Layers className="w-3.5 h-3.5 text-terracotta-600" />
              <span>{is2DFallback ? 'Switch to 3D WebGL' : '2D Map View'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Visualizer Layout: Model (Left/Center) + Details Panel (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)] gap-6 items-start">
        {/* 3D Canvas / 2D Map Container */}
        <div className="relative p-4 rounded-3xl border border-ivory-300 dark:border-espresso-750 bg-[#0B0D0C] text-white shadow-xl overflow-hidden min-h-[560px] flex flex-col justify-between">
          {/* Legend Banner */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-espresso-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-espresso-800 text-[11px]">
            <span className="font-mono uppercase font-bold text-espresso-400">
              {activeMode.toUpperCase()} SCALE:
            </span>
            {activeMode === 'volume' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#334155]" /> 0
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" /> Low
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" /> Mid
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> High
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Max
                </span>
              </div>
            )}
            {activeMode === 'recovery' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> &lt;30%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> 30-60%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> 60-85%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> 85-100%
                </span>
              </div>
            )}
            {activeMode === 'frequency' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#334155]" /> 0x
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" /> 1x
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> 2x
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" /> 3x+
                </span>
              </div>
            )}
            {activeMode === 'sets' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#334155]" /> 0
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> 1-5
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> 6-12
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> 12+
                </span>
              </div>
            )}
            {activeMode === 'imbalance' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Balanced
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Asymmetric Load
                </span>
              </div>
            )}
          </div>

          {/* 3D WebGL Canvas */}
          {!is2DFallback ? (
            <div
              ref={mountRef}
              className="w-full h-[480px] my-auto cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 rounded-xl"
              role="application"
              aria-label="Interactive 3D muscle anatomy. Drag to rotate. Scroll over an area to zoom there. Use plus and minus to zoom, and left or right arrow keys to rotate."
              tabIndex={0}
              aria-describedby="anatomy-keyboard-help"
            >
              <div ref={canvasHostRef} className="absolute inset-0" />
              {taggedMuscle && (
                <div
                  ref={muscleTagRef}
                  role="status"
                  aria-live="polite"
                  className="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-none max-w-[230px] rounded-xl border border-terracotta-300/80 bg-[#16120f]/95 px-3 py-2 text-white shadow-xl backdrop-blur-sm transition-opacity"
                  style={{ left: 0, top: 0 }}
                >
                  <div className="text-[11px] font-bold leading-tight">{taggedMuscle.name}</div>
                  <div className="mt-1 text-[10px] text-terracotta-200">Try: {taggedExerciseName}</div>
                </div>
              )}
            </div>
          ) : (
            /* 2D Anatomical Map Fallback */
            <div className="my-auto py-8 text-center space-y-4">
              <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-left">
                {DETAILED_MUSCLES.slice(0, 16).map((m) => {
                  const met = metricsMap.get(m.id);
                  const color = getMuscleHeatmapColor(met, activeMode);
                  const isSel = m.id === selectedMuscleId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMuscleId(m.id)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                        isSel
                          ? 'border-white bg-white/20'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                        <span className="truncate">{m.commonName}</span>
                      </div>
                      <span className="font-mono text-[10px] text-espresso-300 ml-1 shrink-0">
                        {color.formattedText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Interaction Tip & Hover Pill */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-espresso-400 bg-espresso-950/70 px-3 py-1.5 rounded-xl border border-espresso-800">
            <span id="anatomy-keyboard-help">Drag to rotate · Scroll over an area to zoom there · Click a muscle to inspect · Keyboard: + / − zoom, ← / → rotate</span>
            {hoveredMuscleId && (
              <span className="font-semibold text-terracotta-400">
                {DETAILED_MUSCLES.find((m) => m.id === hoveredMuscleId)?.name}
              </span>
            )}
          </div>
        </div>

        {/* Selected Muscle Details Drawer */}
        <div className="space-y-4">
          <MuscleDetailDrawer
            muscle={selectedMuscle}
            metric={selectedMuscleMetric}
            mode={activeMode}
            onClose={() => setSelectedMuscleId(null)}
            onSelectRelatedExercise={onSelectExercise}
          />

          {/* Searchable Muscle Selector for a11y & Quick Jump */}
          <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                  aria-label="Search trainable muscles"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any muscle (e.g. Left Pec, VMO, Triceps)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
              {filteredMuscles.map((m) => {
                const metric = metricsMap.get(m.id);
                const color = getMuscleHeatmapColor(metric, activeMode);
                const isSelected = m.id === selectedMuscleId;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMuscleId(m.id)}
                    aria-pressed={isSelected}
                    aria-label={`${m.name}${isSelected ? ', selected' : ''}`}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 font-semibold'
                        : 'hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                      <span className="truncate">{m.name}</span>
                    </div>
                    <span className="font-mono text-[10px] opacity-75 shrink-0 ml-2">
                      {color.formattedText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
