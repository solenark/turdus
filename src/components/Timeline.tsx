import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { midiToName } from '../audio/noteNames';
import type { Grid } from '../audio/music';
import type { Note, PitchFrame } from '../audio/types';

const LABEL_W = 36;
const PAD = 6;
const AXIS_H = 14;
const MIN_ROW = 12;
const MAX_ROW = 30;
/** Scale used in zoomed mode. */
const ZOOM_PX_PER_SEC = 140;

interface Props {
  notes: Note[];
  frames: PitchFrame[];
  /** When rhythm alignment is on, beats are drawn instead of seconds. */
  grid: Grid | null;
  duration: number;
  position: number | null;
  selected: number | null;
  onSelect(index: number | null): void;
}

/** Grid lines: bar (4 beats), beat and subdivision. */
function gridLines(grid: Grid, duration: number) {
  const lines: { t: number; kind: 'bar' | 'beat' | 'sub'; bar: number }[] = [];
  const perBeat = Math.round(grid.beat / grid.step);
  for (let i = 0; grid.origin + i * grid.step <= duration; i++) {
    const beat = i / perBeat;
    const kind = i % (perBeat * 4) === 0 ? 'bar' : i % perBeat === 0 ? 'beat' : 'sub';
    lines.push({ t: grid.origin + i * grid.step, kind, bar: Math.floor(beat / 4) + 1 });
  }
  return lines;
}

/** Tracks the element size so the timeline fits the screen. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Timeline({ notes, frames, grid, duration, position, selected, onSelect }: Props) {
  const [box, size] = useSize<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  const voiced = frames.flatMap((f) => (f.midi === null ? [] : [f.midi]));
  const pitches = [...notes.map((n) => n.midi), ...voiced];
  const lo = Math.floor(Math.min(...pitches, pitches.length ? Infinity : 57)) - 2;
  const hi = Math.ceil(Math.max(...pitches, pitches.length ? -Infinity : 64)) + 2;
  const rows = hi - lo + 1;

  // By default everything fits: width from the duration, height from the sung range.
  const plotW = Math.max(0, size.width - LABEL_W);
  const pxPerSec = zoomed ? ZOOM_PX_PER_SEC : Math.max(1, (plotW - PAD * 2) / Math.max(duration, 0.5));
  const row = Math.min(MAX_ROW, Math.max(MIN_ROW, (size.height - AXIS_H - PAD * 2) / rows));
  const height = PAD * 2 + rows * row + AXIS_H;
  const width = zoomed ? duration * pxPerSec + PAD * 2 : plotW;
  const y = (midi: number) => PAD + (hi - midi) * row;
  const x = (t: number) => PAD + t * pxPerSec;

  // In zoomed mode, keep the playhead visible during playback.
  useEffect(() => {
    const el = scroller.current;
    if (!el || position === null || !zoomed) return;
    const px = x(position);
    if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = px - 40;
  }, [position, zoomed]);

  // Raw pitch curve, broken at unvoiced stretches.
  const curves: string[] = [];
  let cur: string[] = [];
  for (const f of frames) {
    if (f.midi === null) {
      if (cur.length > 1) curves.push(cur.join(' '));
      cur = [];
    } else cur.push(`${x(f.time).toFixed(1)},${(y(f.midi) + row / 2).toFixed(1)}`);
  }
  if (cur.length > 1) curves.push(cur.join(' '));

  const rowsArr = Array.from({ length: rows }, (_, i) => hi - i);
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const sungRows = new Set(notes.map((n) => n.midi));
  const labelSize = Math.min(11, row - 3);
  const secStep = pxPerSec < 30 ? 2 : 1;

  return (
    <div className="timeline" ref={box}>
      {size.width > 0 && (
        <div className="timeline-inner">
          <svg className="timeline-labels" width={LABEL_W} height={height}>
            {rowsArr.map((m) => (
              <text
                key={m}
                x={LABEL_W - 5}
                y={y(m) + row / 2 + labelSize / 3}
                textAnchor="end"
                fontSize={labelSize}
                className={sungRows.has(m) ? 'label-sung' : m % 12 === 0 ? 'label-c' : ''}
              >
                {midiToName(m)}
              </text>
            ))}
          </svg>
          <div className="timeline-scroll" ref={scroller}>
            <svg width={width} height={height} onClick={() => onSelect(null)}>
              {rowsArr.map((m) => (
                <rect key={m} x={0} y={y(m)} width={width} height={row} className={isBlack(m) ? 'row-black' : 'row-white'} />
              ))}
              {grid &&
                gridLines(grid, duration).map((l) => (
                  <line key={l.t} x1={x(l.t)} x2={x(l.t)} y1={0} y2={height - AXIS_H} className={`grid-${l.kind}`} />
                ))}
              {!grid && Array.from({ length: Math.floor(duration / secStep) + 1 }, (_, i) => i * secStep).map((s) => (
                <g key={s}>
                  <line x1={x(s)} x2={x(s)} y1={0} y2={height - AXIS_H} className="grid-sec" />
                  <text x={x(s) + 3} y={height - 3} className="grid-label">{s}s</text>
                </g>
              ))}
              {grid &&
                gridLines(grid, duration)
                  .filter((l) => l.kind === 'bar')
                  .map((l) => (
                    <text key={l.t} x={x(l.t) + 3} y={height - 3} className="grid-label">{l.bar}</text>
                  ))}
              {curves.map((pts, i) => (
                <polyline key={i} points={pts} className="pitch-curve" />
              ))}
              {notes.map((n, i) => (
                <rect
                  key={i}
                  x={x(n.start)}
                  y={y(n.midi) + 1}
                  width={Math.max(4, n.duration * pxPerSec)}
                  height={row - 2}
                  rx={Math.min(4, row / 4)}
                  className={`note${i === selected ? ' is-selected' : ''}`}
                  style={{ opacity: 0.55 + 0.45 * n.velocity }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(i === selected ? null : i);
                  }}
                />
              ))}
              {position !== null && <line x1={x(position)} x2={x(position)} y1={0} y2={height - AXIS_H} className="playhead" />}
            </svg>
          </div>
        </div>
      )}
      <button className="timeline-zoom" onClick={() => setZoomed(!zoomed)} aria-label={zoomed ? 'Ajustar à tela' : 'Ampliar'}>
        {zoomed ? '⤡ Tela' : '⤢ Ampliar'}
      </button>
    </div>
  );
}
