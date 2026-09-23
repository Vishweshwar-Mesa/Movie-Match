import { discoverTitles, genreIdsToNames, getRuntime, resolveGenreIds, type RawTitle } from "./tmdb";
import { enrichMany } from "./streamingAvailability";
import type { MediaType, SearchBrief, StreamingPlatform } from "./types";

export interface GeneratedTitle {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  year: number | null;
  runtime: number | null;
  synopsis: string;
  poster_url: string | null;
  imdb_rating: number | null;
  genres: string[];
  streaming_platforms: StreamingPlatform[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function buildPool(options: {
  brief: SearchBrief;
  mediaTypes: MediaType[];
  excludeTmdbIds: { mediaType: MediaType; tmdbId: number }[];
  poolSize?: number;
}): Promise<GeneratedTitle[]> {
  const { brief, mediaTypes, excludeTmdbIds, poolSize = 30 } = options;
  const languages = brief.languages.length ? brief.languages : [null];

  const candidates: RawTitle[] = [];
  const seen = new Set(excludeTmdbIds.map((e) => `${e.mediaType}:${e.tmdbId}`));

  async function collect(genreIdsByMediaType: Map<MediaType, number[]>, minVoteCount: number) {
    for (const mediaType of mediaTypes) {
      const genreIds = genreIdsByMediaType.get(mediaType) ?? [];
      for (const language of languages) {
        for (const page of [1, 2]) {
          const results = await discoverTitles({
            mediaType,
            genreIds,
            language,
            yearFrom: brief.yearFrom,
            yearTo: brief.yearTo,
            minVoteAverage: brief.minVoteAverage,
            excludeTmdbIds: excludeTmdbIds.filter((e) => e.mediaType === mediaType).map((e) => e.tmdbId),
            page,
            minVoteCount,
          });
          for (const r of results) {
            const key = `${r.mediaType}:${r.tmdbId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push(r);
          }
        }
      }
    }
  }

  const genreIdsByMediaType = new Map<MediaType, number[]>();
  for (const mediaType of mediaTypes) {
    genreIdsByMediaType.set(mediaType, await resolveGenreIds(mediaType, brief.genres));
  }
  const noGenre = new Map(mediaTypes.map((m) => [m, []]));
  const MIN_CANDIDATES = 10;

  // A specific genre + language + rating combo can legitimately have very few matches on
  // TMDB — regional-language and niche titles are often thinly voted, so `vote_count.gte`
  // is the usual culprit, not a genuine absence of content (verified: e.g. Kannada-language
  // TV or 9+ rated Hindi movies exist, just with low vote counts). Rather than dead-ending
  // the couple after one strict query, cascade through progressively looser tiers until
  // there's a workable pool, keeping language/era/rating — what they explicitly chose —
  // intact throughout; only genre and the vote-count quality bar get relaxed.
  const tiers: { genres: Map<MediaType, number[]>; minVoteCount: number }[] = [
    { genres: genreIdsByMediaType, minVoteCount: 20 },
    { genres: noGenre, minVoteCount: 20 },
    { genres: noGenre, minVoteCount: 5 },
    { genres: noGenre, minVoteCount: 1 },
  ];

  for (const tier of tiers) {
    if (candidates.length >= MIN_CANDIDATES) break;
    await collect(tier.genres, tier.minVoteCount);
  }

  const pool = shuffle(candidates)
    .filter((c) => c.posterUrl)
    .slice(0, poolSize);

  const streamingInfo = await enrichMany(pool.map((t) => ({ mediaType: t.mediaType, tmdbId: t.tmdbId })));

  const [runtimes, genreNames] = await Promise.all([
    mapWithConcurrency(pool, 5, (t) => getRuntime(t.mediaType, t.tmdbId)),
    mapWithConcurrency(pool, 5, (t) => genreIdsToNames(t.mediaType, t.genreIds)),
  ]);

  return pool.map((t, i) => {
    const streaming = streamingInfo.get(`${t.mediaType}:${t.tmdbId}`);
    return {
      tmdb_id: t.tmdbId,
      media_type: t.mediaType,
      title: t.title,
      year: t.year,
      runtime: runtimes[i],
      synopsis: t.synopsis,
      poster_url: t.posterUrl,
      imdb_rating: streaming?.imdbRating ?? t.voteAverage,
      genres: genreNames[i],
      streaming_platforms: streaming?.platforms ?? [],
    };
  });
}

/** Media types to query, reconciled from both partners' content-type choice. Either partner
 * asking for "movies only" keeps the pool to movies; both must opt into series to include them. */
export function reconcileMediaTypes(contentTypeA: string, contentTypeB: string): MediaType[] {
  if (contentTypeA === "include_series" && contentTypeB === "include_series") return ["movie", "tv"];
  return ["movie"];
}
