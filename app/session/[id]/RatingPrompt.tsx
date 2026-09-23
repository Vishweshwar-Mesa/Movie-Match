"use client";

import { useState } from "react";

export default function RatingPrompt({
  titleName,
  onSubmit,
  submitting,
}: {
  titleName: string;
  onSubmit: (stars: number, note: string) => void;
  submitting: boolean;
}) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold text-paper">How was {titleName}?</h1>
        <p className="mt-2 text-white/60">This helps Movie Match get better at picking for you two.</p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setStars(n)}
            className={`text-4xl transition ${n <= stars ? "text-glow" : "text-white/20"}`}
          >
            {"★"}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Any notes for next time? (optional)"
        rows={2}
        className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-paper placeholder:text-white/35 focus:border-ember focus:outline-none"
      />

      <button
        onClick={() => onSubmit(stars, note)}
        disabled={stars === 0 || submitting}
        className="w-full rounded-2xl bg-gradient-to-r from-ember to-ember2 px-8 py-4 text-lg font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
