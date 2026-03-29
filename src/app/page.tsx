"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import CardStack from "@/components/CardStack";

export default function Home() {
  const [swipeCount, setSwipeCount] = useState(0);

  const handleSwipeCountChange = useCallback((count: number) => {
    setSwipeCount(count);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-xs text-[var(--muted)]">{swipeCount}</span>
        {swipeCount >= 5 && (
          <Link
            href="/profile"
            className="text-xs font-normal text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Profile
          </Link>
        )}
      </header>

      {/* Card area */}
      <main className="relative flex-1 px-5 pb-5">
        <div className="mx-auto h-full max-w-lg">
          <CardStack onSwipeCountChange={handleSwipeCountChange} />
        </div>
      </main>
    </div>
  );
}
