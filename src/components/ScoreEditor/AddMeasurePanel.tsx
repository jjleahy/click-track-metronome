import { useMemo, useState, useEffect } from 'react';
import type { Beat, Measure } from '../../models/Exercise';
import { TOTAL_HEIGHT } from './staffConstants';

interface MeasureType {
  key: string;           // e.g. "4/4 (1,1,1,1)"
  meterLabel: string;    // e.g. "4/4"
  meter: [number, number];
  beats: Beat[];
}

interface AddMeasurePanelProps {
  measures: Measure[];
  onAddMeasures: (meter: [number, number], beats: Beat[], count: number) => void;
  style?: React.CSSProperties;
}

const DEFAULT_TYPES: MeasureType[] = [
  { key: '4/4 (1,1,1,1)', meterLabel: '4/4', meter: [4, 4], beats: [{ subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }] },
  { key: '3/4 (1,1,1)', meterLabel: '3/4', meter: [3, 4], beats: [{ subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }] },
  { key: '6/8 (3,3)', meterLabel: '6/8', meter: [6, 8], beats: [{ subdivisions: 3, hold: null }, { subdivisions: 3, hold: null }] },
  { key: '2/2 (1,1)', meterLabel: '2/2', meter: [2, 2], beats: [{ subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }] },
];

function getMeasureTypeKey(m: Measure): string {
  return `${m.meter[0]}/${m.meter[1]} (${m.beats.map(b => b.subdivisions).join(',')})`;
}

function getMeterLabel(m: Measure): string {
  return `${m.meter[0]}/${m.meter[1]}`;
}

function computeTopTypes(measures: Measure[]): MeasureType[] {
  // Count occurrences of each measure type
  const countMap = new Map<string, { type: MeasureType; count: number }>();
  for (const m of measures) {
    const key = getMeasureTypeKey(m);
    const existing = countMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(key, {
        type: {
          key,
          meterLabel: getMeterLabel(m),
          meter: [...m.meter] as [number, number],
          beats: m.beats.map(b => ({ ...b })),
        },
        count: 1,
      });
    }
  }

  // Sort by count descending
  const sorted = [...countMap.values()]
    .sort((a, b) => b.count - a.count)
    .map(e => e.type);

  // Backfill with defaults until we have at least 4
  for (const def of DEFAULT_TYPES) {
    if (sorted.length >= 4) break;
    if (!sorted.some(t => t.key === def.key)) {
      sorted.push(def);
    }
  }

  return sorted.slice(0, 4);
}

const ROW_HEIGHT = TOTAL_HEIGHT / 4; // 70px

export function AddMeasurePanel({ measures, onAddMeasures, style }: AddMeasurePanelProps) {
  const types = useMemo(() => computeTopTypes(measures), [measures]);
  const typesKey = types.map(t => t.key).join('|');

  const [counts, setCounts] = useState<number[]>([1, 1, 1, 1]);

  // Reset counts when the type list changes
  useEffect(() => {
    setCounts([1, 1, 1, 1]);
  }, [typesKey]);

  function handleCountChange(rowIndex: number, value: string) {
    const parsed = parseInt(value, 10);
    setCounts(prev => {
      const next = [...prev];
      next[rowIndex] = isNaN(parsed) ? 1 : Math.max(1, Math.min(200, parsed));
      return next;
    });
  }

  return (
    <div className="add-measure-panel" style={{ ...style, height: TOTAL_HEIGHT }}>
      {types.map((t, i) => {
        const count = counts[i];
        const plural = count === 1 ? 'measure' : 'measures';
        return (
          <div key={t.key} className="add-measure-panel__row" style={{ height: ROW_HEIGHT }}>
            <input
              type="number"
              className="add-measure-panel__count"
              min={1}
              max={200}
              value={count}
              onChange={e => handleCountChange(i, e.target.value)}
            />
            <span className="add-measure-panel__multiply">x</span>
            <span className="add-measure-panel__label">{t.key}</span>
            <button
              className="add-measure-panel__create"
              onClick={() => onAddMeasures(t.meter, t.beats, count)}
            >
              Create {count} {t.meterLabel} {plural}
            </button>
          </div>
        );
      })}
    </div>
  );
}
