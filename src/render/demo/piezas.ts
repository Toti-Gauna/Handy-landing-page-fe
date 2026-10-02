// Piezas interactivas para las pantallas de la demo. Mismo aspecto que las de src/render/pantallas.ts
// (las reutilizan), pero lo que se toca es un <button> con los atributos del contrato (ver tipos.ts).

import demo from '../../content/demo.json' with { type: 'json' };
import p from '../../content/pantallas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc } from '../util.ts';
import { estado, logo } from '../pantallas.ts';
import type { RolDemo } from './tipos.ts';

export const prefijo = (rol: RolDemo) => (rol === 'usuario' ? 'u' : 'e');

export interface Toque {
  /** data-ir */
  ir?: string;
  /** data-ir-raiz */
  raiz?: string;
  /** data-volver */
  volver?: boolean;
  /** data-accion */
  accion?: string;
  /** data-valor */
  valor?: string;
  /** data-guia: lo próximo para tocar en el recorrido */
  guia?: boolean;
  /** aria-label (si el botón no tiene texto visible) */
  etiqueta?: string;
  /** atributos extra ya escapados, por ejemplo 'aria-pressed="false"' */
  extra?: string;
}

/** Atributos del contrato para un elemento tocable. */
export function atributos(t: Toque): string {
  const a: string[] = [];
  if (t.ir) a.push(`data-ir="${esc(t.ir)}"`);
  if (t.raiz) a.push(`data-ir-raiz="${esc(t.raiz)}"`);
  if (t.volver) a.push('data-volver');
  if (t.accion) a.push(`data-accion="${esc(t.accion)}"`);
  if (t.valor !== undefined) a.push(`data-valor="${esc(t.valor)}"`);
  if (t.guia) a.push('data-guia');
  if (t.etiqueta) a.push(`aria-label="${esc(t.etiqueta)}"`);
  if (t.extra) a.push(t.extra);
  return a.join(' ');
}

/** <button> tocable. `contenido` ya es HTML. */
export function boton(t: Toque, contenido: string, clase = ''): string {
  return `<button type="button" class="${clase}" ${atributos(t)}>${contenido}</button>`;
}

/** Cabecera de la app (blanca o azul) con la campana que lleva a <p>-notificaciones. */
export function cabeceraDemo(rol: RolDemo, variante: 'blanca' | 'azul', conPin = true): string {
  const pre = prefijo(rol);
  const campana = boton(
    { ir: `${pre}-notificaciones`, etiqueta: demo.ui.notificaciones },
    icono('campana'),
    'app-cuadrado',
  );
  const pinBtn = conPin ? `<span class="app-cuadrado" aria-hidden="true">${icono('pin')}</span>` : '';
  return `<div class="app-cabecera app-cabecera--${variante}">
  ${estado(variante === 'azul')}
  <div class="app-cabecera__fila">${logo}<span class="app-cabecera__botones">${campana}${pinBtn}</span></div>
</div>`;
}

/** Barra inferior: Inicio, Turnos, Mensajes, Cuenta. `activo` = índice 0..3 (o -1 para ninguno). */
export function navDemo(rol: RolDemo, activo: number): string {
  const pre = prefijo(rol);
  const destinos = [`${pre}-inicio`, `${pre}-turnos`, `${pre}-mensajes`, `${pre}-cuenta`];
  return `<nav class="app-nav" aria-label="${esc(demo.ui.navegacion)}">${p.nav
    .map((n, i) =>
      boton(
        { raiz: destinos[i], extra: i === activo ? 'aria-current="page"' : '' },
        `${icono(n.icono)}${esc(n.texto)}`,
        `app-nav__item${i === activo ? ' app-nav__item--activo' : ''}`,
      ),
    )
    .join('')}</nav>`;
}

/** Fila "← Título" con la flecha que vuelve. */
export function volverDemo(titulo: string): string {
  return `<p class="app-volver">${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-volver__flecha')}<span>${esc(titulo)}</span></p>`;
}

/** Título de una hoja inferior con la X roja que la cierra. */
export function tituloHoja(texto: string): string {
  return `<p class="app-sheet__titulo">${esc(texto)}${boton({ volver: true, etiqueta: demo.ui.cerrar }, icono('cerrar'), 'app-x')}</p>`;
}

/** Tarjeta blanca con franja gris; la franja es el botón (como "Ver más información"). */
export function tarjetaDemo(cuerpo: string, franja: string, t: Toque = {}): string {
  return `<div class="app-tarjeta"><div class="app-tarjeta__cuerpo">${cuerpo}</div>${boton(t, esc(franja), 'app-tarjeta__franja')}</div>`;
}
