#!/usr/bin/env python3
"""
scripts/build-ios-appicon.py

AppIcon V11 de Focus — Nova diamond con glow sobre cobalto profundo.

Concepto: la app es Focus pero su identidad VISIBLE más fuerte adentro es
Nova, el asistente. Si el AppIcon mostrara algo distinto del símbolo Nova
(antes era un engranaje), el usuario percibía dos productos diferentes
entre el home screen y la app abierta. V11 unifica: mismo diamante Nova
que aparece en FocusBar, Nova chat, Nova Live → ahora también en el icono.

V11 vs V10 (engranaje 6-dientes):
- V10 era el "engranaje del pensamiento". Funcionaba como concepto pero
  competía con el rombo Nova que se ve adentro. Resultado: identidad
  fragmentada (engranaje afuera, diamante adentro).
- V11 muestra el rombo Nova directo. El squircle iOS sigue dando la
  "presencia Focus" institucional; el símbolo del rombo Nova adentro es
  el mismo que el usuario ve cuando abre la app.

Composición (todo proporcional al canvas 1024):
- Fondo: gradient diagonal multi-stop (electric cobalt → focus blue →
  deep navy → toque violeta indigo). El stop violeta inferior conecta
  con el gradient Nova interno y agrega profundidad sin caer en pared
  morada.
- Halo radial blanco/azul-hielo central — luz que envuelve el diamante.
  No es target/crosshair: la transición es suave y se difumina antes
  del borde.
- Nova diamond blanco (rombo vertical proporción 0.62:1, igual que
  NovaSparkMark en SwiftUI). Tinte ice-blue muy sutil en la mitad
  inferior — da volumen sin parecer joya.
- Highlight superior del diamante: arista superior ligeramente más
  brillante para que se lea como volumen, no plano.

Reglas iOS: 1024×1024 RGB sin alpha · sin transparencia.

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
SS = 4  # supersampling para suavizar bordes del diamante

# Paleta Focus (cobalto profundo + violet hint) — la misma del
# `FocusLogoMark.defaultGradient` SwiftUI.
C_TOP_LEFT  = (59, 130, 246)    # #3B82F6 electric cobalt
C_MID_HIGH  = (37, 99, 235)     # #2563EB focus blue
C_MID_LOW   = (24, 47, 130)     # #182F82 deep navy
C_BOT_RIGHT = (46, 33, 133)     # #2E2185 indigo violet

WHITE = (255, 255, 255)
ICE_BLUE = (236, 245, 255)      # #ECF5FF tinte del rombo


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lerp_multi(stops, t):
    """Interpola sobre N stops {(t_i, color_i)}, lineal entre adyacentes."""
    if t <= stops[0][0]:
        return stops[0][1]
    if t >= stops[-1][0]:
        return stops[-1][1]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            tt = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return lerp(c0, c1, tt)
    return stops[-1][1]


def build_diagonal_gradient(size: int) -> Image.Image:
    """Gradient diagonal multi-stop (TL → BR) con 4 paradas."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    # Stops a lo largo de la diagonal:
    stops = [
        (0.00, C_TOP_LEFT),
        (0.40, C_MID_HIGH),
        (0.85, C_MID_LOW),
        (1.00, C_BOT_RIGHT),
    ]
    diag = math.sqrt(2.0)  # longitud normalizada de la diagonal del cuadrado
    for y in range(size):
        for x in range(size):
            # Proyección de (x, y) sobre la diagonal TL→BR.
            t = ((x + y) / (2.0 * (size - 1)))  # 0 en TL, 1 en BR
            px[x, y] = lerp_multi(stops, t)
    return img


def apply_radial_halo(base: Image.Image, size: int) -> None:
    """Añade un halo radial blanco/azul-hielo en el centro, MUTATING `base`.
    Se compone sobre el RGB con peso alpha decreciente desde el centro.
    """
    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hdraw = halo.load()
    cx = cy = size / 2
    radius = size * 0.46  # radio máximo del halo
    for y in range(size):
        dy = y - cy
        for x in range(size):
            dx = x - cx
            dist = math.sqrt(dx * dx + dy * dy)
            t = dist / radius
            if t >= 1.0:
                continue
            # ease-out cuadrático: más brillante cerca del centro, fade rápido.
            alpha = (1.0 - t) ** 2
            # Tinte: blanco fuerte cerca del centro, ice-blue tibio hacia el borde.
            mix = 1.0 - t
            r = int(255 * mix + 200 * (1 - mix))
            g = int(255 * mix + 220 * (1 - mix))
            b = int(255 * mix + 240 * (1 - mix))
            # Intensidad del halo (max ~0.34 en el centro).
            a = int(255 * 0.34 * alpha)
            hdraw[x, y] = (r, g, b, a)
    base.paste(halo.convert("RGBA"), (0, 0), halo)


