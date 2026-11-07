import { describe, expect, it } from 'vitest';
import { createBitset, setBit } from '../terrain/codec';
import { distanceTo, FOG_FADE_TILES, FOG_REMEMBERED, fogFade, fogTexels } from '../vision/fog';

const W = 15;
const H = 15;
const at = (x: number, y: number) => y * W + x;

/** Party sees a 5×5 block in the middle; a strip to the west was explored earlier. */
function scene() {
  const visible = new Uint8Array(W * H);
  for (let y = 5; y <= 9; y++) for (let x = 5; x <= 9; x++) visible[at(x, y)] = 1;
  const explored = createBitset(W * H);
  for (let x = 1; x <= 4; x++) setBit(explored, at(x, 7), true);
  return { visible, explored, fade: fogFade(W, H, visible, explored) };
}

describe('fog fade', () => {
  it('leaves the middle of the party\'s sight clear and dims its rim', () => {
    const { fade } = scene();
    expect(fade[at(7, 7)]).toBe(0);
    expect(fade[at(9, 7)]).toBeGreaterThan(fade[at(8, 7)]);
    expect(fade[at(9, 7)]).toBeLessThan(FOG_REMEMBERED);
  });

  it('holds remembered ground at half fade', () => {
    const { fade } = scene();
    expect(fade[at(2, 7)]).toBe(FOG_REMEMBERED);
  });

  it('darkens unexplored ground with distance until it is unknown', () => {
    const { fade } = scene();
    const steps = [10, 11, 12].map((x) => fade[at(x, 7)]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(steps[0]).toBeGreaterThan(FOG_REMEMBERED);
    expect(fade[at(9 + FOG_FADE_TILES, 7)]).toBe(1);
    expect(fade[at(14, 0)]).toBe(1);
  });

  it('fades out around remembered ground too', () => {
    const { fade } = scene();
    expect(fade[at(2, 6)]).toBeGreaterThan(FOG_REMEMBERED);
    expect(fade[at(2, 6)]).toBeLessThan(1);
  });

  it('is all unknown when nothing has been seen', () => {
    const fade = fogFade(W, H, new Uint8Array(W * H), createBitset(W * H));
    expect(Array.from(fade).every((f) => f === 1)).toBe(true);
  });

  it('packs into texels', () => {
    expect(Array.from(fogTexels(new Float32Array([0, 0.5, 1])))).toEqual([0, 128, 255]);
  });
});

describe('chamfer distance', () => {
  it('measures straight and diagonal steps', () => {
    const d = distanceTo(5, 5, (i) => i === 0);
    expect(d[at5(4, 0)]).toBeCloseTo(4);
    expect(d[at5(3, 3)]).toBeCloseTo(3 * Math.SQRT2);
  });
});

function at5(x: number, y: number) {
  return y * 5 + x;
}
