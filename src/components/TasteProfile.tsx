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
  // Sort by absolute score so strongest preferences are first
  const sorted = [...axes].sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score)
  );

  return (
    <div className="space-y-8">
      {/* Description */}
      <div className="space-y-3">
        <p className="text-lg leading-relaxed text-neutral-200">
          {description}
        </p>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>Based on {swipeCount} swipes</span>
          <span>&middot;</span>
          <span>
            Confidence: {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Axis bars */}
      <div className="space-y-4">
        {sorted.map((axis) => (
          <TasteAxisBar key={axis.name} axis={axis} />
        ))}
      </div>
    </div>
  );
}

function TasteAxisBar({ axis }: { axis: TasteAxisScore }) {
  const percentage = ((axis.score + 1) / 2) * 100; // map [-1,1] to [0,100]
  const isPositive = axis.score > 0;
  const strength = Math.abs(axis.score);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span
          className={
            !isPositive && strength > 0.2
              ? "font-medium text-neutral-200"
              : "text-neutral-500"
          }
        >
          {axis.lowLabel}
        </span>
        <span className="text-xs text-neutral-600">{axis.name}</span>
        <span
          className={
            isPositive && strength > 0.2
              ? "font-medium text-neutral-200"
              : "text-neutral-500"
          }
        >
          {axis.highLabel}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-neutral-800">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-neutral-600" />
        {/* Score indicator */}
        <div
          className="absolute top-0 h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{
            left: `${Math.min(percentage, 50)}%`,
            width: `${Math.abs(percentage - 50)}%`,
          }}
        />
        {/* Dot at current position */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-400 bg-blue-500 shadow transition-all duration-500"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
