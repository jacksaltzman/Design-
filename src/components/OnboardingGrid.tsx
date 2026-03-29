"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { getSessionId } from "@/lib/client-state";

interface Design {
  id: string;
  filename: string;
  imageUrl: string;
}

interface OnboardingGridProps {
  onComplete: (taste: unknown, swipedIds: string[]) => void;
}

export default function OnboardingGrid({ onComplete }: OnboardingGridProps) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const sid = getSessionId();
      const headers: HeadersInit = sid ? { "X-Session-ID": sid } : {};
      const res = await fetch("/api/onboarding", { headers });
      if (res.ok) {
        const data = await res.json();
        setDesigns(data.designs);
      }
      setLoading(false);
    }
    load();
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);

    const sid = getSessionId();
    const sessionHeader: HeadersInit = sid ? { "X-Session-ID": sid } : {};
    const res = await fetch("/api/onboarding-swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sessionHeader },
      body: JSON.stringify({
        selectedIds: Array.from(selected),
        allIds: designs.map((d) => d.id),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      onComplete(data.taste, data.swipedIds);
    }

    setSubmitting(false);
  }, [selected, designs, submitting, onComplete]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading</span>
      </div>
    );
  }

  if (designs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[var(--muted)]">No designs available</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-4 pt-2">
        <p className="text-sm text-[var(--foreground)]">
          Tap the designs you&apos;re drawn to
        </p>
      </div>

      {/* 3×3 grid */}
      <div className="flex-1 px-4">
        <div className="grid h-full grid-cols-3 gap-2">
          {designs.slice(0, 9).map((design) => {
            const isSelected = selected.has(design.id);
            return (
              <button
                key={design.id}
                onClick={() => toggleSelection(design.id)}
                className="relative overflow-hidden rounded-md transition-all duration-150"
                style={{
                  opacity: selected.size > 0 && !isSelected ? 0.4 : 1,
                }}
              >
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={design.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 160px"
                  />
                </div>
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute inset-0 ring-2 ring-inset ring-[var(--foreground)] rounded-md" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Continue button */}
      <div className="px-6 py-5">
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0 || submitting}
          className="w-full rounded-lg bg-[var(--foreground)] py-2.5 text-xs font-medium text-[var(--background)] transition-opacity disabled:opacity-20"
        >
          {submitting ? "..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
