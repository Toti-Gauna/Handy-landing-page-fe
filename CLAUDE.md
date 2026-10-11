# Handy · landing de pre-registro (frontend)

Handy conecta usuarios con especialistas del hogar en Mar del Plata. Sale en tiendas el **28/10/2026**.
Objetivo único de la landing: **pre-registros reales** de usuarios y especialistas.

## REGLAS DE LENGUAJE (obligatorias en todo texto visible)

- Español rioplatense, con voseo ("anotate", "querés", "cobrás"). Nada de tuteo ni de "usted".
- Montos en **pesos argentinos** con formato `$ 45.000`. Nunca dólares ni "USD".
- "Verificados" sí. **"Matriculados" y "despachamos", no.**
- No prometer "inmediato", "al instante" ni "en minutos": el horario lo declara el especialista.
- El especialista pone su precio. Handy **sugiere, nunca impone**.
- La plata no pasa por Handy: el especialista cobra en su cuenta (CBU/alias) y Handy retiene solo su tarifa.
- Sin cifras de mercado, estadísticas ni testimonios inventados. Nunca inventes números de anotados.
- Las pantallas de `assets/fotos` están en inglés, en dólares y muestran "Mechanic": son solo referencia visual.
  Los rubros son seis: Electricidad, Plomería, Gas, Cerrajería, Albañilería, Aire acondicionado.

## Estructura

- Vite + TypeScript, multi-página, sin framework. GSAP para animación.
- `index.html`, `especialistas/`, `registro/`, `privacidad/`, `404.html`: cáscaras sin texto.
  El HTML se genera en build desde el contenido (plugin `handy-paginas` en `vite.config.ts` → `src/render/`).
- `src/content/*.json`: **todo el texto** del sitio. Nada de texto hardcodeado en HTML ni en TS.
  - Admite `{variable}` (ver `variables` en `src/render/util.ts`: tarifas, fechas, montos) y `[texto](/ruta/)` para links.
  - `tarifas.json` es la única fuente de porcentajes y del ejemplo de $ 45.000.
  - Lo que está sin confirmar se marca con `"estado": "PENDIENTE"` o valor `"PENDIENTE"`.
- `src/brand/tokens.ts`: colores, tipografía y radios. Se inyectan como variables CSS (`--color-*`, `--radio-*`).
- `src/schema/preregistro.ts`: esquema zod del formulario. **Copia idéntica (byte a byte) de `src/schemas/preregistro.ts` de Handy-landing-page-be**: no se edita acá; si cambia el contrato, se cambia en el BE y se vuelve a copiar (`HANDY_BE_SCHEMA=<ruta al del BE> npm test` verifica la sincronía). Lo propio de la landing (interpretar respuestas del BE) va en `src/schema/respuesta.ts`. Los `id` de `rubros.json` tienen que coincidir con `RUBROS` (el build falla si no).
- `src/config.ts`: `FORM_ENDPOINT` (o variable `VITE_FORM_ENDPOINT` en el build), `CONTADOR_MINIMO = 20`.
- `src/scripts/`: comportamiento por página. `animaciones.ts` tiene todo lo de GSAP (respeta `prefers-reduced-motion`).
- `src/img/`: webp generados desde `assets/brand` con `npm run imagenes` (ImageMagick).

## Lenguaje visual (evitar lo genérico)

Todo sale de la app de Handy, no de plantillas: mosaicos grises (`--color-mosaico`) como la grilla de rubros,
botones cuadrados azules, hojas azul UI con manija, tarjetas blancas con franja gris ("Ver más información"),
pastillas azules del Centro de ayuda (preguntas), cupones (camada fundadora) y el calendario de turnos.
- Títulos en Archivo 900 ensanchado (`font-stretch`), texto en DM Sans. `==texto==` en un título = marcador amarillo.
- Botones "táctiles" con base que se hunde. Nada de bordes laterales de color, manchas de gradiente ni vidrio esmerilado.
- Celulares con proporción real (9:19.5) y pantallas completas (`src/render/pantallas.ts`), fieles a `assets/fotos`.
- `vitrina()`: en pantallas anchas el celular queda fijo y cambia de pantalla con el scroll; en el celular cada paso trae la suya.
- Pantalla de carga (`src/scripts/intro.ts`): una vez por sesión (`sessionStorage`), nunca con "reducir movimiento", máximo 5 s.

## Demo (/demo/)

- Pantallas en `src/render/demo/{usuario,especialista}.ts`, comportamiento en `src/scripts/demo/`, motor en `motor.ts` (contrato en `tipos.ts`).
- Kit visual de la app: `src/styles/demo-app.css` (clases `.hd-*`), piezas en `src/render/demo/piezas.ts` y el mapa vivo de Mar del Plata en `mapa.ts`.
  Lo propio de cada rol va con prefijo `.du-` / `.de-`. Avisos por la isla (`m.isla`), confeti (`m.confeti`), montos (`m.contar`), entradas con `data-entra`.
