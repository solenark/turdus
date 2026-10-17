import { getAudioContext } from './context';

export const MAX_RECORDING_SECONDS = 15;

export interface Recording {
  buffer: AudioBuffer;
  /** Mono channel used for analysis. */
  samples: Float32Array;
}

export interface RecorderHandle {
  stop(): void;
  done: Promise<Recording>;
}

/**
 * Starts recording from the microphone. `onLevel` receives the level (0..1) and elapsed time.
 * Stops by itself at `maxSeconds`.
 */
export async function startRecording(
  onLevel: (level: number, elapsed: number) => void,
  maxSeconds = MAX_RECORDING_SECONDS,
): Promise<RecorderHandle> {
  const ctx = getAudioContext();
  // No browser processing: noise suppression and AGC distort the pitch.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  const levelBuf = new Float32Array(analyser.fftSize);

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const startedAt = performance.now();
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(levelBuf);
    let peak = 0;
    for (const v of levelBuf) peak = Math.max(peak, Math.abs(v));
    const elapsed = (performance.now() - startedAt) / 1000;
    onLevel(peak, Math.min(elapsed, maxSeconds));
    if (elapsed >= maxSeconds) handle.stop();
    else raf = requestAnimationFrame(tick);
  };

  const done = new Promise<Recording>((resolve, reject) => {
    recorder.onstop = async () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        resolve({ buffer, samples: toMono(buffer) });
      } catch (e) {
        reject(e);
      }
    };
  });

  const handle: RecorderHandle = {
    stop: () => recorder.state !== 'inactive' && recorder.stop(),
    done,
  };
  recorder.start();
  raf = requestAnimationFrame(tick);
  return handle;
}

function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}
