/**
 * The sky over a map: where the sun and moon stand at a world time, the light
 * they throw on the land, and the colours of the sky painted behind it. Pure
 * maths; Sky.tsx draws it and lights the scene with it.
 *
 * World axes are three.js's: +x east, +z south (map rows run down), +y up, so
 * map north is −z. Colours are sRGB triples in 0..1.
 */
import type { SkySettings, Weather } from '../types';
import { MINUTES_PER_DAY, SUNRISE_HOUR, SUNSET_HOUR, dayFraction } from '../travel/travel';

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export const DEFAULT_SKY: SkySettings = { show: true, noon: 'north', noonHeight: 55, moonCycle: 28, fullMoonDay: 14 };

export function resolveSky(sky: Partial<SkySettings> | undefined): SkySettings {
  return { ...DEFAULT_SKY, ...sky };
}

/**
 * The light with no world clock (the editor outside a session): the sun stands
 * where it always has, high in the north-west. scripts/models/build.py lights
 * its preview sheets from here (SUN_FROM), so keep the two in step.
 */
export const STUDIO_SUN: Vec3 = normalize([-36, 48, -14]);

export interface SkyState {
  /** Unit vectors toward the sun and moon. */
  sun: Vec3;
  moon: Vec3;
  /** Heights above the horizon, radians. */
  sunHeight: number;
  moonHeight: number;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  moonPhase: number;
  /** How much of the moon's face is lit, 0..1. */
  moonLit: number;
  /** The light that shades the land. `dir` points toward it. */
  light: { dir: Vec3; color: RGB; intensity: number };
  /** Fill from the sky above and the ground below. */
  hemi: { sky: RGB; ground: RGB; intensity: number };
  /** The painted sky: overhead, at the horizon, and the void below it. */
  zenith: RGB;
  horizon: RGB;
  below: RGB;
  /** Dawn and dusk colour pooled on the horizon under the sun. */
  glow: RGB;
  glowStrength: number;
  sunColor: RGB;
  /** How visible each is through the weather, 0..1. */
  sunDisc: number;
  moonDisc: number;
  stars: number;
  /** Cloud cover, 0 (clear) to 1, and the clouds' lit and shadowed colours. */
  clouds: number;
  cloudLit: RGB;
  cloudShade: RGB;
  /** Dark enough for the company to light a fire. */
  night: boolean;
  storm: boolean;
}

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scaleRGB = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/**
 * The sun's angle around its daily circle for an hour: −π/2 at sunrise, 0 at
 * midday, π/2 at sunset. Day and night are each stretched to fill their half,
 * so the sun meets the horizon exactly at SUNRISE_HOUR and SUNSET_HOUR.
 */
export function hourAngle(hour: number): number {
  const day = SUNSET_HOUR - SUNRISE_HOUR;
  const since = (((hour - SUNRISE_HOUR) % 24) + 24) % 24;
  if (since <= day) return -Math.PI / 2 + (since / day) * Math.PI;
  return Math.PI / 2 + ((since - day) / (24 - day)) * Math.PI;
}

/**
 * A point on a body's daily circle: rising due east, peaking at `noonHeight`
 * over the noon side, setting due west.
 */
export function celestial(angle: number, sky: SkySettings): Vec3 {
  const noon = clamp(sky.noonHeight, 5, 89) * DEG;
  const side = sky.noon === 'north' ? -1 : 1;
  const across = Math.cos(angle);
  return [-Math.sin(angle), across * Math.sin(noon), across * Math.cos(noon) * side];
}

/** 0 new, 0.5 full; full on `fullMoonDay` and every `moonCycle` days either side. */
export function moonPhase(minutes: number, sky: SkySettings): number {
  const days = minutes / MINUTES_PER_DAY;
  const p = (days - (sky.fullMoonDay - 1)) / Math.max(2, sky.moonCycle) + 0.5;
  return p - Math.floor(p);
}

export function moonName(phase: number): string {
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return names[Math.round(phase * 8) % 8];
}

/** Whole days until the next full moon (0 if it is full today). */
export function daysToFullMoon(minutes: number, sky: SkySettings): number {
  const cycle = Math.max(2, sky.moonCycle);
  const day = Math.floor(minutes / MINUTES_PER_DAY) + 1;
  return (((sky.fullMoonDay - day) % cycle) + cycle) % cycle;
}

