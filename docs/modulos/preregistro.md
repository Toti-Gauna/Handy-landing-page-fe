# Pre-registro · conexión con el backend

Estado: la landing cumple el contrato de captura de `Handy-landing-page-be` (Fase 1: `docs/openapi.json`, `docs/capture.md`, `docs/contract-delta.md` → "Captura"). Mientras `FORM_ENDPOINT` esté vacío, la página muestra "Registro habilitado en breve" y no hace pedidos.

Los avisos de privacidad vigentes en el BE son **borradores provisionales** (sin revisión legal; el 04-A todavía nombra proveedores y deja el país sin completar). El BE en producción los rechaza (`503`) salvo `PRIVACY_NOTICE_PROVISIONAL_OK=true`. En la landing esos textos están marcados `"estado": "PENDIENTE"`.

## Configuración

Solo variables **públicas** (todo lo que lleva el prefijo `VITE_` queda dentro del JavaScript publicado; no poner secretos).

| Dónde | Variable | Valor |
|---|---|---|
| GitHub (Settings → Secrets and variables → Actions → Variables) | `FORM_ENDPOINT` | URL pública del backend, sin barra final |
| Local o build (`.env.local`, ver `.env.example`) | `VITE_FORM_ENDPOINT` | Ídem |
| Local o build | `VITE_BASE` | Ruta base del sitio. Vacía = `/Handy-landing-page-fe/` (GitHub Pages). `/` = raíz de un dominio (Hostinger) |

`src/config.ts` lee `VITE_FORM_ENDPOINT` en el build. Con valor, el formulario se habilita y se pide el contador. El origen de la landing tiene que estar en `PUBLIC_ALLOWED_ORIGINS` del BE (si no, `403 origen_no_permitido`).

## Cuerpo de `POST /preregistro`

Esquema estricto (campos extra ⇒ `400`). La landing arma exactamente esto y valida antes con la misma copia del schema:

```jsonc
// especialista (email opcional: si está vacío, la clave no se manda)
{ "tipo": "especialista", "nombre": "Ana P.", "whatsapp": "223 555-0101", "rubros": ["gas"],
  "zona": "Centro", "email": "opcional@example.test", "acepta": true, "aviso": "esp-04a-borrador-2026-09-30" }
// usuario: solo email
{ "tipo": "usuario", "email": "ana@example.test", "acepta": true, "aviso": "usr-leg09-borrador-2026-09-15" }
```

- `acepta`: casilla **sin tildar** por defecto; hay que tildarla.
- `aviso`: id de la versión del texto que se muestra en el formulario (`registro.json → consentimiento.<tipo>.aviso`). El BE solo acepta los ids de su lista (`src/configuration/privacy-notices.ts`) y fija el hash y la finalidad. Si cambia el texto del aviso, cambia el id (y se agrega al BE).
- `zona`: letras, números y `. , ' ( ) / -`, sin empezar por símbolo (misma regex que el BE).
- Sin `cuit`, `barrio`, `necesidad` ni WhatsApp de usuario. El usuario no deja nombre.
- `sitio_web` (honeypot) **no se envía nunca**.

## Respuestas y qué hace la landing

El pedido va con `credentials: 'omit'` (sin cookies) y 15 s de espera máxima. **Éxito solo con `201 { "ok": true }`.** Con cualquier otra respuesta, la red o el timeout, el formulario conserva lo tipeado.

| Respuesta | Qué hace la landing |
|---|---|
| `201 { ok: true }` | Pantalla de éxito (usuario: texto neutro sin nombre; especialista: saludo con el primer nombre). También cubre duplicados: el BE no los distingue, y la landing tampoco |
| `400 { error: "validacion", campos }` | Marca los campos conocidos (`camposRechazados`). Si solo trae `aviso` o nada reconocible: caja de error genérica |
| `403 origen_no_permitido` | Caja de error: "no habilitado desde esta dirección" |
| `413 payload_grande` | Caja de error: "demasiado largo" |
| `429 limite` | Caja de error: demasiados intentos, esperar |
| `503 no_disponible` | Caja de error: no disponible ahora (incluye "captura cerrada" por aviso provisional) |
| Otro estado, `200`/`2xx` que no sea `201`, cuerpo inesperado | Caja de error genérica |
| Sin red | Caja de error de conexión |
| Más de 15 s | Caja de error de espera |

