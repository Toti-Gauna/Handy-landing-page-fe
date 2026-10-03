// Demo · lado del especialista (v2): pantallas, hojas y recorrido.
// Basadas en assets/fotos/especialista (mapa con "Disponible", pedido con precio sugerido, hoja de precio,
// en camino, chat, trabajo con cronómetro, fin con el caño, agenda en mosaicos, avisos, cuenta y cobros),
// llevadas al kit v2 (.hd-*, mapa vivo, isla, tickets, Handys) y en español, en pesos y con los rubros de Handy.
// El comportamiento (interruptor, pedido que entra, precios que cuentan, chat, cronómetro, agenda, cobros)
// vive en src/scripts/demo/especialista.ts. Los estilos propios, en src/styles/demo-especialista.css (.de-*).

import d from '../../content/demo-especialista.json' with { type: 'json' };
import rubros from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, formatoPesos, formatoPesosJunto, plano } from '../util.ts';
import { estado, fotoCano, logo } from '../pantallas.ts';
import { boton, cabeceraDemo, navDemo, salirDeLaDemo, tildeExito, tituloHoja, tituloMarcado, volverDemo, type Toque } from './piezas.ts';
import { mapaVivo, type OpcionesMapa } from './mapa.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

const ROL = 'especialista' as const;
const C = d.comun;
/** Precio que sugiere Handy para el pedido principal. */
const SUGERIDO = d.inicio.pedido.sugerido;
/**
 * Presupuesto que manda el especialista en el recorrido (el sugerido más lo que suma la guía): es el de ejemplo
 * de tarifas.json, el mismo que ve el usuario del otro lado.
 */
const PRECIO = tarifas.ejemplo.presupuesto;
if (SUGERIDO + d.precio.sumas[0] !== PRECIO) {
  throw new Error(`Demo especialista: el sugerido (${SUGERIDO}) más la primera suma (${d.precio.sumas[0]}) tiene que dar el presupuesto de ejemplo de tarifas.json (${PRECIO})`);
}
if (d.cobro.cbuEjemplo.replace(/\D/g, '').length !== 22) throw new Error('Demo especialista: cobro.cbuEjemplo tiene que tener 22 números');

// ── Cuentas (las mismas que hace el navegador con src/scripts/demo/util.ts) ──

const retencion = (n: number) => Math.round((n * tarifas.normal.especialista) / 100);
const neto = (n: number) => n - retencion(n);
const pesos = (n: number) => esc(formatoPesos(n));
const fecha = (dia: number) => new Date(Number(C.anio), C.mesNumero - 1, dia);
const diaSemana = (dia: number) => C.dias[fecha(dia).getDay()];
const dos = (n: number) => String(n).padStart(2, '0');
const fechaCorta = (dia: number) => `${dos(dia)}/${dos(C.mesNumero)}`;
const completar = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

// ── Piezas propias ────────────────────────────────────────────────────────

/** Cabecera de la app: la campana lleva a los avisos y el pin (si va) a tus rubros y zonas. */
const cabecera = (variante: 'blanca' | 'azul', conPin = true) =>
  cabeceraDemo(ROL, variante, conPin ? { ir: 'e-rubros', etiqueta: C.zonas } : false);

/** Fila "concepto ...... monto" del kit. */
const dato = (izq: string, der: string, clase = '') => `<p class="hd-dato ${clase}"><span>${izq}</span><span>${der}</span></p>`;

/** Desglose: presupuesto − tarifa (+ repuestos, enteros) = lo que te queda. */
function desglose(presupuesto: number, ultimo = C.aTuCuenta, extras = 0): string {
  return `${dato(esc(C.presupuesto), pesos(presupuesto))}
${dato(plano(C.tarifa), `− ${pesos(retencion(presupuesto))}`, 'de-dato--resta')}
${extras ? dato(esc(C.repuestos), `+ ${pesos(extras)}`) : ''}
${dato(esc(ultimo), `<span data-de-total>${pesos(neto(presupuesto) + extras)}</span>`, 'hd-dato--total')}`;
}

/** Ticket troquelado (como los cupones de la app): arriba lo que es, abajo los números. */
const ticket = (arriba: string, abajo: string, clase = '', attrs = '') =>
  `<div class="hd-ticket de-ticket ${clase}" ${attrs}><div class="hd-ticket__papel"><div class="de-ticket__arriba">${arriba}</div><div class="hd-ticket__corte"></div><div class="de-ticket__abajo">${abajo}</div></div></div>`;

/** Mosaico chico con el ícono del rubro. */
const rubroIco = (nombre: string, clase = '') => `<span class="de-rubro ${clase}">${icono(nombre)}</span>`;

/** Avatar con iniciales fijas (los clientes de la demo no tienen nombre: se usan las del barrio). */
const avatarDe = (inicial: string, tono: string, clase = '') =>
  `<span class="hd-avatar ${clase}" style="--tono:${esc(tono)}" aria-hidden="true"><span>${esc(inicial)}</span></span>`;

const img = (nombre: string, clase: string, w: number, h: number) =>
  `<img class="${clase}" src="/src/img/${nombre}.webp" alt="" width="${w}" height="${h}" loading="lazy" decoding="async" />`;

/** Pastilla "Disponible" con el interruptor (el "Working" del diseño). La pinta el script según el estado. */
function disponible(prendido: boolean, guia = false): string {
  return boton(
    { accion: 'disponible', guia, etiqueta: C.disponible, extra: `role="switch" aria-checked="${prendido}"` },
    `${icono('maletin')}<span data-de-disp-texto>${esc(prendido ? C.disponible : C.noDisponible)}</span><span class="de-switch" aria-hidden="true"><i></i></span>`,
    'de-disponible',
  );
}

interface OpcionesMapaEsp extends OpcionesMapa {
  /** Dónde estás vos (punto azul). */
  yo?: [number, number];
  /** Radar alrededor tuyo (mientras buscás pedidos). */
  radarYo?: boolean;
  /** Línea punteada de vos al cliente. */
  linea?: boolean;
}

/** Mapa vivo con tu posición (punto azul con halo) y, si va, el radar y la línea hasta el cliente. */
function mapa(o: OpcionesMapaEsp): string {
  const casa = o.casa ?? [188, 262];
  let svg = mapaVivo(o);
  if (o.yo && o.linea) {
    const linea = `<path class="de-mapa__linea" d="M${o.yo[0]} ${o.yo[1]} L${casa[0]} ${casa[1] - 4}" fill="none" stroke="#1F57A8" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 9"/>`;
    svg = svg.replace(`<g transform="translate(${casa[0]} ${casa[1]})">`, `${linea}$&`);
  }
  if (o.yo) {
    const [x, y] = o.yo;
    const radar = o.radarYo ? `<g class="hd-mapa__radar de-mapa__radar" transform="translate(${x} ${y})"><circle r="150"/><circle r="150"/><circle r="150"/></g>` : '';
    const yo = `<g class="de-mapa__yo" transform="translate(${x} ${y})"><circle class="de-mapa__halo" r="22" fill="#2F6BFF" opacity="0.18"/><circle r="10" fill="#2F6BFF" stroke="#fff" stroke-width="3.5"/></g>`;
    svg = svg.replace('</svg>', `${radar}${yo}</svg>`);
  }
  return svg;
}

/** Recorrido "de dónde a dónde" con los dos puntos unidos. */
const trayecto = (desde: string, hasta: string) =>
  `<div class="de-trayecto"><span><i></i>${esc(desde)}</span><span><i></i>${esc(hasta)}</span></div>`;

/** Contenedor con scroll (sin barra) para el cuerpo de las pantallas largas. */
const cuerpo = (html: string, clase = '') => `<div class="hd-scroll de-cuerpo ${clase}">${html}</div>`;

// ── Inicio: mapa, "Disponible" y el pedido que entra ─────────────────────

const YO: [number, number] = [96, 266];
const CLIENTE: [number, number] = [206, 186];

