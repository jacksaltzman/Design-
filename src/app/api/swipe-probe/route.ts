import { NextResponse } from "next/server";
import { loadTasteState, saveTasteState } from "@/lib/db";
import { loadTasteAxes } from "@/lib/embeddings";
import { updateTaste } from "@/lib/taste-model";

/**
 * Handle swipe feedback on a generated design probe.
 *
 * Since probes don't have CLIP embeddings, we use the taste axis direction
 * as a pseudo-embedding. If the user liked variant B (high end), we nudge
 * the taste vector toward that axis direction. If they liked variant A (low
 * end), we nudge away from it.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { axis, variant, liked } = body as {
    axis: string;
    variant: "A" | "B";
    liked: boolean;
  };

  if (!axis || !variant || typeof liked !== "boolean") {
    return NextResponse.json(
      { error: "Missing axis, variant, or liked" },
      { status: 400 }
    );
  }

  const axes = loadTasteAxes();
  const tasteAxis = axes.find((a) => a.name === axis);

  if (!tasteAxis) {
    return NextResponse.json(
      { error: "Unknown axis" },
      { status: 404 }
    );
  }

  // Determine effective signal:
  // - Variant B represents the "high" end of the axis
  // - Variant A represents the "low" end (negative direction)
  // - Liking B = positive signal on this axis direction
  // - Liking A = negative signal on this axis direction
  const isHighEnd = variant === "B";
  const effectiveLiked = isHighEnd ? liked : !liked;

  const currentTaste = loadTasteState();
  const updatedTaste = updateTaste(
    currentTaste,
    tasteAxis.direction,
    effectiveLiked
  );
  saveTasteState(updatedTaste);

  return NextResponse.json({
    swipeCount: updatedTaste.swipeCount,
  });
}
