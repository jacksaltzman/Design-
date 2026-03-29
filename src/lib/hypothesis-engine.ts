/**
 * Hypothesis engine for generative design probes.
 *
 * After enough swipes, the system identifies which taste dimensions are
 * ambiguous or correlated, and generates hypotheses to test. Each hypothesis
 * isolates a single variable while holding others constant.
 */

import type { TasteAxisScore, TasteVector } from "./types";
import { computeAxisScores } from "./taste-axes";
import type { TasteAxis } from "./types";

export interface DesignHypothesis {
  /** What we're testing */
  question: string;
  /** The axis being probed */
  axis: string;
  /** Design tradition / style context */
  tradition: string;
  /** Specific instructions for variant A (low end of axis) */
  variantA: string;
  /** Specific instructions for variant B (high end of axis) */
  variantB: string;
  /** Which variables to hold constant (from user's known preferences) */
  holdConstant: Record<string, string>;
}

/**
 * Design traditions with specific, opinionated instructions.
 * Each tradition is a real school of design with concrete parameters.
 */
const DESIGN_TRADITIONS = [
  {
    name: "Swiss International",
    description: "Helvetica Neue or Suisse Int'l, 12-column grid, asymmetric layout, black + one accent color, structured whitespace, photography",
    fonts: { heading: "Helvetica Neue", body: "Helvetica Neue" },
    colorMode: "light",
  },
  {
    name: "Japanese Editorial",
    description: "Noto Sans JP mixed with latin serif, vertical rhythm, generous margins, muted earth tones, photography with quiet composition",
    fonts: { heading: "Noto Serif", body: "Noto Sans" },
    colorMode: "light",
  },
  {
    name: "Neo-Brutalist",
    description: "System mono or Space Grotesk, thick black borders, bright primary accent, raw layout, visible grid structure, no rounded corners",
    fonts: { heading: "Space Grotesk", body: "Space Mono" },
    colorMode: "light",
  },
  {
    name: "Editorial Luxury",
    description: "High-contrast serif (Playfair Display or Cormorant), generous tracking on headings, dramatic scale contrast between heading and body, dark backgrounds, gold or cream accents",
    fonts: { heading: "Playfair Display", body: "Inter" },
    colorMode: "dark",
  },
  {
    name: "Scandinavian Functional",
    description: "Inter or DM Sans, plenty of whitespace, soft grays and muted pastels, rounded corners, subtle shadows, photography of objects and spaces",
    fonts: { heading: "DM Sans", body: "Inter" },
    colorMode: "light",
  },
  {
    name: "Tech Dark Mode",
    description: "Geist or JetBrains Mono, dark background (#0a0a0a), neon or gradient accents, glass-morphism cards, tight spacing, code-like precision",
    fonts: { heading: "Inter", body: "JetBrains Mono" },
    colorMode: "dark",
  },
  {
    name: "Dutch Experimental",
    description: "Variable-weight grotesque, unconventional grid breaks, overlapping elements, bold color blocks, text as visual element, playful but intentional",
    fonts: { heading: "Space Grotesk", body: "Work Sans" },
    colorMode: "light",
  },
  {
    name: "Warm Indie",
    description: "Rounded sans (Nunito, Quicksand) mixed with handwritten accents, warm earth palette (terracotta, cream, olive), organic shapes, textured backgrounds, illustration",
    fonts: { heading: "Nunito", body: "Quicksand" },
    colorMode: "light",
  },
];

/**
 * Generate a hypothesis based on the current taste state.
 *
 * Strategy:
 * 1. Find the axis with the most uncertainty (score closest to 0)
 * 2. Pick a design tradition that aligns with the user's stronger preferences
 * 3. Create two variants that differ only on the uncertain axis
 */
export function generateHypothesis(
  taste: TasteVector,
  axes: TasteAxis[],
): DesignHypothesis {
  const scores = computeAxisScores(taste, axes);

  // Sort by absolute score — weakest signal first (most uncertain)
  const sorted = [...scores].sort(
    (a, b) => Math.abs(a.score) - Math.abs(b.score)
  );

  // The axis we're least sure about
  const uncertainAxis = sorted[0];

  // The axes we're most sure about (use these as constants)
  const strongAxes = [...scores]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4);

  // Pick a tradition that feels aligned with the user's strong preferences
  const tradition = pickTradition(strongAxes);

  // Build hold-constant instructions from strong preferences
  const holdConstant: Record<string, string> = {};
  for (const axis of strongAxes) {
    const label = axis.score > 0 ? axis.highLabel : axis.lowLabel;
    holdConstant[axis.name] = label;
  }

  return {
    question: `Does the user prefer ${uncertainAxis.lowLabel} or ${uncertainAxis.highLabel}?`,
    axis: uncertainAxis.name,
    tradition: tradition.name,
    variantA: `Lean toward: ${uncertainAxis.lowLabel}. ${getAxisInstruction(uncertainAxis.name, "low")}`,
    variantB: `Lean toward: ${uncertainAxis.highLabel}. ${getAxisInstruction(uncertainAxis.name, "high")}`,
    holdConstant,
  };
}

