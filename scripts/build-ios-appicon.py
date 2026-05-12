#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V8 de Focus — engranaje compacto, MUCHO más aire alrededor,
núcleo más prominente, anillo finísimo. Mantiene la misma identidad
del FocusLogoMark (sistema/mecanismo mental) pero con escala premium
para launcher: ~60% del canvas en vez de ~98%.

V8 vs V7:
- V7 tenía el engranaje ocupando casi todo el canvas → leía como
  "rueda gigante" y se sentía target-y a tamaño pequeño.
- V8 reduce la escala a 0.60 y deja ~20% de margen cobalto a cada
  lado. El símbolo se siente intencional y centrado, no llenando el
  cuadrado. Anillo más fino, núcleo más visible. 6 dientes pero
  proporcionalmente más pequeños — ya no domina la lectura de "rueda".

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
SS = 4  # supersampling factor para suavizar bordes

# Paleta cobalt — Focus identity (mismo gradient que el FocusLogoMark
# SwiftUI: #2E4FE8 → #182F82).
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


def polar(center: tuple, radius: float, angle: float) -> tuple:
    """Punto polar (cx + r·cosθ, cy + r·sinθ)."""
    return (
        center[0] + math.cos(angle) * radius,
        center[1] + math.sin(angle) * radius,
    )


def draw_gear_tooth(img: Image.Image, size: int, center: tuple,
                     inner_r: float, outer_r: float, angle: float,
                     half_width: float, alpha: int = 245) -> None:
    """Dibuja UN diente como sector anular con bordes redondeados.

    El diente se compone de: arco interno (inner_r) + arco externo (outer_r)
    + dos lados radiales. PIL no tiene primitiva directa, así que armamos
    el path con polygon + dos discos pequeños en los corners para suavizar.
    """
    left_angle = angle - half_width
    right_angle = angle + half_width

    # 4 esquinas del sector (no curvado).
    p1 = polar(center, inner_r, left_angle)
    p2 = polar(center, outer_r, left_angle)
    p3 = polar(center, outer_r, right_angle)
    p4 = polar(center, inner_r, right_angle)

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    fill = (255, 255, 255, alpha)

    # Polígono base — sector trapezoide.
    ov_draw.polygon([p1, p2, p3, p4], fill=fill)

    # Arco externo (pieslice diferencia para añadir la curva). Aproximación:
    # rellenar la región del arco con un pieslice del círculo grande,
    # menos un pieslice del círculo pequeño.
    # Más simple: usar pieslice sobre el círculo outer y ANDearlo con la
    # banda angular usando una máscara.
    # Pragmático: dibujar pieslice del outer y pieslice del inner del mismo
    # rango angular. El outer rellena la "esquina" curva del diente.
    bbox_outer = [
        center[0] - outer_r, center[1] - outer_r,
        center[0] + outer_r, center[1] + outer_r,
    ]
    ov_draw.pieslice(
        bbox_outer,
        start=math.degrees(left_angle),
        end=math.degrees(right_angle),
        fill=fill,
    )
    # Restamos la zona interna pintándola con transparente. Para hacerlo
    # con PIL, recreamos overlay con alpha y restamos via paste de inner.
    inner_bbox = [
        center[0] - inner_r, center[1] - inner_r,
        center[0] + inner_r, center[1] + inner_r,
    ]
    ov_draw.pieslice(
        inner_bbox,
        start=math.degrees(left_angle),
        end=math.degrees(right_angle),
        fill=(0, 0, 0, 0),
    )

    img.paste(overlay, (0, 0), overlay)


def draw_ring(img: Image.Image, size: int, center: tuple,
              radius: float, thickness: float,
              color=WHITE, alpha: int = 245) -> None:
    """Anillo (stroke circle) — círculo grande - círculo pequeño concéntrico."""
    cx, cy = center
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    fill = (color[0], color[1], color[2], alpha)
    # Dibujar contorno con grosor usando ellipse outline. width param de PIL.
    ov_draw.ellipse(bbox, outline=fill, width=int(thickness))
    img.paste(overlay, (0, 0), overlay)


def draw_disk(img: Image.Image, size: int, center: tuple,
              radius: float, color=WHITE, alpha: int = 255) -> None:
    """Disco sólido."""
    cx, cy = center
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.ellipse(bbox, fill=(color[0], color[1], color[2], alpha))
    img.paste(overlay, (0, 0), overlay)


def main() -> int:
    big = SIZE * SS
    img = build_gradient(big).convert("RGBA")

    center = (big / 2, big / 2)

    # Proporciones V8 — engranaje compacto al 60% del canvas. ~20% de
    # margen cobalto a cada lado. El símbolo se siente intencional, no
    # "lleno hasta el borde". Anillo finísimo, núcleo prominente.
    #
    # Las proporciones que siguen son relativas al CANVAS completo, no
    # al símbolo. Para un símbolo ~60% del canvas, el tooth_outer
    # (radio externo del diente, también el radio del símbolo completo)
    # vale 0.30 (60% diámetro / 2 = 30% radio).
    body_radius = big * 0.20         # anillo más interno
    tooth_inner = big * 0.22         # base del diente, justo afuera del anillo
    tooth_outer = big * 0.30         # punta del diente = límite externo del símbolo
    tooth_count = 6
    tooth_half_width = math.pi / tooth_count * 0.50  # ancho angular moderado
    ring_stroke = big * 0.035        # anillo MUY fino → no compite con núcleo
    nucleus_radius = big * 0.085     # núcleo prominente — corazón del símbolo

    # 6 dientes radiales — primer diente arriba (-π/2), luego cada 60°.
    for i in range(tooth_count):
        angle = -math.pi / 2 + (2 * math.pi / tooth_count) * i
        draw_gear_tooth(
            img, big, center,
            inner_r=tooth_inner,
            outer_r=tooth_outer,
            angle=angle,
            half_width=tooth_half_width,
            alpha=245,
        )

    # Anillo del cuerpo del engranaje.
    draw_ring(img, big, center, radius=body_radius, thickness=ring_stroke)

    # Núcleo blanco sólido — el "punto" que sostiene el sistema.
    draw_disk(img, big, center, radius=nucleus_radius, color=WHITE)

    # Downscale con LANCZOS para suavizar bordes (SS = 4).
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

    print(f"✓ AppIcon V8 (engranaje compacto): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
