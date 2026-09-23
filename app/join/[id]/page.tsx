"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDeviceId, setStoredRole } from "@/lib/device";

export default function JoinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function join() {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(`/api/sessions/${params.id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Couldn't join this session.");
        if (cancelled) return;
        setStoredRole(params.id, body.role);
        router.replace(`/session/${params.id}`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }

    join();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="font-display text-2xl text-paper">Couldn&apos;t join</p>
          <p className="text-white/60">{error}</p>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-ember" />
          <p className="text-white/60">Joining your partner&apos;s match night{"…"}</p>
        </>
      )}
    </main>
  );
}
