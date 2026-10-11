# Urban Data Synth

A browser synthesizer that turns open **climate and air-quality data** into sound. Pick a city, patch data channels (temperature, wind, humidity, PM2.5, pressure…) to sound parameters in a routing matrix, and play the result as a timeline composition or a live ambient stream. Export what you make as an audio file.

Live demo: _deployed on Cloudflare Pages_ · No API key required — data comes from the free [Open-Meteo](https://open-meteo.com) APIs.

## How it works

```
fetch (Open-Meteo) → normalize to 0..1 → mapping matrix → synth (Tone.js) → scheduler → UI
```

- **Data layer** (`src/data`) — fetches weather, air quality, and marine data, aligns every stream onto one hourly axis, and normalizes each to `0..1`. Any source is just a list of `Channel`s, so adding one is self-contained.
- **Mapping engine** (`src/engine`) — a `MappingMatrix` of `{channel → sound parameter}` routings. Pitches quantize to a musical scale so the output is never accidentally dissonant. Multiple channels on one parameter are averaged.
- **Audio** (`src/audio`) — a Tone.js `PolySynth → filter → panner → reverb` chain, plus a recorder that taps the master output for downloads.
- **Playback** (`src/engine/scheduler.ts`) — `timeline` steps through the full series; `live` re-reads the latest value on an interval. Same `Voice` stream feeds both.

## Sound parameters

| Parameter  | Effect                              |
| ---------- | ----------------------------------- |
| Pitch      | note, quantized to the chosen scale |
| Density    | note length / staccato              |
| Brightness | low-pass filter cutoff              |
| Loudness   | velocity                            |
| Pan        | stereo position                     |
| Reverb     | wet mix                             |

Each routing can be inverted (click a cell: off → on → inverted).

## Run locally

```bash
npm install
npm run dev
```

## Build + deploy (Cloudflare Pages)

```bash
npm run build      # outputs to dist/
npm run deploy     # wrangler pages deploy dist --project-name=urban-data-synth
```

The deploy script needs a Cloudflare login (`npx wrangler login`) or a `CLOUDFLARE_API_TOKEN`. You can also connect the GitHub repo in the Cloudflare Pages dashboard with build command `npm run build` and output directory `dist`.

## Stack

React · TypeScript · Vite · Tone.js · d3-scale · Open-Meteo

## License

MIT
