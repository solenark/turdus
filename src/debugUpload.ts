import { encodeWav } from './audio/wav';
import type { Note } from './audio/types';
import type { AnalysisSettings, VoiceProfile } from './audio/analysis';

const post = (id: string, ext: string, body: BodyInit) =>
  fetch(`/api/recordings?id=${id}&ext=${ext}`, { method: 'POST', body }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });

/** Uploads the audio to the dev server (recordings/) and returns the recording id. */
export async function uploadDebugRecording(samples: Float32Array, sampleRate: number): Promise<string> {
  const id = `rec-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  await post(id, 'wav', encodeWav(samples, sampleRate) as Uint8Array<ArrayBuffer>);
  return id;
}

/** Writes (or rewrites) the .json with the settings and notes currently on screen. */
export function saveDebugMeta(
  id: string,
  settings: AnalysisSettings,
  profile: VoiceProfile | null,
  notes: Note[],
  edited: boolean,
): Promise<void> {
  const meta = { id, savedAt: new Date().toISOString(), userAgent: navigator.userAgent, settings, profile, edited, notes };
  return post(id, 'json', JSON.stringify(meta, null, 2));
}
