/**
 * Thompson Sampling for card selection.
 *
 * Samples from the posterior over the taste vector and selects the design
 * with the highest sampled like-probability. Applies diversity constraints
 * to prevent showing similar designs consecutively.
 */

import type { TasteVector } from "./types";

/** Sample from N(mean, variance) using Box-Muller transform. */
function sampleNormal(mean: number, variance: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * Math.sqrt(variance);
}

/** Logistic sigmoid. */
function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/** Dot product. */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProd = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProd += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProd / denom;
}

/** Minimum cosine distance from a candidate to any recently shown design. */
const DIVERSITY_THRESHOLD = 0.85; // max allowed similarity to recent cards

export interface CandidateDesign {
  id: string;
  embedding: number[];
}

/**
 * Select the next card to show via Thompson Sampling.
 *
 * @param taste - Current taste vector with uncertainty
 * @param candidates - All available designs with embeddings
 * @param recentEmbeddings - Embeddings of recently shown designs (for diversity)
 * @param alreadySwiped - Set of design IDs already swiped
 * @returns The selected design ID, or null if no candidates remain
 */
export function selectNextCard(
  taste: TasteVector,
  candidates: CandidateDesign[],
  recentEmbeddings: number[][],
  alreadySwiped: Set<string>
): string | null {
  // Filter out already-swiped designs
  const available = candidates.filter((c) => !alreadySwiped.has(c.id));

  if (available.length === 0) return null;

  // Cold-start: for the first few cards, pick maximally diverse designs
  if (taste.swipeCount < 5) {
    return selectDiverse(available, recentEmbeddings);
  }

  // Sample a taste vector from the posterior: w_sample ~ N(w_mean, diag(uncertainty))
  const wSample = taste.weights.map((w, i) =>
    sampleNormal(w, taste.uncertainty[i])
  );

  // Score each candidate
  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const candidate of available) {
    // Diversity check: skip if too similar to recently shown
    if (isTooSimilar(candidate.embedding, recentEmbeddings)) {
      continue;
    }

    const score = sigmoid(dot(wSample, candidate.embedding));

    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  // Fallback: if all candidates were filtered by diversity, just pick the best
  if (bestId === null && available.length > 0) {
    for (const candidate of available) {
      const score = sigmoid(dot(wSample, candidate.embedding));
      if (score > bestScore) {
        bestScore = score;
        bestId = candidate.id;
      }
    }
  }

  return bestId;
}

/** Check if an embedding is too similar to any recent embedding. */
function isTooSimilar(
  embedding: number[],
  recentEmbeddings: number[][]
): boolean {
  for (const recent of recentEmbeddings) {
    if (cosineSimilarity(embedding, recent) > DIVERSITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Cold-start selection: pick the candidate most distant from recent ones.
 * For the very first card, pick randomly.
 */
function selectDiverse(
  available: CandidateDesign[],
  recentEmbeddings: number[][]
): string {
  if (recentEmbeddings.length === 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx].id;
  }

  let bestId = available[0].id;
  let bestMinDist = -Infinity;

  for (const candidate of available) {
    // Minimum distance to any recent card
    let minSim = -Infinity;
    for (const recent of recentEmbeddings) {
      const sim = cosineSimilarity(candidate.embedding, recent);
      if (sim > minSim) minSim = sim;
    }
    // We want the candidate with the lowest max-similarity (most different)
    const diversity = -minSim;
    if (diversity > bestMinDist) {
      bestMinDist = diversity;
      bestId = candidate.id;
    }
  }

  return bestId;
}