/** The sky and its light by the sun's height in degrees. The last key is the long-standing daylight. */
interface Key {
  at: number;
  sun: string;
  sunI: number;
  sky: string;
  ground: string;
  amb: number;
  zenith: string;
  horizon: string;
  below: string;
  glow: string;
  glowK: number;
}

// Night is contrast, not darkness: the DM still has to read the map. Light
// colours (sun, sky, ground) are tints, not paint: keep them light and let the
// intensity set the level, since a dark hex is many times dimmer in linear light.
const KEYS: Key[] = [
  { at: -14, sun: '#A4B4E4', sunI: 0, sky: '#8E9CCF', ground: '#262436', amb: 0.62, zenith: '#080B16', horizon: '#161B2E', below: '#060609', glow: '#26283F', glowK: 0 },
  { at: -6, sun: '#A4B4E4', sunI: 0, sky: '#9A98C4', ground: '#2A2430', amb: 0.62, zenith: '#131830', horizon: '#3E3652', below: '#0B0A10', glow: '#6E4250', glowK: 0.4 },
  { at: -1, sun: '#D8845C', sunI: 0.45, sky: '#B49AA6', ground: '#2E2224', amb: 0.62, zenith: '#252C50', horizon: '#A85E46', below: '#16111A', glow: '#C4603A', glowK: 0.85 },
  { at: 4, sun: '#F4AE6A', sunI: 1.25, sky: '#BCAEB4', ground: '#3A2C22', amb: 0.68, zenith: '#3B4C74', horizon: '#D39662', below: '#201818', glow: '#DC9C5C', glowK: 0.7 },
  { at: 12, sun: '#FFE2B8', sunI: 1.55, sky: '#C4C8D2', ground: '#3A2E22', amb: 0.8, zenith: '#4C6690', horizon: '#C6BFB1', below: '#24221F', glow: '#EED0A0', glowK: 0.28 },
  { at: 25, sun: '#FFF1DA', sunI: 1.7, sky: '#C9D3E0', ground: '#3B3024', amb: 0.85, zenith: '#516F97', horizon: '#BCC5CC', below: '#202327', glow: '#FFF1DA', glowK: 0.12 },
];

function keyAt(heightDeg: number) {
  let i = 0;
  while (i < KEYS.length - 2 && heightDeg > KEYS[i + 1].at) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((heightDeg - a.at) / (b.at - a.at), 0, 1);
  const c = (k: 'sun' | 'sky' | 'ground' | 'zenith' | 'horizon' | 'below' | 'glow') => mixRGB(hex(a[k]), hex(b[k]), t);
  return {
    sun: c('sun'), sunI: lerp(a.sunI, b.sunI, t), sky: c('sky'), ground: c('ground'), amb: lerp(a.amb, b.amb, t),
    zenith: c('zenith'), horizon: c('horizon'), below: c('below'), glow: c('glow'), glowK: lerp(a.glowK, b.glowK, t),
  };
}

/** What each kind of weather does to the sky: cloud cover, how much direct light gets through, greying and darkening. */
const WEATHER: Record<Weather, { cover: number; light: number; amb: number; grey: number; dark: number }> = {
  clear: { cover: 0.16, light: 1, amb: 1, grey: 0, dark: 0 },
  overcast: { cover: 0.8, light: 0.45, amb: 1.05, grey: 0.55, dark: 0.12 },
  rain: { cover: 0.9, light: 0.38, amb: 1.0, grey: 0.65, dark: 0.28 },
  storm: { cover: 1, light: 0.3, amb: 0.95, grey: 0.7, dark: 0.48 },
  snow: { cover: 0.86, light: 0.45, amb: 1.12, grey: 0.72, dark: 0 },
  fog: { cover: 0.5, light: 0.5, amb: 1.1, grey: 0.85, dark: 0 },
};

/** Toward greyness and darkness, keeping brightness: what a cloud deck does to a colour. */
function weathered(c: RGB, grey: number, dark: number): RGB {
  const lum = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
  return scaleRGB(mixRGB(c, [lum, lum, lum * 1.04], grey), 1 - dark);
}

