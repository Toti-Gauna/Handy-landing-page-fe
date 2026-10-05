# Pre-registro · conexión con el backend

Estado: el formulario está listo; falta construir `Handy-landing-page-be`. Mientras `FORM_ENDPOINT` esté vacío, la página muestra "Registro habilitado en breve" y no hace pedidos.

## Configuración

| Dónde | Variable | Valor |
|---|---|---|
| GitHub (Settings → Secrets and variables → Actions → Variables) | `FORM_ENDPOINT` | URL pública del backend, sin barra final |
| Local (`.env.local`, ver `.env.example`) | `VITE_FORM_ENDPOINT` | Ídem |

`src/config.ts` lee la variable en el build. Con valor, el formulario se habilita y se pide el contador.

## Lo que la landing espera del backend

| Pedido | Respuesta | Qué hace la landing |
|---|---|---|
| `POST /preregistro` con el cuerpo de `preregistroSchema` | `201` | Pantalla de éxito |
| `POST /preregistro` | `400 { "error": "validacion", "campos": ["email"] }` | Marca esos campos con los textos de `registro.json → errores` (`camposRechazados` solo acepta campos conocidos) |
| `POST /preregistro` | Cualquier otro error, falla de red o más de 15 s | Caja de error con "Reintentar"; los datos quedan en el formulario |
| `GET /preregistro/contador` | `200 { "usuarios": n, "especialistas": n }` | Muestra el número si llega a `CONTADOR_MINIMO` (20); si no, "Sumate a la lista" |

- El cuerpo solo trae los campos completados. `sitio_web` (honeypot) no se envía: si viene completo, la landing muestra éxito sin mandar nada.
- El backend valida con una copia de `src/schema/preregistro.ts` y fija la fecha del pre-registro.
- CORS: origen de la landing, `GET`/`POST`, header `Content-Type`, sin credenciales.

El contrato completo del backend, incluidos los endpoints `/admin/*` que usa el portal interno para trabajar los pre-registros, está en `handy-internal-portal/docs/api/landing-be.md`.

## Sincronización

Si cambia un campo del formulario: actualizar `src/schema/preregistro.ts`, su copia en el backend, los enums de `handy-internal-portal/src/contracts/landing-api.ts`, `registro.json` (textos de error) y, si aplica, `privacidad.json`.

## Pruebas

`src/schema/preregistro.test.ts` cubre la traducción del 400 a campos conocidos y un cuerpo válido de especialista.
