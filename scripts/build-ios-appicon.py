#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V4 de Focus — F geométrica blanca + sparkle accent en cobalto.
Filosofía: estructura, sistema, inteligencia. NO floral.

V4 vs V3:
- V3 era 8 pétalos redondeados → parecía margarita/flor (mal para Focus).
- V4 es F geométrica + sparkle → brand letter + AI/Nova accent.
  Tipografía bold custom, rectángulos redondeados, sparkle 4-point.

Identidad reflejada:
- F → Focus (la marca, recognizable, premium).
- Sparkle → Nova (asistente IA, integrado al símbolo).
- Cobalt → familia de productividad (vs Kairos violet, Spark orange).

Reglas iOS: 1024×1024 RGB sin alpha · sin transparencia.

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


def draw_focus_F(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Dibuja una F geométrica blanca centrada, con esquinas redondeadas.
    Construida con 3 rectángulos: stem vertical, top bar, middle bar.
    """
    # Coordenadas relativas al canvas size (para mantenerse proporcional al SS).
    # F bounding box: aprox 41% del canvas centrado (con leve shift left para
    # dejar espacio al sparkle arriba-derecha).
    stem_x = size * 0.275
    stem_top = size * 0.205
    stem_w = size * 0.125
    stem_h = size * 0.59
    radius = size * 0.012  # esquinas levemente redondeadas, no muy pill-shape

    # Stem vertical
    draw.rounded_rectangle(
        [stem_x, stem_top, stem_x + stem_w, stem_top + stem_h],
        radius=radius,
        fill=WHITE,
    )

    # Top horizontal bar
    top_bar_w = size * 0.44
    top_bar_h = size * 0.125
    draw.rounded_rectangle(
        [stem_x, stem_top, stem_x + top_bar_w, stem_top + top_bar_h],
        radius=radius,
        fill=WHITE,
    )

    # Middle horizontal bar (más corta que el top)
    mid_bar_w = size * 0.35
    mid_bar_h = size * 0.105
    mid_top = stem_top + size * 0.235
    draw.rounded_rectangle(
        [stem_x, mid_top, stem_x + mid_bar_w, mid_top + mid_bar_h],
        radius=radius,
        fill=WHITE,
    )


def draw_sparkle(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Sparkle 4-point star blanco, posicionado arriba-derecha del F.
    Representa Nova / IA integrada al símbolo de Focus.
    """
    cx = size * 0.78
    cy = size * 0.20
    outer_r = size * 0.075
    inner_r = size * 0.024

    # 8 vértices: alternando outer (4 cardinal) e inner (4 diagonal).
    pts = []
    for i in range(8):
        angle = i * math.pi / 4 - math.pi / 2
        r = outer_r if i % 2 == 0 else inner_r
        pts.append((
            cx + math.cos(angle) * r,
            cy + math.sin(angle) * r,
        ))
    draw.polygon(pts, fill=WHITE)


def main() -> int:
    big = SIZE * SS
    img = build_gradient(big)
    draw = ImageDraw.Draw(img)
    draw_focus_F(draw, big)
    draw_sparkle(draw, big)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)

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

    print(f"✓ AppIcon V4 (F + sparkle): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
