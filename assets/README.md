# Assets de Handy

PNG sin fondo, recortadas de los diseños de Figma (referencia visual).

- `brand/`: logo y Handys (gota y caño, lamparita, llave, engranaje y grupo).
- `fotos/usuario/`: pantallas de la app de usuario. Las composiciones con varios celulares también están separadas en `-1`, `-2`, `-3`.
- `fotos/especialista/`: pantallas de la app del especialista, numeradas en el orden del flujo.
- `video/`: trailers comprimidos (menos de 25 MB cada uno) y sus portadas.

Ojo: las pantallas están en inglés, en dólares y muestran "Mechanic". Son referencia visual: la landing las recrea en HTML con el contenido corregido (español, pesos, seis rubros).

## Videos

Para publicar un trailer: copiá el `.mp4` y su portada (`.webp` o `.jpg`) en `video/` y completá `trailer.video` y `trailer.poster`
en `src/content/inicio.json` (usuario) o `src/content/especialistas.json` (especialista), por ejemplo `"assets/video/trailer-usuario.mp4"`.
La landing usa `<video preload="none">` con poster, así no se descarga hasta que le dan play.
