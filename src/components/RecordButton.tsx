import { MAX_RECORDING_SECONDS } from '../audio/recorder';

interface Props {
  recording: boolean;
  disabled: boolean;
  level: number;
  elapsed: number;
  onStart(): void;
  onStop(): void;
  maxSeconds?: number;
  /** Hint shown before recording starts. */
  idleHint?: string;
}

/** Large record button, used on the start screen and while recording. */
export function RecordButton({
  recording, disabled, level, elapsed, onStart, onStop,
  maxSeconds = MAX_RECORDING_SECONDS,
  idleHint = `Toque para cantar (até ${MAX_RECORDING_SECONDS}s)`,
}: Props) {
  const remaining = Math.ceil(maxSeconds - elapsed);
  return (
    <div className="record">
      <button
        className={`record-btn${recording ? ' is-recording' : ''}`}
        style={{ '--level': Math.min(1, level * 1.5) } as React.CSSProperties}
        disabled={disabled}
        onClick={recording ? onStop : onStart}
        aria-label={recording ? 'Parar gravação' : 'Gravar'}
      >
        <span className="record-icon" />
      </button>
      <p className="record-hint">
        {recording ? `Gravando… ${remaining}s restantes` : idleHint}
      </p>
      {recording && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${(elapsed / maxSeconds) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** Compact version for the top bar, once a recording is on screen. */
export function RecordButtonSmall({ onStart }: { onStart(): void }) {
  return (
    <button className="record-small" onClick={onStart} aria-label="Gravar de novo">
      <span className="record-small-dot" /> Gravar
    </button>
  );
}
