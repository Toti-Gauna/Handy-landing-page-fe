// Demo · lado del especialista: pantallas, hojas y recorrido.
// Fieles a assets/fotos/especialista (mapa con "Disponible", pedido con precio sugerido, hoja de precio,
// en camino, chat, trabajo con cronómetro, fin con el caño, agenda, detalle, cambio de fecha, avisos,
// cuenta y caja), pero en español, en pesos y con los rubros de Handy.
// El comportamiento (interruptores, cronómetro, precios que se recalculan) vive en src/scripts/demo/especialista.ts.

import d from '../../content/demo-especialista.json' with { type: 'json' };
import rubros from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, formatoPesos, plano } from '../util.ts';
import { burbuja, calendario, estado, hoja, logo } from '../pantallas.ts';
import { boton, cabeceraDemo, navDemo, tituloHoja, volverDemo, type Toque } from './piezas.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

const ROL = 'especialista' as const;
const C = d.comun;
const SUGERIDO = tarifas.ejemplo.presupuesto;

// ── Cuentas (las mismas que hace el navegador con src/scripts/demo/util.ts) ──

const retencion = (n: number) => Math.round((n * tarifas.normal.especialista) / 100);
const neto = (n: number) => n - retencion(n);
const pesos = (n: number) => esc(formatoPesos(n));
const diaSemana = (dia: number) => C.dias[new Date(Number(C.anio), C.mesNumero - 1, dia).getDay()];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dosDigitos = (n: number) => String(n).padStart(2, '0');
const fechaCorta = (dia: number) => `${dosDigitos(dia)}/${dosDigitos(C.mesNumero)}`;
const fechaLarga = (dia: number) => `${fechaCorta(dia)}/${C.anio}`;

// ── Íconos que no están en iconos.ts (mismo formato) ──────────────────────

const propios: Record<string, string> = {
  arriba: '<path d="m6 15 6-6 6 6"/>',
  engranaje:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  tacho: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  pregunta: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6"/><path d="M12 17h.01"/>',
  salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',
  contactos:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.9 4.5 4.5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
};

