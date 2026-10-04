# Handy-landing-page-fe

Landing de muestra y pre-registro de **Handy** (usuarios y especialistas del hogar en Mar del Plata).
Sale en tiendas el 28/10/2026.

- Sitio: https://toti-gauna.github.io/Handy-landing-page-fe/
- Pre-registro (destino del QR): https://toti-gauna.github.io/Handy-landing-page-fe/registro/

## Desarrollo

```sh
npm ci
npm run dev       # http://localhost:5173/Handy-landing-page-fe/
npm run build     # typecheck + build estático en dist/
```

Todo el texto vive en `src/content/*.json`. Las reglas de lenguaje y la estructura están en [CLAUDE.md](CLAUDE.md).

## Demo interactiva (`/demo/`)

Referencia visual de la app (usuario y especialista) con datos ficticios: sin backend, sin cobros y sin guardar nada.

```sh
npm run dev       # http://localhost:5173/Handy-landing-page-fe/demo/?rol=usuario (o ?rol=especialista)
npm test          # lógica de la demo: plata, fechas, agenda, contactos, propuestas y llegada
```

- Modo app (pantalla completa, sin marco): agregá `?app=1` o tocá "Usar como app" en el celular.
- Para presentar: `?ritmo=lento` (modo automático más lento) y `?stand=1` (en bucle).
- Cómo funciona, estados, datos, permisos y fallos: [docs/modulos/demo-interactiva.md](docs/modulos/demo-interactiva.md).

## Deploy

GitHub Actions publica en GitHub Pages en cada push a `main` (`.github/workflows/deploy.yml`).
En el repo: **Settings → Pages → Source: GitHub Actions**.

Para conectar el backend (Handy-landing-page-be), definir la variable de Actions `FORM_ENDPOINT`
(Settings → Secrets and variables → Actions → Variables) con la URL base, sin barra final.
Mientras esté vacía, el registro muestra "Registro habilitado en breve".
