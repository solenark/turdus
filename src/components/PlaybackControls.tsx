import { useState } from 'react';
import { INSTRUMENTS, type InstrumentId } from '../audio/instruments';
import type { PlaybackMode } from '../audio/player';

const MODES: { value: PlaybackMode; label: string }[] = [
  { value: 'notes', label: 'Notas' },
  { value: 'original', label: 'Voz' },
  { value: 'both', label: 'Ambos' },
];

interface Props {
  mode: PlaybackMode;
  onModeChange(mode: PlaybackMode): void;
  instrument: InstrumentId;
  onInstrumentChange(id: InstrumentId): void;
  /** The chosen instrument's samples are still downloading. */
  instrumentLoading: boolean;
  onExport(): void;
  onExportMp3(): Promise<void>;
  /** Melody as text, e.g. "C4 Eb4 E4 F4". */
  notesText: string;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / denied permission: copy from a temporary textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** "Listen" tab: what to play, and export. Play/stop lives in the tab bar, always visible. */
export function PlaybackControls({
  mode,
  onModeChange,
  instrument,
  onInstrumentChange,
  instrumentLoading,
  onExport,
  onExportMp3,
  notesText,
}: Props) {
  const [encoding, setEncoding] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyNotes() {
    await copyText(notesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function exportMp3() {
    setEncoding(true);
    try {
      await onExportMp3();
    } finally {
      setEncoding(false);
    }
  }

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
      <label className="instrument-row">
        <span className="controls-label">Instrumento</span>
        <select
          value={instrument}
          disabled={mode === 'original'}
          onChange={(e) => onInstrumentChange(e.target.value as InstrumentId)}
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        {instrumentLoading && <span className="muted">Carregando…</span>}
      </label>
      <div className="export-row">
        <button className="btn" onClick={onExport}>
          ⬇ Exportar MIDI
        </button>
        <button className="btn" onClick={exportMp3} disabled={encoding}>
          {encoding ? 'Gerando…' : '⬇ Exportar MP3'}
        </button>
      </div>
      <button className="btn" onClick={copyNotes} disabled={!notesText}>
        {copied ? 'Copiado ✓' : '⧉ Copiar notas'}
      </button>
    </div>
  );
}
