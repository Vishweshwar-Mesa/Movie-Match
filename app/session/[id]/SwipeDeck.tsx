"use client";

import { useEffect } from "react";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import TitleCard from "./TitleCard";
import type { PoolTitleRow } from "@/lib/types";

const SWIPE_THRESHOLD = 120;

export default function SwipeDeck({
  titles,
  totalCount,
  onSwipe,
  onDeckComplete,
}: {
  /** Remaining, unswiped titles for this round — the parent shrinks this array as swipes land. */
  titles: PoolTitleRow[];
  /** Total titles in the round, for the "Card N of total" counter (titles.length alone would be wrong since it shrinks). */
  totalCount: number;
  onSwipe: (title: PoolTitleRow, direction: "right" | "left") => void;
  onDeckComplete: () => void;
}) {
  const controls = useAnimation();

  // The current card is always the first remaining title — no separate index to track, so
  // there's nothing that can drift out of sync with the shrinking `titles` array.
  const current = titles[0];
  const upNext = titles[1];

  useEffect(() => {
    if (titles.length === 0) onDeckComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles.length]);

  async function commitSwipe(direction: "right" | "left") {
    if (!current) return;
    await controls.start({
      x: direction === "right" ? 500 : -500,
      rotate: direction === "right" ? 20 : -20,
      opacity: 0,
      transition: { duration: 0.25 },
    });
    onSwipe(current, direction);
    // `controls` is shared across mounts — reset it to rest now, so the next card (a fresh
    // motion.div once `current` changes) doesn't inherit this exit animation's off-screen target.
    controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 });
  }

  async function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      await commitSwipe("right");
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      await commitSwipe("left");
    } else {
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
    }
  }

  if (!current) return null;

  const cardNumber = totalCount - titles.length + 1;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="mb-1 flex w-full items-center justify-between text-xs text-white/40">
        <span>Card {cardNumber} of {totalCount}</span>
        <span>Swipe right to like</span>
      </div>

      <div className="card-stack grid aspect-[2/3] w-full max-w-sm">
        {upNext && (
          <div className="scale-[0.96] opacity-60">
            <TitleCard title={upNext} />
          </div>
        )}
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          animate={controls}
          onDragEnd={handleDragEnd}
          whileTap={{ cursor: "grabbing" }}
          style={{ touchAction: "pan-y" }}
          className="cursor-grab"
        >
          <TitleCard title={current} />
        </motion.div>
      </div>

      <div className="flex items-center gap-6">
        <button
          aria-label="Pass"
          onClick={() => commitSwipe("left")}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-white/70 transition active:scale-90"
        >
          {"✕"}
        </button>
        <button
          aria-label="Like"
          onClick={() => commitSwipe("right")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-ember to-ember2 text-2xl text-ink shadow-card transition active:scale-90"
        >
          {"♥"}
        </button>
      </div>
    </div>
  );
}
