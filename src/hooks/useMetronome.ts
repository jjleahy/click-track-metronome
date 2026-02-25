import { useRef, useState, useCallback } from 'react';
import type { ResolvedMeasure } from '../models/ResolvedMeasure';
import { MetronomeScheduler } from '../audio/scheduler';

interface UseMetronomeOptions {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  endMeasureIndex?: number | null; // null/undefined = play to end of measures array
  loop?: boolean;                  // default false
  percentage: number;
}

export function useMetronome({
  resolvedMeasures,
  startMeasureIndex,
  endMeasureIndex = null,
  loop = false,
  percentage,
}: UseMetronomeOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMeasure, setCurrentMeasure] = useState<number | null>(null);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);

  const schedulerRef = useRef<MetronomeScheduler | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    schedulerRef.current?.stop();
    schedulerRef.current = null;
    setIsPlaying(false);
    setCurrentMeasure(null);
    setCurrentBeat(null);
  }, []);

  const start = useCallback(() => {
    if (audioCtxRef.current === null) {
      audioCtxRef.current = new AudioContext();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    schedulerRef.current = new MetronomeScheduler({
      resolvedMeasures,
      startMeasureIndex,
      endMeasureIndex,
      loop,
      percentage,
      audioCtx,
      onBeat: (measureIndex, beatIndex) => {
        setCurrentMeasure(measureIndex);
        setCurrentBeat(beatIndex);
      },
      onEnd: () => {
        // Scheduler already called stop() on itself; mirror that in React state
        setIsPlaying(false);
        setCurrentMeasure(null);
        setCurrentBeat(null);
      },
    });
    schedulerRef.current.start();
    setIsPlaying(true);
  }, [resolvedMeasures, startMeasureIndex, endMeasureIndex, loop, percentage, stop]);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  return { isPlaying, currentMeasure, currentBeat, start, stop, toggle };
}
