import { describe, expect, it } from 'vitest';
import { extractFrames } from '../src/audio/pitch';
import { analyze, DEFAULT_SETTINGS } from '../src/audio/analysis';
import { SR, synth } from './helpers';

const notesOf = (audio: Float32Array, settings = DEFAULT_SETTINGS) => analyze(extractFrames(audio, SR), settings).notes;

describe('segmentNotes', () => {
  it('splits C4-E4-G4 into three notes with correct timing', () => {
    const notes = notesOf(synth([{ midi: 60, dur: 0.5 }, { midi: 64, dur: 0.5 }, { midi: 67, dur: 0.5 }]));
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    notes.forEach((n, i) => {
      expect(Math.abs(n.start - i * 0.5)).toBeLessThan(0.03);
      expect(Math.abs(n.duration - 0.5)).toBeLessThan(0.03 * 2);
    });
  });

  it('keeps a single note with ±40 cent vibrato', () => {
    const notes = notesOf(synth([{ midi: 69, dur: 1, vibratoCents: 40 }]));
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(69);
  });

  it('separates equal notes across a long pause and ignores silence', () => {
    const notes = notesOf(synth([{ midi: 62, dur: 0.4 }, { midi: null, dur: 0.3 }, { midi: 62, dur: 0.4 }]));
    expect(notes.map((n) => n.midi)).toEqual([62, 62]);
  });

  it('produces no notes for silence', () => {
    expect(notesOf(new Float32Array(SR))).toEqual([]);
  });
});
