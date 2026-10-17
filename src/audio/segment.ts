import type { Note, PitchFrame } from './types';

export interface SegmentOptions {
  medianWindow: number;
  /** Neighbouring frames used to detect spurious octave jumps. */
  octaveWindow: number;
  /** Deviation (semitones) from the current note centre tolerated before starting a new note. */
  hysteresis: number;
  /** Segments shorter than this are absorbed by a neighbouring note (or dropped if isolated). */
  minNoteDuration: number;
  /** Unvoiced gaps shorter than this between equal notes are merged. */
  maxMergeGap: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  medianWindow: 5,
  octaveWindow: 15,
  hysteresis: 0.6,
  minNoteDuration: 0.1,
  maxMergeGap: 0.05,
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median of the voiced frames around i (unvoiced frames are ignored). */
function localMedian(pitches: (number | null)[], i: number, window: number): number | null {
  const half = window >> 1;
  const neighbours: number[] = [];
  for (let j = Math.max(0, i - half); j <= Math.min(pitches.length - 1, i + half); j++) {
    const m = pitches[j];
    if (m !== null) neighbours.push(m);
  }
  return neighbours.length ? median(neighbours) : null;
}

/** Moves frames that jumped ±12 semitones back to their neighbours' octave. */
function fixOctaves(pitches: (number | null)[], window: number): (number | null)[] {
  return pitches.map((p, i) => {
    if (p === null) return null;
    const ref = localMedian(pitches, i, window)!;
    const octaves = Math.round((ref - p) / 12);
    return octaves !== 0 && Math.abs(p + 12 * octaves - ref) < 1.5 ? p + 12 * octaves : p;
  });
}

interface Group {
  pitches: number[];
  rms: number[];
  startIdx: number;
  endIdx: number;
}

const groupPitch = (g: Group) => median(g.pitches);
const absorb = (into: Group, from: Group) => {
  into.pitches.push(...from.pitches);
  into.rms.push(...from.rms);
  into.startIdx = Math.min(into.startIdx, from.startIdx);
  into.endIdx = Math.max(into.endIdx, from.endIdx);
};

export function segmentNotes(frames: PitchFrame[], opts: Partial<SegmentOptions> = {}): Note[] {
  const o = { ...DEFAULT_SEGMENT_OPTIONS, ...opts };
  if (frames.length === 0) return [];
  const hop = frames.length > 1 ? frames[1].time - frames[0].time : 0.0116;
  const octaveFixed = fixOctaves(frames.map((f) => f.midi), o.octaveWindow);
  const pitches = octaveFixed.map((p, i) => (p === null ? null : localMedian(octaveFixed, i, o.medianWindow)));

  // Group consecutive frames close to the centre (median) of the current note.
  // The centre follows the actual pitch, so singing slightly out of tune does not split the note.
  const groups: Group[] = [];
  let current: Group | null = null;
  pitches.forEach((p, i) => {
    if (p === null) {
      current = null;
      return;
    }
    if (current && Math.abs(p - groupPitch(current)) <= o.hysteresis) {
      current.pitches.push(p);
      current.rms.push(frames[i].rms);
      current.endIdx = i;
      return;
    }
    current = { pitches: [p], rms: [frames[i].rms], startIdx: i, endIdx: i };
    groups.push(current);
  });

  const gapFrames = (a: Group, b: Group) => b.startIdx - a.endIdx - 1;
  const minFrames = o.minNoteDuration / hop;
  const maxGapFrames = o.maxMergeGap / hop;

  // Short segments (attack, slide between notes) join the adjacent note with the closest pitch.
  for (;;) {
    let shortest = -1;
    groups.forEach((g, i) => {
      if (g.endIdx - g.startIdx + 1 < minFrames && (shortest < 0 || g.pitches.length < groups[shortest].pitches.length))
        shortest = i;
    });
    if (shortest < 0) break;
    const g = groups[shortest];
    const candidates = [groups[shortest - 1], groups[shortest + 1]].filter(
      (n): n is Group => !!n && (n === groups[shortest - 1] ? gapFrames(n, g) : gapFrames(g, n)) <= maxGapFrames,
    );
    candidates.sort((a, b) => Math.abs(groupPitch(a) - groupPitch(g)) - Math.abs(groupPitch(b) - groupPitch(g)));
    if (candidates.length) absorb(candidates[0], g);
    groups.splice(shortest, 1);
  }

  // Merge equal notes separated by small gaps (breaths, consonants).
  const merged: Group[] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (prev && Math.round(groupPitch(prev)) === Math.round(groupPitch(g)) && gapFrames(prev, g) <= maxGapFrames) {
      absorb(prev, g);
    } else {
      merged.push(g);
    }
  }

  const peakRms = Math.max(...frames.map((f) => f.rms), 1e-9);
  return merged.map((g) => {
    const meanRms = g.rms.reduce((a, b) => a + b, 0) / g.rms.length;
    return {
      midi: Math.round(groupPitch(g)),
      pitch: groupPitch(g),
      start: Math.max(0, frames[g.startIdx].time - hop / 2),
      duration: (g.endIdx - g.startIdx + 1) * hop,
      velocity: Math.min(1, Math.max(0.2, meanRms / peakRms)),
    };
  });
}
