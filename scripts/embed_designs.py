#!/usr/bin/env python3
"""
Compute CLIP ViT-L/14 embeddings for all design images.

Usage:
    python scripts/embed_designs.py

Reads images from public/designs/ and writes embeddings to data/embeddings.json.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Try open_clip first, fall back to generating random embeddings for dev
try:
    import torch
    import open_clip

    HAS_CLIP = True
except ImportError:
    HAS_CLIP = False
    print("WARNING: open_clip/torch not installed. Generating random embeddings for development.")

ROOT = Path(__file__).resolve().parent.parent
DESIGNS_DIR = ROOT / "public" / "designs"
OUTPUT_FILE = ROOT / "data" / "embeddings.json"
DIMENSION = 512


def load_clip_model():
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-L-14", pretrained="openai"
    )
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    return model, preprocess, device


def embed_image(model, preprocess, device, image_path: Path) -> np.ndarray:
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model.encode_image(image)
        features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def embed_random(image_path: Path) -> np.ndarray:
    """Generate a deterministic pseudo-random embedding from filename for dev."""
    seed = hash(image_path.name) % (2**32)
    rng = np.random.RandomState(seed)
    vec = rng.randn(DIMENSION).astype(np.float32)
    vec = vec / np.linalg.norm(vec)
    return vec


def main():
    image_files = sorted(
        f
        for f in DESIGNS_DIR.iterdir()
        if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )

    if not image_files:
        print(f"No images found in {DESIGNS_DIR}")
        print("Add design screenshots to public/designs/ and re-run.")
        sys.exit(1)

    print(f"Found {len(image_files)} images in {DESIGNS_DIR}")

    if HAS_CLIP:
        print("Loading CLIP ViT-L/14...")
        model, preprocess, device = load_clip_model()
        print(f"Using device: {device}")
        embed_fn = lambda p: embed_image(model, preprocess, device, p)
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
