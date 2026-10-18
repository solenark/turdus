import { getAudioContext } from './context';
import { nearestSample, type SampleSet } from './instruments';
import { midiToHz } from './noteNames';
import type { Note } from './types';

export type PlaybackMode = 'notes' | 'original' | 'both';

export interface Playback {
  /** Current position in seconds. */
  position(): number;
  stop(): void;
}

/** Fade-out after each sampled note ends. */
const RELEASE = 0.15;

/** Length in seconds of what `mode` plays. */
function mixLength(notes: Note[], original: AudioBuffer, mode: PlaybackMode): number {
  const lastNoteEnd = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0) + (notes.length ? RELEASE : 0);
  return mode === 'notes' ? lastNoteEnd : Math.max(original.duration, mode === 'both' ? lastNoteEnd : 0);
}

/** Schedules the mix on any context (live or offline), starting at `t0`. `voice` null = built-in triangle synth. */
function schedule(
  ctx: BaseAudioContext,
  dest: AudioNode,
  notes: Note[],
  original: AudioBuffer,
  mode: PlaybackMode,
  voice: SampleSet | null,
  t0: number,
): AudioScheduledSourceNode[] {
  const nodes: AudioScheduledSourceNode[] = [];

  if (mode !== 'notes') {
    const src = ctx.createBufferSource();
    src.buffer = original;
    const g = ctx.createGain();
    g.gain.value = mode === 'both' ? 0.6 : 1;
    src.connect(g).connect(dest);
    src.start(t0);
    nodes.push(src);
  }

  if (mode !== 'original' && voice) {
    for (const n of notes) {
      const { buffer, rate } = nearestSample(voice, n.midi);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const env = ctx.createGain();
      const start = t0 + n.start;
      const end = start + n.duration;
      const peak = 0.8 * n.velocity;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak, start + 0.005);
      env.gain.setValueAtTime(peak, Math.max(start + 0.005, end));
      env.gain.linearRampToValueAtTime(0, end + RELEASE);
      src.connect(env).connect(dest);
      src.start(start);
      src.stop(end + RELEASE + 0.01);
      nodes.push(src);
    }
  } else if (mode !== 'original') {
    for (const n of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(n.midi);
      const env = ctx.createGain();
      const start = t0 + n.start;
      const end = start + n.duration;
      const peak = 0.35 * n.velocity;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak, start + 0.015);
      env.gain.setValueAtTime(peak, Math.max(start + 0.015, end - 0.03));
      env.gain.linearRampToValueAtTime(0, end);
      osc.connect(env).connect(dest);
      osc.start(start);
      osc.stop(end + 0.01);
      nodes.push(osc);
    }
  }

  return nodes;
}

export function play(
  notes: Note[],
  original: AudioBuffer,
  mode: PlaybackMode,
  voice: SampleSet | null,
  onEnd: () => void,
): Playback {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const nodes = schedule(ctx, master, notes, original, mode, voice, t0);

  const length = mixLength(notes, original, mode);
  let stopped = false;
  const timer = setTimeout(() => finish(), (length + 0.1) * 1000);

  function finish() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    nodes.forEach((n) => {
      try {
        n.stop(ctx.currentTime + 0.05);
      } catch {
        /* already stopped */
      }
    });
    setTimeout(() => master.disconnect(), 100);
    onEnd();
  }

  return {
    position: () => Math.max(0, ctx.currentTime - t0),
    stop: finish,
  };
}

/** Renders exactly what `play` would play, faster than real time, to a mono buffer. */
export async function renderMix(
  notes: Note[],
  original: AudioBuffer,
  mode: PlaybackMode,
  voice: SampleSet | null,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil((mixLength(notes, original, mode) + 0.05) * sampleRate));
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  schedule(ctx, ctx.destination, notes, original, mode, voice, 0);
  return ctx.startRendering();
}
