#!/usr/bin/env python3
"""
Generate placeholder design images for development.
Creates simple colored gradient rectangles with varying styles.

Usage:
    python scripts/generate_placeholders.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DESIGNS_DIR = ROOT / "public" / "designs"

# 30 placeholder "designs" with different color schemes and labels
PLACEHOLDERS = [
    ("001", (20, 20, 30), (60, 80, 120), "Minimal Dark"),
    ("002", (255, 250, 245), (200, 180, 160), "Warm Light"),
    ("003", (10, 10, 10), (255, 50, 50), "Bold Red"),
    ("004", (240, 245, 255), (100, 130, 200), "Corporate Blue"),
    ("005", (30, 30, 40), (180, 100, 255), "Electric Purple"),
    ("006", (250, 248, 240), (50, 50, 50), "Swiss Minimal"),
    ("007", (255, 100, 50), (255, 200, 0), "Gradient Sunset"),
    ("008", (20, 40, 30), (40, 200, 120), "Nature Green"),
    ("009", (40, 40, 40), (255, 255, 255), "High Contrast"),
    ("010", (245, 235, 225), (180, 140, 100), "Earthy Neutral"),
    ("011", (15, 15, 25), (50, 180, 220), "Cyber Teal"),
    ("012", (255, 245, 250), (220, 80, 120), "Soft Pink"),
    ("013", (25, 25, 25), (200, 200, 200), "Monochrome"),
    ("014", (240, 230, 210), (180, 60, 30), "Terracotta"),
    ("015", (30, 20, 50), (140, 80, 200), "Deep Violet"),
    ("016", (250, 252, 255), (60, 120, 180), "Clean Blue"),
    ("017", (20, 30, 20), (160, 200, 80), "Acid Green"),
    ("018", (50, 40, 35), (220, 180, 140), "Coffee"),
    ("019", (10, 10, 30), (100, 200, 255), "Neon Sky"),
    ("020", (255, 255, 255), (200, 200, 200), "Paper White"),
    ("021", (30, 25, 20), (255, 180, 50), "Gold Accent"),
    ("022", (240, 240, 245), (80, 80, 100), "Slate"),
    ("023", (20, 10, 10), (200, 50, 80), "Dark Cherry"),
    ("024", (230, 250, 240), (40, 180, 130), "Mint Fresh"),
    ("025", (45, 45, 50), (255, 120, 80), "Coral Pop"),
    ("026", (250, 245, 235), (150, 120, 90), "Parchment"),
    ("027", (15, 20, 35), (80, 140, 240), "Ocean Deep"),
    ("028", (255, 250, 240), (255, 150, 100), "Peach"),
    ("029", (30, 30, 35), (140, 140, 150), "Gunmetal"),
    ("030", (245, 240, 250), (170, 100, 200), "Lavender"),
]

WIDTH, HEIGHT = 800, 600


def create_placeholder(design_id: str, bg: tuple, accent: tuple, label: str):
    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    # Background gradient effect (simple horizontal bands)
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(bg[0] * (1 - t * 0.3) + accent[0] * t * 0.3)
        g = int(bg[1] * (1 - t * 0.3) + accent[1] * t * 0.3)
        b = int(bg[2] * (1 - t * 0.3) + accent[2] * t * 0.3)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # Accent blocks
    draw.rectangle([60, 80, 350, 120], fill=accent)
    draw.rectangle([60, 140, 250, 155], fill=accent + (180,) if len(accent) == 3 else accent)
    draw.rectangle([60, 170, 300, 185], fill=accent)

    # Placeholder content blocks
    block_color = tuple(min(255, c + 30) for c in bg)
    draw.rectangle([60, 220, 370, 420], fill=block_color, outline=accent, width=1)
    draw.rectangle([400, 220, 740, 310], fill=block_color, outline=accent, width=1)
    draw.rectangle([400, 330, 740, 420], fill=block_color, outline=accent, width=1)

    # Label
    draw.text((60, HEIGHT - 60), f"{design_id} — {label}", fill=accent)

    output_path = DESIGNS_DIR / f"{design_id}.png"
    img.save(output_path)


def main():
    DESIGNS_DIR.mkdir(parents=True, exist_ok=True)

    for design_id, bg, accent, label in PLACEHOLDERS:
        create_placeholder(design_id, bg, accent, label)
        print(f"  Created {design_id}.png — {label}")

    print(f"\nGenerated {len(PLACEHOLDERS)} placeholder designs in {DESIGNS_DIR}")


if __name__ == "__main__":
    main()
