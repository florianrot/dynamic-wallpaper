import sys, os, threading, ctypes, json, re, platform, io, base64
from pathlib import Path
from collections import deque
from http.server import HTTPServer, SimpleHTTPRequestHandler
from functools import partial

import webview

from core.config import load as load_config, save as save_config
from core.wallpaper_engine import WallpaperEngine
from core.scanner import scan_folder
from core.updater import Updater

APP_NAME = "Dynamic Wallpaper"
VERSION  = "2.2.1"
MUTEX_NAME = "Global\\FlorianRDynamicWallpaper"

BASE = Path(__file__).resolve().parent
UI_DIR = BASE / "ui"

_mutex = None
_tray_icon = None
_window = None


def _ensure_single_instance():
    global _mutex
    k32 = ctypes.windll.kernel32
    _mutex = k32.CreateMutexW(None, True, MUTEX_NAME)
    if k32.GetLastError() == 183:
        _activate_existing_window()
        sys.exit(0)


def _activate_existing_window():
    try:
        import win32gui, win32con
        def callback(hwnd, _):
            if win32gui.IsWindow(hwnd) and APP_NAME in win32gui.GetWindowText(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                win32gui.SetForegroundWindow(hwnd)
                return False
            return True
        win32gui.EnumWindows(callback, None)
    except Exception:
        pass


def _apply_dwm(hwnd):
    try:
        from ctypes import wintypes, byref, c_int, sizeof
        dwm = ctypes.windll.dwmapi
        val = c_int(1)
        dwm.DwmSetWindowAttribute(hwnd, 20, byref(val), sizeof(val))
    except Exception:
        pass


def _start_http(directory: Path) -> int:
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return port


WORKER_BASE = "https://support.florianrothenbuehler.com"


_NO_WINDOW = 0x08000000


def _build_exe_cmd():
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}" --minimized'
    return f'"{sys.executable}" "{Path(__file__).resolve()}" --minimized'


def _create_scheduled_task(name, exe_cmd):
    import subprocess
    task_name = f"FlorianR\\{name}"
    try:
        subprocess.run(
            ["schtasks", "/Create",
             "/TN", task_name,
             "/TR", exe_cmd,
             "/SC", "ONLOGON",
             "/RL", "LIMITED",
             "/F"],
            capture_output=True, timeout=10, creationflags=_NO_WINDOW,
        )
    except Exception as e:
        print(f"[autostart] scheduled task create failed: {e}")


def _remove_scheduled_task(name):
    import subprocess
    task_name = f"FlorianR\\{name}"
    try:
        subprocess.run(
            ["schtasks", "/Delete", "/TN", task_name, "/F"],
            capture_output=True, timeout=10, creationflags=_NO_WINDOW,
        )
    except Exception:
        pass


def _set_run_key(name, exe_cmd):
    import winreg
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE,
        )
        winreg.SetValueEx(key, name, 0, winreg.REG_SZ, exe_cmd)
        winreg.CloseKey(key)
    except Exception as e:
        print(f"[autostart] set_run_key failed: {e}")


def _remove_run_key(name):
    import winreg
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE,
        )
        try:
            winreg.DeleteValue(key, name)
        except FileNotFoundError:
            pass
        winreg.CloseKey(key)
    except Exception:
        pass
    # Clean legacy v1 entry
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE,
        )
        try:
            winreg.DeleteValue(key, "DynamicWallpaper")
        except FileNotFoundError:
            pass
        winreg.CloseKey(key)
    except Exception:
        pass


def _set_startup_approved(name, enabled):
    import winreg
    try:
        key = winreg.CreateKeyEx(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
            0, winreg.KEY_SET_VALUE,
        )
        val = b'\x02' + b'\x00' * 11 if enabled else b'\x03' + b'\x00' * 11
        winreg.SetValueEx(key, name, 0, winreg.REG_BINARY, val)
        winreg.CloseKey(key)
    except Exception as e:
        print(f"[autostart] startup_approved failed: {e}")


def _read_startup_approved(name):
    import winreg
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
            0, winreg.KEY_QUERY_VALUE,
        )
        val, _ = winreg.QueryValueEx(key, name)
        winreg.CloseKey(key)
        if isinstance(val, bytes) and len(val) >= 1:
            return val[0] == 0x02
        return None
    except (FileNotFoundError, OSError):
        return None


def _remove_startup_approved(name):
    import winreg
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
            0, winreg.KEY_SET_VALUE,
        )
        try:
            winreg.DeleteValue(key, name)
        except FileNotFoundError:
            pass
        winreg.CloseKey(key)
    except Exception:
        pass


