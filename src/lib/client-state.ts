/**
 * Client-side persistence for taste state.
 *
 * Stores the full taste vector and swipe history in localStorage so
 * learning survives page refreshes and serverless cold starts.
 */

import type { TasteVector } from "./types";

const STORAGE_KEY = "design-taste-state";

export interface PersistedState {
  taste: TasteVector;
  swipedIds: string[];
  version: number;
  sessionId: string;
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

export function saveState(taste: TasteVector, swipedIds: string[]): void {
  try {
    // Preserve existing sessionId or generate a new one
    const existing = getSessionId();
    const sessionId = existing ?? generateUUID();
    const state: PersistedState = {
      taste,
      swipedIds,
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
    return state;
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
