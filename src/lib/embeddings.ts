/**
 * Load and query pre-computed CLIP embeddings.
 * Embeddings are loaded once and cached in memory.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { EmbeddingIndex, TasteAxesFile, TasteAxis } from "./types";
import type { CandidateDesign } from "./thompson-sampling";

let cachedEmbeddings: EmbeddingIndex | null = null;
let cachedAxes: TasteAxis[] | null = null;

function getDataPath(filename: string): string {
  return join(process.cwd(), "data", filename);
}

/** Load embeddings from disk (cached after first call). */
export function loadEmbeddings(): EmbeddingIndex {
  if (cachedEmbeddings) return cachedEmbeddings;

  const raw = readFileSync(getDataPath("embeddings.json"), "utf-8");
  cachedEmbeddings = JSON.parse(raw) as EmbeddingIndex;
  return cachedEmbeddings;
}

/** Load taste axes from disk (cached after first call). */
export function loadTasteAxes(): TasteAxis[] {
  if (cachedAxes) return cachedAxes;

  const raw = readFileSync(getDataPath("taste_axes.json"), "utf-8");
  const data = JSON.parse(raw) as TasteAxesFile;
  cachedAxes = data.axes;
  return cachedAxes;
}

/** Get embedding for a single design. */
export function getEmbedding(designId: string): number[] | null {
  const index = loadEmbeddings();
  return index.embeddings[designId] ?? null;
}

/** Get all designs as candidates for Thompson Sampling. */
export function getAllCandidates(): CandidateDesign[] {
  const index = loadEmbeddings();
  return Object.entries(index.embeddings).map(([id, embedding]) => ({
    id,
    embedding,
  }));
}

/** Get the embedding dimension. */
export function getDimension(): number {
  return loadEmbeddings().dimension;
}
