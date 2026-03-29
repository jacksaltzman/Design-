import { NextResponse } from "next/server";
import { loadTasteState, getSwipedDesignIds, getDesign } from "@/lib/db";
import { getAllCandidates } from "@/lib/embeddings";
import { predictLike } from "@/lib/taste-model";

export const dynamic = "force-dynamic";

/**
 * Pick two designs with similar predicted scores for a duel.
 * The most informative duel is between two designs the model
 * rates similarly — that's where it's least sure about ranking.
 */
export async function GET() {
  const taste = loadTasteState();
  const candidates = getAllCandidates();
  const swiped = getSwipedDesignIds();

  const available = candidates.filter((c) => !swiped.has(c.id));

  if (available.length < 2) {
    return NextResponse.json(
      { error: "Not enough designs for a duel" },
      { status: 404 }
    );
  }

  // Score all candidates
  const scored = available.map((c) => ({
    ...c,
    score: predictLike(taste, c.embedding),
  }));

  // Sort by predicted score
  scored.sort((a, b) => b.score - a.score);

  // Find the pair with the smallest score difference near the middle
  // (designs the model is most uncertain about ranking)
  let bestPair = [0, 1];
  let smallestDiff = Infinity;

  for (let i = 0; i < Math.min(scored.length - 1, 20); i++) {
    const diff = Math.abs(scored[i].score - scored[i + 1].score);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestPair = [i, i + 1];
    }
  }

  // Randomize left/right position
  const pair = [scored[bestPair[0]], scored[bestPair[1]]];
  if (Math.random() > 0.5) pair.reverse();

  const designs = pair.map((p) => {
    const d = getDesign(p.id);
    return d ? { ...d, imageUrl: `/designs/${d.filename}` } : null;
  });

  if (designs.some((d) => !d)) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ designs });
}