def _cleanup_legacy():
    import winreg
    for subkey in (
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
    ):
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey, 0, winreg.KEY_SET_VALUE)
            try:
                winreg.DeleteValue(key, "DynamicWallpaper")
            except FileNotFoundError:
                pass
            winreg.CloseKey(key)
        except Exception:
            pass
    _remove_scheduled_task("DynamicWallpaper")
    # v1 task was at root level, not under FlorianR\
    import subprocess
    try:
        subprocess.run(
            ["schtasks", "/Delete", "/TN", "DynamicWallpaper", "/F"],
            capture_output=True, timeout=10, creationflags=_NO_WINDOW,
        )
    except Exception:
        pass


def _reconcile_autostart(cfg):
    enabled = cfg.get("start_with_windows", False)
    visible = cfg.get("autostart_visible", False)
    cmd = _build_exe_cmd()
    if visible:
        if enabled:
            _set_run_key(APP_NAME, cmd)
            _set_startup_approved(APP_NAME, True)
        else:
            _remove_run_key(APP_NAME)
            _remove_startup_approved(APP_NAME)
        _remove_scheduled_task(APP_NAME)
    else:
        _remove_run_key(APP_NAME)
        _remove_startup_approved(APP_NAME)
        if enabled:
            _create_scheduled_task(APP_NAME, cmd)
        else:
            _remove_scheduled_task(APP_NAME)


