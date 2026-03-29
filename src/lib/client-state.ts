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
}

const CURRENT_VERSION = 1;

export function saveState(taste: TasteVector, swipedIds: string[]): void {
  try {
    const state: PersistedState = {
      taste,
      swipedIds,
      version: CURRENT_VERSION,
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
