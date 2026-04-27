# -*- mode: python ; coding: utf-8 -*-
import os
SPEC_DIR = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    [os.path.join(SPEC_DIR, 'main.py')],
    pathex=[SPEC_DIR],
    datas=[
        (os.path.join(SPEC_DIR, 'ui'), 'ui'),
        (os.path.join(SPEC_DIR, 'assets'), 'assets'),
    ],
    hiddenimports=[
        'pystray._win32',
        'core.config',
        'core.wallpaper_engine',
        'core.scanner',
        'core.updater',
        'win32com.client',
    ],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name='DynamicWallpaper',
    debug=False,
    strip=False,
    upx=True,
    console=False,
    icon=[os.path.join(SPEC_DIR, 'assets', 'icon.ico')],
    version=os.path.join(SPEC_DIR, 'version_info.txt'),
)
