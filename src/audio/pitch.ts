import { PitchDetector } from 'pitchy';
import type { RawFrame } from './types';

export interface ExtractOptions {
  frameSize: number;
  hopSize: number;
}

export const DEFAULT_EXTRACT_OPTIONS: ExtractOptions = {
  frameSize: 2048,
  hopSize: 512,
};

/**
 * Heavy part of the analysis, done once per recording: frequency, clarity and energy of every frame,
 * unfiltered. Filtering and segmentation live in analysis.ts, which runs on every settings change.
 */
export function extractFrames(samples: Float32Array, sampleRate: number, opts: Partial<ExtractOptions> = {}): RawFrame[] {
  const o = { ...DEFAULT_EXTRACT_OPTIONS, ...opts };
  const detector = PitchDetector.forFloat32Array(o.frameSize);
  const frames: RawFrame[] = [];

  for (let start = 0; start + o.frameSize <= samples.length; start += o.hopSize) {
    const frame = samples.subarray(start, start + o.frameSize);
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    const [hz, clarity] = rms > 0 ? detector.findPitch(frame, sampleRate) : [0, 0];
    // A frame's time is its centre.
    frames.push({ time: (start + o.frameSize / 2) / sampleRate, hz, clarity, rms });
  }
  return frames;
}
