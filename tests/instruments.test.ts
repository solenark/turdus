import { describe, expect, it } from 'vitest';
import { getInstrument, INSTRUMENTS, nearestSample, SAMPLE_NOTES, type SampleSet } from '../src/audio/instruments';

describe('instruments', () => {
  it('have unique ids and valid GM programs', () => {
    expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(INSTRUMENTS.length);
    for (const i of INSTRUMENTS) {
      expect(i.program).toBeGreaterThanOrEqual(0);
      expect(i.program).toBeLessThan(128);
    }
  });

  it('falls back to the built-in synth for unknown ids', () => {
    expect(getInstrument('kazoo').id).toBe('simple');
    expect(getInstrument('piano').program).toBe(0);
  });

  it('samples every 3 semitones from C2 to C7', () => {
    expect(SAMPLE_NOTES[0]).toBe(36);
    expect(SAMPLE_NOTES.at(-1)).toBe(96);
  });
});

describe('nearestSample', () => {
  const buf = (m: number) => ({ id: m }) as unknown as AudioBuffer;
  const set: SampleSet = new Map([60, 63, 66].map((m) => [m, buf(m)]));

  it('retunes the closest sample', () => {
    const { buffer, rate } = nearestSample(set, 61);
    expect(buffer).toBe(set.get(60));
    expect(rate).toBeCloseTo(2 ** (1 / 12), 6);
    expect(nearestSample(set, 62).buffer).toBe(set.get(63));
    expect(nearestSample(set, 63).rate).toBe(1);
  });

  it('stretches the edge samples beyond the range', () => {
    const { buffer, rate } = nearestSample(set, 70);
    expect(buffer).toBe(set.get(66));
    expect(rate).toBeCloseTo(2 ** (4 / 12), 6);
  });
});
