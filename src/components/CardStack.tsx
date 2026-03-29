"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SwipeCard, { type SwipeCardHandle } from "./SwipeCard";
import ProbeCard, { type ProbeCardHandle } from "./ProbeCard";
import type { NextCardResponse } from "@/lib/types";

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

  const handleButtonSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (isAnimating || cards.length === 0) return;
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
    [isAnimating, cards, handleDesignSwipe, handleProbeSwipe]
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cards.length === 0 || isAnimating) return;
      if (e.key === "ArrowLeft") handleButtonSwipe("left");
      else if (e.key === "ArrowRight") handleButtonSwipe("right");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cards, isAnimating, handleButtonSwipe]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-[var(--muted)]">Loading</div>
      </div>
    );
  }

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

      {/* Minimal action buttons */}
      {cards.length > 0 && (
        <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center gap-12">
          <button
            onClick={() => handleButtonSwipe("left")}
            disabled={isAnimating}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)] transition-all duration-150 hover:border-neutral-300 hover:shadow-sm active:scale-90 disabled:opacity-30"
            aria-label="Pass"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.9 3.1a3.5 3.5 0 0 0-4.95 0L8 4.05l-.95-.95a3.5 3.5 0 1 0-4.95 4.95l.95.95L8 13.95l4.95-4.95.95-.95a3.5 3.5 0 0 0 0-4.95z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
