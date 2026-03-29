# Design Taste Algorithm Research

Research into the best algorithmic approach for a "Tinder for Design" — a swipe-based app that learns your digital design preferences.

---

## Problem Statement

We need an algorithm that:
1. Starts with zero knowledge of a user's taste
2. Shows design cards one at a time
3. Learns from binary feedback (swipe right = like, swipe left = dislike)
4. Gets smarter about *what to show next* (not just what you like)
5. Builds an interpretable "taste profile" over time

---

## Recommended Approach: CLIP Embeddings + Bayesian Thompson Sampling

After researching the landscape, the recommended architecture combines three layers:

### Layer 1: Design Embedding with CLIP

**What:** Use OpenAI's CLIP (or a fine-tuned variant) to embed every design image into a high-dimensional vector space.

**Why CLIP specifically:**
- Research shows CLIP features are *better* than classification-based features for aesthetic assessment because CLIP was trained on natural language descriptions that capture composition, style, mood — not just "what's in the image" ([CLIP Knows Image Aesthetics](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.1030584/full), [CLIP Brings Better Features to Visual Aesthetics Learners](https://arxiv.org/abs/2307.15640))
- Designs that "feel similar" will naturally cluster in CLIP space
- We can later use text descriptions to *explain* taste regions (e.g., "you like minimalist designs with muted color palettes")

**How it works:**
- Pre-compute CLIP embeddings for every design in our database
- Each design becomes a ~512-dimensional vector
- Similar designs are nearby in this space; different designs are far apart

### Layer 2: Taste Vector Learning

**What:** Maintain a Bayesian model of the user's "taste boundary" in CLIP embedding space.

**Two sub-approaches (can combine):**

#### Option A: Logistic Preference Model
- Learn a weight vector `w` such that `sigmoid(w · embedding)` predicts like/dislike probability
- This `w` vector *is* the taste vector — it defines a hyperplane separating liked from disliked designs
- Update with each swipe using Bayesian logistic regression
- Simple, interpretable, fast

#### Option B: Gaussian Process Preference Model
- Non-linear: can capture that you like *both* minimalist AND maximalist designs but not the middle ground
- More expressive but harder to interpret
- Better for users with complex, multi-modal tastes

**Recommendation:** Start with Option A (logistic model) for simplicity. The linear boundary in CLIP space is surprisingly powerful because CLIP already organizes designs by perceptual similarity.

### Layer 3: Active Card Selection with Thompson Sampling

**What:** Use Thompson Sampling to decide which design to show next, balancing exploration (learning about unknown preferences) vs. exploitation (showing things you'll probably like).

**Why Thompson Sampling:**
- Naturally handles the explore/exploit tradeoff without manual tuning
- Adapts as it learns — uncertain regions get more exploration, well-understood regions get exploited
- Works well in non-stationary environments where taste evolves ([Dynamic Prior Thompson Sampling for Cold-Start](https://arxiv.org/abs/2602.00943))
- Production-proven at scale in recommendation systems including Meta's Reels ([Epinet for Content Cold Start](https://arxiv.org/abs/2412.04484))

**How it works in our context:**
1. For each candidate card, sample a predicted like-probability from the posterior distribution
2. Show the card with the highest sampled probability
3. After the swipe, update the posterior
4. Repeat

**Cold-start strategy:** Use Dynamic Prior Thompson Sampling — instead of assuming 50/50 priors, initialize based on general population preferences so early cards aren't random garbage.

---

## Algorithm Alternatives Considered

| Algorithm | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Thompson Sampling + CLIP** | Bayesian, adaptive, proven at scale | Requires posterior approximation | **Recommended** |
| **Elo/TrueSkill Rating** | Simple, battle-tested | Designed for pairwise comparisons, not binary like/dislike | Better for A/B comparisons |
| **Collaborative Filtering** | Leverages other users' tastes | Needs many users first; cold-start problem | Good addition later |
| **KTO (Kahneman-Tversky Optimization)** | Designed for binary feedback, models loss aversion | Overkill for our use case, more for LLM alignment | Interesting for v2 |
| **Epsilon-Greedy** | Dead simple | Wastes exploration budget, no uncertainty modeling | Too naive |
| **UCB (Upper Confidence Bound)** | Deterministic, analyzable | Less adaptive than Thompson Sampling in practice | Reasonable alternative |

---

## Design Taste Dimensions

To make the taste profile interpretable, we can decompose preferences along these axes:

### Visual Dimensions
- **Color palette** — warm/cool, saturated/muted, monochromatic/vibrant, dark/light
- **Typography** — serif/sans-serif, bold/thin, decorative/minimal, tight/loose spacing
- **Layout** — grid-based/organic, dense/spacious, symmetric/asymmetric
- **Imagery style** — photographic/illustrated, abstract/concrete, flat/3D
- **Whitespace** — minimal/generous
- **Complexity** — minimalist/maximalist, simple/ornate

### Conceptual Dimensions
- **Era/movement** — modernist, brutalist, art deco, Y2K, contemporary
- **Mood** — playful/serious, warm/cold, energetic/calm
- **Industry feel** — tech/editorial/luxury/indie/corporate

### How to Extract These
- Use CLIP's text-image alignment: compute similarity between the user's liked designs and text descriptions like "minimalist design", "vibrant colors", "serif typography"
- The dimensions where liked designs score highest = the user's taste profile
- This gives us *explainable* taste descriptions, not just a black-box vector

---

## How Many Swipes to Build a Reliable Profile?

Research indicates:

- **10-20 strategically chosen swipes** significantly improve cold-start profiling ([Active Learning for Cold-Start](https://www.nature.com/articles/s41598-025-09708-2))
- **Which items you ask about matters more than how many** — active learning selects maximally informative cards
- Pairwise/binary comparisons (our swipe format) are **more reliable than rating scales** because they require simpler cognitive effort ([Pairwise Preference Elicitation](https://arxiv.org/html/2510.27342))
- A canonical basis of just **21 preference categories** captures >89% of human preference variation ([Canonical Basis of Preferences](https://arxiv.org/html/2503.24150v1))

**Practical phasing:**
| Swipes | Profile Quality |
|--------|----------------|
| 5-10 | Basic taste direction (e.g., "prefers minimal over complex") |
| 20-30 | Reliable core preferences across major dimensions |
| 50-100 | Nuanced profile capturing multi-dimensional taste |
| 100+ | Fine-grained, can distinguish sub-styles |

---

## Relevant Prior Art

### Academic
- **[DesignPref](https://arxiv.org/html/2511.20513)** — 12k pairwise comparisons of UI designs by 20 professional designers. Personalized models outperform aggregated ones even with 20x fewer examples.
- **[AesthetiQ (CVPR 2025)](https://github.com/52CV/CVPR-2025-Papers)** — Aesthetic preference alignment for graphic layout design using multimodal LLMs.
- **[ViPO](https://openreview.net/pdf/cc33a36e8a16848dd99f08763eb9d28783c0f5cc.pdf)** — 1M image preference pairs showing that only 20.79% of pairs have consistent rankings across 5 different reward models — proving taste is deeply subjective and personal.

### Industry
- **Tinder's TinVec** — Embeds user preferences into vectors from swipe co-occurrence patterns. Proximity in embedding space = similar taste. ([MLconf talk](https://mlconf.com/sessions/personalized-user-recommendations-at-tinder-the-t/))
- **Pinterest** — Uses visual embeddings for "more like this" recommendations
- **Spotify's Discover Weekly** — Collaborative filtering + content-based hybrid, the gold standard for taste learning

---

## Proposed Architecture Summary

```
┌─────────────────────────────────────────────────┐
│                 Design Database                  │
│         (curated design screenshots)             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            CLIP Embedding Layer                  │
│    (pre-compute 512-dim vector per design)       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         Thompson Sampling Selector               │
│  (picks next card balancing explore/exploit)      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              Swipe Interface                     │
│         ← dislike    like →                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│       Bayesian Taste Model Update                │
│  (logistic regression on CLIP embeddings)        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          Taste Profile Generator                 │
│  (CLIP text-alignment → interpretable labels)    │
└─────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Curate a design image dataset** — Collect 500-1000 diverse digital design screenshots (websites, apps, posters, UI components)
2. **Set up CLIP embedding pipeline** — Embed all designs, build nearest-neighbor index
3. **Implement the taste model** — Bayesian logistic regression in CLIP space
4. **Build the swipe UI** — Card stack with swipe gestures
5. **Wire up Thompson Sampling** — Active selection of next card
6. **Add taste profile visualization** — Show interpretable dimensions after N swipes
