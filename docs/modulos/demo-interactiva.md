# Módulo: demo interactiva de la app (`/demo/`)

Referencia visual de la app de Handy (usuario y especialista), navegable en el navegador. Vive en el mismo repo
que la landing de pre-registro (TECH-33) pero es un módulo aparte: no comparte formulario, consentimiento, contenido
ni navegación con el pre-registro (solo la barra del sitio y un link "Probá la demo").

La app de producción es React Native bare + TypeScript (TECH-01). Esta demo es HTML/CSS/TS generado en build con el
mismo stack del sitio (Vite + TypeScript, sin framework): no es código de producción ni define reglas de producción.

## Alcance

- Recorrido guiado y uso libre de los dos roles, en un celular con marco (panel con pasos y controles) o en
  **modo app** (pantalla completa, sin marco: `?app=1`, botón "Usar como app" o el ícono instalado).
- Todo con **datos mock deterministas y ficticios** (Especialista 1, Cliente · La Perla, Catamarca 1650…).
  No hay backend, endpoints, cobros, SDKs de pago ni llamadas a APIs externas o de IA. Nada se guarda fuera de la
  memoria de la pestaña (ni localStorage, ni cookies).
- La demo transcurre en un "hoy" fijo (`demo.json → config.hoy`, martes 17/11/2026, zona horaria de Argentina).

Fuera de alcance: lógica de producción, geolocalización real, permisos nativos, pagos reales, cuentas y moderación.

## Pantallas

**Usuario** (`src/render/demo/usuario.ts`)

| Grupo | Pantallas |
|---|---|
| Inicio y servicios | `u-inicio` (tarjeta de prioridad: trabajo en curso o próximo turno; rubros; "Quiero…"; "Más servicios"), `u-sin-especialistas` |
| Pedido | `u-opciones` (Urgencia / Programado / Obra), `u-programar` (+ otra fecha / otro horario), `u-describir`, `u-buscando` |
| Propuestas | `u-presupuestos` (desglose completo), `u-perfil`, `u-historial`, `u-confirmar` |
| Trabajo en curso | `u-seguimiento` (llegada automática, adicionales), `u-chat`, `u-terminado`, `u-resena` |
| Chats | `u-chat` (Especialista 1), `u-chat2` (chat nuevo con Especialista 2), `u-chat3` (propuesta iniciada por el especialista), `u-handia`, `u-soporte` |
| Agenda | `u-turnos` ("Tu agenda"), `u-turno-detalle`, `u-cambiar`, `u-cancelar` |
| Cuenta | `u-mensajes`, `u-contactos`, `u-cuenta`, `u-datos`, `u-pagos`, `u-agregar-tarjeta`, `u-ayuda`, `u-ayuda-detalle`, `u-notificaciones` |

**Especialista** (`src/render/demo/especialista.ts`)

| Grupo | Pantallas |
|---|---|
| Pedidos | `e-inicio` (Disponible, pedido entrante), `e-precio` / `e-precio-programado` ("Tu precio"), `e-aceptado`, `e-pedido-programado` |
| Trabajo | `e-en-camino` (ubicación y llegada automática), `e-trabajo` (trabajo en curso), `e-adicional`, `e-fin` |
| Chats | `e-chat`, `e-conversacion`, `e-chat-nuevo` (solicitud de un cliente nuevo), `e-propuesta` (preparar precio, fecha y hora) |
| Agenda | `e-turnos` ("Tu agenda"), `e-turno-detalle`, `e-cambiar-fecha` |
| Cuenta | `e-mensajes`, `e-contactos`, `e-cuenta`, `e-caja` (cobros), `e-editar-cobro`, `e-rubros`, `e-datos`, `e-cupones`, `e-ayuda`, `e-notificaciones`, `e-config-notificaciones` |

**Comunes** (`src/render/demo/comunes.ts`): hojas `<p>-elegir-fecha` y `<p>-elegir-hora`, pantalla `<p>-contactos`,
cabecera de chat, acciones del chat, agenda por día y tarjetas de solicitud/propuesta.

## Estados y reglas de cada flujo

- **Selección del especialista:** la hace siempre el usuario (PROD-23). La app no promete disponibilidad, llegada
  inmediata ni precio fijo.
- **Fecha y hora:** se pueden pedir los días y franjas sugeridos, o cualquier fecha futura (calendario propio, sin
  fechas pasadas) y cualquier hora de 00:00 a 23:59 (incluida 03:00). Lo elegido es una **solicitud**: la otra parte
  acepta, rechaza o propone otra opción. Un cambio de turno queda **pendiente** y el turno actual se conserva hasta la
  respuesta.
- **Solicitudes y propuestas en el chat** (`src/demo/propuestas.ts`): estados `pendiente → aceptada | rechazada |
  reemplazada`. Una contraoferta deja la anterior como "reemplazada" en el historial. Nada es turno confirmado antes
  de la aceptación explícita. Las respuestas de la otra persona son eventos mock con tiempo fijo.
