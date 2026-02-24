import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Measure } from '../../src/components/ScoreEditor/Measure';
import type { Measure as MeasureData } from '../../src/models/Exercise';
import { defaultBeats } from '../../src/utils/subdivisionDefaults';

function make44(): MeasureData {
  return {
    meter: [4, 4],
    beats: defaultBeats(4, 4),
    tempo: null,
    rehearsalNumber: null,
    gradualTempo: null,
  };
}

const defaultProps = {
  resolvedLabel: 1,
  resolvedTempo: 80,
  isActive: false,
  canDelete: true,
  onChange: vi.fn(),
  onDelete: vi.fn(),
  onInsertAfter: vi.fn(),
};

describe('Measure', () => {
  it('renders 4 subdivision inputs for 4/4', () => {
    render(<Measure {...defaultProps} measure={make44()} />);
    const inputs = screen.getAllByRole('spinbutton', { name: /beat \d+ subdivisions/i });
    expect(inputs).toHaveLength(4);
  });

  it('does not have invalid class when valid', () => {
    const { container } = render(<Measure {...defaultProps} measure={make44()} />);
    expect(container.firstChild).not.toHaveClass('measure--invalid');
  });

  it('has invalid class when sum does not equal numerator', () => {
    const measure: MeasureData = {
      ...make44(),
      beats: [{ subdivisions: 1, hold: null }, { subdivisions: 1, hold: null }], // sum=2, not 4
    };
    const { container } = render(<Measure {...defaultProps} measure={measure} />);
    expect(container.firstChild).toHaveClass('measure--invalid');
  });

  it('has active class when isActive', () => {
    const { container } = render(
      <Measure {...defaultProps} measure={make44()} isActive={true} />
    );
    expect(container.firstChild).toHaveClass('measure--active');
  });

  it('numerator change resets beats via defaultBeats', () => {
    const onChange = vi.fn();
    render(<Measure {...defaultProps} measure={make44()} onChange={onChange} />);
    const numInput = screen.getByRole('spinbutton', { name: /time signature numerator/i });
    fireEvent.change(numInput, { target: { value: '6' } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as MeasureData;
    expect(lastCall.meter[0]).toBe(6);
    expect(lastCall.beats.reduce((s, b) => s + b.subdivisions, 0)).toBe(6);
  });

  it('denominator change resets beats via defaultBeats', async () => {
    const onChange = vi.fn();
    render(<Measure {...defaultProps} measure={make44()} onChange={onChange} />);
    const denomSelect = screen.getByRole('combobox', { name: /time signature denominator/i });
    await userEvent.selectOptions(denomSelect, '8');
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as MeasureData;
    expect(lastCall.meter[1]).toBe(8);
    expect(lastCall.beats.reduce((s, b) => s + b.subdivisions, 0)).toBe(4);
  });

  it('subdivision overflow trimming calls onChange with trimmed beats', async () => {
    // 8/8 [3,3,2] — change first input to 4 → should trim to [4,3]
    const onChange = vi.fn();
    const measure: MeasureData = {
      meter: [8, 8],
      beats: [
        { subdivisions: 3, hold: null },
        { subdivisions: 3, hold: null },
        { subdivisions: 2, hold: null },
      ],
      tempo: null,
      rehearsalNumber: null,
      gradualTempo: null,
    };
    render(<Measure {...defaultProps} measure={measure} onChange={onChange} />);
    const beatInputs = screen.getAllByRole('spinbutton', { name: /beat \d+ subdivisions/i });
    fireEvent.change(beatInputs[0], { target: { value: '4' } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as MeasureData;
    expect(lastCall.beats.map((b) => b.subdivisions)).toEqual([4, 3]);
  });

  it('delete button calls onDelete', async () => {
    const onDelete = vi.fn();
    render(<Measure {...defaultProps} measure={make44()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /delete measure/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('insert-after button calls onInsertAfter', async () => {
    const onInsertAfter = vi.fn();
    render(<Measure {...defaultProps} measure={make44()} onInsertAfter={onInsertAfter} />);
    await userEvent.click(screen.getByRole('button', { name: /insert measure after/i }));
    expect(onInsertAfter).toHaveBeenCalledOnce();
  });

  it('canDelete=false disables delete button', () => {
    render(<Measure {...defaultProps} measure={make44()} canDelete={false} />);
    expect(screen.getByRole('button', { name: /delete measure/i })).toBeDisabled();
  });

  it('tempo input commit on blur sets explicit tempo', async () => {
    const onChange = vi.fn();
    render(<Measure {...defaultProps} measure={make44()} onChange={onChange} />);
    const tempoInput = screen.getByRole('spinbutton', { name: /tempo/i });
    await userEvent.clear(tempoInput);
    await userEvent.type(tempoInput, '120');
    await userEvent.tab(); // blur
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as MeasureData;
    expect(lastCall.tempo).toBe(120);
  });

  it('clearing tempo input on blur sets tempo to null', async () => {
    const onChange = vi.fn();
    const measure: MeasureData = { ...make44(), tempo: 120 };
    render(<Measure {...defaultProps} measure={measure} onChange={onChange} />);
    const tempoInput = screen.getByRole('spinbutton', { name: /tempo/i });
    await userEvent.clear(tempoInput);
    await userEvent.tab();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as MeasureData;
    expect(lastCall.tempo).toBeNull();
  });
});
