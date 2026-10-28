#!/usr/bin/env python3
"""Build a compact perceptual-hash index from public catalogue images.

Only public card-set images are fetched. The Supabase publishable key used by
this job is intentionally public; never use a service-role/secret key here.
"""
import json
import math
import os
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from urllib.parse import urlparse

from PIL import Image, ImageOps

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
OUTPUT_PATH = "public/card-visual-index.json"
ALLOWED_IMAGE_HOSTS = {
    "cdn.pokemon-france.com",
    "images-cartes.pokevalue.fr",
    "www.dexocard.com",
    "www.pokepedia.fr",
    "assets.tcgdex.net",
}
PAGE_SIZE = 500
WORKERS = 12
DCT_SIZE = 32
LOW_SIZE = 8
COSINES = [[math.cos((2 * x + 1) * u * math.pi / (2 * DCT_SIZE))
            for x in range(DCT_SIZE)] for u in range(LOW_SIZE)]


def fetch(url, headers=None, allowed_hosts=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=25) as response:
        final_host = urlparse(response.geturl()).hostname
        if allowed_hosts and final_host not in allowed_hosts:
            raise ValueError("Image redirected to an unapproved host")
        return response.read()


def fingerprint(image_url):
    parsed = urlparse(image_url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise ValueError("Image host is not in the public catalogue allowlist")
    data = fetch(image_url, {"User-Agent": "PokeValeur-public-catalog-index/1.0"}, ALLOWED_IMAGE_HOSTS)
    image = Image.open(BytesIO(data))
    image = ImageOps.exif_transpose(image).convert("L").resize(
        (DCT_SIZE, DCT_SIZE), Image.Resampling.LANCZOS
    )
    pixels = image.load()
    coeffs = []
    for v in range(LOW_SIZE):
        for u in range(LOW_SIZE):
            total = 0.0
            for y in range(DCT_SIZE):
                row = sum(pixels[x, y] * COSINES[u][x] for x in range(DCT_SIZE))
                total += row * COSINES[v][y]
            coeffs.append(total)
    median = sorted(coeffs[1:])[len(coeffs[1:]) // 2]
    return "".join("1" if value > median else "0" for value in coeffs)


def catalogue_page(offset):
    params = urllib.parse.urlencode({
        "select": "id,image_url,card_sets!inner(is_public)",
        "card_sets.is_public": "eq.true",
        "image_url": "not.is.null",
        "order": "id.asc",
        "limit": str(PAGE_SIZE),
        "offset": str(offset),
    })
    url = SUPABASE_URL + "/rest/v1/cards?" + params
    headers = {
        "apikey": PUBLISHABLE_KEY,
        "Range-Unit": "items",
        "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
    }
    return json.loads(fetch(url, headers))


def read_catalogue():
    rows = []
    offset = 0
    while True:
        page = catalogue_page(offset)
        if not page:
            break
        rows.extend(page)
        offset += len(page)
        print(f"Cartes publiques lues : {offset}", flush=True)
        if len(page) < PAGE_SIZE:
            break
    return rows


def main():
    rows = read_catalogue()
    records = []
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fingerprint, row["image_url"]): row for row in rows}
        for done, future in enumerate(as_completed(futures), 1):
            row = futures[future]
            try:
                records.append([row["id"], future.result()])
            except Exception as exc:
                failures.append((row["id"], str(exc)))
            if done % 500 == 0:
                print(f"Empreintes calculées : {done}/{len(rows)}", flush=True)

    records.sort(key=lambda item: item[0])
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as output:
        json.dump({"version": 1, "cards": records}, output, separators=(",", ":"))
    print(f"Index créé : {len(records)} cartes; images ignorées : {len(failures)}.", flush=True)
    for card_id, message in failures[:20]:
        print(f"Image ignorée ({card_id}) : {message}", flush=True)
    if not records:
        raise RuntimeError("Aucune empreinte n’a été créée.")


if __name__ == "__main__":
    main()