- **Precio** (`src/demo/dinero.ts`): subtotal = mano de obra + materiales (+ adicionales aceptados). El cliente paga
  subtotal + "Tarifa de Handy · cliente (5%)". El especialista recibe subtotal − su tarifa (10%). Las dos tarifas no
  se mezclan, y el total es el mismo en la lista, el detalle, la aceptación, el seguimiento y el pago. No hay tope
  (tarifas.json no lo define). Mínimo de la demo para que el especialista mande un presupuesto: $ 5.000
  (`config.precioMinimo`, configurable; ver pendientes).
- **Adicionales:** los crea solo el especialista (lista de opciones con "Opción personalizada" primero: repuesto o mano
  de obra, descripción y precio). El cliente ve el concepto, el importe, la tarifa de cliente y el total final nuevo, y
  acepta o rechaza. Hasta aceptar no cuentan; si rechaza, queda el precio vigente. No hay compras ni cobros automáticos.
- **Llegada** (`src/demo/llegada.ts`): no hay confirmación manual de llegada. Estados `pidiendo-permiso → en-camino ⇄
  senal-imprecisa | sin-senal → llego`, o `sin-permiso`. "Llegó" lo marca una geocerca **simulada** con eventos mock.
  No se fija radio ni precisión. Solo se sigue la ubicación de un trabajo aceptado y durante el viaje.
- **Agenda** (`src/demo/agenda.ts`): cualquier día se puede tocar y muestra todos sus trabajos (o un estado vacío).
  La selección y el mes se conservan al ir y volver del detalle.
- **Pagos:** "Agregar tarjeta" usa datos ficticios ("Usar una tarjeta de prueba"). Solo quedan en memoria los últimos
  4 números, enmascarados. La demo lo aclara: no se hacen cobros ni se guardan datos.

## Datos

- Textos: `src/content/demo.json` (comunes, configuración, errores, modo app), `demo-usuario.json`,
  `demo-especialista.json`. Porcentajes y ejemplo de $ 45.000: `tarifas.json`. Rubros: `rubros.json`.
- Fixtures: propuestas (mano de obra / materiales / vencimiento), trabajos de la agenda, contactos, chats, adicionales
  e historial público del especialista, todos en los JSON de cada rol. Lo no confirmado lleva `PENDIENTE` en su `_nota`.
- Estado en el navegador: `m.estado` del motor (se vacía con "Volver a empezar" y al cambiar de lado).

## Permisos y privacidad (LEG-09)

- **Ubicación:** se explica en contexto antes de pedirla (solo el trabajo aceptado, solo durante el viaje, se deja de
  usar al llegar). Si se niega, el trabajo sigue sin llegada automática y sin un botón manual de reemplazo. En la demo,
  el permiso es un botón mock; no se pide el permiso real del navegador.
- **Contactos:** solo los que se agregan desde un chat ("Agregar a contactos", sin duplicados). No se lee la agenda
  del teléfono ni se muestran números.
- **Historial público del especialista:** rubro, descripción general y fecha. Sin identidad, dirección, teléfono,
  conversación, importe ni documentos del cliente; sin fotos.
- **Tarjetas:** nunca se guarda el número completo ni el código.

## Fallos y cómo se muestran

| Caso | Qué ve la persona |
|---|---|
| Sin conexión / algo falló | Pantalla de error con un Handy roto y "Probar de nuevo" (`m.error`, panel "Probá un error") |
| Nadie disponible | Caño roto: "Programar para otro día" o "Probar de nuevo" |
| CBU inválido | Error en línea con la llave rota y pantalla de error al guardar |
| Precio menor al mínimo | "Ese valor es muy bajo. Handy quiere que tu trabajo se vea bien recompensado." y envío bloqueado |
| Tarea sin especialistas (p. ej., armar muebles) | "Todavía no hay especialistas para esto", sin pedido |
| Ubicación: sin permiso / imprecisa / sin señal | Mensaje en el seguimiento de los dos lados; la llegada se marca cuando mejora |
| Propuesta rechazada | Queda en el historial como "Rechazada"; sigue lo vigente |

## Verificación

```sh
npm ci
npm test               # lógica pura de src/demo (dinero, fechas, agenda, contactos, propuestas, llegada)
npm run typecheck
npm run build          # typecheck + build (el build valida destinos de navegación, pasos y pausas del recorrido)
npm run dev            # http://localhost:5173/Handy-landing-page-fe/demo/
```

- Recorrido manual: `/demo/?rol=usuario` y `/demo/?rol=especialista`, botón Reproducir (llega solo al final) o
  Siguiente paso a paso. Modo app: `/demo/?app=1` en el celular o en la emulación del navegador (320 a 480 px de ancho).
- Prueba de punta a punta (Playwright, sin dependencias del repo): reproducir cada recorrido hasta `.demo--fin` y
  revisar que la consola quede sin errores. Anchos: 320×568, 375×667, 390×844, 480×932 y iPad 1180×820.
- El repo no tiene linter configurado (no hay script `lint`).
