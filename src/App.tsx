import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDataset } from "./data/sources";
import type { Dataset, MappingMatrix, SoundParam } from "./data/types";
import { createResolver } from "./engine/mapping";
import { SCALES, type ScaleName } from "./engine/scales";
import { PRESETS, DEFAULT_PRESET } from "./engine/presets";
import { Synth } from "./audio/synth";
import { Recorder } from "./audio/recorder";
import { Scheduler } from "./engine/scheduler";
import { Visualizer } from "./ui/Visualizer";
import { MappingMatrix as MatrixUI } from "./ui/MappingMatrix";
import { LocationSearch } from "./ui/LocationSearch";

const CITIES: Record<string, { latitude: number; longitude: number }> = {
  London: { latitude: 51.51, longitude: -0.13 },
  "New York": { latitude: 40.71, longitude: -74.01 },
  Tokyo: { latitude: 35.68, longitude: 139.69 },
  Reykjavík: { latitude: 64.15, longitude: -21.94 },
  Nairobi: { latitude: -1.29, longitude: 36.82 },
  Sydney: { latitude: -33.87, longitude: 151.21 },
};

export default function App() {
  const [geo, setGeo] = useState<{ latitude: number; longitude: number }>(CITIES.London);
  const [place, setPlace] = useState<string>("London");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [matrix, setMatrix] = useState<MappingMatrix>(DEFAULT_PRESET.matrix);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET.id);
  const [scale, setScale] = useState<ScaleName>(DEFAULT_PRESET.scale);
  const [bpm, setBpm] = useState(DEFAULT_PRESET.bpm);
  const [mode, setMode] = useState<"timeline" | "live">("timeline");
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState(-1);
  const [showPatch, setShowPatch] = useState(false);
  const [status, setStatus] = useState("");

  const synthRef = useRef<Synth | null>(null);
  const schedRef = useRef<Scheduler | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const recordingRef = useRef(false);

  // Casual-first: try to start from the visitor's own location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setPlace("Your location");
      },
      () => {},
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus(`loading ${place}…`);
    setDataset(null);
    fetchDataset(geo, { pastDays: 1, forecastDays: 2 })
      .then((d) => {
        if (cancelled) return;
        setDataset(d);
        setStatus(`${place} · ${d.channels.length} channels · ${d.times.length} hours`);
      })
      .catch((e) => !cancelled && setStatus(`error: ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, [geo, place]);

  const activeChannels = useMemo(() => {
    if (!dataset) return [];
    const ids = new Set(matrix.map((r) => r.channelId));
    const active = dataset.channels.filter((c) => ids.has(c.id));
    return active.length ? active : dataset.channels.slice(0, 4);
  }, [dataset, matrix]);

  const applyPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setMatrix(p.matrix);
    setScale(p.scale);
    setBpm(p.bpm);
    setPresetId(id);
  }, []);

  const cycle = useCallback((channelId: string, param: SoundParam) => {
    setPresetId("custom");
    setMatrix((prev) => {
      const existing = prev.find((r) => r.channelId === channelId && r.param === param);
      if (!existing) return [...prev, { channelId, param, invert: false }];
      if (!existing.invert)
        return prev.map((r) => (r === existing ? { ...r, invert: true } : r));
      return prev.filter((r) => r !== existing);
    });
  }, []);

  const finish = useCallback(
    async (download: boolean) => {
      schedRef.current?.stop();
      if (recRef.current) {
        if (download) {
          const slug = place.split(",")[0].trim().replace(/\s+/g, "-").toLowerCase();
          const name = await recRef.current.stopAndDownload(`${slug}-${scale}`);
          setStatus(`downloaded ${name}`);
        }
        recRef.current.dispose();
        recRef.current = null;
      }
      recordingRef.current = false;
      setPlaying(false);
      setHead(-1);
    },
    [place, scale],
  );

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
      setStatus(record ? "recording…" : "playing…");

      if (mode === "timeline") {
        await sched.playTimeline(dataset.channels, dataset.times.length, bpm, setHead, () =>
          void finish(recordingRef.current),
        );
      } else {
        await sched.startLive(dataset.channels, dataset.times.length - 1);
      }
    },
    [dataset, matrix, scale, mode, bpm, finish],
  );

  const length = dataset?.times.length ?? 0;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-head">
          <div className="brand">URBAN DATA SYNTH</div>
          <div className="readout">{status || place}</div>
          <a className="src" href="https://github.com/mk-ws-git/urban-data-synth" target="_blank" rel="noreferrer">
            SRC
          </a>
        </div>

        <div className="screen">
          <Visualizer channels={activeChannels} length={length} head={head} />
        </div>

        <div className="module transport">
          {!playing ? (
            <button className="btn-play" disabled={!dataset} onClick={() => start(false)}>
              PLAY
            </button>
          ) : (
            <button className="btn-play" onClick={() => finish(recordingRef.current)}>
              STOP
            </button>
          )}
          <button className="btn-rec" disabled={!dataset || playing} onClick={() => start(true)}>
            <span className="rec-dot" />
            {mode === "timeline" ? "REC + SAVE" : "REC"}
          </button>

          <div className="seg" role="group" aria-label="Playback mode">
            <button className={mode === "timeline" ? "on" : ""} onClick={() => setMode("timeline")}>
              TIMELINE
            </button>
            <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>
              LIVE
            </button>
          </div>

          <div className="ctl">
            SCALE
            <select value={scale} onChange={(e) => setScale(e.target.value as ScaleName)}>
              {Object.keys(SCALES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="ctl" style={{ marginLeft: "auto" }}>
            TEMPO
            <input
              type="range"
              min={60}
              max={160}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
            <span className="lcd">{bpm}</span>
          </div>
        </div>

        <div className="module">
          <div className="mod-label">Presets</div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={presetId === p.id ? "preset on" : "preset"}
                onClick={() => applyPreset(p.id)}
              >
                <span className="p-name">{p.label}</span>
                <span className="p-blurb">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="module">
          <div className="mod-label">Location</div>
          <div className="locrow">
            <LocationSearch
              current={place}
              onSelect={(p) => {
                setGeo({ latitude: p.latitude, longitude: p.longitude });
                setPlace(p.label);
              }}
            />
            {Object.keys(CITIES).map((c) => (
              <button
                key={c}
                className={place === c ? "chip active" : "chip"}
                onClick={() => {
                  setGeo(CITIES[c]);
                  setPlace(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <button className="patch-toggle" onClick={() => setShowPatch((v) => !v)}>
          {showPatch ? "▾ PATCH BAY" : "▸ PATCH BAY — route data to sound"}
        </button>

        {showPatch && dataset && (
          <div className="module">
            <div className="mod-label">Patch · click a cell: off → on → inverted</div>
            <MatrixUI channels={dataset.channels} matrix={matrix} onCycle={cycle} />
            <div className="legend">
              <span><span className="s dot on" style={{ background: "var(--accent)" }} />active</span>
              <span><span className="s dot inv" style={{ border: "1.5px solid var(--accent)" }} />inverted</span>
              <span><span className="s dot off" />open</span>
            </div>
          </div>
        )}

        <div className="status">{status}</div>
      </div>
      <div className="footnote">live climate + air-quality data · open-meteo</div>
    </div>
  );
}
