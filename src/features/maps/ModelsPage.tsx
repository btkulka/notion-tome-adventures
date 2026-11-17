/**
 * The models library: every world-map prop (render/catalog.ts MODEL_NAMES) to
 * browse and inspect. The browser filters by family, by name, by "has a
 * miniature" and by "needs fixing", with thumbnails drawn from the Medium GLB
 * at the map's own camera angle. The inspector turns one model in 3D at any
 * version (Low, Medium, the far-zoom Far, the hi-def Mini), side by side with
 * its miniature, with a tile for scale, the map angle, a turntable, wireframe,
 * night, its numbers, its concept art and its line in docs/MINI_FIXES.md.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Loading } from '@/components/ui/tome-loading';
import fixesMd from '../../../docs/MINI_FIXES.md?raw';
import { farName, MODEL_NAMES, type ModelName } from './render/catalog';
import { fitMini, MINIS, propMaterial, propMaterialFar, propUniforms, useMiniScene, useTierGeometry } from './render/models';
import { skyState } from './render/sky';

type Family = 'settlements' | 'landmarks' | 'trees' | 'ground';
type Filter = 'all' | Family;
type Version = 'mini' | 'medium' | 'low' | 'far';
type Tiers = ReturnType<typeof useTierGeometry>;

const FAMILIES: Family[] = ['settlements', 'landmarks', 'trees', 'ground'];
const FILTERS: Filter[] = ['all', ...FAMILIES];
const SETTLEMENT = ['village-', 'town-', 'city-', 'castle-'];
const TREES = ['fir-', 'elderfir-', 'snowfir-', 'pine-', 'oak-', 'elderoak-', 'jungle-', 'palm-', 'cypress-', 'snag-', 'thorn-'];
const GROUND = ['shrub-', 'scrub-', 'reeds-', 'fern-', 'boulder-', 'mossrock-', 'crag-', 'hoodoo-', 'searock-', 'icerock-'];

function familyOf(name: string): Family {
  if (SETTLEMENT.some((p) => name.startsWith(p))) return 'settlements';
  if (TREES.some((p) => name.startsWith(p))) return 'trees';
  if (GROUND.some((p) => name.startsWith(p))) return 'ground';
  return 'landmarks';
}

/** Complex first, as the miniatures were made: settlements, landmarks, trees, ground cover. */
const ORDERED: ModelName[] = FAMILIES.flatMap((f) => MODEL_NAMES.filter((n) => familyOf(n) === f));

const MINI_BY_NAME = new Map(MINIS.map((m) => [m.name, m]));

/** docs/MINI_FIXES.md's table rows: | prop | problem | fix to try |. */
const FIXES = new Map<string, { problem: string; fix: string }>();
for (const line of fixesMd.split(/\r?\n/)) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length >= 5 && (MODEL_NAMES as readonly string[]).includes(cells[1])) FIXES.set(cells[1], { problem: cells[2], fix: cells[3] });
}

/** The map camera looks down the (1, 1, 1) diagonal (MapView). */
const MAP_VIEW = new THREE.Vector3(1, 1, 1).normalize();
const THUMB = 160;

const triangles = (g: THREE.BufferGeometry | undefined) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());

function boxOf(g: THREE.BufferGeometry): THREE.Box3 {
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox!;
}

export default function ModelsPage() {
  return (
    <Suspense fallback={<div className="t-root min-h-svh grid place-items-center"><Loading label="Unpacking the models…" /></div>}>
      <Library />
    </Suspense>
  );
}

