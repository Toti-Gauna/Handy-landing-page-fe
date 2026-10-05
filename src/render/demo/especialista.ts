// Demo · lado del especialista (ronda 3): pantallas, hojas y recorrido.
// Basadas en assets/fotos/especialista y en las capturas del dueño (IMG_0197 agenda, IMG_0198 Tu precio,
// IMG_0199 trabajo en curso, IMG_0201 mensajes y contactos, IMG_0192(1) cambio de fecha), llevadas al kit (.hd-*)
// y a la base común (cabeceraChat, accionesChat, agenda, pantallasComunes; cuentas con src/demo/dinero.ts).
// El comportamiento vive en src/scripts/demo/especialista.ts y los estilos propios en src/styles/demo-especialista.css (.de-*).

import d from '../../content/demo-especialista.json' with { type: 'json' };
import demo from '../../content/demo.json' with { type: 'json' };
import rubros from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, plano } from '../util.ts';
import { estado, fotoCano, logo } from '../pantallas.ts';
import { boton, cabeceraDemo, navDemo, salirDeLaDemo, tildeExito, tituloHoja, tituloMarcado, volverDemo, type Toque } from './piezas.ts';
import { accionesChat, agenda, cabeceraChat, pantallasComunes, type ContactoDemo } from './comunes.ts';
import { mapaVivo, type OpcionesMapa } from './mapa.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';
import { desglose, formatoPesos, type Concepto, type Presupuesto, type Tarifas } from '../../demo/dinero.ts';
import { fechaLarga, leerHora } from '../../demo/fechas.ts';

const ROL = 'especialista' as const;
const C = d.comun;

// ── Datos (tipados) ───────────────────────────────────────────────────────

interface Mensaje {
  de: string;
  texto: string;
  foto: boolean;
}
interface Chat {
  nombre: string;
  inicial: string;
  tono: string;
  sub: string;
  dia: string;
  noLeidos: number;
  turno: string;
  rubro: string;
  icono: string;
  barrio: string;
  sugerido: number;
  mensajes: Mensaje[];
  rapidas: { chip: string; texto: string; respuesta: string; antesDeLlegar: boolean }[];
}
interface Trabajo {
  id: string;
  fecha: string;
  hora: string;
  rubro: string;
  icono: string;
  detalle: string;
  barrio: string;
  manoDeObra: number;
  materiales: number;
  chat: string;
  pedido: string;
  estado: string;
}

const CHATS = d.chats as Record<string, Chat>;
const TRABAJOS = d.turnos.trabajos as Trabajo[];
const TARIFAS: Tarifas = { cliente: tarifas.normal.cliente, especialista: tarifas.normal.especialista };
const HOY = demo.config.hoy;

/** Precio que sugiere Handy para el pedido principal. */
const SUGERIDO = d.inicio.pedido.sugerido;
/** Presupuesto del recorrido: el de ejemplo de tarifas.json, el mismo que ve el usuario del otro lado. */
const PRECIO = tarifas.ejemplo.presupuesto;
const MATERIALES = d.precio.materiales;
if (Number(d.precio.tecleo) !== PRECIO) {
  throw new Error(`Demo especialista: precio.tecleo (${d.precio.tecleo}) tiene que ser el presupuesto de ejemplo de tarifas.json (${PRECIO})`);
}
if (!(MATERIALES > 0 && MATERIALES < PRECIO)) throw new Error('Demo especialista: precio.materiales tiene que ser mayor que 0 y menor que el presupuesto');
if (d.cobro.cbuEjemplo.replace(/\D/g, '').length !== 22) throw new Error('Demo especialista: cobro.cbuEjemplo tiene que tener 22 números');
for (const t of TRABAJOS) {
  if (!(t.chat in CHATS)) throw new Error(`Demo especialista: el trabajo ${t.id} apunta a un chat que no existe (${t.chat})`);
}
for (const id of d.mensajes.orden) if (!(id in CHATS)) throw new Error(`Demo especialista: mensajes.orden tiene "${id}", que no es un chat`);
for (const c of d.contactos.lista) if (!(c.id in CHATS)) throw new Error(`Demo especialista: el contacto "${c.id}" no tiene chat`);
if (!(d.solicitud.chat in CHATS)) throw new Error('Demo especialista: solicitud.chat no existe');
leerHora(d.solicitud.hora);

// ── Cuentas (las mismas que hace el navegador, con src/demo/dinero.ts) ──

/** El presupuesto del pedido de La Perla: los materiales estimados y el resto es mano de obra. */
const presupuestoDe = (precio: number, materiales = MATERIALES): Presupuesto => {
  const m = Math.min(materiales, precio);
  return { manoDeObra: precio - m, materiales: m };
};
const presupuestoTrabajo = (t: Trabajo): Presupuesto => ({ manoDeObra: t.manoDeObra, materiales: t.materiales });
const neto = (p: Presupuesto) => desglose(p, TARIFAS).netoEspecialista;
const pesos = (n: number) => esc(formatoPesos(n));
const completar = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const cuandoTexto = (fecha: string, hora: string) => `${fechaLarga(fecha)}, ${hora}`;

// ── Piezas propias ────────────────────────────────────────────────────────

/** Cabecera de la app: la campana lleva a los avisos y el pin (si va) a tus rubros y zonas. */
const cabecera = (variante: 'blanca' | 'azul', conPin = true) => cabeceraDemo(ROL, variante, conPin ? { ir: 'e-rubros', etiqueta: C.zonas } : false);

/** Fila "concepto ...... monto" del kit. */
const dato = (izq: string, der: string, clase = '') => `<p class="hd-dato ${clase}"><span>${izq}</span><span>${der}</span></p>`;

/**
 * Desglose para el especialista: mano de obra + materiales (+ adicionales aceptados) = tu presupuesto,
 * − la tarifa de Handy del especialista = lo que te queda. La tarifa del cliente no aparece acá (no se mezcla).
 */
function filasDesglose(p: Presupuesto, ultimo: string = C.recibis, aprobados: Concepto[] = []): string {
  const x = desglose(p, TARIFAS, aprobados);
  return `${dato(esc(C.manoDeObra), pesos(p.manoDeObra))}
${p.materiales ? dato(esc(C.materiales), pesos(p.materiales)) : ''}
${aprobados.map((a) => dato(esc(a.descripcion), `+ ${pesos(a.monto)}`, 'de-dato--extra')).join('')}
${dato(esc(C.presupuesto), pesos(x.subtotal), 'de-dato--sub')}
${dato(plano(C.tarifa), `− ${pesos(x.tarifaEspecialista)}`, 'de-dato--resta')}
${dato(esc(ultimo), `<span data-de-total>${pesos(x.netoEspecialista)}</span>`, 'hd-dato--total')}`;
}

