import type { Note } from './types';

export type ScaleType = 'major' | 'minor';

export interface Key {
  /** Pitch class of the tonic: 0 = C … 11 = B. */
  root: number;
  type: ScaleType;
}

const SCALE_STEPS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// Keys written with flats in the key signature (F, Bb, Eb, Ab, Db major and their relative minors).
const FLAT_MAJOR_ROOTS = [5, 10, 3, 8, 1];

/** Whether accidentals in this key are spelled as flats (Eb) rather than sharps (D#). */
export function usesFlats(key: Key): boolean {
  const major = key.type === 'major' ? key.root : (key.root + 3) % 12;
  return FLAT_MAJOR_ROOTS.includes(major);
}

const ROOT_SHARPS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
const ROOT_FLATS = ['Dó', 'Réb', 'Ré', 'Mib', 'Mi', 'Fá', 'Solb', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'];
/** Black keys show both spellings, since the mode (major/minor) is picked separately. */
export const ROOT_OPTIONS = ROOT_SHARPS.map((name, root) => ({
  root,
  name: name === ROOT_FLATS[root] ? name : `${name}/${ROOT_FLATS[root]}`,
}));

export function keyName(key: Key): string {
  return `${(usesFlats(key) ? ROOT_FLATS : ROOT_SHARPS)[key.root]} ${key.type === 'major' ? 'maior' : 'menor'}`;
}

const pc = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;
const inKey = (midi: number, key: Key) => SCALE_STEPS[key.type].includes((pc(midi) - key.root + 12) % 12);

// Krumhansl-Kessler profiles: how strongly each degree "belongs" to the key.
const PROFILES: Record<ScaleType, number[]> = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

function correlation(a: number[], b: number[]): number {
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Most likely key for the notes, weighting each by its duration. */
export function detectKey(notes: Note[]): Key | null {
  if (notes.length === 0) return null;
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[pc(n.midi)] += n.duration;
  let best: Key | null = null;
  let bestScore = -Infinity;
  for (const type of ['major', 'minor'] as ScaleType[]) {
    for (let root = 0; root < 12; root++) {
      const rotated = hist.map((_, i) => hist[(i + root) % 12]);
      const score = correlation(rotated, PROFILES[type]);
      if (score > bestScore) {
        bestScore = score;
        best = { root, type };
      }
    }
  }
  return best;
}

/** Moves each note to the scale degree closest to the sung pitch (not the already rounded note). */
export function snapToScale(notes: Note[], key: Key): Note[] {
  return notes.map((n) => {
    const p = n.pitch ?? n.midi;
    let best = n.midi;
    let bestDist = Infinity;
    for (let m = Math.floor(p) - 2; m <= Math.ceil(p) + 2; m++) {
      if (inKey(m, key) && Math.abs(m - p) < bestDist) {
        bestDist = Math.abs(m - p);
        best = m;
      }
    }
    return best === n.midi ? n : { ...n, midi: best };
  });
}

export type GridDivision = 4 | 8 | 16;

export interface Grid {
  /** Time (s) of the first beat: the start of the first note. */
  origin: number;
  beat: number;
  step: number;
}

export function makeGrid(notes: Note[], bpm: number, division: GridDivision): Grid | null {
  if (notes.length === 0) return null;
  const beat = 60 / bpm;
  return { origin: Math.min(...notes.map((n) => n.start)), beat, step: (beat * 4) / division };
}

/** Aligns note starts and ends to the grid; notes landing on the same point keep only the longest. */
export function quantize(notes: Note[], grid: Grid): Note[] {
  const snap = (t: number) => grid.origin + Math.round((t - grid.origin) / grid.step) * grid.step;
  const snapped = notes
    .map((n) => {
      const start = snap(n.start);
      const end = Math.max(snap(n.start + n.duration), start + grid.step);
      return { note: { ...n, start, duration: end - start }, original: n.duration };
    })
    .sort((a, b) => a.note.start - b.note.start);

  const out: typeof snapped = [];
  for (const cur of snapped) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.note.start - cur.note.start) < 1e-9) {
      if (cur.original > prev.original) out[out.length - 1] = cur;
      continue;
    }
    // No overlap: the previous note ends where the next one starts.
    if (prev && prev.note.start + prev.note.duration > cur.note.start) {
      prev.note = { ...prev.note, duration: cur.note.start - prev.note.start };
    }
    out.push(cur);
  }
  return out.map((s) => s.note);
}
