import { useState, useEffect, useRef } from 'react';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';
import { toDisplayTempo, tempoFromBeatDuration } from '../../utils/tempoConversion';
import { BeatLabel } from '../ScoreEditor/BeatLabel';
import type { SoundConfig, SoundType, VolumeConfig } from '../../models/SoundConfig';

interface MetronomeProps {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  onStartMeasureChange: (index: number) => void;
  endMeasureIndex: number | null;
  onEndMeasureChange: (index: number | null) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  isPlaying: boolean;
  currentMeasure: number | null;
  currentBeat: number | null;
  onToggle: () => void;
  hasInvalidMeasure: boolean;
  percentage: number;
  onPercentageChange: (pct: number) => void;
  prepBeats: number;
  onPrepBeatsChange: (n: number) => void;
  prepBeatsOnRepeat: boolean;
  onPrepBeatsOnRepeatChange: (v: boolean) => void;
  soundConfig: SoundConfig;
  onSoundConfigChange: (cfg: SoundConfig) => void;
  volumeConfig: VolumeConfig;
  onVolumeConfigChange: (cfg: VolumeConfig) => void;
  subdivisionLevel: 'off' | 'eighths' | 'sixteenths';
  onSubdivisionLevelChange: (level: 'off' | 'eighths' | 'sixteenths') => void;
}

const REFERENCE_ROW_WIDTH = 525;
const MAX_ZOOM = 1.6;

