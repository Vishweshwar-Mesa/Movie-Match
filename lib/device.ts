"use client";

const DEVICE_ID_KEY = "movie-match:device-id";

/** Persistent anonymous identity for this browser, used to tell partners apart and to
 * recognize returning couples across sessions (see `makePairKey`). */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    throw new Error("getDeviceId() must be called client-side.");
  }
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function roleKey(sessionId: string): string {
  return `movie-match:role:${sessionId}`;
}

export function getStoredRole(sessionId: string): "a" | "b" | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(roleKey(sessionId)) as "a" | "b" | null;
}

export function setStoredRole(sessionId: string, role: "a" | "b") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(roleKey(sessionId), role);
}
