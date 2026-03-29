/**
 * Client-side persistence for taste state.
 *
 * Stores the full taste vector and swipe history in localStorage so
 * learning survives page refreshes and serverless cold starts.
 */

import type { TasteVector, TasteAxisScore } from "./types";

const STORAGE_KEY = "design-taste-state";

export interface PersistedState {
  taste: TasteVector;
  swipedIds: string[];
  likedIds: string[];
  version: number;
  sessionId: string;
  lastSessionSnapshot?: TasteAxisScore[];
  currentSessionStartSwipeCount?: number;
}

const CURRENT_VERSION = 1;

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as Partial<PersistedState>;
    return state.sessionId ?? null;
  } catch {
    return null;
  }
}

export function saveState(taste: TasteVector, swipedIds: string[], likedIds: string[] = []): void {
  try {
    // Preserve existing sessionId and extra fields (snapshot, session start) or generate a new one
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as Partial<PersistedState>) : null;
    const sessionId = existing?.sessionId ?? generateUUID();
    const state: PersistedState = {
      ...existing,
      taste,
      swipedIds,
      likedIds,
      version: CURRENT_VERSION,
      sessionId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as PersistedState;
    if (state.version !== CURRENT_VERSION) return null;
    if (!state.taste || !state.swipedIds) return null;
    return { ...state, likedIds: state.likedIds ?? [] };
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function saveSessionSnapshot(axes: TasteAxisScore[]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    state.lastSessionSnapshot = axes;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getSessionSnapshot(): TasteAxisScore[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state.lastSessionSnapshot ?? null;
  } catch { return null; }
}

export function initSessionStart(swipeCount: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.currentSessionStartSwipeCount === undefined) {
      state.currentSessionStartSwipeCount = swipeCount;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {}
}
