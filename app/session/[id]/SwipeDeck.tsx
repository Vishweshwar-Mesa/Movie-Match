"use client";

import { useState } from "react";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import TitleCard from "./TitleCard";
import type { PoolTitleRow } from "@/lib/types";

const SWIPE_THRESHOLD = 120;

export default function SwipeDeck({
  titles,
  onSwipe,
  onDeckComplete,
}: {
  titles: PoolTitleRow[];
  onSwipe: (title: PoolTitleRow, direction: "right" | "left") => void;
  onDeckComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const controls = useAnimation();

  const current = titles[index];
  const upNext = titles[index + 1];

  function advance(direction: "right" | "left", title: PoolTitleRow) {
    onSwipe(title, direction);
    const next = index + 1;
    setIndex(next);
    controls.set({ x: 0, y: 0, rotate: 0 });
    if (next >= titles.length) onDeckComplete();
  }

  async function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      await controls.start({ x: 500, rotate: 20, opacity: 0, transition: { duration: 0.3 } });
      advance("right", current);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      await controls.start({ x: -500, rotate: -20, opacity: 0, transition: { duration: 0.3 } });
      advance("left", current);
    } else {
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
    }
  }

  async function buttonSwipe(direction: "right" | "left") {
    await controls.start({
      x: direction === "right" ? 500 : -500,
      rotate: direction === "right" ? 20 : -20,
      opacity: 0,
      transition: { duration: 0.25 },
    });
    advance(direction, current);
  }

  if (!current) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="mb-1 flex w-full items-center justify-between text-xs text-white/40">
        <span>Card {index + 1} of {titles.length}</span>
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
          onClick={() => buttonSwipe("left")}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-white/70 transition active:scale-90"
        >
          {"✕"}
        </button>
        <button
          aria-label="Like"
          onClick={() => buttonSwipe("right")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-ember to-ember2 text-2xl text-ink shadow-card transition active:scale-90"
        >
          {"♥"}
        </button>
      </div>
    </div>
  );
}
