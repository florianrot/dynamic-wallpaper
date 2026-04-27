import json, os, shutil
from pathlib import Path
from datetime import datetime

_DIR = Path(os.environ.get("APPDATA", "")) / "FlorianR" / "DynamicWallpaper"
_FILE = _DIR / "config.json"

_DEFAULTS = {
    "theme": "auto",
    "locale": "system",
    "sidebar_mode": "full",
    "sidebar_width": 240,
    "start_with_windows": True,
    "start_minimized": False,
    "close_to_tray": True,
    "show_tray_icon": True,
    "sidebar_modes_enabled": ["full", "icons", "hidden"],
    "window": {"x": None, "y": None, "w": 960, "h": 700},
    "minimized_state": None,
    "folder": "",
    "schedule": [],
    "lockscreen": True,
    "thumb_size": 100,
}


def load() -> dict:
    _DIR.mkdir(parents=True, exist_ok=True)
    if _FILE.exists():
        try:
            with open(_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            merged = {**_DEFAULTS, **data}
            merged["window"] = {**_DEFAULTS["window"], **(data.get("window") or {})}
            # v1 migration
            if "autostart" in data and "start_with_windows" not in data:
                merged["start_with_windows"] = data["autostart"]
            if "show_tray" in data and "show_tray_icon" not in data:
                merged["show_tray_icon"] = data["show_tray"]
            if merged.get("theme") == "":
                merged["theme"] = "auto"
            return merged
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULTS)


def save(data: dict):
    _DIR.mkdir(parents=True, exist_ok=True)
    if _FILE.exists():
        try:
            bak = _DIR / "config.json.bak"
            shutil.copy2(_FILE, bak)
        except OSError:
            pass
    tmp = _FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, _FILE)
