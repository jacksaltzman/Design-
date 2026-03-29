import { NextResponse } from "next/server";
import { loadTasteState } from "@/lib/db";
import { loadTasteAxes } from "@/lib/embeddings";
import { generateHypothesis } from "@/lib/hypothesis-engine";
import { generateSingleProbe } from "@/lib/design-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30s for Claude generation

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  const taste = loadTasteState();

  // Only generate probes after enough swipes to have a taste signal
  if (taste.swipeCount < 10) {
    return NextResponse.json(
      { error: "Need at least 10 swipes before generating probes" },
      { status: 400 }
    );
  }

  const axes = loadTasteAxes();
  const hypothesis = generateHypothesis(taste, axes);

  try {
    const { html, variant } = await generateSingleProbe(hypothesis);

    return NextResponse.json({
      html,
      hypothesis: {
        question: hypothesis.question,
        axis: hypothesis.axis,
        tradition: hypothesis.tradition,
        variant,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
