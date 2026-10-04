// Piezas comunes a los dos lados de la demo (se arman en build; el comportamiento está en src/scripts/demo/comunes.ts).
//
// - cabeceraChat(): la de todos los chats. Sin logo ni campana: volver, quién es y nada más.
// - accionesChat(): "Programar turno", "Quiero un turno ahora" y "Agregar a contactos".
// - agenda(): calendario del mes + los trabajos del día tocado (cualquier día se puede tocar).
// - pantallasComunes(): hojas para elegir fecha y hora, y la pantalla completa de Contactos.
//
// Lo dinámico se arma en el navegador a partir de lo que deja el build: los trabajos de la agenda y los contactos
// van todos en el HTML (ocultos) y el script muestra los que corresponden.

import demo from '../../content/demo.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc } from '../util.ts';
import { estado } from '../pantallas.ts';
import { avatar, boton, prefijo, tituloHoja, type Toque } from './piezas.ts';
import type { PantallaDemo, RolDemo } from './tipos.ts';

const completar = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

// ── Chats ─────────────────────────────────────────────────────────────────

export interface Interlocutor {
  nombre: string;
  /** Segunda línea: rubro, "Asistente de Handy"… */
  detalle: string;
  /** HTML del avatar (por defecto, iniciales). */
  avatar?: string;
  verificado?: boolean;
}

/**
 * Cabecera de un chat: barra de estado (que en el modo app es el margen seguro), volver e identidad.
 * Sin el logo de Handy ni la campana de avisos.
 */
export function cabeceraChat(quien: Interlocutor, volver: Toque = { volver: true }, extra = ''): string {
  const av = quien.avatar ?? avatar(quien.nombre, { verificado: quien.verificado, tamano: 'chico' });
  return `<div class="hd-chat-cabecera">
  ${estado(false)}
  <div class="hd-chat-cabecera__fila">
    ${boton({ etiqueta: demo.ui.volver, ...volver }, icono('atras'), 'hd-chat-cabecera__volver')}
    ${av}
    <p class="hd-chat-cabecera__quien"><strong>${esc(quien.nombre)}</strong><small>${esc(quien.detalle)}</small></p>
    ${extra}
  </div>
</div>`;
}

/**
 * Acciones de un chat con un especialista o un cliente. `contacto`: id del contacto para "Agregar a contactos"
 * (en un chat nuevo); sin id no se muestra.
 */
export function accionesChat(o: { contacto?: string; programar?: Toque; ahora?: Toque; guia?: 'programar' | 'ahora' | 'contacto' } = {}): string {
  const c = demo.chatTurnos;
  const k = demo.contactos;
  const contacto = o.contacto
    ? `<button type="button" class="hd-chip hd-chip--tinte hd-contacto-btn" data-accion="hd-contacto-agregar" data-valor="${esc(o.contacto)}" data-hd-contacto-btn="${esc(o.contacto)}" aria-pressed="false"${o.guia === 'contacto' ? ' data-guia' : ''}>
    <span class="hd-contacto-btn__agregar">${icono('mas')}${esc(k.agregar)}</span><span class="hd-contacto-btn__listo">${icono('check')}${esc(k.agregado)}</span>
  </button>`
    : '';
  return `<div class="hd-chat-acciones">
  ${contacto}
  ${boton({ accion: 'chat-programar', ...o.programar, guia: o.guia === 'programar' }, `${icono('calendario')}${esc(c.programar)}`, 'hd-chip hd-chip--azul')}
  ${boton({ accion: 'chat-ahora', ...o.ahora, guia: o.guia === 'ahora' }, `${icono('alerta')}${esc(c.ahora)}`, 'hd-chip hd-chip--amarillo')}
</div>`;
}

// ── Agenda ────────────────────────────────────────────────────────────────

export interface TrabajoAgendaHtml {
  id: string;
  /** "2026-11-19" */
  fecha: string;
  /** Tarjeta del trabajo (con su botón para abrir el detalle). */
  html: string;
}

/**
 * Agenda: mes con flechas, días que se pueden tocar todos (con un punto por trabajo) y la lista del día elegido.
 * `inicial`: día elegido al entrar ("hoy" de la demo si no se dice).
 */