/** Ticket troquelado (como los cupones de la app): arriba lo que es, abajo los números. */
const ticket = (arriba: string, abajo: string, clase = '', attrs = '') =>
  `<div class="hd-ticket de-ticket ${clase}" ${attrs}><div class="hd-ticket__papel"><div class="de-ticket__arriba">${arriba}</div><div class="hd-ticket__corte"></div><div class="de-ticket__abajo">${abajo}</div></div></div>`;

/** Mosaico chico con el ícono del rubro. */
const rubroIco = (nombre: string, clase = '') => `<span class="de-rubro ${clase}">${icono(nombre)}</span>`;

/** Avatar con iniciales fijas (los clientes de la demo no tienen nombre: se usan las del barrio). */
const avatarDe = (inicial: string, tono: string, clase = '', attrs = '') =>
  `<span class="hd-avatar ${clase}" style="--tono:${esc(tono)}" aria-hidden="true" ${attrs}><span>${esc(inicial)}</span></span>`;

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
  yo?: [number, number];
  radarYo?: boolean;
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

const trayecto = (desde: string, hasta: string) => `<div class="de-trayecto"><span><i></i>${esc(desde)}</span><span><i></i>${esc(hasta)}</span></div>`;

/** Contenedor con scroll (sin barra) para el cuerpo de las pantallas largas. */
const cuerpo = (html: string, clase = '') => `<div class="hd-scroll de-cuerpo ${clase}">${html}</div>`;

/** Selector discreto para la presentación: qué responde el cliente (mock). */
function simulador(): string {
  const s = d.simular;
  return `<div class="de-sim" role="group" aria-label="${esc(s.titulo)}">
  <p class="de-sim__titulo">${icono('engranaje')}<span>${esc(s.titulo)}</span></p>
  <div class="de-sim__ops">${boton({ accion: 'simular', valor: 'acepta', extra: 'aria-pressed="true"' }, esc(s.acepta), 'de-sim__op')}${boton({ accion: 'simular', valor: 'rechaza', extra: 'aria-pressed="false"' }, esc(s.rechaza), 'de-sim__op')}</div>
</div>`;
}

/** Teclado numérico (botones): escribir un monto sin el teclado del celular, que taparía la hoja. */
function teclado(): string {
  const p = d.precio;
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];
  return `<div class="de-teclado" data-de-teclado role="group" aria-label="${esc(p.teclado)}">
  ${teclas.map((n) => boton({ accion: 'tecla', valor: n, etiqueta: completar(p.tecla, { n }) }, esc(n), 'de-tecla')).join('')}
  ${boton({ accion: 'tecla', valor: 'borrar', etiqueta: p.borrar }, icono('atras'), 'de-tecla de-tecla--borrar')}
</div>`;
}

/**
 * Bloque de precio (IMG_0198): sugerido, stepper, chips, "Escribir otro monto" con teclado, el aviso del mínimo
 * pegado al importe y lo que te queda después de la tarifa del especialista.
 */
function bloquePrecio(sugerido: number, materiales = 0): string {
  const p = d.precio;
  const paso = formatoPesos(p.paso);
  const chips = [
    boton({ accion: 'precioSugerido', extra: 'aria-pressed="true"' }, esc(p.dejar), 'hd-chip de-chip'),
    ...p.sumas.map((s) => boton({ accion: 'precioSumar', valor: String(s), extra: 'aria-pressed="false"' }, `+ ${pesos(s)}`, 'hd-chip de-chip')),
  ].join('');
  return `<div class="de-precio__caja" data-entra>
    <p class="de-precio__sugerido">${img('handy-lamparita', 'de-precio__handy', 202, 346)}<span>${esc(p.sugeridoLabel)} <strong data-de-sugerido>${pesos(sugerido)}</strong></span><span class="hd-chip hd-chip--amarillo de-chip-nota">${esc(p.sugeridoNota)}</span></p>
    <div class="de-precio__monto">
      ${boton({ accion: 'precioPaso', valor: String(-p.paso), etiqueta: completar(p.bajar, { monto: paso }) }, `<span aria-hidden="true">−</span>`, 'hd-circulo de-paso')}
      <span class="de-precio__valor" aria-live="polite"><span class="sr">${esc(p.campoLabel)}</span><strong class="hd-precio hd-precio--grande" data-de-precio>${pesos(sugerido)}</strong></span>
      ${boton({ accion: 'precioPaso', valor: String(p.paso), etiqueta: completar(p.subir, { monto: paso }) }, `<span aria-hidden="true">+</span>`, 'hd-circulo de-paso')}
    </div>
    <p class="de-minimo" data-de-minimo role="alert" hidden>${icono('alerta')}<span>${esc(p.minimoTexto)}</span></p>
    ${materiales ? `<p class="de-precio__materiales" data-de-materiales>${icono('info')}<span>${esc(completar(p.materialesNota, { monto: formatoPesos(materiales) }))}</span></p>` : ''}
    <div class="hd-chips de-precio__chips">${chips}</div>
    ${boton({ accion: 'teclado', extra: 'aria-expanded="false" data-de-teclado-btn' }, `${icono('editar')}<span data-de-teclado-texto>${esc(p.escribir)}</span>`, 'de-escribir')}
    <div class="de-teclado-caja" data-de-teclado-caja hidden>${teclado()}</div>
  </div>
  <div class="de-recibis" data-entra>
    <span class="de-recibis__icono">${icono('billetera')}</span>
    <span class="de-recibis__texto"><small>${esc(p.recibis)}</small><strong class="hd-precio" data-de-recibis>${pesos(neto(presupuestoDe(sugerido, materiales)))}</strong></span>
    <small class="de-recibis__retiene" data-de-retiene>${esc(completar(p.retiene, { tarifaEspecialista: `${tarifas.normal.especialista}%`, monto: formatoPesos(desglose(presupuestoDe(sugerido, materiales), TARIFAS).tarifaEspecialista) }))}</small>
  </div>`;
}

