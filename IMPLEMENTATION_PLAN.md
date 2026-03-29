# Implementation Plan: Design Taste Learning App (Phase 1 MVP)

## Goal
Build a working "Tinder for Design" that learns a user's design taste through swipes, using CLIP embeddings + Bayesian logistic regression + Thompson Sampling.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | **Next.js 14 + TypeScript** | App router, RSC for initial load, easy API routes |
| Swipe UI | **react-tinder-card** or custom Framer Motion | Swipe gesture handling with spring physics |
| Styling | **Tailwind CSS** | Fast iteration, good defaults |
| Backend API | **Next.js API routes (Route Handlers)** | Keeps it one repo; no separate server for MVP |
| ML / Embeddings | **Python scripts** (offline preprocessing) | CLIP via `open_clip` or `transformers`, numpy for taste model |
| Taste Model Runtime | **TypeScript (in API routes)** | Bayesian logistic regression is just matrix math — keep it in the main app, no Python server needed at runtime |
| Database | **SQLite via better-sqlite3** (MVP) | Zero config, single file, fast enough for single-user MVP |
| Image Storage | **Local `/public/designs/` directory** (MVP) | Simple, no cloud infra needed |
| Embedding Storage | **JSON/binary file** (MVP) | Pre-computed CLIP vectors, loaded into memory on startup |

### Why no separate Python backend at runtime?
The taste model is a dot product + sigmoid + Bayesian update. This is ~20 lines of math that runs fine in TypeScript. The only Python needed is the **offline preprocessing** step (running CLIP on images). This keeps the deployed app simple — one Next.js process.

---

## Project Structure

```
Design-/
├── ALGORITHM_RESEARCH.md          # (exists)
├── IMPLEMENTATION_PLAN.md         # (this file)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
│
├── scripts/                       # Offline Python preprocessing
│   ├── requirements.txt           # open_clip, torch, numpy, pillow
│   ├── embed_designs.py           # Compute CLIP embeddings for all images
│   ├── compute_taste_axes.py      # Generate text embeddings for taste dimensions
│   └── seed_database.py           # Populate SQLite with design metadata + embeddings
│
├── data/
│   ├── designs.db                 # SQLite: design metadata, user swipes, taste vectors
│   ├── embeddings.json            # Pre-computed CLIP vectors (design_id → float[512])
│   └── taste_axes.json            # Pre-computed text embeddings for interpretable axes
│
├── public/
│   └── designs/                   # Design screenshot images (curated)
│       ├── 001.png
│       ├── 002.png
│       └── ...
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Main swipe interface
│   │   ├── profile/
│   │   │   └── page.tsx           # Taste profile visualization
│   │   └── api/
│   │       ├── next-card/
│   │       │   └── route.ts       # GET: Thompson Sampling → next card to show
│   │       ├── swipe/
│   │       │   └── route.ts       # POST: Record swipe, update taste model
│   │       └── taste-profile/
│   │           └── route.ts       # GET: Current taste profile (axes + description)
│   │
│   ├── components/
│   │   ├── SwipeCard.tsx           # Single design card with swipe gesture
│   │   ├── CardStack.tsx           # Stack of cards with swipe handling
│   │   ├── TasteProfile.tsx        # Radar/bar chart of taste dimensions
│   │   ├── SwipeCounter.tsx        # "12 swipes — your profile is taking shape"
│   │   └── TasteDescription.tsx    # Natural language taste summary
│   │
│   └── lib/
│       ├── taste-model.ts          # Bayesian logistic regression (core algorithm)
│       ├── thompson-sampling.ts    # Card selection with uncertainty sampling
│       ├── embeddings.ts           # Load and query pre-computed embeddings
│       ├── taste-axes.ts           # Map taste vector to interpretable dimensions
│       ├── db.ts                   # SQLite connection and queries
│       └── types.ts                # Shared TypeScript types
```

---

## Implementation Steps

