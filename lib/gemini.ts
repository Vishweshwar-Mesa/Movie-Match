import { GoogleGenAI, Type } from "@google/genai";
import type { PreferenceInput, SearchBrief } from "./types";

// "-latest" aliases always resolve to Google's current stable snapshot of that tier, so this
// doesn't go stale the way a dated model id would.
const MODEL = "gemini-flash-latest";

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const BRIEF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    genres: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "TMDB genre names (e.g. 'Comedy', 'Thriller') both partners would enjoy.",
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Short mood/theme keywords distilled from the free-text descriptions, e.g. 'slow burn', 'feel-good'.",
    },
    languages: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "ISO 639-1 codes (e.g. 'hi', 'en', 'ta', 'te', 'kn') to filter original language by. Empty array means no language restriction.",
    },
    yearFrom: { type: Type.INTEGER, description: "Earliest release year to include." },
    yearTo: { type: Type.INTEGER, description: "Latest release year to include." },
    minVoteAverage: { type: Type.NUMBER, description: "Minimum TMDB vote average (0-10) reconciling both partners' minimum rating bars." },
    moodSummary: { type: Type.STRING, description: "One sentence describing the reconciled mood/tone both partners are after tonight." },
    rationale: { type: Type.STRING, description: "One sentence explaining how this brief balances both partners' stated preferences." },
  },
  required: ["genres", "keywords", "languages", "yearFrom", "yearTo", "minVoteAverage", "moodSummary", "rationale"],
};

function eraToYearHint(eras: PreferenceInput["eras"]): string {
  if (eras.includes("any") || eras.length === 0) return "any era";
  const labels = { classic: "pre-2000 (classic)", "2000_2020": "2000–2020", recent: "2021–2026 (recent)" };
  return eras.map((e) => labels[e as "classic" | "2000_2020" | "recent"]).join(", ");
}

function formatPrefs(label: string, prefs: PreferenceInput): string {
  return [
    `${label}:`,
    `- Moods: ${prefs.moods.join(", ") || "none specified"}`,
    `- In their own words: ${prefs.moodText || "(nothing written)"}`,
    `- Languages: ${prefs.languages.includes("any") ? "any" : prefs.languages.join(", ")}`,
    `- Content type: ${prefs.contentType === "movies" ? "movies only" : "movies and series"}`,
    `- Minimum rating: ${prefs.minRating}+`,
    `- Era: ${eraToYearHint(prefs.eras)}`,
  ].join("\n");
}

async function runBriefPrompt(systemPrompt: string, userPrompt: string): Promise<SearchBrief> {
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: BRIEF_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini did not return a search brief.");
  return JSON.parse(text) as SearchBrief;
}

/** Turns both partners' independently-submitted preferences into one reconciled search brief. */
export async function buildBrief(
  prefsA: PreferenceInput,
  prefsB: PreferenceInput,
  pastTasteSummary?: string
): Promise<SearchBrief> {
  const systemPrompt =
    "You help two people agree on what to watch. Given two independently-submitted preference " +
    "profiles for the same movie night, reconcile them into a single TMDB search brief that a " +
    "reasonable couple would both enjoy. Weigh the free-text mood descriptions as strongly as the " +
    "structured fields — they carry nuance the checkboxes miss. When preferences conflict, find a " +
    "sensible middle ground rather than defaulting to only one partner's picks.";

  const userPrompt = [
    formatPrefs("Partner A", prefsA),
    "",
    formatPrefs("Partner B", prefsB),
    pastTasteSummary ? `\nWhat we know this couple has enjoyed together before: ${pastTasteSummary}` : "",
  ].join("\n");

  return runBriefPrompt(systemPrompt, userPrompt);
}

export interface LikedTitleSummary {
  title: string;
  genres: string[];
  synopsis: string;
  likedBy: ("a" | "b")[];
}

/** After a no-match round, leans the brief into whatever both partners actually right-swiped. */
export async function refineFromLikes(
  prefsA: PreferenceInput,
  prefsB: PreferenceInput,
  likedTitles: LikedTitleSummary[]
): Promise<SearchBrief> {
  const systemPrompt =
    "You help two people agree on what to watch. Round 1 of swiping didn't produce a match. Look " +
    "at what each partner actually swiped right on — that's a stronger signal than their original " +
    "form answers — and produce a new TMDB search brief for round 2 that leans into the common " +
    "threads (genre, tone, era, cast/director if evident) between what both partners liked.";

  const likedLines = likedTitles.length
    ? likedTitles
        .map((t) => `- "${t.title}" (${t.genres.join("/")}) — liked by ${t.likedBy.join(" & ")}: ${t.synopsis}`)
        .join("\n")
    : "(neither partner liked anything in round 1 — fall back to their original stated preferences, but broaden the range a bit.)";

  const userPrompt = [
    formatPrefs("Partner A original preferences", prefsA),
    "",
    formatPrefs("Partner B original preferences", prefsB),
    "\nWhat each partner right-swiped in round 1:",
    likedLines,
  ].join("\n");

  return runBriefPrompt(systemPrompt, userPrompt);
}

export interface PastSessionSummary {
  matchedTitle: string | null;
  rating: number | null;
  likedTitles: string[];
}

/** Produces a short taste-profile paragraph from a couple's history, fed back into future briefs. */
export async function summarizeTaste(pastSessions: PastSessionSummary[]): Promise<string> {
  if (pastSessions.length === 0) return "";

  const lines = pastSessions.map((s) => {
    const parts = [];
    if (s.matchedTitle) parts.push(`matched on "${s.matchedTitle}"${s.rating ? ` (rated ${s.rating}/5 after watching)` : ""}`);
    if (s.likedTitles.length) parts.push(`both liked: ${s.likedTitles.join(", ")}`);
    return `- ${parts.join("; ") || "no match that session"}`;
  });

  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: lines.join("\n"),
    config: {
      systemInstruction:
        "Summarize this couple's watch history into one short paragraph (2-3 sentences) describing " +
        "their shared taste — genres, tones, or patterns worth leaning into next time. Be concrete, not generic.",
    },
  });

  return (response.text ?? "").trim();
}
