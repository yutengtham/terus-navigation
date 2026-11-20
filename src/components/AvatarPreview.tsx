import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Props = {
  /** A .glb as bytes, or a URL (the classic car file). null = nothing to show yet. */
  model: ArrayBuffer | string | null;
  label: string;
};

/**
 * Live 3D preview of the avatar (three.js, loaded only on the Avatar screen).
 * Drag to turn; it turns slowly by itself until touched.
 */
export function AvatarPreview({ model, label }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ scene: THREE.Scene; current: THREE.Object3D | null; render: () => void } | null>(null);

  // One renderer for the life of the screen.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    camera.position.set(7.5, 4.5, 7.5);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 10, 6);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.MeshBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.25 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.set(0, 1.2, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = 1.45;
    controls.addEventListener('start', () => (controls.autoRotate = false));
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    let raf = 0;
    const render = () => renderer.render(scene, camera);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      render();
    };
    loop();
    stateRef.current = { scene, current: null, render };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // Swap the model when it changes.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !model) return;
    let alive = true;
    const loader = new GLTFLoader();
    const onLoad = (gltf: { scene: THREE.Object3D }) => {
      if (!alive || !stateRef.current) return;
      if (st.current) st.scene.remove(st.current);
      // Fit any model to the stage (uploads are already car-sized; this is just for the preview).
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const k = 4.6 / Math.max(size.x, size.z, 0.001);
      gltf.scene.scale.multiplyScalar(k);
      const box2 = new THREE.Box3().setFromObject(gltf.scene);
      const c = box2.getCenter(new THREE.Vector3());
      gltf.scene.position.set(-c.x, -box2.min.y, -c.z);
      st.scene.add(gltf.scene);
      st.current = gltf.scene;
    };
    if (typeof model === 'string') loader.load(model, onLoad, undefined, () => {});
    else loader.parse(model.slice(0), '', onLoad, () => {});
    return () => {
      alive = false;
    };
  }, [model]);

  return <div ref={hostRef} className="nn-avatar-preview" role="img" aria-label={label} />;
}
