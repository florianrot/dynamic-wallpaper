"""Scan a folder for wallpaper images (any name, .png/.jpg/.jpeg)."""

import os

_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def scan_folder(folder: str) -> list[dict]:
    if not folder or not os.path.isdir(folder):
        return []

    results = []
    for name in os.listdir(folder):
        ext = os.path.splitext(name)[1].lower()
        if ext not in _EXTENSIONS:
            continue
        full = os.path.join(folder, name)
        if not os.path.isfile(full):
            continue
        results.append({
            "file": name,
            "name": os.path.splitext(name)[0],
            "size": os.path.getsize(full),
        })

    results.sort(key=lambda x: x["file"].lower())
    return results
