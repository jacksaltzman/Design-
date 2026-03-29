"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useRef, useEffect } from "react";

interface ProbeCardProps {
  probeId: string;
  html: string;
  onSwipe: (probeId: string, liked: boolean) => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 100;

export default function ProbeCard({
  probeId,
  html,
  onSwipe,
  isTop,
}: ProbeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const dislikeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write HTML content into the iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const swipeForce = info.offset.x + info.velocity.x * 0.5;
      if (swipeForce > SWIPE_THRESHOLD) {
        onSwipe(probeId, true);
      } else if (swipeForce < -SWIPE_THRESHOLD) {
        onSwipe(probeId, false);
      }
    },
    [probeId, onSwipe]
  );

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{
        x,
        rotate,
        zIndex: isTop ? 10 : 0,
        pointerEvents: isTop ? "auto" : "none",
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      exit={{ x: 500, opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-2xl">
        {/* Generated design rendered in iframe */}
        <iframe
          ref={iframeRef}
          className="h-full w-full border-0"
          sandbox="allow-same-origin"
          title="Generated design probe"
          style={{ pointerEvents: "none" }}
        />

        {/* Like indicator */}
        <motion.div
          className="absolute left-6 top-6 z-10 rounded-lg border-4 border-green-500 px-4 py-2"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-2xl font-black text-green-500">LIKE</span>
        </motion.div>

        {/* Dislike indicator */}
        <motion.div
          className="absolute right-6 top-6 z-10 rounded-lg border-4 border-red-500 px-4 py-2"
          style={{ opacity: dislikeOpacity }}
        >
          <span className="text-2xl font-black text-red-500">NOPE</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
