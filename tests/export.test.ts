import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { notesToMidi } from '../src/midi/export';

describe('notesToMidi', () => {
  it('writes a MIDI file that reads back with the same notes', () => {
    const notes = [
      { midi: 60, start: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, start: 0.5, duration: 0.25, velocity: 0.6 },
    ];
    const track = new Midi(notesToMidi(notes)).tracks[0];
    expect(track.notes.map((n) => n.midi)).toEqual([60, 64]);
    track.notes.forEach((n, i) => {
      expect(n.time).toBeCloseTo(notes[i].start, 2);
      expect(n.duration).toBeCloseTo(notes[i].duration, 2);
    });
  });

  it('sets the GM instrument program', () => {
    const notes = [{ midi: 60, start: 0, duration: 0.5, velocity: 0.8 }];
    expect(new Midi(notesToMidi(notes, 120, 0, 73)).tracks[0].instrument.number).toBe(73);
  });
});
