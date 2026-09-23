import type { PoolTitleRow } from "@/lib/types";

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TitleCard({ title, className = "" }: { title: PoolTitleRow; className?: string }) {
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[28px] bg-ink shadow-card ${className}`}>
      {title.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={title.poster_url} alt={title.title} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-ink to-black" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pt-16">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-2xl font-semibold leading-tight text-paper">{title.title}</h3>
          {title.year && <span className="text-white/50">{title.year}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
          {title.imdb_rating && (
            <span className="flex items-center gap-1 font-medium text-glow">
              {"★"} {title.imdb_rating.toFixed(1)}
            </span>
          )}
          {title.runtime && <span>{formatRuntime(title.runtime)}</span>}
          {title.media_type === "tv" && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Series</span>}
        </div>
        {title.synopsis && <p className="mt-2 line-clamp-2 text-sm text-white/60">{title.synopsis}</p>}
      </div>
    </div>
  );
}
