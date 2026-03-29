import { NextResponse } from "next/server";
import { saveTasteState, restoreSwipes } from "@/lib/db";
import type { TasteVector } from "@/lib/types";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

/**
 * Restore server-side state from client localStorage.
 * Called on page load when the client has persisted state.
 */
export async function POST(request: Request) {
  const sessionId = getSessionId(request);
  const body = await request.json();
  const { taste, swipedIds } = body as {
    taste: TasteVector;
    swipedIds: string[];
  };

  if (!taste || !swipedIds) {
    return NextResponse.json(
      { error: "Missing taste or swipedIds" },
      { status: 400 }
    );
  }

  saveTasteState(sessionId, taste);
  restoreSwipes(sessionId, swipedIds);

  return NextResponse.json({ ok: true });
}
