# Local Setup Instructions

## Context

This is a "Tinder for Design" app — a swipe-based interface that learns the user's digital design taste using Bayesian logistic regression + Thompson Sampling. The codebase is fully built and deployed to Vercel, but needs **real design images** captured from curated websites.

The app is a Next.js 14 project. All code is on GitHub at `jacksaltzman/design-` on the `main` branch.

## What's Done

- Full Next.js app with swipe UI, taste model, Thompson Sampling card selection
- 108 curated website URLs in `scripts/urls.json` (discovery-focused sites, no well-known brands)
- Playwright screenshot capture script (`scripts/capture_screenshots.js`)
- Microlink alternative capture script (`scripts/capture_microlink.js`)
- CLIP embedding pipeline (`scripts/embed_designs.py`)
- Taste axes computation (`scripts/compute_taste_axes.py`)
- Onboarding grid, pairwise duels, taste interstitials, generative probes
- localStorage persistence for taste state
- Deployed to Vercel (design-six.vercel.app)

## What Needs To Be Done (In Order)

### Step 1: Sync the Local Repo

The local repo at `/Users/jacksaltzman/Desktop/Design` is behind the remote. Pull the latest:

```bash
cd /Users/jacksaltzman/Desktop/Design
git fetch origin
git checkout main
git reset --hard origin/main
```

If the directory doesn't exist or is broken, clone fresh:

```bash
cd /Users/jacksaltzman/Desktop
git clone https://github.com/jacksaltzman/design-.git Design
cd Design
```

Then install dependencies:

```bash
npm install
```

### Step 2: Install Playwright Chromium

```bash
npx playwright install chromium
```

This downloads a ~162 MB Chromium binary. It may already be downloading or installed — if so, this will be instant.

### Step 3: Capture Screenshots

```bash
node scripts/capture_screenshots.js
```

This will:
- Read 108 URLs from `scripts/urls.json`
- Launch headless Chromium
- Navigate to each URL, wait for DOM + visual stability
- Dismiss cookie banners automatically
- Capture above-the-fold at 1440×900, 2x retina, WebP format
- Save to `public/designs/` (e.g., `public/designs/pfrm.co.webp`)
- Write metadata to `data/design_metadata.json`
- Rate-limit: 2 seconds between requests

**Expected time:** ~6-8 minutes for all 108 URLs.

**If Playwright fails** (e.g., Chromium won't install), use the Microlink alternative:

```bash
node scripts/capture_microlink.js
```

This uses a free API (no browser install) but is slightly lower quality (PNG, no cookie dismissal).

After capture, review `public/designs/` and delete any screenshots that are:
- Blank/white (site blocked headless Chrome)
- Cookie banner covering the whole page
- Error pages or CAPTCHAs
- Low quality or broken layouts

### Step 4: Generate Embeddings

The app uses CLIP embeddings to understand visual similarity between designs. There are two paths:

**Option A: Real CLIP embeddings (recommended if you have Python + ~2GB disk for torch)**

```bash
pip install torch open_clip_torch Pillow
python scripts/embed_designs.py
```

This computes 512-dimensional CLIP ViT-L/14 embeddings for each screenshot. Takes ~2-5 minutes depending on GPU/CPU.

**Option B: Fallback random embeddings (works without torch)**

```bash
python scripts/embed_designs.py
```

The script automatically falls back to deterministic random embeddings if torch isn't installed. The app will function but taste learning won't be based on real visual features.

Output: `data/embeddings.json`

### Step 5: Compute Taste Axes

```bash
python scripts/compute_taste_axes.py
```

This computes 13 interpretable taste axes (e.g., "Cool tones ↔ Warm tones", "Sans-serif ↔ Serif") as directions in the embedding space.

**Same fallback:** works with or without torch installed.

Output: `data/taste_axes.json`

### Step 6: Commit and Push Everything

```bash
cd /Users/jacksaltzman/Desktop/Design

# Add the captured images and generated data
git add public/designs/
git add data/design_metadata.json
git add data/embeddings.json
git add data/taste_axes.json

# Check what's being committed (should be images + JSON data files)
git status

# Commit
git commit -m "Add captured design screenshots and computed embeddings"

# Push to main (this triggers Vercel deploy)
git push origin main
```

**Important:** The `public/designs/` folder will contain ~100+ image files totaling ~50-150 MB. This is fine for Git but the push may take a minute.

### Step 7: Verify

After pushing, Vercel will auto-deploy. Visit the deployed URL and verify:
- Onboarding grid shows real design screenshots (not colored gradients)
- Swiping shows different real websites
- The taste profile updates as you swipe

## File Structure Reference

```
Design/
├── scripts/
│   ├── urls.json                  # 108 curated URLs
│   ├── capture_screenshots.js     # Playwright capture (primary)
│   ├── capture_microlink.js       # Microlink capture (fallback)
│   ├── embed_designs.py           # CLIP embedding computation
│   └── compute_taste_axes.py      # Taste axis computation
├── public/
│   └── designs/                   # Screenshot images go here
├── data/
│   ├── design_metadata.json       # Metadata for captured screenshots
│   ├── embeddings.json            # CLIP embeddings (512-dim per design)
│   └── taste_axes.json            # 13 taste axis directions
└── src/                           # Next.js app source
```

## Troubleshooting

- **`npx playwright install` hangs:** Check internet connection. The Chromium binary is ~162 MB.
- **Sites show CAPTCHAs:** Some sites detect headless Chrome. Delete those screenshots and move on — 80-90% success rate is normal.
- **`torch` won't install:** Use `pip install torch --index-url https://download.pytorch.org/whl/cpu` for CPU-only (smaller download). Or just skip — the fallback random embeddings work for testing.
- **Git push is slow:** The images are large. Use `git push` and wait. If it times out, try `git push` again — Git will resume.
- **`cd /Users/jacksaltzman/Desktop/Design` fails:** The directory might be named differently. Try `ls ~/Desktop/ | grep -i design` to find it.
