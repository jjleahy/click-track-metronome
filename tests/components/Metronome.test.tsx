import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Metronome } from '../../src/components/Metronome/Metronome';
import type { ResolvedMeasure } from '../../src/utils/tempoMap';

function makeTempoMap(tempos: number[]): ResolvedMeasure[] {
  return tempos.map((tempo, index) => ({ index, tempo, meter: [4, 4] as [number, number] }));
}

const defaultProps = {
  resolvedTempoMap: makeTempoMap([80, 80, 80]),
  resolvedLabels: [1, 2, 3],
  startMeasureIndex: 0,
  onStartMeasureChange: vi.fn(),
  isPlaying: false,
  onToggle: vi.fn(),
  hasInvalidMeasure: false,
  onSetMeasureTempo: vi.fn(),
};

describe('Metronome', () => {
  it('renders start measure select with labels', () => {
    render(<Metronome {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'm. 1' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'm. 2' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'm. 3' })).toBeTruthy();
  });

  it('tempo input shows resolved tempo for starting measure', () => {
    render(
      <Metronome
        {...defaultProps}
        resolvedTempoMap={makeTempoMap([120, 80, 80])}
        startMeasureIndex={0}
      />
    );
    expect(screen.getByRole('spinbutton', { name: /tempo/i })).toHaveValue(120);
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
    await userEvent.selectOptions(screen.getByRole('combobox'), '2');
    expect(onStartMeasureChange).toHaveBeenCalledWith(2);
  });

  it('start measure select is disabled during playback', () => {
    render(<Metronome {...defaultProps} isPlaying={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('tempo commit on blur calls onSetMeasureTempo', async () => {
    const onSetMeasureTempo = vi.fn();
    render(<Metronome {...defaultProps} onSetMeasureTempo={onSetMeasureTempo} />);
    const tempoInput = screen.getByRole('spinbutton', { name: /tempo/i });
    await userEvent.clear(tempoInput);
    await userEvent.type(tempoInput, '140');
    await userEvent.tab();
    expect(onSetMeasureTempo).toHaveBeenCalledWith(0, 140);
  });
});
