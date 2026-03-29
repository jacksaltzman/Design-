"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from "framer-motion";
import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

export interface ProbeCardHandle {
  animateOut: (direction: "left" | "right") => Promise<void>;
}

interface ProbeCardProps {
  probeId: string;
  html: string;
  onSwipe: (probeId: string, liked: boolean) => void;
  isTop: boolean;
  stackIndex: number;
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const FLY_DISTANCE = 600;

const ProbeCard = forwardRef<ProbeCardHandle, ProbeCardProps>(
  function ProbeCard({ probeId, html, onSwipe, isTop, stackIndex }, ref) {
    const controls = useAnimationControls();
    const x = useMotionValue(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const rotate = useTransform(x, [-FLY_DISTANCE, 0, FLY_DISTANCE], [-18, 0, 18]);
    const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
    const dislikeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
    const dragScale = useTransform(
      x,
      [-FLY_DISTANCE, 0, FLY_DISTANCE],
      [0.97, 1, 0.97]
    );

    const stackScale = isTop ? dragScale : 1 - stackIndex * 0.04;
    const stackY = isTop ? 0 : stackIndex * 8;

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

    const animateOut = useCallback(
      async (direction: "left" | "right") => {
        const targetX = direction === "right" ? FLY_DISTANCE : -FLY_DISTANCE;
        await controls.start({
          x: targetX,
          rotate: direction === "right" ? 18 : -18,
          opacity: 0,
          transition: {
            type: "spring",
            stiffness: 600,
            damping: 40,
            opacity: { duration: 0.25 },
          },
        });
        onSwipe(probeId, direction === "right");
      },
      [controls, probeId, onSwipe]
    );

    useImperativeHandle(ref, () => ({ animateOut }), [animateOut]);

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info;

        const swipedRight =
          offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
        const swipedLeft =
          offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

        if (swipedRight || swipedLeft) {
          const direction = swipedRight ? 1 : -1;
          controls.start({
            x: direction * FLY_DISTANCE,
            rotate: direction * 25,
            opacity: 0,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 35,
              velocity: velocity.x,
              opacity: { duration: 0.2, delay: 0.05 },
            },
          });
          setTimeout(() => onSwipe(probeId, swipedRight), 150);
        } else {
          controls.start({
            x: 0,
            rotate: 0,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 0.8,
            },
          });
        }
      },
      [controls, probeId, onSwipe]
    );

    return (
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 10 - stackIndex,
          pointerEvents: isTop ? "auto" : "none",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{
          scale: typeof stackScale === "number" ? stackScale : 1,
          opacity: stackIndex > 2 ? 0 : 1,
          y: stackY,
          transition: {
            type: "spring",
            stiffness: 400,
            damping: 30,
            opacity: { duration: 0.3 },
          },
        }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      >
        <motion.div
          className="h-full w-full cursor-grab active:cursor-grabbing"
          style={{ x, rotate, scale: isTop ? dragScale : 1 }}
          drag={isTop ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileTap={isTop ? { scale: 0.98, transition: { duration: 0.1 } } : undefined}
        >
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-2xl ring-1 ring-white/5">
            {/* Generated design in iframe */}
            <iframe
              ref={iframeRef}
              className="h-full w-full border-0"
              sandbox="allow-same-origin"
              title="Generated design probe"
              style={{ pointerEvents: "none" }}
            />

            {/* Like indicator */}
            <motion.div
              className="absolute left-5 top-5 z-10 rounded-xl bg-green-500/20 px-5 py-2 backdrop-blur-md"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-xl font-black tracking-wide text-green-400 drop-shadow-lg">
                LIKE
              </span>
            </motion.div>

            {/* Dislike indicator */}
            <motion.div
              className="absolute right-5 top-5 z-10 rounded-xl bg-red-500/20 px-5 py-2 backdrop-blur-md"
              style={{ opacity: dislikeOpacity }}
            >
              <span className="text-xl font-black tracking-wide text-red-400 drop-shadow-lg">
                NOPE
              </span>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

export default ProbeCard;