function ic(nombre: string, clase = 'icono'): string {
  const trazo = propios[nombre];
  if (!trazo) return icono(nombre, clase);
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`;
}

// ── Piezas propias ────────────────────────────────────────────────────────

/** Fila "concepto ........ monto" (desgloses y datos del trabajo). */
const fila = (izq: string, der: string, clase = '') => `<p class="de-fila ${clase}"><span>${izq}</span><strong>${der}</strong></p>`;

/** Botón grande de la app (con las variantes de color de las referencias). */
const btn = (t: Toque, texto: string, clase = '') => boton(t, texto, `app-boton ${clase}`.trim());

const puntos = '<span class="de-puntos" aria-hidden="true"><i></i><i></i><i></i></span>';

/**
 * Mapa ilustrado de La Perla: manzanas en diagonal como en Mar del Plata, avenidas, el mar y la costa.
 * Todo se dibuja en coordenadas "de calle" (múltiplos de 42 = esquinas) y el grupo se gira -28°.
 */
interface OpcionesMapa {
  id: string;
  vos: [number, number];
  cliente?: [number, number];
  ruta?: [number, number][];
}

function mapa(o: OpcionesMapa): string {
  const m = d.mapa;
  const pinCliente = o.cliente
    ? `<g transform="translate(${o.cliente[0]} ${o.cliente[1]}) rotate(28)"><g class="de-pin-cliente" data-de-pin-cliente><path transform="translate(-12 -31)" d="M12 31s10-11.6 10-19A10 10 0 0 0 2 12c0 7.4 10 19 10 19Z" fill="#E53935"/><circle cx="0" cy="-19" r="4" fill="#fff"/></g></g>`
    : '';
  const puntosRuta = o.ruta?.map((p) => p.join(' ')).join(' ');
  const ruta = puntosRuta
    ? `<polyline points="${puntosRuta}" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><polyline class="de-ruta" points="${puntosRuta}" fill="none" stroke="#0E1D36" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`
    : '';
  return `<svg class="app-mapa de-mapa__svg" viewBox="0 0 240 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs><pattern id="de-manzanas-${o.id}" width="42" height="42" patternUnits="userSpaceOnUse"><rect width="42" height="42" fill="#FBFBFC"/><rect x="4" y="4" width="34" height="34" rx="3.5" fill="#E3E6EB"/></pattern></defs>
  <rect width="240" height="420" fill="#EEF0F3"/>
  <g transform="rotate(-28 120 210)">
    <rect x="-260" y="-260" width="540" height="940" fill="url(#de-manzanas-${o.id})"/>
    <rect x="130" y="88" width="34" height="34" rx="3.5" fill="#CDE8C9"/>
    <rect x="46" y="214" width="34" height="34" rx="3.5" fill="#CDE8C9"/>
    <path d="M-260 210H240M126 -260V680" stroke="#FBD999" stroke-width="9"/>
    <path d="M236 -260 C 226 -60, 248 100, 232 260 S 242 520, 232 680 L 600 680 L 600 -260 Z" fill="#BFDDF2"/>
    <path d="M236 -260 C 226 -60, 248 100, 232 260 S 242 520, 232 680" fill="none" stroke="#FBD999" stroke-width="7"/>
    <g font-family="DM Sans, sans-serif" font-weight="700" fill="#8C7440" font-size="7.5">
      <text x="-40" y="212.6">${esc(m.calles[0])}</text>
      <text x="150" y="212.6">${esc(m.calles[0])}</text>
      <text transform="translate(123.4 230) rotate(90)">${esc(m.calles[1])}</text>
      <text transform="translate(123.4 -10) rotate(90)">${esc(m.calles[1])}</text>
      <text transform="translate(237.5 150) rotate(93)" font-size="6.5">${esc(m.costa)}</text>
    </g>
    <g font-family="DM Sans, sans-serif" font-weight="700" fill="#8B94A5" font-size="6.5">
      <text transform="translate(207.7 236) rotate(90)">${esc(m.calles[2])}</text>
      <text x="-30" y="128.3">${esc(m.calles[3])}</text>
      <text x="133.5" y="108" fill="#5E8E5A" font-size="6">${esc(m.plaza)}</text>
    </g>
    <text x="52" y="102" font-family="DM Sans, sans-serif" font-weight="800" font-size="11" letter-spacing="3" fill="#A7AFBC">${esc(m.barrio)}</text>
    <text transform="translate(262 128) rotate(90)" font-family="DM Sans, sans-serif" font-style="italic" font-weight="700" font-size="8.5" fill="#6E9CC4">${esc(m.mar)}</text>
    ${ruta}
    <g transform="translate(${o.vos[0]} ${o.vos[1]})" class="de-vos"><circle class="de-radar" r="9" fill="none" stroke="#2F6BFF" stroke-width="2"/><circle r="13" fill="#2F6BFF" opacity=".16"/><circle class="de-vos__punto" r="6" fill="#2F6BFF" stroke="#fff" stroke-width="2.5"/></g>
    ${pinCliente}
  </g>
</svg>`;
}

/** Pastilla "Disponible" con el interruptor (en el inicio se toca; en el resto es solo visual). */
function disponible(tocable: boolean): string {
  const contenido = `<span data-de-disp-texto>${esc(tocable ? C.noDisponible : C.disponible)}</span>${icono('maletin')}<span class="app-switch"></span>`;
  if (!tocable) return `<span class="app-disponible de-disponible" aria-hidden="true">${contenido}</span>`;
  return boton(
    { accion: 'disponible', guia: true, etiqueta: C.disponible, extra: 'role="switch" aria-checked="false"' },
    contenido,
    'app-disponible de-disponible de-disponible--apagado',
  );
}

/** Aviso oscuro como "Meetup scheduled accepted!" (X a la izquierda, tilde a la derecha). */
function aviso(titulo: string, texto: string, attrs: string): string {
  return `<div class="de-aviso" ${attrs} role="status" hidden>
  ${boton({ accion: 'cerrarAviso', etiqueta: C.cerrar }, icono('cerrar'), 'de-aviso__x')}
  <span class="de-aviso__texto"><strong data-de-aviso-titulo>${esc(titulo)}</strong><small data-de-aviso-texto>${esc(texto)}</small></span>
  ${ic('checkCirculo', 'icono de-aviso__ok')}
</div>`;
}

/** Cabecera gris (pantallas de notificaciones, como un panel encima de la app). */
function cabeceraGris(engranajeTocable: boolean): string {
  const engranaje = engranajeTocable
    ? boton({ ir: 'e-config-notificaciones', etiqueta: d.avisos.configurar }, ic('engranaje'), 'app-cuadrado')
    : `<span class="app-cuadrado de-cuadrado--activo" aria-hidden="true">${ic('engranaje')}</span>`;
  const cerrar = boton({ volver: true, etiqueta: C.cerrar }, icono('cerrar'), 'app-cuadrado de-cuadrado--rojo');
  return `<div class="app-cabecera de-cabecera-gris">
  ${estado()}
  <div class="app-cabecera__fila">${logo}<span class="app-cabecera__botones">${engranaje}${cerrar}</span></div>
</div>`;
}

/** Desglose de un trabajo: presupuesto (+ repuestos) − tarifa = a tu cuenta. */
function desglose(presupuesto: number, extras = 0, ultimo = C.aTuCuenta): string {
  const total = presupuesto + extras;
  return `${fila(esc(C.presupuesto), pesos(presupuesto))}
${extras ? fila(esc(C.repuestos), `+ ${pesos(extras)}`) : ''}
${fila(plano(C.tarifa), `− ${pesos(retencion(total))}`, 'de-fila--resta')}
${fila(esc(ultimo), pesos(neto(total)), 'de-fila--total')}`;
}

// ── Inicio: mapa, "Disponible" y el pedido que entra ─────────────────────

const POS_INICIO = { vos: [126, 168] as [number, number], cliente: [210, 126] as [number, number] };

function inicio(): PantallaDemo {
  const i = d.inicio;
  const pd = i.pedido;
  return {
    id: 'e-inicio',
    titulo: d.pantallas.inicio,
    html: `<div class="app">
${cabeceraDemo(ROL, 'azul')}
<div class="app-mapa-caja de-mapa de-mapa--apagado" data-de-mapa>
  ${mapa({ id: 'inicio', ...POS_INICIO })}
  ${disponible(true)}
  <p class="de-toast" data-de-toast role="status" hidden>${icono('alerta')}<span>${esc(i.aviso)}</span></p>
  <div class="de-estado" data-de-estado>
    <span class="de-estado__icono">${icono('maletin')}</span>
    <span class="de-estado__texto"><strong data-de-estado-titulo>${esc(i.apagadoTitulo)}</strong><small data-de-estado-texto>${esc(i.apagadoTexto)}</small></span>
    ${puntos}
  </div>
  <div class="app-pedido de-pedido" data-de-pedido hidden>
    <p class="app-pedido__titulo">${esc(pd.titulo)} ${icono('canilla')}${boton({ accion: 'rechazar', etiqueta: pd.rechazar }, icono('cerrar'), 'app-x app-x--gris')}</p>
    <span class="app-tag de-tag--urgencia">${icono('alerta')}${esc(C.urgencia)}</span>
    <p class="de-pedido__detalle">${esc(pd.detalle)}</p>
    <small>${esc(pd.sugeridoLabel)}</small>
    <p class="app-pedido__precio">${pesos(SUGERIDO)}</p>
    <div class="app-ruta"><span><i></i>${esc(pd.desde)}</span><span><i></i>${esc(pd.hasta)}</span></div>
    ${btn({ accion: 'aceptarSugerido', ir: 'e-aceptado' }, esc(pd.aceptar))}
    ${btn({ ir: 'e-precio', guia: true }, esc(pd.cambiar), 'app-boton--contorno')}
    <p class="de-pedido__pie">${esc(pd.pie)} ${icono('alerta')}</p>
  </div>
</div>
${navDemo(ROL, 0)}
</div>`,
  };
}

// ── Hoja: tu precio ───────────────────────────────────────────────────────

function precio(): PantallaDemo {
  const p = d.precio;
  const franjas = p.franjas
    .map((f, i) =>
      boton(
        { accion: 'franja', valor: String(i), extra: `aria-pressed="${i === 0}"` },
        esc(f.texto),
        `app-chip de-chip${i === 0 ? ' app-chip--activo' : ''}`,
      ),
    )
    .join('');
  const chips = [
    boton({ accion: 'precioSugerido', extra: 'aria-pressed="true"' }, esc(p.dejar), 'app-chip de-chip app-chip--activo'),
    ...p.sumas.map((s, i) =>
      boton(
        { accion: 'precioSumar', valor: String(s), guia: i === 0, extra: 'aria-pressed="false"' },
        `+ ${pesos(s)}`,
        'app-chip de-chip',
      ),
    ),
  ].join('');
  const paso = formatoPesos(p.paso);
  return {
    id: 'e-precio',
    titulo: d.pantallas.precio,
    tipo: 'hoja',
    html: `${tituloHoja(p.titulo)}
<div class="de-bloque" data-de-franjas>
  <p class="de-label">${esc(p.cuandoLabel)}</p>
  <div class="de-chips">${franjas}</div>
</div>
<p class="de-sugerido">${esc(p.sugeridoLabel)} <strong data-de-sugerido>${pesos(SUGERIDO)}</strong></p>
<div class="de-chips">${chips}</div>
<div class="app-sheet__fila">
  <span class="app-campo de-campo-precio"><span class="sr">${esc(p.campoLabel)}</span><span data-de-precio aria-live="polite">${pesos(SUGERIDO)}</span>
    <span class="de-stepper">${boton({ accion: 'precioPaso', valor: String(p.paso), etiqueta: p.subir.replace('{monto}', paso) }, ic('arriba'))}${boton({ accion: 'precioPaso', valor: String(-p.paso), etiqueta: p.bajar.replace('{monto}', paso) }, icono('abajo'))}</span>
  </span>
  ${btn({ accion: 'ponerPrecio', guia: true }, esc(p.boton))}
</div>
<p class="de-recibis"><span>${esc(p.recibis)} <strong data-de-recibis>${pesos(neto(SUGERIDO))}</strong></span><small data-de-retiene>${plano(p.retiene, { monto: formatoPesos(retencion(SUGERIDO)) })}</small></p>
<p class="app-sheet__nota">${esc(p.nota)}</p>`,
  };
}

// ── Presupuesto enviado → el cliente te elige ────────────────────────────

function aceptado(): PantallaDemo {
  const a = d.aceptado;
  return {
    id: 'e-aceptado',
    titulo: d.pantallas.aceptado,
    html: `<div class="app">
${cabeceraDemo(ROL, 'azul')}
<div class="app-mapa-caja de-mapa de-mapa--pedido">
  ${mapa({ id: 'aceptado', ...POS_INICIO })}
  ${disponible(false)}
  ${aviso(a.avisoTitulo, a.avisoTexto, 'data-de-elegido-aviso')}
  <div class="app-pedido de-enviado">
    <p class="app-pedido__titulo">${ic('checkCirculo', 'icono de-ok')}<span data-de-enviado-titulo>${esc(a.titulo)}</span></p>
    <div class="de-filas">
      ${fila(esc(a.tuPrecio), `<span data-de-precio>${pesos(SUGERIDO)}</span>`)}
      ${fila(esc(a.horario), `<span data-de-franja>${esc(d.precio.franjas[0].texto)}</span>`)}
      ${fila(esc(C.recibis), `<span data-de-recibis>${pesos(neto(SUGERIDO))}</span>`, 'de-fila--total')}
    </div>
    <p class="de-esperando" data-de-esperando>${puntos}<span>${esc(a.esperando)}</span></p>
    ${btn({ ir: 'e-en-camino', guia: true, extra: 'data-de-ir-alla hidden' }, `${esc(a.irAlla)} ${icono('flecha')}`, 'de-boton-icono')}
  </div>
</div>
${navDemo(ROL, 0)}
</div>`,
  };
}

// ── En camino ─────────────────────────────────────────────────────────────

function enCamino(): PantallaDemo {
  const c = d.camino;
  const ruta: [number, number][] = [
    [84, 252],
    [84, 210],
    [168, 210],
    [168, 84],
  ];
  return {
    id: 'e-en-camino',
    titulo: d.pantallas.camino,
    html: `<div class="app">
${cabeceraDemo(ROL, 'azul')}
<div class="app-mapa-caja de-mapa de-mapa--pedido de-mapa--camino">
  ${mapa({ id: 'camino', vos: [84, 252], cliente: [168, 84], ruta })}
  ${boton({ volver: true, etiqueta: C.volver }, icono('atras'), 'app-flotante')}
  <div class="app-pedido de-camino">
    <p class="app-pedido__titulo">${esc(d.inicio.pedido.titulo)} ${icono('canilla')}<span class="app-tag de-tag--urgencia">${icono('alerta')}${esc(C.urgencia)}</span></p>
    <div class="app-ruta"><span><i></i>${esc(c.desde)}</span><span><i></i>${esc(c.hasta)}</span></div>
    ${fila(esc(c.horario), `<span data-de-franja>${esc(d.precio.franjas[0].texto)}</span>`)}
    ${btn({ ir: 'e-trabajo' }, `${esc(c.llegue)} ${icono('check')}`, 'de-boton-icono')}
  </div>
</div>
<div class="app-panel de-cliente">
  <span class="app-avatar app-avatar--chico">${icono('usuario')}</span>
  <span class="de-cliente__texto"><small>${esc(c.clienteLabel)}</small><strong>${esc(c.cliente)}</strong><small>${esc(c.sinTelefono)}</small></span>
  ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-chat', guia: true, etiqueta: c.chatear }, icono('chat'), 'app-cuadrado app-cuadrado--claro')}
</div>
</div>`,
  };
}

// ── Chat ──────────────────────────────────────────────────────────────────

type IdChat = keyof typeof d.chats;
const CHATS = Object.keys(d.chats) as IdChat[];

const rapidas = (id: IdChat) =>
  d.chats[id].rapidas
    .map((r, i) => boton({ accion: 'rapida', valor: String(i), guia: i === 0 }, esc(r.chip), 'app-accion de-rapida'))
    .join('');

function chat(): PantallaDemo {
  const c = d.chat;
  const inicial: IdChat = 'perla';
  const ch = d.chats[inicial];
  const plantillas = CHATS.map(
    (id) => `<template data-de-plantilla="${id}">${d.chats[id].mensajes.map((m) => burbuja(m, ['esp'])).join('')}</template>`,
  ).join('');
  return {
    id: 'e-chat',
    titulo: d.pantallas.chat,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca', false)}
<div class="app-chat de-chat" data-de-chat="${inicial}">
  <div class="app-chat__cabecera">${boton({ volver: true, etiqueta: C.volver }, icono('atras'), 'app-volver__flecha')}<span class="app-chat__nombre"><strong data-de-chat-nombre>${esc(ch.nombre)}</strong><small data-de-chat-sub>${esc(ch.sub)}</small></span><span class="app-chat__avatar app-chat__avatar--icono">${icono('usuario')}</span></div>
  <div class="app-chat__mensajes" data-de-mensajes aria-live="polite">${ch.mensajes.map((m) => burbuja(m, ['esp'])).join('')}</div>
  <div class="de-rapidas" data-de-rapidas role="group" aria-label="${esc(c.rapidasLabel)}">${rapidas(inicial)}</div>
  <div class="app-chat__acciones app-chat__acciones--centro">
    ${boton({ ir: 'e-trabajo', extra: 'data-de-llegue' }, `${esc(c.llegue)} ${icono('check')}`, 'app-accion app-accion--principal')}
    ${boton({ accion: 'verTurno', valor: '0', ir: 'e-turno-detalle', extra: 'data-de-ver-turno hidden' }, `${esc(c.verTurno)} ${icono('calendario')}`, 'app-accion app-accion--principal')}
  </div>
  <div class="app-input"><span class="app-input__campo">${esc(c.input)}${icono('imagen')}</span><span class="app-input__enviar">${icono('enviar')}</span></div>
  ${plantillas}
  <template data-de-plantilla-escribiendo><div class="app-burbuja app-burbuja--otra de-escribiendo">${puntos}</div></template>
</div>
</div>`,
  };
}

