import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import { mulberry32 } from '../gen/prng';
import type { TerrainGrid, Weather as WeatherKind } from '../types';
import { mistFade, mistMaterial, MIST_HEIGHTS, WEATHER_CLOUDS, weatherUniforms, type MistUniforms } from './clouds';

/**
 * The cloud models (Meshy, from concept art Ben picked on 2026-11-22; public/models/clouds,
 * remade as docs/CLOUDS.md says). The plaques (1, 2 and the wisp) lie face up so they read as
 * storybook clouds from above; the tower and the long bank are full 3D and ride upright.
 */
const CLOUD_MODELS = [
  { url: '/models/clouds/cloud-1-textured.glb', flat: true, width: 16 },
  { url: '/models/clouds/cloud-2-textured.glb', flat: true, width: 11 },
  { url: '/models/clouds/cloud-4-textured.glb', flat: false, width: 9 },
  { url: '/models/clouds/cloud-3-textured.glb', flat: false, width: 18 },
  { url: '/models/clouds/cloud-5-textured.glb', flat: true, width: 12 },
];

/**
 * Off for now: Ben, 2026-11-22, on seeing them over the map: "this looks terrible lmao. let's flip it off for now
 * and make a note to work with it later. the generated fog looks good though". The mist and cloud shadows stay.
 * See docs/CLOUDS.md (Later) before turning them back on.
 */
const SHOW_CLOUD_MODELS = false;

/** Which model each cloud in turn is: mostly the mid-size cloud and the puff, now and then a bank, a wisp or a tower. */
const CLOUD_MIX = [0, 1, 3, 0, 1, 4, 2];

/** Clouds over a 128 × 128 map in a full overcast; fewer when it's clearer, more on bigger maps. */
const CLOUDS_PER_16K_CELLS = 26;
/** How far (tiles) beyond the map's edge clouds drift before coming round again. */
const DRIFT_MARGIN = 14;
/** Tiles a second a cloud drifts per unit of wind. */
const DRIFT_SPEED = 0.35;

/**
 * The weather over the map (see clouds.ts): moves the wind's clock that cloud
 * shadows, mist and clouds drift by, eases cloud cover and mist toward the
 * table's weather, and draws the two mist layers and the cloud models, fading
 * them as the camera zooms in.
 */
