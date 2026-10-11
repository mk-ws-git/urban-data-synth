export const SCALES = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
} as const;

export type ScaleName = keyof typeof SCALES;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Map 0..1 -> a MIDI note snapped to `scale`, spanning `octaves` from `rootMidi`.
export function quantizeToScale(
  value: number,
  scale: ScaleName,
  rootMidi = 48,
  octaves = 3,
): number {
  const intervals = SCALES[scale];
  const notes: number[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const semis of intervals) notes.push(rootMidi + o * 12 + semis);
  }
  const clamped = Math.max(0, Math.min(1, value));
  const idx = Math.round(clamped * (notes.length - 1));
  return notes[idx];
}
