#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V5 de Focus — núcleo sólido + 2 anillos concéntricos sobre cobalto.
Lectura: aperture / claridad mental / foco. NO letras, NO pétalos, NO chispas.

V5 vs V4:
- V4 era F geométrica + sparkle → leía como "letra de marca", no claridad.
- V5 son círculos concéntricos → símbolo abstracto de focus/clarity/aperture.
  Funciona a todos los tamaños, es premium y App Store-ready.

Family system (mismo símbolo, distinto gradiente):
- Focus → cobalt (#2E4FE8 → #182F82).
- Kairos (futuro) → violeta.
- Spark (futuro) → naranja.

Reglas iOS: 1024×1024 RGB sin alpha · sin transparencia.

Uso: python3 scripts/build-ios-appicon.py
"""

from PIL import Image, ImageDraw
from pathlib import Path
import json
import sys

REPO = Path(__file__).resolve().parent.parent
APPICON_DIR = REPO / "ios-native/Focus/Assets.xcassets/AppIcon.appiconset"
OUT_APPICON = APPICON_DIR / "AppIcon.png"
OUT_CONTENTS = APPICON_DIR / "Contents.json"
OUT_PREVIEW = REPO / "docs/assets/focus-app-icon-preview.png"

SIZE = 1024
SS = 4

# Paleta cobalt — Focus identity (azul profundo + cobalto vivo).
C_TOP = (46, 79, 232)        # #2E4FE8 cobalto vivo
C_BOTTOM = (24, 47, 130)     # #182F82 azul profundo
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(C_TOP, C_BOTTOM, t))
    return img


def draw_ring(draw: ImageDraw.ImageDraw, size: int, diameter_ratio: float,
              thickness_ratio: float, color=WHITE) -> None:
    """Anillo (stroke circle) centrado, sin relleno interior.

    diameter_ratio: diámetro como fracción del canvas (e.g. 0.70 → 70% del size).
    thickness_ratio: grosor del stroke como fracción del canvas.
    """
    cx = size / 2
    cy = size / 2
    r_outer = (size * diameter_ratio) / 2
    r_inner = r_outer - (size * thickness_ratio)
    # Outer disk
    draw.ellipse(
        [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
        fill=color,
    )
    # Cut out inner disk (color del fondo NO funciona porque hay gradiente).
    # Solución: usar máscara con composición alpha.
    # Pillow trick: dibujamos un círculo "vacío" usando ImageDraw.ellipse con
    # outline+width, que solo dibuja el contorno.
    # → Reescribimos abajo.


def draw_stroked_ring(img: Image.Image, size: int, diameter_ratio: float,
                       thickness_ratio: float, color=WHITE, alpha: int = 255) -> None:
    """Anillo (contorno hueco) compositado sobre `img` con alpha exacto."""
    cx = size / 2
    cy = size / 2
    diameter = size * diameter_ratio
    thickness = max(1, int(size * thickness_ratio))
    bbox = [cx - diameter / 2, cy - diameter / 2,
            cx + diameter / 2, cy + diameter / 2]

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ring_color = (color[0], color[1], color[2], alpha)
    ov_draw.ellipse(bbox, outline=ring_color, width=thickness)
    img.paste(overlay, (0, 0), overlay)


def draw_disk(img: Image.Image, size: int, diameter_ratio: float,
              color=WHITE) -> None:
    """Disco sólido centrado."""
    cx = size / 2
    cy = size / 2
    diameter = size * diameter_ratio
    bbox = [cx - diameter / 2, cy - diameter / 2,
            cx + diameter / 2, cy + diameter / 2]
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.ellipse(bbox, fill=(color[0], color[1], color[2], 255))
    img.paste(overlay, (0, 0), overlay)


def main() -> int:
    big = SIZE * SS
    img = build_gradient(big).convert("RGBA")

    # Anillo exterior — sutil, alpha ~140/255 (~0.55).
    draw_stroked_ring(img, big, diameter_ratio=0.70, thickness_ratio=0.028,
                      color=WHITE, alpha=140)
    # Anillo medio — borde del foco (sólido).
    draw_stroked_ring(img, big, diameter_ratio=0.44, thickness_ratio=0.050,
                      color=WHITE, alpha=255)
    # Núcleo sólido.
    draw_disk(img, big, diameter_ratio=0.18, color=WHITE)

    img = img.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)

    assert img.size == (SIZE, SIZE) and img.mode == "RGB"

    APPICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_APPICON, "PNG", optimize=True)
    img.save(OUT_PREVIEW, "PNG", optimize=True)

    contents = {
        "images": [{
            "filename": "AppIcon.png",
            "idiom": "universal",
            "platform": "ios",
            "size": "1024x1024",
        }],
        "info": {"author": "xcode", "version": 1},
    }
    with OUT_CONTENTS.open("w", encoding="utf-8") as f:
        json.dump(contents, f, indent=2)
        f.write("\n")

    print(f"✓ AppIcon V5 (núcleo + anillos): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
