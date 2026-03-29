import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState, recordSwipe, getSwipedDesignIdList } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

/**
 * Process batch onboarding selections.
 * Selected designs get "liked", unselected get a weaker "dislike" signal.
 */
export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  const body = await request.json();
  const { selectedIds, allIds } = body as {
    selectedIds: string[];
    allIds: string[];
  };

  if (!selectedIds || !allIds) {
    return NextResponse.json(
      { error: "Missing selectedIds or allIds" },
      { status: 400 }
    );
  }

  let taste = await loadTasteState(sessionId);
  const selectedSet = new Set(selectedIds);

  for (const id of allIds) {
    const embedding = getEmbedding(id);
    if (!embedding) continue;

    const liked = selectedSet.has(id);
    recordSwipe(sessionId, id, liked);
    taste = updateTaste(taste, embedding, liked);
  }

  saveTasteState(sessionId, taste);

  return NextResponse.json({
    swipeCount: taste.swipeCount,
    taste,
    swipedIds: getSwipedDesignIdList(sessionId),
  });
}
