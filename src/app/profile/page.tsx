"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TasteProfileComponent from "@/components/TasteProfile";
import type { TasteProfile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/taste-profile");
      if (res.ok) {
        setProfile(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Your Design Taste</h1>
        <Link
          href="/"
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
        >
          Keep Swiping
        </Link>
      </header>

      <main className="flex-1 px-6 pb-8">
        <div className="mx-auto max-w-2xl">
          {loading ? (
            <div className="py-20 text-center text-neutral-500">
              Loading your taste profile...
            </div>
          ) : profile ? (
            <TasteProfileComponent
              axes={profile.axes}
              description={profile.description}
              confidence={profile.confidence}
              swipeCount={profile.swipeCount}
            />
          ) : (
            <div className="py-20 text-center text-neutral-500">
              Could not load taste profile.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
