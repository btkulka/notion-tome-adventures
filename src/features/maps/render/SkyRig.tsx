/**
 * The sky behind the map and the light it throws (see sky.ts for the maths).
 *
 * The map camera is orthographic, so every pixel looks the same way and a real
 * skybox would paint one flat colour. Instead the backdrop is a painted sky:
 * screen height is height above the horizon (the horizon a third of the way up,
 * the void below it) and screen width is bearing around the camera's facing,
 * so turning the view pans the sky. The sun and moon are drawn where the light
 * really comes from, which is why the land is lit from their side.
 *
 * Time changes sweep rather than jump: when the DM passes eight hours, the sun
 * crosses the sky in a couple of seconds and the light follows it.
 *
 * The sun casts shadows when `shadows` is on (High quality), over just the
 * ground in view (so zoomed in, only the props on screen draw into the shadow
 * map, and the shadows are sharper), and the far side of the map fades a
 * little into the horizon's colour, so the land reads with depth. Shadows stay
 * switched on through the night and fade with the sun: switching them off and
 * on would recompile every material.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SkySettings, TerrainGrid, TilePoint, Weather } from '../types';
import { MINUTES_PER_DAY } from '../travel/travel';
import { groundHeight } from './geometry';
import { propUniforms } from './models';
import { celestial, resolveSky, skyState, type RGB, type SkyState, type Vec3 } from './sky';

/** Half the sky's height on screen, and the height above the horizon at mid-screen (radians). */
const SPAN = (52 * Math.PI) / 180;
const CENTRE = (18 * Math.PI) / 180;
/**
 * The middle of the ground the camera sees and a radius covering it, for the
 * sun's shadow camera: each screen corner traced to the ground, clamped to the map.
 */
function fitShadow(
  cam: THREE.Camera,
  terrain: TerrainGrid,
  scratch: { ray: THREE.Vector3; dir: THREE.Vector3 }
): { x: number; z: number; r: number } {
  cam.getWorldDirection(scratch.dir);
  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    scratch.ray.set(i % 2 ? 1 : -1, i < 2 ? 1 : -1, -1).unproject(cam);
    const t = scratch.dir.y < -0.01 ? -scratch.ray.y / scratch.dir.y : 0;
    pts.push([
      Math.min(terrain.width, Math.max(0, scratch.ray.x + scratch.dir.x * t)),
      Math.min(terrain.height, Math.max(0, scratch.ray.z + scratch.dir.z * t)),
    ]);
  }
  const x = pts.reduce((a, p) => a + p[0], 0) / 4;
  const z = pts.reduce((a, p) => a + p[1], 0) / 4;
  const r = Math.max(...pts.map((p) => Math.hypot(p[0] - x, p[1] - z)));
  return { x, z, r: Math.min(Math.max(terrain.width, terrain.height) * 0.75 + 2, r + 3) };
}

/** Shadow map size, in texels a side. */
const SHADOW_MAP = 4096;
/** How much of the horizon's colour the map's far edge takes at most. */
const HAZE_FAR = 0.32;

/** Disc radii as a fraction of the canvas height. */
const SUN_SIZE = 0.026;
const MOON_SIZE = 0.022;

const VERTEX = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uForward;
uniform vec3 uRight;
uniform float uAspect;
uniform float uSpan;
uniform float uCentre;
uniform vec2 uRes;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uGlow;
uniform float uGlowK;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec2 uSunNdc;
uniform vec2 uMoonNdc;
uniform float uSunPx;
uniform float uMoonPx;
uniform vec3 uSunColor;
uniform float uSunDisc;
uniform float uMoonDisc;
uniform float uPhase;
uniform float uStars;
uniform vec3 uPole;
uniform float uSidereal;
uniform float uClouds;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uTime;
uniform float uFlash;
varying vec2 vNdc;

const float PI = 3.14159265;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