/** Tarjeta de un pedido (urgencia o programado) con el precio sugerido y los dos botones. */
function tarjetaPedido(o: {
  sobre: string;
  rubro: string;
  ico: string;
  chip: string;
  chipClase: string;
  detalle: string;
  sugeridoLabel: string;
  sugerido: number;
  decidis: string;
  medio: string;
  aceptar: Toque;
  aceptarTexto: string;
  cambiar: Toque;
  cambiarTexto: string;
  rechazar: Toque;
  pie: string;
}): string {
  return `<div class="de-pedido__cabeza">
    ${rubroIco(o.ico, 'de-rubro--azul')}
    <span class="de-pedido__titulos"><small class="hd-sobre">${esc(o.sobre)}</small><strong>${esc(o.rubro)}</strong></span>
    <span class="hd-chip hd-chip--mini ${o.chipClase}">${o.chip}</span>
    ${boton(o.rechazar, icono('cerrar'), 'hd-circulo de-cerrar')}
  </div>
  <p class="de-cita">${esc(o.detalle)}</p>
  <div class="de-pedido__precio">
    <span class="de-pedido__sugerido"><small>${esc(o.sugeridoLabel)}</small><strong class="hd-precio">${pesos(o.sugerido)}</strong></span>
    <span class="de-pedido__decidis">${icono('etiqueta')}${esc(o.decidis)}</span>
  </div>
  ${o.medio}
  <div class="hd-botones hd-botones--fila de-pedido__botones">
    ${boton(o.aceptar, esc(o.aceptarTexto), 'hd-boton')}
    ${boton(o.cambiar, esc(o.cambiarTexto), 'hd-boton hd-boton--claro')}
  </div>
  <p class="de-pedido__pie">${esc(o.pie)}</p>`;
}

function inicio(): PantallaDemo {
  const i = d.inicio;
  const pd = i.pedido;
  const misRubros = (d.rubrosHoja.rubrosActivos as string[])
    .map((id) => rubros.rubros.find((r) => r.id === id))
    .filter((r) => r)
    .map((r) => `<span class="hd-chip hd-chip--tinte hd-chip--mini">${icono(r!.icono)}${esc(r!.nombre)}</span>`)
    .join('');
  return {
    id: 'e-inicio',
    titulo: d.pantallas.inicio,
    html: `<div class="app de-inicio" data-de-inicio data-estado="apagado">
${cabecera('azul')}
<div class="de-zona-mapa">
  ${mapa({ id: 'de-inicio', casa: CLIENTE, yo: YO, radarYo: true, linea: true })}
  <div class="de-flota">
    <span class="hd-chip hd-vivo de-buscando-chip" data-de-buscando>${esc(i.buscandoChip)}</span>
    ${disponible(false, true)}
  </div>
  <div class="de-abajo">
    <div class="hd-tarjeta de-panel de-apagado" data-de-panel="apagado" data-entra="abajo">
      ${img('handy-llave', 'hd-handy de-apagado__handy', 581, 547)}
      <div class="de-apagado__texto">
        <p class="hd-sobre">${esc(i.apagadoSobre)}</p>
        ${tituloMarcado(i.apagadoTitulo, 'hd-titulo hd-titulo--chico')}
        <p class="hd-texto hd-texto--suave">${esc(i.apagadoTexto)}</p>
      </div>
      ${boton({ accion: 'disponible' }, `${icono('interruptor')}${esc(i.prender)}`, 'hd-boton de-apagado__boton')}
    </div>
    <div class="hd-tarjeta de-panel de-buscando" data-de-panel="buscando">
      <span class="de-buscando__ico">${icono('maletin')}</span>
      <span class="de-buscando__texto"><strong>${esc(i.buscandoTitulo)}</strong><small data-de-buscando-texto>${esc(i.buscandoTexto)}</small><span class="hd-chips">${misRubros}</span></span>
    </div>
    <div class="hd-tarjeta de-panel de-pedido" data-de-panel="pedido" data-de-pedido>
      ${tarjetaPedido({
        sobre: pd.sobre,
        rubro: pd.rubro,
        ico: pd.icono,
        chip: `${icono('alerta')}${esc(C.urgencia)}`,
        chipClase: 'hd-chip--amarillo',
        detalle: pd.detalle,
        sugeridoLabel: pd.sugeridoLabel,
        sugerido: SUGERIDO,
        decidis: pd.decidis,
        medio: trayecto(pd.desde, pd.hasta),
        aceptar: { accion: 'aceptarSugerido', ir: 'e-aceptado' },
        aceptarTexto: pd.aceptar,
        cambiar: { ir: 'e-precio', guia: true },
        cambiarTexto: pd.cambiar,
        rechazar: { accion: 'rechazar', etiqueta: pd.rechazar },
        pie: pd.pie,
      })}
    </div>
  </div>
</div>
${navDemo(ROL, 0)}
</div>`,
  };
}

// ── Hoja: tu precio ───────────────────────────────────────────────────────

/**
 * Hoja "Tu precio". Hay dos: la del pedido de urgencia (con las franjas para declarar cuándo podés ir)
 * y la del pedido programado (sin franjas: el día y la franja los eligió el cliente).
 */
function precio(id: 'e-precio' | 'e-precio-programado'): PantallaDemo {
  const p = d.precio;
  const conFranjas = id === 'e-precio';
  const sugerido = conFranjas ? SUGERIDO : d.programado.sugerido;
  const franjas = p.franjas
    .map((f, i) => boton({ accion: 'franja', valor: String(i), extra: `aria-pressed="${i === 0}"` }, `${icono('reloj')}${esc(f.texto)}`, 'hd-chip de-chip'))
    .join('');
  const chips = [
    boton({ accion: 'precioSugerido', extra: 'aria-pressed="true"' }, esc(p.dejar), 'hd-chip de-chip'),
    ...p.sumas.map((s, i) => boton({ accion: 'precioSumar', valor: String(s), guia: i === 0, extra: 'aria-pressed="false"' }, `+ ${pesos(s)}`, 'hd-chip de-chip')),
  ].join('');
  const paso = formatoPesos(p.paso);
  return {
    id,
    titulo: conFranjas ? d.pantallas.precio : d.pantallas.precioProgramado,
    tipo: 'hoja',
    html: `${tituloHoja(p.titulo)}
<div class="de-hoja de-precio">
  ${
    conFranjas
      ? `<div data-entra><p class="de-etiqueta">${esc(p.cuandoLabel)}</p><div class="hd-chips de-franjas">${franjas}</div></div>`
      : ''
  }
  <div class="de-precio__caja" data-entra>
    <p class="de-precio__sugerido">${img('handy-lamparita', 'de-precio__handy', 202, 346)}<span>${esc(p.sugeridoLabel)} <strong data-de-sugerido>${pesos(sugerido)}</strong></span><span class="hd-chip hd-chip--amarillo de-chip-nota">${esc(p.sugeridoNota)}</span></p>
    <div class="de-precio__monto">
      ${boton({ accion: 'precioPaso', valor: String(-p.paso), etiqueta: completar(p.bajar, { monto: paso }) }, `<span aria-hidden="true">−</span>`, 'hd-circulo de-paso')}
      <span class="de-precio__valor"><span class="sr">${esc(p.campoLabel)}</span><strong class="hd-precio hd-precio--grande" data-de-precio>${pesos(sugerido)}</strong></span>
      ${boton({ accion: 'precioPaso', valor: String(p.paso), etiqueta: completar(p.subir, { monto: paso }) }, `<span aria-hidden="true">+</span>`, 'hd-circulo de-paso')}
    </div>
    <div class="hd-chips de-precio__chips">${chips}</div>
  </div>
  <div class="de-recibis" data-entra>
    <span class="de-recibis__icono">${icono('billetera')}</span>
    <span class="de-recibis__texto"><small>${esc(p.recibis)}</small><strong class="hd-precio" data-de-recibis>${pesos(neto(sugerido))}</strong></span>
    <small class="de-recibis__retiene" data-de-retiene>${plano(p.retiene, { monto: formatoPesosJunto(retencion(sugerido)) })}</small>
  </div>
  ${boton({ accion: 'ponerPrecio', guia: true }, `${esc(p.boton)}${icono('enviar')}`, 'hd-boton')}
</div>`,
  };
}

// ── Presupuesto enviado → el cliente te elige ────────────────────────────