Todas las cajas de error traen "Reintentar" (vuelve a enviar lo que está en el formulario). Los textos están en `registro.json → error.motivos`; la traducción respuesta → motivo está en `src/schema/respuesta.ts` (`clasificarAlta`, `motivoDeFalla`).

Honeypot: si `sitio_web` viene completo, la landing muestra éxito sin enviar nada.

## Contador

`GET /preregistro/contador` → `{ "usuarios": n, "especialistas": n }` con `credentials: 'omit'`. El BE publica una **cota inferior**, no el número exacto: `0` si hay menos de 20 y, desde 20, el múltiplo de 5 inferior (un número exacto permitiría averiguar si una persona ya estaba anotada). La landing:

- muestra el número solo si es `>= CONTADOR_MINIMO` (20) y con el texto "Ya se anotaron {n} vecinos o más" / "{n} especialistas o más"; si no, "Sumate a la lista";
- ante cualquier error del contador, deja "Sumate a la lista" (no es bloqueante).

## Privacidad del navegador

No se guarda nada del registro en `localStorage`, `sessionStorage`, cookies ni IndexedDB (la pantalla de carga usa `sessionStorage` solo para recordar que ya se mostró, sin datos del registro).

## Build y publicación

El `dist/` es estático y solo contiene HTML, JS, CSS e imágenes: no incluye `.env`, `.env.local` ni código privado. `VITE_FORM_ENDPOINT` y `VITE_BASE` quedan embebidas (son públicas).

- GitHub Pages (automático en cada push a `main`, base `/Handy-landing-page-fe/`):
  ```sh
  npm ci && npm run build
  ```
- Hostinger con el dominio en la raíz (https://handyc.com):
  ```sh
  npm ci
  VITE_BASE=/ VITE_FORM_ENDPOINT=https://api.handyc.com npm run build   # o: npm run build:raiz con VITE_FORM_ENDPOINT en .env.local
  ```
  Subir el **contenido** de `dist/` a `public_html/`. Cada página es una carpeta con su `index.html` (`/registro/`, `/privacidad/`, ...), así que no hace falta fallback de SPA. Para que Apache sirva `404.html` en rutas inexistentes hace falta `ErrorDocument 404 /404.html` en un `.htaccess` (no incluido). `https://api.handyc.com` es el destino previsto; **todavía no está desplegado**.
- Si `VITE_BASE` no empieza y termina con `/`, el build falla con un mensaje claro.

## Sincronización

El contrato vive en el BE. Si cambia un campo del formulario:

1. `src/schemas/preregistro.ts` del BE (fuente) → copiar el archivo **idéntico** a `src/schema/preregistro.ts`. Verificación: `HANDY_BE_SCHEMA=/ruta/a/Handy-landing-page-be/src/schemas/preregistro.ts npm test` (sin la variable, esa prueba se saltea).
2. Los enums del portal (`handy-internal-portal/src/contracts/landing-api.ts`).
3. `registro.json` (textos de error y de los campos) y `privacidad.json`.
4. Si cambia el texto del aviso: id nuevo en `registro.json → consentimiento` y en el BE (`privacy-notices.ts`, con el hash del texto).

## Pruebas

`npm test` (`src/schema/preregistro.test.ts`): cuerpo válido de especialista (email opcional) y de usuario (solo email), esquema estricto (campos retirados o extra), `acepta` y `aviso` obligatorios, regla de `zona`, traducción del 400 a campos, éxito solo con 201, un error por cada estado, timeout y red, contador y sincronía opcional con el BE.

No hay prueba automática del DOM del formulario en el repo (no hay navegador ni jsdom como dependencia). Al implementar la Fase 3 se verificó con un script descartable (jsdom + `fetch` simulado) cada respuesta del contrato; si se agrega un runner de DOM, conviene convertirlo en prueba.
