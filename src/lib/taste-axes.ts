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

/**
 * Compute the projected variance of the taste vector's uncertainty
 * along a given axis direction: d^T diag(uncertainty) d.
 * Lower variance = the model has seen enough signal along this axis
 * to be confident about the user's preference.
 */
function projectedVariance(uncertainty: number[], direction: number[]): number {
  let v = 0;
  for (let i = 0; i < direction.length; i++) {
    v += direction[i] * direction[i] * uncertainty[i];
  }
  return v;
}

/** Compute score and per-axis confidence by projecting the taste vector. */
export function computeAxisScores(
  taste: TasteVector,
  axes: TasteAxis[]
): TasteAxisScore[] {
  const PRIOR_VARIANCE = 1.0; // must match taste-model.ts

  const rawScores = axes.map((axis) => {
    const raw = dot(taste.weights, axis.direction);
    // Projected variance along this axis direction
    const pv = projectedVariance(taste.uncertainty, axis.direction);
    // Prior projected variance (uniform prior)
    const priorPv = axis.direction.reduce((s, d) => s + d * d * PRIOR_VARIANCE, 0);
    // Confidence: how much uncertainty has shrunk from the prior along this axis
    const confidence = Math.max(0, Math.min(1, 1 - pv / priorPv));
    return { name: axis.name, lowLabel: axis.lowLabel, highLabel: axis.highLabel, raw, confidence };
  });

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
    confidence: s.confidence,
  }));
}

/** Generate a natural language taste description from axis scores. */
export function generateDescription(scores: TasteAxisScore[]): string {
  if (scores.length === 0) return "Start swiping to discover your design taste.";

  // Sort by |score| * confidence — axes that are both strong AND well-discriminated rise to the top
  const sorted = [...scores].sort(
    (a, b) =>
      Math.abs(b.score) * b.confidence - Math.abs(a.score) * a.confidence
  );

  const parts: string[] = [];

  // Take top 4 strongest+most-confident axes
  for (const axis of sorted.slice(0, 4)) {
    const strength = Math.abs(axis.score);
    if (strength < 0.15) continue; // skip weak signals
    if (axis.confidence < 0.05) continue; // skip axes with almost no discrimination

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
