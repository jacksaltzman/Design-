"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SwipeCard from "./SwipeCard";
import ProbeCard from "./ProbeCard";
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

/** Insert a generated probe every N cards (after minimum swipes). */
const PROBE_INTERVAL = 10;
const PROBE_MIN_SWIPES = 10;

interface CardStackProps {
  onSwipeCountChange: (count: number) => void;
}

export default function CardStack({ onSwipeCountChange }: CardStackProps) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const swipesSinceProbe = useRef(0);
  const probeCounter = useRef(0);
  const swipeCountRef = useRef(0);

  const fetchCard = useCallback(async (): Promise<RegularCard | null> => {
    try {
      const res = await fetch("/api/next-card");
      if (!res.ok) {
        if (res.status === 404) {
          setExhausted(true);
          return null;
        }
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

  /** Fetch the next card — occasionally a generated probe. */
  const fetchNext = useCallback(async (): Promise<CardItem | null> => {
    const shouldProbe =
      swipeCountRef.current >= PROBE_MIN_SWIPES &&
      swipesSinceProbe.current >= PROBE_INTERVAL &&
      !!process.env.NEXT_PUBLIC_PROBES_ENABLED;

    if (shouldProbe) {
      swipesSinceProbe.current = 0;
      const probe = await fetchProbe();
      if (probe) return probe;
      // Fall back to regular card if probe generation fails
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
      // Send swipe to API
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

      // Remove the swiped card
      setCards((prev) => prev.filter((c) => c.id !== designId));

      // Fetch a replacement
      const newCard = await fetchNext();
      if (newCard) {
        setCards((prev) => [...prev, newCard]);
      }
    },
    [fetchNext, onSwipeCountChange]
  );

  const handleProbeSwipe = useCallback(
    async (probeId: string, liked: boolean) => {
      // Find the probe data
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

      // Remove the swiped card
      setCards((prev) => prev.filter((c) => c.id !== probeId));

      // Fetch a replacement
      const newCard = await fetchNext();
      if (newCard) {
        setCards((prev) => [...prev, newCard]);
      }
    },
    [cards, fetchNext, onSwipeCountChange]
  );

  const handleSwipe = useCallback(
    (cardId: string, liked: boolean) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      if (card.type === "probe") {
        handleProbeSwipe(cardId, liked);
      } else {
        handleDesignSwipe(cardId, liked);
      }
    },
    [cards, handleDesignSwipe, handleProbeSwipe]
  );

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cards.length === 0) return;
      const topCard = cards[0];
      if (e.key === "ArrowLeft") {
        handleSwipe(topCard.id, false);
      } else if (e.key === "ArrowRight") {
        handleSwipe(topCard.id, true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cards, handleSwipe]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg text-neutral-500">Loading designs...</div>
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
    <div className="relative h-full w-full">
      <AnimatePresence>
        {cards.map((card, index) =>
          card.type === "probe" ? (
            <ProbeCard
              key={card.id}
              probeId={card.id}
              html={card.html}
              onSwipe={handleProbeSwipe}
              isTop={index === 0}
            />
          ) : (
            <SwipeCard
              key={card.id}
              designId={card.id}
              imageUrl={card.data.design.imageUrl}
              onSwipe={handleDesignSwipe}
              isTop={index === 0}
            />
          )
        )}
      </AnimatePresence>

      {/* Button controls */}
      {cards.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-6">
          <button
            onClick={() => handleSwipe(cards[0].id, false)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/80 text-2xl text-red-400 backdrop-blur-sm transition hover:bg-red-500/20 hover:text-red-300"
            aria-label="Dislike"
          >
            &times;
          </button>
          <button
            onClick={() => handleSwipe(cards[0].id, true)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/80 text-2xl text-green-400 backdrop-blur-sm transition hover:bg-green-500/20 hover:text-green-300"
            aria-label="Like"
          >
            &hearts;
          </button>
        </div>
      )}
    </div>
  );
}
