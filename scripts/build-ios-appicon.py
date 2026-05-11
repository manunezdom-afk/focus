#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V3 de Focus — sol/medalla blanca de 8 pétalos REDONDEADOS sobre
gradiente azul vivo. Match más cercano al logo original del usuario.

V3 vs V2: pétalos como capsules rotadas (no polígono star puntiagudo).
Más premium, menos "shuriken".

Reglas iOS / App Store:
- 1024×1024 px exacto · RGB sin canal alpha · sin transparencia.

Output:
- ios-native/Focus/Assets.xcassets/AppIcon.appiconset/AppIcon.png
- docs/assets/focus-app-icon-preview.png

Uso: python3 scripts/build-ios-appicon.py
"""

from PIL import Image, ImageDraw, ImageFilter
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
SS = 4  # supersampling para antialiasing limpio

C_TOP = (46, 79, 232)       # #2E4FE8 azul vivo (top)
C_BOTTOM = (30, 58, 138)    # #1E3A8A azul profundo (bottom)
WHITE = (255, 255, 255)
DOT = (46, 79, 232)         # mismo azul que el top — donut effect


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    """Gradiente vertical lineal C_TOP → C_BOTTOM."""
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(C_TOP, C_BOTTOM, t))
    return img


def build_petal_layer(size: int) -> Image.Image:
    """Genera UN pétalo (capsule blanca redondeada) arriba del centro.
    Después se rota 8× y se compone para formar el sol/medalla.
    Proporciones: ancho relativamente grande, alto moderado (no flor larga).
    """
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # Pétalo: más ancho que alto para look "rayo de sol" no "flor margarita".
    petal_w = size * 0.16
    petal_h = size * 0.22
    cx = size / 2
    # Centro del pétalo más cerca del centro del icono → ray se ve "saliendo" del disco.
    offset_from_center = size * 0.21
    petal_cy = size / 2 - offset_from_center
    draw.ellipse([
        cx - petal_w / 2,
        petal_cy - petal_h / 2,
        cx + petal_w / 2,
        petal_cy + petal_h / 2,
    ], fill=(*WHITE, 255))
    return layer


def main() -> int:
    big = SIZE * SS

    # 1. Background con gradiente.
    img = build_gradient(big).convert("RGBA")

    # 2. Pétalos: dibujamos 1 pétalo, rotamos y componemos 8 veces.
    base_petal = build_petal_layer(big)
    for i in range(8):
        angle_deg = i * 45.0
        # PIL rotate: positive = counterclockwise. Usamos -angle para clockwise.
        rotated = base_petal.rotate(-angle_deg, resample=Image.BICUBIC, expand=False)
        img = Image.alpha_composite(img, rotated)

    # 3. Disco central blanco más grande — los pétalos "salen" de él.
    draw = ImageDraw.Draw(img)
    cx, cy = big / 2, big / 2
    disk_r = big * 0.19
    draw.ellipse([cx - disk_r, cy - disk_r, cx + disk_r, cy + disk_r], fill=(*WHITE, 255))

    # 4. Punto azul interior — donut effect.
    dot_r = big * 0.085
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=(*DOT, 255))

    # 5. Downscale a 1024×1024 con Lanczos para AA limpio. Flatten a RGB.
    img = img.convert("RGB")
    img = img.resize((SIZE, SIZE), Image.LANCZOS)

    assert img.size == (SIZE, SIZE) and img.mode == "RGB"

    APPICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_APPICON, "PNG", optimize=True)
    img.save(OUT_PREVIEW, "PNG", optimize=True)

    # Update Contents.json (idempotente).
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

    print(f"✓ AppIcon V3 (rounded petals): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
