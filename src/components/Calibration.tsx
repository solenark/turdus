import { useRef, useState } from 'react';
import { measureNoise, measureSustainedNote, toDb, type NoiseQuality } from '../audio/calibration';
import { midiToName } from '../audio/noteNames';
import { extractFrames } from '../audio/pitch';
import { startRecording, type RecorderHandle } from '../audio/recorder';
import type { StoredProfile } from '../storage';
import { RecordButton } from './RecordButton';

type Step = 'noise' | 'low' | 'high' | 'done';

const STEPS: Record<Exclude<Step, 'done'>, { title: string; text: string; seconds: number; hint: string }> = {
  noise: {
    title: 'Ruído do ambiente',
    text: 'Fique em silêncio, no lugar onde costuma gravar. O app vai medir o ruído de fundo por 3 segundos.',
    seconds: 3,
    hint: 'Toque e fique em silêncio',
  },
  low: {
    title: 'Nota mais grave',
    text: 'Cante e sustente a nota mais grave que você alcança com conforto, por uns 2 segundos.',
    seconds: 5,
    hint: 'Toque e cante a nota grave',
  },
  high: {
    title: 'Nota mais aguda',
    text: 'Agora sustente a nota mais aguda que você alcança com conforto, sem forçar.',
    seconds: 5,
    hint: 'Toque e cante a nota aguda',
  },
};
const ORDER: Step[] = ['noise', 'low', 'high', 'done'];
const QUALITY: Record<NoiseQuality, string> = {
  great: 'ótimo, ambiente bem silencioso',
  good: 'bom',
  noisy: 'ruidoso; se puder, procure um lugar mais silencioso',
};

interface Props {
  onSave(profile: StoredProfile): void;
  onCancel(): void;
}

export function Calibration({ onSave, onCancel }: Props) {
  const [step, setStep] = useState<Step>('noise');
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noise, setNoise] = useState<{ rms: number; quality: NoiseQuality } | null>(null);
  const [low, setLow] = useState<number | null>(null);
  const [high, setHigh] = useState<number | null>(null);
  const recorder = useRef<RecorderHandle | null>(null);

  const result = step === 'noise' ? noise : step === 'low' ? low : step === 'high' ? high : null;
  const info = step !== 'done' ? STEPS[step] : null;

  async function record() {
    if (!info) return;
    setError(null);
    try {
      recorder.current = await startRecording((l, t) => {
        setLevel(l);
        setElapsed(t);
      }, info.seconds);
      setRecording(true);
      const rec = await recorder.current.done;
      const raw = extractFrames(rec.samples, rec.buffer.sampleRate);
      if (step === 'noise') {
        setNoise(measureNoise(raw));
      } else {
        const midi = measureSustainedNote(raw);
        if (midi === null) setError('Não consegui identificar uma nota. Tente cantar mais alto e sustentar por mais tempo.');
        else if (step === 'low') setLow(midi);
        else if (low !== null && midi <= low + 2) setError('Essa nota não ficou acima da nota grave. Tente uma nota mais aguda.');
        else setHigh(midi);
      }
    } catch (e) {
      setError(
        (e as DOMException).name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para calibrar.'
          : `Não foi possível gravar: ${(e as Error).message}`,
      );
    } finally {
      recorder.current = null;
      setRecording(false);
      setLevel(0);
      setElapsed(0);
    }
  }

  const next = () => {
    setError(null);
    setStep(ORDER[ORDER.indexOf(step) + 1]);
  };
  const back = () => {
    setError(null);
    if (step === 'noise') onCancel();
    else setStep(ORDER[ORDER.indexOf(step) - 1]);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="link-btn" onClick={back} disabled={recording}>← {step === 'noise' ? 'Cancelar' : 'Voltar'}</button>
        <span className="muted">Calibração · {Math.min(ORDER.indexOf(step) + 1, 3)} de 3</span>
      </header>

      {info ? (
        <div className="calib">
          <h2>{info.title}</h2>
          <p className="muted calib-text">{info.text}</p>
          <div className="calib-record">
            <RecordButton
              recording={recording}
              disabled={false}
              level={level}
              elapsed={elapsed}
              maxSeconds={info.seconds}
              idleHint={result !== null ? 'Toque para refazer' : info.hint}
              onStart={record}
              onStop={() => recorder.current?.stop()}
            />
          </div>
          {error && <p className="error">{error}</p>}
          {!recording && result !== null && (
            <p className="calib-result">
              {step === 'noise' && noise
                ? `Ruído: ${toDb(noise.rms).toFixed(0)} dB, ${QUALITY[noise.quality]}.`
                : `Nota detectada: ${midiToName(result as number)}`}
            </p>
          )}
          <button className="btn btn-primary calib-next" disabled={recording || result === null} onClick={next}>
            Próximo
          </button>
        </div>
      ) : (
        <div className="calib">
          <h2>Pronto!</h2>
          <ul className="calib-summary">
            <li>Ruído do ambiente: <strong>{noise ? `${toDb(noise.rms).toFixed(0)} dB` : '—'}</strong></li>
            <li>Extensão vocal: <strong>{low !== null && high !== null ? `${midiToName(low)} a ${midiToName(high)}` : '—'}</strong></li>
          </ul>
          <p className="muted calib-text">
            O app vai procurar notas só nessa extensão (com uma margem) e ignorar sons no nível desse ruído. Refaça a calibração se
            mudar de ambiente ou se outra pessoa for cantar.
          </p>
          <button
            className="btn btn-primary calib-next"
            onClick={() =>
              onSave({ noiseRms: noise?.rms, minMidi: low ?? undefined, maxMidi: high ?? undefined, calibratedAt: new Date().toISOString() })
            }
          >
            Salvar perfil
          </button>
        </div>
      )}
    </div>
  );
}