/** "Prefiero elegir la fecha" / "Prefiero elegir el horario" (abren las hojas comunes). */
function elegirCuando(fecha: string, hora: string): string {
  return `<div class="de-elegir">
  ${boton({ accion: 'cuandoFecha', extra: 'aria-pressed="false" data-de-elegir="fecha"' }, `${icono('calendario')}<span>${esc(fecha)}</span>`, 'hd-chip de-chip de-elegir__op')}
  ${boton({ accion: 'cuandoHora', extra: 'aria-pressed="false" data-de-elegir="hora"' }, `${icono('reloj')}<span>${esc(hora)}</span>`, 'hd-chip de-chip de-elegir__op')}
</div>`;
}

// ── Inicio: mapa, "Disponible" y el pedido que entra ─────────────────────

const YO: [number, number] = [96, 266];
const CLIENTE: [number, number] = [206, 186];

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
 * Hoja "Tu precio" (IMG_0198). Dos: la del pedido de urgencia (con las franjas sugeridas para declarar cuándo
 * podés ir) y la del pedido programado (con el día y el horario que pidió el cliente). En las dos se puede
 * elegir otra fecha u otro horario: es una propuesta que el cliente acepta o rechaza.
 */
function precio(id: 'e-precio' | 'e-precio-programado'): PantallaDemo {
  const p = d.precio;
  const urgencia = id === 'e-precio';
  const sugerido = urgencia ? SUGERIDO : d.programado.sugerido;
  const franjas = p.franjas
    .map((f, i) => boton({ accion: 'franja', valor: String(i), extra: `aria-pressed="${i === 0}"` }, `${icono('reloj')}${esc(f.texto)}`, 'hd-chip de-chip'))
    .join('');
  const pidio = `<p class="de-pidio">${icono('calendario')}<span>${esc(`${d.programado.dia}, ${d.programado.franja}`)}</span></p>`;
  return {
    id,
    titulo: urgencia ? d.pantallas.precio : d.pantallas.precioProgramado,
    tipo: 'hoja',
    html: `${tituloHoja(p.titulo)}
<div class="de-hoja de-precio" data-de-precio-hoja>
  <div class="de-cuando" data-entra>
    <p class="de-etiqueta">${esc(urgencia ? p.cuandoLabel : p.pidioLabel)}</p>
    ${urgencia ? `<div class="hd-chips de-franjas">${franjas}</div>` : pidio}
    ${elegirCuando(p.elegirFecha, p.elegirHora)}
    <p class="de-propones" data-de-propones hidden>${icono('info')}<span data-de-propones-texto></span></p>
  </div>
  ${bloquePrecio(sugerido, urgencia ? MATERIALES : 0)}
  ${simulador()}
  ${boton({ accion: 'ponerPrecio', extra: 'data-de-enviar' }, `${esc(p.boton)}${icono('enviar')}`, 'hd-boton')}
</div>`,
  };
}

// ── Presupuesto enviado → el cliente te elige (o elige otra propuesta) ───

function aceptado(): PantallaDemo {
  const a = d.aceptado;
  const f = d.precio.franjas[0];
  return {
    id: 'e-aceptado',
    titulo: d.pantallas.aceptado,
    html: `<div class="app de-aceptado" data-de-aceptado data-estado="esperando">
${cabecera('azul')}
${cuerpo(
  `
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
  <div class="de-estado de-estado--rechazado">
    ${img('handy-cano-roto', 'hd-handy de-rechazo__handy', 354, 405)}
    <p class="hd-sobre">${esc(a.rechazadoSobre)}</p>
    ${tituloMarcado(a.rechazadoTitulo, 'hd-titulo')}
    <p class="hd-texto hd-texto--suave">${esc(a.rechazadoTexto)}</p>
  </div>
  ${ticket(
    `${rubroIco('canilla')}<span class="de-ticket__titulo"><strong>${esc(a.trabajo)}</strong><small data-de-franja>${esc(f.texto)}</small></span><span class="hd-chip hd-chip--amarillo hd-chip--mini">${icono('alerta')}${esc(C.urgencia)}</span>`,
    `<div data-de-costo>${filasDesglose(presupuestoDe(PRECIO))}</div>`,
    '',
    'data-entra',
  )}
`,
  'de-cuerpo--centro',
)}
<div class="de-pie de-pie--fila">
  ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-chat', etiqueta: a.chatear, extra: 'data-de-aceptado-chat hidden' }, icono('chat'), 'de-cuadro')}
  ${boton({ ir: 'e-en-camino', extra: 'data-de-ir-alla disabled' }, `<span data-de-ir-texto>${esc(a.esperandoBoton)}</span>${icono('flecha')}`, 'hd-boton')}
  ${boton({ raiz: 'e-inicio', extra: 'data-de-aceptado-inicio hidden' }, esc(a.volverInicio), 'hd-boton hd-boton--claro')}
</div>
</div>`,
  };
}

// ── En camino: llegada automática con la geocerca simulada ───────────────

const CASA_CAMINO: [number, number] = [188, 300];

