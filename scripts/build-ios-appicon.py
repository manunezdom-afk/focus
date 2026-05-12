#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V6 de Focus — "F" geométrica blanca + dot de "pensamiento"
en cobalto. El usuario rechazó las versiones tipo target/círculo
concéntrico (V5) y pidió algo más cercano a "pensar / mecanismo
mental / organización", no un crosshair de meditación genérica.

V6 vs V5:
- V5 eran 2 anillos + núcleo → leía como target/crosshair. El usuario
  lo rechazó múltiples veces.
- V6 es "F" geométrica + dot accent → letra de marca + chispa de
  intelición. Bold, simple, App Store-ready, no se confunde con apps
  de meditación.

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
# Dot de "pensamiento" — accent cyan brillante para diferenciarlo del
# blanco de la F. Sugiere "señal viva / chispa mental".
ACCENT = (110, 200, 255)     # #6EC8FF cyan claro vivo


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(C_TOP, C_BOTTOM, t))
    return img


def draw_rounded_rect(img: Image.Image, size: int, x: float, y: float,
                       w: float, h: float, radius: float,
                       color=WHITE, alpha: int = 255) -> None:
    """Rectángulo con esquinas redondeadas, alpha exacto."""
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    fill = (color[0], color[1], color[2], alpha)
    ov_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=fill,
    )
    img.paste(overlay, (0, 0), overlay)


def draw_disk(img: Image.Image, size: int, cx: float, cy: float,
              radius: float, color=WHITE, alpha: int = 255) -> None:
    """Disco sólido en posición arbitraria."""
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    fill = (color[0], color[1], color[2], alpha)
    ov_draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=fill,
    )
    img.paste(overlay, (0, 0), overlay)


def main() -> int:
    big = SIZE * SS
    img = build_gradient(big).convert("RGBA")

    # === Construcción de la "F" geométrica ===
    # Centrada horizontalmente, ligeramente arriba del centro vertical
    # para dejar aire abajo. Bordes redondeados premium.
    #
    # Bounding box conceptual de la F: ~52% del canvas en altura,
    # ancho de ~40% (el F tiene espacio negativo a la derecha).
    # Stem (palo vertical): 16% del canvas en ancho.
    # Bars: top = 38% canvas wide, middle = 30% canvas wide.
    # Todo con corner radius redondeado para sentirse premium, no rígido.

    # Centro: dejamos espacio para el dot accent arriba-derecha, así que
    # la F va un poco a la izquierda del centro absoluto.
    f_center_x = big * 0.46
    f_center_y = big * 0.50

    stem_w = big * 0.13
    stem_h = big * 0.52
    bar_top_w = big * 0.36
    bar_top_h = big * 0.13
    bar_mid_w = big * 0.28
    bar_mid_h = big * 0.12
    radius_stem = big * 0.05
    radius_bar = big * 0.05

    stem_x = f_center_x - stem_w / 2
    stem_y = f_center_y - stem_h / 2
    # Stem
    draw_rounded_rect(img, big, stem_x, stem_y, stem_w, stem_h,
                      radius=radius_stem, color=WHITE)
    # Top bar — empieza al lado izquierdo del stem, se extiende a la derecha.
    bar_top_x = stem_x
    bar_top_y = stem_y
    draw_rounded_rect(img, big, bar_top_x, bar_top_y,
                      bar_top_w, bar_top_h,
                      radius=radius_bar, color=WHITE)
    # Middle bar — un poco más corta que el top bar, posicionada al
    # ~38% de la altura del stem.
    bar_mid_x = stem_x
    bar_mid_y = stem_y + stem_h * 0.36
    draw_rounded_rect(img, big, bar_mid_x, bar_mid_y,
                      bar_mid_w, bar_mid_h,
                      radius=radius_bar, color=WHITE)

    # === Accent dot — "chispa de pensamiento" ===
    # Posicionado arriba-derecha de la F, fuera del bounding box principal,
    # como un indicador "viva / inteligente". Cyan vivo para contrastar.
    dot_radius = big * 0.055
    dot_cx = bar_top_x + bar_top_w + big * 0.08
    dot_cy = bar_top_y + bar_top_h * 0.35
    # Aura sutil del dot (glow).
    draw_disk(img, big, dot_cx, dot_cy, dot_radius * 1.7,
              color=ACCENT, alpha=60)
    # Dot principal sólido.
    draw_disk(img, big, dot_cx, dot_cy, dot_radius, color=ACCENT)
    # Highlight blanco interior para sensación premium.
    draw_disk(img, big, dot_cx - dot_radius * 0.25, dot_cy - dot_radius * 0.25,
              dot_radius * 0.35, color=WHITE, alpha=200)

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

    print(f"✓ AppIcon V6 (F + dot): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
