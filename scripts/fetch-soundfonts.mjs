// One-off: downloads FluidR3 GM samples (gleitz/midi-js-soundfonts) into public/soundfonts/<id>/<midi>.mp3.
// Run with `node scripts/fetch-soundfonts.mjs`; the output is committed, so this only reruns to change the list.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM';
// App id -> soundfont name (keep in sync with src/audio/instruments.ts).
const INSTRUMENTS = {
  piano: 'acoustic_grand_piano',
  epiano: 'electric_piano_1',
  guitar: 'acoustic_guitar_nylon',
  marimba: 'marimba',
  organ: 'drawbar_organ',
  strings: 'string_ensemble_1',
  flute: 'flute',
  sax: 'alto_sax',
};
// Every 3 semitones, C2..C7.
const NOTES = Array.from({ length: 21 }, (_, i) => 36 + 3 * i);
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

const out = resolve(import.meta.dirname, '../public/soundfonts');

for (const [id, name] of Object.entries(INSTRUMENTS)) {
  const res = await fetch(`${BASE}/${name}-mp3.js`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const js = await res.text();
  mkdirSync(resolve(out, id), { recursive: true });
  let bytes = 0;
  for (const m of NOTES) {
    const match = js.match(new RegExp(`"${noteName(m)}":\\s*"data:audio/mp3;base64,([^"]+)"`));
    if (!match) throw new Error(`${name}: missing ${noteName(m)}`);
    const data = Buffer.from(match[1], 'base64');
    writeFileSync(resolve(out, id, `${m}.mp3`), data);
    bytes += data.length;
  }
  console.log(`${id}: ${NOTES.length} samples, ${(bytes / 1024).toFixed(0)} KB`);
}
