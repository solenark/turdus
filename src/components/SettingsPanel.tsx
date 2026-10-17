import { useState } from 'react';
import { DETECTION_KEYS, type AnalysisResult, type AnalysisSettings } from '../audio/analysis';

interface Props {
  settings: AnalysisSettings;
  /** Absent on the settings screen (there is no recording). */
  analysis?: AnalysisResult;
  hasEdits?: boolean;
  onChange(settings: AnalysisSettings): void;
  /** On the result screen: saved defaults, for "restore" and "save as default". */
  defaults?: AnalysisSettings;
  onSaveDefaults?(): void;
}

const sensitivityLabel = (s: number) => (s < 0.34 ? 'baixa' : s < 0.67 ? 'média' : 'alta');
const sameDetection = (a: AnalysisSettings, b: AnalysisSettings) => DETECTION_KEYS.every((k) => a[k] === b[k]);

interface SliderProps {
  label: string;
  help: string;
  showHelp: boolean;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
}

function Slider({ label, help, showHelp, value, display, min, max, step, onChange }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{display}</span>
      {showHelp && <span className="slider-help">{help}</span>}
    </label>
  );
}

export function SettingsPanel({ settings, analysis, hasEdits, onChange, defaults, onSaveDefaults }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const set = <K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const cents = Math.round((analysis?.tuningOffset ?? 0) * 100);
  const tuningStatus = !settings.compensateTuning
    ? 'Lá = 440 Hz'
    : !analysis
      ? 'ligada'
      : cents === 0
      ? 'sem desvio constante'
      : `${cents > 0 ? '+' : '−'}${Math.abs(cents)} cents compensados`;

  return (
    <div className="settings">
      <Slider
        label="Sensibilidade"
        help="Mais alta capta sons fracos; mais baixa ignora ruído do ambiente."
        showHelp={showHelp}
        value={settings.sensitivity}
        display={sensitivityLabel(settings.sensitivity)}
        min={0} max={1} step={0.05}
        onChange={(v) => set('sensitivity', v)}
      />
      <Slider
        label="Tolerância"
        help="Quanto a voz pode variar sem virar outra nota. Mais flexível junta vibrato e deslizes."
        showHelp={showHelp}
        value={settings.tolerance}
        display={`±${Math.round(settings.tolerance * 100)}¢`}
        min={0.4} max={1} step={0.05}
        onChange={(v) => set('tolerance', v)}
      />
      <Slider
        label="Duração mín."
        help="Trechos mais curtos que isso são juntados à nota vizinha."
        showHelp={showHelp}
        value={settings.minNoteMs}
        display={`${settings.minNoteMs} ms`}
        min={50} max={300} step={10}
        onChange={(v) => set('minNoteMs', v)}
      />
      <label className="slider slider-switch">
        <span className="slider-label">Afinação</span>
        <span className="slider-status">{tuningStatus}</span>
        <input type="checkbox" checked={settings.compensateTuning} onChange={(e) => set('compensateTuning', e.target.checked)} />
        {showHelp && (
          <span className="slider-help">Compensa um desvio constante da sua voz em relação à afinação padrão.</span>
        )}
      </label>

      <div className="settings-footer">
        <button className="link-btn" onClick={() => setShowHelp(!showHelp)}>
          {showHelp ? 'Ocultar explicações' : 'O que é cada ajuste?'}
        </button>
        {hasEdits && <span className="settings-warning">Mudar um ajuste descarta as edições</span>}
        {defaults && onSaveDefaults && (
          <span className="settings-actions">
            <button
              className="link-btn"
              disabled={sameDetection(settings, defaults)}
              onClick={() => onChange({ ...settings, ...Object.fromEntries(DETECTION_KEYS.map((k) => [k, defaults[k]])) })}
            >
              Restaurar
            </button>
            <button className="link-btn" disabled={sameDetection(settings, defaults)} onClick={onSaveDefaults}>
              Salvar como padrão
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
