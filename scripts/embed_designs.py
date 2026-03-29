#!/usr/bin/env python3
"""
Compute CLIP ViT-B/32 embeddings for all design images.

Usage:
    python scripts/embed_designs.py

Reads images from public/designs/ and writes embeddings to data/embeddings.json.
Tries OpenAI CLIP (Azure CDN) first, then open_clip, then falls back to
deterministic random embeddings for dev.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DESIGNS_DIR = ROOT / "public" / "designs"
OUTPUT_FILE = ROOT / "data" / "embeddings.json"
DIMENSION = 512

# Try OpenAI's original CLIP package (downloads from Azure CDN, not HuggingFace)
HAS_CLIP = False
CLIP_SOURCE = None
try:
    import torch
    import clip as openai_clip
    HAS_CLIP = True
    CLIP_SOURCE = "openai"
except ImportError:
    pass

# Fall back to open_clip
if not HAS_CLIP:
    try:
        import torch
        import open_clip
        HAS_CLIP = True
        CLIP_SOURCE = "open_clip"
    except ImportError:
        pass

if not HAS_CLIP:
    print("WARNING: No CLIP package found. Generating random embeddings for development.")


def load_clip_model():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if CLIP_SOURCE == "openai":
        model, preprocess = openai_clip.load("ViT-B/32", device=device)
        model.eval()
        return model, preprocess, device
    else:
        # open_clip fallback — use ViT-B-32 which is 512-dim
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="openai"
        )
        model.eval()
        model = model.to(device)
        return model, preprocess, device


def embed_image(model, preprocess, device, image_path: Path) -> np.ndarray:
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        if CLIP_SOURCE == "openai":
            features = model.encode_image(image)
        else:
            features = model.encode_image(image)
        features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def embed_random(image_path: Path) -> np.ndarray:
    """Deterministic pseudo-random embedding from filename — dev only."""
    seed = hash(image_path.name) % (2**32)
    rng = np.random.RandomState(seed)
    vec = rng.randn(DIMENSION).astype(np.float32)
    return vec / np.linalg.norm(vec)


def main():
    image_files = sorted(
        f
        for f in DESIGNS_DIR.iterdir()
        if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )

    if not image_files:
        print(f"No images found in {DESIGNS_DIR}")
        sys.exit(1)

    print(f"Found {len(image_files)} images in {DESIGNS_DIR}")

    if HAS_CLIP:
        try:
            print(f"Loading CLIP ViT-B/32 via {CLIP_SOURCE}...")
            model, preprocess, device = load_clip_model()
            print(f"Using device: {device}")
            embed_fn = lambda p: embed_image(model, preprocess, device, p)
        except Exception as e:
            print(f"WARNING: CLIP failed to load ({e}). Falling back to random embeddings.")
            embed_fn = embed_random
    else:
        embed_fn = embed_random

    embeddings = {}
    for i, img_path in enumerate(image_files):
        design_id = img_path.stem
        vec = embed_fn(img_path)
        embeddings[design_id] = vec.tolist()
        if (i + 1) % 10 == 0 or i == 0:
            print(f"  [{i + 1}/{len(image_files)}] {img_path.name}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    output = {"dimension": DIMENSION, "embeddings": embeddings}
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    print(f"\nWrote {len(embeddings)} embeddings ({DIMENSION}-dim) to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
