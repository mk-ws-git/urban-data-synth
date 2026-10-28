import type {
  Channel,
  MappingMatrix,
  SoundParam,
  Voice,
} from "../data/types";
import { midiToFreq, quantizeToScale, type ScaleName } from "./scales";

export interface MappingConfig {
  scale: ScaleName;
  rootMidi?: number;
  octaves?: number;
}

// Average every channel routed to a parameter (inverting where asked).
// Returns null when no channel drives that parameter, so a default can apply.
function paramValue(
  param: SoundParam,
  matrix: MappingMatrix,
  byId: Map<string, Channel>,
  index: number,
): number | null {
  const routes = matrix.filter((r) => r.param === param);
  if (routes.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const r of routes) {
    const ch = byId.get(r.channelId);
    if (!ch) continue;
    const v = ch.normalized[index] ?? 0.5;
    sum += r.invert ? 1 - v : v;
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

export function createResolver(matrix: MappingMatrix, cfg: MappingConfig) {
  const { scale, rootMidi = 48, octaves = 3 } = cfg;

  return function resolve(byId: Map<string, Channel>, index: number): Voice {
    const pitch = paramValue("pitch", matrix, byId, index) ?? 0.5;
    const density = paramValue("density", matrix, byId, index) ?? 0.4;
    const brightness = paramValue("brightness", matrix, byId, index) ?? 0.6;
    const loudness = paramValue("loudness", matrix, byId, index);
    const pan = paramValue("pan", matrix, byId, index) ?? 0.5;
    const reverb = paramValue("reverb", matrix, byId, index) ?? 0.35;

    const midi = quantizeToScale(pitch, scale, rootMidi, octaves);
    return {
      midi,
      freq: midiToFreq(midi),
      duration: 0.6 - density * 0.45, // denser data -> shorter, staccato notes
      velocity: loudness === null ? 0.7 : 0.2 + loudness * 0.8,
      filterCutoff: 500 + brightness * 7500, // 500..8000 Hz
      pan: pan * 2 - 1, // 0..1 -> -1..1
      reverb,
    };
  };
}
