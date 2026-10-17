import { Midi } from '@tonejs/midi';
import type { Note } from '../audio/types';

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

/** Uses the native share sheet when available (iOS); otherwise downloads the file. */
export async function saveMidi(data: Uint8Array, filename = 'turdus.mid'): Promise<void> {
  const file = new File([data as Uint8Array<ArrayBuffer>], filename, { type: 'audio/midi' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
