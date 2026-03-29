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

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Design, TasteVector } from "./types";
import { initTasteVector } from "./taste-model";
import { getDimension, loadEmbeddings } from "./embeddings";

// ── In-memory state (per serverless instance) ──

let swipes: { designId: string; liked: boolean; timestamp: number }[] = [];
let tasteState: TasteVector | null = null;
let filenameLookup: Record<string, string> | null = null;

/** Build a lookup from design ID → actual filename on disk. */
function getFilenameLookup(): Record<string, string> {
  if (filenameLookup) return filenameLookup;

  filenameLookup = {};

  // Try to load metadata from capture script
  try {
    const metaPath = join(process.cwd(), "data", "design_metadata.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { id: string; filename: string }[];
    for (const entry of meta) {
      filenameLookup[entry.id] = entry.filename;
    }
    return filenameLookup;
  } catch {
    // No metadata file — fall back to scanning the designs directory
  }

  try {
    const designsDir = join(process.cwd(), "public", "designs");
    const files = readdirSync(designsDir);
    for (const file of files) {
      const ext = file.match(/\.(png|jpg|jpeg|webp)$/i);
      if (ext) {
        const id = file.slice(0, -ext[0].length);
        filenameLookup[id] = file;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return filenameLookup;
}

// ── Designs (derived from embeddings.json + filesystem) ──

export function getDesign(id: string): Design | null {
  const index = loadEmbeddings();
  if (!index.embeddings[id]) return null;

  const lookup = getFilenameLookup();
  const filename = lookup[id] || `${id}.png`;

  return {
    id,
    filename,
  };
}

export function getAllDesigns(): Design[] {
  const index = loadEmbeddings();
  const lookup = getFilenameLookup();

  return Object.keys(index.embeddings).map((id) => ({
    id,
    filename: lookup[id] || `${id}.png`,
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

/** Restore swipe history from client-persisted state. */
export function restoreSwipes(designIds: string[]): void {
  swipes = designIds.map((id) => ({
    designId: id,
    liked: true, // direction doesn't matter for "already seen" tracking
    timestamp: Date.now(),
  }));
}

/** Get all swiped design IDs as an array. */
export function getSwipedDesignIdList(): string[] {
  return swipes.map((s) => s.designId);
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
