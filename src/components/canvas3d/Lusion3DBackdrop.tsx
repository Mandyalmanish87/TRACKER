import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Lusion3DBackdrop
 * Inspired by Lusion (lusion.co) and 0110 Studio (awwwards.com).
 * Renders an atmospheric, scroll-reactive 3D scene with an iridescent floating wireframe
 * torus knot sculpture and ambient luminous particulate constellation.
 *
 * Performance & Safeguards:
 * - Checks for WebGL support; returns null if WebGL is unavailable or in SSR/JSDOM.
 * - Pauses rendering when document is hidden (Page Visibility API).
 * - Smooth lerped scroll-sync rotation and cursor parallax.
 */
export const Lusion3DBackdrop: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Guard against SSR or JSDOM environments where WebGL is unsupported
    if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Verify canvas context creation works
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) return;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 24;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return; // WebGL context creation failed
    }

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x2b38ff, 3.5, 45); // Klein Blue
    pointLight1.position.set(12, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffe600, 3.0, 45); // Acid Yellow
    pointLight2.position.set(-12, -10, 8);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xff3b81, 2.5, 35); // Electric Pink
    pointLight3.position.set(0, 14, -6);
    scene.add(pointLight3);

    // --- 3D Sculpture: Torus Knot Geometry ---
    const sculptureGroup = new THREE.Group();
    scene.add(sculptureGroup);

    const torusGeo = new THREE.TorusKnotGeometry(4.8, 1.25, 128, 32, 2, 3);
    const torusMat = new THREE.MeshPhysicalMaterial({
      color: 0x111116,
      emissive: 0x090912,
      roughness: 0.22,
      metalness: 0.88,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
      wireframe: true,
      transparent: true,
      opacity: 0.38,
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    sculptureGroup.add(torusMesh);

    // Inner Glowing Core (Icosahedron)
    const innerGeo = new THREE.IcosahedronGeometry(2.5, 2);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x2b38ff,
      emissive: 0x1a26d9,
      roughness: 0.4,
      metalness: 0.5,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    sculptureGroup.add(innerMesh);

    // --- Ambient Particle Constellation ---
    const particleCount = 280;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 55;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 55;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 35;
      particleScales[i] = Math.random() * 0.8 + 0.3;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Scroll & Mouse Interaction Tracking ---
    let targetScroll = 0;
    let currentScroll = 0;

    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleScroll = () => {
      targetScroll = window.scrollY || document.documentElement.scrollTop;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      targetMouseX = (e.clientX - halfW) / halfW;
      targetMouseY = (e.clientY - halfH) / halfH;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationId: number;
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!isVisible || !renderer) return;

      const elapsedTime = clock.getElapsedTime();

      // Smooth interpolation (lerp)
      currentScroll += (targetScroll - currentScroll) * 0.05;
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      // Rotate sculpture based on time + scroll offset
      sculptureGroup.rotation.x = elapsedTime * 0.12 + currentScroll * 0.0015;
      sculptureGroup.rotation.y = elapsedTime * 0.16 + currentScroll * 0.0025;
      sculptureGroup.rotation.z = currentScroll * 0.0008;

      // Parallax shift position with mouse and scroll
      sculptureGroup.position.x = currentMouseX * 1.8 + Math.sin(elapsedTime * 0.4) * 0.6;
      sculptureGroup.position.y = -currentMouseY * 1.8 + Math.cos(elapsedTime * 0.3) * 0.6;

      // Slowly drift particles
      particles.rotation.y = elapsedTime * 0.02 + currentScroll * 0.0005;

      // Dynamic light orbits
      pointLight1.position.x = Math.sin(elapsedTime * 0.8) * 14;
      pointLight1.position.y = Math.cos(elapsedTime * 0.6) * 12;

      pointLight2.position.x = -Math.sin(elapsedTime * 0.7) * 14;
      pointLight2.position.y = -Math.cos(elapsedTime * 0.5) * 12;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationId);

      if (renderer) {
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }

      torusGeo.dispose();
      torusMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-700 opacity-30 dark:opacity-50"
    />
  );
};

