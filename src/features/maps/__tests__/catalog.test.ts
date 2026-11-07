import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { farName, MODEL_NAMES, MODELS_URL } from '../render/catalog';

/** Node names from a GLB's JSON chunk. */
function nodeNames(file: string): string[] {
  const glb = fs.readFileSync(file);
  expect(glb.toString('ascii', 0, 4)).toBe('glTF');
  const length = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + length)) as { nodes: { name: string }[] };
  return json.nodes.map((n) => n.name);
}

describe('world-props.glb', () => {
  const names = new Set(nodeNames(path.join(process.cwd(), 'public', MODELS_URL)));

  it('holds every catalog model and its far version', () => {
    for (const name of MODEL_NAMES) {
      expect(names.has(name), name).toBe(true);
      expect(names.has(farName(name)), farName(name)).toBe(true);
    }
  });

  it('holds nothing the catalog leaves out', () => {
    const known = new Set<string>(MODEL_NAMES.flatMap((n) => [n, farName(n)]));
    expect([...names].filter((n) => !known.has(n))).toEqual([]);
  });
});
