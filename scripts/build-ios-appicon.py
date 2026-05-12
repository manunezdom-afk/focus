#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V9 de Focus — "Pilas asimétricas" + acento Nova.

Concepto abstracto de pensamiento organizado: 3 barras horizontales
redondeadas, de anchos distintos, en posiciones asimétricas. Lectura:
"orden mental, foco intencional, sistema de prioridades". Plus un dot
cyan accent arriba a la derecha que sugiere la capa Nova (chispa de
inteligencia).

V9 vs V8/V7:
- V7/V8 eran engranaje + núcleo concéntrico → el usuario lo leía como
  "rueda / target / engranaje literal" aunque se hiciera más pequeño.
  La forma circular era el problema, no el tamaño.
- V9 ABANDONA la geometría circular. Solo 3 barras horizontales
  asimétricas (anchos y posiciones distintos). Cero círculos en el
  símbolo principal — solo un dot accent muy pequeño arriba a la
  derecha. Imposible leerlo como wheel/gear/target.

Composición (todo en proporciones del canvas 1024):
- Barra 1 (superior, larga, alineada a la izquierda).
- Barra 2 (medio, corta, alineada a la derecha).
- Barra 3 (inferior, media, alineada a la izquierda).
- Cada barra con corner radius alto para sentir premium.
- Dot accent Nova (cyan): chico, arriba-derecha, fuera de la zona de
  las barras — refuerza la "capa Nova" sin saturar.

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
SS = 4  # supersampling para suavizar bordes

# Paleta Focus (cobalto profundo).
C_TOP = (46, 79, 232)        # #2E4FE8 cobalto vivo
C_BOTTOM = (24, 47, 130)     # #182F82 azul profundo
WHITE = (255, 255, 255)
ACCENT_CYAN = (130, 200, 255)   # accent Nova (chispa)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), C_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=lerp(C_TOP, C_BOTTOM, t))
    return img


def draw_rounded_pill(img: Image.Image, size: int, x: float, y: float,
                       w: float, h: float, color=WHITE, alpha: int = 255) -> None:
    """Rectángulo con esquinas REDONDEADAS al máximo (pill) — radio = h/2."""
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    fill = (color[0], color[1], color[2], alpha)
    radius = h / 2  # full pill
    ov_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=fill,
    )
    img.paste(overlay, (0, 0), overlay)


def draw_disk(img: Image.Image, size: int, cx: float, cy: float,
              radius: float, color=WHITE, alpha: int = 255) -> None:
    """Disco sólido (para el accent dot Nova)."""
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

    # Proporciones de las 3 barras (todo relativo al canvas, supersampled).
    # Las barras viven en un "área de marca" centrada de ~62% del canvas.
    # Eso deja ~19% de margen cobalto a cada lado — premium, intencional.
    #
    # Layout (asimétrico, "no es un menú hamburguesa simétrico"):
    #   ▰▰▰▰▰▰▰▰▰      ← barra 1: ancho 58%, alineada izquierda
    #             ▰▰▰▰▰  ← barra 2: ancho 38%, alineada derecha
    #     ▰▰▰▰▰▰▰        ← barra 3: ancho 48%, alineada izquierda (offset)
    #
    # Altura de cada barra ~9% del canvas. Spacing vertical entre barras
    # ~5% del canvas. Total alto del bloque ~37% del canvas → centrado.

    bar_h = big * 0.090
    gap_y = big * 0.060

    block_height = 3 * bar_h + 2 * gap_y
    block_top = (big - block_height) / 2

    # Barra 1: superior, larga, izquierda.
    b1_w = big * 0.58
    b1_x = big * 0.19
    b1_y = block_top
    draw_rounded_pill(img, big, b1_x, b1_y, b1_w, bar_h)

    # Barra 2: medio, corta, derecha — crea asimetría dinámica.
    b2_w = big * 0.38
    b2_x = big - big * 0.19 - b2_w   # alineada a la derecha respeto al margen
    b2_y = block_top + bar_h + gap_y
    draw_rounded_pill(img, big, b2_x, b2_y, b2_w, bar_h)

    # Barra 3: inferior, media, izquierda — visualmente "vuelve".
    b3_w = big * 0.48
    b3_x = big * 0.19
    b3_y = block_top + 2 * (bar_h + gap_y)
    draw_rounded_pill(img, big, b3_x, b3_y, b3_w, bar_h)

    # Accent dot Nova — pequeño, arriba a la derecha, fuera del bloque
    # de barras. Sugiere "capa inteligente" sin saturar la lectura.
    dot_radius = big * 0.030
    dot_cx = big * 0.78
    dot_cy = block_top - big * 0.06
    # Halo apenas perceptible (alpha bajo).
    draw_disk(img, big, dot_cx, dot_cy, dot_radius * 1.8,
              color=ACCENT_CYAN, alpha=55)
    # Dot principal sólido cyan.
    draw_disk(img, big, dot_cx, dot_cy, dot_radius, color=ACCENT_CYAN)

    # Downscale con LANCZOS para suavizar bordes.
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

    print(f"✓ AppIcon V9 (pilas asimétricas + Nova accent): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
