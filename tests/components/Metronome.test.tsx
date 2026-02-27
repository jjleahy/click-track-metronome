import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SOUND_CONFIG } from '../../src/models/SoundConfig';
import userEvent from '@testing-library/user-event';
import { Metronome } from '../../src/components/Metronome/Metronome';
import type { ResolvedMeasure } from '../../src/models/ResolvedMeasure';
import { defaultBeats } from '../../src/utils/subdivisionDefaults';
import { resolveExercise } from '../../src/utils/resolveExercise';
import type { Measure } from '../../src/models/Exercise';

function makeResolved(tempos: number[]): ResolvedMeasure[] {
  const measuresExplicit: Measure[] = tempos.map((tempo) => ({
    meter: [4, 4] as [number, number],
    beats: defaultBeats(4, 4),
    tempo,
    rehearsalNumber: null,
    gradualTempo: null,
  }));
  return resolveExercise(measuresExplicit);
}

const defaultProps = {
  resolvedMeasures: makeResolved([80, 80, 80]),
  startMeasureIndex: 0,
  onStartMeasureChange: vi.fn(),
  endMeasureIndex: null,
  onEndMeasureChange: vi.fn(),
  loop: false,
  onLoopChange: vi.fn(),
  isPlaying: false,
  onToggle: vi.fn(),
  hasInvalidMeasure: false,
  percentage: 100,
  onPercentageChange: vi.fn(),
  prepBeats: 4,
  onPrepBeatsChange: vi.fn(),
  soundConfig: DEFAULT_SOUND_CONFIG,
  onSoundConfigChange: vi.fn(),
  subdivisionLevel: 'off' as const,
  onSubdivisionLevelChange: vi.fn(),
};

describe('Metronome', () => {
  it('renders start measure select with labels', () => {
    render(<Metronome {...defaultProps} />);
    const startSelect = screen.getByLabelText(/start at/i) as HTMLSelectElement;
    const optionTexts = Array.from(startSelect.options).map((o) => o.text.trim());
    expect(optionTexts).toContain('m. 1');
    expect(optionTexts).toContain('m. 2');
    expect(optionTexts).toContain('m. 3');
  });

  it('score tempo display shows resolved tempo for starting measure', () => {
    render(
      <Metronome
        {...defaultProps}
        resolvedMeasures={makeResolved([120, 80, 80])}
        startMeasureIndex={0}
      />
    );
    expect(screen.getByLabelText(/score tempo/i).textContent).toContain('120');
  });

  it('play button is disabled when hasInvalidMeasure', () => {
    render(<Metronome {...defaultProps} hasInvalidMeasure={true} />);
    expect(screen.getByRole('button', { name: /start metronome/i })).toBeDisabled();
  });

  it('play button is enabled when no invalid measures', () => {
    render(<Metronome {...defaultProps} hasInvalidMeasure={false} />);
    expect(screen.getByRole('button', { name: /start metronome/i })).not.toBeDisabled();
  });

  it('clicking play button calls onToggle', async () => {
    const onToggle = vi.fn();
    render(<Metronome {...defaultProps} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /start metronome/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows Stop label when playing', () => {
    render(<Metronome {...defaultProps} isPlaying={true} />);
    expect(screen.getByRole('button', { name: /stop metronome/i })).toBeTruthy();
  });

  it('changing start measure calls onStartMeasureChange', async () => {
    const onStartMeasureChange = vi.fn();
    render(<Metronome {...defaultProps} onStartMeasureChange={onStartMeasureChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/start at/i), '2');
    expect(onStartMeasureChange).toHaveBeenCalledWith(2);
  });

  it('start measure select is disabled during playback', () => {
    render(<Metronome {...defaultProps} isPlaying={true} />);
    expect(screen.getByLabelText(/start at/i)).toBeDisabled();
  });

  it('editing percentage calls onPercentageChange', async () => {
    const onPercentageChange = vi.fn();
    render(<Metronome {...defaultProps} onPercentageChange={onPercentageChange} />);
    const pctInput = screen.getByRole('spinbutton', { name: /speed percentage/i });
    await userEvent.clear(pctInput);
    await userEvent.type(pctInput, '80');
    await userEvent.tab();
    expect(onPercentageChange).toHaveBeenCalledWith(80);
  });

  it('editing effective tempo back-derives percentage', async () => {
    const onPercentageChange = vi.fn();
    // score tempo = 100 at 100%, effective = 100. Set effective to 80 → pct = 80
    render(
      <Metronome
        {...defaultProps}
        resolvedMeasures={makeResolved([100, 100, 100])}
        percentage={100}
        onPercentageChange={onPercentageChange}
      />
    );
    const effectiveInput = screen.getByRole('spinbutton', { name: /effective tempo/i });
    await userEvent.clear(effectiveInput);
    await userEvent.type(effectiveInput, '80');
    await userEvent.tab();
    expect(onPercentageChange).toHaveBeenCalledWith(80);
  });
});