- Lógica pura de la demo en `src/demo/` (plata, fechas, agenda, contactos, propuestas, llegada) con tests (`npm test`).
  Toda cuenta de plata pasa por `src/demo/dinero.ts`: tarifa del cliente y del especialista separadas, mismo total en todas las pantallas.
- Piezas comunes a los dos roles en `src/render/demo/comunes.ts` + `src/scripts/demo/comunes.ts` (cabecera de chat, fecha/hora, agenda, contactos, propuestas).
- Fechas y horas pedidas son solicitudes; nada es turno confirmado sin la aceptación de la otra parte. Sin confirmación manual de llegada.
- Documentación del módulo: `docs/modulos/demo-interactiva.md`.
- Errores con los Handys rotos (`m.error(tipo)`, textos en `demo.json → errores`); las imágenes salen de `scripts/handys-rotos.sh`.
- Modo app (`?app=1`, botón "Usar como app" o el ícono instalado con `public/demo.webmanifest`): pantalla completa sin marco.
  Toda pantalla tiene que funcionar de 320 a 480 px de ancho y de 568 a 932 px de alto (flex + `.hd-scroll`).

## Reglas del registro

Contrato con Handy-landing-page-be (Fase 1, ya implementado): `docs/modulos/preregistro.md`.

- Especialista: `nombre`, `whatsapp`, `rubros`, `zona`, `email` **opcional**. Usuario: **solo `email`**. Sin CUIT, barrio, necesidad ni WhatsApp de usuario. Esquema estricto: no mandar campos extra ni vacíos.
- `aviso` obligatorio: id de la versión del aviso mostrada (`registro.json → consentimiento.<tipo>.aviso`, tiene que existir en `privacy-notices.ts` del BE). `acepta` sin tildar por defecto. Los textos del aviso salen de los borradores del BE (`docs/privacy/*.txt`) y están marcados `"estado": "PENDIENTE"` hasta la versión definitiva: texto nuevo = id nuevo.
- POST `FORM_ENDPOINT + '/preregistro'` con `credentials: 'omit'`; **éxito solo con el `201 { ok: true }`**. Cualquier otro estado, la red o 15 s de espera conservan lo tipeado y muestran el error (`src/schema/respuesta.ts`, textos en `registro.json → error.motivos`).
- Contador con GET `FORM_ENDPOINT + '/preregistro/contador'` → `{ usuarios, especialistas }`: es una **cota inferior** (0 si hay menos de 20; desde 20, múltiplos de 5). Se muestra solo si `>= CONTADOR_MINIMO` y con "{n} o más"; si no, "Sumate a la lista". Nunca presentarlo como cifra exacta.
- `FORM_ENDPOINT` vacío → "Registro habilitado en breve", botón deshabilitado, contador oculto.
- **No guardar registros en localStorage, cookies ni en el repo.** Sin credenciales ni secretos en el front: solo `VITE_FORM_ENDPOINT` y `VITE_BASE`, ambos públicos.
- Campo honeypot `sitio_web` (oculto: fuera de pantalla, `aria-hidden`, `tabindex="-1"`, `autocomplete="off"`): si viene completo se muestra éxito sin enviar; nunca se manda al backend.
- `400 { error: "validacion", campos: [...] }` → se marcan esos campos (`camposRechazados`; `aviso` no es un campo visible y da error genérico); `403`, `413`, `429`, `503`, red y timeout → caja de error con su texto y "Reintentar".

## Deploy

- GitHub Actions (`.github/workflows/deploy.yml`) publica en GitHub Pages en cada push a `main`.
- Base de Vite: `/Handy-landing-page-fe/` por defecto (GitHub Pages); `VITE_BASE=/ npm run build` (o `npm run build:raiz`) la cambia para publicar en la raíz de un dominio (Hostinger, https://handyc.com). Los links del contenido se escriben con `/` inicial (`/registro/`) y el render les agrega la base.
- GitHub Pages no tiene fallback de SPA: cada página es una carpeta con su `index.html`. Linkear siempre con barra final (`/especialistas/`).

## Videos

Si se agregan trailers en `assets/video/`, completar `trailer.video` y `trailer.poster` en `inicio.json` / `especialistas.json`
(rutas tipo `assets/video/trailer-usuario.mp4`). Se renderizan con `<video preload="none">` y poster. Sin video, queda la portada con "Próximamente".

## Comandos

```sh
npm ci
npm run dev        # http://localhost:5173/Handy-landing-page-fe/
npm run build      # typecheck + build a dist/ (base de GitHub Pages)
npm run build:raiz # igual, con base / (handyc.com en Hostinger)
npm test           # demo + esquema/respuestas del pre-registro
npm run preview
```

Mobile-first: el QR lleva al celular. Probar también en iPad horizontal (1180×820 / 1024×768).
