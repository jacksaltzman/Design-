"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import CardStack from "@/components/CardStack";
import SwipeCounter from "@/components/SwipeCounter";

export default function Home() {
  const [swipeCount, setSwipeCount] = useState(0);

  const handleSwipeCountChange = useCallback((count: number) => {
    setSwipeCount(count);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Design Taste</h1>
        <div className="flex items-center gap-4">
          <SwipeCounter count={swipeCount} />
          {swipeCount >= 5 && (
            <Link
              href="/profile"
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
            >
              My Taste
            </Link>
          )}
        </div>
      </header>

      {/* Card area */}
      <main className="relative flex-1 px-4 pb-4">
        <div className="mx-auto h-full max-w-lg">
          <CardStack onSwipeCountChange={handleSwipeCountChange} />
        </div>
      </main>

      {/* Footer hint */}
      <footer className="pb-4 text-center text-xs text-neutral-600">
        Swipe right to like, left to dislike &middot; Arrow keys work too
      </footer>
    </div>
  );
}
