"""Generate the additional PWA icon sizes Bricket Control needs for a full
install experience on Android, iOS/iPadOS, Windows and macOS.

The only icon committed until now was the 225x225 source mark itself,
declared in the manifest as the sole icon. Chrome's installability checks
and Android's home-screen/splash-screen rendering expect at minimum a
192x192 and a 512x512 icon; without them the browser's install affordance
can be absent or degraded, and any icon it does show gets blurry (scaled up
from 225px). This script derives 192/512 "any" icons and a padded 512
"maskable" icon (safe-zone content, background-filled corners so Android's
adaptive-icon mask never crops the mark) from the existing source — it does
not replace the source mark, only adds correctly-sized derivatives.

Run: python scripts/generate_pwa_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "bricket-mark.png"
OUT_192 = ROOT / "public" / "bricket-mark-192.png"
OUT_512 = ROOT / "public" / "bricket-mark-512.png"
OUT_512_MASKABLE = ROOT / "public" / "bricket-mark-512-maskable.png"

# Android's maskable safe zone is the inner 80% (10% margin per side) of the
# icon; content outside it may be cropped by circular/squircle masks.
MASKABLE_CONTENT_SCALE = 0.8


def dominant_corner_color(image: Image.Image) -> tuple[int, int, int, int]:
    rgba = image.convert("RGBA")
    return rgba.getpixel((0, 0))


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source icon not found: {SOURCE}")
    source = Image.open(SOURCE).convert("RGBA")

    icon_192 = source.resize((192, 192), Image.LANCZOS)
    icon_192.save(OUT_192)

    icon_512 = source.resize((512, 512), Image.LANCZOS)
    icon_512.save(OUT_512)

    background = dominant_corner_color(source)
    canvas = Image.new("RGBA", (512, 512), background)
    content_size = round(512 * MASKABLE_CONTENT_SCALE)
    content = source.resize((content_size, content_size), Image.LANCZOS)
    offset = (512 - content_size) // 2
    canvas.paste(content, (offset, offset), content)
    canvas.save(OUT_512_MASKABLE)

    print(f"Wrote {OUT_192} ({OUT_192.stat().st_size} bytes)")
    print(f"Wrote {OUT_512} ({OUT_512.stat().st_size} bytes)")
    print(f"Wrote {OUT_512_MASKABLE} ({OUT_512_MASKABLE.stat().st_size} bytes), background {background}")


if __name__ == "__main__":
    main()
