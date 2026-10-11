import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDataset } from "./data/sources";
import type { Dataset, MappingMatrix, SoundParam } from "./data/types";
import { createResolver } from "./engine/mapping";
import { SCALES, type ScaleName } from "./engine/scales";
import { Synth } from "./audio/synth";
import { Recorder } from "./audio/recorder";
import { Scheduler } from "./engine/scheduler";
import { Visualizer } from "./ui/Visualizer";
import { MappingMatrix as MatrixUI } from "./ui/MappingMatrix";

const CITIES: Record<string, { latitude: number; longitude: number }> = {
  London: { latitude: 51.51, longitude: -0.13 },
  "New York": { latitude: 40.71, longitude: -74.01 },
  Tokyo: { latitude: 35.68, longitude: 139.69 },
  Reykjavík: { latitude: 64.15, longitude: -21.94 },
  Nairobi: { latitude: -1.29, longitude: 36.82 },
};

const DEFAULT_MATRIX: MappingMatrix = [
  { channelId: "temperature_2m", param: "pitch", invert: false },
  { channelId: "wind_speed_10m", param: "density", invert: false },
  { channelId: "relative_humidity_2m", param: "brightness", invert: false },
  { channelId: "pm2_5", param: "loudness", invert: false },
  { channelId: "surface_pressure", param: "pan", invert: false },
  { channelId: "precipitation", param: "reverb", invert: false },
];

export default function App() {
  const [city, setCity] = useState<string>("London");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [matrix, setMatrix] = useState<MappingMatrix>(DEFAULT_MATRIX);
  const [scale, setScale] = useState<ScaleName>("minorPentatonic");
  const [bpm, setBpm] = useState(100);
  const [mode, setMode] = useState<"timeline" | "live">("timeline");
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState(-1);
  const [status, setStatus] = useState("");

  const synthRef = useRef<Synth | null>(null);
  const schedRef = useRef<Scheduler | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(`Loading ${city}…`);
    setDataset(null);
    fetchDataset(CITIES[city], { pastDays: 1, forecastDays: 2 })
      .then((d) => {
        if (cancelled) return;
        setDataset(d);
        setStatus(`${d.channels.length} channels · ${d.times.length} hours`);
      })
      .catch((e) => !cancelled && setStatus(`Error: ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, [city]);

  const activeChannels = useMemo(() => {
    if (!dataset) return [];
    const ids = new Set(matrix.map((r) => r.channelId));
    const active = dataset.channels.filter((c) => ids.has(c.id));
    return active.length ? active : dataset.channels.slice(0, 4);
  }, [dataset, matrix]);

  const cycle = useCallback((channelId: string, param: SoundParam) => {
    setMatrix((prev) => {
      const existing = prev.find((r) => r.channelId === channelId && r.param === param);
      if (!existing) return [...prev, { channelId, param, invert: false }];
      if (!existing.invert)
        return prev.map((r) => (r === existing ? { ...r, invert: true } : r));
      return prev.filter((r) => r !== existing);
    });
  }, []);

  const finish = useCallback(async (download: boolean) => {
    schedRef.current?.stop();
    if (recRef.current) {
      if (download) {
        const name = await recRef.current.stopAndDownload(`${city}-${scale}`);
        setStatus(`Downloaded ${name}`);
      }
      recRef.current.dispose();
      recRef.current = null;
    }
    recordingRef.current = false;
    setPlaying(false);
    setHead(-1);
  }, [city, scale]);

  const start = useCallback(
    async (record: boolean) => {
      if (!dataset || dataset.times.length === 0) return;
      if (!synthRef.current) synthRef.current = new Synth();
      const resolver = createResolver(matrix, { scale });
      const sched = new Scheduler(synthRef.current, resolver);
      schedRef.current = sched;

      if (record) {
        recRef.current = new Recorder();
        recRef.current.start();
        recordingRef.current = true;
      }
      setPlaying(true);
      setStatus(record ? "Recording…" : "Playing…");

      if (mode === "timeline") {
        await sched.playTimeline(
          dataset.channels,
          dataset.times.length,
          bpm,
          setHead,
          () => void finish(recordingRef.current),
        );
      } else {
        await sched.startLive(dataset.channels, dataset.times.length - 1);
      }
    },
    [dataset, matrix, scale, mode, bpm, finish],
  );

  const length = dataset?.times.length ?? 0;

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Urban Data Synth</h1>
          <div className="sub">Open climate and air-quality data, played as sound.</div>
        </div>
        <a href="https://github.com/mk-ws-git/urban-data-synth" target="_blank" rel="noreferrer">
          source
        </a>
      </div>

      <Visualizer channels={activeChannels} length={length} head={head} />

      <div className="transport">
        {!playing ? (
          <button className="primary" disabled={!dataset} onClick={() => start(false)}>
            Play
          </button>
        ) : (
          <button onClick={() => finish(recordingRef.current)}>Stop</button>
        )}
        <button disabled={!dataset || playing} onClick={() => start(true)}>
          {mode === "timeline" ? "Record + download" : "Record (stop to save)"}
        </button>
        <div className="grid-controls" style={{ marginLeft: "auto" }}>
          <label>
            City
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {Object.keys(CITIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Scale
            <select value={scale} onChange={(e) => setScale(e.target.value as ScaleName)}>
              {Object.keys(SCALES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as "timeline" | "live")}>
              <option value="timeline">Timeline</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label>
            Tempo {bpm}
            <input
              type="range"
              min={60}
              max={160}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="status">{status}</div>

      <div className="section-label">Routing · click to patch a channel to a parameter (off → on → inverted)</div>
      {dataset && <MatrixUI channels={dataset.channels} matrix={matrix} onCycle={cycle} />}
      <div className="legend">
        <span><span className="s dot on" style={{ background: "var(--accent)" }} />active</span>
        <span><span className="s dot inv" style={{ border: "1.5px solid var(--accent)" }} />inverted</span>
        <span><span className="s dot off" />open</span>
      </div>
    </div>
  );
}
