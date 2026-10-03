// Mapa vivo de la demo: un Mar del Plata estilizado (manzanas, avenidas, la costa con olas que se mueven),
// con tu casa, el especialista y la ruta entre los dos. Lo animan las clases de demo-app.css y el motor:
//   - .hd-mapa--ruta en el contenedor: la ruta se dibuja (el motor la pone al entrar a la pantalla).
//   - [data-hd-viaje] (animateMotion): el especialista recorre la ruta; el motor llama a beginElement().
//   - radar: anillos que salen de tu casa mientras se busca.
// Las coordenadas son del viewBox (360 × 640, el celular parado); el SVG se recorta con "slice".

import demo from '../../content/demo.json' with { type: 'json' };
import { esc } from '../util.ts';

export interface OpcionesMapa {
  /** Prefijo único para los ids del SVG (dos mapas en la misma página no pueden compartirlos). */
  id: string;
  /** Muestra la ruta del especialista a tu casa. */
  ruta?: boolean;
  /** Muestra al especialista (al principio de la ruta, o donde diga `esp`). */
  especialista?: string | false;
  /** El especialista recorre la ruta (animateMotion, lo arranca el motor). Segundos. */
  viaje?: number;
  /** Radar de búsqueda alrededor de tu casa. */
  radar?: boolean;
  /** Otros especialistas dando vueltas (puntitos), mientras se busca. */
  otros?: boolean;
  /** Dónde está tu casa (para encuadrar distinto en cada pantalla). */
  casa?: [number, number];
  /** Clase extra del contenedor. */
  clase?: string;
}

// Calles: grilla de 48 px (manzanas de 38 + calle de 10), avenidas más anchas.
const CASA: [number, number] = [188, 262];
const RUTA_INICIO: [number, number] = [44, 548];

/** Ruta en ángulos rectos por las calles, desde (x0, y0) hasta la casa. */
function ruta([x0, y0]: [number, number], [x1, y1]: [number, number]): string {
  return `M${x0} ${y0} H${x0 + 96} V${y0 - 144} H${x1 - 48} V${y1 + 48} H${x1} V${y1}`;
}

function largo([x0, y0]: [number, number], [x1, y1]: [number, number]): number {
  return Math.round(96 + 144 + Math.abs(x1 - 48 - (x0 + 96)) + Math.abs(y0 - 144 - (y1 + 48)) + 48 + 48);
}

