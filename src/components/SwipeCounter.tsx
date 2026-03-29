"use client";

interface SwipeCounterProps {
  count: number;
}

const MILESTONES = [
  { threshold: 0, message: "Start swiping to discover your taste" },
  { threshold: 5, message: "Getting a feel for your style..." },
  { threshold: 10, message: "Patterns emerging" },
  { threshold: 20, message: "Taste profile taking shape" },
  { threshold: 30, message: "Strong preferences detected" },
  { threshold: 50, message: "Refined taste profile" },
];

export default function SwipeCounter({ count }: SwipeCounterProps) {
  const milestone = [...MILESTONES]
    .reverse()
    .find((m) => count >= m.threshold);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-neutral-800 px-3 text-sm font-medium tabular-nums">
        {count}
      </div>
      <span className="text-sm text-neutral-500">
        {milestone?.message}
      </span>
    </div>
  );
}
