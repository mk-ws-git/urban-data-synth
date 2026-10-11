import * as Tone from "tone";
import type { Voice } from "../data/types";

// Signal chain: PolySynth -> filter -> panner -> reverb -> master -> speakers.
export class Synth {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private panner: Tone.Panner;
  private reverb: Tone.Reverb;
  readonly master: Tone.Gain;

  constructor() {
    this.master = new Tone.Gain(0.9).toDestination();
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(this.master);
    this.panner = new Tone.Panner(0).connect(this.reverb);
    this.filter = new Tone.Filter(2000, "lowpass").connect(this.panner);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 1.2 },
    }).connect(this.filter);
    this.synth.volume.value = -8;
  }

  play(v: Voice, time?: number) {
    const t = time ?? Tone.now();
    this.filter.frequency.setValueAtTime(v.filterCutoff, t);
    this.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, v.pan)), t);
    this.reverb.wet.setValueAtTime(Math.max(0, Math.min(1, v.reverb)), t);
    this.synth.triggerAttackRelease(v.freq, v.duration, t, v.velocity);
  }

  dispose() {
    this.synth.dispose();
    this.filter.dispose();
    this.panner.dispose();
    this.reverb.dispose();
    this.master.dispose();
  }
}
