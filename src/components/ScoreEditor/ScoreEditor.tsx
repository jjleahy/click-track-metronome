import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Measure as MeasureData } from '../../models/Exercise';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';
import { STAFF_CLEF_WIDTH, TOTAL_HEIGHT } from './staffConstants';
import { Measure } from './Measure';
import { StaffClef } from './StaffClef';

interface FlatBeat {
  measureIndex: number;
  beatIndex: number;
  absX: number;     // absolute px position in scroll container
  startMs: number;  // real-time ms from exercise start (scaled by percentage)
}

const SCROLL_TARGET_FRACTION = 0.3;
const SCROLL_LOOKAHEAD_BEATS = 8;
const ADD_BUTTON_WIDTH = 140; // approximate width of "+ Add Measure" button

function computeScrollSpeed(
  flatBeats: FlatBeat[],
  currentFlatIndex: number,
  actual30Mark: number,
): number {
  const currentBeat = flatBeats[currentFlatIndex];
  const endIndex = Math.min(currentFlatIndex + SCROLL_LOOKAHEAD_BEATS, flatBeats.length - 1);

  if (endIndex <= currentFlatIndex) return 0;

  let totalSpeed = 0;
  let count = 0;

  for (let i = currentFlatIndex + 1; i <= endIndex; i++) {
    const futureBeat = flatBeats[i];
    const deltaX = futureBeat.absX - actual30Mark;
    const deltaMs = futureBeat.startMs - currentBeat.startMs;

    if (deltaMs > 0) {
      totalSpeed += deltaX / deltaMs;
      count++;
    }
  }

  return count > 0 ? totalSpeed / count : 0;
}

interface ScoreEditorProps {
  resolvedMeasures: ResolvedMeasure[];
  isPlaying: boolean;
  currentMeasure: number | null;
  currentBeat: number | null;
  percentage: number;
  startMeasureIndex: number;
  loop: boolean;
  onUpdateMeasure: (index: number, updated: MeasureData) => void;
  onDeleteMeasure: (index: number) => void;
  onInsertAfter: (index: number) => void;
  onAddMeasure: () => void;
  pendingAccelStart: number | null;
  landingTargets: Set<number> | null;
  onAccelStart: (measureIndex: number) => void;
  onAccelLand: (targetIndex: number, zone: 'starting' | 'ending') => void;
  onAccelCancel: () => void;
  onAccelDelete: (sourceIndex: number) => void;
}