export function agenda(rol: RolDemo, trabajos: TrabajoAgendaHtml[], inicial = demo.config.hoy): string {
  const a = demo.agenda;
  const s = demo.selectorFecha;
  const items = trabajos
    .map((t) => `<li class="hd-agenda__trabajo" data-hd-trabajo="${esc(t.id)}" data-fecha="${esc(t.fecha)}" data-entra hidden>${t.html}</li>`)
    .join('');
  return `<div class="hd-agenda" data-hd-agenda data-rol-agenda="${rol}" data-inicial="${esc(inicial)}" data-fechas="${esc(JSON.stringify(trabajos.map((t) => t.fecha)))}">
  <div class="hd-agenda__mes">
    <button type="button" class="hd-circulo" data-accion="hd-agenda-mes" data-valor="-1" aria-label="${esc(a.anterior)}">${icono('izquierda')}</button>
    <p class="hd-agenda__titulo" data-hd-agenda-titulo aria-live="polite"></p>
    <button type="button" class="hd-circulo" data-accion="hd-agenda-mes" data-valor="1" aria-label="${esc(a.siguiente)}">${icono('derecha')}</button>
  </div>
  <div class="hd-cal__semana" aria-hidden="true">${s.semana.map((d) => `<span>${esc(d)}</span>`).join('')}</div>
  <div class="hd-cal__grilla" data-hd-agenda-grilla role="group" aria-label="${esc(a.titulo)}"></div>
</div>
<section class="hd-agenda__dia" data-hd-agenda-dia aria-live="polite">
  <p class="hd-sobre hd-agenda__fecha" data-hd-agenda-fecha></p>
  <ul class="hd-agenda__lista">${items}</ul>
  <div class="hd-agenda__vacio" data-hd-agenda-vacio hidden>
    <img class="hd-handy" src="/src/img/handy-lamparita.webp" alt="" width="202" height="346" loading="lazy" decoding="async" />
    <p><strong>${esc(a.vacioTitulo)}</strong><small>${esc(a.vacioTexto)}</small></p>
  </div>
</section>`;
}

// ── Contactos ─────────────────────────────────────────────────────────────

export interface ContactoDemo {
  id: string;
  nombre: string;
  detalle: string;
  /** Pantalla del chat con ese contacto. */
  chat: string;
  /** Ya estaba guardado al empezar la demo (si no, aparece cuando se lo agrega desde un chat). */
  guardado: boolean;
  tono?: string;
  /** Iniciales del avatar, si no se quieren las que salen del nombre. */
  iniciales?: string;
  /** Acción extra del botón de la fila (p. ej., elegir qué conversación abrir). */
  toque?: Toque;
}

function pantallaContactos(rol: RolDemo, contactos: ContactoDemo[]): PantallaDemo {
  const k = demo.contactos;
  const pre = prefijo(rol);
  const filas = contactos
    .map(
      (c) => `<li class="hd-contacto" data-hd-contacto="${esc(c.id)}" data-guardado="${c.guardado}"${c.guardado ? '' : ' hidden'}>
  ${avatar(c.nombre, { tono: c.tono, iniciales: c.iniciales })}
  <p class="hd-contacto__texto"><strong>${esc(c.nombre)}</strong><small>${esc(c.detalle)}</small></p>
  ${boton({ ...c.toque, ir: c.chat, etiqueta: completar(k.escribir, { nombre: c.nombre }) }, icono('enviar'), 'hd-circulo hd-circulo--azul')}
</li>`,
    )
    .join('');
  return {
    id: `${pre}-contactos`,
    titulo: k.titulo,
    html: `<div class="app hd-pantalla-contactos">
${cabeceraChat({ nombre: k.titulo, detalle: '', avatar: `<span class="hd-fila__ico" aria-hidden="true">${icono('contactos')}</span>` })}
<div class="hd-scroll hd-contactos">
  <p class="hd-texto hd-texto--suave" data-entra>${esc(k.bajada)}</p>
  <ul class="hd-lista hd-contactos__lista" data-hd-contactos data-entra>${filas}</ul>
  <p class="hd-contactos__vacio" data-hd-contactos-vacio hidden>${esc(k.vacio)}</p>
</div>
</div>`,
  };
}

// ── Elegir fecha y hora (hojas) ───────────────────────────────────────────

