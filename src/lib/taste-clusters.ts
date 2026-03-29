/**
 * Multi-cluster taste profiles.
 *
 * A single taste vector averages out contradictions — someone who loves both
 * minimalist Swiss design and maximalist editorial layouts ends up with a
 * washed-out centroid that describes neither preference. This module detects
 * 2–3 distinct clusters in the liked embeddings via k-means and builds a
 * mini taste profile per cluster.
 */

import type { TasteAxis, TasteCluster, TasteProfile } from "./types";
import { computeAxisScores, generateDescription } from "./taste-axes";
import type { TasteVector } from "./types";

// ── Vector math helpers ──

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function scaleVector(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

function zeroVector(dim: number): number[] {
  return new Array(dim).fill(0);
}

// ── K-means ──

interface KMeansResult {
  centroids: number[][];
  assignments: number[];
}

/** Pick k initial centroids via k-means++ initialization. */
function initCentroids(points: number[][], k: number): number[][] {
  const centroids: number[][] = [];
  // First centroid: random point
  const firstIdx = Math.floor(Math.random() * points.length);
  centroids.push([...points[firstIdx]]);

  for (let c = 1; c < k; c++) {
    // Compute distance from each point to nearest existing centroid
    const distances = points.map((p) => {
      let minDist = Infinity;
      for (const cent of centroids) {
        const d = euclideanDistance(p, cent);
        if (d < minDist) minDist = d;
      }
      return minDist * minDist; // squared for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      // All points are identical — just pick any
      centroids.push([...points[c % points.length]]);
      continue;
    }

    // Weighted random selection
    let r = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...points[i]]);
        break;
      }
    }
    // Edge case: floating point — push last point if nothing selected
    if (centroids.length <= c) {
      centroids.push([...points[points.length - 1]]);
    }
  }

  return centroids;
}

function kMeans(points: number[][], k: number, maxIter = 20): KMeansResult {
  const dim = points[0].length;
  let centroids = initCentroids(points, k);
  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = points.map((p) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = euclideanDistance(p, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      return bestIdx;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Recompute centroids
    const sums = Array.from({ length: k }, () => zeroVector(dim));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      sums[c] = addVectors(sums[c], points[i]);
      counts[c]++;
    }

    centroids = sums.map((s, c) =>
      counts[c] > 0 ? scaleVector(s, 1 / counts[c]) : centroids[c]
    );
  }

  return { centroids, assignments };
}

// ── Silhouette score (simplified) ──

function silhouetteScore(points: number[][], assignments: number[], k: number): number {
  if (k <= 1 || points.length <= k) return -1;

  let totalScore = 0;

  for (let i = 0; i < points.length; i++) {
    const myCluster = assignments[i];

    // Mean intra-cluster distance (a)
    let aSum = 0;
    let aCount = 0;
    for (let j = 0; j < points.length; j++) {
      if (j !== i && assignments[j] === myCluster) {
        aSum += euclideanDistance(points[i], points[j]);
        aCount++;
      }
    }
    const a = aCount > 0 ? aSum / aCount : 0;

    // Mean nearest-cluster distance (b)
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue;
      let bSum = 0;
      let bCount = 0;
      for (let j = 0; j < points.length; j++) {
        if (assignments[j] === c) {
          bSum += euclideanDistance(points[i], points[j]);
          bCount++;
        }
      }
      if (bCount > 0) {
        const meanDist = bSum / bCount;
        if (meanDist < b) b = meanDist;
      }
    }

    if (b === Infinity) b = 0;
    const maxAB = Math.max(a, b);
    totalScore += maxAB > 0 ? (b - a) / maxAB : 0;
  }

  return totalScore / points.length;
}

// ── Public API ──

/**
 * Detect taste clusters in liked embeddings.
 * Auto-selects k: uses 2 if <20 likes, otherwise tries k=2 and k=3
 * and picks whichever has a higher silhouette score.
 */
export function detectTasteClusters(
  likedEmbeddings: number[][],
  k?: number
): KMeansResult {
  if (likedEmbeddings.length < 2) {
    return {
      centroids: [likedEmbeddings[0] || []],
      assignments: likedEmbeddings.map(() => 0),
    };
  }

  if (k !== undefined) {
    return kMeans(likedEmbeddings, k);
  }

  // Auto-detect k
  if (likedEmbeddings.length < 20) {
    return kMeans(likedEmbeddings, 2);
  }

  // Try k=2 and k=3, pick better silhouette
  const result2 = kMeans(likedEmbeddings, 2);
  const result3 = kMeans(likedEmbeddings, 3);

  const score2 = silhouetteScore(likedEmbeddings, result2.assignments, 2);
  const score3 = silhouetteScore(likedEmbeddings, result3.assignments, 3);

  return score3 > score2 ? result3 : result2;
}

/**
 * Build a mini TasteProfile for each cluster.
 */
export function buildClusterProfiles(
  likedEmbeddings: number[][],
  result: KMeansResult,
  axes: TasteAxis[]
): TasteCluster[] {
  const k = result.centroids.length;
  const clusters: TasteCluster[] = [];

  for (let c = 0; c < k; c++) {
    const memberCount = result.assignments.filter((a) => a === c).length;
    if (memberCount === 0) continue;

    // Build a synthetic TasteVector from the cluster centroid
    const syntheticTaste: TasteVector = {
      weights: result.centroids[c],
      uncertainty: result.centroids[c].map(() => 1),
      swipeCount: memberCount,
    };

    const scores = computeAxisScores(syntheticTaste, axes);
    const description = generateDescription(scores);
    const confidence = Math.min(1, memberCount / 30);

    const profile: TasteProfile = {
      axes: scores,
      description,
      confidence,
      swipeCount: memberCount,
    };

    clusters.push({
      centroid: result.centroids[c],
      size: memberCount,
      profile,
    });
  }

  // Sort by cluster size descending (dominant taste first)
  clusters.sort((a, b) => b.size - a.size);

  return clusters;
}
