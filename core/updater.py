"""Auto-updater — checks R2 for new versions, downloads in background."""

import json
import os
import sys
import shutil
import threading
import urllib.request
from pathlib import Path

UPDATE_URL = "https://modu-releases.florianrothenbuehler.com/dynamic-wallpaper/latest.json"
_UPDATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "FlorianR" / "DynamicWallpaper" / "update"
CHECK_INTERVAL = 4 * 60 * 60  # 4 hours


class Updater:
    def __init__(self, current_version: str):
        self._current = current_version
        self._timer: threading.Timer | None = None
        self._stop_event = threading.Event()
        self._status = {"checking": False, "downloading": False, "ready": False, "error": None}
        self._latest_info = None

    def start(self):
        self._apply_pending_update()
        self._schedule_check(delay=30)

    def stop(self):
        self._stop_event.set()
        if self._timer:
            self._timer.cancel()

    def check_now(self) -> dict:
        self._do_check()
        return self.get_info()

    def get_info(self) -> dict:
        info = {
            "available": False,
            "current": self._current,
            "latest": self._current,
            "changelog": [],
            "status": dict(self._status),
        }
        if self._latest_info:
            info["latest"] = self._latest_info.get("version", self._current)
            info["changelog"] = self._latest_info.get("changelog", [])
            info["available"] = self._is_newer(info["latest"])
        return info

    def _schedule_check(self, delay=None):
        if self._stop_event.is_set():
            return
        self._timer = threading.Timer(delay or CHECK_INTERVAL, self._do_check_and_reschedule)
        self._timer.daemon = True
        self._timer.start()

    def _do_check_and_reschedule(self):
        self._do_check()
        self._schedule_check()

    def _do_check(self):
        self._status["checking"] = True
        self._status["error"] = None
        try:
            req = urllib.request.Request(UPDATE_URL, headers={"User-Agent": f"DynamicWallpaper/{self._current}"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                self._latest_info = json.loads(resp.read())

            latest_ver = self._latest_info.get("version", "")
            if self._is_newer(latest_ver) and self._latest_info.get("url"):
                self._download(self._latest_info["url"])
        except Exception as e:
            self._status["error"] = str(e)
        finally:
            self._status["checking"] = False

    def _download(self, url: str):
        if self._status["downloading"]:
            return
        self._status["downloading"] = True
        try:
            _UPDATE_DIR.mkdir(parents=True, exist_ok=True)
            tmp = _UPDATE_DIR / "DynamicWallpaper.exe.tmp"
            target = _UPDATE_DIR / "DynamicWallpaper.exe"

            urllib.request.urlretrieve(url, str(tmp))
            if tmp.exists():
                if target.exists():
                    target.unlink()
                tmp.rename(target)
                self._status["ready"] = True
        except Exception as e:
            self._status["error"] = str(e)
        finally:
            self._status["downloading"] = False

    def _apply_pending_update(self):
        """Called on startup — replace current EXE with downloaded update."""
        if not getattr(sys, "frozen", False):
            return
        update_exe = _UPDATE_DIR / "DynamicWallpaper.exe"
        if not update_exe.exists():
            return
        try:
            current_exe = Path(sys.executable)
            backup = current_exe.with_suffix(".old")
            if backup.exists():
                backup.unlink()
            current_exe.rename(backup)
            shutil.copy2(str(update_exe), str(current_exe))
            update_exe.unlink()
            # Restart with new EXE
            os.execv(str(current_exe), sys.argv)
        except Exception as e:
            print(f"[updater] apply failed: {e}")
            # Try to restore backup
            try:
                backup = Path(sys.executable).with_suffix(".old")
                if backup.exists() and not Path(sys.executable).exists():
                    backup.rename(Path(sys.executable))
            except Exception:
                pass

    def _is_newer(self, version: str) -> bool:
        try:
            def parse(v):
                return tuple(int(x) for x in v.strip().split("."))
            return parse(version) > parse(self._current)
        except (ValueError, AttributeError):
            return False
