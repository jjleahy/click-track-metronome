import type { ResolvedMeasure } from '../models/ResolvedMeasure';

export interface ClickEvent {
  time: number;       // AudioContext time in seconds
  isDownbeat: boolean;
}

interface SchedulerOptions {
  resolvedMeasures: ResolvedMeasure[];
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
  private resolvedMeasures: ResolvedMeasure[];
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
    this.resolvedMeasures = opts.resolvedMeasures;
    this.startMeasureIndex = opts.startMeasureIndex;
    this.endMeasureIndex = opts.endMeasureIndex ?? opts.resolvedMeasures.length - 1;
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
