"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TasteProfileComponent from "@/components/TasteProfile";
import type { TasteProfile } from "@/lib/types";
import { getSessionId } from "@/lib/client-state";

export default function ProfilePage() {
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sid = getSessionId();
      const headers: HeadersInit = sid ? { "X-Session-ID": sid } : {};
      const res = await fetch("/api/taste-profile", { headers });
      if (res.ok) {
        setProfile(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="text-sm font-medium tracking-tight">Your Taste</h1>
        <Link
          href="/"
          className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Back
        </Link>
      </header>

      <main className="flex-1 px-6 pb-8">
        <div className="mx-auto max-w-xl">
          {loading ? (
            <div className="py-20 text-center text-sm text-[var(--muted)]">
              Loading
            </div>
          ) : profile ? (
            <TasteProfileComponent
              axes={profile.axes}
              description={profile.description}
              confidence={profile.confidence}
              swipeCount={profile.swipeCount}
            />
          ) : (
            <div className="py-20 text-center text-sm text-[var(--muted)]">
              Could not load profile
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
