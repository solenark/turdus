import { useRef } from 'react';
import { FIT_KEYS, type AnalysisResult, type AnalysisSettings } from '../audio/analysis';
import { keyName, ROOT_OPTIONS, type GridDivision, type ScaleType } from '../audio/music';

interface Props {
  settings: AnalysisSettings;
  /** Absent on the settings screen (there is no recording). */
  analysis?: AnalysisResult;
  onChange(settings: AnalysisSettings): void;
  /** On the result screen: saved defaults, for "restore" and "save as default". */
  defaults?: AnalysisSettings;
  onSaveDefaults?(): void;
}

const SCALE_MODES: { value: AnalysisSettings['scaleMode']; label: string }[] = [
  { value: 'off', label: 'Desligado' },
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Escolher' },
];
const GRIDS: { value: GridDivision; label: string }[] = [
  { value: 4, label: '1/4' },
  { value: 8, label: '1/8' },
  { value: 16, label: '1/16' },
];
const MIN_BPM = 40;
const MAX_BPM = 240;
const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

/** "Fit" tab: snaps notes to a scale and/or aligns timing to a rhythmic grid. */
export function FitPanel({ settings, analysis, onChange, defaults, onSaveDefaults }: Props) {
  const set = (patch: Partial<AnalysisSettings>) => onChange({ ...settings, ...patch });
  const taps = useRef<number[]>([]);
  const isSaved = !!defaults && FIT_KEYS.every((k) => settings[k] === defaults[k]);

  // Tap tempo: average interval between the latest taps (a pause > 2 s restarts the count).
  function tap() {
    const now = performance.now();
    const last = taps.current[taps.current.length - 1];
    if (last !== undefined && now - last > 2000) taps.current = [];
    const list = (taps.current = [...taps.current, now].slice(-6));
    if (list.length >= 2) set({ bpm: clampBpm((60000 * (list.length - 1)) / (now - list[0])), quantize: true });
  }

  return (
    <div className="fit">
      <div className="fit-row">
        <span className="slider-label">Escala</span>
        <div className="segmented segmented-small" role="radiogroup" aria-label="Escala">
          {SCALE_MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={settings.scaleMode === m.value}
              className={settings.scaleMode === m.value ? 'is-active' : ''}
              onClick={() => set({ scaleMode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fit-row fit-sub">
        {settings.scaleMode === 'manual' ? (
          <>
            <select value={settings.scaleRoot} onChange={(e) => set({ scaleRoot: Number(e.target.value) })} aria-label="Tônica">
              {ROOT_OPTIONS.map((o) => (
                <option key={o.root} value={o.root}>{o.name}</option>
              ))}
            </select>
            <select value={settings.scaleType} onChange={(e) => set({ scaleType: e.target.value as ScaleType })} aria-label="Modo">
              <option value="major">maior</option>
              <option value="minor">menor</option>
            </select>
          </>
        ) : (
          <span className="muted">
            {settings.scaleMode === 'auto'
              ? !analysis
                ? 'Detectada a cada gravação'
                : analysis.key
                  ? `Detectada: ${keyName(analysis.key)}`
                  : 'Nenhuma nota para detectar'
              : 'Notas como foram cantadas (cromático)'}
          </span>
        )}
      </div>

      <div className="fit-row">
        <label className="fit-check">
          <input type="checkbox" checked={settings.quantize} onChange={(e) => set({ quantize: e.target.checked })} />
          <span className="slider-label">Ritmo</span>
        </label>
        <div className="bpm">
          <button className="bpm-btn" onClick={() => set({ bpm: clampBpm(settings.bpm - 1) })} aria-label="Diminuir BPM">−</button>
          <input
            className="bpm-input"
            type="number" inputMode="numeric" min={MIN_BPM} max={MAX_BPM}
            value={settings.bpm}
            onChange={(e) => e.target.value && set({ bpm: clampBpm(Number(e.target.value)) })}
            aria-label="BPM"
          />
          <button className="bpm-btn" onClick={() => set({ bpm: clampBpm(settings.bpm + 1) })} aria-label="Aumentar BPM">+</button>
          <button className="bpm-btn bpm-tap" onClick={tap}>Tap</button>
        </div>
      </div>

      <div className="fit-row">
        <span className="slider-label">Grade</span>
        <div className="segmented segmented-small" role="radiogroup" aria-label="Grade rítmica">
          {GRIDS.map((g) => (
            <button
              key={g.value}
              role="radio"
              aria-checked={settings.grid === g.value}
              className={settings.grid === g.value ? 'is-active' : ''}
              disabled={!settings.quantize}
              onClick={() => set({ grid: g.value })}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-footer">
        <span className="muted dock-hint">O MIDI usa {settings.bpm} BPM{settings.quantize ? ' e começa na 1ª nota' : ''}.</span>
        {defaults && onSaveDefaults && (
          <span className="settings-actions">
            <button
              className="link-btn"
              disabled={isSaved}
              onClick={() => set(Object.fromEntries(FIT_KEYS.map((k) => [k, defaults[k]])))}
            >
              Restaurar
            </button>
            <button className="link-btn" disabled={isSaved} onClick={onSaveDefaults}>
              Salvar como padrão
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