vec3 dirAt(vec2 ndc) {
  float az = ndc.x * uSpan * uAspect;
  float el = uCentre + ndc.y * uSpan;
  return cos(el) * (cos(az) * uForward + sin(az) * uRight) + vec3(0.0, sin(el), 0.0);
}
vec2 ndcOf(vec3 d) {
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(dot(d, uRight), dot(d, uForward));
  return vec2(az / (uSpan * uAspect), (el - uCentre) / uSpan);
}
vec3 turn(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

// Stars are fixed on a sphere that turns about the pole through the night.
// One candidate per cell of a cube map keeps them evenly spread; each is a
// small four-point diamond, the brightest with a faint cross.
float stars(vec3 d, vec2 ndc) {
  vec3 s = turn(d, uPole, -uSidereal);
  vec3 a = abs(s);
  vec2 uv;
  float face;
  if (a.x >= a.y && a.x >= a.z) { uv = s.yz / a.x; face = s.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = s.xz / a.y; face = s.y > 0.0 ? 2.0 : 3.0; }
  else { uv = s.xy / a.z; face = s.z > 0.0 ? 4.0 : 5.0; }
  const float N = 30.0;
  vec2 cell = floor((uv * 0.5 + 0.5) * N);
  vec2 seed = cell + face * 113.0;
  float h = hash12(seed);
  if (h > 0.2) return 0.0;
  vec2 c = (cell + 0.2 + 0.6 * hash22(seed)) / N * 2.0 - 1.0;
  vec3 cs;
  if (face < 1.5) cs = vec3(face < 0.5 ? 1.0 : -1.0, c.x, c.y);
  else if (face < 3.5) cs = vec3(c.x, face < 2.5 ? 1.0 : -1.0, c.y);
  else cs = vec3(c.x, c.y, face < 4.5 ? 1.0 : -1.0);
  vec2 p = (ndcOf(turn(normalize(cs), uPole, uSidereal)) - ndc) * uRes * 0.5;
  float size = mix(0.9, 2.8, pow(hash12(seed + 7.0), 5.0));
  float dist = abs(p.x) + abs(p.y);
  float core = 1.0 - smoothstep(size * 0.55, size * 1.2, dist);
  float cross = size > 1.9 ? (1.0 - smoothstep(0.0, 0.7, min(abs(p.x), abs(p.y)))) * (1.0 - smoothstep(size, size * 3.4, dist)) * 0.55 : 0.0;
  float twinkle = 0.78 + 0.22 * sin(uTime * (1.1 + 2.2 * hash12(seed + 3.0)) + h * 40.0);
  return (core + cross) * mix(0.3, 1.0, hash12(seed + 11.0)) * twinkle;
}

void main() {
  vec2 ndc = vNdc;
  vec3 d = normalize(dirAt(ndc));
  float el = asin(clamp(d.y, -1.0, 1.0));

  // Sky above, the void below, a band of haze along the horizon.
  float up = clamp(el / radians(68.0), 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.6));
  float down = clamp(-el / radians(30.0), 0.0, 1.0);
  vec3 under = mix(mix(uHorizon, uBelow, 0.55), uBelow, pow(down, 0.5));
  col = el >= 0.0 ? col : under;
  col = mix(col, uHorizon, exp(-abs(el) / radians(1.8)) * 0.45);

  // Dawn and dusk pool on the horizon under the sun.
  float toward = max(dot(normalize(d.xz + 1e-5), normalize(uSun.xz + 1e-5)), 0.0);
  col = mix(col, uGlow, uGlowK * pow(toward, 3.0) * exp(-abs(el) / radians(16.0)));
  float above = smoothstep(-radians(0.4), radians(0.6), el);

  // Branches below skip whole effects when they can't show: stars by day, cloud light where there's no cloud.
  if (uStars > 0.003 && above > 0.0) col += vec3(0.9, 0.88, 0.8) * stars(d, ndc) * uStars * above;

  // The sun: air glowing round it, then a hard disc.
  float cosA = max(dot(d, uSun), 0.0);
  float sunUp = smoothstep(-0.06, 0.02, uSun.y);
  col += uSunColor * (pow(cosA, 40.0) * 0.2 + pow(cosA, 420.0) * 0.32) * uSunDisc * sunUp * mix(0.4, 1.0, above);
  float sr = length((ndc - uSunNdc) * uRes * 0.5) / uSunPx;
  float sunDisc = 1.0 - smoothstep(1.0 - 1.5 / uSunPx, 1.0, sr);
  col = mix(col, uSunColor * 1.1 + 0.05, sunDisc * uSunDisc * above * sunUp);

  // The moon: lit on the side facing the sun, ashen on the other, faint seas.
  vec2 mp = (ndc - uMoonNdc) * uRes * 0.5 / uMoonPx;
  float mr = length(mp);
  float moonUp = smoothstep(-0.02, 0.02, uMoon.y);
  col += vec3(0.55, 0.6, 0.75) * pow(max(dot(d, uMoon), 0.0), 900.0) * 0.12 * uMoonDisc * moonUp * above * (1.0 - cos(uPhase * 2.0 * PI));
  if (mr < 1.0) {
    vec3 n = vec3(mp, sqrt(1.0 - mr * mr));
    vec2 toSun = normalize(uSunNdc - uMoonNdc + 1e-5);
    float th = uPhase * 2.0 * PI;
    vec3 L = normalize(vec3(toSun * abs(sin(th)), -cos(th)));
    float lit = smoothstep(-0.05, 0.07, dot(n, L));
    float seas = smoothstep(0.45, 0.72, fbm(mp * 2.2 + 4.0));
    vec3 face = mix(vec3(0.74, 0.7, 0.6), vec3(0.5, 0.48, 0.44), seas * 0.6);
    vec3 moonCol = mix(col * 0.8 + face * 0.06, face, lit);
    float edge = 1.0 - smoothstep(1.0 - 1.5 / uMoonPx, 1.0, mr);
    col = mix(col, moonCol, edge * uMoonDisc * above * moonUp);
  }

  // Clouds: a flat deck seen from below, thinning toward the horizon, lit in bands.
  if (uClouds > 0.01 && el > 0.0) {
    vec2 p = d.xz / (d.y + 0.12) * 0.55 + vec2(uTime * 0.006, uTime * 0.0025);
    float n = fbm(p);
    float c = smoothstep(1.0 - uClouds - 0.1, 1.0 - uClouds + 0.28, n) * smoothstep(0.0, 0.12, d.y);
    if (c > 0.004) {
      float n2 = fbm(p + normalize(uSun.xz + 1e-5) * 0.06);
      float litK = clamp(0.55 + (n - n2) * 6.0, 0.0, 1.0);
      litK = floor(litK * 3.0 + 0.5) / 3.0;
      col = mix(col, mix(uCloudShade, uCloudLit, litK), c * 0.88);
    }
  }

  col += uFlash * vec3(0.5, 0.53, 0.66) * (0.35 + 0.65 * up);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const color = (c: RGB, out = new THREE.Color()) => out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

function mixState(a: SkyState, b: SkyState, t: number): SkyState {
  if (t >= 1) return b;
  if (t <= 0) return a;
  const m = (x: number, y: number) => x + (y - x) * t;
  const v = <T extends number[]>(x: T, y: T) => x.map((n, i) => m(n, y[i])) as T;
  return {
    ...b,
    light: { dir: v(a.light.dir, b.light.dir), color: v(a.light.color, b.light.color), intensity: m(a.light.intensity, b.light.intensity) },
    hemi: { sky: v(a.hemi.sky, b.hemi.sky), ground: v(a.hemi.ground, b.hemi.ground), intensity: m(a.hemi.intensity, b.hemi.intensity) },
    zenith: v(a.zenith, b.zenith),
    horizon: v(a.horizon, b.horizon),
    below: v(a.below, b.below),
    glow: v(a.glow, b.glow),
    glowStrength: m(a.glowStrength, b.glowStrength),
    sunColor: v(a.sunColor, b.sunColor),
    sunDisc: m(a.sunDisc, b.sunDisc),
    moonDisc: m(a.moonDisc, b.moonDisc),
    stars: m(a.stars, b.stars),
    clouds: m(a.clouds, b.clouds),
    cloudLit: v(a.cloudLit, b.cloudLit),
    cloudShade: v(a.cloudShade, b.cloudShade),
  };
}

/** Where a direction lands on the painted sky, in clip space. Matches ndcOf in the shader. */
function ndcOf(d: Vec3, forward: THREE.Vector3, right: THREE.Vector3, aspect: number, out: THREE.Vector2) {
  const el = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const az = Math.atan2(d[0] * right.x + d[2] * right.z, d[0] * forward.x + d[2] * forward.z);
  return out.set(az / (SPAN * aspect), (el - CENTRE) / SPAN);
}

/**
 * The scene's lights and the painted sky. `minutes` null is the editor's fixed
 * daylight. The company's campfire comes up after dark at `party`.
 */
export function SkyRig({
  minutes,
  weather = 'clear',
  settings,
  terrain,
  party,
  shadows = false,
}: {
  minutes: number | null;
  weather?: Weather;
  settings?: Partial<SkySettings>;
  terrain: TerrainGrid;
  party?: TilePoint | null;
  /** Let the sun cast shadows (High quality). */
  shadows?: boolean;
}) {
  const sky = useMemo(() => resolveSky(settings), [settings]);
  const scene = useThree((state) => state.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const fire = useRef<THREE.PointLight>(null);

  const uniforms = useMemo(
    () => ({
      uForward: { value: new THREE.Vector3(-1, 0, -1).normalize() },
      uRight: { value: new THREE.Vector3(1, 0, -1).normalize() },
      uAspect: { value: 1 },
      uSpan: { value: SPAN },
      uCentre: { value: CENTRE },
      uRes: { value: new THREE.Vector2(1, 1) },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBelow: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uGlowK: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uMoon: { value: new THREE.Vector3(0, -1, 0) },
      uSunNdc: { value: new THREE.Vector2() },
      uMoonNdc: { value: new THREE.Vector2() },
      uSunPx: { value: 20 },
      uMoonPx: { value: 16 },
      uSunColor: { value: new THREE.Color() },
      uSunDisc: { value: 1 },
      uMoonDisc: { value: 1 },
      uPhase: { value: 0.5 },
      uStars: { value: 0 },
      uPole: { value: new THREE.Vector3(0, 1, 0) },
      uSidereal: { value: 0 },
      uClouds: { value: 0 },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    }),
    []
  );
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false, toneMapped: false }),
    [uniforms]
  );
  useEffect(() => () => material.dispose(), [material]);

  // The pole the stars turn about: square to the plane the sun and moon cross.
  useEffect(() => {
    const a = new THREE.Vector3(...celestial(0, sky));
    const b = new THREE.Vector3(...celestial(Math.PI / 2, sky));
    uniforms.uPole.value.crossVectors(a, b).normalize();
  }, [sky, uniforms]);

  const target = useRef({ minutes, weather, sky });
  target.current = { minutes, weather, sky };
  const anim = useRef({
    shown: minutes as number | null,
    weatherFrom: weather,
    weatherTo: weather,
    weatherT: 1,
    fire: 0,
    flash: 0,
    nextFlash: 4,
  });
  const cache = useRef<{ state: SkyState | null; minutes: number | null; weatherT: number; weather: Weather; sky: SkySettings | null }>({ state: null, minutes: null, weatherT: -1, weather, sky: null });
  const backdrop = useRef<THREE.Mesh>(null);
  const scratch = useMemo(() => ({ basisX: new THREE.Vector3(), basisY: new THREE.Vector3(), basisZ: new THREE.Vector3(), ray: new THREE.Vector3(), dir: new THREE.Vector3(), centre: new THREE.Vector3() }), []);

  // Haze: always present, so materials compile with it once rather than when it first thickens.
  const haze = useMemo(() => new THREE.Fog('#000000', 1e5, 1e5 + 1), []);
  useEffect(() => {
    scene.fog = haze;
    return () => {
      if (scene.fog === haze) scene.fog = null;
    };
  }, [scene, haze]);

  // The sun's shadow: its camera is fitted to the ground in view every frame (below).
  const span = Math.max(terrain.width, terrain.height);
  const shadowFit = useRef({ x: 0, z: 0, r: 0 });
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    scene.add(light.target);
    const cam = light.shadow.camera;
    cam.near = 0.5;
    cam.far = span * 3 + 40;
    shadowFit.current.r = 0;
    light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.03;
    light.shadow.map?.dispose();
    light.shadow.map = null;
    return () => {
      scene.remove(light.target);
    };
  }, [scene, span]);

  useFrame((state, delta) => {
    const a = anim.current;
    const goal = target.current;
    const dt = Math.min(delta, 0.1);

    // Sweep the clock toward the world's time. Whole days are skipped, so the
    // sun never spins through several days; only the last part sweeps.
    if (goal.minutes === null || a.shown === null) a.shown = goal.minutes;
    else {
      let gap = goal.minutes - a.shown;
      if (Math.abs(gap) > MINUTES_PER_DAY) {
        a.shown = goal.minutes - Math.sign(gap) * (Math.abs(gap) % MINUTES_PER_DAY);
        gap = goal.minutes - a.shown;
      }
      if (Math.abs(gap) < 0.05) a.shown = goal.minutes;
      else {
        const eased = gap * (1 - Math.exp(-dt * 2.4));
        const floor = Math.sign(gap) * Math.min(Math.abs(gap), dt * 120);
        a.shown += Math.abs(eased) > Math.abs(floor) ? eased : floor;
      }
    }
    if (goal.weather !== a.weatherTo) {
      a.weatherFrom = a.weatherTo;
      a.weatherTo = goal.weather;
      a.weatherT = 0;
    }
    a.weatherT = Math.min(1, a.weatherT + dt / 1.6);
    // Only recompute the sky while the clock or weather is actually moving.
    const c = cache.current;
    if (!c.state || c.minutes !== a.shown || c.weatherT !== a.weatherT || c.weather !== a.weatherTo || c.sky !== goal.sky) {
      c.state = a.weatherT >= 1
        ? skyState(a.shown, goal.sky, a.weatherTo)
        : mixState(skyState(a.shown, goal.sky, a.weatherFrom), skyState(a.shown, goal.sky, a.weatherTo), a.weatherT * a.weatherT * (3 - 2 * a.weatherT));
      c.minutes = a.shown;
      c.weatherT = a.weatherT;
      c.weather = a.weatherTo;
      c.sky = goal.sky;
    }
    const s = c.state;

    // Lightning: now and then a double flicker in a storm.
    const time = state.clock.elapsedTime;
    if (s.storm && time > a.nextFlash) {
      a.flash = 1;
      a.nextFlash = time + 5 + Math.random() * 9;
    }
    a.flash = Math.max(0, a.flash - dt * 3.2);
    const flicker = a.flash > 0 ? a.flash * (0.6 + 0.4 * Math.sin(a.flash * 40)) : 0;

    if (hemi.current) {
      color(s.hemi.sky, hemi.current.color);
      color(s.hemi.ground, hemi.current.groundColor);
      hemi.current.intensity = s.hemi.intensity + flicker * 0.9;
    }
    if (sun.current) {
      color(s.light.color, sun.current.color);
      sun.current.intensity = s.light.intensity;
      // Aimed at the middle of the ground in view, its shadow just covering it (with a margin for tall props).
      const fit = fitShadow(state.camera, terrain, scratch);
      const f = shadowFit.current;
      if (Math.abs(fit.r - f.r) > f.r * 0.08 || Math.hypot(fit.x - f.x, fit.z - f.z) > f.r * 0.15) {
        f.x = fit.x;
        f.z = fit.z;
        f.r = fit.r;
        const cam = sun.current.shadow.camera;
        cam.left = cam.bottom = -f.r;
        cam.right = cam.top = f.r;
        cam.updateProjectionMatrix();
      }
      const reach = span * 1.5 + 20;
      sun.current.position.set(f.x + s.light.dir[0] * reach, s.light.dir[1] * reach, f.z + s.light.dir[2] * reach);
      sun.current.target.position.set(f.x, 0, f.z);
      sun.current.target.updateMatrixWorld();
      sun.current.castShadow = shadows;
    }

    // Haze: the map's far side takes up to HAZE_FAR of the horizon's colour (more in fog).
    {
      const cam = state.camera;
      cam.getWorldDirection(scratch.dir);
      scratch.centre.set(terrain.width / 2, 0, terrain.height / 2).sub(cam.position);
      const middle = scratch.centre.dot(scratch.dir);
      const extent = span * 0.75 * Math.hypot(scratch.dir.x, scratch.dir.z) + 1;
      const far = a.weatherTo === 'fog' ? 0.75 : HAZE_FAR;
      color(s.horizon, haze.color);
      // three's haze is smoothstep(near, far, depth): place far so the map's far edge lands at about `far`.
      haze.near = middle - extent * 0.3;
      haze.far = haze.near + (extent * 1.3) / Math.max(0.2, Math.sqrt(far) * 0.65);
    }
    a.fire += ((s.night && party ? 2.2 : 0) - a.fire) * (1 - Math.exp(-dt * 2));
    // Windows light up as the sun goes down (fully by six degrees below), and a little under heavy cloud.
    const sunDeg = (s.sunHeight * 180) / Math.PI;
    const dusk = Math.min(1, Math.max(0, (4 - sunDeg) / 10));
    const glow = Math.max(dusk * dusk * (3 - 2 * dusk), s.clouds > 0.85 ? 0.25 : 0);
    propUniforms.uNightGlow.value += (glow - propUniforms.uNightGlow.value) * (1 - Math.exp(-dt * 1.5));
    if (fire.current) {
      fire.current.intensity = a.fire;
      if (party) fire.current.position.set(party[0] + 0.5, groundHeight(terrain, party[0] + 0.5, party[1] + 0.5) + 0.9, party[1] + 0.5);
    }

    if (!goal.sky.show || !backdrop.current) return;
    const cam = state.camera;
    // Zoomed in, the land covers every pixel: skip the full-screen sky shader
    // rather than paint it and paint over it. Each screen corner is traced to
    // the ground plane; all four on the map (with a tile of slack for hills) hides it.
    cam.getWorldDirection(scratch.dir);
    let covered = scratch.dir.y < -0.01;
    for (let i = 0; covered && i < 4; i++) {
      scratch.ray.set(i % 2 ? 1 : -1, i < 2 ? 1 : -1, -1).unproject(cam);
      const t = -scratch.ray.y / scratch.dir.y;
      const x = scratch.ray.x + scratch.dir.x * t;
      const z = scratch.ray.z + scratch.dir.z * t;
      covered = x > 1 && z > 1 && x < terrain.width - 1 && z < terrain.height - 1;
    }
    backdrop.current.visible = !covered;
    if (covered) return;

    const u = uniforms;
    cam.matrixWorld.extractBasis(scratch.basisX, scratch.basisY, scratch.basisZ);
    u.uRight.value.set(scratch.basisX.x, 0, scratch.basisX.z).normalize();
    u.uForward.value.set(-scratch.basisZ.x, 0, -scratch.basisZ.z).normalize();
    const aspect = state.size.width / Math.max(1, state.size.height);
    const dpr = state.viewport.dpr;
    u.uAspect.value = aspect;
    u.uRes.value.set(state.size.width * dpr, state.size.height * dpr);
    u.uSunPx.value = state.size.height * dpr * SUN_SIZE;
    u.uMoonPx.value = state.size.height * dpr * MOON_SIZE;
    color(s.zenith, u.uZenith.value);
    color(s.horizon, u.uHorizon.value);
    color(s.below, u.uBelow.value);
    color(s.glow, u.uGlow.value);
    u.uGlowK.value = s.glowStrength;
    u.uSun.value.set(...s.sun);
    u.uMoon.value.set(...s.moon);
    ndcOf(s.sun, u.uForward.value, u.uRight.value, aspect, u.uSunNdc.value);
    ndcOf(s.moon, u.uForward.value, u.uRight.value, aspect, u.uMoonNdc.value);
    color(s.sunColor, u.uSunColor.value);
    u.uSunDisc.value = s.sunDisc;
    u.uMoonDisc.value = s.moonDisc;
    u.uPhase.value = s.moonPhase;
    u.uStars.value = s.stars;
    u.uSidereal.value = a.shown === null ? 0 : ((a.shown % MINUTES_PER_DAY) / MINUTES_PER_DAY) * Math.PI * 2 + (a.shown / MINUTES_PER_DAY / 365) * Math.PI * 2;
    u.uClouds.value = s.clouds;
    color(s.cloudLit, u.uCloudLit.value);
    color(s.cloudShade, u.uCloudShade.value);
    u.uTime.value = time;
    u.uFlash.value = flicker * 0.5;
  });

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
      {/* Always mounted, dark by day: adding a light at dusk would recompile every material. */}
      <pointLight ref={fire} color="#F2B45A" intensity={0} distance={5} decay={1.5} />
      {sky.show && (
        <mesh ref={backdrop} material={material} renderOrder={-1000} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      )}
    </>
  );
}
