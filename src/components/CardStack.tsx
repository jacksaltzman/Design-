"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard, { type SwipeCardHandle } from "./SwipeCard";
import ProbeCard, { type ProbeCardHandle } from "./ProbeCard";
import OnboardingGrid from "./OnboardingGrid";
import DuelCard from "./DuelCard";
import TasteInterstitial from "./TasteInterstitial";
import { saveState, loadState, getSessionId } from "@/lib/client-state";
import type { NextCardResponse, TasteVector } from "@/lib/types";

// ── Card types ──

interface RegularCard {
  type: "design";
  id: string;
  data: NextCardResponse;
}

interface ProbeCardData {
  type: "probe";
  id: string;
  html: string;
  axis: string;
  variant: "A" | "B";
}

type CardItem = RegularCard | ProbeCardData;

// ── Flow states ──

type FlowState =
  | { type: "loading" }
  | { type: "onboarding" }
  | { type: "swiping" }
  | { type: "duel" }
  | { type: "interstitial" };

// ── Cadence ──

const DUEL_INTERVAL = 8;
const INTERSTITIAL_INTERVAL = 15;
const PROBE_INTERVAL = 10;
const PROBE_MIN_SWIPES = 10;
const DUEL_MIN_SWIPES = 10;
const INTERSTITIAL_MIN_SWIPES = 12;

interface CardStackProps {
  onSwipeCountChange: (count: number) => void;
}

