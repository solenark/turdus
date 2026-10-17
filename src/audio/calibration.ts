import { analyze, DEFAULT_SETTINGS } from './analysis';
import type { RawFrame } from './types';

export const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-6));

export type NoiseQuality = 'great' | 'good' | 'noisy';

/** Room noise from a silent recording: the median frame energy. */
export function measureNoise(raw: RawFrame[]): { rms: number; quality: NoiseQuality } {
  const levels = raw.map((f) => f.rms).sort((a, b) => a - b);
  const rms = levels.length ? levels[Math.floor(levels.length / 2)] : 0;
  const db = toDb(rms);
  return { rms, quality: db < -60 ? 'great' : db < -45 ? 'good' : 'noisy' };
}

/**
 * The sustained note in a calibration recording: the longest detected note, rounded.
 * Uses the full range (no profile) so the very extremes of the voice are not cut off.
 */
export function measureSustainedNote(raw: RawFrame[]): number | null {
  const { notes } = analyze(raw, { ...DEFAULT_SETTINGS, compensateTuning: false });
  if (notes.length === 0) return null;
  const longest = notes.reduce((a, b) => (b.duration > a.duration ? b : a));
  return Math.round(longest.pitch ?? longest.midi);
}
