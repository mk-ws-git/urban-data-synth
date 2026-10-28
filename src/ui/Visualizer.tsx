import { useEffect, useRef } from "react";
import type { Channel } from "../data/types";

interface Props {
  channels: Channel[]; // channels to draw (the active ones)
  length: number;
  head: number; // -1 when stopped
}

export function Visualizer({ channels, length, head }: Props) {
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

      // scope grid
      ctx.strokeStyle = "#243019";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= 8; gx++) {
        const x = (w / 8) * gx;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let gy = 0; gy <= 4; gy++) {
        const y = (h / 4) * gy;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (length < 2 || channels.length === 0) return;

      const pad = 8;
      const dx = (w - pad * 2) / (length - 1);
      const traces = ["#9ae66e", "#6fd0c0", "#c9d96a", "#78b36a", "#5c9a8f", "#8f9a5c"];

      channels.forEach((c, ci) => {
        ctx.beginPath();
        for (let i = 0; i < length; i++) {
          const y = pad + (1 - (c.normalized[i] ?? 0.5)) * (h - pad * 2);
          const x = pad + i * dx;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        const col = traces[ci % traces.length];
        ctx.strokeStyle = col;
        ctx.lineWidth = ci === 0 ? 1.8 : 1.2;
        ctx.globalAlpha = ci === 0 ? 1 : 0.7;
        ctx.shadowColor = col;
        ctx.shadowBlur = ci === 0 ? 6 : 2;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (head >= 0) {
        const x = pad + head * dx;
        ctx.strokeStyle = "#f4f1e6";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#f4f1e6";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [channels, length, head]);

  return <canvas ref={ref} className="viz" />;
}
