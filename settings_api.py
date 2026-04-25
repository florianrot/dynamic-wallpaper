"""Settings API — pywebview JS bridge for the settings window."""

import base64
import io
import os
import sys

from scanner import scan_folder
from theme import get_system_theme


class SettingsApi:
    def __init__(self, config, engine):
        self._config = config
        self._engine = engine
        self._thumbnails_cache: dict[str, list] | None = None
        self._tray_callback = None

    def set_tray_callback(self, cb):
        self._tray_callback = cb

    def get_config(self) -> dict:
        status = self._engine.get_status()
        folder = self._config.get("folder", "")
        images = scan_folder(folder) if folder else []
        saved_theme = self._config.get("theme", "")
        theme = saved_theme if saved_theme in ("dark", "light") else get_system_theme()

        return {
            "ok": True,
            "folder": folder,
            "schedule": self._config.get("schedule", []),
            "lockscreen": self._config.get("lockscreen", True),
            "autostart": self._config.get("autostart", True),
            "images": images,
            "current_file": status.get("current_file"),
            "next_change": status.get("next_change"),
            "running": status.get("running", False),
            "theme": theme,
            "show_tray": self._config.get("show_tray", True),
        }

    def save_config(self, data: dict) -> dict:
        try:
            allowed = ("folder", "schedule", "lockscreen", "autostart", "theme", "show_tray")
            for k, v in data.items():
                if k in allowed:
                    self._config.data[k] = v
            self._config.save()

            if "autostart" in data:
                self._sync_autostart(data["autostart"])

            if "folder" in data:
                self._thumbnails_cache = None

            if "show_tray" in data and self._tray_callback:
                self._tray_callback()

            self._engine.reload()
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def browse_folder(self) -> dict:
        try:
            import webview
            if not webview.windows:
                return {"ok": False, "error": "No window"}
            result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if result and len(result) > 0:
                folder = result[0]
                images = scan_folder(folder)
                self._thumbnails_cache = None
                return {"ok": True, "folder": folder, "images": images}
            return {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_thumbnails(self) -> dict:
        folder = self._config.get("folder", "")
        if not folder:
            return {"ok": True, "thumbnails": []}

        if self._thumbnails_cache is not None:
            cached_folder = self._thumbnails_cache.get("_folder")
            if cached_folder == folder:
                return {"ok": True, "thumbnails": self._thumbnails_cache.get("items", [])}

        images = scan_folder(folder)
        thumbs = []
        try:
            from PIL import Image
            for img_info in images:
                path = os.path.join(folder, img_info["file"])
                try:
                    with Image.open(path) as img:
                        ratio = 120 / img.width
                        new_size = (120, max(1, int(img.height * ratio)))
                        thumb = img.resize(new_size, Image.LANCZOS)
                        buf = io.BytesIO()
                        thumb.save(buf, format="JPEG", quality=75)
                        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                        thumbs.append({
                            "file": img_info["file"],
                            "data_url": f"data:image/jpeg;base64,{b64}",
                        })
                except Exception:
                    thumbs.append({"file": img_info["file"], "data_url": ""})
        except ImportError:
            for img_info in images:
                thumbs.append({"file": img_info["file"], "data_url": ""})

        self._thumbnails_cache = {"_folder": folder, "items": thumbs}
        return {"ok": True, "thumbnails": thumbs}

    @staticmethod
    def open_url(url: str):
        import webbrowser
        webbrowser.open(url)

    @staticmethod
    def _sync_autostart(enabled: bool):
        if not getattr(sys, "frozen", False):
            return
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER, key_path, 0,
                winreg.KEY_READ | winreg.KEY_WRITE,
            ) as key:
                name = "DynamicWallpaper"
                if enabled:
                    exe = f'"{sys.executable}"'
                    winreg.SetValueEx(key, name, 0, winreg.REG_SZ, exe)
                else:
                    try:
                        winreg.DeleteValue(key, name)
                    except FileNotFoundError:
                        pass
        except Exception:
            pass
