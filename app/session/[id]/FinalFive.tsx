import type { PoolTitleRow } from "@/lib/types";
import { formatRuntime } from "./TitleCard";

export default function FinalFive({ titles, onPick }: { titles: PoolTitleRow[]; onPick: (title: PoolTitleRow) => void }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-paper">No match yet.</h1>
        <p className="mt-2 text-white/60">Here are the 5 you both responded to best &mdash; make the call together.</p>
      </div>

      <div className="flex flex-col gap-4">
        {titles.map((title) => (
          <div key={title.id} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-ink">
              {title.poster_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={title.poster_url} alt={title.title} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-lg font-semibold text-paper">{title.title}</h3>
                  {title.year && <span className="text-xs text-white/40">{title.year}</span>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                  {title.imdb_rating && <span className="text-glow">{"★"} {title.imdb_rating.toFixed(1)}</span>}
                  {title.runtime && <span>{formatRuntime(title.runtime)}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-white/50">{title.synopsis}</p>
              </div>
              <button
                onClick={() => onPick(title)}
                className="mt-2 self-start rounded-full bg-gradient-to-r from-ember to-ember2 px-4 py-1.5 text-xs font-semibold text-ink"
              >
                We&apos;ll watch this
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
