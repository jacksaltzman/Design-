#!/usr/bin/env python3
"""
Seed the SQLite database with design metadata.

Usage:
    python scripts/seed_database.py

Reads images from public/designs/ and creates the database at data/designs.db.
"""

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGNS_DIR = ROOT / "public" / "designs"
DB_PATH = ROOT / "data" / "designs.db"
EMBEDDINGS_FILE = ROOT / "data" / "embeddings.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    source TEXT,
    category TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS swipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    design_id TEXT NOT NULL REFERENCES designs(id),
    liked BOOLEAN NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS taste_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weights BLOB NOT NULL,
    uncertainty BLOB NOT NULL,
    swipe_count INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch())
);
"""


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(SCHEMA)

    image_files = sorted(
        f
        for f in DESIGNS_DIR.iterdir()
        if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )

    if not image_files:
        print(f"No images found in {DESIGNS_DIR}")
        print("Add design screenshots to public/designs/ and re-run.")
        return

    # Check which designs already exist
    existing = set(
        row[0] for row in conn.execute("SELECT id FROM designs").fetchall()
    )

    inserted = 0
    for img_path in image_files:
        design_id = img_path.stem
        if design_id not in existing:
            conn.execute(
                "INSERT INTO designs (id, filename) VALUES (?, ?)",
                (design_id, img_path.name),
            )
            inserted += 1

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM designs").fetchone()[0]
    conn.close()

    print(f"Database: {DB_PATH}")
    print(f"  Inserted {inserted} new designs ({total} total)")


if __name__ == "__main__":
    main()
