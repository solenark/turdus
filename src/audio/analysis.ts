import { detectKey, makeGrid, quantize, snapToScale, type GridDivision, type Grid, type Key, type ScaleType } from './music';
import { hzToMidi } from './noteNames';
import { segmentNotes } from './segment';
import type { Note, PitchFrame, RawFrame } from './types';

/** User-controlled settings. Reprocessing with them is cheap (the audio is not re-analyzed). */
export interface AnalysisSettings {
  /** 0..1: how much faint or unclear sound still counts as voice. */
  sensitivity: number;
  /** Semitones the voice may drift around the note centre without becoming another note. */
  tolerance: number;
  /** Segments shorter than this join the neighbouring note. */
  minNoteMs: number;
  /** Measures the singer's average tuning offset and compensates before choosing notes. */
  compensateTuning: boolean;

  // Musical fit (applied after detection).
  scaleMode: 'off' | 'auto' | 'manual';
  scaleRoot: number;
  scaleType: ScaleType;
  quantize: boolean;
  bpm: number;
  grid: GridDivision;
}

/** Settings on the detection tab; the rest belong to the fit tab. */
export const DETECTION_KEYS = ['sensitivity', 'tolerance', 'minNoteMs', 'compensateTuning'] as const;
export const FIT_KEYS = ['scaleMode', 'scaleRoot', 'scaleType', 'quantize', 'bpm', 'grid'] as const;

export const DEFAULT_SETTINGS: AnalysisSettings = {
  sensitivity: 0.5,
  tolerance: 0.7,
  minNoteMs: 100,
  compensateTuning: true,
  scaleMode: 'off',
  scaleRoot: 0,
  scaleType: 'major',
  quantize: false,
  bpm: 100,
  grid: 8,
};

/** Calibration data stored in the voice profile; all optional. */
export interface VoiceProfile {
  noiseRms?: number;
  minMidi?: number;
  maxMidi?: number;
}

/** Default search range: ~C#2 to ~C#6, covering bass to soprano. */
const DEFAULT_MIN_HZ = 70;
const DEFAULT_MAX_HZ = 1100;
/** Margin (semitones) around the calibrated vocal range. */
const RANGE_MARGIN = 3;
/** Below this clarity a frame counts as noise when estimating the noise floor. */
const UNPITCHED_CLARITY = 0.6;

export interface AnalysisResult {
  frames: PitchFrame[];
  notes: Note[];
  /** Compensated tuning offset in semitones (0 when off). */
  tuningOffset: number;
  noiseFloor: number;
  /** Minimum RMS for a frame to count as voice. */
  threshold: number;
  /** Key used for snapping (detected or chosen); null when off. */
  key: Key | null;
  /** Rhythmic grid used; null when rhythm alignment is off. */
  grid: Grid | null;
}

const db = (v: number) => 10 ** (v / 20);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(p * (s.length - 1))];
}

/**
 * Sensitivity → thresholds. At 0.5 the voice must be 10 dB above the noise floor, at most
 * 25 dB below the loudest frame, with clarity ≥ 0.8.
 */
function thresholds(s: number) {
  return {
    minClarity: 0.9 - 0.2 * s,
    marginOverNoiseDb: 16 - 12 * s,
    belowPeakDb: 20 + 10 * s,
  };
}

/** Minimum consistency (0..1) of the offset across frames for compensation to be worth it. */
const MIN_TUNING_CONSISTENCY = 0.6;

/**
 * Average offset (semitones, in −0.5..0.5) of the frames from the nearest note, weighted by energy.
 * Returns 0 when the offset is inconsistent (each note off in a different direction): compensating would only hurt.
 */
export function estimateTuningOffset(frames: PitchFrame[]): number {
  // Circular mean: +0.45 and −0.45 are both close to ±0.5, not to 0.
  let x = 0;
  let y = 0;
  let weight = 0;
  for (const f of frames) {
    if (f.midi === null) continue;
    const angle = 2 * Math.PI * (f.midi - Math.round(f.midi));
    x += f.rms * Math.cos(angle);
    y += f.rms * Math.sin(angle);
    weight += f.rms;
  }
  if (weight === 0 || Math.hypot(x, y) / weight < MIN_TUNING_CONSISTENCY) return 0;
  return Math.atan2(y, x) / (2 * Math.PI);
}

export function analyze(raw: RawFrame[], settings: AnalysisSettings, profile: VoiceProfile = {}): AnalysisResult {
  const t = thresholds(settings.sensitivity);
  const peak = Math.max(0, ...raw.map((f) => f.rms));
  // Noise floor: typical level of frames without a clear pitch (silence, hiss). If the recording has
  // almost none, only the peak-relative threshold applies. The calibrated value wins if it is higher.
  const unpitched = raw.filter((f) => f.clarity < UNPITCHED_CLARITY).map((f) => f.rms);
  const measured = unpitched.length >= raw.length * 0.05 ? percentile(unpitched, 0.25) : 0;
  const noiseFloor = Math.max(measured, profile.noiseRms ?? 0);
  const threshold = Math.max(1e-4, noiseFloor * db(t.marginOverNoiseDb), peak * db(-t.belowPeakDb));

  const minHz = profile.minMidi !== undefined ? 440 * 2 ** ((profile.minMidi - RANGE_MARGIN - 69) / 12) : DEFAULT_MIN_HZ;
  const maxHz = profile.maxMidi !== undefined ? 440 * 2 ** ((profile.maxMidi + RANGE_MARGIN - 69) / 12) : DEFAULT_MAX_HZ;

  const voiced: PitchFrame[] = raw.map((f) => {
    let hz = f.hz;
    // With low voices MPM sometimes locks onto a subharmonic (f/2, f/4); shift up by octaves into range.
    while (hz > 0 && hz < minHz) hz *= 2;
    const ok = f.rms >= threshold && f.clarity >= t.minClarity && hz >= minHz && hz <= maxHz;
    return { time: f.time, midi: ok ? hzToMidi(hz) : null, rms: f.rms };
  });

  const tuningOffset = settings.compensateTuning ? estimateTuningOffset(voiced) : 0;
  const frames = tuningOffset
    ? voiced.map((f) => (f.midi === null ? f : { ...f, midi: f.midi - tuningOffset }))
    : voiced;

  const detected = segmentNotes(frames, { hysteresis: settings.tolerance, minNoteDuration: settings.minNoteMs / 1000 });

  const key =
    settings.scaleMode === 'auto'
      ? detectKey(detected)
      : settings.scaleMode === 'manual'
        ? { root: settings.scaleRoot, type: settings.scaleType }
        : null;
  const inScale = key ? snapToScale(detected, key) : detected;
  const grid = settings.quantize ? makeGrid(inScale, settings.bpm, settings.grid) : null;
  const notes = grid ? quantize(inScale, grid) : inScale;
  return { frames, notes, tuningOffset, noiseFloor, threshold, key, grid };
}
