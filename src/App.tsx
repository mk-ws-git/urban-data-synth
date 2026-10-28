import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDataset } from "./data/sources";
import type { Dataset, MappingMatrix, SoundParam } from "./data/types";
import { createResolver } from "./engine/mapping";
import { SCALES, type ScaleName } from "./engine/scales";
import { PRESETS, DEFAULT_PRESET } from "./engine/presets";
import { Synth } from "./audio/synth";
import { Recorder } from "./audio/recorder";
import { MidiOut, type MidiPort } from "./audio/midi";
import { Scheduler } from "./engine/scheduler";
import { Visualizer, type VizView } from "./ui/Visualizer";
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
  const [view, setView] = useState<VizView>("lines");
  const [midiPorts, setMidiPorts] = useState<MidiPort[]>([]);
  const [midiId, setMidiId] = useState("");
  const [midiOn, setMidiOn] = useState(false);
  const [midiMute, setMidiMute] = useState(false);
  const [midiErr, setMidiErr] = useState("");
  const [status, setStatus] = useState("");

  const midiRef = useRef<MidiOut | null>(null);

  const synthRef = useRef<Synth | null>(null);
  const schedRef = useRef<Scheduler | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const recordingRef = useRef(false);
  const resolverRef = useRef<ReturnType<typeof createResolver> | null>(null);

  // Keep the resolver current so preset / scale changes update the sound live.
  useEffect(() => {
    resolverRef.current = createResolver(matrix, { scale });
  }, [matrix, scale]);

  // Live tempo updates (slider + preset bpm) while playing.
  useEffect(() => {
    schedRef.current?.setTempo(bpm);
  }, [bpm]);

  // Push MIDI routing / mute to a running scheduler live.
  useEffect(() => {
    schedRef.current?.setMidi(midiOn ? midiRef.current : null);
  }, [midiOn]);
  useEffect(() => {
    schedRef.current?.setMuted(midiMute);
  }, [midiMute]);

  const enableMidi = useCallback(async () => {
    try {
      if (!midiRef.current) midiRef.current = new MidiOut();
      const ports = await midiRef.current.init();
      setMidiPorts(ports);
      if (!ports.length) {
        setMidiErr("No MIDI outputs found — open a DAW or a virtual port (IAC Driver on macOS, loopMIDI on Windows).");
        return;
      }
      midiRef.current.select(ports[0].id);
      setMidiId(ports[0].id);
      setMidiOn(true);
      setMidiErr("");
    } catch (e) {
      setMidiErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const selectMidi = useCallback((id: string) => {
    setMidiId(id);
    midiRef.current?.select(id);
  }, []);

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
      resolverRef.current = createResolver(matrix, { scale });
      const sched = new Scheduler(synthRef.current, (byId, i) => resolverRef.current!(byId, i));
      sched.setMidi(midiOn ? midiRef.current : null);
      sched.setMuted(midiMute);
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
    [dataset, matrix, scale, mode, bpm, midiOn, midiMute, finish],
  );

  const length = dataset?.times.length ?? 0;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-head">
          <div className="brand">Urban Data Synth</div>
          <div className="readout">{status || place}</div>
          <a className="src" href="https://github.com/mk-ws-git/urban-data-synth" target="_blank" rel="noreferrer">
            SRC
          </a>
        </div>

        <div className="screen">
          <Visualizer channels={activeChannels} length={length} head={head} view={view} />
        </div>
        <div className="viewbar">
          <div className="seg sm" role="group" aria-label="Visualization view">
            {(["lines", "stacked", "bars"] as VizView[]).map((v) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="module transport">
          {!playing ? (
            <button className="btn-play" disabled={!dataset} onClick={() => start(false)}>
              Play
            </button>
          ) : (
            <button className="btn-play" onClick={() => finish(recordingRef.current)}>
              Stop
            </button>
          )}
          <button className="btn-rec" disabled={!dataset || playing} onClick={() => start(true)}>
            <span className="rec-dot" />
            {mode === "timeline" ? "Rec + save" : "Rec"}
          </button>

          <div className="seg" role="group" aria-label="Playback mode">
            <button className={mode === "timeline" ? "on" : ""} onClick={() => setMode("timeline")}>
              Timeline
            </button>
            <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>
              Live
            </button>
          </div>

          <div className="ctl">
            Scale
            <select value={scale} onChange={(e) => setScale(e.target.value as ScaleName)}>
              {Object.keys(SCALES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="ctl" style={{ marginLeft: "auto" }}>
            Tempo
            <input
              type="range"
              min={60}
              max={160}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
            <span className="tempo-val">{bpm}</span>
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
                title={p.blurb}
              >
                {p.label}
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

        <div className="module">
          <div className="mod-label">MIDI output</div>
          {!MidiOut.supported() ? (
            <div className="status">Web MIDI needs Chrome or Edge. Drive a DAW there.</div>
          ) : !midiOn ? (
            <div className="locrow">
              <button onClick={enableMidi}>Enable MIDI output</button>
              <span className="status">Send notes to Ableton, TouchDesigner, etc.</span>
              {midiErr && <span className="status">{midiErr}</span>}
            </div>
          ) : (
            <div className="locrow">
              <div className="ctl">
                Device
                <select value={midiId} onChange={(e) => selectMidi(e.target.value)}>
                  {midiPorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="ctl" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={midiMute} onChange={(e) => setMidiMute(e.target.checked)} />
                Mute internal synth
              </label>
              <button onClick={() => setMidiOn(false)}>Disable</button>
            </div>
          )}
        </div>

        <button className="patch-toggle" onClick={() => setShowPatch((v) => !v)}>
          {showPatch ? "▾ Patch bay" : "▸ Patch bay — route data to sound"}
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