function useMetronomeZoom() {
  const [zoom, setZoom] = useState(() =>
    Math.min(MAX_ZOOM, Math.max(1, (window.innerWidth - 40) / REFERENCE_ROW_WIDTH))
  );
  useEffect(() => {
    function update() {
      setZoom(Math.min(MAX_ZOOM, Math.max(1, (window.innerWidth - 40) / REFERENCE_ROW_WIDTH)));
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return zoom;
}

export function Metronome({
  resolvedMeasures,
  startMeasureIndex,
  onStartMeasureChange,
  endMeasureIndex,
  onEndMeasureChange,
  loop,
  onLoopChange,
  isPlaying,
  currentMeasure,
  currentBeat,
  onToggle,
  hasInvalidMeasure,
  percentage,
  onPercentageChange,
  prepBeats,
  onPrepBeatsChange,
  prepBeatsOnRepeat,
  onPrepBeatsOnRepeatChange,
  soundConfig,
  onSoundConfigChange,
  volumeConfig,
  onVolumeConfigChange,
  subdivisionLevel,
  onSubdivisionLevelChange,
}: MetronomeProps) {
  // Determine which measure to derive tempo display from:
  // while playing, use the current beat's measure; when stopped, use start measure
  const displayMeasureIndex = currentMeasure ?? startMeasureIndex;
  const displayMeasure = resolvedMeasures[displayMeasureIndex];
  const denominator = displayMeasure?.source.meter[1] ?? 4;
  const firstSubdivision = displayMeasure?.source.beats[0]?.subdivisions ?? 1;

  // Compute internal tempo from the current beat's tempoDurationMs during playback
  let internalTempo: number;
  if (currentMeasure !== null && currentBeat !== null) {
    const rm = resolvedMeasures[currentMeasure];
    const rb = rm?.beats[currentBeat];
    if (rm && rb) {
      internalTempo = tempoFromBeatDuration(rb.tempoDurationMs, rb.subdivisions, rm.meter[1]);
    } else {
      internalTempo = displayMeasure?.effectiveTempo ?? 80;
    }
  } else {
    internalTempo = displayMeasure?.effectiveTempo ?? 80;
  }

  const scoreTempo = toDisplayTempo(internalTempo, denominator, firstSubdivision);
  const effectiveTempo = Math.round(scoreTempo * percentage / 100);

  const [pctInputStr, setPctInputStr] = useState(String(percentage));
  const [effectiveInputStr, setEffectiveInputStr] = useState(String(effectiveTempo));
  const pctFocused = useRef(false);
  const effectiveFocused = useRef(false);
  const lastCommittedPct = useRef(percentage);
  const lastCommittedEffective = useRef(effectiveTempo);

  // Sync inputs when score tempo or percentage changes, but not while the user is typing
  useEffect(() => {
    if (!pctFocused.current) {
      setPctInputStr(String(percentage));
      lastCommittedPct.current = percentage;
    }
    if (!effectiveFocused.current) {
      const eff = Math.round(scoreTempo * percentage / 100);
      setEffectiveInputStr(String(eff));
      lastCommittedEffective.current = eff;
    }
  }, [percentage, scoreTempo]);

  function commitPercentage(str = pctInputStr) {
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(10, Math.min(200, parsed));
      lastCommittedPct.current = clamped;
      onPercentageChange(clamped);
    } else {
      setPctInputStr(String(percentage));
    }
  }

  function commitEffective(str = effectiveInputStr) {
    const parsed = parseInt(str, 10);
    // Use current score tempo (which reflects the current beat during playback)
    if (!isNaN(parsed) && parsed >= 1 && scoreTempo > 0) {
      lastCommittedEffective.current = parsed;
      const newPct = Math.round((parsed / scoreTempo) * 100);
      const clamped = Math.max(10, Math.min(200, newPct));
      onPercentageChange(clamped);
    } else {
      setEffectiveInputStr(String(effectiveTempo));
    }
  }

  function handlePctChange(val: string) {
    setPctInputStr(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      const delta = Math.abs(parsed - lastCommittedPct.current);
      if (delta <= 1) commitPercentage(val);
    }
  }

  function handleEffectiveChange(val: string) {
    setEffectiveInputStr(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      const delta = Math.abs(parsed - lastCommittedEffective.current);
      if (delta <= 1) commitEffective(val);
    }
  }

  const zoom = useMetronomeZoom();

  return (
    <section className="metronome-panel" aria-label="Playback controls" style={{ zoom }}>
      {/* Row 1: Tempo equation + Start */}
      <div className="metronome-row tempo-equation-row">
        <div className="tempo-fraction">
          <span className="tempo-fraction-num">
            <BeatLabel
              denominator={denominator}
              firstSubdivision={firstSubdivision}
              value={effectiveInputStr}
              id="effective-tempo-input"
              ariaLabel="Effective tempo"
              min={1}
              max={999}
              onChange={handleEffectiveChange}
              onFocus={() => { effectiveFocused.current = true; }}
              onBlur={() => { effectiveFocused.current = false; commitEffective(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEffective(); }}
            />
          </span>
          <span className="tempo-fraction-den">
            <BeatLabel
              denominator={denominator}
              firstSubdivision={firstSubdivision}
              value={scoreTempo}
              isReadOnly
              ariaLabel="Score tempo"
            />
          </span>
        </div>

        <span>=</span>

        <div className="speed-control">
          <div className="speed-nudge">
            <button
              aria-label="Increase speed"
              onClick={() => onPercentageChange(Math.min(200, percentage + 1))}
            >+</button>
            <button
              aria-label="Decrease speed"
              onClick={() => onPercentageChange(Math.max(10, percentage - 1))}
            >−</button>
          </div>
          <input
            id="percentage-input"
            type="number"
            min={10}
            max={200}
            value={pctInputStr}
            onChange={(e) => handlePctChange(e.target.value)}
            onFocus={() => { pctFocused.current = true; }}
            onBlur={() => { pctFocused.current = false; commitPercentage(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') commitPercentage(); }}
            aria-label="Speed percentage"
          />%
        </div>

        <button
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={onToggle}
          disabled={hasInvalidMeasure}
          aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
          title={hasInvalidMeasure ? 'Fix invalid measures before playing' : undefined}
        >
          {isPlaying ? '■ Stop' : '▶ Start'}
        </button>
      </div>

      {/* Row 2: Measure range + Loop */}
      <div className="metronome-row">
        <div>
          <label htmlFor="start-measure">Start meas.</label>{' '}
          <select
            id="start-measure"
            value={startMeasureIndex}
            onChange={(e) => onStartMeasureChange(Number(e.target.value))}
            disabled={isPlaying}
          >
            {resolvedMeasures.map((rm) => (
              <option key={rm.index} value={rm.index}>
                {rm.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="end-measure">Last meas.</label>{' '}
          <select
            id="end-measure"
            value={endMeasureIndex ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onEndMeasureChange(val === '' ? null : Number(val));
            }}
            disabled={isPlaying}
          >
            <option value="">End</option>
            {resolvedMeasures.map((rm) => (
              <option key={rm.index} value={rm.index}>
                {rm.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loop-toggle">Loop:</label>{' '}
          <select
            id="loop-toggle"
            value={loop ? 'on' : 'off'}
            onChange={(e) => onLoopChange(e.target.value === 'on')}
            disabled={isPlaying}
            aria-label="Loop"
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </div>
      </div>

      {/* Row 3: Prep beats + Subdivisions */}
      <div className="metronome-row">
        <div>
          <label htmlFor="prep-beats-input">Prep beats:</label>{' '}
          <input
            id="prep-beats-input"
            type="number"
            min={0}
            max={16}
            value={prepBeats}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onPrepBeatsChange(Math.max(0, Math.min(16, val)));
            }}
            disabled={isPlaying}
            aria-label="Prep beats"
          />
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={prepBeatsOnRepeat}
              onChange={(e) => onPrepBeatsOnRepeatChange(e.target.checked)}
              disabled={isPlaying}
            />
            {' '}on repeat
          </label>
        </div>

        <div>
          <label htmlFor="subdivision-level">Subdivisions:</label>{' '}
          <select
            id="subdivision-level"
            value={subdivisionLevel}
            onChange={(e) =>
              onSubdivisionLevelChange(e.target.value as 'off' | 'eighths' | 'sixteenths')
            }
            aria-label="Subdivision level"
          >
            <option value="off">Off</option>
            <option value="eighths">Eighths</option>
            <option value="sixteenths">Sixteenths</option>
          </select>
        </div>
      </div>

      {/* Rows 4–8: One row per sound selector */}
      {(['downbeat', 'bigBeat', 'subdivision', 'prepBeat', 'highlight'] as const).map((role) => (
        <div key={role} className="metronome-row">
          <label htmlFor={`sound-${role}`}>
            {role === 'downbeat' ? 'Downbeat:' : role === 'bigBeat' ? 'Big beat:' : role === 'subdivision' ? 'Subdivision:' : role === 'highlight' ? 'Highlight:' : 'Prep beat:'}
          </label>{' '}
          <select
            id={`sound-${role}`}
            value={soundConfig[role]}
            onChange={(e) =>
              onSoundConfigChange({ ...soundConfig, [role]: e.target.value as SoundType })
            }
            aria-label={`${role} sound`}
          >
            <optgroup label="Emphasis">
              <option value="emphasis">Emphasis</option>
              <option value="emphasisTone">Emphasis Tone</option>
              <option value="emphasisThin">Emphasis Thin</option>
            </optgroup>
            <optgroup label="Standard">
              <option value="standard">Standard</option>
              <option value="standardTone">Standard Tone</option>
              <option value="standardWood">Standard Wood</option>
            </optgroup>
            <optgroup label="Low">
              <option value="low">Low</option>
              <option value="lowTone">Low Tone</option>
              <option value="lowThud">Low Thud</option>
            </optgroup>
            <optgroup label="Click">
              <option value="quietClick">Quiet Click</option>
              <option value="warmClick">Warm Click</option>
              <option value="tick">Tick</option>
            </optgroup>
            <optgroup label="Special">
              <option value="straw">Straw</option>
              <option value="bell">Bell</option>
            </optgroup>
            <option value="none">None</option>
          </select>
          {' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volumeConfig[role]}
            onChange={(e) =>
              onVolumeConfigChange({ ...volumeConfig, [role]: Number(e.target.value) })
            }
            aria-label={`${role} volume`}
            style={{ width: '60px' }}
          />
        </div>
      ))}
    </section>
  );
}
