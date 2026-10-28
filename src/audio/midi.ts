import type { Voice } from "../data/types";

export interface MidiPort {
  id: string;
  name: string;
}

// Sends each Voice out over Web MIDI so the synth can drive a DAW
// (Ableton, TouchDesigner, etc.). Chrome/Edge only; Safari/Firefox lack it.
export class MidiOut {
  private access: any = null;
  private out: any = null;

  static supported(): boolean {
    return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  }

  async init(): Promise<MidiPort[]> {
    if (!MidiOut.supported()) throw new Error("Web MIDI isn't available in this browser (use Chrome or Edge)");
    this.access = await (navigator as any).requestMIDIAccess({ sysex: false });
    return this.ports();
  }

  ports(): MidiPort[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values()).map((o: any) => ({
      id: o.id,
      name: o.name ?? o.id,
    }));
  }

  select(id: string) {
    this.out = this.access?.outputs.get(id) ?? null;
  }

  get ready(): boolean {
    return !!this.out;
  }

  private cc(num: number, value: number) {
    if (this.out) this.out.send([0xb0, num, Math.max(0, Math.min(127, Math.round(value)))]);
  }

  sendVoice(v: Voice) {
    if (!this.out) return;
    const note = Math.max(0, Math.min(127, Math.round(v.midi)));
    const vel = Math.max(1, Math.min(127, Math.round(v.velocity * 127)));
    // continuous params as CC: brightness=74, pan=10, reverb=91
    this.cc(74, ((v.filterCutoff - 500) / 7500) * 127);
    this.cc(10, ((v.pan + 1) / 2) * 127);
    this.cc(91, v.reverb * 127);
    this.out.send([0x90, note, vel]); // note on
    this.out.send([0x80, note, 0], performance.now() + Math.max(60, v.duration * 1000)); // note off
  }

  allNotesOff() {
    if (this.out) this.out.send([0xb0, 123, 0]);
  }
}
