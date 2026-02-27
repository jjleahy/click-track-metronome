import type { ResolvedMeasure } from '../models/ResolvedMeasure';
import type { SoundConfig, SoundType } from '../models/SoundConfig';
import { DEFAULT_SOUND_CONFIG } from '../models/SoundConfig';
import { computeSubBeatCount } from '../utils/subdivisionPlayback';

interface SchedulerOptions {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  endMeasureIndex: number | null; // null = play to end of measures array
  loop: boolean;
  percentage: number; // practice speed multiplier, e.g. 100 = full speed
  prepBeats: number;  // count-in beats before playback; 0 = no count-in
  soundConfig?: SoundConfig;
  subdivisionLevel?: 'off' | 'eighths' | 'sixteenths';
  audioCtx: AudioContext;
  onBeat: (measureIndex: number, beatIndex: number) => void;
  onEnd: () => void;  // called when playback reaches the end and loop is false
}

// Sound parameters per type
const SOUND_PARAMS: Record<SoundType, { freq: number; gain: number; dur: number } | null> = {
  emphasis: { freq: 1000, gain: 0.5, dur: 0.04 },
  standard: { freq: 800,  gain: 0.3, dur: 0.04 },
  click:    { freq: 400,  gain: 0.2, dur: 0.015 },
  none:     null,
};

export class MetronomeScheduler {
  private audioCtx: AudioContext;
  private resolvedMeasures: ResolvedMeasure[];
  private startMeasureIndex: number;
  private endMeasureIndex: number; // resolved: last measure index that plays
  private loop: boolean;
  private percentage: number;
  private prepBeats: number;
  private soundConfig: SoundConfig;
  private subdivisionLevel: 'off' | 'eighths' | 'sixteenths';
  private onBeat: (measureIndex: number, beatIndex: number) => void;
  private onEnd: () => void;

  private scheduleAheadTime = 0.1;  // seconds
  private lookahead = 25;           // ms between scheduler ticks
  private timerID: ReturnType<typeof setTimeout> | null = null;

  private nextClickTime = 0;
  private currentMeasureIndex = 0;
  private currentBeatIndex = 0;

  constructor(opts: SchedulerOptions) {
    this.audioCtx = opts.audioCtx;
    this.resolvedMeasures = opts.resolvedMeasures;
    this.startMeasureIndex = opts.startMeasureIndex;
    this.endMeasureIndex = opts.endMeasureIndex ?? opts.resolvedMeasures.length - 1;
    this.loop = opts.loop;
    this.percentage = opts.percentage;
    this.prepBeats = opts.prepBeats;
    this.soundConfig = opts.soundConfig ?? DEFAULT_SOUND_CONFIG;
    this.subdivisionLevel = opts.subdivisionLevel ?? 'off';
    this.onBeat = opts.onBeat;
    this.onEnd = opts.onEnd;
  }

  start() {
    this.currentMeasureIndex = this.startMeasureIndex;
    this.currentBeatIndex = 0;
    this.nextClickTime = this.audioCtx.currentTime + 0.05;

    // Schedule prep beat count-in (audio-only, no onBeat callback)
    if (this.prepBeats > 0) {
      const startMeasure = this.resolvedMeasures[this.startMeasureIndex];
      if (startMeasure && startMeasure.beats.length > 0) {
        const firstBeatDurationMs = startMeasure.beats[0].durationMs;
        const prepBeatDuration = (firstBeatDurationMs / 1000) / (this.percentage / 100);
        for (let i = 0; i < this.prepBeats; i++) {
          const t = this.nextClickTime + i * prepBeatDuration;
          this.playPrepClick(t);
        }
        this.nextClickTime += this.prepBeats * prepBeatDuration;
      }
    }

    this.tick();
  }

  stop() {
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private tick() {
    while (this.nextClickTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleClick();
      if (!this.advance()) return; // advance returned false: end reached, no more ticking
    }
    this.timerID = setTimeout(() => this.tick(), this.lookahead);
  }

  private scheduleClick() {
    const { currentMeasureIndex, currentBeatIndex } = this;
    const isDownbeat = currentBeatIndex === 0;
    const soundType = isDownbeat ? this.soundConfig.downbeat : this.soundConfig.bigBeat;
    this.playSound(this.nextClickTime, soundType);
    this.onBeat(currentMeasureIndex, currentBeatIndex);

    // Schedule sub-beat clicks if subdivision level is active and beat is not held
    if (this.subdivisionLevel !== 'off') {
      const rm = this.resolvedMeasures[currentMeasureIndex];
      if (rm) {
        const rb = rm.beats[currentBeatIndex];
        if (rb.hold === null) {
          const denominator = rm.source.meter[1];
          const subCount = computeSubBeatCount(rb.subdivisions, denominator, this.subdivisionLevel);
          if (subCount !== null && subCount >= 2) {
            const beatDuration = (rb.durationMs / 1000) / (this.percentage / 100);
            const subInterval = beatDuration / subCount;
            for (let i = 1; i < subCount; i++) {
              this.playSound(this.nextClickTime + i * subInterval, this.soundConfig.subdivision);
            }
          }
        }
      }
    }
  }

  /** Advances position by one beat. Returns false when playback should end. */
  private advance(): boolean {
    const rm = this.resolvedMeasures[this.currentMeasureIndex];
    if (!rm) return false;

    const rb = rm.beats[this.currentBeatIndex];
    const beatDuration = (rb.durationMs / 1000) / (this.percentage / 100);

    this.nextClickTime += beatDuration;
    this.currentBeatIndex++;

    if (this.currentBeatIndex >= rm.source.beats.length) {
      this.currentBeatIndex = 0;

      if (this.currentMeasureIndex >= this.endMeasureIndex) {
        // Reached end of playback range
        if (this.loop) {
          this.currentMeasureIndex = this.startMeasureIndex;
        } else {
          this.stop();
          this.onEnd();
          return false;
        }
      } else {
        this.currentMeasureIndex++;
      }
    }

    return true;
  }

  private playPrepClick(time: number) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

    osc.start(time);
    osc.stop(time + 0.025);
  }

  private playSound(time: number, type: SoundType) {
    const params = SOUND_PARAMS[type];
    if (!params) return; // 'none' — silent

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.value = params.freq;
    gain.gain.setValueAtTime(params.gain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + params.dur);

    osc.start(time);
    osc.stop(time + params.dur);
  }
}
