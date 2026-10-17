let ctx: AudioContext | null = null;

/** Shared AudioContext; must first be called from a user gesture (iOS requirement). */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