function aceptado(): PantallaDemo {
  const a = d.aceptado;
  const f = d.precio.franjas[0];
  return {
    id: 'e-aceptado',
    titulo: d.pantallas.aceptado,
    html: `<div class="app de-aceptado" data-de-aceptado data-estado="esperando">
${cabecera('azul')}
${cuerpo(`
  <div class="de-estado de-estado--esperando" data-entra="pop">
    <div class="de-espera">
      <span class="de-espera__ondas" aria-hidden="true"><i></i><i></i><i></i></span>
      ${img('handy-engranaje', 'hd-handy de-espera__handy', 338, 339)}
    </div>
    <p class="hd-sobre">${esc(a.enviadoSobre)}</p>
    ${tituloMarcado(a.enviadoTitulo, 'hd-titulo')}
    <p class="hd-texto hd-texto--suave">${esc(a.esperando)}</p>
    <span class="hd-escribiendo de-espera__puntos" aria-hidden="true"><i></i><i></i><i></i></span>
  </div>
  <div class="de-estado de-estado--elegido">
    ${tildeExito}
    <p class="hd-sobre">${esc(a.elegidoSobre)}</p>
    ${tituloMarcado(a.elegidoTitulo, 'hd-titulo')}
    <p class="hd-texto hd-texto--suave">${esc(a.elegidoTexto)}</p>
  </div>
  ${ticket(
    `${rubroIco('canilla')}<span class="de-ticket__titulo"><strong>${esc(a.trabajo)}</strong><small data-de-franja>${esc(f.texto)}</small></span><span class="hd-chip hd-chip--amarillo hd-chip--mini">${icono('alerta')}${esc(C.urgencia)}</span>`,
    `${dato(esc(a.tuPrecio), `<span data-de-precio>${pesos(PRECIO)}</span>`)}
     ${dato(plano(C.tarifa), `− <span data-de-retencion>${pesos(retencion(PRECIO))}</span>`, 'de-dato--resta')}
     ${dato(esc(C.recibis), `<span data-de-recibis>${pesos(neto(PRECIO))}</span>`, 'hd-dato--total')}`,
    '',
    'data-entra',
  )}
`, 'de-cuerpo--centro')}
<div class="de-pie">
  ${boton({ ir: 'e-en-camino', guia: true, extra: 'data-de-ir-alla disabled' }, `<span data-de-ir-texto>${esc(a.esperandoBoton)}</span>${icono('flecha')}`, 'hd-boton')}
</div>
</div>`,
  };
}

// ── En camino ─────────────────────────────────────────────────────────────

const CASA_CAMINO: [number, number] = [188, 300];

function enCamino(): PantallaDemo {
  const c = d.camino;
  return {
    id: 'e-en-camino',
    titulo: d.pantallas.camino,
    html: `<div class="app de-camino">
${cabecera('azul', false)}
<div class="de-camino__mapa">
  ${mapaVivo({ id: 'de-camino', ruta: true, especialista: C.marcador, viaje: 8, casa: CASA_CAMINO })}
  ${boton({ volver: true, etiqueta: C.volver }, icono('atras'), 'de-flotante')}
  <span class="hd-chip de-camino__km">${icono('pin')}${esc(c.distancia)}</span>
</div>
<div class="hd-hoja-azul de-camino__hoja">
  <span class="de-manija" aria-hidden="true"></span>
  <div class="de-camino__destino" data-entra>
    <p class="hd-sobre">${esc(c.sobre)}</p>
    <p class="de-camino__direccion">${esc(c.destino)}</p>
    <p class="de-camino__franja">${icono('reloj')}<span data-de-franja>${esc(d.precio.franjas[0].texto)}</span></p>
  </div>
  <div data-entra>
    <div class="hd-seguimiento de-seguimiento" data-etapa="1" data-de-seguimiento aria-hidden="true">
      <span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span>
      <span class="hd-seguimiento__quien">${icono('caminar')}</span>
    </div>
    <div class="de-etapas">${c.etapas.map((e) => `<span>${esc(e)}</span>`).join('')}</div>
  </div>
  <div class="de-cliente" data-entra>
    ${avatarDe(c.inicial, d.chats.perla.tono, 'de-cliente__avatar')}
    <span class="de-cliente__texto"><strong>${esc(c.cliente)}</strong><small>${esc(c.sinTelefono)}</small></span>
    ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-chat', guia: true, etiqueta: c.chatear }, icono('chat'), 'hd-circulo hd-circulo--azul de-cliente__chat')}
  </div>
  ${boton({ ir: 'e-trabajo' }, `${esc(c.llegue)}${icono('check')}`, 'hd-boton hd-boton--amarillo')}
</div>
</div>`,
  };
}

// ── Chat ──────────────────────────────────────────────────────────────────

type IdChat = keyof typeof d.chats;
const CHATS = Object.keys(d.chats) as IdChat[];

function burbuja(m: { de: string; texto: string; foto?: boolean }): string {
  const propia = m.de === 'esp';
  return `<div class="de-burbuja de-burbuja--${propia ? 'propia' : 'otra'}${m.foto ? ' de-burbuja--foto' : ''}">${m.foto ? fotoCano : ''}<span>${esc(m.texto)}</span></div>`;
}

const mensajesChat = (id: IdChat) => `<p class="de-chat__dia">${esc(d.chats[id].dia)}</p>${d.chats[id].mensajes.map(burbuja).join('')}`;

/**
 * Chat con un cliente. Hay dos pantallas iguales: "e-chat" es la del recorrido (se llega desde "Vas para allá")
 * y "e-conversacion" es la que se abre desde Mensajes, el trabajo o un turno (así el panel no retrocede de paso).
 */
