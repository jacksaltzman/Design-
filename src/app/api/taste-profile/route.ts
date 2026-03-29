import { NextResponse } from "next/server";
import { loadTasteState } from "@/lib/db";
import { loadTasteAxes } from "@/lib/embeddings";
import { buildTasteProfile } from "@/lib/taste-axes";

export const dynamic = "force-dynamic";

export async function GET() {
  const taste = loadTasteState();
  const axes = loadTasteAxes();
  const profile = buildTasteProfile(taste, axes);

  return NextResponse.json(profile);
}
