import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState, recordSwipe, getSwipedDesignIdList } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";

/**
 * Process a duel result.
 *
 * Bradley-Terry update: treat (winner_emb - loser_emb) as a positive example.
 * This nudges the taste vector toward the winner relative to the loser.
 */
export async function POST(request: Request) {
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
  recordSwipe(winnerId, true);
  recordSwipe(loserId, false);

  // Bradley-Terry: update with difference vector as "liked"
  const diffEmbedding = winnerEmb.map((w, i) => w - loserEmb[i]);

  const taste = loadTasteState();
  const updated = updateTaste(taste, diffEmbedding, true);
  saveTasteState(updated);

  return NextResponse.json({
    swipeCount: updated.swipeCount,
    taste: updated,
    swipedIds: getSwipedDesignIdList(),
  });
}