function chat(id: 'e-chat' | 'e-conversacion'): PantallaDemo {
  const c = d.chat;
  const inicial: IdChat = 'perla';
  const ch = d.chats[inicial];
  const plantillas = CHATS.map((idChat) => `<template data-de-plantilla="${idChat}">${mensajesChat(idChat)}</template>`).join('');
  return {
    id,
    titulo: id === 'e-chat' ? d.pantallas.chat : d.pantallas.conversacion,
    html: `<div class="app de-chat" data-de-chat="${inicial}">
<div class="app-cabecera de-chat__arriba">
  ${estado()}
  <div class="de-chat__cabeza">
    ${boton({ volver: true, etiqueta: C.volver }, icono('atras'), 'hd-circulo de-chat__volver')}
    <span class="hd-avatar de-chat__avatar" style="--tono:${esc(ch.tono)}" data-de-chat-avatar aria-hidden="true"><span>${esc(ch.inicial)}</span></span>
    <span class="de-chat__nombre"><strong data-de-chat-nombre>${esc(ch.nombre)}</strong><small data-de-chat-sub>${esc(ch.sub)}</small></span>
  </div>
  <div class="de-chat__contexto" data-de-contexto>
    ${rubroIco('canilla', 'de-rubro--chico')}
    <span class="de-chat__contexto-texto"><strong>${esc(c.contexto)}</strong><small data-de-franja>${esc(d.precio.franjas[0].texto)}</small></span>
    ${boton({ ir: 'e-trabajo', extra: 'data-de-llegue' }, `${esc(c.llegue)}${icono('check')}`, 'hd-boton hd-boton--chico hd-boton--amarillo')}
    ${boton({ accion: 'verTurno', valor: '0', ir: 'e-turno-detalle', extra: 'data-de-ver-turno hidden' }, `${esc(c.verTurno)}${icono('calendario')}`, 'hd-boton hd-boton--chico')}
  </div>
</div>
<div class="hd-scroll de-chat__mensajes" data-de-mensajes>${mensajesChat(inicial)}</div>
<div class="de-chat__abajo">
  <div class="hd-chips hd-chips--carril de-chat__rapidas" data-de-rapidas role="group" aria-label="${esc(c.rapidasLabel)}">${ch.rapidas
    .map((r, i) => boton({ accion: 'rapida', valor: String(i), guia: i === 0 }, esc(r.chip), 'hd-chip hd-chip--tinte'))
    .join('')}</div>
  <div class="de-chat__barra">
    ${boton({ accion: 'escribirChat', extra: 'data-de-campo-chat' }, `<span data-de-campo-texto>${esc(c.input)}</span>${icono('imagen')}`, 'de-chat__campo')}
    ${boton({ accion: 'enviarChat', etiqueta: c.enviar, extra: 'data-de-enviar' }, icono('enviar'), 'hd-circulo hd-circulo--azul de-chat__enviar')}
  </div>
</div>
${plantillas}
<template data-de-plantilla-escribiendo><div class="de-burbuja de-burbuja--otra de-burbuja--escribiendo" aria-label="${esc(c.escribiendo)}"><span class="hd-escribiendo"><i></i><i></i><i></i></span></div></template>
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
    html: `<div class="app de-trabajo">
<div class="app-cabecera app-cabecera--blanca">
  ${estado()}
  <div class="app-cabecera__fila">${logo}<span class="hd-chip hd-chip--noche hd-vivo de-crono" role="timer" aria-label="${esc(t.cronoLabel)}"><span data-de-crono>00:00</span></span></div>
</div>
${cuerpo(`
  <div class="de-encabezado" data-entra>
    <p class="hd-sobre">${esc(t.sobre)}</p>
    ${tituloMarcado(t.titulo, 'hd-titulo')}
    <div class="hd-chips"><span class="hd-chip hd-chip--amarillo hd-chip--mini">${icono('alerta')}${esc(C.urgencia)}</span><span class="hd-chip hd-chip--tinte hd-chip--mini">${icono('reloj')}<span data-de-franja>${esc(f.texto)}</span></span></div>
  </div>
  <div class="hd-tarjeta hd-tarjeta--gris de-pedido-cliente" data-entra>
    ${fotoCano}
    <p><small>${esc(t.pedidoLabel)}</small><span>${esc(d.inicio.pedido.detalle)}</span></p>
  </div>
  <div data-entra>
    <p class="de-etiqueta">${esc(t.repuestosLabel)}</p>
    <div class="de-sugerencia" data-de-sugerencia>
      <span class="de-sugerencia__ico">${icono('mas')}</span>
      <span class="de-sugerencia__texto"><strong data-de-extra-nombre>${esc(primero.nombre)}</strong><small class="hd-precio" data-de-extra-monto>${pesos(primero.monto)}</small></span>
      ${boton({ accion: 'agregarExtra', guia: true }, esc(t.agregar), 'hd-boton hd-boton--chico')}
    </div>
    <p class="de-nota" data-de-sin-mas hidden>${icono('checkCirculo')}${esc(t.sinMas)}</p>
  </div>
  ${ticket(
    `${rubroIco('billetera')}<span class="de-ticket__titulo"><strong>${esc(t.costoLabel)}</strong><small>${plano(C.tarifa)}</small></span>`,
    `<div data-de-costo>${desglose(PRECIO, C.recibis)}</div>`,
    '',
    'data-entra',
  )}
  <div class="de-enlaces" data-entra>
    ${boton({ ir: 'e-ayuda' }, `${icono('pregunta')}${esc(t.ayuda)}`, 'hd-boton hd-boton--fantasma')}
    ${boton({ ir: 'e-cancelar' }, `${icono('prohibido')}${esc(t.cancelar)}`, 'hd-boton hd-boton--fantasma de-peligro')}
  </div>
  <template data-de-plantilla-quitar>${boton({ accion: 'quitarExtra', valor: '0' }, icono('cerrar'), 'de-quitar')}</template>
`)}
<div class="de-pie de-pie--fila">
  ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-conversacion', etiqueta: t.chatear }, icono('chat'), 'de-cuadro')}
  ${boton({ ir: 'e-fin', guia: true }, `${esc(t.terminar)}${icono('check')}`, 'hd-boton')}
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
    html: `<div class="app de-fin">
${cabecera('blanca')}
${cuerpo(`
  <div class="de-fin__escena" data-entra="pop">
    <span class="de-fin__mosaico" aria-hidden="true"></span>
    ${img('handy-cano', 'de-fin__cano', 354, 405)}
    ${img('handy-gota', 'hd-handy hd-handy--salta de-fin__gota', 93, 125)}
    <span class="de-fin__tilde">${tildeExito}</span>
  </div>
  <div class="de-fin__texto" data-entra>
    <p class="hd-sobre">${esc(f.sobre)}</p>
    ${tituloMarcado(f.titulo, 'hd-titulo')}
  </div>
  <p class="de-fin__ganaste" data-entra><small>${esc(f.ganaste)}</small><strong class="hd-precio hd-precio--grande hd-positivo" data-de-ganaste>${pesos(neto(PRECIO))}</strong></p>
  ${ticket(
    `${rubroIco('canilla')}<span class="de-ticket__titulo"><strong>${esc(d.aceptado.trabajo)}</strong><small>${esc(d.caja.hoy)}</small></span><span class="hd-chip hd-chip--exito hd-chip--mini">${icono('check')}${esc(C.aTuCuenta)}</span>`,
    `<div data-de-costo>${desglose(PRECIO)}</div>`,
    '',
    'data-entra',
  )}
  <p class="de-nota de-nota--centro" data-entra>${icono('billetera')}<span>${plano(f.texto)}</span></p>
`, 'de-cuerpo--centro')}
<div class="de-pie">
  <div class="hd-botones">
    ${boton({ raiz: 'e-turnos', guia: true }, `${icono('calendario')}${esc(f.agenda)}`, 'hd-boton')}
    ${boton({ raiz: 'e-inicio' }, esc(f.inicio), 'hd-boton hd-boton--claro')}
  </div>
</div>
</div>`,
  };
}

// ── Agenda ────────────────────────────────────────────────────────────────

/** "Ver más información" + el contexto que solo escuchan los lectores de pantalla. */
const verMas = (contexto: string, abierto = false) =>
  `<span data-de-ver-mas-texto>${esc(abierto ? C.verMenos : C.verMas)}</span><span class="sr">: ${esc(contexto)}</span>`;

function calendario(): string {
  const t = d.turnos;
  const primero = fecha(1).getDay();
  const ultimo = new Date(Number(C.anio), C.mesNumero, 0).getDate();
  const celdas: string[] = [];
  for (let i = 0; i < primero; i++) celdas.push('<span class="de-cal__dia de-cal__dia--vacio" aria-hidden="true"></span>');
  for (let n = 1; n <= ultimo; n++) {
    const turno = t.items.find((x) => x.dia === n);
    const pasado = t.pasados.find((x) => x.dia === n);
    const clase = turno ? ' de-cal__dia--turno' : pasado ? ' de-cal__dia--hecho' : n === C.hoy ? ' de-cal__dia--hoy' : n < C.hoy ? ' de-cal__dia--pasado' : '';
    const ic = turno ? icono(turno.icono) : pasado ? icono(pasado.icono) : '';
    celdas.push(`<span class="de-cal__dia${clase}" data-dia="${n}"><b>${n}</b>${ic}</span>`);
  }
  return `<div class="de-cal" data-entra aria-hidden="true">
  <div class="de-cal__cabeza"><span>${icono('izquierda')}</span><strong>${esc(C.mesTitulo)} ${esc(C.anio)}</strong><span>${icono('derecha')}</span></div>
  <div class="de-cal__semana">${t.semana.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
  <div class="de-cal__dias">${celdas.join('')}</div>
</div>`;
}

const corto = (dia: number) => diaSemana(dia).slice(0, 3);

function tarjetaTurno(t: (typeof d.turnos.items)[number], i: number): string {
  const contexto = completar(C.verMasDe, { rubro: t.rubro, fecha: `${diaSemana(t.dia)} ${fechaCorta(t.dia)}` });
  return `<div class="de-turno" data-de-turno="${i}" data-entra>
  <div class="de-turno__cuerpo">
    <span class="de-turno__fecha"><small>${esc(corto(t.dia))}</small><strong>${t.dia}</strong></span>
    <span class="de-turno__datos"><strong>${icono(t.icono)}${esc(t.detalle)}</strong><small>${esc(t.rubro)} · ${esc(t.barrio)}</small><small>${esc(t.franja)}</small></span>
    <span class="de-turno__monto"><strong class="hd-precio">+ ${pesos(neto(t.presupuesto))}</strong><small data-de-programado-tag>${esc(C.programado)}</small><small class="de-turno__cancelado" data-de-cancelado hidden>${esc(d.turnos.cancelado)}</small></span>
  </div>
  ${boton({ accion: 'verTurno', valor: String(i), ir: 'e-turno-detalle', guia: i === 0 }, verMas(contexto), 'de-franja')}
</div>`;
}

