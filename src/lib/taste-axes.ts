/**
 * Map the taste vector onto interpretable taste axes.
 *
 * Each axis is a direction in embedding space (precomputed from CLIP text
 * encodings). Projecting the taste vector onto each axis gives a score
 * indicating where the user's preference falls on that spectrum.
 */

import type { TasteAxis, TasteAxisScore, TasteProfile, TasteVector } from "./types";

/** Dot product. */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Compute score for each taste axis by projecting the taste vector. */
export function computeAxisScores(
  taste: TasteVector,
  axes: TasteAxis[]
): TasteAxisScore[] {
  const rawScores = axes.map((axis) => ({
    name: axis.name,
    lowLabel: axis.lowLabel,
    highLabel: axis.highLabel,
    raw: dot(taste.weights, axis.direction),
  }));

  // Normalize to approximately [-1, 1] using the max absolute score
  const maxAbs = Math.max(
    ...rawScores.map((s) => Math.abs(s.raw)),
    0.001 // avoid division by zero
  );

  return rawScores.map((s) => ({
    name: s.name,
    lowLabel: s.lowLabel,
    highLabel: s.highLabel,
    score: Math.max(-1, Math.min(1, s.raw / maxAbs)),
  }));
}

/** Generate a natural language taste description from axis scores. */
export function generateDescription(scores: TasteAxisScore[]): string {
  if (scores.length === 0) return "Start swiping to discover your design taste.";

  // Sort by absolute score (strongest preferences first)
  const sorted = [...scores].sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score)
  );

  const parts: string[] = [];

  // Take top 4 strongest axes
  for (const axis of sorted.slice(0, 4)) {
    const strength = Math.abs(axis.score);
    if (strength < 0.15) continue; // skip weak signals

    const label = axis.score > 0 ? axis.highLabel : axis.lowLabel;
    const qualifier =
      strength > 0.7 ? "strongly" : strength > 0.4 ? "" : "slightly";

    if (qualifier) {
      parts.push(`${qualifier} ${label.toLowerCase()}`);
    } else {
      parts.push(label.toLowerCase());
    }
  }

  if (parts.length === 0) {
    return "Your taste profile is still emerging. Keep swiping to refine it.";
  }

  if (parts.length === 1) {
    return `You gravitate toward designs that feel ${parts[0]}.`;
  }

  const last = parts.pop()!;
  return `You gravitate toward designs that feel ${parts.join(", ")} and ${last}.`;
}

/** Build a full taste profile from the taste vector and axes. */
export function buildTasteProfile(
  taste: TasteVector,
  axes: TasteAxis[]
): TasteProfile {
  const scores = computeAxisScores(taste, axes);
  const description = generateDescription(scores);

  // Confidence based on swipe count
  const confidence = Math.min(1, taste.swipeCount / 50);

  return {
    axes: scores,
    description,
    confidence,
    swipeCount: taste.swipeCount,
  };
}
