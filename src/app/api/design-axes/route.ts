import { NextResponse } from "next/server";
import { getEmbedding, loadTasteAxes } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const embedding = getEmbedding(id);
  if (!embedding) return NextResponse.json({ error: "unknown design" }, { status: 404 });

  const axes = loadTasteAxes();
  const scores = axes.map((ax) => ({
    name: ax.name,
    score: dot(embedding, ax.direction),
    lowLabel: ax.lowLabel,
    highLabel: ax.highLabel,
  }));

  const maxAbs = Math.max(...scores.map((s) => Math.abs(s.score)), 0.001);
  const normalized = scores.map((s) => ({ ...s, score: s.score / maxAbs }));

  const top3 = [...normalized]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3)
    .map((s) => ({
      name: s.name,
      label: s.score > 0 ? s.highLabel : s.lowLabel,
      score: s.score,
    }));

  return NextResponse.json({ axes: top3 });
}