function enCamino(): PantallaDemo {
  const c = d.camino;
  const u = c.ubicacion;
  const iconosEstado: Record<string, string> = {
    'en-camino': 'caminar',
    'senal-imprecisa': 'alerta',
    'sin-senal': 'prohibido',
    'sin-permiso': 'pin',
    llego: 'checkCirculo',
  };
  const opciones = u.opciones
    .map((o) => boton({ accion: 'simularUbicacion', valor: o.valor, extra: `aria-pressed="${o.valor === 'normal'}"` }, esc(o.texto), 'de-sim__op'))
    .join('');
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
<div class="hd-hoja-azul hd-scroll de-camino__hoja">
  <span class="de-manija" aria-hidden="true"></span>
  <div class="de-camino__destino" data-entra>
    <p class="hd-sobre">${esc(c.sobre)}</p>
    <p class="de-camino__direccion">${esc(c.destino)}</p>
    <p class="de-camino__franja">${icono('reloj')}<span data-de-franja>${esc(d.precio.franjas[0].texto)}</span></p>
  </div>
  <div data-entra>
    <div class="hd-seguimiento de-seguimiento" data-etapa="0" data-de-seguimiento aria-hidden="true">
      <span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span>
      <span class="hd-seguimiento__quien">${icono('caminar')}</span>
    </div>
    <div class="de-etapas">${c.etapas.map((e) => `<span>${esc(e)}</span>`).join('')}</div>
  </div>
  <div class="de-llegada" data-de-llegada data-estado="pidiendo-permiso" data-entra>
    <div class="de-llegada__pedir" data-de-llegada-pedir>
      <p class="de-llegada__fila"><span class="de-llegada__ico">${icono('pin')}</span><span class="de-llegada__texto"><strong>${esc(u.titulo)}</strong><small>${esc(u.texto)}</small></span></p>
      <div class="hd-botones hd-botones--fila">
        ${boton({ accion: 'ubicacion', valor: 'no' }, esc(u.ahoraNo), 'hd-boton hd-boton--chico hd-boton--claro')}
        ${boton({ accion: 'ubicacion', valor: 'si', guia: true }, esc(u.permitir), 'hd-boton hd-boton--chico hd-boton--amarillo')}
      </div>
    </div>
    <div class="de-llegada__estado" data-de-llegada-estado aria-live="polite" hidden>
      <p class="de-llegada__fila"><span class="de-llegada__ico">${Object.entries(iconosEstado)
        .map(([e, n]) => `<span data-de-llegada-ico="${e}" hidden>${icono(n)}</span>`)
        .join('')}</span><span class="de-llegada__texto"><strong data-de-llegada-titulo></strong><small data-de-llegada-texto></small></span></p>
      ${boton({ accion: 'ubicacion', valor: 'si', extra: 'data-de-llegada-activar hidden' }, esc(u.activar), 'hd-boton hd-boton--chico hd-boton--amarillo')}
    </div>
  </div>
  <div class="de-cliente" data-entra>
    ${avatarDe(CHATS.perla.inicial, CHATS.perla.tono, 'de-cliente__avatar')}
    <span class="de-cliente__texto"><strong>${esc(c.cliente)}</strong><small>${esc(c.sinTelefono)}</small></span>
    ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-chat', etiqueta: c.chatear }, icono('chat'), 'hd-circulo hd-circulo--azul de-cliente__chat')}
  </div>
  <div class="de-sim de-sim--azul" role="group" aria-label="${esc(u.simular)}">
    <p class="de-sim__titulo">${icono('engranaje')}<span>${esc(u.simular)}</span></p>
    <div class="de-sim__ops">${opciones}</div>
  </div>
</div>
</div>`,
  };
}

// ── Chats ─────────────────────────────────────────────────────────────────

function burbuja(m: Mensaje): string {
  const propia = m.de === 'esp';
  return `<div class="de-burbuja de-burbuja--${propia ? 'propia' : 'otra'}${m.foto ? ' de-burbuja--foto' : ''}">${m.foto ? fotoCano : ''}<span>${esc(m.texto)}</span></div>`;
}

const mensajesChat = (id: string) => {
  const ch = CHATS[id];
  return `<p class="de-chat__dia">${esc(ch.dia)}</p>${ch.mensajes.map(burbuja).join('')}`;
};

/**
 * Chat con un cliente (cabeceraChat: sin logo ni campana). Tres pantallas con el mismo molde:
 * "e-chat" (la del recorrido, con el cliente de hoy), "e-conversacion" (desde Mensajes, Contactos, el trabajo o un
 * turno) y "e-chat-nuevo" (un cliente que todavía no es contacto y te manda una solicitud de turno).
 */
function chat(id: 'e-chat' | 'e-conversacion' | 'e-chat-nuevo', inicial: string): PantallaDemo {
  const c = d.chat;
  const ch = CHATS[inicial];
  const plantillas =
    id === 'e-conversacion'
      ? Object.keys(CHATS)
          .filter((x) => x !== d.solicitud.chat)
          .map((x) => `<template data-de-plantilla="${x}">${mensajesChat(x)}</template>`)
          .join('')
      : `<template data-de-plantilla="${inicial}">${mensajesChat(inicial)}</template>`;
  const verTurno = boton({ accion: 'verTurno', ir: 'e-turno-detalle', etiqueta: c.verTurno, extra: 'data-de-ver-turno hidden' }, icono('calendario'), 'hd-circulo de-chat__turno');
  const titulo = id === 'e-chat' ? d.pantallas.chat : id === 'e-chat-nuevo' ? d.pantallas.chatNuevo : d.pantallas.conversacion;
  return {
    id,
    titulo,
    html: `<div class="app de-chat" data-de-chat="${inicial}">
${cabeceraChat({ nombre: ch.nombre, detalle: ch.sub, avatar: avatarDe(ch.inicial, ch.tono, 'hd-avatar--chico', 'data-de-chat-avatar') }, { volver: true }, verTurno)}
<div class="hd-scroll de-chat__mensajes" data-de-mensajes>${mensajesChat(inicial)}</div>
<div class="de-chat__abajo">
  ${accionesChat(id === 'e-chat-nuevo' ? { contacto: inicial } : {})}
  <div class="hd-chips hd-chips--carril de-chat__rapidas" data-de-rapidas role="group" aria-label="${esc(c.rapidasLabel)}"></div>
  <div class="de-chat__barra">
    ${boton({ accion: 'adjuntar', etiqueta: c.adjuntar }, icono('imagen'), 'hd-circulo de-chat__adjuntar')}
    ${boton({ accion: 'escribirChat', extra: 'data-de-campo-chat' }, `<span data-de-campo-texto>${esc(c.input)}</span>`, 'de-chat__campo')}
    ${boton({ accion: 'enviarChat', etiqueta: c.enviar, extra: 'data-de-enviar-chat' }, icono('enviar'), 'hd-circulo hd-circulo--azul de-chat__enviar')}
  </div>
</div>
${plantillas}
<template data-de-plantilla-escribiendo><div class="de-burbuja de-burbuja--otra de-burbuja--escribiendo" role="status" aria-label="${esc(c.escribiendo)}"><span class="hd-escribiendo"><i></i><i></i><i></i></span></div></template>
<template data-de-plantilla-foto><div class="de-burbuja de-burbuja--propia de-burbuja--foto">${fotoCano}<span>${esc(c.fotoTexto)}</span></div></template>
<template data-de-plantilla-responder><div class="de-solicitud-acciones">${boton({ accion: 'cotizar' }, `${icono('etiqueta')}${esc(c.responder)}`, 'hd-boton hd-boton--chico')}</div></template>
</div>`,
  };
}

// ── Hoja: propuesta desde el chat (programar, ahora o responder una solicitud) ──

function propuestaHoja(): PantallaDemo {
  const p = d.propuesta;
  const franjas = d.precio.franjas
    .map((f, i) => boton({ accion: 'franja', valor: String(i), extra: `aria-pressed="${i === 0}"` }, `${icono('reloj')}${esc(f.texto)}`, 'hd-chip de-chip'))
    .join('');
  const campo = (accion: string, ico: string, etiqueta: string, slot: string) =>
    boton({ accion, extra: `data-de-prop-campo="${slot}"` }, `${icono(ico)}<span class="de-campo__texto"><small>${esc(etiqueta)}</small><strong data-de-prop-valor="${slot}"></strong></span>${icono('editar')}`, 'de-campo de-campo--elegir');
  return {
    id: 'e-propuesta',
    titulo: d.pantallas.propuesta,
    tipo: 'hoja',
    html: `${tituloHoja(p.titulo)}
<div class="de-hoja de-precio de-prop" data-de-precio-hoja data-de-prop>
  <p class="de-prop__para" data-entra><strong data-de-prop-modo></strong><small data-de-prop-para></small></p>
  <p class="de-pidio de-prop__pidio" data-de-prop-pidio hidden>${icono('calendario')}<span data-de-prop-pidio-texto></span></p>
  ${bloquePrecio(SUGERIDO)}
  <div class="de-cuando" data-entra>
    <p class="de-etiqueta" data-de-prop-cuando-label>${esc(p.cuandoLabel)}</p>
    <div class="de-prop__campos" data-de-prop-programar>
      ${campo('cuandoFecha', 'calendario', p.fechaLabel, 'fecha')}
      ${campo('cuandoHora', 'reloj', p.horaLabel, 'hora')}
    </div>
    <div class="hd-chips de-franjas" data-de-prop-ahora hidden>${franjas}</div>
  </div>
  ${simulador()}
  ${boton({ accion: 'mandarPropuesta', extra: 'data-de-enviar' }, `${esc(p.boton)}${icono('enviar')}`, 'hd-boton')}
  <p class="de-nota">${icono('info')}<span>${esc(d.precio.pendienteNota)}</span></p>
</div>`,
  };
}

// ── Trabajo en curso (IMG_0199) ──────────────────────────────────────────

function trabajo(): PantallaDemo {
  const t = d.trabajo;
  const f = d.precio.franjas[0];
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
  <div class="de-adicionales" data-entra>
    <p class="de-etiqueta">${esc(t.adicionalesLabel)}</p>
    ${boton({ ir: 'e-adicional', accion: 'abrirAdicional', extra: 'data-de-agregar' }, `<span class="de-agregar__ico">${icono('mas')}</span><span>${esc(t.agregarAdicional)}</span>`, 'de-agregar')}
    <div class="de-pendiente" data-de-pendiente role="status" hidden>
      <span class="hd-escribiendo de-pendiente__puntos" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="de-pendiente__texto"><strong>${esc(t.pendiente)}</strong><small data-de-pendiente-texto></small></span>
    </div>
    <p class="de-nota de-adicional__rechazo" data-de-adicional-rechazo role="status" hidden>${icono('info')}<span data-de-adicional-rechazo-texto></span></p>
  </div>
  ${ticket(
    `${rubroIco('billetera')}<span class="de-ticket__titulo"><strong>${esc(t.costoLabel)}</strong><small>${plano(C.tarifa)}</small></span>`,
    `<div data-de-costo>${filasDesglose(presupuestoDe(PRECIO))}</div>`,
    '',
    'data-entra',
  )}
  <div class="de-enlaces" data-entra>
    ${boton({ ir: 'e-ayuda' }, `${icono('pregunta')}${esc(t.ayuda)}`, 'hd-boton hd-boton--fantasma')}
    ${boton({ ir: 'e-cancelar' }, `${icono('prohibido')}${esc(t.cancelar)}`, 'hd-boton hd-boton--fantasma de-peligro')}
  </div>
`)}
<div class="de-pie de-pie--fila">
  ${boton({ accion: 'abrirChat', valor: 'perla', ir: 'e-conversacion', etiqueta: t.chatear }, icono('chat'), 'de-cuadro')}
  ${boton({ ir: 'e-fin', extra: 'data-de-terminar' }, `${esc(t.terminar)}${icono('check')}`, 'hd-boton')}
