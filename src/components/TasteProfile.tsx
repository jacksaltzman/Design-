"use client";

import type { TasteAxisScore } from "@/lib/types";

interface TasteProfileProps {
  axes: TasteAxisScore[];
  description: string;
  confidence: number;
  swipeCount: number;
}

export default function TasteProfile({
  axes,
  description,
  confidence,
  swipeCount,
}: TasteProfileProps) {
  const sorted = [...axes].sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score)
  );

  return (
    <div className="space-y-10">
      {/* Description */}
      <div className="space-y-3">
        <blockquote className="border-l-2 border-[var(--border)] pl-4 italic">
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            {description}
          </p>
        </blockquote>
        <p className="text-xs text-[var(--muted)]">
          {swipeCount} swipes &middot; {Math.round(confidence * 100)}% confidence
        </p>
      </div>

      {/* Axis bars */}
      <div className="space-y-5">
        {sorted.map((axis) => (
          <TasteAxisBar key={axis.name} axis={axis} />
        ))}
      </div>
    </div>
  );
}

function TasteAxisBar({ axis }: { axis: TasteAxisScore }) {
  const percentage = ((axis.score + 1) / 2) * 100;
  const isPositive = axis.score > 0;
  const strength = Math.abs(axis.score);
  const opacity = 0.35 + axis.confidence * 0.65;
  const isStrong = strength > 0.4;

  return (
    <div className="space-y-1.5" style={{ opacity }}>
      <div className="flex items-center justify-between text-xs">
        <span
          className={
            !isPositive && strength > 0.2
              ? "font-medium text-[var(--foreground)]"
              : "text-[var(--muted)]"
          }
        >
          {axis.lowLabel}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] opacity-50">
          {axis.name}
        </span>
        <span
          className={
            isPositive && strength > 0.2
              ? "font-medium text-[var(--foreground)]"
              : "text-[var(--muted)]"
          }
        >
          {axis.highLabel}
        </span>
      </div>
      <div className={`relative bg-[var(--border)] ${isStrong ? "h-[1.5px]" : "h-px"}`}>
        {/* Center tick */}
        <div className="absolute left-1/2 top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--border)]" />
        {/* Position dot */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-white transition-all duration-500"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
