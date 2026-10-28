import { scaleLinear } from "d3-scale";
import type { Channel, Dataset, GeoPoint } from "./types";

// --- normalization -------------------------------------------------------

// Physically meaningful ranges. Blending the absolute range with each series'
// own range is what makes changing location actually change the sound: a warm
// city sits higher than a cold one, while a single day keeps musical movement.
const DOMAINS: Record<string, [number, number]> = {
  temperature_2m: [-20, 45],
  relative_humidity_2m: [0, 100],
  wind_speed_10m: [0, 60],
  precipitation: [0, 15],
  surface_pressure: [980, 1040],
  cloud_cover: [0, 100],
  uv_index: [0, 12],
  pm2_5: [0, 150],
  pm10: [0, 200],
  nitrogen_dioxide: [0, 150],
  ozone: [0, 240],
  wave_height: [0, 10],
  swell_wave_period: [0, 20],
};

function localNorm(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return values.map(() => 0.5);
  const s = scaleLinear().domain([min, max]).range([0, 1]).clamp(true);
  return values.map((v) => s(v));
}

function channel(
  id: string,
  label: string,
  unit: string,
  source: string,
  raw: number[],
): Channel {
  const clean = raw.map((v) => (Number.isFinite(v) ? v : 0));
  const local = localNorm(clean);
  const dom = DOMAINS[id];
  const normalized = dom
    ? clean.map((v, i) => {
        const abs = Math.max(0, Math.min(1, (v - dom[0]) / (dom[1] - dom[0])));
        return 0.5 * local[i] + 0.5 * abs;
      })
    : local;
  return { id, label, unit, source, raw: clean, normalized };
}

interface FetchOpts {
  pastDays?: number;
  forecastDays?: number;
}

// --- source adapters -----------------------------------------------------

const WEATHER_FIELDS: Record<string, [string, string]> = {
  temperature_2m: ["Temperature", "°C"],
  relative_humidity_2m: ["Humidity", "%"],
  wind_speed_10m: ["Wind speed", "km/h"],
  precipitation: ["Precipitation", "mm"],
  surface_pressure: ["Pressure", "hPa"],
  cloud_cover: ["Cloud cover", "%"],
  uv_index: ["UV index", ""],
};

const AIR_FIELDS: Record<string, [string, string]> = {
  pm2_5: ["PM2.5", "µg/m³"],
  pm10: ["PM10", "µg/m³"],
  nitrogen_dioxide: ["NO₂", "µg/m³"],
  ozone: ["Ozone", "µg/m³"],
};

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchWeather(p: GeoPoint, o: FetchOpts): Promise<Partial<Dataset>> {
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    hourly: Object.keys(WEATHER_FIELDS).join(","),
    past_days: String(o.pastDays ?? 0),
    forecast_days: String(o.forecastDays ?? 2),
    timezone: "auto",
  });
  const j = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const channels = Object.entries(WEATHER_FIELDS).map(([key, [label, unit]]) =>
    channel(key, label, unit, "weather", j.hourly[key] ?? []),
  );
  return { times: j.hourly.time as string[], channels };
}

async function fetchAirQuality(p: GeoPoint, o: FetchOpts): Promise<Channel[]> {
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    hourly: Object.keys(AIR_FIELDS).join(","),
    past_days: String(o.pastDays ?? 0),
    forecast_days: String(o.forecastDays ?? 2),
    timezone: "auto",
  });
  const j = await fetchJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`,
  );
  return Object.entries(AIR_FIELDS).map(([key, [label, unit]]) =>
    channel(key, label, unit, "air quality", j.hourly[key] ?? []),
  );
}

async function fetchMarine(p: GeoPoint, o: FetchOpts): Promise<Channel[]> {
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    hourly: "wave_height,swell_wave_period",
    past_days: String(o.pastDays ?? 0),
    forecast_days: String(o.forecastDays ?? 2),
    timezone: "auto",
  });
  const j = await fetchJson(
    `https://marine-api.open-meteo.com/v1/marine?${params}`,
  );
  return [
    channel("wave_height", "Wave height", "m", "marine", j.hourly.wave_height ?? []),
    channel("swell_wave_period", "Swell period", "s", "marine", j.hourly.swell_wave_period ?? []),
  ];
}

// Trim every channel to the shortest length so indices stay aligned.
function align(times: string[], channels: Channel[]): Dataset {
  const len = Math.min(times.length, ...channels.map((c) => c.raw.length));
  return {
    times: times.slice(0, len),
    channels: channels
      .filter((c) => c.raw.length >= len && len > 0)
      .map((c) => ({
        ...c,
        raw: c.raw.slice(0, len),
        normalized: c.normalized.slice(0, len),
      })),
  };
}

// Fetch weather (required) + air quality + marine (best-effort) into one Dataset.
export async function fetchDataset(p: GeoPoint, o: FetchOpts = {}): Promise<Dataset> {
  const weather = await fetchWeather(p, o);
  const times = weather.times ?? [];
  let channels = [...(weather.channels ?? [])];

  const extras = await Promise.allSettled([
    fetchAirQuality(p, o),
    fetchMarine(p, o),
  ]);
  for (const r of extras) {
    if (r.status === "fulfilled") channels = channels.concat(r.value);
  }

  return align(times, channels);
}
