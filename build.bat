@echo off
echo Building Dynamic Wallpaper v2.0.0...
echo.
pushd "%~dp0"
pyinstaller DynamicWallpaper.spec --noconfirm
if exist "dist\DynamicWallpaper.exe" (
    echo.
    echo Build successful: dist\DynamicWallpaper.exe
) else (
    echo.
    echo Build FAILED
    exit /b 1
)
popd
