#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V10 de Focus — engranaje del pensamiento + núcleo focal.

Concepto: Focus viene de "enfocarse", "pensar", "concentrarse". El
engranaje (rueda dentada) comunica MECANISMO MENTAL, sistema que piensa.
El núcleo sólido central es el PUNTO FOCAL — la concentración. Juntos:
"sistema mental enfocado".

V10 vs V9 (3 pilas asimétricas):
- V9 era abstracto, leía como "lista" o "menú". No comunicaba el
  concepto de Focus = concentración.
- V10 vuelve al engranaje pero ahora MATCHEA el `FocusLogoMark`
  SwiftUI que ya se ve dentro de la app (BootView, Login, Onboarding,
  Ajustes footer). Antes había 2 iconos distintos:
  · AppIcon en home iPhone → 3 barras (V9).
  · FocusLogoMark dentro de la app → engranaje 6 dientes.
  Ahora son el MISMO símbolo — coherencia visual end-to-end.

Composición (todo proporcional al canvas 1024):
- Fondo: gradient cobalto vivo → azul profundo (paleta Focus).
- Engranaje blanco centrado:
  · 6 dientes redondeados radiales.
  · Cuerpo anular (stroked) que une los dientes.
- Núcleo blanco sólido central — el "focus point".

Geometría idéntica a FocusGearMark.swift (en proporciones del frame del
engranaje, que ocupa 56% del canvas):
- bodyRadius  = frame * 0.30   (radio del anillo del cuerpo)
- toothInner  = frame * 0.36   (base del diente, donde sale del cuerpo)
- toothOuter  = frame * 0.49   (punta del diente)
- bodyStroke  = frame * 0.075  (grosor del anillo)
- toothHalfWidth = π/6 * 0.45  (radianes; 6 dientes equiespaciados)

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
SS = 4  # supersampling para suavizar bordes

# Paleta Focus (cobalto profundo) — misma que el FocusLogoMark Swift.
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


def polar(cx: float, cy: float, radius: float, angle_rad: float):
    """Punto cartesiano desde polares — angle 0 = derecha, π/2 = abajo (CG)."""
    return (cx + math.cos(angle_rad) * radius, cy + math.sin(angle_rad) * radius)


def draw_gear_tooth(draw_alpha: ImageDraw.ImageDraw, cx: float, cy: float,
                     angle: float, half_width: float,
                     inner_r: float, outer_r: float, color=(255, 255, 255, 255)):
    """Dibuja UN diente del engranaje como polígono trapezoidal radial.

    El diente arranca en el anillo interior (toothInner) y se extiende
    hasta toothOuter. Es un trapezoide con dos lados radiales (left,right)
    y dos arcos (tangentes al inner y outer). Para suavizar PIL no tiene
    addArc — aproximamos cada arco con varios puntos.
    """
    left = angle - half_width
    right = angle + half_width
    # Aproximación del arco con N puntos.
    n_arc = 8
    points = []
    # Lado izquierdo: del inner al outer (radial).
    points.append(polar(cx, cy, inner_r, left))
    points.append(polar(cx, cy, outer_r, left))
    # Arco externo: de left a right (puntos a lo largo del arco).
    for i in range(1, n_arc):
        t = i / n_arc
        a = left + (right - left) * t
        points.append(polar(cx, cy, outer_r, a))
    points.append(polar(cx, cy, outer_r, right))
    # Lado derecho: del outer al inner.
    points.append(polar(cx, cy, inner_r, right))
    # Arco interno (volver desde right a left por dentro).
    for i in range(1, n_arc):
        t = i / n_arc
        a = right - (right - left) * t
        points.append(polar(cx, cy, inner_r, a))
    draw_alpha.polygon(points, fill=color)


def draw_ring(draw_alpha: ImageDraw.ImageDraw, cx: float, cy: float,
              radius: float, stroke: float, color=(255, 255, 255, 255)):
    """Anillo: outer ellipse - inner ellipse (truco de PIL)."""
    outer = radius + stroke / 2
    inner = radius - stroke / 2
    # Outer fill.
    draw_alpha.ellipse(
        [cx - outer, cy - outer, cx + outer, cy + outer],
        fill=color
    )
    # Inner hole (transparente). Cuando lo paste-amos al canvas, este
    # hueco se respeta porque el overlay es RGBA.
    draw_alpha.ellipse(
        [cx - inner, cy - inner, cx + inner, cy + inner],
        fill=(0, 0, 0, 0)
    )


def main() -> int:
    big = SIZE * SS
    img = build_gradient(big).convert("RGBA")

    # Overlay para dibujar el engranaje (necesario para mezclar polígonos
    # de dientes + anillo + núcleo manteniendo transparencias correctas).
    overlay = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)

    # Geometría del engranaje — mismas proporciones que `FocusGearMark` Swift.
    # gear_frame_diameter es el "frame" virtual donde vive el engranaje
    # (size.width en el Canvas SwiftUI).
    gear_frame_diameter = big * 0.56  # ~57% del canvas
    cx = big / 2
    cy = big / 2

    body_radius = gear_frame_diameter * 0.30
    tooth_inner = gear_frame_diameter * 0.36
    tooth_outer = gear_frame_diameter * 0.49
    body_stroke = gear_frame_diameter * 0.075

    n_teeth = 6
    tooth_half_width = (math.pi / n_teeth) * 0.45  # radianes

    # 6 dientes equiespaciados, empezando arriba (-π/2 en coordinate de
    # PIL es "arriba"... pero PIL Y crece hacia abajo. En Canvas SwiftUI
    # `-π/2` es arriba porque Y crece hacia abajo en CGContext también.
    # Mantenemos consistencia con SwiftUI.).
    for i in range(n_teeth):
        angle = -math.pi / 2 + (2 * math.pi / n_teeth) * i
        draw_gear_tooth(
            odraw, cx, cy, angle, tooth_half_width,
            tooth_inner, tooth_outer,
            color=(WHITE[0], WHITE[1], WHITE[2], 242)  # 0.95 alpha como Swift
        )

    # Cuerpo: anillo strokeado.
    draw_ring(odraw, cx, cy, body_radius, body_stroke,
              color=(WHITE[0], WHITE[1], WHITE[2], 242))

    # Núcleo central — Círculo blanco sólido, "focus point". Diámetro
    # 16% del canvas (igual que FocusLogoMark Swift).
    core_radius = (big * 0.16) / 2
    odraw.ellipse(
        [cx - core_radius, cy - core_radius, cx + core_radius, cy + core_radius],
        fill=(WHITE[0], WHITE[1], WHITE[2], 255)
    )

    img.paste(overlay, (0, 0), overlay)

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

    print(f"✓ AppIcon V10 (engranaje del pensamiento): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
