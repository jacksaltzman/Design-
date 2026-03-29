# Design Taste Algorithm Research (V2)

## Multimodal Active Preference Learning with Bandit Exploration

A swipe-based app that learns your digital design preferences through binary feedback, occasional pairwise duels, and uncertainty-aware card selection.

---

## Problem Statement

We need an algorithm that:
1. Starts with zero knowledge of a user's taste (cold-start for a single user)
2. Shows design cards one at a time, with occasional head-to-head comparisons
3. Learns from binary feedback (swipe right = like, swipe left = dislike) and pairwise duels
4. Gets smarter about *what to show next* — maximally informative, not merely popular
5. Builds an interpretable "taste profile" that can be articulated back in natural language
6. Avoids feedback loops where the system only shows more of what's already popular

This is better served by active preference learning than pure collaborative filtering because the core problem is cold-start for a single user, and recent recommender work specifically treats active learning as the way to profile new users efficiently.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Design Database                       │
│            (curated design screenshots)                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Embedding Layer                             │
│                                                         │
│   MVP: CLIP ViT-L/14 (512-dim)                         │
│   Production: SigLIP 2 NaFlex (768-dim)                │
│   UI corpus: + UIClip quality filter                    │
│   Mature: + Promptable embeddings per taste axis        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Thompson Sampling Selector                     │
│                                                         │
│   Cold-start: Dynamic Prior TS (population priors)      │
│   Steady-state: posterior-sampled card selection         │
│   Diversity: consecutive-card diversity constraint       │
│   Duels: inject pairwise "which do you prefer?" ~10%    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               Swipe / Duel Interface                     │
│          ← dislike    like →    |   A vs B              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Dual Taste Model                              │
│                                                         │
│   Primary: Bayesian logistic regression (swipe data)    │
│     P(like | design) = sigmoid(w · embedding)           │
│                                                         │
│   Secondary: Bradley-Terry (pairwise duel data)         │
│     P(prefer A > B) = sigmoid(w · (eA - eB))           │
│                                                         │
│   Combined: shared taste vector w, dual loss            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│          Taste Profile Generator                         │
│                                                         │
│   Phase 1: CLIP text-alignment → interpretable labels   │
│   Phase 2: Promptable embeddings per taste axis         │
│   Output: natural-language taste description            │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Design Embedding

### MVP — CLIP ViT-L/14

