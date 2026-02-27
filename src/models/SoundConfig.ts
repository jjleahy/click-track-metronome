export type SoundType = 'emphasis' | 'standard' | 'click' | 'none';

export interface SoundConfig {
  downbeat: SoundType;
  bigBeat: SoundType;
  subdivision: SoundType;
}

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  downbeat: 'emphasis',
  bigBeat: 'standard',
  subdivision: 'click',
};
