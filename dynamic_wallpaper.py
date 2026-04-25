"""Dynamic Wallpaper — standalone app.

Runs as a system tray application. Opens a settings window on demand.
Automatically changes desktop (and optionally lock screen) wallpaper
based on a time-of-day schedule.
"""

import ctypes
import os
import sys
import threading
from pathlib import Path


def _resource_path(relative: str) -> Path:
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).parent
    return base / relative


def _acquire_mutex():
    try:
        import win32event
        import win32api
        import winerror
    except ImportError:
        return object()
    try:
        h = win32event.CreateMutex(None, False, "Global\\DynamicWallpaper")
        if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
            return None
        return h
    except Exception:
        return object()


def main():
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "FlorianR.DynamicWallpaper.1"
        )
    except Exception:
        pass

    mutex = _acquire_mutex()
    if mutex is None:
        sys.exit(0)

    from config import Config
    from engine import WallpaperEngine
    from settings_api import SettingsApi

    config = Config()
    engine = WallpaperEngine(config)
    engine.start()

    settings = SettingsApi(config, engine)

    import webview

    settings_window = None
    tray_icon = None
    _quitting = False

    def show_settings():
        if settings_window:
            try:
                settings_window.show()
                settings_window.restore()
            except Exception:
                pass

    def on_closing():
        nonlocal _quitting
        if _quitting:
            return True
        if settings_window:
            try:
                settings_window.hide()
            except Exception:
                pass
        return False

    def quit_app():
        nonlocal _quitting
        _quitting = True
        engine.stop()
        if tray_icon:
            try:
                tray_icon.stop()
            except Exception:
                pass
        for w in webview.windows[:]:
            try:
                w.destroy()
            except Exception:
                pass

    def update_tray_visibility():
        show = config.get("show_tray", True)
        if tray_icon:
            try:
                tray_icon.visible = show
            except Exception:
                pass

    settings.set_tray_callback(update_tray_visibility)

    def start_tray():
        nonlocal tray_icon
        try:
            from pystray import Icon, MenuItem, Menu
            from PIL import Image

            icon_path = _resource_path("assets/icon.png")
            if icon_path.exists():
                image = Image.open(icon_path)
            else:
                image = Image.new("RGB", (64, 64), (60, 60, 60))

            menu = Menu(
                MenuItem("Settings", lambda: show_settings()),
                MenuItem("Quit", lambda: quit_app()),
            )
            tray_icon = Icon("DynamicWallpaper", image, "Dynamic Wallpaper", menu)
            tray_icon.visible = config.get("show_tray", True)
            tray_icon.run()
        except Exception as e:
            print(f"Tray failed: {e}")

    tray_thread = threading.Thread(target=start_tray, daemon=True)
    tray_thread.start()

    ui_path = str(_resource_path("ui/index.html"))
    settings_window = webview.create_window(
        "Dynamic Wallpaper",
        ui_path,
        js_api=settings,
        width=560,
        height=680,
        resizable=True,
    )
    settings_window.events.closing += on_closing

    webview.start(gui="edgechromium", debug=False)
    quit_app()


if __name__ == "__main__":
    main()
