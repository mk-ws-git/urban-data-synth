import type { MappingMatrix } from "../data/types";
import type { ScaleName } from "./scales";

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  scale: ScaleName;
  bpm: number;
  matrix: MappingMatrix;
}

const r = (channelId: string, param: MappingMatrix[number]["param"], invert = false) => ({
  channelId,
  param,
  invert,
});

// Each preset bundles a mapping + scale + tempo. The default "Signature" patch
// follows the principle: the weather should sound like itself.
export const PRESETS: Preset[] = [
  {
    id: "signature",
    label: "Signature",
    blurb: "The full weather, mapped to sound",
    scale: "minorPentatonic",
    bpm: 100,
    matrix: [
      r("temperature_2m", "pitch"),
      r("cloud_cover", "brightness", true), // clear sky = bright
      r("wind_speed_10m", "density"),
      r("precipitation", "loudness"),
      r("relative_humidity_2m", "reverb"),
      r("surface_pressure", "pan"),
    ],
  },
  {
    id: "ambient",
    label: "Ambient",
    blurb: "Slow, spacious, calm",
    scale: "majorPentatonic",
    bpm: 76,
    matrix: [
      r("temperature_2m", "pitch"),
      r("relative_humidity_2m", "reverb"),
      r("surface_pressure", "pan"),
      r("uv_index", "brightness"),
    ],
  },
  {
    id: "storm",
    label: "Storm watch",
    blurb: "Wind and rain drive the energy",
    scale: "minorPentatonic",
    bpm: 124,
    matrix: [
      r("temperature_2m", "pitch"),
      r("wind_speed_10m", "density"),
      r("precipitation", "loudness"),
      r("cloud_cover", "brightness", true),
      r("relative_humidity_2m", "reverb"),
    ],
  },
  {
    id: "air",
    label: "Clean vs polluted",
    blurb: "Air quality shapes the tone",
    scale: "dorian",
    bpm: 100,
    matrix: [
      r("temperature_2m", "pitch"),
      r("pm2_5", "loudness"),
      r("pm10", "brightness", true), // more pollution = darker
      r("nitrogen_dioxide", "density"),
      r("ozone", "reverb"),
    ],
  },
];

export const DEFAULT_PRESET = PRESETS[0];