### Step 1: Project Scaffolding
- Initialize Next.js 14 with TypeScript, Tailwind, App Router
- Set up project structure (directories, configs)
- Install dependencies: `better-sqlite3`, `framer-motion`
- Create TypeScript types for core domain objects

**Key types:**
```typescript
interface Design {
  id: string;
  imageUrl: string;
  source?: string;        // where the design came from
  tags?: string[];         // optional metadata
}

interface Swipe {
  designId: string;
  liked: boolean;
  timestamp: number;
}

interface TasteVector {
  weights: number[];       // 512-dim vector (same dim as CLIP)
  uncertainty: number[];   // per-dimension uncertainty (diagonal covariance)
  swipeCount: number;
}

interface TasteAxis {
  name: string;
  lowLabel: string;        // e.g., "Cool tones"
  highLabel: string;       // e.g., "Warm tones"
  textEmbedding: number[]; // CLIP text embedding for this axis
  score?: number;          // user's position on this axis (-1 to 1)
}

interface TasteProfile {
  axes: TasteAxis[];
  description: string;     // natural language summary
  confidence: number;      // 0-1 based on swipe count and convergence
}
```

### Step 2: Offline Preprocessing Pipeline (Python)

#### 2a: Curate Design Images
- Collect 200-500 diverse digital design screenshots to start
- Categories: websites, mobile apps, posters, dashboards, landing pages, editorial
- Place in `public/designs/`
- Create a simple CSV/JSON manifest with metadata (id, filename, source, category)

#### 2b: `embed_designs.py`
- Load CLIP ViT-L/14 via `open_clip`
- Process each image → 512-dim embedding vector
- Normalize embeddings to unit length
- Save as `data/embeddings.json`: `{ "001": [0.023, -0.114, ...], ... }`

#### 2c: `compute_taste_axes.py`
- Define ~15 taste axes as pairs of text prompts:
  ```python
  axes = [
    ("cool toned minimalist design", "warm toned colorful design"),
    ("sans-serif clean typography", "serif editorial typography"),
    ("spacious airy layout", "dense information-rich layout"),
    # ... etc
  ]
  ```
- Encode each prompt with CLIP text encoder
- Axis direction = normalized(high_embedding - low_embedding)
- Save as `data/taste_axes.json`

#### 2d: `seed_database.py`
- Create SQLite schema (designs table, swipes table, user_taste table)
- Insert design metadata
- Verify embedding dimensions match

### Step 3: Core Algorithm Implementation (TypeScript)

#### 3a: `taste-model.ts` — Bayesian Logistic Regression
```
Core operations:
- initTasteVector(): Initialize w ~ N(0, σ²I), return weights + uncertainty
- updateTasteVector(current, embedding, liked): Bayesian update after swipe
  - Compute gradient of log-likelihood
  - Update mean: w_new = w + lr * gradient
  - Update uncertainty: shrink uncertainty in the direction of the embedding
  - (Laplace approximation to the posterior)
- predictLikeProbability(tasteVector, embedding): sigmoid(w · e)
- predictUncertainty(tasteVector, embedding): e^T Σ e (predictive variance)
```

#### 3b: `thompson-sampling.ts` — Card Selection
```
Core operations:
- selectNextCard(tasteVector, candidateEmbeddings, recentlyShown):
  1. Filter out recently shown cards (last N)
  2. For each candidate:
     a. Sample w_sample ~ N(w_mean, diag(uncertainty))
     b. Compute sampled_score = sigmoid(w_sample · embedding)
  3. Apply diversity constraint: penalize candidates too similar to last shown
  4. Return candidate with highest sampled_score
```

#### 3c: `taste-axes.ts` — Interpretable Profile
```
Core operations:
- computeTasteProfile(tasteVector, axes):
  1. For each axis, compute score = w · axis_direction
  2. Normalize scores to [-1, 1]
  3. Return sorted axes with scores
- generateDescription(profile):
  1. Take top 3-4 strongest axes
  2. Template-based natural language: "You gravitate toward {high_label} over {low_label}"
```

### Step 4: Database Layer

