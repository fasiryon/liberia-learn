// RX-005 A10/A7: environment rigs for the three.js renderer. Private to ThreeScene (imports `three`).
// Everything is procedural (0 bytes on disk) and deterministic; no textures are downloaded.
import * as THREE from "three";

export const DAYLIGHT_SKY = { zenith: "#78a9d6", horizon: "#e7eef1", ground: "#b9c9b2" } as const;

const skyVertex = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFragment = `uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 colour = h > 0.0 ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, h), 0.8)) : mix(uHorizon, uGround, smoothstep(0.0, 0.25, -h));
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

function skyDome(radius: number): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {
    uZenith: { value: new THREE.Color(DAYLIGHT_SKY.zenith) }, uHorizon: { value: new THREE.Color(DAYLIGHT_SKY.horizon) }, uGround: { value: new THREE.Color(DAYLIGHT_SKY.ground) },
  } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.name = "environment-sky"; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

export type EnvironmentRig = { shadows: boolean; dispose: () => void };

/**
 * DAYLIGHT on HIGH: sky dome, image-based lighting prefiltered from that same sky (PMREM), PBR Neutral tone
 * mapping, light haze and one sun shadow map that is redrawn only when shadow casters move (A7).
 * DAYLIGHT on STANDARD: sky dome and haze only. STUDIO keeps the existing plain backdrop.
 */
export function applyEnvironmentRig(renderer: THREE.WebGLRenderer, scene: THREE.Scene, sun: THREE.DirectionalLight, options: { daylight: boolean; profile: "HIGH" | "STANDARD"; finePointer: boolean }): EnvironmentRig {
  if (!options.daylight) return { shadows: false, dispose: () => {} };
  const sky = skyDome(140);
  scene.add(sky);
  scene.background = null;
  scene.fog = new THREE.Fog(DAYLIGHT_SKY.horizon, 34, 150);
  let environment: THREE.WebGLRenderTarget | null = null;
  const high = options.profile === "HIGH";
  if (high) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = skyDome(10);
    envScene.add(envSky);
    environment = pmrem.fromScene(envScene, 0.02);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.55;
    envSky.geometry.dispose(); envSky.material.dispose(); pmrem.dispose();
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    sun.castShadow = true;
    const size = options.finePointer ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    renderer.shadowMap.needsUpdate = true;
  }
  return {
    shadows: high,
    dispose: () => {
      sky.removeFromParent(); sky.geometry.dispose(); sky.material.dispose();
      if (environment) { scene.environment = null; environment.dispose(); }
      scene.fog = null;
      sun.shadow.map?.dispose();
    },
  };
}