class Api:
    def __init__(self):
        self._config = load_config()
        self._action_ring = deque(maxlen=10)
        self._thumbnails_cache = None
        self._engine = None
        self._updater = None

    def get_config(self):
        return self._config

    def save_config(self, data):
        self._config.update(data)
        if "window" in data and isinstance(data["window"], dict):
            self._config["window"] = {**self._config.get("window", {}), **data["window"]}
        if "folder" in data:
            self._thumbnails_cache = None
        save_config(self._config)
        if self._engine and any(k in data for k in ("folder", "schedule", "lockscreen")):
            self._engine.reload()
        return {"ok": True}

    def get_app_info(self):
        return {"name": APP_NAME, "version": VERSION}

    def check_for_updates(self):
        if self._updater:
            return self._updater.check_now()
        return {"available": False, "current": VERSION, "latest": VERSION, "changelog": []}

    def get_update_status(self):
        if self._updater:
            return self._updater.get_info().get("status", {})
        return {}

    def get_user(self):
        return {
            "display_name": "User",
            "email": "",
            "initials": "U",
        }

    def sign_out(self):
        return {"ok": True}

    def _exe_cmd(self):
        return _build_exe_cmd()

    def set_autostart(self, enabled):
        visible = self._config.get("autostart_visible", False)
        if visible:
            _set_run_key(APP_NAME, self._exe_cmd())
            _set_startup_approved(APP_NAME, enabled)
        else:
            if enabled:
                _create_scheduled_task(APP_NAME, self._exe_cmd())
            else:
                _remove_scheduled_task(APP_NAME)
        self._config["start_with_windows"] = enabled
        save_config(self._config)
        return {"ok": True}

    def set_autostart_visible(self, visible):
        start = self._config.get("start_with_windows", False)
        if visible:
            _set_run_key(APP_NAME, self._exe_cmd())
            _set_startup_approved(APP_NAME, start)
            _remove_scheduled_task(APP_NAME)
        else:
            _remove_run_key(APP_NAME)
            _remove_startup_approved(APP_NAME)
            if start:
                _create_scheduled_task(APP_NAME, self._exe_cmd())
        self._config["autostart_visible"] = visible
        save_config(self._config)
        return {"ok": True}

    def get_autostart_live(self):
        visible = self._config.get("autostart_visible", False)
        if visible:
            reg_state = _read_startup_approved(APP_NAME)
            if reg_state is not None:
                self._config["start_with_windows"] = reg_state
                return {"start_with_windows": reg_state, "autostart_visible": True}
        return {
            "start_with_windows": self._config.get("start_with_windows", False),
            "autostart_visible": visible,
        }

    def get_system_theme(self):
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            )
            val, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
            winreg.CloseKey(key)
            return "light" if val == 1 else "dark"
        except Exception:
            return "dark"

    def toggle_tray_icon(self, enabled):
        global _tray_icon
        self._config["show_tray_icon"] = enabled
        save_config(self._config)
        if enabled and not _tray_icon:
            _setup_tray(_window)
        elif not enabled and _tray_icon:
            try:
                _tray_icon.stop()
            except Exception:
                pass
            _tray_icon = None
        return {"ok": True}

    def open_url(self, url):
        import webbrowser
        webbrowser.open(url)
        return {"ok": True}

    def save_window_state(self, state):
        self._config["minimized_state"] = state
        save_config(self._config)
        return {"ok": True}

    # ── DW-Specific ──

    def browse_folder(self):
        try:
            result = _window.create_file_dialog(webview.FOLDER_DIALOG)
            if result and len(result) > 0:
                folder = result[0]
                images = scan_folder(folder)
                self._config["folder"] = folder
                self._thumbnails_cache = None
                save_config(self._config)
                if self._engine:
                    self._engine.reload()
                return {"ok": True, "folder": folder, "images": images}
            return {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_images(self):
        folder = self._config.get("folder", "")
        return scan_folder(folder) if folder else []

    def get_thumbnails(self):
        folder = self._config.get("folder", "")
        if not folder:
            return {"ok": True, "thumbnails": []}

        if self._thumbnails_cache is not None:
            if self._thumbnails_cache.get("_folder") == folder:
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
                        thumbs.append({"file": img_info["file"], "data_url": f"data:image/jpeg;base64,{b64}"})
                except Exception:
                    thumbs.append({"file": img_info["file"], "data_url": ""})
        except ImportError:
            for img_info in images:
                thumbs.append({"file": img_info["file"], "data_url": ""})

        self._thumbnails_cache = {"_folder": folder, "items": thumbs}
        return {"ok": True, "thumbnails": thumbs}

    def get_wallpaper_status(self):
        if self._engine:
            return self._engine.get_status()
        return {"running": False, "current_file": None, "expected_file": None, "next_change": None}

    # ── Support ──

    def get_diagnostics(self, include_system=False, include_logs=False, include_actions=False):
        result = {}
        if include_system:
            result["os"] = platform.platform()
            result["app_version"] = VERSION
            result["python"] = sys.version.split()[0]
            try:
                result["display"] = f"{ctypes.windll.user32.GetSystemMetrics(0)}x{ctypes.windll.user32.GetSystemMetrics(1)}"
            except Exception:
                pass
        if include_logs:
            log_path = Path(os.environ.get("APPDATA", "")) / "FlorianR" / "DynamicWallpaper" / "dynamicwallpaper.log"
            if log_path.exists():
                try:
                    lines = log_path.read_text(errors="ignore").splitlines()[-50:]
                    result["logs"] = [
                        re.sub(r"(token|key|password|secret)[=:]\S+", r"\1=***", l, flags=re.I)
                        for l in lines
                    ]
                except Exception:
                    pass
        if include_actions:
            result["recent_actions"] = list(self._action_ring)
        return result

    def support_chat(self, messages):
        try:
            import urllib.request, ssl
            ctx = ssl.create_default_context()
            body = json.dumps({"app": "dynamicwallpaper", "messages": messages}).encode()
            req = urllib.request.Request(
                f"{WORKER_BASE}/support/chat-desktop",
                data=body,
                headers={"Content-Type": "application/json", "User-Agent": f"DynamicWallpaper/{VERSION}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                return json.loads(resp.read())
        except Exception as e:
            print(f"[support] worker error: {e}")
        return self._support_chat_direct(messages)

    def _support_chat_direct(self, messages):
        try:
            import urllib.request
            secrets_path = None
            candidates = [
                Path(os.environ.get("APPDATA", "")) / "FlorianR" / ".secrets.json",
                BASE.parent.parent.parent / ".secrets.json",
                Path(__file__).resolve().parent.parent.parent.parent / ".secrets.json",
            ]
            for p in candidates:
                if p.exists():
                    secrets_path = p
                    break
            if not secrets_path:
                return {"content": "Support is currently unavailable."}
            secrets = json.loads(secrets_path.read_text())
            api_key = secrets.get("ANTHROPIC_API_KEY")
            if not api_key:
                return {"content": "Support is not configured."}

            system_prompt = (
                f"You are the support assistant for {APP_NAME}, a Windows desktop wallpaper app. "
                "Help users with questions about features, settings, and troubleshooting. "
                "Be concise and friendly. If you can't resolve an issue, suggest filing a bug report. "
                "Respond in the same language the user writes in."
            )

            api_messages = [{"role": m["role"], "content": m["content"]} for m in messages[-10:]]
            body = json.dumps({
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": api_messages,
            }).encode()

            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=body,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            import ssl
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                data = json.loads(resp.read())
                content = data.get("content", [{}])[0].get("text", "Sorry, something went wrong.")
                return {"content": content}
        except Exception as e:
            print(f"[support] direct API error: {e}")
            return {"content": "Connection error. Please try again later."}

    def get_known_issues(self):
        try:
            import urllib.request
            req = urllib.request.Request(f"{WORKER_BASE}/support/known-issues")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read())
        except Exception:
            return []

    def submit_bug_report(self, app_name, description, severity, diagnostics):
        try:
            import urllib.request
            body = json.dumps({
                "app": app_name or APP_NAME,
                "description": description,
                "severity": severity,
                "diagnostics": diagnostics,
            }).encode()
            req = urllib.request.Request(
                f"{WORKER_BASE}/support/report",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception as e:
            return {"ok": False, "error": str(e)}


def _setup_tray(window):
    global _tray_icon
    try:
        import pystray
        from PIL import Image

        icon_path = BASE / "assets" / "icon.png"
        if icon_path.exists():
            img = Image.open(icon_path)
        else:
            img = Image.new("RGBA", (64, 64), (15, 15, 15, 255))

        def on_open(icon, item):
            global _tray_icon
            window.show()
            window.restore()
            if _api_ref and not _api_ref._config.get("show_tray_icon", True):
                try:
                    icon.stop()
                except Exception:
                    pass
                _tray_icon = None

        def on_quit(icon, item):
            icon.stop()
            window.destroy()

        menu = pystray.Menu(
            pystray.MenuItem("Open", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        )
        _tray_icon = pystray.Icon("DynamicWallpaper", img, APP_NAME, menu)
        threading.Thread(target=_tray_icon.run, daemon=True).start()
    except ImportError:
        pass


def _on_loaded():
    try:
        hwnd = _window.native_handle
        _apply_dwm(hwnd)
    except (AttributeError, Exception):
        pass


def _save_window_geometry():
    try:
        if _window and _api_ref:
            _api_ref._config["window"] = {
                "x": _window.x, "y": _window.y,
                "w": _window.width, "h": _window.height,
            }
            save_config(_api_ref._config)
    except Exception:
        pass


_api_ref = None


def _on_closing():
    try:
        _save_window_geometry()
        close_to_tray = _api_ref._config.get("close_to_tray", False) if _api_ref else False
        if close_to_tray:
            if not _tray_icon:
                _setup_tray(_window)
            _window.hide()
            return False
    except Exception:
        pass
    if _api_ref:
        if _api_ref._engine:
            _api_ref._engine.stop()
        if _api_ref._updater:
            _api_ref._updater.stop()
    if _tray_icon:
        _tray_icon.stop()
    return True


def _create_start_menu_shortcut():
    if not getattr(sys, "frozen", False):
        return
    try:
        import win32com.client
        programs = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
        lnk_path = programs / "Dynamic Wallpaper.lnk"
        exe_path = str(Path(sys.executable).resolve())
        if lnk_path.exists():
            shell = win32com.client.Dispatch("WScript.Shell")
            existing = shell.CreateShortCut(str(lnk_path))
            if existing.TargetPath == exe_path:
                return
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(lnk_path))
        shortcut.TargetPath = exe_path
        shortcut.WorkingDirectory = str(Path(sys.executable).parent)
        shortcut.Description = "Dynamic Wallpaper"
        shortcut.IconLocation = f"{exe_path},0"
        shortcut.save()
    except Exception as e:
        print(f"[shortcut] Start menu error: {e}")


def main():
    _ensure_single_instance()
    _cleanup_legacy()

    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("FlorianR.DynamicWallpaper.Desktop.2")
    except Exception:
        pass

    _create_start_menu_shortcut()

    global _api_ref
    api = Api()
    _api_ref = api
    cfg = api._config

    _reconcile_autostart(cfg)

    engine = WallpaperEngine(cfg)
    api._engine = engine
    engine.start()

    updater = Updater(VERSION)
    api._updater = updater
    updater.start()

    port = _start_http(BASE)

    w = cfg["window"].get("w", 960)
    h = cfg["window"].get("h", 700)
    x = cfg["window"].get("x")
    y = cfg["window"].get("y")

    _should_minimize = "--minimized" in sys.argv
    _has_tray = cfg.get("show_tray_icon", True)

    global _window
    _window = webview.create_window(
        APP_NAME,
        url=f"http://127.0.0.1:{port}/ui/index.html",
        js_api=api,
        width=w, height=h,
        x=x, y=y,
        min_size=(480, 400),
        background_color="#0a0a0a",
        minimized=(_should_minimize and not _has_tray),
    )

    _window.events.loaded += _on_loaded
    _window.events.closing += _on_closing

    if _has_tray:
        _setup_tray(_window)

    if _should_minimize and _has_tray:
        _window.events.loaded += lambda: _window.hide()

    webview.start(debug=("--debug" in sys.argv))


if __name__ == "__main__":
    main()
