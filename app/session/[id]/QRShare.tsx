"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRShare({ sessionId }: { sessionId: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/join/${sessionId}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#161221", light: "#fbf8f3" } }).then(
      setQrDataUrl
    );
  }, [sessionId]);

  async function shareQr() {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "movie-match-qr.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Movie Match",
          text: "Join my Movie Match session — scan or tap the link to pick tonight's watch together.",
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Movie Match", text: "Join my Movie Match session:", url: joinUrl });
        return;
      }
      await copyLink();
    } catch {
      // Share sheet dismissed or unsupported — no-op, the fallback buttons stay available.
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold text-paper">You&apos;re in.</h1>
        <p className="mt-2 text-white/60">Get your partner to scan this, or send them the link.</p>
      </div>

      <div className="rounded-3xl bg-paper p-4 shadow-card">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code to join this Movie Match session" className="h-56 w-56" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-2xl bg-ink/10" />
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          onClick={shareQr}
          className="w-full rounded-2xl bg-gradient-to-r from-ember to-ember2 px-8 py-4 text-lg font-semibold text-ink shadow-card transition active:scale-[0.98]"
        >
          Share with partner
        </button>
        <button
          onClick={copyLink}
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-8 py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
        >
          {copied ? "Link copied!" : "Copy link instead"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 text-white/50">
        <span className="h-2 w-2 animate-pulse rounded-full bg-glow" />
        <p className="text-sm">Waiting for your partner to join{"…"}</p>
      </div>
    </div>
  );
}
