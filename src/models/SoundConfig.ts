export type SoundType =
  | 'emphasis' | 'emphasisTone' | 'emphasisThin'
  | 'standard' | 'standardTone' | 'standardWood'
  | 'low' | 'lowTone' | 'lowThud'
  | 'quietClick' | 'warmClick' | 'tick'
  | 'straw' | 'bell'
  | 'none';

export interface SoundConfig {
  downbeat: SoundType;
  bigBeat: SoundType;
  subdivision: SoundType;
  prepBeat: SoundType;
  highlight: SoundType;
}

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  downbeat: 'emphasis',
  bigBeat: 'standard',
  subdivision: 'tick',
  prepBeat: 'standardWood',
  highlight: 'bell',
};

export type VolumeConfig = Record<keyof SoundConfig, number>;

export const DEFAULT_VOLUME_CONFIG: VolumeConfig = {
  downbeat: 1,
  bigBeat: 1,
  subdivision: 1,
  prepBeat: 1,
  highlight: 1,
};
