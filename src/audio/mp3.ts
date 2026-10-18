import { Mp3Encoder } from '@breezystack/lamejs';

const BLOCK = 1152; // samples per MP3 frame

/** MP3 mono, constant bitrate. */
export function encodeMp3(samples: Float32Array, sampleRate: number, kbps = 128): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += BLOCK) chunks.push(encoder.encodeBuffer(pcm.subarray(i, i + BLOCK)));
  chunks.push(encoder.flush());
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
