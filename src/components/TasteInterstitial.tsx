"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { TasteProfile } from "@/lib/types";

interface TasteInterstitialProps {
  onContinue: () => void;
}

export default function TasteInterstitial({ onContinue }: TasteInterstitialProps) {
  const [profile, setProfile] = useState<TasteProfile | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/taste-profile");
      if (res.ok) {
        setProfile(await res.json());
      }
    }
    load();
  }, []);

  // Allow keyboard dismiss
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        onContinue();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onContinue]);

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading</span>
      </div>
    );
  }

  // Show top 4 strongest axes
  const topAxes = [...profile.axes]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            After {profile.swipeCount} swipes
          </p>
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            {profile.description}
          </p>
        </div>

        {/* Mini axis display */}
        <div className="space-y-4">
          {topAxes.map((axis) => {
            const pct = ((axis.score + 1) / 2) * 100;
            return (
              <div key={axis.name} className="space-y-1">
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>{axis.lowLabel}</span>
                  <span>{axis.highLabel}</span>
                </div>
                <div className="relative h-px bg-[var(--border)]">
                  <div className="absolute left-1/2 top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--border)]" />
                  <motion.div
                    className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--foreground)]"
                    initial={{ left: "50%" }}
                    animate={{ left: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onContinue}
          className="w-full rounded-lg bg-[var(--foreground)] py-2.5 text-xs font-medium text-[var(--background)]"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}
