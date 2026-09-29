// Master output stage: boost → tanh soft clipper → destination.
// Every click connects to the returned node instead of audioCtx.destination.

// Linear gain applied to all clicks before soft clipping. 1 = no boost, 3 ≈ +9.5 dB.
export const MASTER_BOOST = 3;

// The WaveShaperNode only sees inputs in [-1, 1], so the curve is defined over that range
// but represents boosted-signal values in [-CURVE_RANGE, CURVE_RANGE]. Beyond this range
// the output holds at tanh(CURVE_RANGE) ≈ 0.9993.
const CURVE_RANGE = 4;
const CURVE_SAMPLES = 2048;

export function makeTanhCurve(range = CURVE_RANGE, samples = CURVE_SAMPLES): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // [-1, 1]
    curve[i] = Math.tanh(x * range);
  }
  return curve;
}

export function createMasterOutput(audioCtx: AudioContext, boost = MASTER_BOOST): AudioNode {
  // Gain of boost / CURVE_RANGE feeding the shaper means the curve computes tanh(signal * boost).
  const gain = audioCtx.createGain();
  gain.gain.value = boost / CURVE_RANGE;

  const shaper = audioCtx.createWaveShaper();
  shaper.curve = makeTanhCurve();
  shaper.oversample = '4x'; // limit aliasing from the nonlinearity

  gain.connect(shaper);
  shaper.connect(audioCtx.destination);
  return gain;
}
