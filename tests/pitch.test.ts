import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_SETTINGS } from '../src/audio/analysis';
import { extractFrames } from '../src/audio/pitch';
import { SR, synth } from './helpers';

const framesOf = (audio: Float32Array) => analyze(extractFrames(audio, SR), DEFAULT_SETTINGS).frames;

describe('extraction + filters', () => {
  it('detects 440 Hz as MIDI 69', () => {
    const frames = framesOf(synth([{ midi: 69, dur: 0.5 }]));
    const voiced = frames.filter((f) => f.midi !== null);
    expect(voiced.length).toBeGreaterThan(frames.length * 0.9);
    for (const f of voiced) expect(f.midi!).toBeCloseTo(69, 1);
  });

  it('detects no pitch in silence', () => {
    expect(framesOf(new Float32Array(SR)).every((f) => f.midi === null)).toBe(true);
  });
});
