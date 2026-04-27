"""Wallpaper engine — background thread that sets desktop and lock screen
wallpaper on a time-based schedule."""

import asyncio
import ctypes
import os
import threading
from ctypes import wintypes
from datetime import time as dtime, datetime

from .scanner import scan_folder


def _parse_schedule(schedule_list: list[dict]) -> dict[dtime, str]:
    result: dict[dtime, str] = {}
    for entry in schedule_list:
        try:
            parts = entry["time"].split(":")
            t = dtime(int(parts[0]), int(parts[1]))
            result[t] = entry["file"]
        except (KeyError, ValueError, IndexError):
            continue
    return result


def pick_current(schedule: dict[dtime, str], now: dtime) -> str | None:
    if not schedule:
        return None
    sorted_times = sorted(schedule.keys())
    current = None
    for t in sorted_times:
        if t <= now:
            current = t
        else:
            break
    if current is None:
        current = sorted_times[-1]
    return schedule[current]


def set_desktop(path: str) -> None:
    SPI_SETDESKWALLPAPER = 0x0014
    SPIF_UPDATEINIFILE = 0x01
    SPIF_SENDCHANGE = 0x02
    user32 = ctypes.windll.user32
    user32.SystemParametersInfoW.argtypes = [
        wintypes.UINT, wintypes.UINT, wintypes.LPCWSTR, wintypes.UINT
    ]
    user32.SystemParametersInfoW.restype = wintypes.BOOL
    ok = user32.SystemParametersInfoW(
        SPI_SETDESKWALLPAPER, 0, path,
        SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
    )
    if not ok:
        raise ctypes.WinError()


def set_lockscreen(path: str) -> None:
    try:
        from winsdk.windows.storage import StorageFile
        from winsdk.windows.system.userprofile import LockScreen
    except ImportError:
        return

    async def _set(p: str):
        file = await StorageFile.get_file_from_path_async(p)
        await LockScreen.set_image_file_async(file)

    asyncio.run(_set(path))


class WallpaperEngine:
    def __init__(self, config):
        self._config = config
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._current_file: str | None = None

    def start(self):
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="dw-engine")
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def reload(self):
        self._check_and_update()

    def get_status(self) -> dict:
        schedule = _parse_schedule(self._config.get("schedule", []))
        now = datetime.now().time()
        expected = pick_current(schedule, now)

        next_change = None
        if schedule:
            for t in sorted(schedule.keys()):
                if t > now:
                    next_change = t.strftime("%H:%M")
                    break

        return {
            "running": self._thread is not None and self._thread.is_alive(),
            "current_file": self._current_file,
            "expected_file": expected,
            "next_change": next_change,
        }

    def _loop(self):
        self._check_and_update()
        while not self._stop_event.is_set():
            self._stop_event.wait(60)
            if self._stop_event.is_set():
                break
            self._check_and_update()

    def _check_and_update(self):
        folder = self._config.get("folder", "")
        if not folder or not os.path.isdir(folder):
            return

        schedule = _parse_schedule(self._config.get("schedule", []))
        if not schedule:
            return

        now = datetime.now().time()
        target_file = pick_current(schedule, now)
        if not target_file:
            return

        if target_file == self._current_file:
            return

        img_path = os.path.join(folder, target_file)
        if not os.path.isfile(img_path):
            return

        try:
            set_desktop(img_path)
            self._current_file = target_file
        except Exception as e:
            print(f"[dynamic-wallpaper] desktop error: {e}")
            return

        if self._config.get("lockscreen", False):
            try:
                set_lockscreen(img_path)
            except Exception as e:
                print(f"[dynamic-wallpaper] lockscreen error: {e}")
