#!/usr/bin/env python3
"""Create local contact sheets for manual review of Wikimedia Commons candidates."""

import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "WhatIMadeDemoMedia/1.0 (non-commercial prototype)"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: review-demo-media.py candidates.json output-directory")
    source = json.loads(Path(sys.argv[1]).read_text())
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    cells = []
    for key, candidates in source.items():
        for index, candidate in enumerate(candidates[:3], 1):
            try:
                image = Image.open(io.BytesIO(fetch(candidate["thumbnailUrl"]))).convert("RGB")
                image = ImageOps.fit(image, (280, 180), method=Image.Resampling.LANCZOS)
            except Exception as error:  # review utility: make failures visible in the sheet
                image = Image.new("RGB", (280, 180), "#dbc8b0")
                ImageDraw.Draw(image).text((12, 70), f"Load failed: {error}", fill="black")
            cells.append((key, index, candidate["title"].removeprefix("File:"), image))

    font = ImageFont.load_default(size=15)
    small = ImageFont.load_default(size=12)
    per_sheet = 20
    for page, start in enumerate(range(0, len(cells), per_sheet), 1):
        sheet = Image.new("RGB", (1200, 1100), "#f6f0e7")
        draw = ImageDraw.Draw(sheet)
        for offset, (key, index, title, image) in enumerate(cells[start:start + per_sheet]):
            column = offset % 4
            row = offset // 4
            x = 12 + column * 296
            y = 12 + row * 216
            sheet.paste(image, (x, y))
            draw.text((x, y + 184), f"{key} #{index}", font=font, fill="#2e2017")
            draw.text((x, y + 201), title[:43], font=small, fill="#5d4a3c")
        destination = output / f"commons-candidates-{page}.jpg"
        sheet.save(destination, quality=88, optimize=True)
        print(destination)


if __name__ == "__main__":
    main()
