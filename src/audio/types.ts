/** Raw detector output for one frame: frequency (Hz), clarity (0..1) and energy. */
export interface RawFrame {
  time: number;
  hz: number;
  clarity: number;
  rms: number;
}

/** A filtered frame: time (s), pitch as fractional MIDI (null = unvoiced) and energy. */
export interface PitchFrame {
  time: number;
  midi: number | null;
  rms: number;
}

export interface Note {
  midi: number;
  /** Sung pitch (fractional MIDI) before rounding; used when snapping to a scale. */
  pitch?: number;
  start: number;
  duration: number;
  /** 0..1 */
  velocity: number;
}
