/**
 * Data layer — in-memory store backed by Supabase for persistence.
 *
 * In-memory maps are keyed by sessionId so multiple sessions can coexist
 * in a single serverless instance. Supabase is used for cross-instance
 * persistence: reads happen on cold start (async), writes are fire-and-forget.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Design, TasteVector } from "./types";
import { initTasteVector } from "./taste-model";
import { getDimension, loadEmbeddings } from "./embeddings";
import { getSupabase } from "./supabase";

// ── In-memory state (per serverless instance, keyed by sessionId) ──

const swipesMap = new Map<string, { designId: string; liked: boolean; timestamp: number }[]>();
const tasteStateMap = new Map<string, TasteVector>();
const contextTasteStatesMap = new Map<string, Record<string, TasteVector>>();

let filenameLookup: Record<string, string> | null = null;
let categoryLookup: Record<string, string> | null = null;

function getSwipes(sessionId: string) {
  if (!swipesMap.has(sessionId)) swipesMap.set(sessionId, []);
  return swipesMap.get(sessionId)!;
}

function getContextTasteStates(sessionId: string): Record<string, TasteVector> {
  if (!contextTasteStatesMap.has(sessionId)) contextTasteStatesMap.set(sessionId, {});
  return contextTasteStatesMap.get(sessionId)!;
}

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

export function recordSwipe(sessionId: string, designId: string, liked: boolean, confidence?: number): void {
  const swipes = getSwipes(sessionId);
  swipes.push({ designId, liked, timestamp: Date.now() });

  // Fire-and-forget Supabase insert
  void Promise.resolve(
    getSupabase().from("swipes").insert({
      session_id: sessionId,
      design_id: designId,
      liked,
      confidence: confidence ?? null,
    })
  ).catch(() => {});
}

export function getSwipedDesignIds(sessionId: string): Set<string> {
  return new Set(getSwipes(sessionId).map((s) => s.designId));
}

export function getRecentSwipedIds(sessionId: string, limit: number): string[] {
  return getSwipes(sessionId)
    .slice(-limit)
    .reverse()
    .map((s) => s.designId);
}

export function getSwipeCount(sessionId: string): number {
  return getSwipes(sessionId).length;
}

/** Restore swipe history from client-persisted state. */
export function restoreSwipes(sessionId: string, designIds: string[]): void {
  swipesMap.set(
    sessionId,
    designIds.map((id) => ({
      designId: id,
      liked: true, // direction doesn't matter for "already seen" tracking
      timestamp: Date.now(),
    }))
  );
}

/** Get all swiped design IDs as an array. */
export function getSwipedDesignIdList(sessionId: string): string[] {
  return getSwipes(sessionId).map((s) => s.designId);
}

/** Get design IDs that were liked (swiped right). */
export function getLikedDesignIds(sessionId: string): string[] {
  return getSwipes(sessionId).filter((s) => s.liked).map((s) => s.designId);
}

// ── Taste State ──

export async function loadTasteState(sessionId: string): Promise<TasteVector> {
  // Return from in-memory map if already loaded
  if (tasteStateMap.has(sessionId)) {
    return tasteStateMap.get(sessionId)!;
  }

  // Cold start — try to load from Supabase
  try {
    const { data } = await supabase
      .from("taste_vectors")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (data) {
      const taste: TasteVector = {
        weights: data.weights as number[],
        uncertainty: data.uncertainty as number[],
        swipeCount: data.swipe_count as number,
      };
      tasteStateMap.set(sessionId, taste);
      return taste;
    }
  } catch {
    // Supabase unavailable or no record — fall through to default
  }

  const dim = getDimension();
  const taste = initTasteVector(dim);
  tasteStateMap.set(sessionId, taste);
  return taste;
}

export function saveTasteState(sessionId: string, taste: TasteVector): void {
  // Update in-memory synchronously
  tasteStateMap.set(sessionId, taste);

  // Fire-and-forget Supabase upsert
  void Promise.resolve(
    getSupabase().from("taste_vectors").upsert({
      session_id: sessionId,
      weights: taste.weights,
      uncertainty: taste.uncertainty,
      swipe_count: taste.swipeCount,
      updated_at: new Date().toISOString(),
    })
  ).catch(() => {});
}

// ── Category Lookup ──

/** Build a lookup from design ID → category using metadata + urls.json fallback. */
function getCategoryLookup(): Record<string, string> {
  if (categoryLookup) return categoryLookup;

  categoryLookup = {};

  // Primary: design_metadata.json (populated by capture script)
  try {
    const metaPath = join(process.cwd(), "data", "design_metadata.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
      id: string;
      category?: string;
    }[];
    for (const entry of meta) {
      if (entry.category) {
        categoryLookup[entry.id] = entry.category;
      }
    }
    if (Object.keys(categoryLookup).length > 0) return categoryLookup;
  } catch {
    // No metadata file
  }

  // Fallback: derive from urls.json using the same slugify logic as capture script
  try {
    const urlsPath = join(process.cwd(), "scripts", "urls.json");
    const urls = JSON.parse(readFileSync(urlsPath, "utf-8")) as {
      url: string;
      category?: string;
    }[];
    for (const entry of urls) {
      if (entry.category) {
        const id = entry.url
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/[\/\?#:]/g, "-")
          .replace(/-+/g, "-")
          .replace(/-$/, "")
          .toLowerCase()
          .slice(0, 80);
        categoryLookup[id] = entry.category;
      }
    }
  } catch {
    // No urls file
  }

  return categoryLookup;
}

/** Look up the category for a design ID, or null if unknown. */
export function getDesignCategory(designId: string): string | null {
  const lookup = getCategoryLookup();
  return lookup[designId] ?? null;
}

// ── Context Taste States (per-category, per-session) ──

export async function loadContextTasteState(sessionId: string, category: string): Promise<TasteVector> {
  const states = getContextTasteStates(sessionId);
  if (states[category]) return states[category];

  // Cold start — try to load from Supabase
  try {
    const { data } = await supabase
      .from("context_taste_vectors")
      .select("*")
      .eq("session_id", sessionId)
      .eq("category", category)
      .single();

    if (data) {
      const taste: TasteVector = {
        weights: data.weights as number[],
        uncertainty: data.uncertainty as number[],
        swipeCount: data.swipe_count as number,
      };
      states[category] = taste;
      return taste;
    }
  } catch {
    // Supabase unavailable or no record — fall through to default
  }

  const dim = getDimension();
  states[category] = initTasteVector(dim);
  return states[category];
}

export function saveContextTasteState(
  sessionId: string,
  category: string,
  taste: TasteVector
): void {
  const states = getContextTasteStates(sessionId);
  states[category] = taste;

  // Fire-and-forget Supabase upsert
  void Promise.resolve(
    getSupabase().from("context_taste_vectors").upsert({
      session_id: sessionId,
      category,
      weights: taste.weights,
      uncertainty: taste.uncertainty,
      swipe_count: taste.swipeCount,
      updated_at: new Date().toISOString(),
    })
  ).catch(() => {});
}

/** Get all context taste states that have been updated (swipeCount > 0). */
export function getAllContextTasteStates(sessionId: string): Record<string, TasteVector> {
  const states = getContextTasteStates(sessionId);
  const active: Record<string, TasteVector> = {};
  for (const [cat, taste] of Object.entries(states)) {
    if (taste.swipeCount > 0) {
      active[cat] = taste;
    }
  }
  return active;
}
