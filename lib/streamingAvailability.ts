import type { MediaType, StreamingPlatform } from "./types";

// RapidAPI "Streaming Availability" by movie-of-the-night (v4 shape).
// Docs: https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability
// Verified against a live response: there's no separate `imdbRating` field — `rating` is the
// only rating field, and it's on a 0-100 scale (70 => 7.0), not 0-10.

const HOST = process.env.RAPIDAPI_STREAMING_AVAILABILITY_HOST || "streaming-availability.p.rapidapi.com";

function headers(): HeadersInit {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("Missing RAPIDAPI_KEY env var.");
  return {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": HOST,
  };
}

export interface StreamingInfo {
  imdbRating: number | null;
  platforms: StreamingPlatform[];
}

interface RawStreamingOption {
  service?: { name?: string; id?: string };
  type?: string;
  link?: string;
}

interface RawShowResponse {
  rating?: number; // 0-100 scale
  streamingOptions?: Record<string, RawStreamingOption[]>;
}

function normalizeType(type: string | undefined): StreamingPlatform["type"] {
  if (type === "rent" || type === "buy" || type === "free") return type;
  return "subscription";
}

export async function getStreamingInfo(mediaType: MediaType, tmdbId: number): Promise<StreamingInfo> {
  const url = `https://${HOST}/shows/${mediaType}/${tmdbId}?country=in&series_granularity=show`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    // Title not found on the streaming service, or a transient error — don't fail the
    // whole pool over one title's enrichment.
    return { imdbRating: null, platforms: [] };
  }

  const data = (await res.json()) as RawShowResponse;
  const options = data.streamingOptions?.in ?? [];

  const platforms: StreamingPlatform[] = options
    .filter((o) => o.service?.name && o.link)
    .map((o) => ({
      service: o.service!.name!,
      type: normalizeType(o.type),
      link: o.link!,
    }));

  return {
    imdbRating: typeof data.rating === "number" ? Math.round(data.rating) / 10 : null,
    platforms,
  };
}

/** Enriches many titles with streaming info, capping concurrency to stay under RapidAPI rate limits. */
export async function enrichMany(
  titles: { mediaType: MediaType; tmdbId: number }[],
  concurrency = 5
): Promise<Map<string, StreamingInfo>> {
  const results = new Map<string, StreamingInfo>();
  let index = 0;

  async function worker() {
    while (index < titles.length) {
      const current = titles[index++];
      const key = `${current.mediaType}:${current.tmdbId}`;
      try {
        results.set(key, await getStreamingInfo(current.mediaType, current.tmdbId));
      } catch {
        results.set(key, { imdbRating: null, platforms: [] });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, titles.length) }, worker));
  return results;
}
