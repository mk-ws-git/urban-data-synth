import { useEffect, useRef } from "react";
import type { Channel } from "../data/types";

export type VizView = "lines" | "stacked" | "bars";

interface Props {
  channels: Channel[];
  length: number;
  head: number; // -1 when stopped
  view: VizView;
}

const SHADES = ["#ededed", "#aeaeae", "#7c7c7c", "#cfcfcf", "#949494", "#5e5e5e"];
const LABEL_FONT = "11px ui-sans-serif, system-ui, -apple-system, sans-serif";

export function Visualizer({ channels, length, head, view }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (w === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (length < 2 || channels.length === 0) return;

      const pad = 10;
      const dx = (w - pad * 2) / (length - 1);
      const xAt = (i: number) => pad + i * dx;

      if (view === "lines") {
        channels.forEach((c, ci) => {
          ctx.beginPath();
          for (let i = 0; i < length; i++) {
            const y = pad + (1 - (c.normalized[i] ?? 0.5)) * (h - pad * 2);
            const x = xAt(i);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = SHADES[ci % SHADES.length];
          ctx.lineWidth = ci === 0 ? 1.6 : 1;
          ctx.stroke();
        });
        if (head >= 0) {
          channels.forEach((c, ci) => {
            const y = pad + (1 - (c.normalized[head] ?? 0.5)) * (h - pad * 2);
            ctx.fillStyle = SHADES[ci % SHADES.length];
            ctx.beginPath();
            ctx.arc(xAt(head), y, 2.4, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      } else if (view === "stacked") {
        const n = channels.length;
        const laneH = (h - pad * 2) / n;
        channels.forEach((c, ci) => {
          const top = pad + ci * laneH;
          const bottom = top + laneH;
          const ip = Math.min(9, laneH * 0.22);
          if (ci > 0) {
            ctx.strokeStyle = "#242427";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, top);
            ctx.lineTo(w - pad, top);
            ctx.stroke();
          }
          ctx.beginPath();
          for (let i = 0; i < length; i++) {
            const v = c.normalized[i] ?? 0.5;
            const y = bottom - ip - v * (laneH - ip * 2);
            const x = xAt(i);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = SHADES[ci % SHADES.length];
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = "#9a9a9f";
          ctx.font = LABEL_FONT;
          ctx.textBaseline = "top";
          ctx.fillText(c.label.toLowerCase(), pad + 3, top + 3);
        });
      } else {
        // bars — the primary (pitch-driving) channel as a step sequencer
        const c = channels[0];
        const gap = dx > 4 ? 1 : 0;
        const bw = Math.max(1, dx - gap);
        for (let i = 0; i < length; i++) {
          const v = c.normalized[i] ?? 0.5;
          const bh = v * (h - pad * 2);
          ctx.fillStyle = head >= 0 && i === head ? "#ffffff" : "#5e5e5e";
          ctx.fillRect(xAt(i) - bw / 2, h - pad - bh, bw, bh);
        }
        ctx.fillStyle = "#9a9a9f";
        ctx.font = LABEL_FONT;
        ctx.textBaseline = "top";
        ctx.fillText(`${c.label.toLowerCase()} → pitch`, pad + 3, pad + 3);
      }

      // playhead (lines + stacked; bars highlights the active bar instead)
      if (head >= 0 && view !== "bars") {
        const x = xAt(head);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [channels, length, head, view]);

  return <canvas ref={ref} className="viz" />;
}
