"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from "framer-motion";
import Image from "next/image";
import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";

export interface SwipeCardHandle {
  animateOut: (direction: "left" | "right") => Promise<void>;
}

interface SwipeCardProps {
  imageUrl: string;
  designId: string;
  onSwipe: (designId: string, liked: boolean) => void;
  isTop: boolean;
  stackIndex: number;
  parentDragX?: ReturnType<typeof useMotionValue<number>>;
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 400;
const FLY_DISTANCE = 700;

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ imageUrl, designId, onSwipe, isTop, stackIndex, parentDragX }, ref) {
    const controls = useAnimationControls();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const grabPointRef = useRef<"top" | "bottom">("top");

    const zero = useMotionValue(0);
    const activeDragX = parentDragX ?? zero;

    // Rotation
    const rotate = useTransform(x, [-FLY_DISTANCE, 0, FLY_DISTANCE], [-15, 0, 15]);

    // Shadow deepens as card lifts during drag
    const dragMagnitude = useTransform(x, [-200, 0, 200], [1, 0, 1]);
    const shadow = useTransform(
      dragMagnitude,
      [0, 1],
      [
        "0 1px 4px rgba(0,0,0,0.04)",
        "0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
      ]
    );

    // Background card reacts to top card drag
    const bgScale = useTransform(activeDragX, [-200, 0, 200], [1, 1 - stackIndex * 0.03, 1]);
    const bgY = useTransform(activeDragX, [-200, 0, 200], [0, stackIndex * 6, 0]);

    const animateOut = useCallback(
      async (direction: "left" | "right") => {
        const targetX = direction === "right" ? FLY_DISTANCE : -FLY_DISTANCE;
        await controls.start({
          x: targetX,
          y: -30,
          rotate: direction === "right" ? 18 : -18,
          opacity: 0,
          transition: {
            type: "spring",
            stiffness: 600,
            damping: 40,
            opacity: { duration: 0.2 },
          },
        });
        onSwipe(designId, direction === "right");
      },
      [controls, designId, onSwipe]
    );

    useImperativeHandle(ref, () => ({ animateOut }), [animateOut]);

    const handleDragStart = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const el = (info as unknown as { target: HTMLElement }).target;
        if (el) {
          const card = el.closest("[data-card]");
          if (card) {
            const rect = card.getBoundingClientRect();
            grabPointRef.current = info.point.y < rect.top + rect.height / 2 ? "top" : "bottom";
          }
        }
      },
      []
    );

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info;

        const swipedRight =
          offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
        const swipedLeft =
          offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

        if (swipedRight || swipedLeft) {
          const dir = swipedRight ? 1 : -1;
          const rotateDir = grabPointRef.current === "top" ? 1 : -1;
          controls.start({
            x: dir * FLY_DISTANCE,
            y: offset.y * 0.4,
            rotate: dir * rotateDir * 20,
            opacity: 0,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 35,
              velocity: velocity.x,
              opacity: { duration: 0.15, delay: 0.05 },
            },
          });
          // Fire immediately — don't wait for animation to finish
          onSwipe(designId, swipedRight);
        } else {
          controls.start({
            x: 0,
            y: 0,
            rotate: 0,
            transition: {
              type: "spring",
              stiffness: 600,
              damping: 25,
              mass: 0.7,
            },
          });
        }
      },
      [controls, designId, onSwipe]
    );

    return (
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 10 - stackIndex,
          pointerEvents: isTop ? "auto" : "none",
          scale: isTop ? 1 : bgScale,
          y: isTop ? 0 : bgY,
        }}
        initial={false}
        animate={{
          scale: isTop ? 1 : 1 - stackIndex * 0.03,
          y: isTop ? 0 : stackIndex * 6,
          opacity: stackIndex > 2 ? 0 : 1,
          transition: { type: "spring", stiffness: 500, damping: 35 },
        }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        <motion.div
          data-card
          className="h-full w-full cursor-grab active:cursor-grabbing"
          style={{
            x: isTop ? x : 0,
            y: isTop ? y : 0,
            rotate: isTop ? rotate : 0,
            touchAction: "none",
          }}
          drag={isTop}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragStart={isTop ? handleDragStart : undefined}
          onDragEnd={isTop ? handleDragEnd : undefined}
          animate={controls}
          whileTap={isTop ? { scale: 0.985, transition: { duration: 0.08 } } : undefined}
        >
          <motion.div
            className="relative h-full w-full overflow-hidden rounded-lg bg-neutral-50"
            style={{ boxShadow: isTop ? shadow : "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <Image
              src={imageUrl}
              alt={`Design ${designId}`}
              fill
              className="object-cover"
              priority={isTop}
              sizes="(max-width: 640px) 100vw, 480px"
            />
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }
);

export default SwipeCard;
