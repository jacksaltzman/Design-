/**
 * Generate design probes using Claude.
 *
 * Each probe is a self-contained HTML/CSS design rendered at a specific
 * viewport. Claude generates real, coded design — not images — following
 * specific design traditions with precise typographic and color instructions.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DesignHypothesis } from "./hypothesis-engine";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an exceptionally skilled visual designer who codes. You produce designs that feel like they were made by a senior designer at a top studio — not like AI output.

You will be given a design brief. You must return ONLY a complete, self-contained HTML file. No explanation, no markdown, no code fences. Just the HTML.

Rules:
- The design must fill exactly 1440×900 pixels (desktop viewport). Set html/body to this exact size with overflow:hidden.
- Use Google Fonts via @import. Choose fonts that a real designer would pair together.
- Every typographic choice must be intentional: specific font-size, line-height, letter-spacing, and font-weight.
- Use a real color palette — 2-4 colors max, with proper contrast ratios (WCAG AA minimum).
- Align elements to an implicit grid. Nothing should feel randomly placed.
- Include realistic placeholder content — real-sounding headlines, body text, labels. Not "Lorem ipsum." Write copy that feels like it belongs on a real website.
- Use CSS only. No JavaScript. No external images (use CSS gradients, shapes, or solid color blocks for visual interest).
- The design should feel like a real website's above-the-fold — a hero section, navigation hint, or editorial opening.
- Do NOT include any text that says "generated" or "AI" or "probe" or "test." This should look indistinguishable from a real website.
- Quality bar: would a creative director at Pentagram approve this? If not, it's not good enough.`;

export async function generateDesignProbe(
  hypothesis: DesignHypothesis,
  variant: "A" | "B"
): Promise<string> {
  const variantInstructions =
    variant === "A" ? hypothesis.variantA : hypothesis.variantB;

  const constantsDescription = Object.entries(hypothesis.holdConstant)
    .map(([axis, preference]) => `- ${axis}: ${preference}`)
    .join("\n");

  const userPrompt = `Design a website hero section in the ${hypothesis.tradition} tradition.

MUST follow these established preferences (hold constant):
${constantsDescription}

SPECIFIC DIRECTION for this variant:
${variantInstructions}

The design should feel cohesive and intentional — like a real site from a respected studio. Every detail matters: the spacing between the nav and headline, the weight of the body text, the exact padding of containers.

Return ONLY the complete HTML file. Nothing else.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let html = textBlock.text.trim();

  // Strip markdown code fences if Claude wrapped the output
  if (html.startsWith("```")) {
    html = html.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }

  return html;
}

/**
 * Generate a single design probe (not a hypothesis pair).
 * Used for injecting generated designs into the regular swipe flow.
 */
export async function generateSingleProbe(
  hypothesis: DesignHypothesis
): Promise<{ html: string; variant: "A" | "B" }> {
  // Randomly pick A or B — the model will learn from which way the user swipes
  const variant = Math.random() > 0.5 ? "A" : "B";
  const html = await generateDesignProbe(hypothesis, variant);
  return { html, variant };
}