OpenAI's CLIP remains the pragmatic starting point:
- Research shows CLIP features are better than classification-based features for aesthetic assessment because CLIP captures composition, style, mood — not just content ([CLIP Knows Image Aesthetics](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.976235/full), [CLIP Brings Better Features to Visual Aesthetics Learners](https://arxiv.org/abs/2307.15640))
- Vast community tooling: LAION aesthetic predictor, fine-tuned variants, tutorials
- 512-dim embeddings, well-understood behavior
- Pre-compute embeddings for entire design database; each design becomes a vector

### Production Upgrade — SigLIP 2 NaFlex

[SigLIP 2 (Feb 2025, Google DeepMind)](https://arxiv.org/abs/2502.14786) improves on CLIP in zero-shot classification, image-text retrieval, and transfer performance. Key advantages:
- **Native aspect ratio** via NaFlex variant — critical for design screenshots that aren't square (phones, desktops, posters all have different ratios)
- Improved semantic understanding and localization
- 768-dim embeddings with better dense feature quality
- Available at multiple scales: ViT-B (86M) through ViT-g (1B)
- [Hugging Face integration](https://huggingface.co/docs/transformers/model_doc/siglip2) available

**When to switch:** Once the MVP validates the core loop and we need production-quality embeddings. SigLIP 2 has less community tooling than CLIP today, so building on CLIP first reduces integration risk.

### UI-Specific Augmentation — UIClip

If the corpus is primarily app/web UI screenshots, [UIClip (UIST 2024)](https://arxiv.org/html/2404.12500v1) adds structural design understanding:
- Trained to assess UI quality and relevance from screenshot + description
- Highest agreement with human designer rankings among tested baselines
- Understands CRAP principles: contrast, repetition, alignment, proximity

**Important caveat:** UIClip assesses *quality*, not *taste*. It can tell you if a UI is well-made, not whether a specific user would like it. Use it as a **pre-filter** (remove low-quality designs before they enter the card pool) rather than as the primary embedding space.

### Mature Enhancement — Promptable Embeddings

Generic embeddings blur over the specific attributes that differentiate design taste. [Promptable Embeddings (NeurIPS 2025)](https://arxiv.org/abs/2505.15877) address this by conditioning the embedding on the attribute of interest:
- Standard CLIP: one fixed vector per image capturing global semantics
- Promptable: query-specific vectors that highlight particular attributes (typography style, color warmth, layout density)
- 15% improvement in attribute-focused retrieval at Recall@5

**For design taste this is critical** because preferences often hinge on specific details: type hierarchy, density, warmth, corner radius, asymmetry, editorial feel, or how "systematic" vs. "artsy" a screen feels. The system should learn not just "you like this screenshot" but "you like high-contrast editorial typography, restrained color, and expressive layouts that still feel ordered."

**When to add:** After the core taste axes are defined and validated. Promptable embeddings require per-axis text prompts, so the interpretive layer needs to exist first.

---

## Layer 2: Dual Taste Model

### Primary Model — Bayesian Logistic Regression (for swipes)

Most feedback will be standalone swipes. For this, standard Bayesian logistic regression is simpler and more direct than Bradley-Terry:

```
P(like | design) = sigmoid(w · embedding)
Prior: w ~ N(0, σ²I)
Update: Bayesian posterior update after each swipe
```

- The weight vector `w` *is* the taste vector — it defines a hyperplane separating liked from disliked designs in embedding space
- Fast to update (<100ms per swipe for real-time feel)
- Uncertainty over `w` directly feeds Thompson Sampling for card selection
- Linear boundary in CLIP/SigLIP space is surprisingly powerful because the embedding already organizes designs by perceptual similarity

### Secondary Model — Bradley-Terry (for pairwise duels)

For the ~10% of interactions that are head-to-head comparisons:

```
P(prefer A over B) = sigmoid(w · (eA - eB))
```

- Shares the same taste vector `w` with the primary model
- Pairwise comparisons are more information-dense than standalone likes because they give relative signal (A > B) rather than absolute signal (A = good) which shifts with mood
- Research on [active preference learning](https://www.sciencedirect.com/science/article/pii/S221282712100531X) confirms pairwise comparisons are more reliable for subjective judgments

### Why Both, Not Just One

- **Binary feedback (KTO-style)** is what we collect most of. Research in LLM alignment shows binary-signal methods [match or beat pairwise methods at scale](https://arxiv.org/html/2402.01306v1). The simpler signal is not the weaker one.
- **Pairwise feedback (Bradley-Terry)** is more information-dense per interaction but higher friction. Injecting it sparingly (~every 10th card) accelerates learning without fatiguing the user.
- A shared taste vector trained on both signals is strictly better than either alone.

### Future — Gaussian Process Model

For users with complex, multi-modal taste (likes *both* minimalist AND brutalist but not the middle ground), a GP preference model over the embedding space captures non-linear boundaries. Add when data justifies the complexity.

---

## Layer 3: Active Card Selection

### Thompson Sampling

Use Thompson Sampling to decide which design to show next:

1. For each candidate card, sample a predicted like-probability from the posterior over `w`
2. Show the card with the highest sampled probability
3. After the swipe, update the posterior
4. Repeat

**Why Thompson Sampling over alternatives:**
- Naturally balances explore/exploit without manual tuning of epsilon or temperature
- Uncertain regions get more exploration automatically; well-understood regions get exploited
- Works well in non-stationary environments where taste evolves
- Production-proven at Meta's Reels ([Epinet for Content Cold Start](https://arxiv.org/abs/2412.04484)) and in [neural contextual bandit literature](https://web.stanford.edu/~bvr/pubs/TS_Tutorial.pdf)

### Cold-Start Initialization (Critical Production Detail)

The default Beta(1,1) / uniform prior assigns 50% like-probability to unseen items. In practice, most designs won't match a user's taste, so this causes massive over-exploration of weak items in the first few cards.

[Dynamic Prior Thompson Sampling (2026)](https://arxiv.org/abs/2602.00943) solves this:
- Initialize priors from population-level preferences (aggregate swipe data from all users)
- Closed-form solution for prior mean that controls exploration intensity
- First 5 cards feel curated rather than random

**For a brand-new system with no population data:** Use design quality scores (from UIClip or LAION aesthetic predictor) as priors. Higher-quality designs get higher initial priors, ensuring early cards are at least well-made even if not taste-matched.

### Diversity Constraints

Prevent feedback loops by enforcing:
- No two consecutive cards from the same embedding cluster
- Minimum cosine distance between consecutive cards (e.g., > 0.3)
- Periodically inject cards from unexplored regions regardless of predicted score

### Pairwise Duel Injection

Every ~10th interaction, show two designs side by side instead of one:
- Select the pair to maximize information gain (designs where the model is most uncertain about relative preference)
- This teaches the model faster than standalone swipes alone
- A 2024 study on conversational recommenders found more guided elicitation improved objective recommendation performance even when self-reported UX differences were small

---

## Taste Dimensions & Interpretability

### Phase 1: Text-Anchored Axes (CLIP/SigLIP text-image alignment)

Compute similarity between the user's liked designs and text prompts to extract interpretable taste dimensions:

**Visual axes:**
| Axis | Low | High |
|------|-----|------|
| Color temperature | Cool, steel, blue | Warm, golden, earth |
| Color saturation | Muted, desaturated, greyscale | Vibrant, saturated, bold |
| Color palette | Monochromatic, restrained | Polychromatic, colorful |
| Typography | Sans-serif, geometric, clean | Serif, decorative, editorial |
| Type weight | Light, thin, delicate | Bold, heavy, impactful |
| Layout density | Spacious, airy, minimal | Dense, packed, information-rich |
| Layout structure | Grid-based, systematic, ordered | Organic, asymmetric, free-form |
| Whitespace | Generous, breathing room | Tight, efficient |
| Visual complexity | Minimalist, simple | Maximalist, ornate, layered |
| Imagery | Photographic, realistic | Illustrated, abstract, graphic |
| Dimensionality | Flat, 2D | Skeuomorphic, 3D, depth |

**Conceptual axes:**
| Axis | Low | High |
|------|-----|------|
| Formality | Casual, playful, indie | Formal, corporate, institutional |
| Energy | Calm, serene, quiet | Dynamic, energetic, bold |
| Era | Classic, timeless, traditional | Contemporary, trendy, cutting-edge |
| Craft feel | Digital, systematic, programmatic | Handmade, artisanal, human |

### Phase 2: Promptable Embeddings per Axis

Replace text-similarity with promptable embeddings for higher precision:
- For each axis, generate a prompted embedding: "What is the typography style in this design?"
- The prompted embedding isolates the relevant attribute, ignoring everything else
- Map the user's taste vector projected onto each prompted axis

### Output: Natural Language Taste Profile

Example output after 30 swipes:
> "You gravitate toward **editorial design** with **high-contrast typography** (strong serif headers, clean sans-serif body). You prefer **restrained, cool-toned color palettes** — not minimalist exactly, but **controlled complexity**: dense with information but never chaotic. Your taste sits at the intersection of **systematic structure and creative expression** — think expressive order."

---

## How Many Swipes to Build a Reliable Profile?

| Swipes | Profile Quality | What's Possible |
|--------|----------------|-----------------|
| 5-10 | Basic taste direction | "Prefers minimal over complex", "likes dark themes" |
| 20-30 | Reliable core preferences | Accurate across major taste axes, useful for recommendations |
| 50-100 | Nuanced multi-dimensional profile | Captures sub-styles, can distinguish editorial-minimal from Swiss-minimal |
| 100+ | Fine-grained, high confidence | Can predict preference on unseen designs with >80% accuracy |

Key research:
- ~20 actively-selected swipes for a reliable core profile ([Active Learning for Cold-Start](https://www.nature.com/articles/s41598-025-09708-2))
- [BAL-PM (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/d5e256c988bdee59a0f4d7a9bc1dd6d9-Paper-Conference.pdf): Bayesian active learning reduces needed feedback by 33-68% vs. random sampling
- [DesignPref](https://arxiv.org/html/2511.20513): Personalized models outperform aggregated ones even with 20x fewer examples
- [ViPO](https://openreview.net/pdf/cc33a36e8a16848dd99f08763eb9d28783c0f5cc.pdf): Only 20.79% of image pairs have consistent rankings across 5 reward models — taste is deeply personal
- A canonical basis of just [21 preference categories](https://arxiv.org/html/2503.24150v1) captures >89% of human preference variation

**Critical insight:** *Which* items you ask about matters far more than *how many*. Active learning with Thompson Sampling means 20 smart swipes > 100 random ones.

---

## Phased Implementation

### Phase 1: MVP (validate the core loop)
- CLIP ViT-L/14 embeddings, pre-computed
- Bayesian logistic regression taste model
- Uncertainty-based card selection (simplified Thompson Sampling)
- Swipe-only interface (no duels yet)
- Text-anchored taste axes via CLIP similarity
- Target: 500-1000 curated design images

### Phase 2: Production (optimize learning speed)
- Upgrade to SigLIP 2 NaFlex embeddings
- Full Thompson Sampling with Dynamic Prior initialization
- Pairwise duels injected ~10% of interactions
- Bradley-Terry secondary model sharing taste vector
- UIClip pre-filter for corpus quality
- Diversity constraints on consecutive cards
- Natural language taste profile generation
- Target: 5,000+ designs

### Phase 3: Scale (leverage network effects)
- Collaborative filtering layer (users with similar taste vectors)
- Promptable embeddings for per-axis precision
- Contrastive fine-tuning of embeddings from aggregate swipe data
- Graph-based approach (user-design interaction graph, a la Pinterest's PinSage)
- Time-varying preferences (decay old signals)
- Target: 50,000+ designs, 1,000+ users

---

## Evaluation Plan

### Offline Metrics
- **Pairwise accuracy:** On held-out labeled pairs, how often does the model correctly predict which design the user prefers?
- **NDCG@k:** How well does the model rank a user's top designs?
- **Swipes-to-convergence:** How many swipes until the taste vector stabilizes (cosine similarity between consecutive updates < threshold)?

### Online Metrics
- **Swipe-right rate over time:** Should increase as the model learns (exploitation working)
- **Prediction accuracy:** Does the model correctly predict the next swipe?
- **User retention:** Do users who get active-learning cards return more than users with random cards?

### A/B Tests
- Active selection (Thompson Sampling) vs. random card order
- With pairwise duels vs. swipe-only
- CLIP vs. SigLIP 2 embeddings (measure prediction accuracy)

---

## Algorithm Comparison

| Algorithm | Pros | Cons | Role |
|-----------|------|------|------|
| **Bayesian Logistic Regression** | Simple, fast, interpretable, direct for binary | Linear boundary | Primary taste model |
| **Bradley-Terry** | Information-dense pairwise signal | Higher friction, minority of interactions | Secondary model for duels |
| **Thompson Sampling** | Bayesian explore/exploit, no tuning | Requires posterior approximation | Card selection |
| **Dynamic Prior TS** | Solves cold-start | Needs population data or quality proxy | Initialization |
| **CLIP / SigLIP 2** | Rich aesthetic embeddings | Generic, may blur specific attributes | Embedding backbone |
| **Promptable Embeddings** | Attribute-level precision | Requires defined axes, newer technique | Mature taste profiling |
| **UIClip** | UI quality assessment | Quality not taste, limited scope | Pre-filter |
| **Collaborative Filtering** | Leverages other users | Needs many users, cold-start | Phase 3 addition |
| **Gaussian Process** | Non-linear taste boundaries | Harder to interpret, slower | Complex-taste users |

---

## Key Sources

### Embeddings & Visual Understanding
- [CLIP Knows Image Aesthetics (Frontiers in AI)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.976235/full)
- [CLIP Brings Better Features to Visual Aesthetics Learners (ICME 2025)](https://arxiv.org/abs/2307.15640)
- [SigLIP 2 (Google DeepMind, Feb 2025)](https://arxiv.org/abs/2502.14786)
- [UIClip (UIST 2024)](https://arxiv.org/html/2404.12500v1)
- [ScreenAI (IJCAI 2024)](https://arxiv.org/abs/2402.04615)
- [Promptable Embeddings for Attribute-Focused Retrieval (NeurIPS 2025)](https://arxiv.org/abs/2505.15877)

### Preference Learning & Active Learning
- [DesignPref: Personalized Visual Design Preferences](https://arxiv.org/html/2511.20513)
- [BAL-PM: Deep Bayesian Active Learning for Preference Modeling (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/d5e256c988bdee59a0f4d7a9bc1dd6d9-Paper-Conference.pdf)
- [KTO: Kahneman-Tversky Optimization](https://arxiv.org/html/2402.01306v1)
- [Active Preference Learning in Product Design](https://www.sciencedirect.com/science/article/pii/S221282712100531X)
- [Active Learning for Cold-Start Users (2025)](https://www.nature.com/articles/s41598-025-09708-2)
- [Canonical Basis of Human Preferences](https://arxiv.org/html/2503.24150v1)

### Bandit Algorithms & Exploration
- [A Tutorial on Thompson Sampling (Stanford)](https://web.stanford.edu/~bvr/pubs/TS_Tutorial.pdf)
- [Dynamic Prior Thompson Sampling for Cold-Start (2026)](https://arxiv.org/abs/2602.00943)
- [Epinet for Content Cold Start (Meta, 2024)](https://arxiv.org/abs/2412.04484)

### Industry & Products
- [Tinder TinVec (MLconf)](https://mlconf.com/sessions/personalized-user-recommendations-at-tinder-the-t/)
- [Pinterest PinSage](https://medium.com/pinterest-engineering/pinsage-a-new-graph-convolutional-neural-network-for-web-scale-recommender-systems-88795a107f48)
- [ViPO: Visual Preference Optimization at Scale](https://openreview.net/pdf/cc33a36e8a16848dd99f08763eb9d28783c0f5cc.pdf)
- [LAION Aesthetic Predictor](https://github.com/LAION-AI/aesthetic-predictor)
