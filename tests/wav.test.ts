import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav } from '../src/audio/wav';
import { SR, synth } from './helpers';

describe('wav', () => {
  it('round-trips encode/decode without losing the signal', () => {
    const audio = synth([{ midi: 69, dur: 0.1 }]);
    const { samples, sampleRate } = decodeWav(encodeWav(audio, SR));
    expect(sampleRate).toBe(SR);
    expect(samples.length).toBe(audio.length);
    for (let i = 0; i < audio.length; i += 97) expect(samples[i]).toBeCloseTo(audio[i], 3);
  });
});