export function Weather({ terrain, weather }: { terrain: TerrainGrid; weather?: WeatherKind | null }) {
  const { width: W, height: H } = terrain;
  const layers = useMemo(
    () =>
      MIST_HEIGHTS.map((height, n) => {
        const uniforms: MistUniforms = { uMist: { value: 0 }, uFade: { value: 1 }, uSize: { value: new THREE.Vector2(W, H) }, uLayer: { value: n } };
        return { height, uniforms, material: mistMaterial(uniforms) };
      }),
    [W, H]
  );
  useEffect(() => () => layers.forEach((l) => l.material.dispose()), [layers]);

  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const now = useRef({ ...WEATHER_CLOUDS[weather ?? 'clear'] });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    weatherUniforms.uCloudTime.value += dt;
    // Weather changes roll in over a few seconds.
    const goal = WEATHER_CLOUDS[weather ?? 'clear'];
    const k = 1 - Math.exp(-dt * 0.8);
    now.current.cover += (goal.cover - now.current.cover) * k;
    now.current.mist += (goal.mist - now.current.mist) * k;
    weatherUniforms.uCloudCover.value = now.current.cover;

    const cam = state.camera as THREE.OrthographicCamera;
    const fit = Math.min(state.size.width, state.size.height) / ((W + H) * 0.62);
    const fade = mistFade(cam.zoom / Math.max(1e-6, fit));
    layers.forEach((l, n) => {
      // The upper layer only forms when there's real weather.
      const mist = n === 0 ? now.current.mist : Math.max(0, now.current.mist - 0.3) / 0.7;
      l.uniforms.uMist.value = mist;
      l.uniforms.uFade.value = fade;
      const mesh = meshes.current[n];
      if (mesh) mesh.visible = fade > 0.01 && mist > 0.02;
    });
  });

  return (
    <group>
      {SHOW_CLOUD_MODELS && (
        <Suspense fallback={null}>
          <CloudModels terrain={terrain} />
        </Suspense>
      )}
      {layers.map((l, n) => (
        <mesh
          key={n}
          ref={(m) => (meshes.current[n] = m)}
          position={[W / 2, l.height, H / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={l.material}
          renderOrder={10 + n}
          raycast={() => null}
        >
          <planeGeometry args={[W, H]} />
        </mesh>
      ))}
    </group>
  );
}

/** Where each cloud starts, how big it is and how fast it drifts: the same for every client, per map size. */
function cloudPlan(width: number, height: number) {
  const rand = mulberry32(width * 7919 + height);
  const count = Math.round((CLOUDS_PER_16K_CELLS * width * height) / 16384);
  return Array.from({ length: count }, (_, n) => ({
    model: CLOUD_MIX[n % CLOUD_MIX.length],
    x: rand() * (width + DRIFT_MARGIN * 2) - DRIFT_MARGIN,
    z: rand() * (height + DRIFT_MARGIN * 2) - DRIFT_MARGIN,
    size: 0.75 + rand() * 0.6,
    turn: rand() * Math.PI * 2,
    speed: 0.8 + rand() * 0.4,
    lift: rand(),
    // Lower ranks show first as the cloud cover grows.
    rank: rand(),
  }));
}

/** The cloud models, drifting with the wind; as many show as the cloud cover calls for. */
function CloudModels({ terrain }: { terrain: TerrainGrid }) {
  const { width: W, height: H } = terrain;
  const gltfs = useGLTF(CLOUD_MODELS.map((m) => m.url));
  // Each model as a Lambert mesh (lit by the sun and sky like the land, fading by opacity), centred, sized in tiles.
  const kinds = useMemo(
    () =>
      gltfs.map((g, n) => {
        let src: THREE.Mesh | null = null;
        g.scene.traverse((o) => {
          if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
        });
        const mesh = src as unknown as THREE.Mesh;
        const geometry = mesh.geometry.clone();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const centre = box.getCenter(new THREE.Vector3());
        geometry.translate(-centre.x, -centre.y, -centre.z);
        const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 1e-6);
        const map = (mesh.material as THREE.MeshStandardMaterial).map;
        return { geometry, map, scale: CLOUD_MODELS[n].width / span, flat: CLOUD_MODELS[n].flat };
      }),
    [gltfs]
  );
  const plan = useMemo(() => cloudPlan(W, H), [W, H]);
  const clouds = useMemo(
    () =>
      plan.map((c) => {
        const kind = kinds[c.model];
        const material = new THREE.MeshLambertMaterial({ map: kind.map, transparent: true, opacity: 0, emissive: new THREE.Color('#25303C') });
        const mesh = new THREE.Mesh(kind.geometry, material);
        mesh.scale.setScalar(kind.scale * c.size);
        mesh.rotation.set(kind.flat ? -Math.PI / 2 : 0, 0, 0);
        mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), c.turn);
        mesh.castShadow = true;
        mesh.raycast = () => {};
        mesh.visible = false;
        return { plan: c, mesh, material };
      }),
    [plan, kinds]
  );
  useEffect(() => () => clouds.forEach((c) => c.material.dispose()), [clouds]);
  useEffect(() => () => kinds.forEach((k) => k.geometry.dispose()), [kinds]);

  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    clouds.forEach((c) => g.add(c.mesh));
    return () => clouds.forEach((c) => g.remove(c.mesh));
  }, [clouds]);

  useFrame((state) => {
    const t = weatherUniforms.uCloudTime.value;
    const wind = weatherUniforms.uWind.value;
    const cover = weatherUniforms.uCloudCover.value;
    const cam = state.camera as THREE.OrthographicCamera;
    const fit = Math.min(state.size.width, state.size.height) / ((W + H) * 0.62);
    const zoomFade = mistFade(cam.zoom / Math.max(1e-6, fit));
    const spanX = W + DRIFT_MARGIN * 2;
    const spanZ = H + DRIFT_MARGIN * 2;
    const base = (MAX_STEP + 2.5) * STEP_HEIGHT;
    for (const c of clouds) {
      const p = c.plan;
      const wrap = (v: number, span: number) => ((((v + DRIFT_MARGIN) % span) + span) % span) - DRIFT_MARGIN;
      const x = wrap(p.x + wind.x * t * DRIFT_SPEED * p.speed, spanX);
      const z = wrap(p.z + wind.y * t * DRIFT_SPEED * p.speed, spanZ);
      // Faded out by the map's edge (they don't hang over the void), and only as many as the cover calls for.
      const edge = Math.min(x, z, W - x, H - z);
      const edgeFade = Math.min(1, Math.max(0, (edge + 1) / 8));
      const coverFade = Math.min(1, Math.max(0, (cover * 1.05 - p.rank) * 8));
      const opacity = edgeFade * coverFade * zoomFade;
      c.mesh.visible = opacity > 0.01;
      if (!c.mesh.visible) continue;
      c.material.opacity = opacity;
      c.mesh.position.set(x, base + p.lift * 1.6 * STEP_HEIGHT * 4, z);
    }
  });

  return <group ref={group} />;
}

if (SHOW_CLOUD_MODELS && typeof window !== 'undefined') CLOUD_MODELS.forEach((m) => useGLTF.preload(m.url));
