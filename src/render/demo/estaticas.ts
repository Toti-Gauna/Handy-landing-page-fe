// Pantallas de la demo como imágenes vivas para los celulares de la landing: el mismo HTML que arma la demo
// (src/render/demo/usuario.ts y especialista.ts), sin interacción (el celular de la landing es decorativo e inert).
// Así la landing muestra exactamente lo que hace la app de la demo, sin mantener dos versiones de cada pantalla.
//
// Los ids se renombran por instancia (una misma pantalla puede aparecer dos veces en la página: en la vitrina fija y
// en el paso del celular) y los mapas quedan con la ruta dibujada y el especialista viajando.

import { demoUsuario } from './usuario.ts';
import { demoEspecialista } from './especialista.ts';
import type { PantallaDemo, RolDemo } from './tipos.ts';
import { conAgendaEnDiaConTrabajos } from './comunes.ts';

/** Pantalla de fondo para las hojas (una hoja se ve encima de otra pantalla). */
const FONDOS: Record<string, string> = {
  'u-opciones': 'u-inicio',
  'u-cambiar': 'u-turno-detalle',
  'e-precio': 'e-inicio',
  'e-adicional': 'e-trabajo',
  'e-propuesta': 'e-chat-nuevo',
};

let indice: Map<string, { rol: RolDemo; p: PantallaDemo }> | null = null;

function pantallas() {
  if (!indice) {
    const mapa = new Map<string, { rol: RolDemo; p: PantallaDemo }>();
    // La agenda, en un día con trabajos (no "hoy", que en la landing todavía está vacío).
    conAgendaEnDiaConTrabajos(() => {
      for (const p of demoUsuario().pantallas) mapa.set(p.id, { rol: 'usuario', p });
      for (const p of demoEspecialista().pantallas) mapa.set(p.id, { rol: 'especialista', p });
    });
    indice = mapa;
  }
  return indice;
}

export const esPantallaDemo = (id: string) => /^[ue]-/.test(id) && pantallas().has(id);

export function tituloPantallaDemo(id: string): string {
  return pantallas().get(id)?.p.titulo ?? id;
}

let instancia = 0;

/** Renombra ids y referencias (href="#…", url(#…), aria-*, for) para que no se repitan en la página. */
function idsUnicos(html: string, sufijo: string): string {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return html;
  const ren = (id: string) => (ids.has(id) ? `${id}${sufijo}` : id);
  return html
    .replace(/(\sid=")([^"]+)(")/g, (_, a, id, c) => `${a}${ren(id)}${c}`)
    .replace(/((?:xlink:)?href=")#([^"]+)(")/g, (_, a, id, c) => `${a}#${ren(id)}${c}`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ren(id)})`)
    .replace(/(\s(?:aria-labelledby|aria-describedby|aria-controls|for)=")([^"]+)(")/g, (_, a, lista: string, c) => `${a}${lista.split(/\s+/).map(ren).join(' ')}${c}`);
}

/** Mapas: ruta dibujada y especialista que sale apenas carga la página (en la demo lo arranca el motor). */
const mapasVivos = (html: string) => html.replace(/class="hd-mapa(?=[\s"])/g, 'class="hd-mapa hd-mapa--ruta').replace(/begin="indefinite"/g, 'begin="0.8s"');

function capa(rol: RolDemo, p: PantallaDemo, sufijo: string): string {
  const html = mapasVivos(idsUnicos(p.html, sufijo));
  if (p.tipo === 'hoja') {
    return `<div class="demo-pantalla demo-pantalla--hoja" data-tipo="hoja" data-rol="${rol}" data-pantalla="${p.id}"><span class="demo-velo"></span><div class="app-sheet demo-hoja">${html}</div></div>`;
  }
  return `<div class="demo-pantalla" data-tipo="pantalla" data-rol="${rol}" data-pantalla="${p.id}">${html}</div>`;
}

/** HTML de una pantalla de la demo (con su fondo si es una hoja), listo para ir dentro de .telefono__pantalla. */
export function pantallaDemoEstatica(id: string): string {
  const x = pantallas().get(id);
  if (!x) throw new Error(`Pantalla de la demo inexistente: "${id}"`);
  const sufijo = `--l${++instancia}`;
  const fondo = x.p.tipo === 'hoja' ? pantallas().get(FONDOS[id] ?? (x.rol === 'usuario' ? 'u-inicio' : 'e-inicio')) : undefined;
  return `${fondo ? capa(fondo.rol, fondo.p, sufijo + 'f') : ''}${capa(x.rol, x.p, sufijo)}`;
}
