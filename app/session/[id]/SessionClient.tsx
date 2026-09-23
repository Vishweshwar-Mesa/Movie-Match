"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";
import { getDeviceId, getStoredRole, setStoredRole } from "@/lib/device";
import type { Partner, PoolTitleRow, PreferenceInput, SessionRow } from "@/lib/types";
import PreferenceForm from "./PreferenceForm";
import QRShare from "./QRShare";
import SwipeDeck from "./SwipeDeck";
import MatchReveal from "./MatchReveal";
import FinalFive from "./FinalFive";
import RatingPrompt from "./RatingPrompt";

function Loader({ label }: { label: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-4 py-20 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-ember" />
      <p className="text-white/60">{label}</p>
    </div>
  );
}

export default function SessionClient({ sessionId }: { sessionId: string }) {
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [role, setRole] = useState<Partner | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [mySubmitted, setMySubmitted] = useState(false);
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);
  const [poolTitles, setPoolTitles] = useState<PoolTitleRow[]>([]);
  const [alreadySwipedIds, setAlreadySwipedIds] = useState<Set<string>>(new Set());
  const [deckFinished, setDeckFinished] = useState(false);
  const [matchedTitle, setMatchedTitle] = useState<PoolTitleRow | null>(null);
  const [finalTitles, setFinalTitles] = useState<PoolTitleRow[]>([]);
  const [pickedTitle, setPickedTitle] = useState<PoolTitleRow | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSubmitting, setPrefsSubmitting] = useState(false);

  const advancingRef = useRef(false);

  // Realtime callbacks below are set up once per sessionId, but need to call the *latest*
  // versions of these loaders (which close over `role`/`session`, set asynchronously after
  // mount) — refs avoid a stale closure that would otherwise permanently see role=null.
  const loadMatchRef = useRef<() => void>(() => {});
  const loadPreferencesRef = useRef<() => void>(() => {});
  const checkRoundCompletionRef = useRef<() => void>(() => {});

  // --- bootstrap: device id + role ---------------------------------------
  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    const storedRole = getStoredRole(sessionId);
    if (storedRole) {
      setRole(storedRole);
      return;
    }
    // Fallback (e.g. partner A revisiting a link directly): join is idempotent for A.
    fetch(`/api/sessions/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: id }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.role) {
          setStoredRole(sessionId, body.role);
          setRole(body.role);
        }
      });
  }, [sessionId]);

  // --- data loaders ---------------------------------------------------------
  const loadSession = useCallback(async () => {
    const { data } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
    if (data) setSession(data as SessionRow);
  }, [sessionId, supabase]);

  const loadPreferences = useCallback(async () => {
    if (!role) return;
    const { data } = await supabase.from("preferences").select("partner").eq("session_id", sessionId);
    const partners = new Set((data ?? []).map((r) => r.partner));
    setMySubmitted(partners.has(role));
    setPartnerSubmitted(partners.has(role === "a" ? "b" : "a"));
  }, [role, sessionId, supabase]);

  const loadPoolAndProgress = useCallback(
    async (round: number) => {
      const { data: titles } = await supabase
        .from("pool_titles")
        .select("*")
        .eq("session_id", sessionId)
        .eq("round", round);
      setPoolTitles((titles ?? []) as PoolTitleRow[]);

      if (role) {
        const { data: mySwipes } = await supabase
          .from("swipes")
          .select("tmdb_id, media_type")
          .eq("session_id", sessionId)
          .eq("round", round)
          .eq("partner", role);
        const ids = new Set((mySwipes ?? []).map((s) => `${s.media_type}:${s.tmdb_id}`));
        setAlreadySwipedIds(ids);
        setDeckFinished(titles ? ids.size >= titles.length : false);
      }
    },
    [role, sessionId, supabase]
  );

  const loadMatch = useCallback(async () => {
    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("session_id", sessionId)
      .order("matched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!match) return;
    const { data: title } = await supabase
      .from("pool_titles")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round", match.round)
      .eq("tmdb_id", match.tmdb_id)
      .eq("media_type", match.media_type)
      .maybeSingle();
    if (title) setMatchedTitle(title as PoolTitleRow);
  }, [sessionId, supabase]);

  const loadFinalTitles = useCallback(
    async (picks: { tmdb_id: number; media_type: string }[]) => {
      const { data } = await supabase.from("pool_titles").select("*").eq("session_id", sessionId);
      const all = (data ?? []) as PoolTitleRow[];
      const ordered = picks
        .map((p) => all.find((t) => t.tmdb_id === p.tmdb_id && t.media_type === p.media_type))
        .filter((t): t is PoolTitleRow => Boolean(t));
      setFinalTitles(ordered);
    },
    [sessionId, supabase]
  );

  // --- round-completion check: fires the round-1 -> round-2 or -> final_pick transition ---
  const checkRoundCompletion = useCallback(async () => {
    if (!session || !deviceId || session.status !== "swiping" || advancingRef.current) return;
    const { count: aCount } = await supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round", session.round)
      .eq("partner", "a");
    const { count: bCount } = await supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round", session.round)
      .eq("partner", "b");
    const { count: poolCount } = await supabase
      .from("pool_titles")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round", session.round);

    if (!poolCount) return;
    if ((aCount ?? 0) >= poolCount && (bCount ?? 0) >= poolCount) {
      advancingRef.current = true;
      const endpoint = session.round === 1 ? "advance-round" : "finalize";
      await fetch(`/api/sessions/${sessionId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      advancingRef.current = false;
    }
  }, [session, deviceId, sessionId, supabase]);

  loadMatchRef.current = loadMatch;
  loadPreferencesRef.current = loadPreferences;
  checkRoundCompletionRef.current = checkRoundCompletion;

  // --- initial + reactive loads ---------------------------------------------
  useEffect(() => {
    if (!role) return;
    loadSession();
    loadPreferences();
  }, [role, loadSession, loadPreferences]);

  useEffect(() => {
    if (!session || !role) return;
    if (session.status === "swiping" || session.status === "matched") {
      loadPoolAndProgress(session.round);
    }
    if (session.status === "matched") loadMatch();
    if (session.status === "final_pick" && session.final_picks) loadFinalTitles(session.final_picks);
  }, [session, role, loadPoolAndProgress, loadMatch, loadFinalTitles]);

  useEffect(() => {
    checkRoundCompletion();
  }, [session?.status, session?.round, checkRoundCompletion]);

  // --- realtime subscriptions -------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as SessionRow)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `session_id=eq.${sessionId}` },
        () => loadMatchRef.current()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "preferences", filter: `session_id=eq.${sessionId}` },
        () => loadPreferencesRef.current()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "swipes", filter: `session_id=eq.${sessionId}` },
        () => checkRoundCompletionRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // --- actions ------------------------------------------------------------
  async function submitPreferences(prefs: PreferenceInput) {
    if (!deviceId) return;
    setPrefsSubmitting(true);
    setPrefsError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, preferences: prefs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't save your preferences.");
      setMySubmitted(true);
      loadSession();
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPrefsSubmitting(false);
    }
  }

  function handleSwipe(title: PoolTitleRow, direction: "right" | "left") {
    if (!deviceId || !session) return;
    setAlreadySwipedIds((prev) => new Set(prev).add(`${title.media_type}:${title.tmdb_id}`));
    fetch(`/api/sessions/${sessionId}/swipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        round: session.round,
        tmdbId: title.tmdb_id,
        mediaType: title.media_type,
        direction,
      }),
    });
  }

  function handleDeckComplete() {
    setDeckFinished(true);
    checkRoundCompletion();
  }

  async function submitRating(titleForRating: PoolTitleRow, stars: number, note: string) {
    setRatingSubmitting(true);
    try {
      await fetch(`/api/sessions/${sessionId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: titleForRating.tmdb_id, mediaType: titleForRating.media_type, stars, note }),
      });
    } finally {
      setRatingSubmitting(false);
    }
  }

  // --- render ---------------------------------------------------------------
  if (!role || !session) return <Loader label="Loading your session…" />;

  if (session.status === "collecting_prefs") {
    if (!mySubmitted) {
      return (
        <PreferenceForm
          partnerLabel={role === "a" ? "Partner A" : "Partner B"}
          onSubmit={submitPreferences}
          submitting={prefsSubmitting}
          error={prefsError}
        />
      );
    }
    if (role === "a" && !session.device_b_id) {
      return <QRShare sessionId={sessionId} />;
    }
    return <Loader label={partnerSubmitted ? "Almost there…" : "Waiting for your partner to fill in their preferences…"} />;
  }

  if (session.status === "generating_pool") {
    return <Loader label="Claude is picking tonight's shortlist…" />;
  }

  if (session.status === "swiping") {
    if (poolTitles.length === 0) return <Loader label="Loading tonight's picks…" />;
    const remaining = poolTitles.filter((t) => !alreadySwipedIds.has(`${t.media_type}:${t.tmdb_id}`));
    if (deckFinished || remaining.length === 0) {
      return <Loader label="Nice! Waiting for your partner to finish swiping…" />;
    }
    return (
      <SwipeDeck
        titles={remaining}
        totalCount={poolTitles.length}
        onSwipe={handleSwipe}
        onDeckComplete={handleDeckComplete}
      />
    );
  }

  if (session.status === "matched") {
    if (!matchedTitle) return <Loader label="Loading your match…" />;
    if (showRating) {
      return (
        <RatingPrompt
          titleName={matchedTitle.title}
          submitting={ratingSubmitting}
          onSubmit={(stars, note) => submitRating(matchedTitle, stars, note)}
        />
      );
    }
    return <MatchReveal title={matchedTitle} onRate={() => setShowRating(true)} />;
  }

  if (session.status === "final_pick") {
    if (pickedTitle) {
      return (
        <RatingPrompt
          titleName={pickedTitle.title}
          submitting={ratingSubmitting}
          onSubmit={(stars, note) => submitRating(pickedTitle, stars, note)}
        />
      );
    }
    if (finalTitles.length === 0) return <Loader label="Tallying your swipes…" />;
    return <FinalFive titles={finalTitles} onPick={setPickedTitle} />;
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold text-paper">Enjoy the movie</h1>
      <p className="text-white/60">Thanks for using Movie Match. See you next movie night.</p>
      <Link
        href="/"
        className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/70"
      >
        Start another Match Night
      </Link>
    </div>
  );
}
