#!/usr/bin/env python3
"""Build perceptual hashes for public card images and upsert them into Supabase.

Requires Pillow (python -m pip install Pillow) and SUPABASE_URL /
SUPABASE_SERVICE_ROLE_KEY in the environment. This is a one-off catalogue job;
rerun it after importing or changing card images.
"""
import json
import math
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

from PIL import Image, ImageOps

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
}
BATCH_SIZE = 100
DCT_SIZE = 32
LOW_SIZE = 8
COSINES = [[math.cos((2 * x + 1) * u * math.pi / (2 * DCT_SIZE))
            for x in range(DCT_SIZE)] for u in range(LOW_SIZE)]


def request(url, headers=HEADERS, data=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read()


def fingerprint(image_url):
    req = urllib.request.Request(image_url, headers={"User-Agent": "PokeValeur-card-index/1.0"})
    with urllib.request.urlopen(req, timeout=20) as response:
        image = Image.open(BytesIO(response.read()))
        image = ImageOps.exif_transpose(image).convert("L").resize((DCT_SIZE, DCT_SIZE), Image.Resampling.LANCZOS)
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


def main():
    cards_url = SUPABASE_URL + "/rest/v1/cards?select=id,image_url,card_sets!inner(is_public)"
    cards_url += "&card_sets.is_public=eq.true&image_url=not.is.null&order=id.asc"
    rows = []
    start = 0
    while True:
        page_url = cards_url + "&limit=500&offset=" + str(start)
        page = json.loads(request(page_url, {**HEADERS, "Range-Unit": "items", "Range": f"{start}-{start + 499}"}))
        if not page:
            break
        rows.extend(page)
        start += len(page)
        print(f"Catalogue lu : {start} cartes", flush=True)
        if len(page) < 500:
            break

    records = []
    errors = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(fingerprint, card["image_url"]): card for card in rows}
        for index, future in enumerate(as_completed(futures), 1):
            card = futures[future]
            try:
                records.append({"card_id": card["id"], "fingerprint": future.result()})
            except Exception as exc:
                errors += 1
                print(f"Image ignorée ({card['id']}): {exc}", flush=True)
            if len(records) >= BATCH_SIZE:
                upload(records)
                records.clear()
            if index % 100 == 0:
                print(f"Empreintes calculées : {index}/{len(rows)}", flush=True)
    if records:
        upload(records)
    print(f"Terminé : {len(rows) - errors} empreintes, {errors} images ignorées.")


def upload(records):
    url = SUPABASE_URL + "/rest/v1/card_image_fingerprints?on_conflict=card_id"
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    request(url, headers, json.dumps(records).encode("utf-8"), "POST")


if __name__ == "__main__":
    main()
