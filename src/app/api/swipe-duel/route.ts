import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState, recordSwipe, getSwipedDesignIdList } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

/**
 * Process a duel result.
 *
 * Bradley-Terry update: treat (winner_emb - loser_emb) as a positive example.
 * This nudges the taste vector toward the winner relative to the loser.
 */
export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  const body = await request.json();
  const { winnerId, loserId } = body as {
    winnerId: string;
    loserId: string;
  };

  if (!winnerId || !loserId) {
    return NextResponse.json(
      { error: "Missing winnerId or loserId" },
      { status: 400 }
    );
  }

  const winnerEmb = getEmbedding(winnerId);
  const loserEmb = getEmbedding(loserId);

  if (!winnerEmb || !loserEmb) {
    return NextResponse.json(
      { error: "Unknown design" },
      { status: 404 }
    );
  }

  // Record both as swiped so they don't appear again
  recordSwipe(sessionId, winnerId, true);
  recordSwipe(sessionId, loserId, false);

  // Bradley-Terry: update with difference vector as "liked"
  const diffEmbedding = winnerEmb.map((w, i) => w - loserEmb[i]);

  const taste = await loadTasteState(sessionId);
  const updated = updateTaste(taste, diffEmbedding, true);
  saveTasteState(sessionId, updated);

  return NextResponse.json({
    swipeCount: updated.swipeCount,
    taste: updated,
    swipedIds: getSwipedDesignIdList(sessionId),
  });
}