function turnos(): PantallaDemo {
  const t = d.turnos;
  return {
    id: 'e-turnos',
    titulo: d.pantallas.turnos,
    html: `<div class="app de-turnos">
${cabecera('blanca')}
<div class="de-turnos__arriba">
  ${tituloMarcado(t.titulo, 'hd-titulo de-turnos__titulo')}
  ${calendario()}
</div>
<div class="hd-hoja-azul de-hoja-azul">
  <span class="de-manija" aria-hidden="true"></span>
  <p class="de-hoja-azul__titulo">${esc(t.panel)}</p>
  <div class="hd-scroll de-hoja-azul__lista">${t.items.map(tarjetaTurno).join('')}</div>
</div>
${navDemo(ROL, 1)}
</div>`,
  };
}

// ── Detalle del turno ─────────────────────────────────────────────────────

function detalle(): PantallaDemo {
  const x = d.detalle;
  const t = d.turnos.items[0];
  const ch = d.chats[t.chat as IdChat];
  const iconos = [...new Set(d.turnos.items.map((it) => it.icono))]
    .map((n) => `<span data-de-icono="${n}"${n === t.icono ? '' : ' hidden'}>${icono(n)}</span>`)
    .join('');
  return {
    id: 'e-turno-detalle',
    titulo: d.pantallas.detalle,
    html: `<div class="app de-detalle">
${cabecera('blanca', false)}
${cuerpo(`
  ${volverDemo(x.titulo)}
  <div class="de-detalle__hero" data-entra>
    <span class="de-detalle__fecha"><small data-de-d="dow">${esc(corto(t.dia))}</small><strong data-de-d="num">${t.dia}</strong><small>${esc(C.meses[C.mesNumero - 1])}</small></span>
    <span class="de-detalle__que">
      <span class="hd-chip hd-chip--claro hd-chip--mini" data-de-d="estado">${icono('checkCirculo')}<span>${esc(x.confirmado)}</span></span>
      <strong><span data-de-d="rubro">${esc(t.rubro)}</span> · <span data-de-d="detalle">${esc(t.detalle)}</span></strong>
      <small>${icono('reloj')}<span data-de-d="franja">${esc(t.franja)}</span></small>
    </span>
    <span class="de-detalle__ico">${iconos}</span>
  </div>
  <div class="hd-tarjeta de-detalle__datos" data-entra>
    <div class="hd-lista">
      <div class="hd-fila"><span class="hd-fila__ico">${icono('pin')}</span><span class="hd-fila__texto"><small>${esc(x.dondeLabel)}</small><strong data-de-d="barrio">${esc(t.barrio)}</strong></span></div>
      <div class="hd-fila de-fila-cita"><span class="hd-fila__ico">${icono('chat')}</span><span class="hd-fila__texto"><small>${esc(x.pedidoLabel)}</small><span class="de-cita de-cita--plana" data-de-d="pedido">${esc(t.pedido)}</span></span></div>
    </div>
  </div>
  ${ticket(
    `${rubroIco('billetera')}<span class="de-ticket__titulo"><strong>${esc(x.costoLabel)}</strong><small>${plano(C.tarifa)}</small></span>`,
    `<div data-de-d="costo">${desglose(t.presupuesto, C.recibis)}</div>`,
    'de-ticket--detalle',
    'data-entra',
  )}
  <div class="de-cliente de-cliente--claro" data-entra>
    <span class="hd-avatar" style="--tono:${esc(ch.tono)}" data-de-d="avatar" aria-hidden="true"><span>${esc(ch.inicial)}</span></span>
    <span class="de-cliente__texto"><strong data-de-d="cliente">${esc(ch.nombre)}</strong><small>${esc(d.camino.sinTelefono)}</small></span>
    ${boton({ accion: 'abrirChat', valor: t.chat, ir: 'e-conversacion', etiqueta: x.chatear, extra: 'data-de-d="chat"' }, icono('chat'), 'hd-circulo hd-circulo--azul')}
  </div>
  <p class="hd-error-linea de-cancelado" data-de-d="cancelado" hidden>${img('handy-cano-roto', '', 354, 405)}<span>${esc(x.cancelado)}</span></p>
`)}
<div class="de-pie de-pie--fila" data-de-d="acciones">
  ${boton({ ir: 'e-cancelar' }, esc(x.cancelar), 'hd-boton hd-boton--claro de-peligro')}
  ${boton({ ir: 'e-cambiar-fecha', guia: true }, esc(x.cambiar), 'hd-boton')}
</div>
</div>`,
  };
}

// ── Cambiar la fecha ──────────────────────────────────────────────────────

/** Tira de la semana (domingo a sábado) del día propuesto: el día del turno, el nuevo y los que no se pueden elegir. */
function semana(nuevo: number, actual: number): string {
  const domingo = nuevo - fecha(nuevo).getDay();
  let html = '';
  for (let n = domingo; n < domingo + 7; n++) {
    if (n < 1 || n > 30) {
      html += '<span class="de-semana__dia de-semana__dia--vacio" aria-hidden="true"></span>';
      continue;
    }
    const nombre = diaSemana(n);
    const deshabilitado = n <= C.hoy || fecha(n).getDay() === 0;
    html += boton(
      {
        accion: 'elegirDia',
        valor: String(n),
        etiqueta: completar(d.cambio.elegirDia, { dia: nombre, fecha: fechaCorta(n) }),
        extra: `aria-pressed="${n === nuevo}"${deshabilitado ? ' disabled' : ''}`,
      },
      `<small>${esc(nombre.slice(0, 3))}</small><strong>${n}</strong>`,
      `de-semana__dia${n === actual ? ' de-semana__dia--actual' : ''}`,
    );
  }
  return html;
}

/** Primer día hábil (lunes a sábado) después de `dia`. */
function diaSiguiente(dia: number): number {
  let n = dia + 1;
  while (n <= 30 && fecha(n).getDay() === 0) n++;
  return Math.min(n, 30);
}

function cambiarFecha(): PantallaDemo {
  const c = d.cambio;
  const t = d.turnos.items[0];
  const dia = diaSiguiente(t.dia);
  const franja = Math.max(0, c.franjas.indexOf(t.franja));
  const motivos = c.motivos
    .map((m, i) => boton({ accion: 'motivo', valor: String(i), guia: i === 0, extra: 'aria-pressed="false"' }, esc(m), 'hd-chip de-chip'))
    .join('');
  const franjas = c.franjas
    .map((f, i) => boton({ accion: 'franjaElegir', valor: String(i), extra: `aria-pressed="${i === franja}"` }, esc(f), 'hd-chip de-chip'))
    .join('');
  return {
    id: 'e-cambiar-fecha',
    titulo: d.pantallas.cambio,
    html: `<div class="app de-cambio">
${cabecera('blanca', false)}
${cuerpo(`
  ${volverDemo(c.titulo)}
  <p class="de-actual" data-de-cambio-actual data-entra>${icono('calendario')}<span>${esc(completar(c.actual, { dia: diaSemana(t.dia), fecha: fechaCorta(t.dia), franja: t.franja }))}</span></p>
  <div class="de-cambio__form" data-de-cambio-form>
    <div data-entra><p class="de-etiqueta">${esc(c.motivoTitulo)}</p><div class="hd-chips">${motivos}</div></div>
    <div data-entra>
      <div class="de-etiqueta-fila"><p class="de-etiqueta">${esc(c.nuevaTitulo)}</p><span class="de-flechas">${boton({ accion: 'semanaPaso', valor: '-1', etiqueta: c.semanaAnterior }, icono('izquierda'), 'hd-circulo de-circulo-chico')}${boton({ accion: 'semanaPaso', valor: '1', etiqueta: c.semanaSiguiente }, icono('derecha'), 'hd-circulo de-circulo-chico')}</span></div>
      <div class="de-semana" data-de-semana role="group" aria-label="${esc(c.semanaLabel)}">${semana(dia, t.dia)}</div>
    </div>
    <div data-entra><p class="de-etiqueta">${esc(c.franjaTitulo)}</p><div class="hd-chips hd-chips--carril de-carril" data-de-franjas>${franjas}</div></div>
    <div data-entra><p class="de-etiqueta">${esc(c.mensajeLabel)}</p>${boton({ accion: 'mensajeCambio' }, `<span data-de-mensaje-texto>${esc(c.mensaje)}</span>${icono('editar')}`, 'de-campo de-campo--mensaje')}</div>
  </div>
  <div class="de-estado de-cambio__ok" data-de-cambio-ok hidden>
    ${tildeExito}
    ${tituloMarcado(c.enviadoTitulo, 'hd-titulo hd-titulo--chico')}
    <p class="hd-texto hd-texto--suave" data-de-cambio-ok-texto>${esc(c.enviado)}</p>
  </div>
`)}
<div class="de-pie">
  <p class="de-resumen" data-de-cambio-resumen aria-live="polite">${esc(completar(c.resumen, { dia: diaSemana(dia), fecha: fechaCorta(dia), franja: c.franjas[franja] }))}</p>
  ${boton({ accion: 'proponerFecha', guia: true }, `${esc(c.proponer)}${icono('enviar')}`, 'hd-boton')}
  ${boton({ volver: true, extra: 'data-de-cambio-volver hidden' }, esc(c.volverAgenda), 'hd-boton hd-boton--claro')}
</div>
</div>`,
  };
}