SQLite schema:
```sql
CREATE TABLE designs (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  source TEXT,
  category TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE swipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id TEXT NOT NULL REFERENCES designs(id),
  liked BOOLEAN NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE taste_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  weights BLOB NOT NULL,          -- Float64Array as binary
  uncertainty BLOB NOT NULL,      -- Float64Array as binary
  swipe_count INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### Step 5: API Routes

#### `GET /api/next-card`
1. Load current taste vector from DB (or initialize if first visit)
2. Load embeddings into memory (cached after first load)
3. Get list of already-swiped design IDs
4. Run Thompson Sampling to select next card
5. Return `{ design: { id, imageUrl }, swipeCount, confidence }`

#### `POST /api/swipe`
Body: `{ designId: string, liked: boolean }`
1. Record swipe in `swipes` table
2. Load current taste vector
3. Load embedding for swiped design
4. Run Bayesian update
5. Save updated taste vector
6. Return `{ swipeCount, tasteUpdated: true }`

#### `GET /api/taste-profile`
1. Load current taste vector
2. Load taste axes
3. Compute profile scores
4. Generate natural language description
5. Return `TasteProfile` object

### Step 6: Swipe UI

#### `CardStack.tsx`
- Pre-fetch next 3 cards from `/api/next-card`
- Display top card with swipe gesture (Framer Motion `drag` + `onDragEnd`)
- Swipe right → call `/api/swipe` with liked=true
- Swipe left → call `/api/swipe` with liked=false
- Also support keyboard (← / →) and button taps
- Spring animation for card exit + next card entrance
- Show swipe count badge

#### `SwipeCard.tsx`
- Full-bleed design image
- Subtle gradient overlay at bottom for source attribution
- Drag rotation (tilt card as it's dragged)
- Color tint feedback (green for right-drag, red for left-drag)

#### Taste Profile Page (`/profile`)
- Radar chart or horizontal bar chart of taste axes
- Each axis shows the bipolar label and score
- Natural language description at top
- "Based on N swipes" confidence indicator
- Link back to keep swiping

### Step 7: Polish & Cold-Start UX

- **First-run experience:** Brief intro explaining what the app does, then straight into swiping
- **Early card selection:** For first 10 cards before the model has signal, select maximally diverse designs (spread across embedding space using k-means cluster centroids)
- **Progress indicators:** "5 more swipes to unlock your taste profile" etc.
- **Swipe milestone messages:** After 10, 25, 50 swipes — show evolving profile

---

## Implementation Order

1. **Step 1**: Project scaffolding + types (30 min)
2. **Step 2a**: Gather initial design images — need ~200 minimum to start (separate task, can use placeholder images for dev)
3. **Step 2b-d**: Python preprocessing scripts (embeddings, axes, DB seed)
4. **Step 3a**: Taste model core math
5. **Step 3b**: Thompson Sampling
6. **Step 3c**: Taste axes interpretation
7. **Step 4**: Database layer
8. **Step 5**: API routes (next-card, swipe, taste-profile)
9. **Step 6**: Swipe UI components
10. **Step 7**: Profile page + polish

Steps 3a/3b/3c can be built and unit-tested independently of the UI. Steps 2 and 6 can be developed in parallel.

---

## Design Image Sourcing (for MVP)

For the initial corpus, we can use:
- **Dribbble/Behance** screenshots (manual curation)
- **Mobbin** (app design screenshots)
- **Land-book** / **Godly** (web design screenshots)
- **Savee.it** collections
- Placeholder: use a mix of ~50 hand-picked designs for initial development, expand to 500+ before user testing

---

## What's Explicitly Out of Scope for Phase 1
- Pairwise duels (Phase 2)
- SigLIP 2 upgrade (Phase 2)
- UIClip quality filtering (Phase 2)
- Promptable embeddings (Phase 2)
- Collaborative filtering (Phase 3)
- User accounts / multi-user (Phase 3)
- Cloud deployment (MVP runs locally)
- Mobile-native app (web-first)
