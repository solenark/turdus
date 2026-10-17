import { midiToHz } from '../src/audio/noteNames';

export const SR = 44100;

interface Part {
  midi: number | null;
  dur: number;
  vibratoCents?: number;
  /** Glides the pitch linearly up to midi + glide over the segment. */
  glide?: number;
  amp?: number;
}

/** Concatenates sine segments (midi null = silence) with continuous phase. */
export function synth(parts: Part[]): Float32Array {
  const total = parts.reduce((s, p) => s + Math.round(p.dur * SR), 0);
  const out = new Float32Array(total);
  let idx = 0;
  let phase = 0;
  for (const p of parts) {
    const n = Math.round(p.dur * SR);
    for (let i = 0; i < n; i++, idx++) {
      if (p.midi === null) continue;
      const cents = p.vibratoCents ? p.vibratoCents * Math.sin((2 * Math.PI * 5.5 * i) / SR) : 0;
      const glide = p.glide ? (p.glide * i) / n : 0;
      phase += (2 * Math.PI * midiToHz(p.midi + glide + cents / 100)) / SR;
      out[idx] = (p.amp ?? 0.5) * Math.sin(phase);
    }
  }
  return out;
}
