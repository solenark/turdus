import { describe, expect, it } from 'vitest';
import { encodeMp3 } from '../src/audio/mp3';

describe('encodeMp3', () => {
  it('encodes a sine into MPEG audio frames of the expected size', () => {
    const sr = 44100;
    const samples = Float32Array.from({ length: sr }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));
    const mp3 = encodeMp3(samples, sr, 128);
    // Frame sync: 11 set bits.
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    // 1 s at 128 kbps ≈ 16 KB.
    expect(mp3.length).toBeGreaterThan(14_000);
    expect(mp3.length).toBeLessThan(18_000);
  });
});