</div>
</div>`,
  };
}

/** Hoja "Agregar al trabajo": opción personalizada primero, después las de la lista. */
function adicional(): PantallaDemo {
  const a = d.adicional;
  const op = (valor: string, ico: string, titulo: string, sub: string, monto = '') =>
    boton(
      { accion: 'adicionalOp', valor, extra: 'aria-pressed="false"' },
      `<span class="de-opcion__ico">${icono(ico)}</span><span class="de-opcion__texto"><strong>${esc(titulo)}</strong><small>${esc(sub)}</small></span>${monto ? `<strong class="hd-precio de-opcion__monto">${monto}</strong>` : ''}`,
      'de-opcion',
    );
  const opciones = [
    op('personalizada', 'editar', a.personalizada, a.personalizadaTexto),
    ...a.opciones.map((o) => op(o.id, o.tipo === 'mano' ? 'maletin' : 'llave', o.descripcion, a.tipos[o.tipo as 'mano' | 'material'], pesos(o.monto))),
  ].join('');
  return {
    id: 'e-adicional',
    titulo: d.pantallas.adicional,
    tipo: 'hoja',
    html: `${tituloHoja(a.titulo)}
<div class="de-hoja de-adicional" data-de-adicional>
  <p class="hd-texto hd-texto--suave">${esc(a.bajada)}</p>
  <div class="de-opciones" role="group" aria-label="${esc(a.titulo)}" data-entra>${opciones}</div>
  <div class="de-personalizada" data-de-personalizada hidden>
    <p class="de-etiqueta">${esc(a.tipoLabel)}</p>
    <div class="hd-chips">${boton({ accion: 'adicionalTipo', valor: 'material', extra: 'aria-pressed="true"' }, `${icono('llave')}${esc(a.tipos.material)}`, 'hd-chip de-chip')}${boton({ accion: 'adicionalTipo', valor: 'mano', extra: 'aria-pressed="false"' }, `${icono('maletin')}${esc(a.tipos.mano)}`, 'hd-chip de-chip')}</div>
    <label class="de-etiqueta" for="de-adicional-desc">${esc(a.descripcionLabel)}</label>
    <input id="de-adicional-desc" class="de-input" type="text" maxlength="40" autocomplete="off" placeholder="${esc(a.descripcionEjemplo)}" data-de-adicional-desc />
    <p class="de-etiqueta">${esc(a.precioLabel)}</p>
    <p class="de-adicional__monto"><strong class="hd-precio hd-precio--grande" data-de-adicional-monto>${pesos(0)}</strong></p>
    ${teclado()}
  </div>
  <div class="de-adicional__resumen" data-de-adicional-resumen hidden>
    <p class="de-etiqueta">${esc(a.clienteVe)}</p>
    <dl class="de-dl" data-de-adicional-cliente></dl>
    <p class="de-recibis de-recibis--mini"><span class="de-recibis__icono">${icono('billetera')}</span><span class="de-recibis__texto"><small>${esc(a.recibirias)}</small><strong class="hd-precio" data-de-adicional-neto></strong></span></p>
  </div>
  <p class="de-minimo" data-de-adicional-falta role="alert" hidden>${icono('alerta')}<span></span></p>
  ${simulador()}
  ${boton({ accion: 'mandarAdicional', extra: 'data-de-enviar disabled' }, `${esc(a.boton)}${icono('enviar')}`, 'hd-boton')}
  <p class="de-nota">${icono('info')}<span>${esc(a.nota)}</span></p>
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
${cuerpo(
  `
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
  <p class="de-fin__ganaste" data-entra><small>${esc(f.ganaste)}</small><strong class="hd-precio hd-precio--grande hd-positivo" data-de-ganaste>${pesos(neto(presupuestoDe(PRECIO)))}</strong></p>
  ${ticket(
    `${rubroIco('canilla')}<span class="de-ticket__titulo"><strong>${esc(d.aceptado.trabajo)}</strong><small>${esc(d.caja.hoy)}</small></span><span class="hd-chip hd-chip--exito hd-chip--mini">${icono('check')}${esc(C.aTuCuenta)}</span>`,
    `<div data-de-costo>${filasDesglose(presupuestoDe(PRECIO), C.aTuCuenta)}</div>`,
    '',
    'data-entra',
  )}
  <p class="de-nota de-nota--centro" data-entra>${icono('billetera')}<span>${plano(f.texto)}</span></p>
`,
  'de-cuerpo--centro',
)}
<div class="de-pie">
  <div class="hd-botones">
    ${boton({ raiz: 'e-turnos', guia: true }, `${icono('calendario')}${esc(f.agenda)}`, 'hd-boton')}
    ${boton({ raiz: 'e-inicio' }, esc(f.inicio), 'hd-boton hd-boton--claro')}
  </div>
