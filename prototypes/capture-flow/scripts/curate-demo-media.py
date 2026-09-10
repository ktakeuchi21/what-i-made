#!/usr/bin/env python3
"""Fetch the approved Commons photographs, strip metadata, and build demo variants."""

import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps


SELECTIONS = {
    "noodles": "File:Mul naengmyeon by Kuruman in Seoul.jpg",
    "adobo": "File:Chicken Adobo with Potatoes.jpg",
    "jollof": "File:Jollof rice with boiled egg and fried chicken.jpg",
    "shakshuka": "File:Shakshuka by Calliopejen1.jpg",
    "dumplings": "File:Gyoza dumplings (53726549642).jpg",
    "chana": "File:Chana masala gravy.JPG",
    "tacos": "File:Fish tacos from Pezcow - April 2023 - Sarah Stierch.jpg",
    "pasta": "File:Tagliatelle all'amatriciana a un restaurant de Xàbia.jpg",
    "poutine": "File:Poutine from Windsor, ON.jpg",
    "shepherds-pie": "File:Shepherds pie - The Kew Greenhouse Cafe 2025-05-14.jpg",
    "moqueca": "File:Moqueca vegana, farofa de cebola, e arroz.jpg",
    "pavlova": "File:Pavlova dessert.JPG",
    "lamington": "File:Lamingtons and a cup of tea.jpg",
    "jerk-chicken": "File:Jamaican Jerk Chicken - Hyatt Hyderabad Gachibowli - Hyderabad 2023-04-29 8516.jpg",
    "plov": "File:'PLOV' at National Food restaurant..jpg",
    "gumbo": "File:Chicken and Sausage Gumbo- Cooking with stock, meat, and spices.jpg",
    "arepas": "File:Arepa de chocolo.jpg",
    "ratatouille": "File:Ratatouille, Mazatlán, 21 de junio de 2023.jpg",
    "spanakopita": "File:Spanakopita (15878501828).jpg",
    "pierogi": "File:Polish pierogi in a dish.jpg",
    "tagine": "File:Moroccan food-Chicken tagine with preserved lemons and olives-01.jpg",
    "mujadara": "File:Baba ghannouj, mujadara, hoummos, and tabbouleh - Cambridge, MA.jpg",
    "egusi": "File:Egusi Soup. Egusi is the indegenious soup of Nigerians. This soup is named after the thickener -Egusi;Egusi is gotten from Fluted Pumpkin or Melon seeds..jpg",
    "dosa": "File:Masala dosa 01.jpg",
    "oyakodon": "File:Nakau Oyakodon (TYPE-00 ver.) set.jpg",
    "curry-rice": "File:Japanese curry rice.jpg",
    "khao-soi": "File:OK Chicken and Khao Soi, Portland, Oregon - 9.jpg",
    "pad-kra-pao": "File:Kao Rad Pad Kra-pao with chicken and fried egg - Unithai 2025-07-30.jpg",
    "pantry-soup": "File:Simple vegetable soup 2009.jpg",
}

ALLOWED_LICENSES = re.compile(r"^(?:CC0|CC BY(?:-SA)? [234]\.0|Public domain)$", re.I)
USER_AGENT = "WhatIMadeDemoMedia/1.0 (https://main.dk27yiqjy46kx.amplifyapp.com; non-commercial prototype)"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def plain(value=""):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(value)))).strip()


def commons_metadata():
    query = urllib.parse.urlencode({
        "action": "query",
        "titles": "|".join(SELECTIONS.values()),
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": "1600",
        "format": "json",
        "origin": "*",
    })
    payload = json.loads(fetch(f"https://commons.wikimedia.org/w/api.php?{query}"))
    return {page["title"]: page for page in payload.get("query", {}).get("pages", {}).values()}


def normalized_https(value):
    if value.startswith("//"):
        value = f"https:{value}"
    if value.startswith("http://"):
        value = f"https://{value.removeprefix('http://')}"
    return value


