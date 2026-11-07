/**
 * The editor's undo history: terrain strokes and object edits (pins, roads,
 * rivers, names) on one stack, so Ctrl+Z undoes whatever was done last.
 */
import type { MapObject, TerrainGrid } from '../types';

export type Change =
  | { kind: 'terrain'; label: string; before: TerrainGrid; after: TerrainGrid }
  /** Objects as they were and as they became; created ones appear only after, deleted ones only before. */
  | { kind: 'objects'; label: string; before: MapObject[]; after: MapObject[] };

const LIMIT = 80;

export class History {
  private past: Change[] = [];
  private future: Change[] = [];

  push(change: Change) {
    this.past.push(change);
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
  }

  undo(): Change | undefined {
    const change = this.past.pop();
    if (change) this.future.push(change);
    return change;
  }

  redo(): Change | undefined {
    const change = this.future.pop();
    if (change) this.past.push(change);
    return change;
  }

  /** Puts a change back after it couldn't be applied. */
  restore(change: Change, undone: boolean) {
    if (undone) {
      this.future.pop();
      this.past.push(change);
    } else {
      this.past.pop();
      this.future.push(change);
    }
  }

  get nextUndo(): string | null {
    return this.past[this.past.length - 1]?.label ?? null;
  }

  get nextRedo(): string | null {
    return this.future[this.future.length - 1]?.label ?? null;
  }
}

/** What to save and delete to turn the objects in `from` back into `to`. */
export function objectSteps(from: MapObject[], to: MapObject[]): { upsert: MapObject[]; remove: string[] } {
  const keep = new Set(to.map((o) => o.id));
  return { upsert: to, remove: from.filter((o) => !keep.has(o.id)).map((o) => o.id) };
}
