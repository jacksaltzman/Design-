"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SwipeCard, { type SwipeCardHandle } from "./SwipeCard";
import ProbeCard, { type ProbeCardHandle } from "./ProbeCard";
import type { NextCardResponse } from "@/lib/types";

/** A regular design card from the corpus. */
interface RegularCard {
  type: "design";
  id: string;
  data: NextCardResponse;
}

/** A generated design probe from Claude. */
interface ProbeCardData {
  type: "probe";
  id: string;
  html: string;
  axis: string;
  variant: "A" | "B";
}

type CardItem = RegularCard | ProbeCardData;

const PROBE_INTERVAL = 10;
const PROBE_MIN_SWIPES = 10;

interface CardStackProps {
  onSwipeCountChange: (count: number) => void;
}

export default function CardStack({ onSwipeCountChange }: CardStackProps) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const swipesSinceProbe = useRef(0);
  const probeCounter = useRef(0);
  const swipeCountRef = useRef(0);
  const topCardRef = useRef<SwipeCardHandle | ProbeCardHandle | null>(null);

  const fetchCard = useCallback(async (): Promise<RegularCard | null> => {
    try {
      const res = await fetch("/api/next-card");
      if (!res.ok) {
        if (res.status === 404) setExhausted(true);
        return null;
      }
      const data: NextCardResponse = await res.json();
      return { type: "design", id: data.design.id, data };
    } catch {
      return null;
    }
  }, []);

  const fetchProbe = useCallback(async (): Promise<ProbeCardData | null> => {
    try {
      const res = await fetch("/api/generate-probe");
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
  }, []);

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

  // Load initial cards
  useEffect(() => {
    async function init() {
      const results = await Promise.all([
        fetchCard(),
        fetchCard(),
        fetchCard(),
      ]);
      const valid = results.filter((c): c is RegularCard => c !== null);
      setCards(valid);
      setLoading(false);
      if (valid.length > 0) {
        onSwipeCountChange(valid[0].data.swipeCount);
      }
    }
    init();
  }, [fetchCard, onSwipeCountChange]);

  const handleDesignSwipe = useCallback(
    async (designId: string, liked: boolean) => {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, liked }),
      });

      if (res.ok) {
        const data = await res.json();
        swipeCountRef.current = data.swipeCount;
        onSwipeCountChange(data.swipeCount);
      }

      swipesSinceProbe.current += 1;
      setCards((prev) => prev.filter((c) => c.id !== designId));
      setIsAnimating(false);

      const newCard = await fetchNext();
      if (newCard) {
        setCards((prev) => [...prev, newCard]);
      }
    },
    [fetchNext, onSwipeCountChange]
  );

  const handleProbeSwipe = useCallback(
    async (probeId: string, liked: boolean) => {
      const probe = cards.find(
        (c) => c.id === probeId && c.type === "probe"
      ) as ProbeCardData | undefined;

      if (probe) {
        const res = await fetch("/api/swipe-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      setCards((prev) => prev.filter((c) => c.id !== probeId));
      setIsAnimating(false);

      const newCard = await fetchNext();
      if (newCard) {
        setCards((prev) => [...prev, newCard]);
      }
    },
    [cards, fetchNext, onSwipeCountChange]
  );

  /** Button-triggered swipe — animates the card out before processing. */
  const handleButtonSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (isAnimating || cards.length === 0) return;
      setIsAnimating(true);

      const topCard = cards[0];
      const ref = topCardRef.current;

      if (ref) {
        // Animate first, then the onSwipe callback fires from the card
        await ref.animateOut(direction);
      } else {
        // Fallback if ref isn't set
        if (topCard.type === "probe") {
          handleProbeSwipe(topCard.id, direction === "right");
        } else {
          handleDesignSwipe(topCard.id, direction === "right");
        }
      }
    },
    [isAnimating, cards, handleDesignSwipe, handleProbeSwipe]
  );

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cards.length === 0 || isAnimating) return;
      if (e.key === "ArrowLeft") {
        handleButtonSwipe("left");
      } else if (e.key === "ArrowRight") {
        handleButtonSwipe("right");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cards, isAnimating, handleButtonSwipe]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-base text-neutral-500">
          Loading designs...
        </div>
      </div>
    );
  }

  if (exhausted && cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-2xl font-semibold">All done!</div>
        <div className="text-neutral-400">
          You&apos;ve seen all the designs. Check your taste profile.
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
              ref={index === 0 ? (topCardRef as React.Ref<ProbeCardHandle>) : undefined}
              probeId={card.id}
              html={card.html}
              onSwipe={handleProbeSwipe}
              isTop={index === 0}
              stackIndex={index}
            />
          ) : (
            <SwipeCard
              key={card.id}
              ref={index === 0 ? (topCardRef as React.Ref<SwipeCardHandle>) : undefined}
              designId={card.id}
              imageUrl={card.data.design.imageUrl}
              onSwipe={handleDesignSwipe}
              isTop={index === 0}
              stackIndex={index}
            />
          )
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {cards.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-8">
          <button
            onClick={() => handleButtonSwipe("left")}
            disabled={isAnimating}
            className="group flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-neutral-900/80 text-2xl text-red-400 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-red-500/60 hover:bg-red-500/15 hover:text-red-300 hover:shadow-red-500/20 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Dislike"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => handleButtonSwipe("right")}
            disabled={isAnimating}
            className="group flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-neutral-900/80 text-2xl text-green-400 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-green-500/60 hover:bg-green-500/15 hover:text-green-300 hover:shadow-green-500/20 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Like"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
