const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** e.g. "D#4", or "Eb4" with `flats`. */
export function midiToName(midi: number, flats = false): string {
  const m = Math.round(midi);
  return `${(flats ? FLATS : SHARPS)[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Melody as plain text, in time order: "C4 D#4 E4 F4 A4 C5". */
export function notesToText(notes: { midi: number; start: number }[], flats = false): string {
  return [...notes].sort((a, b) => a.start - b.start).map((n) => midiToName(n.midi, flats)).join(' ');
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
