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
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          {description}
        </p>
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

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span
          className={
            !isPositive && strength > 0.2
              ? "font-medium text-[var(--foreground)]"
              : "text-[var(--muted)]"
          }
        >
          {axis.lowLabel}
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
      <div className="relative h-px bg-[var(--border)]">
        {/* Center tick */}
        <div className="absolute left-1/2 top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--border)]" />
        {/* Position dot */}
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--foreground)] transition-all duration-500"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