def draw_nova_diamond(canvas: Image.Image, size: int) -> None:
    """Dibuja el rombo Nova centrado con glow azul-hielo alrededor,
    cuerpo blanco con leve tinte vertical (top brillante, base ice-blue
    sutil para dar volumen), y aristas anti-aliased.

    Estrategia limpia (sin layered triangles que generaban bandas):
    1. Glow exterior: rombo más grande, blue-ice translúcido, blureado.
    2. Cuerpo del rombo: máscara del polígono + RGB de un gradient
       vertical pre-renderizado → compose con la máscara para que la
       transición sea continua (no escalonada).
    3. Borde superior con highlight blanco difuso (un único path
       anti-aliased, no dots).
    """
    diamond_height = size * 0.46
    diamond_width = diamond_height * 0.62
    cx = size / 2
    cy = size / 2

    top    = (cx, cy - diamond_height / 2)
    right  = (cx + diamond_width / 2, cy)
    bottom = (cx, cy + diamond_height / 2)
    left   = (cx - diamond_width / 2, cy)

    # ── 1. GLOW EXTERIOR (debajo del rombo) ──────────────────────────
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_scale = 1.22
    g_h = diamond_height * g_scale
    g_w = diamond_width * g_scale
    g_draw.polygon(
        [
            (cx, cy - g_h / 2),
            (cx + g_w / 2, cy),
            (cx, cy + g_h / 2),
            (cx - g_w / 2, cy),
        ],
        fill=(150, 195, 255, 145),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.032))
    canvas.paste(glow, (0, 0), glow)

    # ── 2. CUERPO DEL ROMBO con gradient suave ──────────────────────
    # 2a. Pre-renderizamos un gradient vertical blanco → ice-blue muy
    #     sutil dentro de un canvas del tamaño exacto del bounding box
    #     del rombo, NO del canvas completo. Esto evita bandas porque
    #     interpolamos por píxel, no por capas.
    bbox_left   = int(left[0])
    bbox_top    = int(top[1])
    bbox_right  = int(right[0]) + 1
    bbox_bottom = int(bottom[1]) + 1
    bbox_w = bbox_right - bbox_left
    bbox_h = bbox_bottom - bbox_top

    body_grad = Image.new("RGB", (bbox_w, bbox_h), WHITE)
    bg_px = body_grad.load()
    # Stops del cuerpo: top blanco puro, mid muy leve ice, bottom ice
    # tibio pero igual muy cerca de blanco. La diferencia es chica a
    # propósito — exceso de tinte hace que el rombo se vea "azulado"
    # en vez de "blanco con vida".
    stops = [
        (0.00, WHITE),
        (0.50, (250, 252, 255)),
        (1.00, (224, 236, 252)),
    ]
    for j in range(bbox_h):
        t = j / max(1, bbox_h - 1)
        color = lerp_multi(stops, t)
        for i in range(bbox_w):
            bg_px[i, j] = color

    # 2b. Máscara del rombo (alfa 1 dentro del polígono, 0 afuera). PIL
    #     anti-aliasea la frontera del polígono → bordes suaves al
    #     downscaler.
    mask = Image.new("L", (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.polygon([top, right, bottom, left], fill=255)

    # 2c. Compose: rombo gradient + máscara → canvas.
    body_rgba = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    body_rgba.paste(body_grad, (bbox_left, bbox_top))
    # Aplicamos la máscara para recortar al rombo.
    body_rgba.putalpha(mask)
    canvas.paste(body_rgba, (0, 0), body_rgba)

    # ── 3. HIGHLIGHT SUPERIOR — fina luz blanca sobre las aristas TL+TR
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hl_draw = ImageDraw.Draw(hl)
    # Triángulo superior interno: del top hacia un punto medio del
    # diamante, blanco con alpha gradient (más brillante arriba).
    hl_inner_h = diamond_height * 0.55  # ocupa la mitad superior + un poco
    hl_inner_w = diamond_width * 0.85   # un poco más angosto que el rombo
    hl_top    = (cx, cy - diamond_height / 2 + size * 0.005)
    hl_left   = (cx - hl_inner_w / 2, cy - diamond_height / 2 + hl_inner_h * 0.55)
    hl_right  = (cx + hl_inner_w / 2, cy - diamond_height / 2 + hl_inner_h * 0.55)
    hl_draw.polygon([hl_top, hl_right, hl_left], fill=(255, 255, 255, 70))
    hl = hl.filter(ImageFilter.GaussianBlur(radius=size * 0.018))
    canvas.paste(hl, (0, 0), hl)


def main() -> int:
    big = SIZE * SS

    # 1. Fondo gradient (RGB).
    bg = build_diagonal_gradient(big).convert("RGBA")

    # 2. Halo radial al centro.
    apply_radial_halo(bg, big)

    # 3. Nova diamond + glow + highlight.
    draw_nova_diamond(bg, big)

    # 4. Downscale con LANCZOS.
    final = bg.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)

    assert final.size == (SIZE, SIZE) and final.mode == "RGB"

    APPICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT_APPICON, "PNG", optimize=True)
    final.save(OUT_PREVIEW, "PNG", optimize=True)

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

    print(f"✓ AppIcon V11 (Nova diamond): {OUT_APPICON.relative_to(REPO)}")
    print(f"  {SIZE}×{SIZE} RGB · sin alpha · {OUT_APPICON.stat().st_size // 1024}KB")
    print(f"✓ Preview: {OUT_PREVIEW.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
