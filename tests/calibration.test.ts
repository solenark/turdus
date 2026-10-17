import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_SETTINGS } from '../src/audio/analysis';
import { measureNoise, measureSustainedNote } from '../src/audio/calibration';
import { extractFrames } from '../src/audio/pitch';
import { SR, synth } from './helpers';

/** Deterministic white noise (LCG) so tests are stable. */
function noise(seconds: number, amp: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  let x = 12345;
  for (let i = 0; i < out.length; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out[i] = amp * (x / 1073741824 - 1);
  }
  return out;
}
const mix = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + (b[i] ?? 0));

describe('calibration', () => {
  it('measures noise from a silent recording and rates the room', () => {
    const quiet = measureNoise(extractFrames(noise(3, 0.0005), SR));
    const loud = measureNoise(extractFrames(noise(3, 0.05), SR));
    expect(quiet.quality).toBe('great');
    expect(loud.quality).toBe('noisy');
    expect(loud.rms).toBeGreaterThan(quiet.rms * 50);
  });

  it('identifies the sustained note, ignoring a short attack', () => {
    const audio = synth([{ midi: 47, dur: 0.15 }, { midi: 45, dur: 1.5 }]);
    expect(measureSustainedNote(extractFrames(audio, SR))).toBe(45);
  });

  it('does not invent a note in a recording without voice', () => {
    expect(measureSustainedNote(extractFrames(noise(2, 0.01), SR))).toBeNull();
  });
});

describe('profile within analysis', () => {
  it('the calibrated range drops notes far outside it', () => {
    // Voice in A2–D3; a whistle at A5 (outside range + margin) must not become a note.
    const raw = extractFrames(synth([{ midi: 45, dur: 0.5 }, { midi: 81, dur: 0.5 }, { midi: 50, dur: 0.5 }]), SR);
    expect(analyze(raw, DEFAULT_SETTINGS).notes.map((n) => n.midi)).toEqual([45, 81, 50]);
    expect(analyze(raw, DEFAULT_SETTINGS, { minMidi: 45, maxMidi: 50 }).notes.map((n) => n.midi)).toEqual([45, 50]);
  });

  it('calibrated noise raises the threshold when the recording looks cleaner than the real room', () => {
    const audio = mix(synth([{ midi: 60, dur: 0.5 }, { midi: null, dur: 0.2 }, { midi: 64, dur: 0.5, amp: 0.04 }]), noise(1.2, 0.0005));
    const raw = extractFrames(audio, SR);
    expect(analyze(raw, DEFAULT_SETTINGS).notes).toHaveLength(2);
    expect(analyze(raw, DEFAULT_SETTINGS, { noiseRms: 0.02 }).notes.map((n) => n.midi)).toEqual([60]);
  });
});
