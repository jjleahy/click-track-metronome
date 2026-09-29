import { describe, it, expect } from 'vitest';
import { makeTanhCurve } from '../../src/audio/masterOutput';

describe('makeTanhCurve', () => {
  const range = 4;
  const curve = makeTanhCurve(range, 2049);

  it('is odd-symmetric and passes through zero', () => {
    const mid = (curve.length - 1) / 2;
    expect(curve[mid]).toBeCloseTo(0, 6);
    expect(curve[0]).toBeCloseTo(-curve[curve.length - 1], 6);
  });

  it('never exceeds ±1', () => {
    for (const v of curve) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('is nearly linear (unity slope in boosted-signal units) for small signals', () => {
    // curve index → shaper input x in [-1, 1] → boosted signal x * range
    const i = Math.round(((0.05 / range + 1) / 2) * (curve.length - 1));
    const x = (i / (curve.length - 1)) * 2 - 1;
    expect(curve[i]).toBeCloseTo(x * range, 2);
  });

  it('is monotonically non-decreasing', () => {
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
  });
});
