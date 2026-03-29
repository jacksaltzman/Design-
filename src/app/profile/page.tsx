"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import TasteProfileComponent from "@/components/TasteProfile";
import type { TasteProfile, TasteAxisScore } from "@/lib/types";
import { getSessionId, getSessionSnapshot, saveSessionSnapshot, loadState } from "@/lib/client-state";
import { findClosestPersona } from "@/lib/taste-personas";

function buildShareText(profile: TasteProfile): string {
  const top3 = [...profile.axes]
    .sort((a, b) => Math.abs(b.score) * b.confidence - Math.abs(a.score) * a.confidence)
    .slice(0, 3)
    .map(ax => ax.score > 0 ? ax.highLabel : ax.lowLabel);

  const firstSentence = profile.description.split('.')[0] + '.';

  return [
    'My design taste (via Design Tinder)',
    '',
    top3.join(' · '),
    '',
    firstSentence,
    '',
    'design-six.vercel.app'
  ].join('\n');
}

function computeDrift(current: TasteAxisScore[], prev: TasteAxisScore[]): string | null {
  let maxDelta = 0;
  let driftText: string | null = null;
  for (const curr of current) {
    const old = prev.find(a => a.name === curr.name);
    if (!old) continue;
    const delta = curr.score - old.score;
    if (Math.abs(delta) > maxDelta) {
      maxDelta = Math.abs(delta);
      const pct = Math.round(Math.abs(delta) * 50);
      const direction = delta > 0 ? curr.highLabel : curr.lowLabel;
      driftText = `+${pct}% more ${direction} since last session`;
    }
  }
  return maxDelta > 0.05 ? driftText : null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [drift, setDrift] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setLikedIds(saved.likedIds);
    }

    async function load() {
      const sid = getSessionId();
      const headers: HeadersInit = sid ? { "X-Session-ID": sid } : {};
      const res = await fetch("/api/taste-profile", { headers });
      if (res.ok) {
        const fetched: TasteProfile = await res.json();
        const snapshot = getSessionSnapshot();
        if (snapshot) {
          setDrift(computeDrift(fetched.axes, snapshot));
        }
        saveSessionSnapshot(fetched.axes);
        setProfile(fetched);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleShare() {
    if (profile) {
      navigator.clipboard.writeText(buildShareText(profile));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="text-xs font-medium tracking-widest uppercase text-[var(--muted)]">Taste Profile</h1>
        <Link
          href="/"
          className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Back
        </Link>
      </header>

      <main className="flex-1 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-xl">
          {loading ? (
            <div className="py-20 text-center text-sm text-[var(--muted)]">
              <span className="animate-pulse" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: "200ms" }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: "400ms" }}>.</span>
            </div>
          ) : profile ? (
            <>
              <TasteProfileComponent
                axes={profile.axes}
                description={profile.description}
                confidence={profile.confidence}
                swipeCount={profile.swipeCount}
                onShare={handleShare}
                drift={drift}
                persona={findClosestPersona(profile.axes, 20, profile.swipeCount)}
              />
              {likedIds.length > 0 && (
                <div className="mt-10 space-y-4">
                  <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Liked</p>
                  <div className="grid grid-cols-3 gap-2">
                    {likedIds.map((id) => (
                      <div key={id} className="relative aspect-[4/3] overflow-hidden rounded-md bg-neutral-100">
                        <Image src={`/designs/${id}.jpeg`} alt={id} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
