import type { PlaybackMode } from '../audio/player';

const MODES: { value: PlaybackMode; label: string }[] = [
  { value: 'notes', label: 'Notas' },
  { value: 'original', label: 'Voz' },
  { value: 'both', label: 'Ambos' },
];

interface Props {
  mode: PlaybackMode;
  onModeChange(mode: PlaybackMode): void;
  onExport(): void;
}

/** "Listen" tab: what to play, and export. Play/stop lives in the tab bar, always visible. */
export function PlaybackControls({ mode, onModeChange, onExport }: Props) {
  return (
    <div className="controls">
      <span className="controls-label">O que tocar</span>
      <div className="segmented" role="radiogroup" aria-label="O que tocar">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mode === m.value}
            className={mode === m.value ? 'is-active' : ''}
            onClick={() => onModeChange(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button className="btn" onClick={onExport}>
        ⬇ Exportar MIDI
      </button>
    </div>
  );
}
