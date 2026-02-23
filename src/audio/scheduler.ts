import type { Measure } from '../models/Exercise';
import { resolveTempoMap } from '../utils/tempoMap';

export interface ClickEvent {
  time: number;       // AudioContext time in seconds
  isDownbeat: boolean;
}

interface SchedulerOptions {
  measures: Measure[];
  startMeasureIndex: number;
  endMeasureIndex: number | null; // null = play to end of measures array
  loop: boolean;
  percentage: number; // practice speed multiplier, e.g. 100 = full speed
  audioCtx: AudioContext;
  onBeat: (measureIndex: number, beatIndex: number) => void;
  onEnd: () => void;  // called when playback reaches the end and loop is false
}

export class MetronomeScheduler {
  private audioCtx: AudioContext;
  private measures: Measure[];
  private startMeasureIndex: number;
  private endMeasureIndex: number; // resolved: last measure index that plays
  private loop: boolean;
  private percentage: number;
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
    this.measures = opts.measures;
    this.startMeasureIndex = opts.startMeasureIndex;
    this.endMeasureIndex = opts.endMeasureIndex ?? opts.measures.length - 1;
    this.loop = opts.loop;
    this.percentage = opts.percentage;
    this.onBeat = opts.onBeat;
    this.onEnd = opts.onEnd;
  }

  start() {
    this.currentMeasureIndex = this.startMeasureIndex;
    this.currentBeatIndex = 0;
    this.nextClickTime = this.audioCtx.currentTime + 0.05;
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
    this.playClick(this.nextClickTime, isDownbeat);
    this.onBeat(currentMeasureIndex, currentBeatIndex);
  }

  /** Advances position by one beat. Returns false when playback should end. */
  private advance(): boolean {
    const measure = this.measures[this.currentMeasureIndex];
    if (!measure) return false;

    const tempoMap = resolveTempoMap(this.measures);
    const resolved = tempoMap[this.currentMeasureIndex];
    const [, denominator] = measure.meter;
    const beat = measure.beats[this.currentBeatIndex];

    // Beat duration in seconds: (subdivisions / denominator) * (60 / quarterTempo)
    // For x/4: each subdivision unit = one quarter; duration = (subdivisions * 60) / tempo
    // For x/8: each subdivision unit = one eighth = half a quarter
    const quarterDuration = 60 / resolved.tempo / (this.percentage / 100);
    const subdivisionDuration = quarterDuration * (4 / denominator);
    const beatDuration = beat.subdivisions * subdivisionDuration;

    this.nextClickTime += beatDuration;
    this.currentBeatIndex++;

    if (this.currentBeatIndex >= measure.beats.length) {
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

  private playClick(time: number, isDownbeat: boolean) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.start(time);
    osc.stop(time + 0.04);
  }
}
