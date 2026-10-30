import * as THREE from 'three';
import { ORB } from './config.js';

// Real-time versions of the Blender materials. Mesh shapes are untouched;
// only the shading is adapted so it reads well in WebGL on black.

export function applyClawMaterials(root) {
  const chrome = new THREE.MeshPhysicalMaterial({
    name: 'LUDUS_Chrome',
    color: new THREE.Color(0.93, 0.935, 0.95),
    metalness: 1,
    roughness: 0.07,
    clearcoat: 0.15,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.35,
  });
  const wire = chrome.clone();
  wire.name = 'LUDUS_Chrome_Wire';
  wire.roughness = 0.16;
  wire.color = new THREE.Color(0.86, 0.87, 0.89);
  const tip = new THREE.MeshPhysicalMaterial({
    name: 'LUDUS_Tip_Satin',
    color: new THREE.Color(0.5, 0.51, 0.5),
    roughness: 0.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.9,
  });
  const lens = new THREE.MeshStandardMaterial({
    name: 'LUDUS_Hub_Lens',
    color: new THREE.Color(0.05, 0.25, 0.3),
    emissive: new THREE.Color(0.35, 0.95, 1.0),
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const byName = { LUDUS_Chrome: chrome, LUDUS_Chrome_Wire: wire, LUDUS_Tip_Satin: tip, LUDUS_Hub_Lens: lens };
  root.traverse((o) => {
    if (o.isMesh && byName[o.material?.name]) o.material = byName[o.material.name];
  });
}

// Glossy skin: reflections + highlights only (additive), so the gel underneath stays clear.
export function createOrbSkin() {
  return new THREE.MeshPhysicalMaterial({
    name: 'LUDUS_Gel_Orb_Skin',
    color: 0x000000,
    metalness: 0,
    roughness: 0.04,
    ior: 1.42,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.7,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// Gel body: short ray-march through the ball's volume in object space.
// Path length → density → colour, so the centre reads dense and layered,
// while the silhouette stays clear (the black background shows through).
export function createOrbBody(R, Ry) {
  return new THREE.ShaderMaterial({
    name: 'LUDUS_Gel_Orb',
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: true,
    uniforms: {
      uRot: { value: new THREE.Matrix3() },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uR: { value: R },
      uRy: { value: Ry },
      uDeep: { value: new THREE.Color('#0a35a6') },
      uAqua: { value: new THREE.Color('#2fc6f2') },
      uMint: { value: new THREE.Color('#c4fff4') },
      uIce: { value: new THREE.Color('#bff4ff') },
      uDensity: { value: ORB.density },
      uClear: { value: ORB.clearCore },
      uRim: { value: ORB.rimGlow },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vCam;
      varying vec3 vN;
      void main() {
        vPos = position;
        vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform mat3 uRot;
      uniform float uTime, uGlow, uR, uRy, uDensity, uClear, uRim;
      uniform vec3 uDeep, uAqua, uMint, uIce;
      varying vec3 vPos;
      varying vec3 vCam;
      varying vec3 vN;

      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.07 + 3.1; a *= 0.5; } return s / 0.875; }

      float exitT(vec3 ro, vec3 rd) {
        vec3 s = vec3(1.0, uR / uRy, 1.0);
        vec3 o = ro * s; vec3 d = rd * s;
        float a = dot(d, d), b = dot(o, d), c = dot(o, o) - uR * uR;
        float h = b * b - a * c;
        if (h < 0.0) return 0.0;
        return (-b + sqrt(h)) / a;
      }

      void main() {
        vec3 rd = normalize(vPos - vCam);
        vec3 ro = vPos;
        float tEx = clamp(exitT(ro, rd), 0.0, 2.1 * uR);
        float facing = abs(dot(normalize(vN), -rd));
        const int N = 14;
        float dt = tEx / float(N);
        vec3 col = vec3(0.0);
        float A = 0.0;
        for (int i = 0; i < N; i++) {
          float t = (float(i) + 0.5) * dt;
          vec3 p = ro + rd * t;
          vec3 q = uRot * p;
          float r = clamp(length(p * vec3(1.0, uR / uRy, 1.0)) / uR, 0.0, 1.0);
          float layers = fbm(q * 15.0 + vec3(0.0, uTime * 0.05, 0.0));
          float pockets = fbm(q * 7.0 + 4.1);
          float wisp = smoothstep(0.55, 0.8, layers);
          float dens = (2.2 + 9.0 * smoothstep(0.35, 0.8, pockets) + 30.0 * wisp) * uDensity;
          // thick jelly skin, clearer heart: the claw and background show through the middle
          float skin = 0.16 + 1.5 * smoothstep(0.5, 0.98, r);
          dens *= mix(1.0, skin, uClear);
          vec3 c = mix(uDeep, uAqua, 0.15 + 0.85 * smoothstep(0.45, 1.0, r) * (0.55 + 0.45 * pockets));
          c = mix(c, uMint, wisp * 0.8);
          float lit = 0.5 + 0.75 * clamp(-p.y / uRy * 0.5 + 0.5, 0.0, 1.0) * 0.6 + 0.4 * clamp(p.y / uRy * 0.5 + 0.5, 0.0, 1.0);
          c *= lit;
          float a = 1.0 - exp(-dens * dt);
          col += (1.0 - A) * a * c;
          A += (1.0 - A) * a;
        }
        float rim = pow(1.0 - facing, 2.2);
        col += mix(uAqua, uIce, 0.6) * rim * uRim * 0.75;
        A = clamp(A + rim * uRim * 0.55, 0.0, 1.0);
        col += uMint * uGlow * (0.06 + 0.22 * pow(1.0 - facing, 1.5));
        gl_FragColor = vec4(col, A);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
