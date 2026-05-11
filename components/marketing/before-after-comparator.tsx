"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BeforeAfterComparatorProps {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
  initial?: number; // 0-100
}

export function BeforeAfterComparator({
  beforeUrl,
  afterUrl,
  className,
  initial = 50,
}: BeforeAfterComparatorProps) {
  const [position, setPosition] = React.useState(initial);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const updateFromClientX = React.useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  const onMove = React.useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      updateFromClientX(clientX);
    },
    [updateFromClientX],
  );

  React.useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, [onMove]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none overflow-hidden rounded-xl border bg-muted shadow-lg",
        "aspect-[4/3] w-full",
        className,
      )}
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onTouchStart={(e) => {
        dragging.current = true;
        updateFromClientX(e.touches[0].clientX);
      }}
    >
      <img
        src={beforeUrl}
        alt="Before"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={afterUrl}
          alt="After"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>

      {/* Label pills */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        Before
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        After
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10">
          <div className="flex gap-0.5">
            <div className="h-3 w-0.5 bg-slate-400" />
            <div className="h-3 w-0.5 bg-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