</div>
</div>`,
  };
}

// ── Agenda (IMG_0197, sin la barra tapando nada) ─────────────────────────

/** "Ver más información" + el contexto que solo escuchan los lectores de pantalla. */
const verMas = (contexto: string, abierto = false) =>
  `<span data-de-ver-mas-texto>${esc(abierto ? C.verMenos : C.verMas)}</span><span class="sr" data-de-t="contexto">: ${esc(contexto)}</span>`;

/** Tarjeta de un trabajo en la agenda (blanca con franja gris). El navegador usa la misma como molde. */
function tarjetaTrabajo(t: Trabajo): string {
  const est = d.turnos.estados as Record<string, string>;
  return `<div class="de-turno de-turno--${esc(t.estado)}" data-de-turno="${esc(t.id)}">
  <div class="de-turno__cuerpo">
    <span class="de-rubro" data-de-t="icono">${icono(t.icono)}</span>
    <span class="de-turno__datos"><strong data-de-t="detalle">${esc(t.detalle)}</strong><small data-de-t="lugar">${esc(`${t.rubro} · ${t.barrio}`)}</small><small data-de-t="hora">${icono('reloj')}<span>${esc(t.hora)}</span></small></span>
    <span class="de-turno__monto"><strong class="hd-precio" data-de-t="neto">+ ${pesos(neto(presupuestoTrabajo(t)))}</strong><small data-de-t="estado">${esc(est[t.estado] ?? '')}</small></span>
  </div>
  ${boton({ accion: 'verTurno', valor: t.id, ir: 'e-turno-detalle' }, verMas(`${t.detalle}, ${cuandoTexto(t.fecha, t.hora)}`), 'de-franja')}
</div>`;
}

function turnos(): PantallaDemo {
  const t = d.turnos;
  const molde: Trabajo = { ...TRABAJOS[0], id: '', estado: 'confirmado' };
  return {
    id: 'e-turnos',
    titulo: d.pantallas.turnos,
    html: `<div class="app de-turnos">