export function mapaVivo(o: OpcionesMapa): string {
  const id = esc(o.id);
  const casa = o.casa ?? CASA;
  const d = ruta(RUTA_INICIO, casa);
  const l = largo(RUTA_INICIO, casa);
  const c = demo.mapa.calles;
  const esp = o.especialista
    ? `<g class="hd-mapa__esp" ${o.viaje ? '' : `transform="translate(${o.ruta ? RUTA_INICIO.join(' ') : '96 420'})"`}>
    ${o.viaje ? `<animateMotion data-hd-viaje begin="indefinite" dur="${o.viaje}s" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.25 1"><mpath href="#${id}-ruta"/></animateMotion>` : ''}
    <circle r="17" fill="#fff" opacity="0.6"/>
    <circle r="13.5" fill="#1F57A8" stroke="#fff" stroke-width="3"/>
    <text y="4.6" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="12" fill="#fff">${esc(o.especialista)}</text>
  </g>`
    : '';
  const otros = o.otros
    ? `<g fill="#1F57A8" stroke="#fff" stroke-width="2.5">
    <circle r="6"><animateMotion dur="9s" repeatCount="indefinite" path="M60 120 H156 V216 H60 Z"/></circle>
    <circle r="6"><animateMotion dur="11s" repeatCount="indefinite" path="M252 360 V456 H108 V360 Z"/></circle>
    <circle r="6"><animateMotion dur="8s" repeatCount="indefinite" path="M12 312 H108 V408 H12 Z"/></circle>
  </g>`
    : '';
  return `<div class="hd-mapa${o.clase ? ' ' + o.clase : ''}" data-hd-mapa style="--largo:${l}" aria-hidden="true">
<svg viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice">
  <defs>
    <pattern id="${id}-manzanas" width="48" height="48" patternUnits="userSpaceOnUse">
      <rect width="48" height="48" fill="#fff"/>
      <rect x="5" y="5" width="38" height="38" rx="5" fill="#E6E9EE"/>
    </pattern>
  </defs>
  <rect width="360" height="640" fill="#fff"/>
  <path d="M0 0 H262 C246 96 280 170 262 250 C246 330 300 410 290 500 C284 560 322 600 316 640 H0 Z" fill="url(#${id}-manzanas)"/>
  <g fill="#D7EBCF">
    <rect x="101" y="197" width="38" height="38" rx="5"/>
    <rect x="53" y="389" width="86" height="38" rx="5"/>
  </g>
  <g stroke="#fff" stroke-width="13" stroke-linecap="square">
    <path d="M0 144 H262"/>
    <path d="M0 432 H286"/>
    <path d="M144 0 V640"/>
  </g>
  <path d="M262 0 C246 96 280 170 262 250 C246 330 300 410 290 500 C284 560 322 600 316 640 H360 V0 Z" fill="#CFE3F7"/>
  <path d="M262 0 C246 96 280 170 262 250 C246 330 300 410 290 500 C284 560 322 600 316 640" fill="none" stroke="#F6E2A8" stroke-width="9"/>
  <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.85">
    <path class="hd-mapa__mar-ola" d="M296 60 q8 -6 16 0 t16 0 t16 0"/>
    <path class="hd-mapa__mar-ola" d="M300 196 q8 -6 16 0 t16 0 t16 0"/>
    <path class="hd-mapa__mar-ola" d="M318 330 q8 -6 16 0 t16 0"/>
    <path class="hd-mapa__mar-ola" d="M322 470 q8 -6 16 0 t16 0"/>
  </g>
  <g font-family="DM Sans, sans-serif" font-size="9.5" font-weight="700" fill="#8A93A6">
    <text x="10" y="140">${esc(c.colon)}</text>
    <text x="10" y="428">${esc(c.luro)}</text>
    <text x="140" y="620" transform="rotate(-90 140 620)">${esc(c.independencia)}</text>
    <text x="104" y="220" font-size="8" fill="#5E8E5A">${esc(c.plaza)}</text>
  </g>
  <g font-family="DM Sans, sans-serif" font-size="11" font-weight="800" fill="#6B90C4" letter-spacing="1.5">
    <text x="292" y="270" transform="rotate(78 292 270)">${esc(c.mar)}</text>
  </g>
  <text x="40" y="300" font-family="Archivo, sans-serif" font-size="12" font-weight="900" fill="#B4BCCB" letter-spacing="2">${esc(c.barrio)}</text>
  ${o.ruta ? `<path id="${id}-ruta" class="hd-mapa__ruta" d="${d}" fill="none" stroke="#1F57A8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : `<path id="${id}-ruta" d="${d}" fill="none" stroke="none"/>`}
  ${otros}
  ${o.radar ? `<g class="hd-mapa__radar" transform="translate(${casa[0]} ${casa[1] - 14})"><circle r="120"/><circle r="120"/><circle r="120"/></g>` : ''}
  <g transform="translate(${casa[0]} ${casa[1]})">
    <circle class="hd-mapa__yo-onda" r="12" fill="#E53935" opacity="0.35"/>
    <g class="hd-mapa__pin">
      <path d="M0 0 C-4 -9 -13 -14 -13 -25 A13 13 0 1 1 13 -25 C13 -14 4 -9 0 0 Z" fill="#E53935" stroke="#fff" stroke-width="2.5"/>
      <circle cy="-25" r="5" fill="#fff"/>
    </g>
  </g>
  ${esp}
</svg>
</div>`;
}
