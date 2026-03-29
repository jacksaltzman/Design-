import { NextResponse } from "next/server";
import { getAllCandidates } from "@/lib/embeddings";
import { getDesign } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Return 9 maximally diverse designs for the onboarding grid.
 * Uses greedy farthest-point sampling to spread across the embedding space.
 */
export async function GET() {
  const candidates = getAllCandidates();

  if (candidates.length < 9) {
    // Not enough designs — return what we have
    const designs = candidates.map((c) => {
      const d = getDesign(c.id);
      return d ? { ...d, imageUrl: `/designs/${d.filename}` } : null;
    }).filter(Boolean);

    return NextResponse.json({ designs });
  }

  // Greedy farthest-point sampling for diversity
  const selected: number[] = [];
  const used = new Set<number>();

  // Start with a random design
  const first = Math.floor(Math.random() * candidates.length);
  selected.push(first);
  used.add(first);

  while (selected.length < 9) {
    let bestIdx = -1;
    let bestMinDist = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;

      // Minimum distance to any already-selected design
      let minDist = Infinity;
      for (const si of selected) {
        const dist = euclideanDist(candidates[i].embedding, candidates[si].embedding);
        if (dist < minDist) minDist = dist;
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(bestIdx);
    used.add(bestIdx);
  }

  const designs = selected.map((idx) => {
    const c = candidates[idx];
    const d = getDesign(c.id);
    return d ? { id: d.id, filename: d.filename, imageUrl: `/designs/${d.filename}` } : null;
  }).filter(Boolean);

  return NextResponse.json({ designs });
}

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
