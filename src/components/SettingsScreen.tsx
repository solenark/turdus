import { useState } from 'react';
import { DEFAULT_SETTINGS, type AnalysisSettings } from '../audio/analysis';
import { toDb } from '../audio/calibration';
import { midiToName } from '../audio/noteNames';
import type { StoredProfile } from '../storage';
import { FitPanel } from './FitPanel';
import { SettingsPanel } from './SettingsPanel';

interface Props {
  defaults: AnalysisSettings;
  profile: StoredProfile | null;
  onChangeDefaults(settings: AnalysisSettings): void;
  onCalibrate(): void;
  onDeleteProfile(): void;
  onClose(): void;
}

/** Two-tap destructive action: the first tap asks for confirmation. */
function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm(): void }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="confirm">
      <button className="btn btn-danger" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
      <button className="btn" onClick={() => setArmed(false)}>Cancelar</button>
    </span>
  ) : (
    <button className="btn" onClick={() => setArmed(true)}>{label}</button>
  );
}

export function SettingsScreen({ defaults, profile, onChangeDefaults, onCalibrate, onDeleteProfile, onClose }: Props) {
  const isFactory = (Object.keys(DEFAULT_SETTINGS) as (keyof AnalysisSettings)[]).every((k) => defaults[k] === DEFAULT_SETTINGS[k]);
  const hasRange = profile?.minMidi !== undefined && profile?.maxMidi !== undefined;

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="link-btn" onClick={onClose}>← Voltar</button>
        <span className="muted">Configurações</span>
      </header>

      <div className="screen-body">
        <section className="card">
          <h2>Perfil de voz</h2>
          {profile ? (
            <>
              <ul className="calib-summary">
                <li>Extensão vocal: <strong>{hasRange ? `${midiToName(profile.minMidi!)} a ${midiToName(profile.maxMidi!)}` : '—'}</strong></li>
                <li>Ruído do ambiente: <strong>{profile.noiseRms !== undefined ? `${toDb(profile.noiseRms).toFixed(0)} dB` : '—'}</strong></li>
                <li className="muted">Calibrado em {new Date(profile.calibratedAt).toLocaleDateString('pt-BR')}</li>
              </ul>
              <div className="card-actions">
                <button className="btn" onClick={onCalibrate}>Refazer calibração</button>
                <ConfirmButton label="Apagar perfil" confirmLabel="Apagar" onConfirm={onDeleteProfile} />
              </div>
            </>
          ) : (
            <>
              <p className="muted card-text">
                Opcional. Em 3 passos rápidos o app mede o ruído do seu ambiente e a sua extensão vocal, e passa a errar menos
                (principalmente oitavas e ruídos). Sem perfil, ele se adapta sozinho a cada gravação.
              </p>
              <div className="card-actions">
                <button className="btn btn-primary" onClick={onCalibrate}>Calibrar minha voz</button>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2>Padrões de detecção</h2>
          <p className="muted card-text">Usados em toda gravação nova. Na tela de resultado você ainda pode ajustar cada gravação.</p>
          <SettingsPanel settings={defaults} onChange={onChangeDefaults} />
        </section>

        <section className="card">
          <h2>Padrões de encaixe</h2>
          <FitPanel settings={defaults} onChange={onChangeDefaults} />
        </section>

        {!isFactory && (
          <div className="card-actions">
            <ConfirmButton
              label="Voltar aos valores de fábrica"
              confirmLabel="Confirmar"
              onConfirm={() => onChangeDefaults(DEFAULT_SETTINGS)}
            />
          </div>
        )}

        <p className="muted app-version">Turdus v{__APP_VERSION__}</p>
        <p className="muted app-credits">
          Instrumentos: Fluid R3 GM (Frank Wen), via midi-js-soundfonts —{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
        </p>
      </div>
    </div>
  );
}