${cabecera('blanca')}
${cuerpo(
  `
  ${tituloMarcado(t.titulo, 'hd-titulo de-turnos__titulo')}
  <div class="de-agenda__cal" data-entra>${agenda(
    ROL,
    TRABAJOS.map((x) => ({ id: x.id, fecha: x.fecha, html: tarjetaTrabajo(x) })),
    HOY,
  )}</div>
`,
  'de-agenda',
)}
${navDemo(ROL, 1)}
<template data-de-molde-trabajo>${tarjetaTrabajo(molde)}</template>
</div>`,
  };
}

// ── Detalle del turno ─────────────────────────────────────────────────────

function detalle(): PantallaDemo {
  const x = d.detalle;
  const t = TRABAJOS.find((w) => w.estado === 'confirmado')!;
  const ch = CHATS[t.chat];
  const iconos = [...new Set([...TRABAJOS.map((it) => it.icono), d.inicio.pedido.icono])]
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
    <span class="de-detalle__fecha"><small data-de-d="dow"></small><strong data-de-d="num"></strong><small data-de-d="mes"></small></span>
    <span class="de-detalle__que">
      <span class="hd-chip hd-chip--claro hd-chip--mini" data-de-d="estado">${icono('checkCirculo')}<span>${esc(x.confirmado)}</span></span>
      <strong><span data-de-d="rubro">${esc(t.rubro)}</span> · <span data-de-d="detalle">${esc(t.detalle)}</span></strong>
      <small>${icono('reloj')}<span data-de-d="franja">${esc(t.hora)}</span></small>
    </span>
    <span class="de-detalle__ico">${iconos}</span>
  </div>
  <p class="de-nota de-detalle__aviso" data-de-d="pendiente" hidden>${icono('reloj')}<span></span></p>
  <div class="hd-tarjeta de-detalle__datos" data-entra>
    <div class="hd-lista">
      <div class="hd-fila"><span class="hd-fila__ico">${icono('pin')}</span><span class="hd-fila__texto"><small>${esc(x.dondeLabel)}</small><strong data-de-d="barrio">${esc(t.barrio)}</strong></span></div>
      <div class="hd-fila de-fila-cita"><span class="hd-fila__ico">${icono('chat')}</span><span class="hd-fila__texto"><small>${esc(x.pedidoLabel)}</small><span class="de-cita de-cita--plana" data-de-d="pedido">${esc(t.pedido)}</span></span></div>
    </div>
  </div>
  ${ticket(
    `${rubroIco('billetera')}<span class="de-ticket__titulo"><strong>${esc(x.costoLabel)}</strong><small>${plano(C.tarifa)}</small></span>`,
    `<div data-de-d="costo">${filasDesglose(presupuestoTrabajo(t))}</div>`,
    'de-ticket--detalle',
    'data-entra',
  )}
  <div class="de-cliente de-cliente--claro" data-entra>
    ${avatarDe(ch.inicial, ch.tono, '', 'data-de-d="avatar"')}
    <span class="de-cliente__texto"><strong data-de-d="cliente">${esc(ch.nombre)}</strong><small>${esc(d.camino.sinTelefono)}</small></span>
    ${boton({ accion: 'abrirChat', valor: t.chat, ir: 'e-conversacion', etiqueta: x.chatear, extra: 'data-de-d="chat"' }, icono('chat'), 'hd-circulo hd-circulo--azul')}
  </div>
  <p class="hd-error-linea de-cancelado" data-de-d="cancelado" hidden>${img('handy-cano-roto', '', 354, 405)}<span>${esc(x.cancelado)}</span></p>
  <p class="de-nota de-nota--centro" data-de-d="hecho" hidden>${icono('checkCirculo')}<span>${esc(x.hecho)}</span></p>
`)}
<div class="de-pie de-pie--fila" data-de-d="acciones">
  ${boton({ ir: 'e-cancelar' }, esc(x.cancelar), 'hd-boton hd-boton--claro de-peligro')}
  ${boton({ ir: 'e-cambiar-fecha', guia: true }, esc(x.cambiar), 'hd-boton')}
</div>
</div>`,
  };
}

// ── Cambiar la fecha (propuesta pendiente hasta que el cliente responda) ──

function cambiarFecha(): PantallaDemo {
  const c = d.cambio;
  const motivos = c.motivos
    .map((m, i) => boton({ accion: 'motivo', valor: String(i), guia: i === 0, extra: 'aria-pressed="false"' }, esc(m), 'hd-chip de-chip'))
    .join('');
  const franjas = c.franjas.map((f, i) => boton({ accion: 'franjaElegir', valor: String(i), extra: 'aria-pressed="false"' }, esc(f), 'hd-chip de-chip')).join('');
  return {
    id: 'e-cambiar-fecha',
    titulo: d.pantallas.cambio,
    html: `<div class="app de-cambio">
${cabecera('blanca', false)}
${cuerpo(`
  ${volverDemo(c.titulo)}
  <p class="de-actual" data-de-cambio-actual data-entra>${icono('calendario')}<span></span></p>
  <div class="de-cambio__form" data-de-cambio-form>
    <div data-entra><p class="de-etiqueta">${esc(c.motivoTitulo)}</p><div class="hd-chips">${motivos}</div></div>
    <div data-entra>
      <div class="de-etiqueta-fila"><p class="de-etiqueta">${esc(c.nuevaTitulo)}</p><span class="de-flechas">${boton({ accion: 'semanaPaso', valor: '-1', etiqueta: c.semanaAnterior }, icono('izquierda'), 'hd-circulo de-circulo-chico')}${boton({ accion: 'semanaPaso', valor: '1', etiqueta: c.semanaSiguiente }, icono('derecha'), 'hd-circulo de-circulo-chico')}</span></div>
      <div class="de-semana" data-de-semana role="group" aria-label="${esc(c.semanaLabel)}"></div>
    </div>
    <div data-entra><p class="de-etiqueta">${esc(c.franjaTitulo)}</p><div class="hd-chips hd-chips--carril de-carril" data-de-franjas>${franjas}</div></div>
    <div data-entra>${elegirCuando(c.elegirFecha, c.elegirHora)}</div>
    <div data-entra><p class="de-etiqueta">${esc(c.mensajeLabel)}</p>${boton({ accion: 'mensajeCambio' }, `<span data-de-mensaje-texto>${esc(c.mensaje)}</span>${icono('editar')}`, 'de-campo de-campo--mensaje')}</div>
    <div data-entra>${simulador()}</div>
  </div>
  <div class="de-estado de-cambio__ok" data-de-cambio-ok data-estado="pendiente" role="status" hidden>
    <span class="de-cambio__ico" data-de-cambio-ico="pendiente"><span class="hd-escribiendo de-espera__puntos" aria-hidden="true"><i></i><i></i><i></i></span></span>
    <span class="de-cambio__ico" data-de-cambio-ico="aceptada">${tildeExito}</span>
    <span class="de-cambio__ico" data-de-cambio-ico="rechazada">${img('handy-engranaje', 'hd-handy de-respuesta__handy', 338, 339)}</span>
    <span data-de-cambio-titulo="pendiente">${tituloMarcado(c.enviadoTitulo, 'hd-titulo hd-titulo--chico')}</span>
    <span data-de-cambio-titulo="aceptada">${tituloMarcado(c.aceptadoTitulo, 'hd-titulo hd-titulo--chico')}</span>
    <span data-de-cambio-titulo="rechazada">${tituloMarcado(c.rechazadoTitulo, 'hd-titulo hd-titulo--chico')}</span>
    <p class="hd-texto hd-texto--suave" data-de-cambio-ok-texto></p>
  </div>
`)}
<div class="de-pie">
  <p class="de-resumen" data-de-cambio-resumen aria-live="polite"></p>
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
    const titulo = it.neto ? esc(it.titulo).replace('{neto}', `<span data-de-neto>${pesos(neto(presupuestoDe(PRECIO)))}</span>`) : esc(it.titulo);
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
  const titulos: [string, string][] = [
    ['enviado', p.enviadoTitulo],
    ['rechazado', p.rechazadoTitulo],
    ['aceptado', p.aceptadoTitulo],
    ['rechazadoCliente', p.rechazadoClienteTitulo],
  ];
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
    <div class="hd-tarjeta de-panel de-respuesta" data-de-programado-respuesta role="status" hidden>
      <span data-de-resp-ico="ok">${tildeExito}</span>
      <span data-de-resp-ico="espera"><span class="hd-escribiendo de-espera__puntos" aria-hidden="true"><i></i><i></i><i></i></span></span>
      <span data-de-resp-ico="no">${img('handy-engranaje', 'hd-handy de-respuesta__handy', 338, 339)}</span>
      <span class="de-respuesta__texto">
        ${titulos.map(([k, t]) => `<span data-de-resp="${k}">${tituloMarcado(t, 'hd-titulo hd-titulo--chico')}</span>`).join('')}
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

