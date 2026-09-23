"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId, setStoredRole } from "@/lib/device";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMatchNight() {
    setLoading(true);
    setError(null);
    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) throw new Error("Couldn't start a session. Try again.");
      const { session } = await res.json();
      setStoredRole(session.id, "a");
      router.push(`/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col gap-4">
        <span className="mx-auto rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-widest text-white/60">
          Two people. One pick.
        </span>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] text-paper">
          Stop scrolling.
          <br />
          Start watching.
        </h1>
        <p className="text-balance text-white/60">
          Set your mood, swipe on the same shortlist as your partner, and land on tonight&apos;s
          movie or show &mdash; with exactly where to stream it in India.
        </p>
      </div>

      <button
        onClick={startMatchNight}
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-ember to-ember2 px-8 py-4 text-lg font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Starting…" : "Start a Match Night"}
      </button>

      {error && <p className="text-sm text-ember">{error}</p>}

      <p className="text-xs text-white/35">
        No account needed &mdash; you&apos;ll get a QR code to share with your partner next.
      </p>
    </main>
  );
}
