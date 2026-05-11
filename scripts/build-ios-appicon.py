#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

Genera el AppIcon 1024×1024 de Focus (iOS nativo) de forma programática.

Reglas iOS / App Store:
- Tamaño EXACTO 1024×1024 px.
- Modo RGB (sin canal alpha; iOS lo rechaza).
- Sin esquinas redondeadas (iOS aplica la máscara squircle).
- Sin transparencia.

Identidad visual de Focus:
- Fondo: gradiente vertical premium slate → blue (deep navy a cobalt).
- Símbolo: "F" mayúscula blanca, construida con rectángulos redondeados
  para evitar look "Facebook" (que usa "f" minúscula sin gradient).
- Sin acentos extra para mantener legibilidad a 60×60 px.

Output:
- ios-native/Focus/Assets.xcassets/AppIcon.appiconset/AppIcon.png
- docs/assets/focus-app-icon-preview.png  (mismo PNG, para revisar offline)

Uso:
    python3 scripts/build-ios-appicon.py

Requiere Pillow >= 9 (ya viene en muchas instalaciones macOS dev).
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

# Paleta (RGB tuples)
C_TOP = (15, 23, 42)       # #0F172A slate-900 (top, casi negro)
C_MID = (30, 58, 138)      # #1E3A8A blue-900
C_BOTTOM = (59, 130, 246)  # #3B82F6 blue-500 (bottom)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    """Genera un PNG RGB sin alpha con gradiente vertical 3-stop."""
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        if t < 0.5:
            color = lerp(C_TOP, C_MID, t * 2)
        else:
            color = lerp(C_MID, C_BOTTOM, (t - 0.5) * 2)
        draw.line([(0, y), (size, y)], fill=color)
    return img


def draw_letter_f(img: Image.Image) -> None:
    """Dibuja una F blanca centrada con rectángulos redondeados."""
    draw = ImageDraw.Draw(img)

    # Bounding box del F (1024 canvas, padding generoso para safe area iOS)
    # Safe area iOS ≈ 80% del canvas; centramos visualmente compensando
    # que el F es asimétrico (más peso visual a la izquierda).
    f_left = 305
    f_top = 215
    f_height = 600

    # Stem vertical
    stem_w = 130
    stem_box = [f_left, f_top, f_left + stem_w, f_top + f_height]
    draw.rounded_rectangle(stem_box, radius=10, fill=WHITE)

    # Top horizontal bar
    top_bar_w = 460
    top_bar_h = 130
    top_box = [f_left, f_top, f_left + top_bar_w, f_top + top_bar_h]
    draw.rounded_rectangle(top_box, radius=10, fill=WHITE)

    # Middle horizontal bar
    mid_y = f_top + 245
    mid_bar_w = 360
    mid_bar_h = 110
    mid_box = [f_left, mid_y, f_left + mid_bar_w, mid_y + mid_bar_h]
    draw.rounded_rectangle(mid_box, radius=10, fill=WHITE)


def write_contents_json() -> None:
    """Actualiza Contents.json con el filename del PNG generado."""
    contents = {
        "images": [
            {
                "filename": "AppIcon.png",
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
            }
        ],
        "info": {
            "author": "xcode",
            "version": 1,
        },
    }
    with OUT_CONTENTS.open("w", encoding="utf-8") as f:
        json.dump(contents, f, indent=2)
        f.write("\n")


def main() -> int:
    # 1. Generar imagen
    img = build_gradient(SIZE)
    draw_letter_f(img)

    # 2. Validar
    assert img.size == (SIZE, SIZE), f"Tamaño inesperado: {img.size}"
    assert img.mode == "RGB", f"Modo inesperado: {img.mode}"

    # 3. Guardar PNG (RGB → sin alpha)
    APPICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_APPICON, "PNG", optimize=True)
    img.save(OUT_PREVIEW, "PNG", optimize=True)

    # 4. Actualizar Contents.json
    write_contents_json()

    rel_appicon = OUT_APPICON.relative_to(REPO)
    rel_preview = OUT_PREVIEW.relative_to(REPO)
    print(f"✓ AppIcon generado: {rel_appicon}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {rel_preview}")
    print(f"✓ Contents.json actualizado con filename")
    return 0


if __name__ == "__main__":
    sys.exit(main())
