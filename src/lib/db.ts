/**
 * Data layer — in-memory store backed by JSON files.
 *
 * Vercel serverless functions have a read-only filesystem, so we can't use
 * SQLite. Instead, we derive design metadata from the embeddings JSON
 * (which is committed to the repo) and keep swipes + taste state in memory.
 *
 * State resets on cold start — acceptable for MVP. For production, swap
 * this with a real database (Postgres, Turso, etc.).
 */

import type { Design, TasteVector } from "./types";
import { initTasteVector } from "./taste-model";
import { getDimension, loadEmbeddings } from "./embeddings";

// ── In-memory state (per serverless instance) ──

let swipes: { designId: string; liked: boolean; timestamp: number }[] = [];
let tasteState: TasteVector | null = null;

// ── Designs (derived from embeddings.json) ──

export function getDesign(id: string): Design | null {
  const index = loadEmbeddings();
  if (!index.embeddings[id]) return null;

  // Detect file extension — try common formats
  return {
    id,
    filename: `${id}.png`,
    source: null as unknown as string | undefined,
    category: null as unknown as string | undefined,
  };
}

export function getAllDesigns(): Design[] {
  const index = loadEmbeddings();
  return Object.keys(index.embeddings).map((id) => ({
    id,
    filename: `${id}.png`,
  }));
}

// ── Swipes ──

export function recordSwipe(designId: string, liked: boolean): void {
  swipes.push({ designId, liked, timestamp: Date.now() });
}

export function getSwipedDesignIds(): Set<string> {
  return new Set(swipes.map((s) => s.designId));
}

export function getRecentSwipedIds(limit: number): string[] {
  return swipes
    .slice(-limit)
    .reverse()
    .map((s) => s.designId);
}

export function getSwipeCount(): number {
  return swipes.length;
}

// ── Taste State ──

export function loadTasteState(): TasteVector {
  if (!tasteState) {
    const dim = getDimension();
    tasteState = initTasteVector(dim);
  }
  return tasteState;
}

export function saveTasteState(taste: TasteVector): void {
  tasteState = taste;
}
