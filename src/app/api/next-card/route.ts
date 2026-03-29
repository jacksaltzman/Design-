import { NextResponse } from "next/server";
import { loadTasteState, getSwipedDesignIds, getRecentSwipedIds, getDesign } from "@/lib/db";
import { getAllCandidates, getEmbedding } from "@/lib/embeddings";
import { selectNextCard } from "@/lib/thompson-sampling";
import { tasteConfidence } from "@/lib/taste-model";

export const dynamic = "force-dynamic";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

export async function GET(request: Request) {
  const sessionId = getSessionId(request);
  const taste = await loadTasteState(sessionId);
  const candidates = getAllCandidates();
  const swiped = getSwipedDesignIds(sessionId);

  // Get recent card embeddings for diversity constraint
  const recentIds = getRecentSwipedIds(sessionId, 5);
  const recentEmbeddings = recentIds
    .map((id) => getEmbedding(id))
    .filter((e): e is number[] => e !== null);

  // Get all swiped embeddings for the novelty/information-gain bonus
  const allSwipedEmbeddings = Array.from(swiped)
    .map((id) => getEmbedding(id))
    .filter((e): e is number[] => e !== null);

  const selectedId = selectNextCard(taste, candidates, recentEmbeddings, swiped, allSwipedEmbeddings);

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