export function ScoreEditor({
  resolvedMeasures,
  isPlaying,
  currentMeasure,
  currentBeat,
  percentage,
  startMeasureIndex,
  loop,
  onUpdateMeasure,
  onDeleteMeasure,
  onInsertAfter,
  onAddMeasure,
  pendingAccelStart,
  landingTargets,
  onAccelStart,
  onAccelLand,
  onAccelCancel,
  onAccelDelete,
}: ScoreEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);
  const prevMeasureRef = useRef<number | null>(null);

  // Refs that the rAF loop reads — updated from props without restarting the loop
  const currentMeasureRef = useRef<number | null>(null);
  const currentBeatRef = useRef<number | null>(null);
  const flatBeatsRef = useRef<FlatBeat[]>([]);
  const beatIndexMapRef = useRef<Map<string, number>>(new Map());

  // Scroll-tracking state for virtualization
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollTrackRafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (scrollTrackRafRef.current !== null) return;
    scrollTrackRafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        setScrollLeft(el.scrollLeft);
        setViewportWidth(el.clientWidth);
      }
      scrollTrackRafRef.current = null;
    });
  }, []);

  // Initialize viewportWidth on mount and window resize
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      setViewportWidth(el.clientWidth);
    }
    function onResize() {
      const el = scrollRef.current;
      if (el) setViewportWidth(el.clientWidth);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Total content width for the scroll container
  const lastMeasure = resolvedMeasures[resolvedMeasures.length - 1];
  const totalMeasuresWidth = lastMeasure
    ? lastMeasure.xOffset + lastMeasure.width
    : 0;
  const contentWidth = STAFF_CLEF_WIDTH + totalMeasuresWidth + ADD_BUTTON_WIDTH;

  // Virtualization: only render measures overlapping the visible range + buffer
  const visibleMeasures = useMemo(() => {
    const buffer = viewportWidth || 800; // fallback before first measurement
    const left = scrollLeft - buffer;
    const right = scrollLeft + (viewportWidth || 800) + buffer;
    return resolvedMeasures.filter(m => {
      const mLeft = STAFF_CLEF_WIDTH + m.xOffset;
      const mRight = mLeft + m.width;
      return mRight > left && mLeft < right;
    });
  }, [resolvedMeasures, scrollLeft, viewportWidth]);

  const flatBeats = useMemo(() => {
    const scale = 100 / percentage;
    const result: FlatBeat[] = [];
    for (const m of resolvedMeasures) {
      for (const b of m.beats) {
        result.push({
          measureIndex: m.index,
          beatIndex: b.index,
          absX: STAFF_CLEF_WIDTH + m.xOffset + b.x,
          startMs: b.startMs * scale,
        });
      }
    }
    return result;
  }, [resolvedMeasures, percentage]);

  const beatIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    flatBeats.forEach((fb, i) => map.set(`${fb.measureIndex}:${fb.beatIndex}`, i));
    return map;
  }, [flatBeats]);

  // Sync refs from props/memos so the rAF loop can read current values
  // without being in the useEffect dependency array. This keeps the rAF
  // loop running continuously while isPlaying is true — avoiding the jitter
  // caused by cancelling and restarting the loop on every beat change.
  // TODO: jitter is still noticeable, likely from DOM re-renders for beat
  // highlighting rather than the rAF loop itself. Needs further investigation
  // and performance optimization (see PRD Stage 7).
  flatBeatsRef.current = flatBeats;
  beatIndexMapRef.current = beatIndexMap;
  currentMeasureRef.current = currentMeasure;
  currentBeatRef.current = currentBeat;

  // Jump scroll back to start position on loop
  useEffect(() => {
    if (!isPlaying || !loop || currentMeasure === null) return;
    const prev = prevMeasureRef.current;
    prevMeasureRef.current = currentMeasure;

    // Detect backwards jump to startMeasureIndex — this is a loop restart
    if (prev !== null && prev > currentMeasure && currentMeasure === startMeasureIndex) {
      const container = scrollRef.current;
      if (!container) return;
      const key = `${startMeasureIndex}:0`;
      const flatIndex = beatIndexMap.get(key);
      if (flatIndex === undefined) return;
      const vpWidth = container.clientWidth;
      const maxScroll = container.scrollWidth - vpWidth;
      const targetScroll = flatBeats[flatIndex].absX - vpWidth * SCROLL_TARGET_FRACTION;
      container.scrollLeft = Math.max(0, Math.min(targetScroll, maxScroll));
    }
  }, [currentMeasure, isPlaying, loop, startMeasureIndex, beatIndexMap, flatBeats]);

  // Initial jump when playback starts — use startMeasureIndex so it works
  // even when prep beats delay currentMeasure/currentBeat from being set
  useEffect(() => {
    if (!isPlaying) return;
    const container = scrollRef.current;
    if (!container) return;

    const key = `${startMeasureIndex}:0`;
    const flatIndex = beatIndexMap.get(key);
    if (flatIndex === undefined) return;

    const vpWidth = container.clientWidth;
    const maxScroll = container.scrollWidth - vpWidth;
    const targetScroll = flatBeats[flatIndex].absX - vpWidth * SCROLL_TARGET_FRACTION;
    container.scrollLeft = Math.max(0, Math.min(targetScroll, maxScroll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]); // Only on play/stop transitions

  // rAF loop — starts/stops only with isPlaying, reads beat refs each frame
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastTimestampRef.current = performance.now();

    function tick() {
      const el = scrollRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }

      const now = performance.now();
      const dt = now - lastTimestampRef.current;
      lastTimestampRef.current = now;

      const cm = currentMeasureRef.current;
      const cb = currentBeatRef.current;
      if (cm === null || cb === null) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const fb = flatBeatsRef.current;
      const bim = beatIndexMapRef.current;
      const flatIndex = bim.get(`${cm}:${cb}`);
      if (flatIndex === undefined) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const vpWidth = el.clientWidth;
      const actual30Mark = el.scrollLeft + vpWidth * SCROLL_TARGET_FRACTION;
      const speed = computeScrollSpeed(fb, flatIndex, actual30Mark);

      if (speed !== 0) {
        const maxScroll = el.scrollWidth - vpWidth;
        const newScroll = el.scrollLeft + speed * dt;
        el.scrollLeft = Math.max(0, Math.min(newScroll, maxScroll));
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  // Escape cancels landing mode
  useEffect(() => {
    if (pendingAccelStart === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onAccelCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingAccelStart, onAccelCancel]);

  return (
    <section className="score-editor" aria-label="Score editor">
      <div
        className="score-editor__scroll-container"
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={pendingAccelStart !== null ? onAccelCancel : undefined}
        style={{ height: TOTAL_HEIGHT }}
      >
        {/* Sizer div establishes the scrollable content width */}
        <div style={{ width: contentWidth, height: 1 }} />
        <StaffClef />
        {visibleMeasures.map((rm) => (
          <Measure
            key={rm.index}
            resolved={rm}
            activeBeat={currentMeasure === rm.index ? currentBeat : null}
            canDelete={resolvedMeasures.length > 1}
            onChange={(updated) => onUpdateMeasure(rm.index, updated)}
            onDelete={() => onDeleteMeasure(rm.index)}
            onInsertAfter={() => onInsertAfter(rm.index)}
            pendingAccelStart={pendingAccelStart}
            isLandingTarget={landingTargets !== null && landingTargets.has(rm.index)}
            onAccelStart={onAccelStart}
            onAccelLand={onAccelLand}
            onAccelDelete={onAccelDelete}
          />
        ))}
        <button
          className="score-editor__add-button"
          onClick={onAddMeasure}
          aria-label="Add measure at end"
          style={{ left: STAFF_CLEF_WIDTH + totalMeasuresWidth }}
        >
          + Add Measure
        </button>
      </div>
    </section>
  );
}
