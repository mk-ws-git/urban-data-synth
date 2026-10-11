import * as Tone from "tone";

// Captures the master output so a composition can be downloaded as an audio file.
export class Recorder {
  private recorder: Tone.Recorder;

  constructor() {
    this.recorder = new Tone.Recorder();
    // Tap the main output without interrupting playback to the speakers.
    Tone.Destination.connect(this.recorder);
  }

  start() {
    this.recorder.start();
  }

  // Stops recording and triggers a browser download. Returns the file name.
  async stopAndDownload(baseName = "composition"): Promise<string> {
    const blob = await this.recorder.stop();
    const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
    const fileName = `${baseName}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return fileName;
  }

  dispose() {
    this.recorder.dispose();
  }
}
