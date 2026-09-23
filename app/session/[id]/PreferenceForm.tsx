"use client";

import { useState } from "react";
import type { ContentType, Era, Language, MinRating, Mood, PreferenceInput } from "@/lib/types";

const MOODS: { value: Mood; label: string }[] = [
  { value: "light_fun", label: "Light & fun" },
  { value: "intense_gripping", label: "Intense & gripping" },
  { value: "scary", label: "Scary" },
  { value: "romantic", label: "Romantic" },
  { value: "other", label: "Other" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "hindi", label: "Hindi" },
  { value: "english", label: "English" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "kannada", label: "Kannada" },
  { value: "any", label: "Any" },
];

const ERAS: { value: Era; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "classic", label: "Classic (pre-2000)" },
  { value: "2000_2020", label: "2000–2020" },
  { value: "recent", label: "Recent (2021–2026)" },
];

const RATINGS: MinRating[] = [6, 7, 8, 9];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        selected
          ? "border-ember bg-ember/15 text-paper"
          : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">{title}</h2>
      {children}
    </section>
  );
}

export default function PreferenceForm({
  partnerLabel,
  onSubmit,
  submitting,
  error,
}: {
  partnerLabel: string;
  onSubmit: (prefs: PreferenceInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [moodText, setMoodText] = useState("");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [contentType, setContentType] = useState<ContentType>("movies");
  const [minRating, setMinRating] = useState<MinRating>(7);
  const [eras, setEras] = useState<Era[]>([]);

  function toggleMood(value: Mood) {
    setMoods((prev) => (prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value]));
  }

  function toggleLanguage(value: Language) {
    if (value === "any") {
      setLanguages(["any"]);
      return;
    }
    setLanguages((prev) => {
      const withoutAny = prev.filter((l) => l !== "any");
      return withoutAny.includes(value) ? withoutAny.filter((l) => l !== value) : [...withoutAny, value];
    });
  }

  function toggleEra(value: Era) {
    if (value === "any") {
      setEras(["any"]);
      return;
    }
    setEras((prev) => {
      const withoutAny = prev.filter((e) => e !== "any");
      return withoutAny.includes(value) ? withoutAny.filter((e) => e !== value) : [...withoutAny, value];
    });
  }

  const canSubmit = languages.length > 0 && eras.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ moods, moodText, languages, contentType, minRating, eras });
      }}
      className="flex w-full flex-col gap-8"
    >
      <div>
        <p className="text-sm text-white/50">{partnerLabel}</p>
        <h1 className="font-display text-3xl font-semibold text-paper">What are you in the mood for?</h1>
      </div>

      <Section title="Mood">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip key={m.value} selected={moods.includes(m.value)} onClick={() => toggleMood(m.value)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <textarea
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          placeholder="Describe what you're in the mood for tonight (optional)"
          rows={3}
          className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-paper placeholder:text-white/35 focus:border-ember focus:outline-none"
        />
      </Section>

      <Section title="Language">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l.value} selected={languages.includes(l.value)} onClick={() => toggleLanguage(l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Content type">
        <div className="flex gap-2">
          <Chip selected={contentType === "movies"} onClick={() => setContentType("movies")}>
            Movies only
          </Chip>
          <Chip selected={contentType === "include_series"} onClick={() => setContentType("include_series")}>
            Include series
          </Chip>
        </div>
      </Section>

      <Section title="Minimum rating">
        <div className="flex flex-wrap items-center gap-2">
          {RATINGS.map((r) => (
            <Chip key={r} selected={minRating === r} onClick={() => setMinRating(r)}>
              {r}+
            </Chip>
          ))}
          {minRating === 9 && <span className="text-xs text-white/40">very few titles</span>}
        </div>
      </Section>

      <Section title="Era">
        <div className="flex flex-wrap gap-2">
          {ERAS.map((e) => (
            <Chip key={e.value} selected={eras.includes(e.value)} onClick={() => toggleEra(e.value)}>
              {e.label}
            </Chip>
          ))}
        </div>
      </Section>

      {error && <p className="text-sm text-ember">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full rounded-2xl bg-gradient-to-r from-ember to-ember2 px-8 py-4 text-lg font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Submit preferences"}
      </button>
    </form>
  );
}
