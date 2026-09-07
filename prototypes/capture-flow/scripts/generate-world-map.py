#!/usr/bin/env python3
"""Generate the bundled Natural Earth map used by the capture prototype."""

import json
import math
import sys
from pathlib import Path


WIDTH = 1000
HEIGHT = 500
PADDING = 14


def project_raw(longitude, latitude):
    lam = math.radians(longitude)
    phi = math.radians(latitude)
    phi2 = phi * phi
    phi4 = phi2 * phi2
    x = lam * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)))
    y = phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)))
    return x, -y


def walk_coordinates(value):
    if value and isinstance(value[0], (int, float)):
        yield value
        return
    for item in value:
        yield from walk_coordinates(item)


def geometry_rings(geometry):
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    if geometry["type"] == "MultiPolygon":
        return [ring for polygon in geometry["coordinates"] for ring in polygon]
    return []


def clean_text(value):
    return value.strip() if isinstance(value, str) and value.strip() and value != "-99" else None


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: generate-world-map.py INPUT.geojson OUTPUT.js")
    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    data = json.loads(source_path.read_text(encoding="utf-8"))

    raw_points = [project_raw(*point[:2]) for feature in data["features"] for point in walk_coordinates(feature["geometry"]["coordinates"])]
    min_x = min(point[0] for point in raw_points)
    max_x = max(point[0] for point in raw_points)
    min_y = min(point[1] for point in raw_points)
    max_y = max(point[1] for point in raw_points)
    scale = min((WIDTH - 2 * PADDING) / (max_x - min_x), (HEIGHT - 2 * PADDING) / (max_y - min_y))
    offset_x = (WIDTH - (max_x - min_x) * scale) / 2 - min_x * scale
    offset_y = (HEIGHT - (max_y - min_y) * scale) / 2 - min_y * scale

    def project(longitude, latitude):
        x, y = project_raw(longitude, latitude)
        return x * scale + offset_x, y * scale + offset_y

    countries = []
    alias_fields = ("NAME", "NAME_EN", "NAME_LONG", "NAME_SORT", "ADMIN", "SOVEREIGNT", "GEOUNIT", "SUBUNIT", "FORMAL_EN", "ABBREV", "POSTAL", "ISO_A2", "ISO_A2_EH", "ISO_A3", "ISO_A3_EH", "ADM0_A3")
    for feature in data["features"]:
        properties = feature["properties"]
        name = clean_text(properties.get("NAME_EN")) or clean_text(properties.get("NAME")) or clean_text(properties.get("ADMIN"))
        key = clean_text(properties.get("ADM0_A3")) or clean_text(properties.get("ISO_A3")) or str(properties.get("NE_ID"))
        path_parts = []
        for ring in geometry_rings(feature["geometry"]):
            if len(ring) < 3:
                continue
            projected = [project(*point[:2]) for point in ring]
            path_parts.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in projected) + "Z")
        label_x = properties.get("LABEL_X")
        label_y = properties.get("LABEL_Y")
        if not isinstance(label_x, (int, float)) or not isinstance(label_y, (int, float)):
            coordinates = list(walk_coordinates(feature["geometry"]["coordinates"]))
            label_x = sum(point[0] for point in coordinates) / len(coordinates)
            label_y = sum(point[1] for point in coordinates) / len(coordinates)
        point_x, point_y = project(label_x, label_y)
        aliases = sorted({value for field in alias_fields if (value := clean_text(properties.get(field)))})
        countries.append({
            "key": key,
            "name": name,
            "aliases": aliases,
            "path": "".join(path_parts),
            "point": [round(point_x / WIDTH * 100, 3), round(point_y / HEIGHT * 100, 3)],
        })

    countries.sort(key=lambda country: (country["name"], country["key"]))
    compact = json.dumps(countries, ensure_ascii=False, separators=(",", ":"))
    output = f'''// Generated from Natural Earth ne_110m_admin_0_countries. Do not edit by hand.
(function (root, factory) {{
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeWorldMap = api;
}})(typeof globalThis !== "undefined" ? globalThis : this, function () {{
  "use strict";
  const countries = Object.freeze({compact});
  function normalize(value) {{
    return String(value || "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("en").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  }}
  const byAlias = new Map();
  countries.forEach((country) => country.aliases.forEach((alias) => {{
    const normalized = normalize(alias);
    if (normalized && !byAlias.has(normalized)) byAlias.set(normalized, country);
  }}));
  countries.forEach((country) => [country.name, country.key].forEach((alias) => byAlias.set(normalize(alias), country)));
  const manualAliases = {{
    "america": "USA", "britain": "GBR", "great britain": "GBR", "south korea": "KOR", "north korea": "PRK",
    "russia": "RUS", "turkey": "TUR", "united states": "USA", "united states of america": "USA", "uk": "GBR", "u s a": "USA", "usa": "USA",
    "vietnam": "VNM", "czech republic": "CZE", "ivory coast": "CIV", "laos": "LAO", "moldova": "MDA", "syria": "SYR"
  }};
  Object.entries(manualAliases).forEach(([alias, key]) => {{
    const country = countries.find((candidate) => candidate.key === key);
    if (country) byAlias.set(alias, country);
  }});
  function findCountry(value) {{ return byAlias.get(normalize(value)) || null; }}
  return {{ countries, findCountry, width: {WIDTH}, height: {HEIGHT}, mapDataVersion: 1, source: "Natural Earth 1:110m Admin 0 Countries" }};
}});
'''
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
