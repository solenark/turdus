import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, DETECTION_KEYS, FIT_KEYS, type AnalysisResult, type AnalysisSettings } from './audio/analysis';
import { midiToName } from './audio/noteNames';
import { extractFrames } from './audio/pitch';
import { play, type Playback, type PlaybackMode } from './audio/player';
import { startRecording, type RecorderHandle } from './audio/recorder';
import type { Note, RawFrame } from './audio/types';
import { notesToMidi, saveMidi } from './midi/export';
import { PlaybackControls } from './components/PlaybackControls';
import { RecordButton, RecordButtonSmall } from './components/RecordButton';
import { Calibration } from './components/Calibration';
import { FitPanel } from './components/FitPanel';
import { SettingsScreen } from './components/SettingsScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { Timeline } from './components/Timeline';
import { saveDebugMeta, uploadDebugRecording } from './debugUpload';
import { loadDefaults, loadProfile, saveDefaults, saveProfile, type StoredProfile } from './storage';

/** Test recordings in recordings/ (npm run dev only): enable with VITE_SAVE_RECORDINGS=1. */
const SAVE_TEST_RECORDINGS = import.meta.env.DEV && import.meta.env.VITE_SAVE_RECORDINGS === '1';

type Status = 'idle' | 'recording' | 'analyzing' | 'ready';
type Tab = 'listen' | 'settings' | 'fit' | 'note';
type View = 'main' | 'settings' | 'calibration';

const TABS: { id: Tab; label: string }[] = [
  { id: 'listen', label: 'Ouvir' },
  { id: 'settings', label: 'Ajustes' },
  { id: 'fit', label: 'Encaixe' },
  { id: 'note', label: 'Nota' },
];

interface Take {
  buffer: AudioBuffer;
  /** Output of the heavy pass; settings changes only reprocess this. */
  raw: RawFrame[];
}

