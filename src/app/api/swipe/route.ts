import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState, recordSwipe, getSwipedDesignIdList } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";
import type { SwipeRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as SwipeRequest;

  if (!body.designId || typeof body.liked !== "boolean") {
    return NextResponse.json(
      { error: "Missing designId or liked" },
      { status: 400 }
    );
  }

  const embedding = getEmbedding(body.designId);
  if (!embedding) {
    return NextResponse.json(
      { error: "Unknown design" },
      { status: 404 }
    );
  }

  recordSwipe(body.designId, body.liked);

  const currentTaste = loadTasteState();
  const updatedTaste = updateTaste(currentTaste, embedding, body.liked);
  saveTasteState(updatedTaste);

  return NextResponse.json({
    swipeCount: updatedTaste.swipeCount,
    taste: updatedTaste,
    swipedIds: getSwipedDesignIdList(),
  });
}
