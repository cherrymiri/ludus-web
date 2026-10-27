import * as THREE from 'three';

const DIST = 1.8;
const LOOK_Y = 0.42;

// Renderer, camera, studio environment (for chrome reflections) and soft lights.
export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  camera.position.set(0, 0.55, DIST);
  camera.lookAt(0, LOOK_Y, 0);

  // ── studio environment: black room with soft light strips (like the Blender cards)
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const strip = (w, h, intensity, pos, look, color = 0xffffff) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(...look);
    envScene.add(m);
  };
  strip(0.5, 3.2, 3.2, [-2.2, 1.0, 0.6], [0, 0.4, 0]); // tall left softbox
  strip(0.4, 3.2, 2.4, [2.2, 1.0, 0.2], [0, 0.4, 0]); // tall right strip
  strip(3.0, 0.5, 2.6, [0, 3.0, 1.2], [0, 0, 0]); // overhead
  strip(2.6, 0.25, 1.2, [0, 1.2, -2.6], [0, 0.4, 0], 0xcfe9ff); // back line
  strip(1.4, 1.0, 0.55, [-1.2, 0.8, 2.4], [0, 0.4, 0]); // key reflection
  strip(4.5, 2.5, 0.06, [0, 1.0, 3.0], [0, 0.6, 0], 0xdde8ff); // dim front fill (mid-tones in chrome)
  strip(4.5, 2.5, 0.05, [0, 1.0, -3.2], [0, 0.6, 0], 0xdde8ff);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = envTex;

  // ── direct lights (kept soft; most of the look comes from the environment)
  const key = new THREE.DirectionalLight(0xfff6ee, 1.6);
  key.position.set(-1.2, 2.0, 1.6);
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0x8fd8ff, 1.1);
  rimL.position.set(-1.2, 0.4, -1.4);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x7ff2e8, 0.9);
  rimR.position.set(1.3, 0.3, -1.2);
  scene.add(rimR);
  scene.add(new THREE.AmbientLight(0x223040, 0.25));

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole playfield (≈1.3 m wide) visible on narrow windows
    const minHalfWidth = 0.68;
    const neededFov = 2 * Math.atan(minHalfWidth / camera.aspect / DIST);
    camera.fov = THREE.MathUtils.radToDeg(Math.max(THREE.MathUtils.degToRad(30), neededFov));
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, resize, envTex };
}

// Soft teal glow on the (invisible) floor under the ball — grounding without a visible floor.
export function createFloorGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(120,230,255,0.9)');
  grd.addColorStop(0.35, 'rgba(40,150,230,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0005;
  m.renderOrder = -1;
  return m;
}
