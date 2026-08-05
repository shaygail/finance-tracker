"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrDisplayProps {
  value: string;
  label: string;
  size?: number;
}

export function QrDisplay({ value, label, size = 120 }: QrDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    }
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} />
      <p className="text-xs font-mono text-slate-500">{label}</p>
    </div>
  );
}
