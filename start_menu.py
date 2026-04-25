"""Create a Start Menu shortcut so Windows Search can find Dynamic Wallpaper."""
import os
import sys
from pathlib import Path

APP_NAME = "Dynamic Wallpaper"


def _start_menu_dir() -> Path:
    return Path(os.environ.get("APPDATA", Path.home())) / "Microsoft" / "Windows" / "Start Menu" / "Programs"


def _executable_path() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable)
    return Path(sys.argv[0]).resolve()


def ensure_shortcut() -> bool:
    if os.name != "nt":
        return False
    exe = _executable_path()
    if not exe.exists():
        return False
    sm_dir = _start_menu_dir()
    try:
        sm_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        return False
    lnk = sm_dir / f"{APP_NAME}.lnk"
    if lnk.exists():
        try:
            if _lnk_target(lnk) == str(exe):
                return True
        except Exception:
            pass
    return _create_shortcut(lnk, exe)


def _create_shortcut(lnk_path: Path, target: Path) -> bool:
    try:
        from win32com.client import Dispatch
    except ImportError:
        return _create_shortcut_fallback(lnk_path, target)
    try:
        shell_obj = Dispatch("WScript.Shell")
        shortcut = shell_obj.CreateShortcut(str(lnk_path))
        shortcut.TargetPath = str(target)
        shortcut.WorkingDirectory = str(target.parent)
        shortcut.IconLocation = str(target)
        shortcut.Description = "Dynamic Wallpaper — Time-based desktop wallpaper changer"
        shortcut.Save()
        return True
    except Exception:
        return _create_shortcut_fallback(lnk_path, target)


def _create_shortcut_fallback(lnk_path: Path, target: Path) -> bool:
    try:
        import pythoncom
        from win32com.shell import shell
        link = pythoncom.CoCreateInstance(
            shell.CLSID_ShellLink, None,
            pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink,
        )
        link.SetPath(str(target))
        link.SetWorkingDirectory(str(target.parent))
        link.SetIconLocation(str(target), 0)
        link.SetDescription("Dynamic Wallpaper — Time-based desktop wallpaper changer")
        persist = link.QueryInterface(pythoncom.IID_IPersistFile)
        persist.Save(str(lnk_path), 0)
        return True
    except Exception:
        return False


def _lnk_target(lnk_path: Path) -> str:
    try:
        import pythoncom
        from win32com.shell import shell
        link = pythoncom.CoCreateInstance(
            shell.CLSID_ShellLink, None,
            pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink,
        )
        persist = link.QueryInterface(pythoncom.IID_IPersistFile)
        persist.Load(str(lnk_path))
        path, _ = link.GetPath(0)
        return path
    except Exception:
        return ""
