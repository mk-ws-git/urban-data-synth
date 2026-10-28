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
      if (length < 2 || channels.length === 0) return;

      const pad = 8;
      const dx = (w - pad * 2) / (length - 1);
      const shades = ["#ededed", "#aeaeae", "#7c7c7c", "#cfcfcf", "#949494", "#5e5e5e"];

      channels.forEach((c, ci) => {
        ctx.beginPath();
        for (let i = 0; i < length; i++) {
          const y = pad + (1 - (c.normalized[i] ?? 0.5)) * (h - pad * 2);
          const x = pad + i * dx;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = shades[ci % shades.length];
        ctx.lineWidth = ci === 0 ? 1.6 : 1;
        ctx.stroke();
      });

      if (head >= 0) {
        const x = pad + head * dx;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
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
  }, [channels, length, head]);

  return <canvas ref={ref} className="viz" />;
}