export default function CardStack({ onSwipeCountChange }: CardStackProps) {
  const [flow, setFlow] = useState<FlowState>({ type: "loading" });
  const [cards, setCards] = useState<CardItem[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastSwipedDomain, setLastSwipedDomain] = useState<string | null>(null);
  const [hasEverSwiped, setHasEverSwiped] = useState(false);
  const domainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topCardRef = useRef<SwipeCardHandle | ProbeCardHandle | null>(null);
  const swipeCountRef = useRef(0);
  const swipesSinceDuel = useRef(0);
  const swipesSinceInterstitial = useRef(0);
  const swipesSinceProbe = useRef(0);
  const probeCounter = useRef(0);
  const swipedIdsRef = useRef<string[]>([]);

  // ── Session ID header helper ──
  const sessionHeaders = useCallback((): HeadersInit => {
    const sid = getSessionId();
    return sid ? { "X-Session-ID": sid } : {};
  }, []);

  // ── Persistence: save after every state change ──
  const persist = useCallback((taste: TasteVector, swipedIds: string[]) => {
    swipedIdsRef.current = swipedIds;
    saveState(taste, swipedIds);
  }, []);

  // ── Initialize: check localStorage, restore or onboard ──
  useEffect(() => {
    async function init() {
      const saved = loadState();

      if (saved && saved.taste.swipeCount > 0) {
        // Restore server state from localStorage
        await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...sessionHeaders() },
          body: JSON.stringify({
            taste: saved.taste,
            swipedIds: saved.swipedIds,
          }),
        });

        swipeCountRef.current = saved.taste.swipeCount;
        swipedIdsRef.current = saved.swipedIds;
        onSwipeCountChange(saved.taste.swipeCount);

        // Load initial swipe cards
        const results = await Promise.all([
          fetchCard(),
          fetchCard(),
          fetchCard(),
        ]);
        const valid = results.filter((c): c is RegularCard => c !== null);
        setCards(valid);
        setFlow({ type: "swiping" });
      } else {
        // Fresh user — show onboarding
        setFlow({ type: "onboarding" });
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetchers ──

  const fetchCard = useCallback(async (): Promise<RegularCard | null> => {
    try {
      const res = await fetch("/api/next-card", { headers: sessionHeaders() });
      if (!res.ok) {
        if (res.status === 404) setExhausted(true);
        return null;
      }
      const data: NextCardResponse = await res.json();
      return { type: "design", id: data.design.id, data };
    } catch {
      return null;
    }
  }, [sessionHeaders]);

  const fetchProbe = useCallback(async (): Promise<ProbeCardData | null> => {
    try {
      const res = await fetch("/api/generate-probe", { headers: sessionHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      probeCounter.current += 1;
      return {
        type: "probe",
        id: `probe-${probeCounter.current}`,
        html: data.html,
        axis: data.hypothesis.axis,
        variant: data.hypothesis.variant,
      };
    } catch {
      return null;
    }
  }, [sessionHeaders]);

  const fetchNext = useCallback(async (): Promise<CardItem | null> => {
    const shouldProbe =
      swipeCountRef.current >= PROBE_MIN_SWIPES &&
      swipesSinceProbe.current >= PROBE_INTERVAL &&
      !!process.env.NEXT_PUBLIC_PROBES_ENABLED;

    if (shouldProbe) {
      swipesSinceProbe.current = 0;
      const probe = await fetchProbe();
      if (probe) return probe;
    }

    return fetchCard();
  }, [fetchCard, fetchProbe]);

  // ── Decide what comes next after a swipe ──

  const maybeChangeFlow = useCallback(() => {
    // Interstitial check (higher priority — less frequent)
    if (
      swipeCountRef.current >= INTERSTITIAL_MIN_SWIPES &&
      swipesSinceInterstitial.current >= INTERSTITIAL_INTERVAL
    ) {
      swipesSinceInterstitial.current = 0;
      setFlow({ type: "interstitial" });
      return true;
    }

    // Duel check
    if (
      swipeCountRef.current >= DUEL_MIN_SWIPES &&
      swipesSinceDuel.current >= DUEL_INTERVAL
    ) {
      swipesSinceDuel.current = 0;
      setFlow({ type: "duel" });
      return true;
    }

    return false;
  }, []);

  // ── Domain reveal helper ──

  const showDomain = useCallback((domain: string) => {
    if (domainTimeoutRef.current) clearTimeout(domainTimeoutRef.current);
    setLastSwipedDomain(domain);
    domainTimeoutRef.current = setTimeout(() => setLastSwipedDomain(null), 1500);
  }, []);

  // ── Swipe handlers ──

  const handleDesignSwipe = useCallback(
    async (designId: string, liked: boolean) => {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeaders() },
        body: JSON.stringify({ designId, liked }),
      });

      if (res.ok) {
        const data = await res.json();
        swipeCountRef.current = data.swipeCount;
        onSwipeCountChange(data.swipeCount);
        persist(data.taste, data.swipedIds);
      }

      showDomain(designId);
      setHasEverSwiped(true);

      swipesSinceDuel.current += 1;
      swipesSinceInterstitial.current += 1;
      swipesSinceProbe.current += 1;

      setCards((prev) => prev.filter((c) => c.id !== designId));
      setIsAnimating(false);

      // Check if we should switch to duel or interstitial
      if (!maybeChangeFlow()) {
        const newCard = await fetchNext();
        if (newCard) setCards((prev) => [...prev, newCard]);
      }
    },
    [fetchNext, onSwipeCountChange, persist, maybeChangeFlow, sessionHeaders, showDomain]
  );

  const handleProbeSwipe = useCallback(
    async (probeId: string, liked: boolean) => {
      const probe = cards.find(
        (c) => c.id === probeId && c.type === "probe"
      ) as ProbeCardData | undefined;

      if (probe) {
        const res = await fetch("/api/swipe-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...sessionHeaders() },
          body: JSON.stringify({
            axis: probe.axis,
            variant: probe.variant,
            liked,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          swipeCountRef.current = data.swipeCount;
          onSwipeCountChange(data.swipeCount);
        }
      }

      swipesSinceProbe.current = 0;
      swipesSinceDuel.current += 1;
      swipesSinceInterstitial.current += 1;

      setCards((prev) => prev.filter((c) => c.id !== probeId));
      setIsAnimating(false);

      if (!maybeChangeFlow()) {
        const newCard = await fetchNext();
        if (newCard) setCards((prev) => [...prev, newCard]);
      }
    },
    [cards, fetchNext, onSwipeCountChange, maybeChangeFlow, sessionHeaders]
  );

  // ── Button / keyboard swipe ──

  const handleButtonSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (isAnimating || cards.length === 0 || flow.type !== "swiping") return;
      setIsAnimating(true);

      const ref = topCardRef.current;
      if (ref) {
        await ref.animateOut(direction);
      } else {
        const topCard = cards[0];
        if (topCard.type === "probe") {
          handleProbeSwipe(topCard.id, direction === "right");
        } else {
          handleDesignSwipe(topCard.id, direction === "right");
        }
      }
    },
    [isAnimating, cards, flow, handleDesignSwipe, handleProbeSwipe]
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (flow.type !== "swiping" || cards.length === 0 || isAnimating) return;
      if (e.key === "ArrowLeft") handleButtonSwipe("left");
      else if (e.key === "ArrowRight") handleButtonSwipe("right");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flow, cards, isAnimating, handleButtonSwipe]);

  // ── Onboarding complete ──

  const handleOnboardingComplete = useCallback(
    async (taste: unknown, swipedIds: string[]) => {
      const tv = taste as TasteVector;
      swipeCountRef.current = tv.swipeCount;
      onSwipeCountChange(tv.swipeCount);
      persist(tv, swipedIds);

      // Pre-fetch cards for swiping
      const results = await Promise.all([
        fetchCard(),
        fetchCard(),
        fetchCard(),
      ]);
      const valid = results.filter((c): c is RegularCard => c !== null);
      setCards(valid);
      setFlow({ type: "swiping" });
    },
    [fetchCard, onSwipeCountChange, persist]
  );

  // ── Duel complete ──

  const handleDuelComplete = useCallback(
    async (winnerId: string, loserId: string) => {
      const res = await fetch("/api/swipe-duel", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeaders() },
        body: JSON.stringify({ winnerId, loserId }),
      });

      if (res.ok) {
        const data = await res.json();
        swipeCountRef.current = data.swipeCount;
        onSwipeCountChange(data.swipeCount);
        persist(data.taste, data.swipedIds);
      }

      // Replenish cards and return to swiping
      const newCards = await Promise.all([fetchCard(), fetchCard()]);
      const valid = newCards.filter((c): c is RegularCard => c !== null);
      setCards((prev) => [...prev, ...valid]);
      setFlow({ type: "swiping" });
    },
    [fetchCard, onSwipeCountChange, persist, sessionHeaders]
  );

  // ── Interstitial continue ──

  const handleInterstitialContinue = useCallback(async () => {
    // Replenish if needed
    if (cards.length < 2) {
      const newCards = await Promise.all([fetchCard(), fetchCard()]);
      const valid = newCards.filter((c): c is RegularCard => c !== null);
      setCards((prev) => [...prev, ...valid]);
    }
    setFlow({ type: "swiping" });
  }, [cards, fetchCard]);

  // ── Render ──

  if (flow.type === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading</span>
      </div>
    );
  }

  if (flow.type === "onboarding") {
    return <OnboardingGrid onComplete={handleOnboardingComplete} />;
  }

  if (flow.type === "duel") {
    return <DuelCard onComplete={handleDuelComplete} />;
  }

  if (flow.type === "interstitial") {
    return <TasteInterstitial onContinue={handleInterstitialContinue} />;
  }

  // flow.type === "swiping"

  if (exhausted && cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="text-sm font-medium">No more designs</div>
        <div className="text-xs text-[var(--muted)]">
          Check your taste profile
        </div>
      </div>
    );
  }

  return (
    <div className="card-stack relative h-full w-full">
      <AnimatePresence mode="popLayout">
        {cards.map((card, index) =>
          card.type === "probe" ? (
            <ProbeCard
              key={card.id}
              ref={
                index === 0
                  ? (topCardRef as React.Ref<ProbeCardHandle>)
                  : undefined
              }
              probeId={card.id}
              html={card.html}
              onSwipe={handleProbeSwipe}
              isTop={index === 0}
              stackIndex={index}
            />
          ) : (
            <SwipeCard
              key={card.id}
              ref={
                index === 0
                  ? (topCardRef as React.Ref<SwipeCardHandle>)
                  : undefined
              }
              designId={card.id}
              imageUrl={card.data.design.imageUrl}
              onSwipe={handleDesignSwipe}
              isTop={index === 0}
              stackIndex={index}
            />
          )
        )}
      </AnimatePresence>

      {/* Minimal action buttons */}
      {cards.length > 0 && (
        <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center gap-12">
          <button
            onClick={() => handleButtonSwipe("left")}
            disabled={isAnimating}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)] transition-all duration-150 hover:border-neutral-300 hover:shadow-sm active:scale-90 disabled:opacity-30"
            aria-label="Pass"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="4" x2="4" y2="12" />
              <line x1="4" y1="4" x2="12" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => handleButtonSwipe("right")}
            disabled={isAnimating}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)] transition-all duration-150 hover:border-neutral-300 hover:shadow-sm active:scale-90 disabled:opacity-30"
            aria-label="Like"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.9 3.1a3.5 3.5 0 0 0-4.95 0L8 4.05l-.95-.95a3.5 3.5 0 1 0-4.95 4.95l.95.95L8 13.95l4.95-4.95.95-.95a3.5 3.5 0 0 0 0-4.95z" />
            </svg>
          </button>

          {/* Domain name reveal */}
          <AnimatePresence>
            {lastSwipedDomain && (
              <motion.p
                key={lastSwipedDomain}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-[-28px] left-0 right-0 text-center text-xs text-[var(--muted)]"
              >
                {lastSwipedDomain}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Keyboard hint — shown only before the first swipe */}
          {!hasEverSwiped && swipeCountRef.current === 0 && flow.type === "swiping" && (
            <p className="absolute bottom-[-44px] left-0 right-0 text-center text-[10px] text-[var(--muted)] opacity-40">
              ← →
            </p>
          )}
        </div>
      )}
    </div>
  );
}
