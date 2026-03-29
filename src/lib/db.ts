/**
 * SQLite database layer.
 * Handles designs, swipes, and taste state persistence.
 */

import Database from "better-sqlite3";
import { join } from "path";
import type { Design, TasteVector } from "./types";
import { initTasteVector } from "./taste-model";
import { getDimension } from "./embeddings";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const dbPath = join(process.cwd(), "data", "designs.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

// ── Designs ──

export function getDesign(id: string): Design | null {
  const row = getDb()
    .prepare("SELECT id, filename, source, category FROM designs WHERE id = ?")
    .get(id) as Design | undefined;
  return row ?? null;
}

export function getAllDesigns(): Design[] {
  return getDb()
    .prepare("SELECT id, filename, source, category FROM designs")
    .all() as Design[];
}

// ── Swipes ──

export function recordSwipe(designId: string, liked: boolean): void {
  getDb()
    .prepare("INSERT INTO swipes (design_id, liked) VALUES (?, ?)")
    .run(designId, liked ? 1 : 0);
}

export function getSwipedDesignIds(): Set<string> {
  const rows = getDb()
    .prepare("SELECT DISTINCT design_id FROM swipes")
    .all() as { design_id: string }[];
  return new Set(rows.map((r) => r.design_id));
}

export function getRecentSwipedIds(limit: number): string[] {
  const rows = getDb()
    .prepare(
      "SELECT design_id FROM swipes ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as { design_id: string }[];
  return rows.map((r) => r.design_id);
}

export function getSwipeCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM swipes")
    .get() as { count: number };
  return row.count;
}

// ── Taste State ──

/** Serialize a TasteVector's number arrays to Buffers for SQLite BLOB storage. */
function serializeFloats(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 8);
  for (let i = 0; i < arr.length; i++) {
    buf.writeDoubleLE(arr[i], i * 8);
  }
  return buf;
}

/** Deserialize a Buffer back to a number array. */
function deserializeFloats(buf: Buffer): number[] {
  const arr: number[] = [];
  for (let i = 0; i < buf.length; i += 8) {
    arr.push(buf.readDoubleLE(i));
  }
  return arr;
}

export function loadTasteState(): TasteVector {
  const row = getDb()
    .prepare("SELECT weights, uncertainty, swipe_count FROM taste_state WHERE id = 1")
    .get() as { weights: Buffer; uncertainty: Buffer; swipe_count: number } | undefined;

  if (!row) {
    const dim = getDimension();
    const initial = initTasteVector(dim);
    saveTasteState(initial);
    return initial;
  }

  return {
    weights: deserializeFloats(row.weights),
    uncertainty: deserializeFloats(row.uncertainty),
    swipeCount: row.swipe_count,
  };
}

export function saveTasteState(taste: TasteVector): void {
  const weightsBuf = serializeFloats(taste.weights);
  const uncertaintyBuf = serializeFloats(taste.uncertainty);

  getDb()
    .prepare(
      `INSERT INTO taste_state (id, weights, uncertainty, swipe_count, updated_at)
       VALUES (1, ?, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET
         weights = excluded.weights,
         uncertainty = excluded.uncertainty,
         swipe_count = excluded.swipe_count,
         updated_at = excluded.updated_at`
    )
    .run(weightsBuf, uncertaintyBuf, taste.swipeCount);
}
