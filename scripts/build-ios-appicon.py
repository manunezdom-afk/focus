#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

Genera el AppIcon 1024×1024 de Focus iOS — V2: sol/medalla blanca sobre
gradiente azul vivo. Refleja la identidad visual del producto.

Reglas iOS / App Store:
- 1024×1024 px exacto · RGB sin canal alpha.
- Sin transparencia. Sin esquinas redondeadas (iOS aplica máscara squircle).

Diseño V2:
- Fondo: gradiente vertical azul vivo (#2E4FE8 → #1E3A8A).
- Símbolo: sol/medalla blanca de 8 rayos + disco central blanco con punto
  azul interior (efecto "donut"). Más memorable y único que la F geométrica
  anterior.

Output:
- ios-native/Focus/Assets.xcassets/AppIcon.appiconset/AppIcon.png
- docs/assets/focus-app-icon-preview.png

Uso: python3 scripts/build-ios-appicon.py
"""

from PIL import Image, ImageDraw
from pathlib import Path
import json
import math
import sys

REPO = Path(__file__).resolve().parent.parent
APPICON_DIR = REPO / "ios-native/Focus/Assets.xcassets/AppIcon.appiconset"
OUT_APPICON = APPICON_DIR / "AppIcon.png"
OUT_CONTENTS = APPICON_DIR / "Contents.json"
OUT_PREVIEW = REPO / "docs/assets/focus-app-icon-preview.png"

SIZE = 1024
SS = 4  # supersampling para anti-aliasing limpio en bordes del polígono

# Paleta
C_TOP = (46, 79, 232)       # #2E4FE8 azul vivo (top, brillante)
C_BOTTOM = (30, 58, 138)    # #1E3A8A azul profundo (bottom, profundo)
WHITE = (255, 255, 255)
CENTER_DOT = (46, 79, 232)  # #2E4FE8 mismo azul vivo (matchea el top)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    """Gradiente vertical lineal C_TOP → C_BOTTOM (RGB sin alpha)."""
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(C_TOP, C_BOTTOM, t))
    return img


def draw_sun(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Dibuja un sol/medalla blanca de 8 rayos con disco + dot central."""
    cx, cy = size / 2, size / 2

    # Estrella de 8 rayos: 16 vértices alternando outer / inner radius.
    # Inner radius dejamos pequeño para que los rayos se vean separados.
    outer_r = size * 0.36
    inner_r = size * 0.14

    star = []
    for i in range(16):
        angle = math.pi * i / 8 - math.pi / 2  # arrancar mirando arriba
        r = outer_r if i % 2 == 0 else inner_r
        x = cx + math.cos(angle) * r
        y = cy + math.sin(angle) * r
        star.append((x, y))
    draw.polygon(star, fill=WHITE)

    # Disco central blanco — cubre los cortes profundos del polígono y da
    # la sensación de "base" sólida desde donde salen los rayos.
    disk_r = size * 0.18
    draw.ellipse(
        [cx - disk_r, cy - disk_r, cx + disk_r, cy + disk_r],
        fill=WHITE,
    )

    # Punto azul interior — efecto "donut".
    dot_r = size * 0.075
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=CENTER_DOT,
    )


def write_contents_json() -> None:
    contents = {
        "images": [
            {
                "filename": "AppIcon.png",
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
            }
        ],
        "info": {"author": "xcode", "version": 1},
    }
    with OUT_CONTENTS.open("w", encoding="utf-8") as f:
        json.dump(contents, f, indent=2)
        f.write("\n")


def main() -> int:
    # Renderizamos a 4× luego downscale → antialiasing prolijo del polígono.
    big_size = SIZE * SS
    img = build_gradient(big_size)
    draw = ImageDraw.Draw(img)
    draw_sun(draw, big_size)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)

    assert img.size == (SIZE, SIZE) and img.mode == "RGB"

    APPICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_APPICON, "PNG", optimize=True)
    img.save(OUT_PREVIEW, "PNG", optimize=True)
    write_contents_json()

    rel = OUT_APPICON.relative_to(REPO)
    rel_prev = OUT_PREVIEW.relative_to(REPO)
    print(f"✓ AppIcon V2 (sol+medalla): {rel}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {rel_prev}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
