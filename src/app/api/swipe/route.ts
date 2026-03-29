import { NextResponse } from "next/server";
import {
  loadTasteState,
  saveTasteState,
  recordSwipe,
  getSwipedDesignIdList,
  getDesignCategory,
  loadContextTasteState,
  saveContextTasteState,
} from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";
import type { SwipeRequest } from "@/lib/types";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

export async function POST(request: Request) {
  const sessionId = getSessionId(request);
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

  recordSwipe(sessionId, body.designId, body.liked, body.confidence);

  // Update global taste vector
  const currentTaste = await loadTasteState(sessionId);
  const updatedTaste = updateTaste(currentTaste, embedding, body.liked, body.confidence);
  saveTasteState(sessionId, updatedTaste);

  // Update category-specific taste vector (if category is known)
  const category = getDesignCategory(body.designId);
  if (category) {
    const contextTaste = await loadContextTasteState(sessionId, category);
    const updatedContext = updateTaste(contextTaste, embedding, body.liked, body.confidence);
    saveContextTasteState(sessionId, category, updatedContext);
  }

  return NextResponse.json({
    swipeCount: updatedTaste.swipeCount,
    taste: updatedTaste,
    swipedIds: getSwipedDesignIdList(sessionId),
  });
}
