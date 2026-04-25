# Dynamic Wallpaper

Automatically change your desktop wallpaper based on the time of day.

Point it at a folder of images, assign each image to a time slot, and your wallpaper transitions throughout the day — sunrise to sunset to night.

## Download

Grab the latest release from the [Releases page](https://github.com/florianrot/dynamic-wallpaper/releases). No installation needed — just run the `.exe`.

## How it works

1. **Run the app** — it sits in your system tray
2. **Choose a folder** with your wallpaper images (`.png`, `.jpg`)
3. **Set up your schedule** — pick which image shows at which time
4. Done. The wallpaper updates automatically.

## Features

- Time-based wallpaper rotation (any number of images, any schedule)
- Optional lock screen wallpaper sync
- Start with Windows toggle
- Dark and light mode (auto-detects your Windows theme)
- Thumbnail previews for easy image selection
- Minimal resource usage — checks once per minute

## Requirements

- Windows 10 or 11
- That's it. Single `.exe`, no dependencies.

## For wallpaper creators

If you sell or distribute wallpaper packs and want to include time-of-day rotation for Windows users: feel free to bundle this app with your wallpaper sets. It's MIT licensed and works with any image folder.

## Building from source

```bash
pip install -r requirements.txt
build.bat
```

The built `.exe` will be in `dist/`.

## License

MIT — see [LICENSE](LICENSE).

Made by [Florian Rothenbühler](https://florianrothenbuehler.com)
