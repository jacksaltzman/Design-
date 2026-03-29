/**
 * Bayesian Logistic Regression taste model.
 *
 * Maintains a taste vector w and diagonal uncertainty (variance) in CLIP
 * embedding space. P(like | design) = sigmoid(w · embedding).
 *
 * Uses Laplace approximation for online Bayesian updates.
 */

import type { TasteVector } from "./types";

const DEFAULT_DIMENSION = 512;
const PRIOR_VARIANCE = 1.0; // σ² for initial prior N(0, σ²I)
const LEARNING_RATE = 0.5; // step size for MAP update

/** Initialize a fresh taste vector with zero mean and uniform uncertainty. */
export function initTasteVector(dimension = DEFAULT_DIMENSION): TasteVector {
  return {
    weights: new Array(dimension).fill(0),
    uncertainty: new Array(dimension).fill(PRIOR_VARIANCE),
    swipeCount: 0,
  };
}

/** Logistic sigmoid. */
function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/** Dot product of two vectors. */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Predict the probability the user will like a design.
 */
export function predictLike(taste: TasteVector, embedding: number[]): number {
  return sigmoid(dot(taste.weights, embedding));
}

/**
 * Compute the predictive uncertainty for a design.
 * Higher uncertainty = model is less sure about this design.
 * Uses e^T Σ e where Σ = diag(uncertainty).
 */
export function predictUncertainty(
  taste: TasteVector,
  embedding: number[]
): number {
  let variance = 0;
  for (let i = 0; i < embedding.length; i++) {
    variance += embedding[i] * embedding[i] * taste.uncertainty[i];
  }
  return variance;
}

/**
 * Update the taste vector after a swipe.
 *
 * Uses online Bayesian logistic regression via Laplace approximation:
 * - Compute gradient of log-likelihood
 * - Update weights in the direction of the gradient, scaled by uncertainty
 * - Shrink uncertainty in the direction of the observed embedding
 *
 * Returns a new TasteVector (immutable update).
 */
export function updateTaste(
  taste: TasteVector,
  embedding: number[],
  liked: boolean
): TasteVector {
  const y = liked ? 1 : 0;
  const p = predictLike(taste, embedding);
  const error = y - p; // gradient of log-likelihood for logistic regression

  const newWeights = new Array(taste.weights.length);
  const newUncertainty = new Array(taste.uncertainty.length);

  for (let i = 0; i < taste.weights.length; i++) {
    // Gradient step scaled by current uncertainty (natural gradient)
    newWeights[i] =
      taste.weights[i] + LEARNING_RATE * taste.uncertainty[i] * error * embedding[i];

    // Shrink uncertainty: posterior precision += p(1-p) * e_i²
    // This is the Laplace approximation update for diagonal Hessian
    const hessianContrib = p * (1 - p) * embedding[i] * embedding[i];
    const priorPrecision = 1 / taste.uncertainty[i];
    newUncertainty[i] = 1 / (priorPrecision + hessianContrib);
  }

  return {
    weights: newWeights,
    uncertainty: newUncertainty,
    swipeCount: taste.swipeCount + 1,
  };
}

/**
 * Compute a confidence score [0, 1] based on how converged the taste vector is.
 * Based on the average uncertainty relative to the prior.
 */
export function tasteConfidence(taste: TasteVector): number {
  if (taste.swipeCount === 0) return 0;

  const avgUncertainty =
    taste.uncertainty.reduce((sum, u) => sum + u, 0) / taste.uncertainty.length;
  // Confidence = 1 - (current uncertainty / prior uncertainty)
  // Clamp to [0, 1]
  const confidence = Math.max(0, Math.min(1, 1 - avgUncertainty / PRIOR_VARIANCE));

  // Also factor in swipe count (diminishing returns)
  const countFactor = Math.min(1, taste.swipeCount / 50);

  return confidence * 0.7 + countFactor * 0.3;
}
