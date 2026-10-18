import { describe, expect, it } from 'vitest';
import { keyName, usesFlats } from '../src/audio/music';
import { midiToName, notesToText } from '../src/audio/noteNames';

describe('note names', () => {
  it('names notes with octave, sharps by default', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69.3)).toBe('A4');
    expect(midiToName(63)).toBe('D#4');
    expect(midiToName(63, true)).toBe('Eb4');
  });

  it('writes the melody as text in time order', () => {
    const notes = [60, 63, 64, 65, 69, 72].map((midi, i) => ({ midi, start: i * 0.5 }));
    expect(notesToText(notes)).toBe('C4 D#4 E4 F4 A4 C5');
    expect(notesToText([...notes].reverse())).toBe('C4 D#4 E4 F4 A4 C5');
    expect(notesToText(notes, true)).toBe('C4 Eb4 E4 F4 A4 C5');
    expect(notesToText([])).toBe('');
  });

  it('spells with flats only in flat keys', () => {
    expect(usesFlats({ root: 5, type: 'major' })).toBe(true); // F major
    expect(usesFlats({ root: 0, type: 'minor' })).toBe(true); // C minor (Eb major)
    expect(usesFlats({ root: 2, type: 'minor' })).toBe(true); // D minor (F major)
    expect(usesFlats({ root: 0, type: 'major' })).toBe(false); // C major
    expect(usesFlats({ root: 7, type: 'major' })).toBe(false); // G major
    expect(usesFlats({ root: 4, type: 'minor' })).toBe(false); // E minor (G major)
  });
});

describe('key names', () => {
  it('spell the tonic like the key signature', () => {
    expect(keyName({ root: 10, type: 'major' })).toBe('Sib maior');
    expect(keyName({ root: 3, type: 'major' })).toBe('Mib maior');
    expect(keyName({ root: 1, type: 'minor' })).toBe('Dó# menor');
    expect(keyName({ root: 6, type: 'major' })).toBe('Fá# maior');
  });
});