/** Manual edits only apply to the analysis they were made on. */
interface Edits {
  base: AnalysisResult;
  notes: Note[];
}

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [view, setView] = useState<View>('main');
  /** Defaults saved on the device; every new recording starts with them. */
  const [defaults, setDefaults] = useState<AnalysisSettings>(loadDefaults);
  const [profile, setProfile] = useState<StoredProfile | null>(loadProfile);
  /** Settings of the recording on screen (may differ from the defaults). */
  const [settings, setSettings] = useState<AnalysisSettings>(defaults);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [mode, setMode] = useState<PlaybackMode>('notes');
  const [position, setPosition] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('listen');
  /** Tab to return to when the selected note is deselected. */
  const [lastTab, setLastTab] = useState<Exclude<Tab, 'note'>>('listen');
  const [debugId, setDebugId] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string | null>(null);
  const recorder = useRef<RecorderHandle | null>(null);
  const playback = useRef<Playback | null>(null);

  useEffect(() => () => playback.current?.stop(), []);

  const analysis = useMemo(() => (take ? analyze(take.raw, settings, profile ?? {}) : null), [take, settings, profile]);
  const hasEdits = !!analysis && edits?.base === analysis;
  const notes = analysis ? (hasEdits ? edits!.notes : analysis.notes) : [];

  // Test recording: the .json follows the settings and edits currently on screen.
  useEffect(() => {
    if (!SAVE_TEST_RECORDINGS || !debugId) return;
    const timer = setTimeout(() => {
      saveDebugMeta(debugId, settings, profile, notes, hasEdits)
        .then(() => setDebugStatus(`salva como ${debugId}`))
        .catch((e) => setDebugStatus(`falha ao salvar (${(e as Error).message})`));
    }, 600);
    return () => clearTimeout(timer);
  }, [debugId, settings, profile, notes, hasEdits]);

  function changeDefaults(next: AnalysisSettings) {
    setDefaults(next);
    saveDefaults(next);
    setSettings(next);
  }

  /** A tab's "save as default": stores only that tab's settings. */
  function saveAsDefault(keys: readonly (keyof AnalysisSettings)[]) {
    const next = { ...defaults, ...Object.fromEntries(keys.map((k) => [k, settings[k]])) };
    setDefaults(next);
    saveDefaults(next);
  }

  function changeSettings(next: AnalysisSettings) {
    stopPlayback();
    selectNote(null);
    setError(null);
    setSettings(next);
  }

  async function handleStart() {
    stopPlayback();
    setError(null);
    selectNote(null);
    try {
      recorder.current = await startRecording((lvl, t) => {
        setLevel(lvl);
        setElapsed(t);
      });
      setStatus('recording');
      const rec = await recorder.current.done;
      setStatus('analyzing');
      // Let the screen show "Analisando…" before the synchronous processing.
      await new Promise((r) => setTimeout(r, 30));
      const raw = extractFrames(rec.samples, rec.buffer.sampleRate);
      setSettings(defaults);
      setTake({ buffer: rec.buffer, raw });
      setEdits(null);
      setStatus('ready');
      if (analyze(raw, defaults, profile ?? {}).notes.length === 0)
        setError('Nenhuma nota foi detectada. Tente cantar mais perto do microfone ou aumente a sensibilidade.');
      if (SAVE_TEST_RECORDINGS) {
        setDebugId(null);
        setDebugStatus('salvando…');
        uploadDebugRecording(rec.samples, rec.buffer.sampleRate)
          .then(setDebugId)
          .catch((e) => setDebugStatus(`falha ao salvar (${(e as Error).message})`));
      }
    } catch (e) {
      setStatus(take ? 'ready' : 'idle');
      setError(
        (e as DOMException).name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para gravar.'
          : `Não foi possível gravar: ${(e as Error).message}`,
      );
    } finally {
      recorder.current = null;
      setLevel(0);
      setElapsed(0);
    }
  }

  function stopPlayback() {
    playback.current?.stop();
    playback.current = null;
  }

  function togglePlayback() {
    if (!take) return;
    if (playback.current) return stopPlayback();
    const pb = play(notes, take.buffer, mode, () => {
      playback.current = null;
      setPosition(null);
    });
    playback.current = pb;
    const tick = () => {
      if (playback.current !== pb) return;
      setPosition(pb.position());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function editSelected(change: 'up' | 'down' | 'delete') {
    if (!analysis || selected === null) return;
    stopPlayback();
    const edited =
      change === 'delete'
        ? notes.filter((_, i) => i !== selected)
        : notes.map((n, i) => (i === selected ? { ...n, midi: n.midi + (change === 'up' ? 1 : -1) } : n));
    setEdits({ base: analysis, notes: edited });
    if (change === 'delete') selectNote(null);
  }

  function selectNote(index: number | null) {
    setSelected(index);
    if (index !== null) setTab('note');
    else setTab((t) => (t === 'note' ? lastTab : t));
  }

  function chooseTab(t: Tab) {
    setTab(t);
    if (t !== 'note') setLastTab(t);
  }

  const sel = selected !== null ? notes[selected] ?? null : null;

  const showResult = take && analysis && status === 'ready';

  if (view === 'calibration') {
    return (
      <Calibration
        onCancel={() => setView('settings')}
        onSave={(p) => {
          setProfile(p);
          saveProfile(p);
          setView('settings');
        }}
      />
    );
  }
  if (view === 'settings') {
    return (
      <SettingsScreen
        defaults={defaults}
        profile={profile}
        onChangeDefaults={changeDefaults}
        onCalibrate={() => setView('calibration')}
        onDeleteProfile={() => {
          setProfile(null);
          saveProfile(null);
        }}
        onClose={() => setView('main')}
      />
    );
  }

  return (
    <div className={`app${showResult ? ' has-result' : ''}`}>
      <header className="topbar">
        <div>
          <h1>Turdus</h1>
          {showResult ? (
            <p className="muted">
              {notes.length} notas · {take.buffer.duration.toFixed(1)}s
              {debugStatus && <span className="debug"> · teste {debugStatus}</span>}
            </p>
          ) : (
            <p className="muted">Cante uma melodia e transforme em MIDI</p>
          )}
        </div>
        <div className="topbar-actions">
          {showResult && <RecordButtonSmall onStart={handleStart} />}
          {status !== 'recording' && status !== 'analyzing' && (
            <button className="icon-btn" onClick={() => { stopPlayback(); setView('settings'); }} aria-label="Configurações">
              ⚙
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {error && <p className="error">{error}</p>}
        {showResult ? (
          <Timeline
            notes={notes}
            frames={analysis.frames}
            grid={analysis.grid}
            duration={take.buffer.duration}
            position={position}
            selected={selected}
            onSelect={selectNote}
          />
        ) : (
          <div className="main-center">
            <RecordButton
              recording={status === 'recording'}
              disabled={status === 'analyzing'}
              level={level}
              elapsed={elapsed}
              onStart={handleStart}
              onStop={() => recorder.current?.stop()}
            />
            {status === 'analyzing' && <p className="status">Analisando as notas…</p>}
          </div>
        )}
      </main>

      {showResult && (
        <footer className="dock">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`tab${tab === t.id ? ' is-active' : ''}`}
                disabled={t.id === 'note' && !sel}
                onClick={() => chooseTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <button className="play-btn" onClick={togglePlayback} aria-label={position !== null ? 'Parar' : 'Ouvir'}>
              {position !== null ? '■' : '▶'}
            </button>
          </div>

          <div className="dock-body">
            {tab === 'listen' && (
              <PlaybackControls
                mode={mode}
                onModeChange={(m) => {
                  stopPlayback();
                  setMode(m);
                }}
                onExport={() => saveMidi(notesToMidi(notes, settings.bpm, analysis.grid?.origin ?? 0))}
              />
            )}
            {tab === 'settings' && (
              <SettingsPanel
                settings={settings}
                analysis={analysis}
                hasEdits={hasEdits}
                onChange={changeSettings}
                defaults={defaults}
                onSaveDefaults={() => saveAsDefault(DETECTION_KEYS)}
              />
            )}
            {tab === 'fit' && (
              <FitPanel
                settings={settings}
                analysis={analysis}
                onChange={changeSettings}
                defaults={defaults}
                onSaveDefaults={() => saveAsDefault(FIT_KEYS)}
              />
            )}
            {tab === 'note' && sel && (
              <div className="note-editor">
                <div className="note-info">
                  <strong>{midiToName(sel.midi)}</strong>
                  <span className="muted">
                    {sel.start.toFixed(2)}s · {(sel.duration * 1000).toFixed(0)} ms
                  </span>
                </div>
                <div className="note-buttons">
                  <button className="btn" onClick={() => editSelected('down')}>− semitom</button>
                  <button className="btn" onClick={() => editSelected('up')}>+ semitom</button>
                  <button className="btn btn-danger" onClick={() => editSelected('delete')}>Apagar</button>
                </div>
                <p className="muted dock-hint">Toque fora da nota para desmarcar.</p>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
