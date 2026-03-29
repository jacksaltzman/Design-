import type { TasteAxisScore } from "./types";

interface TastePersona {
  id: string;
  name: string;
  description: string;
  axisScores: Record<string, number>;
}

export function findClosestPersona(
  axes: TasteAxisScore[],
  minSwipes: number,
  swipeCount: number
): { name: string; description: string; similarity: number } | null {
  if (swipeCount < minSwipes) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const personas: TastePersona[] = require("../../data/taste_personas.json");

  let bestMatch = null;
  let bestScore = -Infinity;

  for (const persona of personas) {
    let dot = 0, normA = 0, normB = 0;
    for (const axis of axes) {
      const pScore = persona.axisScores[axis.name] ?? 0;
      const weight = axis.confidence; // weight by confidence
      dot += axis.score * pScore * weight;
      normA += axis.score * axis.score * weight;
      normB += pScore * pScore;
    }
    const sim = normA > 0 && normB > 0
      ? dot / (Math.sqrt(normA) * Math.sqrt(normB))
      : 0;
    if (sim > bestScore) {
      bestScore = sim;
      bestMatch = { name: persona.name, description: persona.description, similarity: sim };
    }
  }

  return bestMatch;
}
