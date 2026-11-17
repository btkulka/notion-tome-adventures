import { describe, expect, it } from 'vitest';
import { celestial, DEFAULT_SKY, daysToFullMoon, hourAngle, moonPhase, skyState, STUDIO_SUN } from '../render/sky';
import { isNight, MINUTES_PER_DAY, SUNRISE_HOUR, SUNSET_HOUR } from '../travel/travel';

const at = (day: number, hour: number) => (day - 1) * MINUTES_PER_DAY + hour * 60;
const deg = (r: number) => (r * 180) / Math.PI;

describe('sun', () => {
  it('meets the horizon at sunrise and sunset, due east and due west', () => {
    const rise = celestial(hourAngle(SUNRISE_HOUR), DEFAULT_SKY);
    const set = celestial(hourAngle(SUNSET_HOUR), DEFAULT_SKY);
    expect(rise[1]).toBeCloseTo(0, 6);
    expect(rise[0]).toBeCloseTo(1, 6);
    expect(set[1]).toBeCloseTo(0, 6);
    expect(set[0]).toBeCloseTo(-1, 6);
  });

  it('peaks at the set height over the chosen side midway through the day', () => {
    const midday = (SUNRISE_HOUR + SUNSET_HOUR) / 2;
    const north = celestial(hourAngle(midday), { ...DEFAULT_SKY, noonHeight: 40 });
    expect(deg(Math.asin(north[1]))).toBeCloseTo(40, 6);
    expect(north[2]).toBeLessThan(0);
    const south = celestial(hourAngle(midday), { ...DEFAULT_SKY, noon: 'south' });
    expect(south[2]).toBeGreaterThan(0);
  });

  it('is down exactly when sight counts as night', () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const s = skyState(at(3, hour), DEFAULT_SKY);
      if (hour === SUNRISE_HOUR || hour === SUNSET_HOUR) continue;
      expect(s.sunHeight < 0).toBe(isNight(at(3, hour)));
    }
  });

  it('keeps the long-standing daylight with no clock', () => {
    const s = skyState(null, DEFAULT_SKY);
    expect(s.sun).toEqual(STUDIO_SUN);
    expect(s.light.intensity).toBeCloseTo(1.7, 6);
    expect(s.hemi.intensity).toBeCloseTo(0.85, 6);
  });

  it('never lights the land from below the horizon', () => {
    for (let hour = 0; hour < 24; hour += 0.25) expect(skyState(at(2, hour), DEFAULT_SKY).light.dir[1]).toBeGreaterThan(0);
  });
});

describe('moon', () => {
  it('is full on the set day and every cycle after', () => {
    const sky = { ...DEFAULT_SKY, moonCycle: 28, fullMoonDay: 14 };
    expect(moonPhase(at(14, 0), sky)).toBeCloseTo(0.5, 6);
    expect(moonPhase(at(42, 0), sky)).toBeCloseTo(0.5, 6);
    expect(moonPhase(at(28, 0), sky)).toBeCloseTo(0, 6);
    expect(daysToFullMoon(at(14, 12), sky)).toBe(0);
    expect(daysToFullMoon(at(10, 12), sky)).toBe(4);
    expect(daysToFullMoon(at(15, 12), sky)).toBe(27);
  });

  it('stands high at midnight when full and lights the night more than a new moon', () => {
    const full = skyState(at(14, 0.5), DEFAULT_SKY);
    expect(full.moonHeight).toBeGreaterThan(0.6);
    const fresh = skyState(at(28, 0.5), DEFAULT_SKY);
    expect(full.light.intensity).toBeGreaterThan(fresh.light.intensity);
    expect(full.night).toBe(true);
  });

  it('dims under cloud, and storms darken the day', () => {
    const clear = skyState(at(5, 13), DEFAULT_SKY, 'clear');
    const storm = skyState(at(5, 13), DEFAULT_SKY, 'storm');
    expect(storm.light.intensity).toBeLessThan(clear.light.intensity * 0.5);
    expect(storm.sunDisc).toBeLessThan(clear.sunDisc);
    expect(storm.clouds).toBeGreaterThan(clear.clouds);
  });
});
