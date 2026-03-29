"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SwipeCard from "./SwipeCard";
import type { NextCardResponse } from "@/lib/types";

interface CardStackProps {
  onSwipeCountChange: (count: number) => void;
}

export default function CardStack({ onSwipeCountChange }: CardStackProps) {
  const [cards, setCards] = useState<NextCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);

  const fetchCard = useCallback(async (): Promise<NextCardResponse | null> => {
    try {
      const res = await fetch("/api/next-card");
      if (!res.ok) {
        if (res.status === 404) {
          setExhausted(true);
          return null;
        }
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Load initial cards
  useEffect(() => {
    async function init() {
      const results = await Promise.all([fetchCard(), fetchCard(), fetchCard()]);
      const valid = results.filter((c): c is NextCardResponse => c !== null);
      setCards(valid);
      setLoading(false);
      if (valid.length > 0) {
        onSwipeCountChange(valid[0].swipeCount);
      }
    }
    init();
  }, [fetchCard, onSwipeCountChange]);

  const handleSwipe = useCallback(
    async (designId: string, liked: boolean) => {
      // Send swipe to API
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, liked }),
      });

      if (res.ok) {
        const data = await res.json();
        onSwipeCountChange(data.swipeCount);
      }

      // Remove the swiped card
      setCards((prev) => prev.filter((c) => c.design.id !== designId));

      // Fetch a replacement
      const newCard = await fetchCard();
      if (newCard) {
        setCards((prev) => [...prev, newCard]);
      }
    },
    [fetchCard, onSwipeCountChange]
  );

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cards.length === 0) return;
      const topCard = cards[0];
      if (e.key === "ArrowLeft") {
        handleSwipe(topCard.design.id, false);
      } else if (e.key === "ArrowRight") {
        handleSwipe(topCard.design.id, true);
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
        {cards.map((card, index) => (
          <SwipeCard
            key={card.design.id}
            designId={card.design.id}
            imageUrl={card.design.imageUrl}
            onSwipe={handleSwipe}
            isTop={index === 0}
          />
        ))}
      </AnimatePresence>

      {/* Button controls */}
      {cards.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-6">
          <button
            onClick={() => handleSwipe(cards[0].design.id, false)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/80 text-2xl text-red-400 backdrop-blur-sm transition hover:bg-red-500/20 hover:text-red-300"
            aria-label="Dislike"
          >
            &times;
          </button>
          <button
            onClick={() => handleSwipe(cards[0].design.id, true)}
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