function hojaFecha(rol: RolDemo): PantallaDemo {
  const s = demo.selectorFecha;
  return {
    id: `${prefijo(rol)}-elegir-fecha`,
    titulo: s.titulo,
    tipo: 'hoja',
    html: `${tituloHoja(s.titulo)}
<div class="hd-selector" data-hd-sel-fecha>
  <div class="hd-agenda__mes">
    <button type="button" class="hd-circulo" data-accion="hd-fecha-mes" data-valor="-1" aria-label="${esc(s.anterior)}">${icono('izquierda')}</button>
    <p class="hd-agenda__titulo" data-hd-sel-titulo aria-live="polite"></p>
    <button type="button" class="hd-circulo" data-accion="hd-fecha-mes" data-valor="1" aria-label="${esc(s.siguiente)}">${icono('derecha')}</button>
  </div>
  <div class="hd-cal__semana" aria-hidden="true">${s.semana.map((d) => `<span>${esc(d)}</span>`).join('')}</div>
  <div class="hd-cal__grilla" data-hd-sel-grilla role="group" aria-label="${esc(s.titulo)}"></div>
  <p class="hd-selector__nota">${icono('info')}<span>${esc(s.nota)}</span></p>
  <button type="button" class="hd-boton" data-accion="hd-fecha-listo" data-hd-sel-listo disabled>${esc(s.sinElegir)}</button>
</div>`,
  };
}

const ruedita = (tipo: 'h' | 'm', n: number, etiqueta: string) =>
  `<div class="hd-rueda" data-hd-rueda="${tipo}" role="listbox" aria-label="${esc(etiqueta)}" tabindex="0">
  <span class="hd-rueda__relleno" aria-hidden="true"></span>
  ${Array.from({ length: n }, (_, i) => {
    const v = String(i).padStart(2, '0');
    return `<button type="button" class="hd-rueda__op" role="option" aria-selected="false" data-accion="hd-hora-op" data-tipo="${tipo}" data-valor="${i}">${v}</button>`;
  }).join('')}
  <span class="hd-rueda__relleno" aria-hidden="true"></span>
</div>`;

function hojaHora(rol: RolDemo): PantallaDemo {
  const s = demo.selectorHora;
  return {
    id: `${prefijo(rol)}-elegir-hora`,
    titulo: s.titulo,
    tipo: 'hoja',
    html: `${tituloHoja(s.titulo)}
<div class="hd-selector" data-hd-sel-hora>
  <div class="hd-ruedas">
    <span class="hd-ruedas__banda" aria-hidden="true"></span>
    ${ruedita('h', 24, s.horas)}
    <span class="hd-ruedas__dos" aria-hidden="true">:</span>
    ${ruedita('m', 60, s.minutos)}
  </div>
  <p class="hd-selector__nota">${icono('info')}<span>${esc(s.nota)}</span></p>
  <button type="button" class="hd-boton" data-accion="hd-hora-listo" data-hd-sel-listo></button>
</div>`,
  };
}

/** Pantallas que cada rol suma a las suyas: elegir fecha, elegir hora y Contactos. */
export function pantallasComunes(rol: RolDemo, contactos: ContactoDemo[]): PantallaDemo[] {
  return [hojaFecha(rol), hojaHora(rol), pantallaContactos(rol, contactos)];
}

// ── Tarjetas del chat (solicitud, propuesta, cambio, adicional) ───────────
// Las arma el navegador a partir de este molde (va una vez en la página, ver pagina.ts).

export function moldesChat(): string {
  const c = demo.chatTurnos;
  return `<template data-hd-molde="propuesta">
  <div class="hd-propuesta" data-hd-propuesta data-estado="pendiente" data-entra="pop">
    <p class="hd-propuesta__tipo"><span data-slot="icono"></span><span data-slot="tipo"></span></p>
    <dl class="hd-propuesta__datos" data-slot="datos"></dl>
    <p class="hd-propuesta__nota" data-slot="nota"></p>
    <div class="hd-propuesta__acciones" data-slot="acciones">
      <button type="button" class="hd-boton hd-boton--chico hd-boton--claro" data-accion="hd-propuesta" data-valor="rechazar">${esc(c.rechazar)}</button>
      <button type="button" class="hd-boton hd-boton--chico hd-boton--exito" data-accion="hd-propuesta" data-valor="aceptar">${icono('check')}${esc(c.aceptar)}</button>
    </div>
    <p class="hd-propuesta__estado" data-slot="estado"></p>
  </div>
</template>`;
}
