export type Partner = "a" | "b";

export type Mood = "light_fun" | "intense_gripping" | "scary" | "romantic" | "other";

export type Language = "hindi" | "english" | "tamil" | "telugu" | "kannada" | "any";

export type ContentType = "movies" | "include_series";

export type Era = "any" | "classic" | "2000_2020" | "recent";

export type MinRating = 6 | 7 | 8 | 9;

export type SessionStatus =
  | "collecting_prefs"
  | "generating_pool"
  | "swiping"
  | "matched"
  | "final_pick"
  | "done";

export type MediaType = "movie" | "tv";

export interface PreferenceInput {
  moods: Mood[];
  moodText: string;
  languages: Language[];
  contentType: ContentType;
  minRating: MinRating;
  eras: Era[];
}

export interface SessionRow {
  id: string;
  created_at: string;
  status: SessionStatus;
  round: number;
  device_a_id: string;
  device_b_id: string | null;
  pair_key: string | null;
  final_picks: { tmdb_id: number; media_type: MediaType }[] | null;
}

export interface PreferenceRow {
  id: string;
  session_id: string;
  partner: Partner;
  moods: Mood[];
  mood_text: string;
  languages: Language[];
  content_type: ContentType;
  min_rating: MinRating;
  eras: Era[];
  submitted_at: string;
}

export interface StreamingPlatform {
  service: string;
  type: "subscription" | "rent" | "buy" | "free";
  link: string;
}

export interface PoolTitleRow {
  id: string;
  session_id: string;
  round: number;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  year: number | null;
  runtime: number | null;
  synopsis: string | null;
  poster_url: string | null;
  imdb_rating: number | null;
  genres: string[];
  streaming_platforms: StreamingPlatform[];
  created_at: string;
}

export interface SwipeRow {
  id: string;
  session_id: string;
  round: number;
  partner: Partner;
  tmdb_id: number;
  media_type: MediaType;
  direction: "right" | "left";
  created_at: string;
}

export interface MatchRow {
  id: string;
  session_id: string;
  round: number;
  tmdb_id: number;
  media_type: MediaType;
  matched_at: string;
}

export interface RatingRow {
  id: string;
  session_id: string;
  tmdb_id: number;
  media_type: MediaType;
  stars: number;
  note: string;
  created_at: string;
}

/** Structured brief Claude produces from both partners' preferences. */
export interface SearchBrief {
  genres: string[];
  keywords: string[];
  languages: string[];
  yearFrom: number;
  yearTo: number;
  minVoteAverage: number;
  moodSummary: string;
  rationale: string;
}
