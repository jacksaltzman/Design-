import { NextResponse } from "next/server";
import { loadTasteState, getLikedDesignIds, getAllContextTasteStates } from "@/lib/db";
import { loadTasteAxes, getEmbedding } from "@/lib/embeddings";
import { buildTasteProfile } from "@/lib/taste-axes";
import { detectTasteClusters, buildClusterProfiles } from "@/lib/taste-clusters";
import type { TasteProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

function getSessionId(request: Request): string {
  return request.headers.get("X-Session-ID") ?? "anon";
}

export async function GET(request: Request) {
  const sessionId = getSessionId(request);
  const taste = await loadTasteState(sessionId);
  const axes = loadTasteAxes();
  const profile = buildTasteProfile(taste, axes);

  // Compute clusters when there are enough likes (10+)
  const likedIds = getLikedDesignIds(sessionId);
  if (likedIds.length >= 10) {
    const likedEmbeddings: number[][] = [];
    for (const id of likedIds) {
      const emb = getEmbedding(id);
      if (emb) likedEmbeddings.push(emb);
    }

    if (likedEmbeddings.length >= 10) {
      const result = detectTasteClusters(likedEmbeddings);
      profile.clusters = buildClusterProfiles(likedEmbeddings, result, axes);
    }
  }

  // Build per-category context profiles
  const contextStates = getAllContextTasteStates(sessionId);
  if (Object.keys(contextStates).length > 0) {
    const contextProfiles: Record<string, TasteProfile> = {};
    for (const [category, contextTaste] of Object.entries(contextStates)) {
      contextProfiles[category] = buildTasteProfile(contextTaste, axes);
    }
    profile.contextProfiles = contextProfiles;
  }

  return NextResponse.json(profile);
}
