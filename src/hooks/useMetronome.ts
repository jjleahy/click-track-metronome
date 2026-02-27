import { useRef, useState, useCallback } from 'react';
import type { ResolvedMeasure } from '../models/ResolvedMeasure';
import { MetronomeScheduler } from '../audio/scheduler';
import type { SoundConfig } from '../models/SoundConfig';
import { DEFAULT_SOUND_CONFIG } from '../models/SoundConfig';

interface UseMetronomeOptions {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  endMeasureIndex?: number | null; // null/undefined = play to end of measures array
  loop?: boolean;                  // default false
  percentage: number;
  prepBeats?: number;              // default 0
  soundConfig?: SoundConfig;
  subdivisionLevel?: 'off' | 'eighths' | 'sixteenths';
}

export function useMetronome({
  resolvedMeasures,
  startMeasureIndex,
  endMeasureIndex = null,
  loop = false,
  percentage,
  prepBeats = 0,
  soundConfig = DEFAULT_SOUND_CONFIG,
  subdivisionLevel = 'off' as const,
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
      prepBeats,
      soundConfig,
      subdivisionLevel,
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
  }, [resolvedMeasures, startMeasureIndex, endMeasureIndex, loop, percentage, prepBeats, soundConfig, subdivisionLevel, stop]);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  return { isPlaying, currentMeasure, currentBeat, start, stop, toggle };
}
