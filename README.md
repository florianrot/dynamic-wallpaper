# Dynamic Wallpaper

Automatically change your desktop wallpaper based on the time of day. A Windows desktop app for time-based wallpaper rotation.

## Features

- **Time-based schedule** — assign wallpaper images to time slots throughout the day
- **Lock screen sync** — optionally update the Windows lock screen alongside your desktop
- **Custom time picker** — intuitive schedule builder with scrollable hour/minute columns or direct keyboard input
- **Thumbnail preview** — browse your wallpaper folder with adjustable thumbnail sizes
- **System tray** — runs quietly in the background with a tray icon
- **Auto-update** — checks for new versions automatically
- **Dark/Light mode** — follows your Windows theme or set manually
- **Multi-language** — English and German (Deutsch)
- **Built-in support** — AI-powered help chat and bug reporting

## Download

Download the latest `DynamicWallpaper.exe` from [Releases](https://github.com/florianrot/dynamic-wallpaper/releases).

No installation needed — just run the EXE.

## Usage

1. Open the app and go to **Library**
2. Click **Browse** to select a folder with your wallpaper images
3. Go to **Schedule** and click **Add Time Slot**
4. Set a time and select which image to display
5. Repeat for different times of day (sunrise, noon, evening, night)

The wallpaper changes automatically every minute based on your schedule.

## Settings

Access settings via the user icon in the sidebar:

- **Start with Windows** — launch at login (minimized to tray)
- **Close to tray** — minimize instead of quitting
- **Theme** — Auto, Dark, or Light
- **Language** — System, English, or Deutsch
- **Keyboard shortcuts** — `Ctrl+K` command palette, `Ctrl+B` sidebar toggle, `Ctrl+,` settings

## Tech Stack

- Python 3, pywebview (EdgeChromium), pystray, Pillow, winsdk
- Windows APIs for wallpaper setting and lock screen sync
- Built with PyInstaller

## License

MIT License - see [LICENSE](LICENSE)

## Author

[Florian Rothenbuehler](https://florianrothenbuehler.com)