const MOON_LIGHT = hex('#A4B4E4');
/** The lowest the shading light comes from, whatever the sun or moon disc does. */
const SHADE_MIN = 30 * DEG;

/**
 * The sky at `minutes` (null: the fixed studio daylight). Cheap enough to run
 * every frame while the sun sweeps to a new hour.
 */
export function skyState(minutes: number | null, settings: Partial<SkySettings> | undefined, weather: Weather = 'clear'): SkyState {
  const sky = resolveSky(settings);
  const w = WEATHER[weather] ?? WEATHER.clear;

  let sun: Vec3;
  let moon: Vec3;
  let phase: number;
  if (minutes === null) {
    sun = STUDIO_SUN;
    phase = 0.5;
    moon = [-sun[0], -sun[1], -sun[2]];
  } else {
    const hour = dayFraction(minutes) * 24;
    phase = moonPhase(minutes, sky);
    sun = celestial(hourAngle(hour), sky);
    // The moon trails the sun by its phase: new rises with the sun, full rises at sunset.
    moon = celestial(hourAngle(hour - phase * 24), sky);
  }
  const sunHeight = Math.asin(clamp(sun[1], -1, 1));
  const moonHeight = Math.asin(clamp(moon[1], -1, 1));
  const heightDeg = sunHeight / DEG;
  const lit = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const k = keyAt(heightDeg);

  // Direct light: the sun by day; once it's down, the moon if it's up, else a faint skyglow from overhead.
  // Shading keeps the light at least SHADE_MIN up whatever the disc does: a true
  // ten-degree sun grazes flat ground and leaves the map unreadable. The bearing
  // stays true, so low light still comes from the side the sun is on.
  const lift = (v: Vec3): Vec3 => {
    const flat = Math.hypot(v[0], v[2]) || 1;
    const up = Math.max(Math.asin(clamp(v[1], -1, 1)), SHADE_MIN);
    return [(v[0] / flat) * Math.cos(up), Math.sin(up), (v[2] / flat) * Math.cos(up)];
  };
  const nightness = 1 - smoothstep(-6, 0, heightDeg);
  const moonUp = smoothstep(-1, 10, moonHeight / DEG);
  const moonI = (0.3 + 0.35 * lit * moonUp) * nightness;
  const sunI = k.sunI;
  const fromMoon = moonI > sunI;
  const dir = fromMoon ? (moonUp > 0.05 ? lift(moon) : normalize([0.3, 1, 0.2])) : lift(sun);
  const total = sunI + moonI;
  const color = total > 0 ? mixRGB(k.sun, MOON_LIGHT, moonI / total) : MOON_LIGHT;

  // A bright moon fills the night a little.
  const amb = (k.amb + 0.05 * lit * moonUp * nightness) * w.amb;
  const nightGrey = w.grey * (1 - nightness * 0.4);

  return {
    sun,
    moon,
    sunHeight,
    moonHeight,
    moonPhase: phase,
    moonLit: lit,
    light: { dir, color, intensity: total * w.light },
    hemi: { sky: weathered(k.sky, nightGrey * 0.6, w.dark * 0.5), ground: k.ground, intensity: amb },
    zenith: weathered(k.zenith, nightGrey, w.dark),
    horizon: weathered(k.horizon, nightGrey, w.dark),
    below: weathered(k.below, nightGrey * 0.5, w.dark * 0.5),
    glow: k.glow,
    glowStrength: k.glowK * (1 - w.cover * 0.75),
    sunColor: k.sun,
    sunDisc: 1 - smoothstep(0.45, 0.95, w.cover) * 0.85,
    moonDisc: 1 - smoothstep(0.45, 0.95, w.cover) * 0.9,
    stars: smoothstep(-3, -11, heightDeg) * (1 - w.cover) * (1 - lit * 0.35),
    clouds: w.cover,
    cloudLit: weathered(mixRGB(k.horizon, [1, 1, 1], 0.35 * (1 - nightness)), nightGrey * 0.5, w.dark),
    cloudShade: weathered(mixRGB(k.zenith, k.below, 0.35), nightGrey * 0.5, w.dark * 0.8),
    night: heightDeg < -3,
    storm: weather === 'storm',
  };
}