def optimized_webp(source, size, byte_limit, initial_quality):
    rendered = ImageOps.fit(source, size, method=Image.Resampling.LANCZOS)
    clean = Image.new("RGB", rendered.size)
    clean.paste(rendered.convert("RGB"))
    for quality in range(initial_quality, 51, -4):
        output = io.BytesIO()
        clean.save(output, format="WEBP", quality=quality, method=6, exact=True)
        if output.tell() <= byte_limit:
            return output.getvalue()
    raise ValueError(f"Could not fit image inside {byte_limit} bytes")


def write_atomic(path, value):
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_bytes(value)
    os.replace(temporary, path)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: curate-demo-media.py path/to/assets/demo")
    demo_dir = Path(sys.argv[1]).resolve()
    manifest_path = demo_dir / "demo-content.json"
    manifest = json.loads(manifest_path.read_text())
    pages = commons_metadata()
    curated = {}

    for key, title in SELECTIONS.items():
        page = pages.get(title)
        if not page:
            raise ValueError(f"Commons did not return {title}")
        info = page.get("imageinfo", [{}])[0]
        metadata = info.get("extmetadata", {})
        license_name = plain(metadata.get("LicenseShortName", {}).get("value"))
        if not ALLOWED_LICENSES.fullmatch(license_name):
            raise ValueError(f"Unsupported license for {title}: {license_name}")
        creator = plain(metadata.get("Artist", {}).get("value"))
        if not creator:
            raise ValueError(f"Creator is missing for {title}")
        source_page = normalized_https(info.get("descriptionurl", ""))
        image_url = normalized_https(info.get("thumburl") or info.get("url", ""))
        if urllib.parse.urlparse(source_page).hostname != "commons.wikimedia.org":
            raise ValueError(f"Unexpected source page for {title}")
        if urllib.parse.urlparse(image_url).hostname not in {"upload.wikimedia.org", "thumb.wikimedia.org"}:
            raise ValueError(f"Unexpected image host for {title}")
        license_url = normalized_https(metadata.get("LicenseUrl", {}).get("value", ""))
        if not license_url and license_name == "Public domain":
            license_url = "https://creativecommons.org/publicdomain/mark/1.0/"
        if urllib.parse.urlparse(license_url).scheme != "https":
            raise ValueError(f"License URL is missing for {title}")

        photograph = Image.open(io.BytesIO(fetch(image_url)))
        display = optimized_webp(photograph, (1200, 900), 250 * 1024, 86)
        thumbnail = optimized_webp(photograph, (320, 240), 50 * 1024, 82)
        write_atomic(demo_dir / "display" / f"{key}.webp", display)
        write_atomic(demo_dir / "thumb" / f"{key}.webp", thumbnail)
        curated[key] = {
            "thumbnail": f"./assets/demo/thumb/{key}.webp",
            "display": f"./assets/demo/display/{key}.webp",
            "sourceType": "licensed-photograph",
            "sourceTitle": title.removeprefix("File:"),
            "sourcePage": source_page,
            "creator": creator,
            "license": license_name,
            "licenseUrl": license_url,
            "modifications": "Cropped, resized, and converted to WebP; metadata removed.",
        }
        print(f"{key}: {creator} · {license_name} · {len(thumbnail) + len(display):,} bytes")

    manifest["schemaVersion"] = 2
    manifest["media"] = curated
    for dish in manifest["dishes"]:
        if dish["key"] in {"jerk-chicken", "plov", "pavlova", "lamington"}:
            dish["media"] = dish["key"]
    for idea in manifest["ideas"]:
        if idea["id"] == "demo-idea-007":
            idea["media"] = "jollof"
    rendered_manifest = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    temporary_manifest = manifest_path.with_suffix(".json.tmp")
    temporary_manifest.write_text(rendered_manifest)
    os.replace(temporary_manifest, manifest_path)


if __name__ == "__main__":
    main()
