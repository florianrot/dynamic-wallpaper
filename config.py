"""Config store — JSON in %APPDATA%/DynamicWallpaper/config.json.
Thread-safe, atomic write, backup file."""

import json
import os
import re
import shutil
import threading
from pathlib import Path

DEFAULTS = {
    "folder": "",
    "schedule": [],
    "lockscreen": True,
    "autostart": True,
}


def _app_dir() -> Path:
    return Path(os.environ.get("APPDATA", Path.home())) / "DynamicWallpaper"


class Config:
    def __init__(self):
        self._dir = _app_dir()
        self._path = self._dir / "config.json"
        self._lock = threading.Lock()
        self.data: dict = json.loads(json.dumps(DEFAULTS))
        self._dir.mkdir(parents=True, exist_ok=True)
        self.load()

    def load(self):
        with self._lock:
            loaded = self._read(self._path)
            if loaded is None:
                loaded = self._read(self._path.with_suffix(".json.bak"))
            if loaded:
                for k in DEFAULTS:
                    if k in loaded:
                        self.data[k] = loaded[k]

    def save(self):
        with self._lock:
            payload = json.dumps(self.data, indent=2, ensure_ascii=False)
            try:
                if self._path.exists():
                    shutil.copy2(str(self._path), str(self._path.with_suffix(".json.bak")))
            except Exception:
                pass
            tmp = self._path.with_suffix(".json.tmp")
            tmp.write_text(payload, encoding="utf-8")
            os.replace(str(tmp), str(self._path))

    def get(self, key, default=None):
        with self._lock:
            return self.data.get(key, default)

    def update(self, updates: dict):
        with self._lock:
            self.data.update(updates)

    def migrate_from_txt(self, txt_path: str):
        """Convert a legacy config.txt (image_number=HH:MM) to JSON format."""
        schedule = []
        lockscreen = True
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key, val = key.strip(), val.strip()
                    m = re.match(r"^(\d{1,2}):(\d{2})$", val)
                    if m:
                        try:
                            img = int(key)
                        except ValueError:
                            continue
                        schedule.append({"file": f"{img}.png", "time": val})
                        continue
                    if key.lower() == "lockscreen":
                        lockscreen = val.lower() in ("true", "1", "yes", "on")
        except Exception:
            return
        if schedule:
            self.data["schedule"] = schedule
            self.data["lockscreen"] = lockscreen
            self.data["folder"] = str(Path(txt_path).parent)
            self.save()

    @staticmethod
    def _read(path: Path) -> dict | None:
        if not path.exists():
            return None
        try:
            raw = path.read_text(encoding="utf-8")
            return json.loads(raw) if raw.strip() else None
        except Exception:
            return None
