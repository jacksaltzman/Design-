"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TasteAxisScore } from "@/lib/types";

interface TasteProfileProps {
  axes: TasteAxisScore[];
  description: string;
  confidence: number;
  swipeCount: number;
  onShare?: () => void;
  drift?: string | null;
  persona?: { name: string; description: string; similarity: number } | null;
}

export default function TasteProfile({
  axes,
  description,
  confidence,
  swipeCount,
  onShare,
  drift,
  persona,
}: TasteProfileProps) {
  const [copied, setCopied] = useState(false);
  const sorted = [...axes].sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score)
  );

  function handleShareClick() {
    if (onShare) {
      onShare();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="space-y-10">
      {/* Description */}
      <div className="space-y-3">
        <div className="relative">
          <blockquote className="border-l-2 border-[var(--border)] pl-4 italic">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {description}
            </p>
          </blockquote>
          {onShare && (
            <div className="absolute top-0 right-0 flex items-center gap-2">
              <AnimatePresence>
                {copied && (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-[var(--muted)]"
                  >
                    Copied!
                  </motion.span>
                )}
              </AnimatePresence>
              <button
                onClick={handleShareClick}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Share taste profile"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 1L13 4.5 9.5 8" />
                  <path d="M13 4.5H5a4 4 0 0 0-4 4v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {swipeCount} swipes &middot; {Math.round(confidence * 100)}% confidence
        </p>
        {drift && (
          <p className="text-xs text-[var(--muted)] opacity-60 italic">{drift}</p>
        )}
      </div>

      {/* Design DNA */}
      {persona && swipeCount >= 20 && (
        <div className="rounded-md border border-[var(--border)] px-4 py-3 space-y-0.5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Design DNA</p>
          <p className="text-sm font-medium">{persona.name}</p>
          <p className="text-xs text-[var(--muted)]">{persona.description}</p>
        </div>
      )}

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
