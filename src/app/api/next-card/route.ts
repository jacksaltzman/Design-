import { NextResponse } from "next/server";
import { loadTasteState, getSwipedDesignIds, getRecentSwipedIds, getDesign } from "@/lib/db";
import { getAllCandidates, getEmbedding } from "@/lib/embeddings";
import { selectNextCard } from "@/lib/thompson-sampling";
import { tasteConfidence } from "@/lib/taste-model";

export const dynamic = "force-dynamic";

export async function GET() {
  const taste = loadTasteState();
  const candidates = getAllCandidates();
  const swiped = getSwipedDesignIds();

  // Get recent card embeddings for diversity constraint
  const recentIds = getRecentSwipedIds(5);
  const recentEmbeddings = recentIds
    .map((id) => getEmbedding(id))
    .filter((e): e is number[] => e !== null);

  const selectedId = selectNextCard(taste, candidates, recentEmbeddings, swiped);

  if (!selectedId) {
    return NextResponse.json(
      { error: "No more designs to show" },
      { status: 404 }
    );
  }

  const design = getDesign(selectedId);
  if (!design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    design: {
      ...design,
      imageUrl: `/designs/${design.filename}`,
    },
    swipeCount: taste.swipeCount,
    confidence: tasteConfidence(taste),
  });
}