function Library() {
  const tiers = useTierGeometry();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [minisOnly, setMinisOnly] = useState(false);
  const [fixOnly, setFixOnly] = useState(false);
  const thumbs = useThumbnails(tiers.medium);

  const shown = useMemo(
    () =>
      ORDERED.filter(
        (n) =>
          (filter === 'all' || familyOf(n) === filter) &&
          (!query || n.includes(query.trim().toLowerCase())) &&
          (!minisOnly || MINI_BY_NAME.has(n)) &&
          (!fixOnly || FIXES.has(n))
      ),
    [filter, query, minisOnly, fixOnly]
  );
  const picked = (params.get('m') as ModelName | null) ?? shown[0] ?? ORDERED[0];
  const pick = useCallback((name: string) => setParams({ m: name }, { replace: true }), [setParams]);

  // Up and down walk the filtered list.
  const list = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const at = shown.indexOf(picked);
    const next = shown[Math.max(0, Math.min(shown.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) {
      pick(next);
      list.current?.querySelector(`[data-model="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="t-root min-h-svh flex flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 px-11 pt-7 pb-6 border-b border-rule">
        <div className="flex flex-col gap-2">
          <Link to="/maps" className="t-label hover:text-gilt-hi">Atlas</Link>
          <h1 className="t-h1">Models</h1>
        </div>
        <dl className="m-0 flex gap-8">
          <div className="t-stat"><dt>Props</dt><dd className="text-[20px]">{MODEL_NAMES.length}</dd></div>
          <div className="t-stat"><dt>Miniatures</dt><dd className="text-[20px]">{MINIS.length}</dd></div>
          <div className="t-stat"><dt>To fix</dt><dd className="text-[20px]">{FIXES.size}</dd></div>
        </dl>
      </header>

      <div className="flex flex-1 min-h-0 flex-wrap items-stretch">
        <aside aria-label="Model browser" className="flex-[1_1_320px] max-w-[380px] border-r border-rule bg-[rgba(18,17,19,0.75)] flex flex-col min-h-0" onKeyDown={onKey}>
          <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-rule">
            <input className="t-input" type="search" placeholder="Search models" aria-label="Search models" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div role="radiogroup" aria-label="Family" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`t-chip ${filter === f ? 't-chip--on' : ''}`}>{f}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className={`t-chip ${minisOnly ? 't-chip--on' : ''}`} aria-pressed={minisOnly} onClick={() => setMinisOnly((v) => !v)}>Miniatures</button>
              <button type="button" className={`t-chip ${fixOnly ? 't-chip--on' : ''}`} aria-pressed={fixOnly} onClick={() => setFixOnly((v) => !v)}>Needs fixing</button>
              <span className="t-small ml-auto self-center">{shown.length}</span>
            </div>
          </div>
          <div ref={list} role="listbox" aria-label="Models" tabIndex={0} className="flex-1 overflow-y-auto px-3 py-3 max-h-[calc(100svh-210px)]">
            {FAMILIES.map((fam) => {
              const items = shown.filter((n) => familyOf(n) === fam);
              if (!items.length) return null;
              return (
                <div key={fam} className="flex flex-col pb-3">
                  <span className="t-label px-2 pt-2 pb-2">{fam}</span>
                  {items.map((n) => {
                    const mini = MINI_BY_NAME.get(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        role="option"
                        aria-selected={n === picked}
                        data-model={n}
                        onClick={() => pick(n)}
                        className={`flex items-center gap-3 px-2 py-1.5 text-left border ${n === picked ? 'border-gilt-deep bg-ink-2 text-bone' : 'border-transparent text-bone-2 hover:bg-ink-2 hover:text-bone'}`}
                      >
                        <span className="w-12 h-12 shrink-0 bg-ink-0 border border-rule grid place-items-center overflow-hidden">
                          {thumbs[n] ? <img src={thumbs[n]} alt="" className="w-full h-full object-contain" /> : <i className="t-diamond t-diamond--hollow" />}
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="t-h3 text-[15px] truncate">{n}</span>
                          <span className="flex gap-1.5 pt-0.5">
                            {mini && <span className="t-small text-[11px] text-gilt">mini</span>}
                            {FIXES.has(n) && <span className="t-small text-[11px] text-blood-text">fix</span>}
                          </span>
                        </span>
                        {mini?.concept && <img src={mini.concept} alt="" className="w-12 h-12 shrink-0 object-cover border border-rule" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!shown.length && <p className="t-small px-2">Nothing matches.</p>}
          </div>
        </aside>

        <main className="flex-[999_1_560px] min-w-0 px-8 py-6 flex flex-col gap-5">
          <Inspector key={picked} name={picked} tiers={tiers} />
        </main>
      </div>
    </div>
  );
}

/** Thumbnails of every prop's Medium model at the map's angle, drawn a few per frame in one offscreen renderer. */
function useThumbnails(geometry: (name: string) => THREE.BufferGeometry | undefined): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(THUMB, THUMB, false);
    const scene = new THREE.Scene();
    addStudioLights(scene, false);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    const sphere = new THREE.Sphere();
    const out: Record<string, string> = {};
    const queue = [...ORDERED];
    let frame = 0;
    const step = () => {
      for (let k = 0; k < 6 && queue.length; k++) {
        const name = queue.shift()!;
        const geo = geometry(name);
        if (!geo) continue;
        boxOf(geo).getBoundingSphere(sphere);
        const r = sphere.radius * 0.92;
        Object.assign(camera, { left: -r, right: r, top: r, bottom: -r });
        camera.updateProjectionMatrix();
        camera.position.copy(sphere.center).addScaledVector(MAP_VIEW, 20);
        camera.lookAt(sphere.center);
        const mesh = new THREE.Mesh(geo, propMaterialFar);
        scene.add(mesh);
        renderer.render(scene, camera);
        out[name] = renderer.domElement.toDataURL('image/png');
        scene.remove(mesh);
      }
      setThumbs({ ...out });
      if (queue.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [geometry]);
  return thumbs;
}

const srgb = (c: [number, number, number]) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

/** The map's studio daylight (sky.ts skyState with no clock), or its midnight. */
function addStudioLights(scene: THREE.Object3D, night: boolean) {
  const s = skyState(night ? 0 : null, undefined);
  scene.add(new THREE.HemisphereLight(srgb(s.hemi.sky), srgb(s.hemi.ground), s.hemi.intensity));
  const sun = new THREE.DirectionalLight(srgb(s.light.color), s.light.intensity);
  sun.position.set(s.light.dir[0] * 20, s.light.dir[1] * 20, s.light.dir[2] * 20);
  scene.add(sun);
}

function StudioLights({ night }: { night: boolean }) {
  const s = useMemo(() => skyState(night ? 0 : null, undefined), [night]);
  return (
    <>
      <hemisphereLight args={[srgb(s.hemi.sky), srgb(s.hemi.ground), s.hemi.intensity]} />
      <directionalLight position={[s.light.dir[0] * 20, s.light.dir[1] * 20, s.light.dir[2] * 20]} color={srgb(s.light.color)} intensity={s.light.intensity} />
    </>
  );
}

const VERSIONS: Version[] = ['mini', 'medium', 'low', 'far'];
type View = 'map' | 'front' | 'side' | 'top';
const VIEWS: Record<View, THREE.Vector3> = {
  map: MAP_VIEW,
  front: new THREE.Vector3(0, 0.25, 1).normalize(),
  side: new THREE.Vector3(1, 0.25, 0).normalize(),
  top: new THREE.Vector3(0.001, 1, 0.001).normalize(),
};

function Inspector({ name, tiers }: { name: ModelName; tiers: Tiers }) {
  const mini = MINI_BY_NAME.get(name);
  const [version, setVersion] = useState<Version>(mini ? 'mini' : 'medium');
  const [compare, setCompare] = useState(false);
  const [wire, setWire] = useState(false);
  const [spin, setSpin] = useState(false);
  const [night, setNight] = useState(false);
  const [view, setView] = useState<{ v: View; n: number }>({ v: 'map', n: 0 });
  const fix = FIXES.get(name);

  const medium = tiers.medium(name);
  const size = medium ? boxOf(medium).getSize(new THREE.Vector3()) : null;
  const counts: [string, number | undefined][] = [
    ['Mini', mini?.triangles],
    ['Medium', triangles(medium)],
    ['Low', triangles(tiers.low(name))],
    ['Far', triangles(tiers.medium(farName(name)))],
  ];

  useEffect(() => {
    propUniforms.uNightGlow.value = night ? 1 : 0;
    return () => {
      propUniforms.uNightGlow.value = 0;
    };
  }, [night]);

  const versions = VERSIONS.filter((v) => v !== 'mini' || mini);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="t-label">{familyOf(name)}</span>
          <h2 className="t-h1 text-[30px]">{name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button key={v} type="button" className="t-btn t-btn--quiet" onClick={() => setView((p) => ({ v, n: p.n + 1 }))}>{v === 'map' ? 'Map angle' : v}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div role="radiogroup" aria-label="Version" className="t-seg" style={{ gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr))` }}>
            {versions.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={!compare && version === v} disabled={compare} onClick={() => setVersion(v)} className="px-4 text-[12px]">{v}</button>
            ))}
          </div>
          {compare && mini && <span className="t-small">Left: Medium · Right: Mini</span>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {mini && <button type="button" className={`t-chip ${compare ? 't-chip--on' : ''}`} aria-pressed={compare} onClick={() => setCompare((v) => !v)}>Compare</button>}
          <button type="button" className={`t-chip ${spin ? 't-chip--on' : ''}`} aria-pressed={spin} onClick={() => setSpin((v) => !v)}>Turntable</button>
          <button type="button" className={`t-chip ${wire ? 't-chip--on' : ''}`} aria-pressed={wire} onClick={() => setWire((v) => !v)}>Wireframe</button>
          <button type="button" className={`t-chip ${night ? 't-chip--on' : ''}`} aria-pressed={night} onClick={() => setNight((v) => !v)}>Night</button>
        </div>
      </div>

      <div className="t-frame relative bg-ink-0 h-[58vh] min-h-[380px]">
        <Canvas camera={{ position: [1.8, 1.8, 1.8], fov: 32, near: 0.01, far: 200 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <color attach="background" args={['#0A0A0B']} />
          <StudioLights night={night} />
          <Tile />
          <Suspense fallback={null}>
            <Turntable spin={spin}>
              {compare && mini ? (
                <>
                  <group position={[-0.62, 0, 0]}><Model name={name} version="medium" tiers={tiers} wire={wire} /></group>
                  <group position={[0.62, 0, 0]}><Model name={name} version="mini" tiers={tiers} wire={wire} /></group>
                </>
              ) : (
                <Model name={name} version={version} tiers={tiers} wire={wire} />
              )}
            </Turntable>
          </Suspense>
          <CameraPreset view={view} spread={compare && !!mini} />
          <OrbitControls makeDefault enableDamping target={[0, 0.3, 0]} minDistance={0.3} maxDistance={20} />
        </Canvas>

        <span className="absolute left-4 bottom-3 t-small text-[12px] pointer-events-none">Drag to turn · scroll to zoom · right-drag to pan · the gilt square is one map tile</span>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <section aria-label="Numbers" className="t-panel p-5 flex-[1_1_280px] flex flex-col gap-4">
          <span className="t-label">Triangles</span>
          <dl className="m-0 grid grid-cols-4 gap-3">
            {counts.map(([label, n]) => (
              <div key={label} className="t-stat"><dt>{label}</dt><dd className="t-num text-[18px]">{n ? fmt(n) : '—'}</dd></div>
            ))}
          </dl>
          {size && (
            <>
              <span className="t-label">Size in tiles</span>
              <dl className="m-0 grid grid-cols-3 gap-3">
                <div className="t-stat"><dt>Wide</dt><dd className="t-num text-[18px]">{size.x.toFixed(2)}</dd></div>
                <div className="t-stat"><dt>Deep</dt><dd className="t-num text-[18px]">{size.z.toFixed(2)}</dd></div>
                <div className="t-stat"><dt>Tall</dt><dd className="t-num text-[18px]">{size.y.toFixed(2)}</dd></div>
              </dl>
            </>
          )}
          <p className="t-small m-0">On the map: Graphics › Models › minis draws the miniatures up close; far zoom keeps the low-poly versions.</p>
        </section>

        {fix && (
          <section aria-label="Needs fixing" className="t-panel p-5 flex-[1_1_280px] flex flex-col gap-2 border-l-2" style={{ borderLeftColor: 'var(--blood)' }}>
            <span className="t-label" style={{ color: 'var(--blood-text)' }}>Needs fixing</span>
            <p className="t-body m-0 text-[15px]">{fix.problem}</p>
            <span className="t-label pt-2">Fix to try</span>
            <p className="t-small m-0">{fix.fix}</p>
          </section>
        )}

        {mini?.concept && (
          <figure className="t-panel p-3 m-0 flex-[0_1_260px] flex flex-col gap-2">
            <a href={mini.concept} target="_blank" rel="noreferrer"><img src={mini.concept} alt={`Concept art for ${name}`} className="w-full border border-rule" /></a>
            <figcaption className="t-small">The concept art TRELLIS modelled</figcaption>
          </figure>
        )}
      </div>
    </>
  );
}

const wireMaterial = new THREE.MeshBasicMaterial({ color: '#C4A35A', wireframe: true, transparent: true, opacity: 0.28 });

function Model({ name, version, tiers, wire }: { name: ModelName; version: Version; tiers: Tiers; wire: boolean }) {
  if (version === 'mini') {
    const entry = MINI_BY_NAME.get(name);
    return entry ? <MiniModel url={entry.url} hi={tiers.medium(name)} wire={wire} /> : null;
  }
  const geo = version === 'far' ? tiers.medium(farName(name)) : tiers[version](name);
  if (!geo) return null;
  return (
    <>
      <mesh geometry={geo} material={version === 'far' ? propMaterialFar : propMaterial} />
      {wire && <mesh geometry={geo} material={wireMaterial} />}
    </>
  );
}

function MiniModel({ url, hi, wire }: { url: string; hi: THREE.BufferGeometry | undefined; wire: boolean }) {
  const scene = useMiniScene(url);
  const mini = useMemo(() => (hi ? fitMini(scene, hi) : null), [scene, hi]);
  useEffect(() => () => mini?.geometry.dispose(), [mini]);
  if (!mini) return null;
  return (
    <>
      <mesh geometry={mini.geometry} material={mini.material} />
      {wire && <mesh geometry={mini.geometry} material={wireMaterial} />}
    </>
  );
}

function Turntable({ spin, children }: { spin: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin && group.current) group.current.rotation.y += dt * 0.45;
  });
  return <group ref={group}>{children}</group>;
}

/** One map tile on the ground, for scale: a dark square with a gilt edge. */
function Tile() {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), []);
  return (
    <group position={[0, -0.002, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[2.4, 64]} />
        <meshBasicMaterial color="#121113" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshLambertMaterial color="#232026" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#6E5A31" />
      </lineSegments>
    </group>
  );
}

/** Moves the camera to a preset angle around the model whenever `view.n` changes. */
function CameraPreset({ view, spread }: { view: { v: View; n: number }; spread: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const target = new THREE.Vector3(0, 0.3, 0);
    const dist = spread ? 3.6 : 2.4;
    camera.position.copy(target).addScaledVector(VIEWS[view.v], dist);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [view, spread, camera, controls]);
  return null;
}
