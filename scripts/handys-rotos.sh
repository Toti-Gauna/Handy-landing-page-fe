#!/bin/sh
# Handys "mareados" para los mensajes de error de la demo: misma ilustración, con la cara cambiada
# (ojos en X y boca torcida). La rotura (el personaje partido) y la animación se hacen en CSS.
# Requiere ImageMagick con soporte webp. Las salidas se commitean en src/img/.
set -e
cd "$(dirname "$0")/.."
OUT=${OUT:-src/img}
mkdir -p "$OUT"
B=assets/brand

# x(cx, cy, r, grosor): dos trazos cruzados centrados en (cx, cy).
x() { echo "line $(($1-$3)),$(($2-$3)) $(($1+$3)),$(($2+$3)) line $(($1+$3)),$(($2-$3)) $(($1-$3)),$(($2+$3))"; }

# Lamparita: luz apagada (el amarillo se vuelve gris claro), ojos en X y boca ondulada.
convert $B/handy-lamparita.png \
  -fill 'rgb(248,255,160)' -stroke none \
  -draw "circle 53,127 53,141" -draw "circle 146,130 146,144" -draw "rectangle 84,132 115,150" \
  -fill none -stroke '#111' -strokewidth 5 -draw "stroke-linecap round $(x 53 127 9) $(x 146 130 9)" \
  -strokewidth 4 -draw "stroke-linecap round path 'M 86,146 Q 93,138 100,146 T 114,146'" \
  -region 9x36+96+2 -alpha transparent +region -region 21x22+35+19 -alpha transparent +region -region 19x20+146+21 -alpha transparent +region \
  -modulate 100,18,100 \
  -strip -quality 86 -define webp:alpha-quality=92 "$OUT/handy-lamparita-rota.webp"

# Engranaje: ojos en X, boca en zigzag.
convert $B/handy-engranaje.png \
  -fill 'rgb(48,113,255)' -stroke none \
  -draw "circle 106,82 106,106" -draw "circle 243,82 243,106" -draw "rectangle 150,82 197,108" \
  -fill none -stroke '#0b1220' -strokewidth 8 -draw "stroke-linecap round $(x 106 82 13) $(x 243 82 13)" \
  -strokewidth 6 -draw "stroke-linecap round stroke-linejoin round polyline 152,100 162,92 172,100 182,92 194,100" \
  -strip -quality 86 -define webp:alpha-quality=92 "$OUT/handy-engranaje-roto.webp"

# Caño: el personaje de abajo con ojos en X; la gota triste (ojos abiertos y boca al revés).
convert $B/handy-gota-y-cano.png \
  -fill 'rgb(101,135,255)' -stroke none \
  -draw "circle 251,291 251,302" -draw "circle 300,291 300,302" -draw "rectangle 263,291 286,302" \
  -fill none -stroke '#111' -strokewidth 4 -draw "stroke-linecap round $(x 251 291 6) $(x 300 291 6)" \
  -strokewidth 3 -draw "stroke-linecap round path 'M 266,300 Q 271,295 276,300 T 286,300'" \
  -fill 'rgb(146,206,255)' -stroke none -draw "rectangle 36,249 88,259" -draw "rectangle 49,265 73,277" \
  -fill '#111' -draw "circle 47,256 47,260" -draw "circle 76,256 76,260" \
  -fill none -stroke '#111' -strokewidth 3 -draw "stroke-linecap round path 'M 53,275 Q 61,267 69,275'" \
  -strip -quality 86 -define webp:alpha-quality=92 "$OUT/handy-cano-roto.webp"

# Llave: ojos en X y boca ondulada.
convert $B/handy-llave.png \
  -fill 'rgb(188,188,188)' -stroke none \
  -draw "rectangle 252,302 314,352" -draw "rectangle 409,303 472,354" -draw "rectangle 333,333 392,365" \
  -fill none -stroke '#111' -strokewidth 9 -draw "stroke-linecap round $(x 282 327 17) $(x 441 329 17)" \
  -strokewidth 8 -draw "stroke-linecap round path 'M 334,352 Q 349,338 364,352 T 394,352'" \
  -resize '600x600>' -strip -quality 86 -define webp:alpha-quality=92 "$OUT/handy-llave-rota.webp"

ls -la "$OUT"/handy-*-rot*.webp
