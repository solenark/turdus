import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_SETTINGS } from '../src/audio/analysis';
import { extractFrames } from '../src/audio/pitch';
import { SR, synth } from './helpers';

const run = (audio: Float32Array, settings = {}) => analyze(extractFrames(audio, SR), { ...DEFAULT_SETTINGS, ...settings });

describe('analyze', () => {
  it('does not split the note when the pitch rises at the end (real recording case)', () => {
    // Steady at 44.4, then rising ~0.6 semitone, like the first note of the real test.
    const { notes } = run(synth([{ midi: 44.4, dur: 0.4 }, { midi: 44.4, dur: 0.15, glide: 0.6 }]));
    expect(notes).toHaveLength(1);
  });

  it('ignores a faint sound (−28 dB) after the note', () => {
    const { notes } = run(synth([{ midi: 60, dur: 0.5 }, { midi: null, dur: 0.1 }, { midi: 58, dur: 0.6, amp: 0.02 }]));
    expect(notes.map((n) => n.midi)).toEqual([60]);
  });

  it('at maximum sensitivity the faint sound counts', () => {
    const { notes } = run(synth([{ midi: 60, dur: 0.5 }, { midi: null, dur: 0.1 }, { midi: 58, dur: 0.6, amp: 0.02 }]), {
      sensitivity: 1,
    });
    expect(notes.map((n) => n.midi)).toEqual([60, 58]);
  });

  it('measures and compensates a constant detuning', () => {
    const audio = synth([{ midi: 60.4, dur: 0.4 }, { midi: 62.4, dur: 0.4 }, { midi: 64.4, dur: 0.4 }]);
    const on = run(audio);
    expect(on.tuningOffset).toBeCloseTo(0.4, 1);
    expect(on.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(run(audio, { compensateTuning: false }).tuningOffset).toBe(0);
  });

  it('tolerance decides whether a 0.8 semitone slide becomes another note', () => {
    const audio = synth([{ midi: 60, dur: 0.4 }, { midi: 60.8, dur: 0.4 }]);
    expect(run(audio, { tolerance: 1, compensateTuning: false }).notes).toHaveLength(1);
    expect(run(audio, { tolerance: 0.5, compensateTuning: false }).notes).toHaveLength(2);
  });
});
