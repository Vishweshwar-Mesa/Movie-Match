import type { PoolTitleRow } from "@/lib/types";
import { formatRuntime } from "./TitleCard";

export default function MatchReveal({ title, onRate }: { title: PoolTitleRow; onRate: () => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-gradient-to-r from-ember to-glow blur-3xl opacity-30" />
        <p className="animate-pop-in font-display text-sm font-semibold uppercase tracking-[0.3em] text-glow">
          It&apos;s a match
        </p>
      </div>

      <div className="w-56 overflow-hidden rounded-3xl shadow-card">
        {title.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={title.poster_url} alt={title.title} className="w-full" />
        ) : (
          <div className="aspect-[2/3] w-full bg-ink" />
        )}
      </div>

      <div>
        <h1 className="font-display text-3xl font-semibold text-paper">{title.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/60">
          {title.year && <span>{title.year}</span>}
          {title.imdb_rating && (
            <span className="text-glow">
              {"★"} {title.imdb_rating.toFixed(1)}
            </span>
          )}
          {title.runtime && <span>{formatRuntime(title.runtime)}</span>}
          {title.media_type === "tv" && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Series</span>}
        </div>
        {title.synopsis && <p className="mx-auto mt-3 max-w-sm text-sm text-white/60">{title.synopsis}</p>}
      </div>

      <div className="flex w-full flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Watch now on</p>
        {title.streaming_platforms.length ? (
          <div className="flex flex-wrap justify-center gap-2">
            {title.streaming_platforms.map((p) => (
              <a
                key={`${p.service}-${p.type}`}
                href={p.link}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-paper transition hover:border-ember"
              >
                {p.service}
                {p.type !== "subscription" && <span className="ml-1 text-white/40">({p.type})</span>}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">No Indian streaming availability found for this title right now.</p>
        )}
      </div>

      <button
        onClick={onRate}
        className="mt-2 w-full rounded-2xl bg-gradient-to-r from-ember to-ember2 px-8 py-4 text-lg font-semibold text-ink shadow-card transition active:scale-[0.98]"
      >
        We watched it &mdash; rate it
      </button>
    </div>
  );
}
