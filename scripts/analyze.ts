/**
 * Re-analyzes recordings in recordings/ with the same settings as the app.
 *   npm run analyze -- [file.wav ...] [--sensitivity=0.5 --tolerance=0.7 --minNoteMs=100 --compensateTuning=0]
 *                      [--scaleMode=auto --quantize=1 --bpm=90 --grid=16] [--noProfile] [--frames]
 * Without a file, uses the latest recording. Without overrides, uses the recording's settings (.json) or the defaults.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, DEFAULT_SETTINGS, type AnalysisSettings } from '../src/audio/analysis';
import { keyName } from '../src/audio/music';
import { midiToName } from '../src/audio/noteNames';
import { extractFrames } from '../src/audio/pitch';
import { decodeWav } from '../src/audio/wav';

const args = process.argv.slice(2);
const overrides: Partial<Record<keyof AnalysisSettings, number | boolean | string>> = {};
for (const a of args) {
  const m = a.match(/^--(\w+)=(.+)$/);
  if (!m || !(m[1] in DEFAULT_SETTINGS)) continue;
  const key = m[1] as keyof AnalysisSettings;
  const kind = typeof DEFAULT_SETTINGS[key];
  overrides[key] = kind === 'boolean' ? m[2] !== '0' : kind === 'number' ? Number(m[2]) : m[2];
}
const showFrames = args.includes('--frames');
let files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  const wavs = readdirSync('recordings').filter((f) => f.endsWith('.wav')).sort();
  files = wavs.slice(-1).map((f) => join('recordings', f));
}

for (const file of files) {
  const metaPath = file.replace(/\.wav$/, '.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const settings: AnalysisSettings = { ...DEFAULT_SETTINGS, ...meta.settings, ...overrides };
  // --noProfile ignores the voice profile that was active in the app.
  const profile = args.includes('--noProfile') ? {} : (meta.profile ?? {});

  const { samples, sampleRate } = decodeWav(new Uint8Array(readFileSync(file)));
  const raw = extractFrames(samples, sampleRate);
  const r = analyze(raw, settings, profile);
  const voiced = r.frames.filter((f) => f.midi !== null).length;

  console.log(`\n== ${file}  (${(samples.length / sampleRate).toFixed(2)}s @ ${sampleRate} Hz)`);
  console.log('settings:', settings);
  if (Object.keys(profile).length) console.log('profile:', profile);
  console.log(
    `noise ${r.noiseFloor.toFixed(4)}  threshold ${r.threshold.toFixed(4)}  tuning ${(r.tuningOffset * 100).toFixed(0)} cents  voiced frames ${voiced}/${r.frames.length}`,
  );
  if (r.key) console.log(`key: ${keyName(r.key)}`);
  if (r.grid) console.log(`grid: origin ${r.grid.origin.toFixed(2)}s, step ${(r.grid.step * 1000).toFixed(0)} ms`);
  console.log(`${r.notes.length} notes: ${r.notes.map((n) => midiToName(n.midi)).join(' ')}`);
  for (const n of r.notes) {
    console.log(`  ${midiToName(n.midi).padEnd(4)} ${n.start.toFixed(2)}s  ${(n.duration * 1000).toFixed(0).padStart(5)}ms  vel ${n.velocity.toFixed(2)}`);
  }
  if (showFrames) {
    raw.forEach((f, i) => {
      const m = r.frames[i].midi;
      console.log(
        `  ${f.time.toFixed(3)}  rms ${f.rms.toFixed(4)}  hz ${f.hz.toFixed(1).padStart(6)}  cl ${f.clarity.toFixed(2)}  ${m === null ? '-' : `${m.toFixed(2)} ${midiToName(m)}`}`,
      );
    });
  }
}
