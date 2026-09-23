import type { MediaType } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("Missing TMDB_API_KEY env var.");
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}

interface TmdbGenre {
  id: number;
  name: string;
}

let genreCache: { movie: TmdbGenre[]; tv: TmdbGenre[] } | null = null;

async function getGenres(mediaType: MediaType): Promise<TmdbGenre[]> {
  if (!genreCache) {
    const [movie, tv] = await Promise.all([
      tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list", {}),
      tmdbFetch<{ genres: TmdbGenre[] }>("/genre/tv/list", {}),
    ]);
    genreCache = { movie: movie.genres, tv: tv.genres };
  }
  return genreCache[mediaType];
}

/** Resolves free-form genre names (from Claude's brief) to TMDB genre ids for a given media type. */
export async function resolveGenreIds(mediaType: MediaType, names: string[]): Promise<number[]> {
  const genres = await getGenres(mediaType);
  const lowerNames = names.map((n) => n.toLowerCase());
  return genres
    .filter((g) => lowerNames.some((n) => g.name.toLowerCase().includes(n) || n.includes(g.name.toLowerCase())))
    .map((g) => g.id);
}

/** Maps TMDB genre ids back to names, for display/enrichment (e.g. feeding round-2 refinement). */
export async function genreIdsToNames(mediaType: MediaType, ids: number[]): Promise<string[]> {
  const genres = await getGenres(mediaType);
  const byId = new Map(genres.map((g) => [g.id, g.name]));
  return ids.map((id) => byId.get(id)).filter((n): n is string => Boolean(n));
}

export interface DiscoverParams {
  mediaType: MediaType;
  genreIds: number[];
  language: string | null; // ISO 639-1, or null for no filter
  yearFrom: number;
  yearTo: number;
  minVoteAverage: number;
  excludeTmdbIds: number[];
  page?: number;
  /** Minimum TMDB vote count. Regional-language and niche titles are often thinly voted on
   * TMDB, so callers relax this as a fallback tier rather than hardcoding one value. */
  minVoteCount?: number;
}

export interface RawTitle {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  synopsis: string;
  posterUrl: string | null;
  voteAverage: number;
  genreIds: number[];
}

interface TmdbDiscoverResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  genre_ids: number[];
}

export async function discoverTitles(params: DiscoverParams): Promise<RawTitle[]> {
  const { mediaType, genreIds, language, yearFrom, yearTo, minVoteAverage, excludeTmdbIds, page = 1, minVoteCount = 20 } = params;

  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";

  const data = await tmdbFetch<{ results: TmdbDiscoverResult[] }>(`/discover/${mediaType}`, {
    // "|" is OR (match any listed genre) — "," would be AND (match all simultaneously),
    // which is too restrictive for a brief that lists several acceptable genres.
    with_genres: genreIds.length ? genreIds.join("|") : undefined,
    with_original_language: language ?? undefined,
    [`${dateField}.gte`]: `${yearFrom}-01-01`,
    [`${dateField}.lte`]: `${yearTo}-12-31`,
    "vote_average.gte": minVoteAverage,
    "vote_count.gte": minVoteCount,
    sort_by: "popularity.desc",
    include_adult: "false",
    page,
  });

  const excluded = new Set(excludeTmdbIds);

  return data.results
    .filter((r) => !excluded.has(r.id))
    .map((r) => {
      const dateStr = r.release_date || r.first_air_date;
      return {
        tmdbId: r.id,
        mediaType,
        title: r.title || r.name || "Untitled",
        year: dateStr ? Number(dateStr.slice(0, 4)) : null,
        synopsis: r.overview,
        posterUrl: r.poster_path ? `${IMAGE_BASE}${r.poster_path}` : null,
        voteAverage: r.vote_average,
        genreIds: r.genre_ids ?? [],
      };
    });
}

/** Fetches runtime (minutes) for a single title. Movies: `runtime`. TV: first episode_run_time. */
export async function getRuntime(mediaType: MediaType, tmdbId: number): Promise<number | null> {
  if (mediaType === "movie") {
    const data = await tmdbFetch<{ runtime: number | null }>(`/movie/${tmdbId}`, {});
    return data.runtime ?? null;
  }
  const data = await tmdbFetch<{ episode_run_time: number[] }>(`/tv/${tmdbId}`, {});
  return data.episode_run_time?.[0] ?? null;
}
