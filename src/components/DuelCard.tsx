"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { getSessionId } from "@/lib/client-state";

interface Design {
  id: string;
  filename: string;
  imageUrl: string;
}

interface DuelCardProps {
  onComplete: (winnerId: string, loserId: string) => void;
}

export default function DuelCard({ onComplete }: DuelCardProps) {
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sid = getSessionId();
      const headers: HeadersInit = sid ? { "X-Session-ID": sid } : {};
      const res = await fetch("/api/next-duel", { headers });
      if (res.ok) {
        const data = await res.json();
        setDesigns(data.designs);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleChoose = useCallback(
    (winnerId: string) => {
      if (chosen || !designs) return;
      setChosen(winnerId);

      const loserId = designs.find((d) => d.id !== winnerId)?.id;
      if (!loserId) return;

      // Brief delay for the visual feedback, then complete
      setTimeout(() => {
        onComplete(winnerId, loserId);
      }, 400);
    },
    [chosen, designs, onComplete]
  );

  // Keyboard: 1 or ← for left, 2 or → for right
  useEffect(() => {
    if (!designs || chosen) return;
    function handleKey(e: KeyboardEvent) {
      if (!designs) return;
      if (e.key === "ArrowLeft" || e.key === "1") {
        handleChoose(designs[0].id);
      } else if (e.key === "ArrowRight" || e.key === "2") {
        handleChoose(designs[1].id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [designs, chosen, handleChoose]);

  if (loading || !designs) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading</span>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-full flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="px-6 pb-3 pt-1">
        <p className="text-xs text-[var(--muted)]">Which do you prefer?</p>
      </div>

      <div className="flex flex-1 gap-2 px-4 pb-4">
        {designs.map((design) => {
          const isChosen = chosen === design.id;
          const isUnchosen = chosen !== null && !isChosen;

          return (
            <motion.button
              key={design.id}
              onClick={() => handleChoose(design.id)}
              className="relative flex-1 overflow-hidden rounded-lg"
              animate={{
                opacity: isUnchosen ? 0.25 : 1,
                scale: isChosen ? 1.02 : isUnchosen ? 0.97 : 1,
              }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative h-full w-full">
                <Image
                  src={design.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 240px"
                />
              </div>
              {isChosen && (
                <motion.div
                  className="absolute inset-0 rounded-lg ring-2 ring-inset ring-[var(--foreground)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