// ── Notificaciones ────────────────────────────────────────────────────────

function notificaciones(): PantallaDemo {
  const a = d.avisos;
  const item = (it: (typeof a.items)[number]) => {
    const t: Toque = 'raiz' in it && it.raiz ? { raiz: it.raiz } : { ir: it.destino, guia: !!it.guia };
    if ('turno' in it && it.turno !== undefined) Object.assign(t, { accion: 'verTurno', valor: String(it.turno) });
    const titulo = it.neto ? esc(it.titulo).replace('{neto}', `<span data-de-neto>${pesos(neto(PRECIO))}</span>`) : esc(it.titulo);
    const tono = 'tono' in it ? ` de-notif--${it.tono}` : '';
    return `<div class="de-notif${tono}"${it.neto ? ' data-de-cobro-hoy' : ''} data-entra="lado">
  ${boton(t, `<span class="de-notif__ico">${icono(it.icono)}</span><span class="de-notif__texto"><strong>${titulo}</strong><small>${esc(it.texto)}</small></span>`, 'de-notif__cuerpo')}
  ${boton({ accion: 'quitarNotif', etiqueta: completar(a.quitar, { corto: it.corto }) }, icono('cerrar'), 'de-notif__x')}
</div>`;
  };
  const grupo = (titulo: string, lista: typeof a.items) =>
    `<section class="de-grupo-avisos" data-de-grupo><p class="de-etiqueta">${esc(titulo)}</p>${lista.map(item).join('')}</section>`;
  return {
    id: 'e-notificaciones',
    titulo: d.pantallas.notificaciones,
    html: `<div class="app de-avisos">
${cabecera('blanca', false)}
${cuerpo(`
  <div class="de-titulo-fila">${volverDemo(a.titulo)}${boton({ ir: 'e-config-notificaciones', etiqueta: a.configurar }, icono('engranaje'), 'hd-circulo')}</div>
  <div class="de-avisos__lista" data-de-notifs>
    ${grupo(a.nuevas, a.items.filter((x) => 'nuevo' in x && x.nuevo))}
    ${grupo(a.antes, a.items.filter((x) => !('nuevo' in x && x.nuevo)))}
  </div>
  <div class="de-avisos__pie" data-de-hay>
    <p class="de-nota de-nota--centro">${esc(a.nadaMas)}</p>
    ${boton({ accion: 'borrarNotifs' }, `${icono('tacho')}${esc(a.borrar)}`, 'hd-chip de-chip')}
  </div>
  <div class="de-vacio" data-de-vacio hidden>
    ${img('handy-lamparita', 'hd-handy de-vacio__handy', 202, 346)}
    ${tituloMarcado(a.vacioTitulo, 'hd-titulo hd-titulo--chico')}
    <p class="hd-texto hd-texto--suave">${esc(a.vacio)}</p>
  </div>
`)}
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
        `<span class="hd-fila__ico">${icono(it.icono)}</span><span class="hd-fila__texto"><strong>${esc(it.texto)}</strong></span><span class="de-switch" aria-hidden="true"><i></i></span>`,
        'hd-fila de-fila-switch',
      ),
    )
    .join('');
  return {
    id: 'e-config-notificaciones',
    titulo: d.pantallas.config,
    html: `<div class="app de-config">
${cabecera('blanca', false)}
${cuerpo(`
  ${volverDemo(c.titulo)}
  <div class="hd-tarjeta hd-tarjeta--azul de-config__panel" data-entra>
    <p class="de-config__titulo">${icono('campana')}${esc(c.panel)}</p>
    <div class="hd-botones hd-botones--fila">${boton({ accion: 'notifTodas', valor: '0' }, esc(c.desactivar), 'hd-boton hd-boton--chico hd-boton--noche')}${boton({ accion: 'notifTodas', valor: '1' }, esc(c.activar), 'hd-boton hd-boton--chico hd-boton--blanco')}</div>
  </div>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista">${filas}</div></div>
`)}
${navDemo(ROL, -1)}
</div>`,
  };
}

// ── Pedido programado ─────────────────────────────────────────────────────

function pedidoProgramado(): PantallaDemo {
  const p = d.programado;
  const medio = `<div class="de-pedido__dia">
    <span><small>${esc(p.diaLabel)}</small><strong>${icono('calendario')}${esc(p.dia)}</strong></span>
    <span><small>${esc(p.franjaLabel)}</small><strong>${icono('reloj')}${esc(p.franja)}</strong></span>
  </div>
  <p class="de-pedido__lugar">${icono('pin')}${esc(p.ubicacion)}</p>`;
  return {
    id: 'e-pedido-programado',
    titulo: d.pantallas.programado,
    html: `<div class="app de-inicio de-programado" data-de-programado-app data-estado="pedido">
${cabecera('azul')}
<div class="de-zona-mapa">
  ${mapa({ id: 'de-prog', casa: [150, 196], yo: [236, 128], linea: true })}
  <div class="de-flota">${disponible(false)}</div>
  <div class="de-abajo">
    <div class="hd-tarjeta de-panel de-pedido" data-de-programado data-entra="abajo">
      ${tarjetaPedido({
        sobre: p.sobre,
        rubro: p.rubro,
        ico: p.icono,
        chip: `${icono('calendario')}${esc(C.programado)}`,
        chipClase: 'hd-chip--tinte',
        detalle: p.detalle,
        sugeridoLabel: p.sugeridoLabel,
        sugerido: p.sugerido,
        decidis: p.decidis,
        medio,
        aceptar: { accion: 'aceptarProgramado', guia: true },
        aceptarTexto: p.aceptar,
        cambiar: { ir: 'e-precio-programado' },
        cambiarTexto: p.cambiar,
        rechazar: { accion: 'rechazarProgramado', etiqueta: p.rechazar },
        pie: p.pie,
      })}
    </div>
    <div class="hd-tarjeta de-panel de-respuesta" data-de-programado-respuesta hidden>
      <span data-de-resp="enviado">${tildeExito}</span>
      <span data-de-resp="rechazado">${img('handy-engranaje', 'hd-handy de-respuesta__handy', 338, 339)}</span>
      <span class="de-respuesta__texto">
        <span data-de-resp="enviado">${tituloMarcado(p.enviadoTitulo, 'hd-titulo hd-titulo--chico')}</span>
        <span data-de-resp="rechazado">${tituloMarcado(p.rechazadoTitulo, 'hd-titulo hd-titulo--chico')}</span>
        <small class="hd-texto hd-texto--suave" data-de-resp-texto>${esc(p.rechazadoTexto)}</small>
      </span>
    </div>
  </div>
</div>
${navDemo(ROL, 0)}
</div>`,
  };
}

// ── Cuenta ────────────────────────────────────────────────────────────────

function filaCuenta(t: Toque, nombreIcono: string, texto: string, detalle = ''): string {
  return boton(
    t,
    `<span class="hd-fila__ico">${icono(nombreIcono)}</span><span class="hd-fila__texto"><strong>${esc(texto)}</strong>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span><span class="hd-fila__fin">${icono('derecha')}</span>`,
    'hd-fila',
  );
}

function cuenta(): PantallaDemo {
  const c = d.cuenta;
  const activos = d.rubrosHoja.rubrosActivos as string[];
  const misRubros = rubros.rubros
    .map((r) => `<span class="hd-chip hd-chip--tinte hd-chip--mini" data-de-mi-rubro="${r.id}"${activos.includes(r.id) ? '' : ' hidden'}>${icono(r.icono)}${esc(r.nombre)}</span>`)
    .join('');
  return {
    id: 'e-cuenta',
    titulo: d.pantallas.cuenta,
    html: `<div class="app de-cuenta">
${cabecera('blanca')}
${cuerpo(`
  <div class="de-perfil" data-entra="pop">
    <span class="de-perfil__foto">
      <span class="hd-avatar hd-avatar--grande hd-avatar--verificado" aria-hidden="true"><span>${esc(c.nombre.split(' ').map((x) => x[0]).join('').toUpperCase())}</span></span>
      <span class="de-perfil__camara" aria-hidden="true" title="${esc(c.cambiarFoto)}">${icono('camara')}</span>
    </span>
    <p class="hd-titulo hd-titulo--chico hd-titulo--azul">${esc(c.nombre)}</p>
    <p class="hd-chips de-perfil__rubros" data-de-mis-rubros>${misRubros}</p>
    <span class="hd-chip hd-chip--exito hd-chip--mini">${icono('verificado')}${esc(c.verificado)}</span>
  </div>
  <p class="de-etiqueta" data-entra>${esc(c.seccionCuenta)}</p>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista">
    ${filaCuenta({ ir: 'e-datos' }, 'usuario', c.datos)}
    ${filaCuenta({ ir: 'e-rubros' }, 'maletin', c.rubros)}
    ${filaCuenta({ ir: 'e-caja' }, 'billetera', c.cobro, c.cobroDetalle)}
    ${filaCuenta({ ir: 'e-cupones', guia: true }, 'etiqueta', c.cupones, c.cuponesDetalle)}
  </div></div>
  <p class="de-etiqueta" data-entra>${esc(c.seccionConfig)}</p>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista">
    ${filaCuenta({ ir: 'e-config-notificaciones' }, 'campana', c.notificaciones)}
    ${filaCuenta({ ir: 'e-ayuda' }, 'pregunta', c.ayuda)}
  </div></div>
  <button type="button" class="hd-tarjeta hd-tarjeta--azul de-modo" data-demo-cambiar-rol="usuario" data-entra>
    <span class="de-modo__ico">${icono('casa')}</span>
    <span class="de-modo__texto"><strong>${esc(c.modoUsuario)}</strong><small>${esc(c.modoUsuarioTexto)}</small></span>
    ${icono('flecha')}
  </button>
  ${salirDeLaDemo()}
  ${boton({ ir: 'e-salir' }, `${icono('salir')}${esc(c.salir)}`, 'hd-boton hd-boton--fantasma de-peligro')}
`)}
${navDemo(ROL, 3)}
</div>`,
  };
}

// ── Cobros ────────────────────────────────────────────────────────────────

function movimiento(titulo: string, nombreIcono: string, fechaTexto: string, presupuesto: number, abierto: boolean, hoy = false): string {
  return `<div class="de-turno de-mov"${hoy ? ' data-de-mov-hoy' : ''} data-entra>
  <div class="de-turno__cuerpo">
    ${rubroIco(nombreIcono)}
    <span class="de-turno__datos"><strong>${esc(titulo)}</strong><small>${esc(fechaTexto)}</small></span>
    <span class="de-turno__monto"><strong class="hd-precio" data-de-mov-neto>+ ${pesos(neto(presupuesto))}</strong><small>${esc(C.aTuCuenta)}</small></span>
  </div>
  <div class="de-mov__desglose" data-de-mov-desglose${abierto ? '' : ' hidden'}>${desglose(presupuesto)}</div>
  ${boton({ accion: 'verMas', extra: `aria-expanded="${abierto}"` }, verMas(completar(C.verMasDe, { rubro: titulo, fecha: fechaTexto }), abierto), 'de-franja')}
</div>`;
}

function caja(): PantallaDemo {
  const c = d.caja;
  const lista = [movimiento(c.trabajoHoy, c.iconoHoy, c.hoy, PRECIO, true, true), ...c.movimientos.map((m) => movimiento(m.rubro, m.icono, m.fecha, m.presupuesto, false))].join('');
  return {
    id: 'e-caja',
    titulo: d.pantallas.caja,
    html: `<div class="app de-caja">
${cabecera('blanca')}
<div class="de-caja__arriba">
  ${volverDemo(c.titulo)}
  <div class="de-banco" data-entra>
    <div class="de-banco__fila"><span class="hd-sobre">${esc(c.cuentaLabel)}</span>${boton({ ir: 'e-editar-cobro' }, `${icono('editar')}${esc(c.editar)}`, 'hd-boton hd-boton--chico hd-boton--blanco')}</div>
    <p class="de-banco__cbu"><small>${esc(c.cbuLabel)}</small><strong data-de-cbu-mostrado>${esc(c.cbu)}</strong></p>
    <p class="de-banco__alias"><small>${esc(c.aliasLabel)}</small><strong>${esc(c.alias)}</strong></p>
  </div>
  <p class="de-nota" data-entra>${icono('info')}<span>${plano(c.nota)}</span></p>
</div>
<div class="hd-hoja-azul de-hoja-azul de-hoja-azul--sola">
  <span class="de-manija" aria-hidden="true"></span>
  <p class="de-hoja-azul__titulo">${esc(c.panel)}</p>
  <div class="hd-scroll de-hoja-azul__lista">${lista}</div>
</div>
</div>`,
  };
}

// ── Mensajes ──────────────────────────────────────────────────────────────

function mensajes(): PantallaDemo {
  const m = d.mensajes;
  const filas = (m.orden as IdChat[])
    .map((id) => {
      const ch = d.chats[id];
      const ultimo = ch.mensajes[ch.mensajes.length - 1];
      const badge = ch.noLeidos
        ? `<span class="de-badge" data-de-badge="${id}" aria-label="${esc(completar(m.noLeidos, { n: ch.noLeidos }))}">${ch.noLeidos}</span>`
        : '';
      return boton(
        { accion: 'abrirChat', valor: id, ir: 'e-conversacion', extra: `data-de-chat-fila="${id}"` },
        `${avatarDe(ch.inicial, ch.tono)}<span class="hd-fila__texto"><strong>${esc(ch.nombre)}</strong><small class="de-chats__sub">${esc(ch.sub)}</small><small class="de-chats__ultimo" data-de-ultimo="${id}">${esc(ultimo.texto)}</small></span><span class="de-chats__fin"><small>${esc(ch.dia)}</small>${badge}</span>`,
        'hd-fila de-chats__fila',
      );
    })
    .join('');
  const ayuda = boton(
    { ir: 'e-ayuda' },
    `<span class="hd-avatar de-chats__ayuda" aria-hidden="true">${icono('pregunta')}</span><span class="hd-fila__texto"><strong>${esc(m.ayuda)}</strong><small>${esc(m.ayudaTexto)}</small></span><span class="hd-fila__fin">${icono('derecha')}</span>`,
    'hd-fila de-chats__fila',
  );
  return {
    id: 'e-mensajes',
    titulo: d.pantallas.mensajes,
    html: `<div class="app de-mensajes">
${cabecera('azul')}
${cuerpo(`
  <div class="de-titulo-fila" data-entra><p class="hd-titulo">${esc(m.titulo)}</p>${boton({ ir: 'e-contactos' }, `${icono('contactos')}${esc(m.contactos)}`, 'hd-chip hd-chip--tinte de-chip')}</div>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista de-chats">${filas}</div></div>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista">${ayuda}</div></div>
  <p class="de-nota de-nota--centro" data-entra>${icono('reloj')}<span>${esc(m.nota)}</span></p>
`)}
${navDemo(ROL, 2).replace('data-ir-raiz="e-cuenta"', 'data-ir-raiz="e-cuenta" data-guia')}
</div>`,
  };
}

// ── Hojas chicas ──────────────────────────────────────────────────────────

function contactos(): PantallaDemo {
  const c = d.contactos;
  const filas = (d.mensajes.orden as IdChat[])
    .map((id) => {
      const ch = d.chats[id];
      return `<div class="hd-fila" data-de-chat-fila="${id}">${avatarDe(ch.inicial, ch.tono)}<span class="hd-fila__texto"><strong>${esc(ch.nombre)}</strong><small>${esc(ch.sub)}</small></span>${boton(
        { accion: 'abrirChat', valor: id, ir: 'e-conversacion', etiqueta: completar(c.escribir, { nombre: ch.nombre }) },
        icono('enviar'),
        'hd-circulo hd-circulo--azul',
      )}</div>`;
    })
    .join('');
  return { id: 'e-contactos', titulo: d.pantallas.contactos, tipo: 'hoja', html: `${tituloHoja(c.titulo)}<div class="de-hoja"><div class="hd-lista" data-entra>${filas}</div></div>` };
}

function ayuda(): PantallaDemo {
  const a = d.ayuda;
  const items = a.preguntas
    .map(
      (q) =>
        `<div class="de-pregunta" data-entra>${boton({ accion: 'pregunta', extra: 'aria-expanded="false"' }, `<span>${esc(q.pregunta)}</span>${icono('abajo')}`, 'de-pregunta__boton')}<p class="de-pregunta__respuesta" hidden>${plano(q.respuesta)}</p></div>`,
    )
    .join('');
  return { id: 'e-ayuda', titulo: d.pantallas.ayuda, tipo: 'hoja', html: `${tituloHoja(a.titulo)}<div class="de-hoja de-preguntas">${items}</div>` };
}

function rubrosHoja(): PantallaDemo {
  const r = d.rubrosHoja;
  const activos = r.rubrosActivos as string[];
  const mosaicos = rubros.rubros
    .map((x) => boton({ accion: 'toggleRubro', valor: x.id, extra: `aria-pressed="${activos.includes(x.id)}"` }, `${icono(x.icono)}<span>${esc(x.corto ?? x.nombre)}</span>`, 'hd-mosaico'))
    .join('');
  const zonas = r.zonas
    .map((z, i) => boton({ accion: 'toggleZona', valor: String(i), extra: `aria-pressed="${r.zonasActivas.includes(i)}"` }, `${icono('pin')}${esc(z)}`, 'hd-chip de-chip'))
    .join('');
  return {
    id: 'e-rubros',
    titulo: d.pantallas.rubros,
    tipo: 'hoja',
    html: `${tituloHoja(r.titulo)}
<div class="de-hoja">
  <p class="de-etiqueta">${esc(r.rubrosLabel)}</p>
  <div class="hd-mosaicos de-mosaicos" data-entra>${mosaicos}</div>
  <p class="de-etiqueta">${esc(r.zonasLabel)}</p>
  <div class="hd-chips" data-entra>${zonas}</div>
  ${boton({ accion: 'guardarRubros', volver: true }, esc(r.guardar), 'hd-boton')}
</div>`,
  };
}

function datos(): PantallaDemo {
  const x = d.datos;
  const filas = x.filas
    .map(
      (f) =>
        `<div class="hd-fila"><span class="hd-fila__ico">${icono(f.icono)}</span><span class="hd-fila__texto"><small>${esc(f.label)}</small><strong>${esc(f.valor)}</strong></span>${f.ok ? `<span class="hd-chip hd-chip--exito hd-chip--mini">${icono('check')}</span>` : ''}</div>`,
    )
    .join('');
  return {
    id: 'e-datos',
    titulo: d.pantallas.datos,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}<div class="de-hoja"><div class="hd-lista" data-entra>${filas}</div>${boton({ volver: true }, esc(x.listo), 'hd-boton')}</div>`,
  };
}

