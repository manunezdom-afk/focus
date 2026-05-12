#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V7 de Focus — engranaje minimalista + núcleo blanco sobre
cobalto. Replica fielmente el `FocusGearMark` SwiftUI que la app usa en
onboarding y headers internos. Una sola identidad: launcher = onboarding
= header.

V7 vs V6:
- V6 era "F geométrica + dot cyan" → identidad inconsistente: el launcher
  era una F y la app interna usaba engranaje. Lectura: dos brands.
- V7 es el MISMO engranaje del FocusLogoMark — 6 lóbulos redondeados
  radiales + anillo del cuerpo + núcleo central blanco. Lectura
  unificada: sistema/mecanismo de pensamiento. Premium, App Store-ready,
  no se confunde con app de meditación ni con target/crosshair.

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

    # Proporciones — refinadas vs. el FocusGearMark SwiftUI para que el
    # AppIcon se sienta más "engranaje" y menos "bullseye/target". Los
    # cambios: anillo más fino, núcleo más prominente, dientes más anchos
    # y largos que dominan visualmente. La identidad sigue siendo la
    # misma; solo está más balanceada para tamaño pequeño de launcher.
    body_radius = big * 0.32         # anillo medio
    tooth_inner = big * 0.34         # casi tocando el anillo (sin gap)
    tooth_outer = big * 0.51         # más largo
    tooth_count = 6
    tooth_half_width = math.pi / tooth_count * 0.55  # más ancho angular
    ring_stroke = big * 0.055        # más fino → menos target
    nucleus_radius = big * 0.13      # más prominente → identidad pop

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

    print(f"✓ AppIcon V7 (engranaje + núcleo): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
