export interface Beat {
  subdivisions: number; // how many lower units this beat groups (e.g., 3 for dotted quarter in x/8)
  hold: number | null;  // hold duration in seconds, or null for normal playback
}

export interface GradualTempo {
  measureLength: number; // how many measures the change spans (0 = same measure only)
  // TODO: type: "geometric" | "linear" | "quadratic" — always geometric for now
}

export interface Measure {
  meter: [number, number];              // e.g., [6, 8] for 6/8
  beats: Beat[];
  tempo: number | null;                 // explicit tempo marking, or null to inherit
  rehearsalNumber: string | number | null; // display label override
  gradualTempo: GradualTempo | null;    // accel/rit starting from this measure
}

export interface Exercise {
  id: string;       // GUID
  name: string;
  measures: Measure[];
}