/** Hoja de cupones: el cupón de la camada fundadora (números de tarifas.json). */
function cupones(): PantallaDemo {
  const x = d.cupones;
  return {
    id: 'e-cupones',
    titulo: d.pantallas.cupones,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}
<div class="de-hoja">
  <div class="hd-ticket hd-ticket--azul de-cupon" data-entra="pop">
    <div class="hd-ticket__papel">
      <div class="de-cupon__arriba">
        <span class="hd-chip hd-chip--amarillo hd-chip--mini">${icono('etiqueta')}${esc(x.etiqueta)}</span>
        <strong class="de-cupon__destacado">${plano(x.destacado)}</strong>
        <span class="de-cupon__texto">${plano(x.texto)}</span>
      </div>
      <div class="hd-ticket__corte"></div>
      <div class="de-cupon__abajo">${img('handys-grupo', 'de-cupon__handys', 600, 311)}<small>${plano(x.condicion)}</small></div>
    </div>
  </div>
  <p class="de-nota de-nota--centro">${icono('info')}<span>${plano(x.nota)}</span></p>
  ${boton({ volver: true }, esc(x.listo), 'hd-boton')}
</div>`,
  };
}

function cobro(): PantallaDemo {
  const x = d.cobro;
  return {
    id: 'e-editar-cobro',
    titulo: d.pantallas.cobro,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}
<div class="de-hoja de-cobro" data-de-cobro>
  <div data-entra>
    <p class="de-etiqueta">${esc(x.cbuLabel)}</p>
    <div class="de-cbu" data-de-cbu-caja>
      ${boton({ accion: 'escribirCbu' }, `${icono('billetera')}<span class="de-cbu__valor" data-de-cbu>${esc(x.cbuVacio)}</span>`, 'de-cbu__campo')}
      ${boton({ accion: 'borrarCbu', etiqueta: x.borrar, extra: 'data-de-cbu-borrar hidden' }, icono('cerrar'), 'hd-circulo de-circulo-chico')}
    </div>
    <div class="de-cbu__medidor"><span class="de-cbu__barra"><i data-de-cbu-barra></i></span><small data-de-cbu-contador>${esc(completar(x.contador, { n: 0 }))}</small></div>
  </div>
  <div class="hd-error-linea de-cobro__error" data-de-cbu-error hidden>${img('handy-llave-rota', '', 581, 547)}<span data-de-cbu-error-texto>${esc(completar(x.error, { n: 0 }))}</span>${boton({ accion: 'verErrorCobro' }, esc(x.errorVer), 'de-cobro__ver')}</div>
  <div data-entra>
    <p class="de-etiqueta">${esc(x.aliasLabel)}</p>
    <p class="de-campo de-campo--fijo">${icono('etiqueta')}<span>${esc(d.caja.alias)}</span></p>
  </div>
  <p class="de-nota">${icono('info')}<span>${plano(x.nota)}</span></p>
  ${boton({ accion: 'guardarCobro' }, esc(x.guardar), 'hd-boton')}
</div>`,
  };
}

