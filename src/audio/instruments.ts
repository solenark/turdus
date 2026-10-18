import { getAudioContext } from './context';

export type InstrumentId = 'simple' | 'piano' | 'epiano' | 'guitar' | 'marimba' | 'organ' | 'strings' | 'flute' | 'sax';

export interface Instrument {
  id: InstrumentId;
  label: string;
  /** General MIDI program (0-based), written to the exported MIDI. */
  program: number;
  /** Plays recorded samples from public/soundfonts/<id>/; otherwise the built-in triangle synth. */
  samples: boolean;
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'simple', label: 'Simples', program: 80, samples: false },
  { id: 'piano', label: 'Piano', program: 0, samples: true },
  { id: 'epiano', label: 'Piano elétrico', program: 4, samples: true },
  { id: 'guitar', label: 'Violão', program: 24, samples: true },
  { id: 'marimba', label: 'Marimba', program: 12, samples: true },
  { id: 'organ', label: 'Órgão', program: 16, samples: true },
  { id: 'strings', label: 'Cordas', program: 48, samples: true },
  { id: 'flute', label: 'Flauta', program: 73, samples: true },
  { id: 'sax', label: 'Sax', program: 65, samples: true },
];

export const getInstrument = (id: string): Instrument => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

/** MIDI notes that have a sample: every 3 semitones, C2..C7 (keep in sync with scripts/fetch-soundfonts.mjs). */
export const SAMPLE_NOTES = Array.from({ length: 21 }, (_, i) => 36 + 3 * i);

/** Decoded samples by MIDI note. */
export type SampleSet = Map<number, AudioBuffer>;

/** The closest sample to `midi`, and the playback rate that retunes it. */
export function nearestSample(set: SampleSet, midi: number): { buffer: AudioBuffer; rate: number } {
  let best = -1;
  for (const m of set.keys()) if (best < 0 || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  return { buffer: set.get(best)!, rate: 2 ** ((midi - best) / 12) };
}

const cache = new Map<InstrumentId, Promise<SampleSet>>();

/** Fetches and decodes an instrument's samples once; `null` for the built-in synth. */
export function loadSamples(id: InstrumentId): Promise<SampleSet | null> {
  if (!getInstrument(id).samples) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    const ctx = getAudioContext();
    p = Promise.all(
      SAMPLE_NOTES.map(async (m) => {
        const res = await fetch(`${import.meta.env.BASE_URL}soundfonts/${id}/${m}.mp3`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return [m, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
      }),
    ).then((entries) => new Map(entries));
    // A failed load (e.g. offline before first use) can be retried later.
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