function filaCuenta(t: Toque, nombreIcono: string, texto: string, detalleTexto = ''): string {
  return boton(
    t,
    `<span class="hd-fila__ico">${icono(nombreIcono)}</span><span class="hd-fila__texto"><strong>${esc(texto)}</strong>${detalleTexto ? `<small>${esc(detalleTexto)}</small>` : ''}</span><span class="hd-fila__fin">${icono('derecha')}</span>`,
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
      <span class="hd-avatar hd-avatar--grande hd-avatar--verificado" aria-hidden="true"><span>${esc(
        c.nombre
          .split(' ')
          .map((x) => x[0])
          .join('')
          .toUpperCase(),
      )}</span></span>
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

function movimiento(titulo: string, nombreIcono: string, fechaTexto: string, p: Presupuesto, abierto: boolean, hoy = false): string {
  return `<div class="de-turno de-mov"${hoy ? ' data-de-mov-hoy' : ''} data-entra>
  <div class="de-turno__cuerpo">
    ${rubroIco(nombreIcono)}
    <span class="de-turno__datos"><strong>${esc(titulo)}</strong><small>${esc(fechaTexto)}</small></span>
    <span class="de-turno__monto"><strong class="hd-precio" data-de-mov-neto>+ ${pesos(neto(p))}</strong><small>${esc(C.aTuCuenta)}</small></span>
  </div>
  <div class="de-mov__desglose" data-de-mov-desglose${abierto ? '' : ' hidden'}>${filasDesglose(p, C.aTuCuenta)}</div>
  ${boton({ accion: 'verMas', extra: `aria-expanded="${abierto}"` }, verMas(completar(C.verMasDe, { rubro: titulo, fecha: fechaTexto }), abierto), 'de-franja')}
</div>`;
}

function caja(): PantallaDemo {
  const c = d.caja;
  const lista = [
    movimiento(c.trabajoHoy, c.iconoHoy, c.hoy, presupuestoDe(PRECIO), true, true),
    ...c.movimientos.map((mv) => {
      const t = TRABAJOS.find((x) => x.id === mv.trabajo)!;
      return movimiento(t.rubro, t.icono, mv.fecha, presupuestoTrabajo(t), false);
    }),
  ].join('');
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

// ── Mensajes (IMG_0201) y Contactos (pantalla completa común) ────────────

function mensajes(): PantallaDemo {
  const m = d.mensajes;
  const filas = m.orden
    .map((id) => {
      const ch = CHATS[id];
      const ultimo = ch.mensajes[ch.mensajes.length - 1];
      const nuevo = id === d.solicitud.chat;
      const badge = ch.noLeidos ? `<span class="de-badge" data-de-badge="${id}" aria-label="${esc(completar(m.noLeidos, { n: ch.noLeidos }))}">${ch.noLeidos}</span>` : '';
      return boton(
        nuevo ? { ir: 'e-chat-nuevo', extra: `data-de-chat-fila="${id}"` } : { accion: 'abrirChat', valor: id, ir: 'e-conversacion', extra: `data-de-chat-fila="${id}"` },
        `${avatarDe(ch.inicial, ch.tono)}<span class="hd-fila__texto"><strong>${esc(ch.nombre)}</strong><small class="de-chats__sub">${esc(ch.sub)}</small><small class="de-chats__ultimo" data-de-ultimo="${id}">${esc(ultimo.texto)}</small></span><span class="de-chats__fin"><small>${esc(nuevo ? m.nuevo : ch.dia)}</small>${badge}</span>`,
        `hd-fila de-chats__fila${nuevo ? ' de-chats__fila--nuevo' : ''}`,
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
  <div class="de-titulo-fila" data-entra><p class="hd-titulo">${esc(m.titulo)}</p>${boton({ ir: 'e-contactos', extra: 'data-de-contactos-btn' }, `${icono('contactos')}${esc(m.contactos)}`, 'hd-chip hd-chip--tinte de-chip')}</div>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista de-chats">${filas}</div></div>
  <div class="hd-tarjeta de-grupo" data-entra><div class="hd-lista">${ayuda}</div></div>
  <p class="de-nota de-nota--centro" data-entra>${icono('reloj')}<span>${esc(m.nota)}</span></p>
`)}
${navDemo(ROL, 2)}
</div>`,
  };
}

/** Contactos guardados (pantalla común): cada fila abre su chat (el nuevo, en e-chat-nuevo). */
function comunes(): PantallaDemo[] {
  const lista: ContactoDemo[] = d.contactos.lista.map((c) => {
    const chat = c.id === d.solicitud.chat ? 'e-chat-nuevo' : 'e-conversacion';
    return {
      id: c.id,
      nombre: CHATS[c.id].nombre,
      detalle: c.detalle,
      chat,
      guardado: c.guardado,
      tono: CHATS[c.id].tono,
      // Las mismas iniciales que en el chat y en Mensajes.
      iniciales: CHATS[c.id].inicial,
      // La conversación es una sola pantalla para todos los clientes: la fila dice cuál abrir.
      toque: chat === 'e-conversacion' ? { accion: 'abrirChat', valor: c.id } : undefined,
    };
  });
  return pantallasComunes(ROL, lista);
}

// ── Hojas chicas ──────────────────────────────────────────────────────────

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
      chat('e-chat', 'perla'),
      chat('e-conversacion', 'mogotes'),
      chat('e-chat-nuevo', d.solicitud.chat),
      propuestaHoja(),
      trabajo(),
      adicional(),
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
      ...comunes(),
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