/** Pick a design tradition that matches the user's strong preferences. */
function pickTradition(strongAxes: TasteAxisScore[]) {
  // Simple heuristic mapping
  const hasDark = strongAxes.some(
    (a) => a.name === "Color Temperature" && a.score < -0.3
  );
  const hasSerif = strongAxes.some(
    (a) => a.name === "Typography Style" && a.score > 0.3
  );
  const hasMinimal = strongAxes.some(
    (a) => a.name === "Visual Complexity" && a.score < -0.3
  );
  const hasBold = strongAxes.some(
    (a) => a.name === "Energy" && a.score > 0.3
  );

  if (hasDark && !hasSerif) return DESIGN_TRADITIONS[5]; // Tech Dark
  if (hasSerif && hasDark) return DESIGN_TRADITIONS[3]; // Editorial Luxury
  if (hasSerif && !hasDark) return DESIGN_TRADITIONS[1]; // Japanese Editorial
  if (hasMinimal) return DESIGN_TRADITIONS[4]; // Scandinavian
  if (hasBold) return DESIGN_TRADITIONS[2]; // Neo-Brutalist

  // Default: pick randomly from traditions
  return DESIGN_TRADITIONS[Math.floor(Math.random() * DESIGN_TRADITIONS.length)];
}

/** Get specific design instructions for each end of an axis. */
function getAxisInstruction(axisName: string, end: "low" | "high"): string {
  const instructions: Record<string, { low: string; high: string }> = {
    "Color Temperature": {
      low: "Use a cool palette: steel blue, slate gray, ice white. No warm tones.",
      high: "Use a warm palette: amber, cream, terracotta, golden tones. No cool blues.",
    },
    "Color Saturation": {
      low: "Use desaturated, muted colors. Grays, off-whites, dusty tones. Almost monochrome.",
      high: "Use bold, saturated colors. Strong hues, high chroma. Colors should pop.",
    },
    "Typography Style": {
      low: "Use only geometric sans-serif type. Clean, mechanical, no decorative flourish.",
      high: "Use a serif for headings. High contrast between thick and thin strokes. Editorial feel.",
    },
    "Type Weight": {
      low: "Use light/thin font weights. Delicate, airy typography. Max weight: 400.",
      high: "Use bold/heavy font weights. Strong, impactful headings. Min heading weight: 700.",
    },
    "Layout Density": {
      low: "Generous whitespace. Let elements breathe. Max 40% of the viewport should be content.",
      high: "Pack information densely. Multiple columns, tight spacing. Efficient use of every pixel.",
    },
    "Layout Structure": {
      low: "Strict grid alignment. Every element snaps to columns. Predictable, systematic.",
      high: "Break the grid. Overlap elements, use asymmetric placement, unexpected positions.",
    },
    "Visual Complexity": {
      low: "Minimal elements. One heading, one paragraph, one image or shape. Nothing extraneous.",
      high: "Layer multiple elements. Background textures, overlapping shapes, decorative details.",
    },
    "Imagery Style": {
      low: "Use photographic imagery. A realistic, high-quality photograph as the key visual.",
      high: "Use illustration or abstract graphics. Geometric shapes, hand-drawn elements, or vector art.",
    },
    "Dimensionality": {
      low: "Completely flat. No shadows, no gradients, no depth. Pure 2D.",
      high: "Add depth. Shadows, layering, glass-morphism, gradients that suggest 3D space.",
    },
    "Formality": {
      low: "Casual, playful, approachable. Rounded shapes, informal language, friendly feel.",
      high: "Formal, authoritative, polished. Sharp angles, serious tone, institutional feel.",
    },
    "Energy": {
      low: "Quiet, serene, contemplative. Slow pace, static composition, soft transitions.",
      high: "Dynamic, bold, energetic. Strong diagonals, high contrast, dramatic scale shifts.",
    },
    "Era Feel": {
      low: "Timeless, classic feel. Nothing trendy. Could have been designed 10 years ago or 10 years from now.",
      high: "Cutting-edge contemporary. Use current trends: variable fonts, mesh gradients, bento grids.",
    },
    "Craft Feel": {
      low: "Precise, systematic, computed. Perfect alignment, mathematical spacing, programmatic feel.",
      high: "Hand-crafted, human, organic. Slight imperfections, hand-drawn elements, warmth.",
    },
  };

  return instructions[axisName]?.[end] ?? "";
}

export { DESIGN_TRADITIONS };
