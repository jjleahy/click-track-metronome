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
}

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  downbeat: 'emphasis',
  bigBeat: 'standard',
  subdivision: 'tick',
  prepBeat: 'standardWood',
};
