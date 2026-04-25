@echo off
echo Building Dynamic Wallpaper...
pyinstaller DynamicWallpaper.spec --noconfirm
echo.
if exist "dist\DynamicWallpaper.exe" (
    echo Build successful: dist\DynamicWallpaper.exe
) else (
    echo Build FAILED
    exit /b 1
)
