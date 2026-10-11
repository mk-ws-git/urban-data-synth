// Generic data model: any source contributes normalized channels on a shared time axis.

export interface Channel {
  id: string; // "temperature_2m", "pm2_5"
  label: string; // "Temperature"
  unit: string; // "°C"
  source: string; // "weather", "air quality", "marine"
  raw: number[];
  normalized: number[]; // 0..1
}

export interface Dataset {
  times: string[]; // shared hourly axis
  channels: Channel[];
}

export type SoundParam =
  | "pitch"
  | "density"
  | "brightness"
  | "loudness"
  | "pan"
  | "reverb";

export const SOUND_PARAMS: SoundParam[] = [
  "pitch",
  "density",
  "brightness",
  "loudness",
  "pan",
  "reverb",
];

export const PARAM_LABELS: Record<SoundParam, string> = {
  pitch: "Pitch",
  density: "Density",
  brightness: "Bright",
  loudness: "Loud",
  pan: "Pan",
  reverb: "Reverb",
};

// One wire in the patch: send a channel to a sound parameter.
export interface Routing {
  channelId: string;
  param: SoundParam;
  invert: boolean;
}

export type MappingMatrix = Routing[];

// Resolved per-step sound description handed to the synth.
export interface Voice {
  freq: number;
  duration: number;
  velocity: number;
  filterCutoff: number;
  pan: number; // -1..1
  reverb: number; // 0..1 wet
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}
