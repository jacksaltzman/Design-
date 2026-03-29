# Implementation Plan: Design Corpus

## The Problem

The corpus is the most consequential decision in this project. The algorithm can only learn distinctions that exist in the data. If every design is a clean SaaS landing page, the model learns nothing about your taste — just that you like or dislike SaaS pages. The corpus needs to span the full space of digital design so that your swipes carve out a meaningful, specific region.

## Design Philosophy

**The corpus should feel like walking through a great design museum — not a mood board.**

A mood board is homogeneous by design. A museum shows you Dieter Rams next to David Carson next to a Japanese train ticket machine. The contrast is what makes your reactions legible. When you dislike something, that's as informative as when you like it — but only if the thing you disliked is genuinely different from what you liked.

This means we need:
- **Breadth over depth** — 50 design styles represented, not 500 examples of one style
- **Quality floor** — everything should be well-executed within its style (you're learning taste, not quality detection)
- **Real diversity** — not just Western/Silicon Valley design. Japanese, Swiss, Dutch, Latin American, Korean design traditions all look and feel different
- **Mixed formats** — websites, mobile apps, posters, editorial layouts, dashboards, brand identities
- **Intentional provocation** — include designs that are polarizing, not just "safe." Brutalist sites, maximalist editorial, experimental typography. These generate the strongest signals.

---

## Source Strategy

### Primary: Playwright screenshots of curated URLs (websites)

**Why this wins over Dribbble/API scraping:**
- Real websites at real viewport sizes — not cropped mockups or idealized presentations
- We control screenshot quality, viewport, and capture settings
- No API rate limits, no OAuth, no terms-of-service gray areas
- Repeatable pipeline — add URLs anytime, re-run script
- Screenshots look like what users actually encounter

**The pipeline:**
1. Maintain a `scripts/urls.json` — a curated list of URLs tagged by style category
2. Playwright visits each URL at desktop (1440×900) and mobile (390×844) viewports
3. Waits for load + scroll to trigger lazy images
4. Captures a viewport-sized screenshot (not full-page — we want the "above the fold" impression, which is how taste works)
5. Saves as high-quality WebP to `public/designs/`
6. Generates metadata JSON for each image

**Why above-the-fold, not full-page:**
Taste is formed in the first 2-3 seconds of looking at a design. A full-page screenshot of a 10,000px page dilutes the impression with footer content and repetitive sections. We want the hero — the first impression.

### Secondary: Manually curated screenshots (mobile apps, posters, editorial)

Not everything is a live website. Some of the most distinctive design happens in:
- Mobile app UIs (from Mobbin, App Store screenshots)
- Print/editorial layouts (scanned or photographed)
- Poster design and brand identities
- Dashboard and data visualization design

These get added manually as high-quality images to the corpus, tagged appropriately.

### What we're NOT doing:
- **Dribbble API** — shots are self-promotional mockups, not real shipped design. They skew toward a narrow "Dribbble aesthetic" that doesn't represent the real design landscape.
- **Stock photo APIs** (Unsplash/Pexels) — these are photographs, not design screenshots.
- **Rico dataset** — 66k Android screens, but they're old (2017), low resolution, and heavily skewed toward stock Android UI patterns. Not useful for taste.
- **Automated scraping of galleries** — copyright risk, quality control problems.

---

## Style Taxonomy

The corpus should cover these categories with roughly equal representation. Each category gets 30-50 URLs/images, giving us 500-800 total.

### By Design Movement / Aesthetic

| Category | Description | Sources |
|----------|-------------|---------|
| **Swiss/International** | Grid-based, clean, Helvetica, structured | awwwards.com winners, design agency sites |
| **Minimalist** | Extreme reduction, whitespace, restraint | Apple.com, Aesop, Muji, Everlane |
| **Brutalist** | Raw, anti-design, exposed structure | brutalistwebsites.com, experimental sites |
| **Editorial/Magazine** | Strong type hierarchy, columns, serif headers | NYT, Bloomberg, Monocle, Eye Magazine |
| **Maximalist** | Dense, layered, colorful, overwhelming (intentionally) | Fashion brands, festival sites, art collectives |
| **Corporate/Enterprise** | Professional, trustworthy, structured | Salesforce, IBM, McKinsey, bank sites |
| **Indie/Craft** | Handmade feel, personal, warm, imperfect | Small studio sites, personal portfolios |
| **Japanese** | Unique density, character layouts, distinctive color | Japanese e-commerce, restaurant sites, municipal sites |
| **Y2K/Retro** | Nostalgic, glossy, 2000s revival | Retro-styled modern sites, archive.org gems |
| **3D/Immersive** | WebGL, three.js, spatial, cinematic | Award-winning immersive experiences |
| **Dark Mode** | Dark backgrounds, neon accents, moody | Developer tools, music platforms, gaming |
| **Dashboard/Data** | Information-dense, charts, metrics | Analytics tools, admin panels, BI tools |
| **Mobile App UI** | Native app screens, iOS/Android patterns | Captured from Mobbin-style references |
| **Typographic** | Type as the primary design element | Type foundry sites, typographic experiments |
| **Illustration-Heavy** | Custom illustration as primary visual | Mailchimp, Slack, Notion-style sites |
| **Photography-Led** | Full-bleed photography, minimal chrome | Fashion, travel, architecture portfolio sites |

### By Cultural/Geographic Origin

Intentionally include design from:
- **Switzerland/Germany** — systematic, grid, precision
- **Japan** — unique density and aesthetic sensibility
- **Netherlands** — experimental, conceptual
- **South Korea** — distinctive web aesthetic, high visual density
- **Scandinavia** — restrained, functional, light
- **Latin America** — color-forward, expressive
- **UK** — editorial tradition, wit

### By Format

- **Marketing/Landing pages** (~30%) — hero sections, CTAs, product showcases
- **Editorial/Content** (~20%) — articles, blogs, magazines
- **Product/App UI** (~20%) — SaaS dashboards, app screens, tools
- **Portfolio/Agency** (~15%) — creative studio and individual portfolios
- **E-commerce** (~10%) — product pages, shop layouts
- **Experimental/Art** (~5%) — non-commercial, boundary-pushing

---

## Technical Pipeline

### Step 1: Build the URL list (`scripts/urls.json`)

```json
[
  {
    "url": "https://apple.com",
    "category": "minimalist",
    "region": "us",
    "format": "marketing",
    "tags": ["tech", "product", "clean"]
  },
  ...
]
```

This is the most important step. It requires taste and judgment — not automation.

Plan: Start with 100 hand-picked URLs across all categories, expand to 500+.

**Sources for finding URLs:**
- [Godly.website](https://godly.website/) — hand-picked cutting-edge web design
- [Awwwards](https://www.awwwards.com/) — award winners, filterable by style
- [Brutalist Websites](https://brutalistwebsites.com/) — brutalist category
- [Typewolf](https://www.typewolf.com/) — typography-focused sites
- [Minimal Gallery](https://minimal.gallery/) — minimalist sites
- [One Page Love](https://onepagelove.com/) — single-page designs
- [Land-book](https://land-book.com/) — landing page designs
- [SaaS Landing Page](https://saaslandingpage.com/) — SaaS-specific
- [Dark Mode Design](https://www.darkmodedesign.com/) — dark UI collection
- [Japanese Web Design Gallery](https://bm.straightline.jp/) — Japanese design

### Step 2: Playwright screenshot script (`scripts/capture_screenshots.py`)

```
For each URL in urls.json:
  1. Launch Playwright Chromium (headless)
  2. Set viewport to 1440×900
  3. Navigate to URL
  4. Wait for network idle + 2s extra for animations
  5. Dismiss cookie banners (click common selectors)
  6. Capture viewport screenshot as WebP (quality 90)
  7. Save to public/designs/{id}.webp
  8. Log success/failure
  9. Rate limit: 2s between requests (be polite)
```

Also capture at mobile viewport (390×844) as a separate set — creates natural variety and tests responsive design taste.

### Step 3: Quality review (manual)

After automated capture:
- Delete screenshots that failed (blank pages, CAPTCHAs, error states)
- Delete screenshots that are too similar to others (3 sites from same template)
- Flag screenshots that are low quality or unrepresentative
- Goal: ~500 high-quality, diverse screenshots

### Step 4: Re-run embedding pipeline

```bash
python scripts/embed_designs.py      # CLIP embeddings for all new images
python scripts/compute_taste_axes.py # taste axes (only needed once)
```

### Step 5: Verify diversity in embedding space

Run a quick analysis:
- PCA/t-SNE visualization of all embeddings — should show spread, not clusters
- Check that each style category occupies a distinct region
- If some category dominates, add more from underrepresented categories

---

## Implementation Order

1. **Build `scripts/urls.json`** with initial 100 URLs across all categories
2. **Build `scripts/capture_screenshots.py`** — Playwright pipeline
3. **Run captures** and manually review
4. **Update the image format** — switch from PNG to WebP, update the code to handle both
5. **Re-run embeddings** (with real CLIP if possible, random for dev)
6. **Expand to 500+** URLs with a second curation pass
7. **Verify embedding diversity** with visualization script

---

## URL Starter List (First 100)

### Minimalist (15)
- apple.com
- aesop.com
- everlane.com
- muji.com/us
- stripe.com
- linear.app
- rapha.cc
- acnestudios.com
- cos.com
- dieter-rams.com
- braun-audio.com
- teenage.engineering
- nothing.tech
- cowboy.com
- pfrm.co

### Editorial / Typographic (15)
- bloomberg.com/businessweek
- eyeondesign.aiga.org
- monocle.com
- nytimes.com
- ft.com
- theparisreview.org
- kinfolk.com
- cereal-magazine.com
- typewolf.com/site-of-the-day
- klim.co.nz
- commercialtype.com
- fonts.ilovetypography.com
- the-brandidentity.com
- thecreativeindependent.com
- nautil.us

### Brutalist / Experimental (10)
- brutalistwebsites.com
- hfrancis.studio
- ericandraos.com
- cargo.site
- sont.space
- crazyones.co
- sf1.tech
- anthonyhobday.com
- berkeleygraphics.com
- securite-gun.fr

### Corporate / Enterprise (10)
- ibm.com/design
- salesforce.com
- mckinsey.com
- deloitte.com
- blackrock.com
- palantir.com
- snowflake.com
- databricks.com
- stripe.com/atlas
- square.com

### 3D / Immersive (10)
- midwam.com
- lusion.co
- active-theory.com
- immersive-g.com
- bruno-simon.com
- richardmattka.com
- monopo.vn
- resn.co.nz
- unseen.co
- hello-monday.com

### Dark Mode / Developer (10)
- vercel.com
- github.com
- figma.com
- raycast.com
- warp.dev
- arc.net
- supabase.com
- planetscale.com
- railway.app
- fly.io

### Japanese (8)
- muji.com/jp
- uniqlo.com/jp
- toyota.jp
- nhk.or.jp
- isseymiyake.com
- teamlab.art
- kakaku.com
- zozo.com

### Indie / Craft (7)
- studio-freight.com
- basement.studio
- designbyhumans.com
- madebyshape.co.uk
- fiftythree.com
- readymag.com
- papersmiths.co.uk

### Illustration-Heavy (5)
- mailchimp.com
- notion.so
- duolingo.com
- headspace.com
- pitch.com

### Maximalist / Fashion (5)
- balenciaga.com
- gucci.com
- yfrfrancis.com
- kfrith.com
- ssense.com

### Dashboard / Data (5)
- observablehq.com
- grafana.com/demos
- metabase.com
- posthog.com
- amplitude.com
