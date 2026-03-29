#!/usr/bin/env python3
"""
Generate CLIP text embeddings for interpretable taste axes.

Usage:
    python scripts/compute_taste_axes.py

Each axis is defined by two opposing text descriptions. The axis direction
is the normalized difference (high - low) in CLIP text embedding space.
Writes to data/taste_axes.json.
"""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = ROOT / "data" / "taste_axes.json"
DIMENSION = 512

# Try OpenAI CLIP first (Azure CDN), then open_clip, then random fallback
HAS_CLIP = False
CLIP_SOURCE = None
try:
    import torch
    import clip as openai_clip
    HAS_CLIP = True
    CLIP_SOURCE = "openai"
except ImportError:
    pass

if not HAS_CLIP:
    try:
        import torch
        import open_clip
        HAS_CLIP = True
        CLIP_SOURCE = "open_clip"
    except ImportError:
        pass

if not HAS_CLIP:
    print("WARNING: No CLIP package found. Generating random axis vectors.")

# Each axis: (name, low_label, low_prompt, high_label, high_prompt)
TASTE_AXES = [
    (
        "Color Temperature",
        "Cool tones",
        "cool toned design with blue steel grey colors",
        "Warm tones",
        "warm toned design with golden amber earth colors",
    ),
    (
        "Color Saturation",
        "Muted",
        "muted desaturated greyscale design with restrained color",
        "Vibrant",
        "vibrant saturated bold colorful design",
    ),
    (
        "Typography Style",
        "Sans-serif",
        "clean sans-serif geometric modern typography",
        "Serif / Editorial",
        "serif editorial expressive decorative typography",
    ),
    (
        "Type Weight",
        "Light / Thin",
        "light thin delicate lightweight typography",
        "Bold / Heavy",
        "bold heavy impactful strong typography",
    ),
    (
        "Layout Density",
        "Spacious",
        "spacious airy minimal layout with generous whitespace",
        "Dense",
        "dense packed information-rich layout with many elements",
    ),
    (
        "Layout Structure",
        "Systematic",
        "grid-based systematic ordered structured layout",
        "Organic",
        "organic asymmetric freeform creative layout",
    ),
    (
        "Visual Complexity",
        "Minimalist",
        "minimalist simple clean design with few elements",
        "Maximalist",
        "maximalist ornate layered complex detailed design",
    ),
    (
        "Imagery Style",
        "Photographic",
        "photographic realistic imagery and photography",
        "Illustrated",
        "illustrated abstract graphic artwork and illustration",
    ),
    (
        "Dimensionality",
        "Flat",
        "flat 2D design with no depth or shadows",
        "Dimensional",
        "3D skeuomorphic design with depth shadows and layers",
    ),
    (
        "Formality",
        "Playful / Indie",
        "casual playful indie creative fun design",
        "Corporate / Formal",
        "formal corporate professional institutional design",
    ),
    (
        "Energy",
        "Calm",
        "calm serene quiet peaceful gentle design",
        "Dynamic",
        "dynamic energetic bold exciting dramatic design",
    ),
    (
        "Era Feel",
        "Classic",
        "classic timeless traditional established design",
        "Contemporary",
        "contemporary modern trendy cutting-edge current design",
    ),
    (
        "Craft Feel",
        "Digital / Systematic",
        "digital systematic programmatic precise computed design",
        "Handmade / Artisanal",
        "handmade artisanal human crafted organic imperfect design",
    ),
]


def encode_texts(texts: list[str]):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if CLIP_SOURCE == "openai":
        model, _ = openai_clip.load("ViT-B/32", device=device)
        model.eval()
        tokens = openai_clip.tokenize(texts).to(device)
        with torch.no_grad():
            features = model.encode_text(tokens)
            features = features / features.norm(dim=-1, keepdim=True)
    else:
        model, _, _ = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
        tokenizer = open_clip.get_tokenizer("ViT-B-32")
        model.eval()
        model = model.to(device)
        tokens = tokenizer(texts).to(device)
        with torch.no_grad():
            features = model.encode_text(tokens)
            features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()


def random_direction(seed: int) -> np.ndarray:
    rng = np.random.RandomState(seed)
    vec = rng.randn(DIMENSION).astype(np.float32)
    return vec / np.linalg.norm(vec)


def main():
    if HAS_CLIP:
        try:
            print(f"Loading CLIP ViT-B/32 text encoder via {CLIP_SOURCE}...")
            all_texts = []
            for _, _, low_prompt, _, high_prompt in TASTE_AXES:
                all_texts.extend([low_prompt, high_prompt])
            text_embeddings = encode_texts(all_texts)
        except Exception as e:
            print(f"WARNING: CLIP text encoder failed ({e}). Falling back to random axis vectors.")
            text_embeddings = None
    else:
        text_embeddings = None

    axes = []
    for i, (name, low_label, low_prompt, high_label, high_prompt) in enumerate(TASTE_AXES):
        if text_embeddings is not None:
            low_vec = text_embeddings[i * 2]
            high_vec = text_embeddings[i * 2 + 1]
            direction = high_vec - low_vec
            direction = direction / np.linalg.norm(direction)
        else:
            direction = random_direction(seed=i * 7 + 42)

        axes.append(
            {
                "name": name,
                "lowLabel": low_label,
                "highLabel": high_label,
                "direction": direction.tolist(),
            }
        )
        print(f"  {name}: {low_label} <-> {high_label}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump({"axes": axes}, f)

    print(f"\nWrote {len(axes)} taste axes to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
