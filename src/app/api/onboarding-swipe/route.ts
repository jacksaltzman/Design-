import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState, recordSwipe, getSwipedDesignIdList } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";

/**
 * Process batch onboarding selections.
 * Selected designs get "liked", unselected get a weaker "dislike" signal.
 */
export async function POST(request: Request) {
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

  let taste = loadTasteState();
  const selectedSet = new Set(selectedIds);

  for (const id of allIds) {
    const embedding = getEmbedding(id);
    if (!embedding) continue;

    const liked = selectedSet.has(id);
    recordSwipe(id, liked);
    taste = updateTaste(taste, embedding, liked);
  }

  saveTasteState(taste);

  return NextResponse.json({
    swipeCount: taste.swipeCount,
    taste,
    swipedIds: getSwipedDesignIdList(),
  });
}
