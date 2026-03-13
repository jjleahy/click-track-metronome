import type { ResolvedMeasure } from '../models/ResolvedMeasure';
import type { SoundConfig, SoundType, VolumeConfig } from '../models/SoundConfig';
import { DEFAULT_SOUND_CONFIG, DEFAULT_VOLUME_CONFIG } from '../models/SoundConfig';
import { computeSubBeatCount } from '../utils/subdivisionPlayback';
import { SOUND_PARAMS } from './soundParams';

interface SchedulerOptions {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  endMeasureIndex: number | null; // null = play to end of measures array
  loop: boolean;
  percentage: number; // practice speed multiplier, e.g. 100 = full speed
  prepBeats: number;  // count-in beats before playback; 0 = no count-in
  prepBeatsOnRepeat?: boolean; // whether to play prep beats on each loop repeat
  soundConfig?: SoundConfig;
  volumeConfig?: VolumeConfig;
  subdivisionLevel?: 'off' | 'eighths' | 'sixteenths';
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
  private prepBeats: number;
  private prepBeatsOnRepeat: boolean;
  private soundConfig: SoundConfig;
  private volumeConfig: VolumeConfig;
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
    this.prepBeatsOnRepeat = opts.prepBeatsOnRepeat ?? false;
    this.soundConfig = opts.soundConfig ?? DEFAULT_SOUND_CONFIG;
    this.volumeConfig = opts.volumeConfig ?? DEFAULT_VOLUME_CONFIG;
    this.subdivisionLevel = opts.subdivisionLevel ?? 'off';
    this.onBeat = opts.onBeat;
    this.onEnd = opts.onEnd;
  }

  start() {
    this.currentMeasureIndex = this.startMeasureIndex;
    this.currentBeatIndex = 0;
    this.nextClickTime = this.audioCtx.currentTime + 0.05;

    this.schedulePrepBeats();
    this.tick();
  }

  stop() {
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  setPercentage(pct: number) {
    this.percentage = pct;
  }

  private tick() {
    while (this.nextClickTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleClick();
      if (!this.advance()) return; // advance returned false: end reached, no more ticking
    }
    this.timerID = setTimeout(() => this.tick(), this.lookahead);
  }

  private schedulePrepBeats() {
    if (this.prepBeats <= 0) return;
    const startMeasure = this.resolvedMeasures[this.startMeasureIndex];
    if (!startMeasure || startMeasure.beats.length === 0) return;
    const firstBeatDurationMs = startMeasure.beats[0].durationMs;
    const prepBeatDuration = (firstBeatDurationMs / 1000) / (this.percentage / 100);
    for (let i = 0; i < this.prepBeats; i++) {
      this.playSound(this.nextClickTime + i * prepBeatDuration, this.soundConfig.prepBeat, this.volumeConfig.prepBeat);
    }
    this.nextClickTime += this.prepBeats * prepBeatDuration;
  }

  private scheduleClick() {
    const { currentMeasureIndex, currentBeatIndex } = this;
    const isDownbeat = currentBeatIndex === 0;
    const rm = this.resolvedMeasures[currentMeasureIndex];
    const rb = rm?.beats[currentBeatIndex];

    // Beat attack: highlight overrides downbeat/bigBeat if position 0 is highlighted
    const attackHighlighted = rb !== undefined && rb.highlightSubdivisions > 0 && rb.highlights.includes(0);
    const attackSound = attackHighlighted
      ? this.soundConfig.highlight
      : (isDownbeat ? this.soundConfig.downbeat : this.soundConfig.bigBeat);
    const attackVolume = attackHighlighted
      ? this.volumeConfig.highlight
      : (isDownbeat ? this.volumeConfig.downbeat : this.volumeConfig.bigBeat);
    this.playSound(this.nextClickTime, attackSound, attackVolume);
    this.onBeat(currentMeasureIndex, currentBeatIndex);

    if (!rm || !rb) return;

    const isHeld = rb.hold !== null;
    const beatDuration = (rb.durationMs / 1000) / (this.percentage / 100);

    // Loop 1: highlight sub-beats (positions 1+ that are in highlights[])
    // Skipped entirely for held beats.
    const highlightOffsets: number[] = [];
    if (!isHeld && rb.highlightSubdivisions > 0 && rb.highlights.length > 0) {
      const hs = rb.highlightSubdivisions;
      if (rb.geoRatio !== null) {
        const subBeatRatio = Math.pow(rb.geoRatio, 1 / hs);
        const weights: number[] = [];
        let totalWeight = 0;
        for (let i = 0; i < hs; i++) {
          const w = 1 / Math.pow(subBeatRatio, i);
          weights.push(w);
          totalWeight += w;
        }
        let offsetSec = 0;
        for (let i = 1; i < hs; i++) {
          offsetSec += beatDuration * weights[i - 1] / totalWeight;
          if (rb.highlights.includes(i)) {
            highlightOffsets.push(offsetSec);
            this.playSound(this.nextClickTime + offsetSec, this.soundConfig.highlight, this.volumeConfig.highlight);
          }
        }
      } else {
        for (let i = 1; i < hs; i++) {
          if (rb.highlights.includes(i)) {
            const offsetSec = (i / hs) * beatDuration;
            highlightOffsets.push(offsetSec);
            this.playSound(this.nextClickTime + offsetSec, this.soundConfig.highlight, this.volumeConfig.highlight);
          }
        }
      }
    }

    // Loop 2: standard subdivision clicks — skip any that coincide with a highlight offset
    if (this.subdivisionLevel !== 'off' && !isHeld) {
      const denominator = rm.source.meter[1];
      const subCount = computeSubBeatCount(rb.subdivisions, denominator, this.subdivisionLevel);
      if (subCount !== null && subCount >= 2) {
        if (rb.geoRatio !== null) {
          // Geometric sub-beat distribution
          const subBeatRatio = Math.pow(rb.geoRatio, 1 / subCount);
          const weights: number[] = [];
          let totalWeight = 0;
          for (let i = 0; i < subCount; i++) {
            const w = 1 / Math.pow(subBeatRatio, i);
            weights.push(w);
            totalWeight += w;
          }
          let offsetSec = 0;
          for (let i = 1; i < subCount; i++) {
            offsetSec += beatDuration * weights[i - 1] / totalWeight;
            if (!highlightOffsets.some(h => Math.abs(h - offsetSec) < 1e-9)) {
              this.playSound(this.nextClickTime + offsetSec, this.soundConfig.subdivision, this.volumeConfig.subdivision);
            }
          }
        } else {
          // Even distribution
          const subInterval = beatDuration / subCount;
          for (let i = 1; i < subCount; i++) {
            const offsetSec = i * subInterval;
            if (!highlightOffsets.some(h => Math.abs(h - offsetSec) < 1e-9)) {
              this.playSound(this.nextClickTime + offsetSec, this.soundConfig.subdivision, this.volumeConfig.subdivision);
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
          if (this.prepBeatsOnRepeat) this.schedulePrepBeats();
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

  private playSound(time: number, type: SoundType, volume: number) {
    const partials = SOUND_PARAMS[type];
    if (!partials || volume === 0) return; // 'none' or muted — silent

    for (const p of partials) {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.frequency.value = p.freq;
      gain.gain.setValueAtTime(p.gain * volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.dur);

      osc.start(time);
      osc.stop(time + p.dur);
    }
  }
}
