import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { analyze, DEFAULT_SETTINGS } from '../src/audio/analysis';
import { detectKey, keyName, makeGrid, quantize, snapToScale } from '../src/audio/music';
import { extractFrames } from '../src/audio/pitch';
import type { Note } from '../src/audio/types';
import { notesToMidi } from '../src/midi/export';
import { SR, synth } from './helpers';

const note = (midi: number, start: number, duration: number, pitch = midi): Note => ({ midi, pitch, start, duration, velocity: 0.8 });

describe('scale', () => {
  it('detects C major from a C major scale', () => {
    const notes = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => note(m, i * 0.3, 0.3));
    expect(keyName(detectKey(notes)!)).toBe('Dó maior');
  });

  it('detects A minor when A is the tonic', () => {
    const notes = [57, 59, 60, 62, 64, 65, 67, 69, 57, 64, 57].map((m, i) => note(m, i * 0.3, m === 57 ? 0.9 : 0.3));
    expect(keyName(detectKey(notes)!)).toBe('Lá menor');
  });

  it('snaps a note to the scale degree closest to the sung pitch', () => {
    const key = { root: 0, type: 'major' as const };
    // C#4 sung sharp (61.2) → D; sung flat (60.8) → C.
    expect(snapToScale([note(61, 0, 0.3, 61.2)], key)[0].midi).toBe(62);
    expect(snapToScale([note(61, 0, 0.3, 60.8)], key)[0].midi).toBe(60);
    // Notes already in the scale are unchanged.
    expect(snapToScale([note(64, 0, 0.3, 64.3)], key)[0].midi).toBe(64);
  });
});

describe('rhythm', () => {
  it('aligns start and duration to the grid starting at the first note', () => {
    // 120 BPM, 1/8 grid → 0.25 s step.
    const notes = [note(60, 1.03, 0.46), note(62, 1.52, 0.2), note(64, 1.98, 0.55)];
    const grid = makeGrid(notes, 120, 8)!;
    expect(grid.step).toBeCloseTo(0.25);
    const q = quantize(notes, grid);
    expect(q.map((n) => +(n.start - grid.origin).toFixed(3))).toEqual([0, 0.5, 1]);
    expect(q.map((n) => +n.duration.toFixed(3))).toEqual([0.5, 0.25, 0.5]);
  });

  it('a very short note takes at least one step and does not overlap the next', () => {
    const notes = [note(60, 0, 0.6), note(62, 0.55, 0.05)];
    const q = quantize(notes, makeGrid(notes, 120, 8)!);
    expect(q[0].start + q[0].duration).toBeLessThanOrEqual(q[1].start + 1e-9);
    expect(q[1].duration).toBeCloseTo(0.25);
  });

  it('two notes on the same grid point keep only the longer one', () => {
    const notes = [note(60, 0, 0.5), note(62, 0.5, 0.06), note(64, 0.6, 0.4)];
    const q = quantize(notes, makeGrid(notes, 120, 8)!);
    expect(q.map((n) => n.midi)).toEqual([60, 64]);
  });
});

describe('fit within analysis', () => {
  const audio = synth([{ midi: 60, dur: 0.4 }, { midi: 61.3, dur: 0.4 }, { midi: 64, dur: 0.4 }]);
  const raw = extractFrames(audio, SR);

  it('keeps notes as sung when off', () => {
    expect(analyze(raw, DEFAULT_SETTINGS).notes.map((n) => n.midi)).toEqual([60, 61, 64]);
  });

  it('with a chosen key, an out-of-scale note moves to the closest degree', () => {
    const r = analyze(raw, { ...DEFAULT_SETTINGS, compensateTuning: false, scaleMode: 'manual', scaleRoot: 0, scaleType: 'major' });
    expect(r.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(r.key).toEqual({ root: 0, type: 'major' });
  });

  it('with rhythm on, the exported MIDI starts on the first beat and uses the BPM', () => {
    const r = analyze(raw, { ...DEFAULT_SETTINGS, quantize: true, bpm: 150, grid: 8 });
    const midi = new Midi(notesToMidi(r.notes, 150, r.grid!.origin));
    expect(midi.header.tempos[0].bpm).toBeCloseTo(150);
    expect(midi.tracks[0].notes[0].time).toBeCloseTo(0, 3);
    // 150 BPM, 1/8 → 0.2 s: the 0.4 s notes land on 0 / 0.4 / 0.8.
    expect(midi.tracks[0].notes.map((n) => +n.time.toFixed(2))).toEqual([0, 0.4, 0.8]);
  });
});