// ── Trabajo en curso ──────────────────────────────────────────────────────

function trabajo(): PantallaDemo {
  const t = d.trabajo;
  const f = d.precio.franjas[0];
  const primero = t.extras[0];
  return {
    id: 'e-trabajo',
    titulo: d.pantallas.trabajo,
    html: `<div class="app">
<div class="app-cabecera app-cabecera--blanca">
  ${estado()}
  <div class="app-cabecera__fila">${logo}<span class="de-crono" role="timer" aria-label="${esc(t.cronoLabel)}">${icono('reloj')}<span data-de-crono>00:00</span></span></div>
</div>
<div class="app-cuerpo de-cuerpo">
  <div class="de-dupla de-dupla--tipo">
    <div><p class="de-label">${esc(t.tipoLabel)}</p><p class="de-tipo"><strong>${esc(t.tipo)} ${icono('canilla')}${icono('maletin')}</strong><small>${esc(t.tipoDetalle)}</small></p></div>
    <div><p class="de-label">${esc(t.fechaLabel)}</p><p class="de-fecha"><strong data-de-franja-dia>${esc(f.dia)}</strong><small>${esc(fechaCorta(C.hoy))}</small><small data-de-franja-corta>${esc(f.corto)}</small></p></div>
  </div>
  <p class="de-label">${esc(t.agregarLabel)}</p>
  <div class="de-agregar">
    <span class="de-campo" data-de-extra-nombre>${esc(primero.nombre)}</span>
    <span class="de-campo de-campo--monto" data-de-extra-monto>${pesos(primero.monto)}</span>
  </div>
  ${btn({ accion: 'agregarExtra', guia: true }, esc(t.agregar), 'de-boton--claro de-boton--chico')}
  <p class="de-label">${esc(t.costoLabel)} ${icono('info')}</p>
  <div class="de-costo" data-de-costo aria-live="polite">${desglose(SUGERIDO, 0, C.recibis)}</div>
  <template data-de-plantilla-quitar>${boton({ accion: 'quitarExtra', valor: '0' }, icono('cerrar'), 'de-quitar')}</template>
  ${btn({ accion: 'abrirChat', valor: 'perla', ir: 'e-chat' }, esc(t.chatear), 'app-boton--contorno')}
  <div class="de-dos">
    ${btn({ ir: 'e-cancelar' }, esc(t.cancelar), 'de-boton--rojo')}
    ${btn({ ir: 'e-fin', guia: true }, esc(t.terminar))}
  </div>
</div>
</div>`,
  };
}