function confirmar(id: string, titulo: string, x: { titulo: string; texto: string; si: string; no: string }, accion: string, personaje: string): PantallaDemo {
  return {
    id,
    titulo,
    tipo: 'hoja',
    html: `${tituloHoja(x.titulo)}
<div class="de-hoja de-confirmar">
  ${img(personaje, 'hd-handy de-confirmar__handy', 338, 339)}
  <p class="hd-texto">${esc(x.texto)}</p>
  <div class="hd-botones">
    ${boton({ accion }, esc(x.si), 'hd-boton hd-boton--peligro')}
    ${boton({ volver: true }, esc(x.no), 'hd-boton hd-boton--claro')}
  </div>
</div>`,
  };
}

// ── Rol ───────────────────────────────────────────────────────────────────

export function demoEspecialista(): DemoRol {
  return {
    inicio: 'e-inicio',
    pantallas: [
      inicio(),
      precio('e-precio'),
      precio('e-precio-programado'),
      aceptado(),
      enCamino(),
      chat('e-chat'),
      chat('e-conversacion'),
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
      cupones(),
      confirmar('e-cancelar', d.pantallas.cancelar, d.cancelar, 'confirmarCancelar', 'handy-cano-roto'),
      confirmar('e-salir', d.pantallas.salir, d.salir, 'salir', 'handy-engranaje-roto'),
    ],
    recorrido: d.recorrido,
  };
}
