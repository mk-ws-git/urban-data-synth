import * as Tone from "tone";
import type { Channel, Voice } from "../data/types";
import type { Synth } from "../audio/synth";
import type { MidiOut } from "../audio/midi";

type Resolver = (byId: Map<string, Channel>, index: number) => Voice;

function indexById(channels: Channel[]): Map<string, Channel> {
  return new Map(channels.map((c) => [c.id, c]));
}

export class Scheduler {
  private repeatId: number | null = null;
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private midi: MidiOut | null = null;
  private muted = false;

  constructor(private synth: Synth, private resolve: Resolver) {}

  setMidi(m: MidiOut | null) {
    this.midi = m;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private emit(v: Voice, time?: number) {
    if (!this.muted) this.synth.play(v, time);
    if (this.midi) this.midi.sendVoice(v);
  }

  // Timeline: step through every hour as a composition.
  async playTimeline(
    channels: Channel[],
    length: number,
    bpm = 100,
    onStep?: (i: number) => void,
    onEnd?: () => void,
  ) {
    await Tone.start();
    this.stop();
    const byId = indexById(channels);
    Tone.Transport.bpm.value = bpm;
    let i = 0;
    this.repeatId = Tone.Transport.scheduleRepeat((time) => {
      this.emit(this.resolve(byId, i), time);
      const at = i;
      Tone.Draw.schedule(() => onStep?.(at), time);
      i += 1;
      if (i >= length) {
        this.stop();
        Tone.Draw.schedule(() => onEnd?.(), time);
      }
    }, "8n");
    Tone.Transport.start();
  }

  // Live: sonify the most recent reading on an interval.
  async startLive(
    channels: Channel[],
    index: number,
    intervalMs = 3000,
    onTick?: () => void,
  ) {
    await Tone.start();
    this.stop();
    const byId = indexById(channels);
    const tick = () => {
      this.emit(this.resolve(byId, index));
      onTick?.();
    };
    tick();
    this.liveTimer = setInterval(tick, intervalMs);
  }

  setTempo(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  stop() {
    if (this.repeatId !== null) {
      Tone.Transport.clear(this.repeatId);
      this.repeatId = null;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = null;
    this.midi?.allNotesOff();
  }
}