// ── Fin del trabajo ───────────────────────────────────────────────────────

function fin(): PantallaDemo {
  const f = d.fin;
  return {
    id: 'e-fin',
    titulo: d.pantallas.fin,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca')}
<div class="app-cuerpo app-cuerpo--centro de-fin">
  <p class="app-titulo app-titulo--negro">${esc(f.titulo)}</p>
  <div class="app-fin__handy de-fin__handy">
    <img class="handy handy--cano" src="/src/img/handy-cano.webp" alt="" width="354" height="405" loading="lazy" decoding="async" />
    <img class="handy cano-gota__gota" src="/src/img/handy-gota.webp" alt="" width="93" height="125" loading="lazy" decoding="async" data-de-gota />
  </div>
  <p class="app-ganaste">${esc(f.ganaste)} <strong data-de-ganaste>${pesos(neto(SUGERIDO))}</strong></p>
  <div class="de-costo de-costo--fin" data-de-costo>${desglose(SUGERIDO)}</div>
  <p class="app-nota-fin">${esc(f.texto)}</p>
  ${btn({ raiz: 'e-inicio' }, esc(f.inicio), 'app-boton--contorno')}
  ${btn({ raiz: 'e-turnos', guia: true }, esc(f.agenda))}
</div>
</div>`,
  };
}

// ── Agenda ────────────────────────────────────────────────────────────────

function tarjetaTurno(t: (typeof d.turnos.items)[number], i: number): string {
  const cuerpo = `<span class="app-tarjeta__datos"><strong>${esc(t.rubro)} ${icono(t.icono)}</strong><small>${esc(mayuscula(diaSemana(t.dia)))} ${esc(fechaCorta(t.dia))} · ${esc(t.franja)}</small></span>
  <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--verde" data-de-monto>+ ${pesos(neto(t.presupuesto))}</span><small>${esc(C.programado)}</small><small class="de-tag-cancelado" data-de-cancelado hidden>${esc(d.turnos.cancelado)}</small></span>`;
  return `<div class="app-tarjeta" data-de-turno="${i}"><div class="app-tarjeta__cuerpo">${cuerpo}</div>${boton(
    { accion: 'verTurno', valor: String(i), ir: 'e-turno-detalle', guia: i === 0 },
    esc(C.verMas),
    'app-tarjeta__franja',
  )}</div>`;
}

function turnos(): PantallaDemo {
  const t = d.turnos;
  const marcados = [
    ...t.pasados.map((p) => ({ dia: p.dia, icono: p.icono, estilo: 'noche' })),
    ...t.items.map((it) => ({ dia: it.dia, icono: it.icono, estilo: 'azul' })),
  ];
  return {
    id: 'e-turnos',
    titulo: d.pantallas.turnos,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${calendario({ mes: C.mesTitulo, anio: C.anio, dias: 30, hoy: C.hoy, marcados })}</div>
${hoja(t.panel, `<div class="app-lista de-lista">${t.items.map(tarjetaTurno).join('')}</div>`, 'app-hoja--llena')}
${navDemo(ROL, 1)}
</div>`,
  };
}

// ── Detalle del turno ─────────────────────────────────────────────────────

function detalle(): PantallaDemo {
  const x = d.detalle;
  const t = d.turnos.items[0];
  const iconos = [...new Set(d.turnos.items.map((it) => it.icono))]
    .map((n) => `<span class="de-icono-turno" data-de-icono="${n}"${n === t.icono ? '' : ' hidden'}>${icono(n)}</span>`)
    .join('');
  return {
    id: 'e-turno-detalle',
    titulo: d.pantallas.detalle,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca', false)}
<div class="app-cuerpo de-cuerpo">
  ${volverDemo(x.titulo)}
  <div class="de-dupla de-dupla--tipo">
    <div><p class="de-label">${esc(x.tipoLabel)}</p><p class="de-tipo"><strong><span data-de-d="rubro">${esc(t.rubro)}</span> ${iconos}${icono('maletin')}</strong><small><span data-de-d="detalle">${esc(t.detalle)}</span></small></p></div>
    <div><p class="de-label">${esc(x.fechaLabel)}</p><p class="de-fecha"><strong data-de-d="dia">${esc(mayuscula(diaSemana(t.dia)))}</strong><small data-de-d="fecha">${esc(fechaLarga(t.dia))}</small><small data-de-d="franja">${esc(t.franja)}</small></p></div>
  </div>
  <div class="de-dupla">
    <div><p class="de-label">${esc(x.dondeLabel)}</p><p class="de-caja-azul" data-de-d="barrio">${esc(t.barrio)}</p></div>
    <div><p class="de-label">${esc(x.repuestosLabel)}</p><p class="de-caja-azul">${esc(x.ninguno)}</p></div>
  </div>
  <p class="de-label">${esc(x.costoLabel)} ${icono('info')}</p>
  <div class="de-costo" data-de-d="costo">${desglose(t.presupuesto, 0, C.recibis)}</div>
  <p class="de-estado-turno" data-de-d="estado">${esc(x.pendiente)}</p>
  <div class="de-acciones" data-de-d="acciones">
    ${btn({ accion: 'abrirChat', valor: t.chat, ir: 'e-chat', extra: 'data-de-d="chat"' }, esc(x.chatear), 'app-boton--contorno')}
    ${btn({ ir: 'e-cambiar-fecha', guia: true }, esc(x.cambiar), 'de-boton--claro')}
    ${btn({ ir: 'e-cancelar' }, esc(x.cancelar), 'de-boton--rojo')}
  </div>
</div>
</div>`,
  };
}

// ── Cambiar la fecha ──────────────────────────────────────────────────────

/** Primer día hábil (lunes a sábado) después de `dia`. */
function diaSiguiente(dia: number): number {
  let n = dia + 1;
  while (n <= 30 && new Date(Number(C.anio), C.mesNumero - 1, n).getDay() === 0) n++;
  return Math.min(n, 30);
}

function cambiarFecha(): PantallaDemo {
  const c = d.cambio;
  const t = d.turnos.items[0];
  const dia = diaSiguiente(t.dia);
  const franja = Math.max(0, c.franjas.indexOf(t.franja));
  const motivos = c.motivos
    .map((m, i) =>
      boton(
        { accion: 'motivo', valor: String(i), guia: i === 0, extra: 'aria-pressed="false"' },
        `${esc(m)}${i === c.motivos.length - 1 ? ` ${ic('editar')}` : ''}`,
        'de-motivo',
      ),
    )
    .join('');
  const stepper = (accion: string, subir: string, bajar: string) =>
    `<span class="de-stepper">${boton({ accion, valor: '1', etiqueta: subir }, ic('arriba'))}${boton({ accion, valor: '-1', etiqueta: bajar }, icono('abajo'))}</span>`;
  return {
    id: 'e-cambiar-fecha',
    titulo: d.pantallas.cambio,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca', false)}
<div class="app-cuerpo de-cuerpo de-cambio">
  ${volverDemo(c.titulo)}
  <p class="de-subtitulo">${esc(c.motivoTitulo)}</p>
  <div class="de-motivos">${motivos}</div>
  <p class="de-subtitulo de-subtitulo--linea">${esc(c.nuevaTitulo)}</p>
  <div class="de-campos">
    <div class="de-campo-grupo"><p class="de-label">${esc(c.mesLabel)}</p><span class="de-campo de-campo--select">${esc(C.mesTitulo)} ${icono('abajo')}</span></div>
    <div class="de-campo-grupo"><p class="de-label">${esc(c.franjaLabel)}</p><span class="de-campo"><span data-de-cambio-franja>${esc(c.franjas[franja])}</span>${stepper('franjaPaso', c.franjaSubir, c.franjaBajar)}</span></div>
    <div class="de-campo-grupo"><p class="de-label">${esc(c.diaLabel)}</p><span class="de-campo"><span data-de-cambio-dia>${dia}</span>${stepper('diaPaso', c.diaSubir, c.diaBajar)}</span></div>
    <div class="de-campo-grupo"><p class="de-label">${esc(c.anioLabel)}</p><span class="de-campo de-campo--gris">${esc(C.anio)}</span></div>
  </div>
  <p class="de-resumen" data-de-cambio-resumen aria-live="polite">${esc(
    c.resumen.replace('{dia}', diaSemana(dia)).replace('{fecha}', fechaCorta(dia)).replace('{franja}', c.franjas[franja]),
  )}</p>
  ${btn({ accion: 'proponerFecha', guia: true }, esc(c.proponer), 'de-boton--claro')}
  <p class="de-ok" data-de-cambio-ok role="status" hidden>${ic('checkCirculo')}<span>${esc(c.enviado)}</span></p>
</div>
</div>`,
  };
}

// ── Notificaciones ────────────────────────────────────────────────────────

function notificaciones(): PantallaDemo {
  const a = d.avisos;
  const items = a.items
    .map((it) => {
      const t: Toque = { ir: it.destino, guia: !!it.guia };
      if (it.turno !== undefined) Object.assign(t, { accion: 'verTurno', valor: String(it.turno) });
      const texto = it.neto ? esc(it.texto).replace('{neto}', `<strong data-de-neto>${pesos(neto(SUGERIDO))}</strong>`) : esc(it.texto);
      return `<div class="de-notif">
  ${boton(t, `<span class="de-notif__icono">${icono(it.icono)}</span><span>${texto}</span>`, 'de-notif__cuerpo')}
  ${boton({ accion: 'quitarNotif', etiqueta: a.quitar }, icono('cerrar'), 'de-notif__x')}
</div>`;
    })
    .join('');
  return {
    id: 'e-notificaciones',
    titulo: d.pantallas.notificaciones,
    html: `<div class="app de-gris">
${cabeceraGris(true)}
<div class="app-cuerpo de-cuerpo de-avisos">
  ${boton({ accion: 'borrarNotifs' }, `${esc(a.borrar)} ${ic('tacho')}`, 'de-borrar')}
  <div class="de-notif-lista" data-de-notifs>${items}</div>
  <p class="de-vacio" data-de-nada-mas>${esc(a.nadaMas)}</p>
  <p class="de-vacio de-vacio--centro" data-de-vacio hidden>${esc(a.vacio)}</p>
</div>
${navDemo(ROL, -1)}
</div>`,
  };
}

function configNotificaciones(): PantallaDemo {
  const c = d.config;
  const filas = c.items
    .map((it) =>
      boton(
        { accion: 'notifToggle', extra: `role="switch" aria-checked="${it.on}"` },
        `<span>${esc(it.texto)}</span><span class="de-check">${icono('check')}</span>`,
        'de-check-fila',
      ),
    )
    .join('');
  return {
    id: 'e-config-notificaciones',
    titulo: d.pantallas.config,
    html: `<div class="app de-gris">
${cabeceraGris(false)}
<div class="app-cuerpo de-cuerpo">
  ${volverDemo(c.titulo)}
  <div class="de-config">
    <p class="de-config__titulo">${esc(c.panel)}</p>
    <div class="de-dos">${boton({ accion: 'notifTodas', valor: '0' }, esc(c.desactivar), 'de-config__todo')}${boton({ accion: 'notifTodas', valor: '1' }, esc(c.activar), 'de-config__todo de-config__todo--claro')}</div>
    <div class="de-config__filas">${filas}</div>
  </div>
</div>
${navDemo(ROL, -1)}
</div>`,
  };
}

// ── Pedido programado ─────────────────────────────────────────────────────

function pedidoProgramado(): PantallaDemo {
  const p = d.programado;
  return {
    id: 'e-pedido-programado',
    titulo: d.pantallas.programado,
    html: `<div class="app">
${cabeceraDemo(ROL, 'azul')}
<div class="app-mapa-caja de-mapa de-mapa--pedido">
  ${mapa({ id: 'programado', vos: [126, 168], cliente: [84, 84] })}
  ${disponible(false)}
  <div class="app-pedido de-pedido de-pedido--programado" data-de-programado>
    <p class="app-pedido__titulo">${esc(p.titulo)} ${icono(p.icono)}${boton({ accion: 'rechazarProgramado', etiqueta: p.rechazar }, icono('cerrar'), 'app-x app-x--gris')}</p>
    <span class="app-tag">${icono('calendario')}${esc(C.programado)}</span>
    <p class="de-pedido__detalle">${esc(p.detalle)}</p>
    <small>${esc(p.sugeridoLabel)}</small>
    <p class="app-pedido__precio">${pesos(p.sugerido)}</p>
    <p class="de-mini-titulo">${esc(p.diaLabel)}</p>
    <div class="de-pastillas"><span class="de-pastilla">${esc(p.dia)}</span><span class="de-pastilla">${esc(p.franja)}</span></div>
    <p class="de-mini-titulo">${esc(p.ubicacionLabel)}</p>
    <p class="de-ubicacion">${icono('pin')}${esc(p.ubicacion)}</p>
    ${btn({ accion: 'aceptarProgramado', guia: true }, esc(p.aceptar))}
    ${btn({ ir: 'e-precio' }, esc(p.cambiar), 'app-boton--contorno')}
    <p class="de-pedido__pie">${esc(p.pie)} ${icono('calendario')}</p>
  </div>
  ${aviso(p.enviadoTitulo.replace('{monto}', formatoPesos(p.sugerido)), p.enviadoTexto, 'data-de-programado-aviso')}
</div>
${navDemo(ROL, 0)}
</div>`,
  };
}

// ── Cuenta ────────────────────────────────────────────────────────────────

function filaCuenta(t: Toque, nombreIcono: string, texto: string): string {
  return boton(t, `${ic(nombreIcono)}<span>${esc(texto)}</span>${icono('flecha', 'icono de-fila-cuenta__flecha')}`, 'de-fila-cuenta');
}

function misRubros(): string {
  const activos = d.rubrosHoja.rubrosActivos as string[];
  return rubros.rubros
    .map((r) => `<span class="de-mi-rubro" data-de-mi-rubro="${r.id}"${activos.includes(r.id) ? '' : ' hidden'}>${icono(r.icono)}${esc(r.nombre)}</span>`)
    .join('');
}

function cuenta(): PantallaDemo {
  const c = d.cuenta;
  return {
    id: 'e-cuenta',
    titulo: d.pantallas.cuenta,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca')}
<div class="app-cuerpo de-cuerpo de-cuenta">
  <div class="de-perfil">
    <span class="de-perfil__foto">${icono('usuario')}<span class="de-perfil__camara" title="${esc(c.cambiarFoto)}">${icono('camara')}</span></span>
    <p class="de-perfil__nombre">${esc(c.nombre)}</p>
    <p class="de-perfil__rubros" data-de-mis-rubros>${misRubros()}</p>
    <span class="app-verificado de-perfil__ok">${icono('verificado')}${esc(c.verificado)}</span>
  </div>
  <p class="de-seccion">${esc(c.seccionCuenta)}</p>
  <div class="de-filas-cuenta">
    ${filaCuenta({ ir: 'e-datos' }, 'usuario', c.datos)}
    ${filaCuenta({ ir: 'e-rubros' }, 'maletin', c.rubros)}
    ${filaCuenta({ ir: 'e-caja', guia: true }, 'billetera', c.cobro)}
  </div>
  <p class="de-seccion">${esc(c.seccionConfig)}</p>
  <div class="de-filas-cuenta">${filaCuenta({ ir: 'e-config-notificaciones' }, 'campana', c.notificaciones)}</div>
  <div class="de-dos de-dos--cuenta">
    ${btn({ ir: 'e-salir' }, `${esc(c.salir)} ${ic('salir')}`, 'de-boton--rojo de-boton-icono')}
    ${btn({ ir: 'e-ayuda' }, `${esc(c.ayuda)} ${ic('pregunta')}`, 'de-boton-icono')}
  </div>
</div>
${navDemo(ROL, 3)}
</div>`,
  };
}

// ── Caja ──────────────────────────────────────────────────────────────────

function movimiento(titulo: string, nombreIcono: string, fecha: string, presupuesto: number, abierto: boolean, hoy = false): string {
  return `<div class="app-tarjeta de-movimiento"${hoy ? ' data-de-mov-hoy' : ''}>
  <div class="app-tarjeta__cuerpo">
    <span class="app-tarjeta__datos"><strong>${esc(titulo)} ${icono(nombreIcono)}</strong><small>${esc(fecha)}</small></span>
    <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--verde" data-de-mov-neto>+ ${pesos(neto(presupuesto))}</span><small>${esc(C.aTuCuenta)}</small></span>
  </div>
  <div class="de-costo de-costo--mov" data-de-mov-desglose${abierto ? '' : ' hidden'}>${desglose(presupuesto)}</div>
  ${boton({ accion: 'verMas', extra: `aria-expanded="${abierto}"` }, esc(abierto ? C.verMenos : C.verMas), 'app-tarjeta__franja')}
</div>`;
}

function caja(): PantallaDemo {
  const c = d.caja;
  const lista = [
    movimiento(c.trabajoHoy, c.iconoHoy, c.hoy, SUGERIDO, true, true),
    ...c.movimientos.map((m) => movimiento(m.rubro, m.icono, m.fecha, m.presupuesto, false)),
  ].join('');
  return {
    id: 'e-caja',
    titulo: d.pantallas.caja,
    html: `<div class="app">
${cabeceraDemo(ROL, 'blanca')}
<div class="app-cuerpo app-cuerpo--ajustado de-caja">
  ${volverDemo(c.titulo)}
  <div class="de-dupla de-dupla--caja">
    <div><p class="app-label">${esc(c.cbuLabel)}</p><p class="app-valor">${esc(c.cbu)}</p></div>
    <div><p class="app-label">${esc(c.aliasLabel)}</p><p class="app-valor">${esc(c.alias)}</p></div>
  </div>
  ${btn({ ir: 'e-editar-cobro' }, esc(c.editar))}
</div>
${hoja(c.panel, `<div class="app-lista de-lista">${lista}</div>`, 'app-hoja--llena')}
</div>`,
  };
}

// ── Mensajes ──────────────────────────────────────────────────────────────

function mensajes(): PantallaDemo {
  const m = d.mensajes;
  const filas = (m.orden as IdChat[])
    .map((id, i) => {
      const ch = d.chats[id];
      const ultimo = ch.mensajes[ch.mensajes.length - 1];
      const badge = ch.noLeidos
        ? `<span class="de-badge${i % 2 ? ' de-badge--amarillo' : ''}" data-de-badge="${id}" aria-label="${esc(m.noLeidos.replace('{n}', String(ch.noLeidos)))}">${ch.noLeidos}</span>`
        : '';
      return boton(
        { accion: 'abrirChat', valor: id, ir: 'e-chat' },
        `<span class="de-chat-fila__avatar">${icono('usuario')}</span><span class="de-chat-fila__texto"><strong>${esc(ch.nombre)}</strong><small data-de-ultimo="${id}">${esc(ultimo.texto)}</small></span>${badge}`,
        'de-chat-fila',
      );
    })
    .join('');
  const ayuda = boton(
    { ir: 'e-ayuda' },
    `<span class="de-chat-fila__avatar de-chat-fila__avatar--ayuda">${ic('pregunta')}</span><span class="de-chat-fila__texto"><strong>${esc(m.ayuda)}</strong><small>${esc(m.ayudaTexto)}</small></span>`,
    'de-chat-fila',
  );
  return {
    id: 'e-mensajes',
    titulo: d.pantallas.mensajes,
    html: `<div class="app">
<div class="app-cabecera app-cabecera--azul">
  ${estado(true)}
  <div class="app-cabecera__fila">${logo}${boton({ ir: 'e-contactos' }, `${esc(m.contactos)} ${ic('contactos')}`, 'de-contactos-btn')}</div>
</div>
<div class="app-cuerpo de-cuerpo de-mensajes">
  <div class="de-chat-lista">${filas}${ayuda}</div>
  <p class="de-vacio de-vacio--claro">${esc(m.nota)}</p>
</div>
${navDemo(ROL, 2)}
</div>`,
  };
}

// ── Hojas chicas ──────────────────────────────────────────────────────────

function contactos(): PantallaDemo {
  const c = d.contactos;
  const filas = (d.mensajes.orden as IdChat[])
    .map((id) => {
      const ch = d.chats[id];
      return `<div class="de-contacto"><span class="de-chat-fila__avatar">${icono('usuario')}</span><span class="de-chat-fila__texto"><strong>${esc(ch.nombre)}</strong><small>${esc(ch.sub)}</small></span>${boton(
        { accion: 'abrirChat', valor: id, ir: 'e-chat', etiqueta: c.escribir.replace('{nombre}', ch.nombre) },
        icono('enviar'),
        'de-contacto__enviar',
      )}</div>`;
    })
    .join('');
  return { id: 'e-contactos', titulo: d.pantallas.contactos, tipo: 'hoja', html: `${tituloHoja(c.titulo)}<div class="de-contactos">${filas}</div>` };
}

function ayuda(): PantallaDemo {
  const a = d.ayuda;
  const items = a.preguntas
    .map(
      (q) =>
        `<div class="de-pregunta">${boton({ accion: 'pregunta', extra: 'aria-expanded="false"' }, `<span>${esc(q.pregunta)}</span>${icono('abajo')}`, 'de-pregunta__boton')}<p class="de-pregunta__respuesta" hidden>${plano(q.respuesta)}</p></div>`,
    )
    .join('');
  return { id: 'e-ayuda', titulo: d.pantallas.ayuda, tipo: 'hoja', html: `${tituloHoja(a.titulo)}<div class="de-preguntas">${items}</div>` };
}

function rubrosHoja(): PantallaDemo {
  const r = d.rubrosHoja;
  const activos = r.rubrosActivos as string[];
  const mosaicos = rubros.rubros
    .map((x) =>
      boton(
        { accion: 'toggleRubro', valor: x.id, extra: `aria-pressed="${activos.includes(x.id)}"` },
        `${icono(x.icono)}<span>${esc(x.corto ?? x.nombre)}</span>`,
        'app-mosaico de-mosaico',
      ),
    )
    .join('');
  const zonas = r.zonas
    .map((z, i) =>
      boton({ accion: 'toggleZona', valor: String(i), extra: `aria-pressed="${r.zonasActivas.includes(i)}"` }, esc(z), 'app-chip de-chip de-zona'),
    )
    .join('');
  return {
    id: 'e-rubros',
    titulo: d.pantallas.rubros,
    tipo: 'hoja',
    html: `${tituloHoja(r.titulo)}
<p class="de-label">${esc(r.rubrosLabel)}</p>
<div class="app-grilla de-grilla">${mosaicos}</div>
<p class="de-label">${esc(r.zonasLabel)}</p>
<div class="de-chips">${zonas}</div>
${btn({ accion: 'guardarRubros', volver: true }, esc(r.guardar))}`,
  };
}

function datos(): PantallaDemo {
  const x = d.datos;
  const filas = x.filas
    .map((f) => `<p class="de-dato"><span>${esc(f.label)}</span><strong${f.ok ? ' class="de-dato--ok"' : ''}>${f.ok ? icono('verificado') : ''}${esc(f.valor)}</strong></p>`)
    .join('');
  return {
    id: 'e-datos',
    titulo: d.pantallas.datos,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}<div class="de-datos">${filas}</div>${btn({ volver: true }, esc(x.listo))}`,
  };
}

function cobro(): PantallaDemo {
  const x = d.cobro;
  return {
    id: 'e-editar-cobro',
    titulo: d.pantallas.cobro,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}
<p class="de-label">${esc(x.cbuLabel)}</p><span class="app-campo de-campo-hoja">${esc(d.caja.cbu)}</span>
<p class="de-label">${esc(x.aliasLabel)}</p><span class="app-campo de-campo-hoja">${esc(d.caja.alias)} ${ic('editar')}</span>
<p class="app-sheet__nota">${plano(x.nota)}</p>
${btn({ volver: true }, esc(x.guardar))}`,
  };
}

function confirmar(id: string, titulo: string, x: { titulo: string; texto: string; si: string; no: string }, accion: string): PantallaDemo {
  return {
    id,
    titulo,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}
<p class="de-confirmar">${esc(x.texto)}</p>
${btn({ accion }, esc(x.si), 'de-boton--rojo')}
${btn({ volver: true }, esc(x.no), 'app-boton--contorno')}`,
  };
}

// ── Rol ───────────────────────────────────────────────────────────────────

export function demoEspecialista(): DemoRol {
  return {
    inicio: 'e-inicio',
    pantallas: [
      inicio(),
      precio(),
      aceptado(),
      enCamino(),
      chat(),
      trabajo(),
      fin(),
      turnos(),
      detalle(),
      cambiarFecha(),
      notificaciones(),
      configNotificaciones(),
      pedidoProgramado(),
      cuenta(),
      caja(),
      mensajes(),
      contactos(),
      ayuda(),
      rubrosHoja(),
      datos(),
      cobro(),
      confirmar('e-cancelar', d.pantallas.cancelar, d.cancelar, 'confirmarCancelar'),
      confirmar('e-salir', d.pantallas.salir, d.salir, 'salir'),
    ],
    recorrido: d.recorrido,
  };
}
