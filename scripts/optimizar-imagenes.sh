#!/bin/sh
# Genera las versiones webp que usa la landing a partir de assets/brand (PNG).
# Requiere ImageMagick con soporte webp. Las salidas se commitean en src/img/.
set -e
cd "$(dirname "$0")/.."
OUT=src/img
mkdir -p "$OUT"

for f in handy-engranaje handy-lamparita handy-llave handys-grupo; do
  convert "assets/brand/$f.png" -strip -resize '600x600>' -quality 82 -define webp:alpha-quality=90 "$OUT/$f.webp"
done

# Wordmark "Handy" sin la bajada en inglés: la bajada se escribe en HTML ("Soluciones, no problemas").
convert assets/brand/logo-handy.png -crop 1106x196+0+0 +repage -trim -strip -resize '720x>' -quality 90 "$OUT/logo-handy.webp"

# Favicon / ícono a partir de la gota.
convert assets/brand/handy-gota-y-cano.png -crop 130x190+0+190 +repage -trim -strip -background none -gravity center -extent 200x200 -resize 192x192 "$OUT/icono.png"



# Gota y caño por separado, para animar la gota cayendo del caño.
convert assets/brand/handy-gota-y-cano.png -crop 130x210+0+190 +repage -trim -strip -quality 85 "$OUT/handy-gota.webp"
convert assets/brand/handy-gota-y-cano.png -region 135x215+0+190 -alpha transparent +region -strip -quality 85 "$OUT/handy-cano.webp"
sh scripts/handys-rotos.sh
ls -la "$OUT"
