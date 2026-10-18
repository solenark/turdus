import { Midi } from '@tonejs/midi';
import type { Note } from '../audio/types';
import { saveFile } from '../saveFile';

/** `offset` (s) is subtracted from every time, e.g. so the MIDI starts on the first grid beat. */
export function notesToMidi(notes: Note[], bpm = 120, offset = 0): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.name = 'Turdus';
  const track = midi.addTrack();
  track.name = 'Voz';
  for (const n of notes) {
    track.addNote({ midi: n.midi, time: Math.max(0, n.start - offset), duration: n.duration, velocity: n.velocity });
  }
  return midi.toArray();
}

export function saveMidi(data: Uint8Array, filename = 'turdus.mid'): Promise<void> {
  return saveFile(data, filename, 'audio/midi');
}
