import { getAudioContext } from './context';
import { midiToHz } from './noteNames';
import type { Note } from './types';

export type PlaybackMode = 'notes' | 'original' | 'both';

export interface Playback {
  /** Current position in seconds. */
  position(): number;
  stop(): void;
}

export function play(notes: Note[], original: AudioBuffer, mode: PlaybackMode, onEnd: () => void): Playback {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const nodes: AudioScheduledSourceNode[] = [];

  if (mode !== 'notes') {
    const src = ctx.createBufferSource();
    src.buffer = original;
    const g = ctx.createGain();
    g.gain.value = mode === 'both' ? 0.6 : 1;
    src.connect(g).connect(master);
    src.start(t0);
    nodes.push(src);
  }

  if (mode !== 'original') {
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
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(end + 0.01);
      nodes.push(osc);
    }
  }

  const lastNoteEnd = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const length = mode === 'notes' ? lastNoteEnd : Math.max(original.duration, mode === 'both' ? lastNoteEnd : 0);
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
