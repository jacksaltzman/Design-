"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from "framer-motion";
import Image from "next/image";
import { useCallback, forwardRef, useImperativeHandle } from "react";

export interface SwipeCardHandle {
  animateOut: (direction: "left" | "right") => Promise<void>;
}

interface SwipeCardProps {
  imageUrl: string;
  designId: string;
  onSwipe: (designId: string, liked: boolean) => void;
  isTop: boolean;
  stackIndex: number;
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const FLY_DISTANCE = 600;

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ imageUrl, designId, onSwipe, isTop, stackIndex }, ref) {
    const controls = useAnimationControls();
    const x = useMotionValue(0);

    // Rotation follows drag with slight damping
    const rotate = useTransform(x, [-FLY_DISTANCE, 0, FLY_DISTANCE], [-18, 0, 18]);

    // Like / Nope indicator opacity — ramps up as you drag
    const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
    const dislikeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

    // Subtle scale feedback: card shrinks slightly while dragging
    const dragScale = useTransform(
      x,
      [-FLY_DISTANCE, 0, FLY_DISTANCE],
      [0.97, 1, 0.97]
    );

    // Stack depth: cards behind are slightly smaller and shifted down
    const stackScale = isTop ? dragScale : 1 - stackIndex * 0.04;
    const stackY = isTop ? 0 : stackIndex * 8;

    // Programmatic fly-out for button taps
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
        onSwipe(designId, direction === "right");
      },
      [controls, designId, onSwipe]
    );

    useImperativeHandle(ref, () => ({ animateOut }), [animateOut]);

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info;

        // Accept swipe if dragged past threshold OR flicked hard enough
        const swipedRight =
          offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
        const swipedLeft =
          offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

        if (swipedRight || swipedLeft) {
          // Fly out in the direction of the swipe with momentum
          const direction = swipedRight ? 1 : -1;
          const flyX = direction * FLY_DISTANCE;
          const flyRotate = direction * 25;

          controls.start({
            x: flyX,
            rotate: flyRotate,
            opacity: 0,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 35,
              velocity: velocity.x,
              opacity: { duration: 0.2, delay: 0.05 },
            },
          });

          // Fire callback after a short delay so the animation is visible
          setTimeout(() => onSwipe(designId, swipedRight), 150);
        } else {
          // Snap back with a satisfying spring
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
      [controls, designId, onSwipe]
    );

    return (
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 10 - stackIndex,
          pointerEvents: isTop ? "auto" : "none",
        }}
        // Entrance animation — card scales up from behind
        initial={{
          scale: 0.92,
          opacity: 0,
          y: 24,
        }}
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
        exit={{
          opacity: 0,
          transition: { duration: 0.15 },
        }}
      >
        <motion.div
          className="h-full w-full cursor-grab active:cursor-grabbing"
          style={{
            x,
            rotate,
            scale: isTop ? dragScale : 1,
          }}
          drag={isTop ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileTap={isTop ? { scale: 0.98, transition: { duration: 0.1 } } : undefined}
        >
          <div className="card-vignette relative h-full w-full overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-2xl ring-1 ring-white/5">
            {/* Design image */}
            <Image
              src={imageUrl}
              alt={`Design ${designId}`}
              fill
              className="object-cover"
              priority={isTop}
              sizes="(max-width: 640px) 100vw, 480px"
            />

            {/* Like indicator */}
            <motion.div
              className="absolute left-5 top-5 rounded-xl bg-green-500/20 px-5 py-2 backdrop-blur-md"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-xl font-black tracking-wide text-green-400 drop-shadow-lg">
                LIKE
              </span>
            </motion.div>

            {/* Dislike indicator */}
            <motion.div
              className="absolute right-5 top-5 rounded-xl bg-red-500/20 px-5 py-2 backdrop-blur-md"
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

export default SwipeCard;
