// Demo · comportamiento del lado del especialista (ronda 3).
// - Inicio: "Disponible", el radar y el pedido que entra por la isla.
// - Tu precio: stepper, chips y un monto escrito con el teclado de la demo; el mínimo (demo.json → config.precioMinimo)
//   frena el envío; lo que te queda se calcula con src/demo/dinero.ts (tarifa del especialista). También se puede
//   proponer otra fecha u otro horario (hojas comunes): es una propuesta que el cliente acepta o rechaza (mock).
// - El cliente te elige (o elige otra propuesta), el chat (cabecera común, acciones y tarjetas de propuesta), la
//   llegada automática (geocerca simulada de src/demo/llegada.ts, sin "Llegué"), el trabajo con adicionales que el
//   cliente acepta, la agenda común, el cambio de fecha pendiente, los avisos, la cuenta y los cobros.
// Todos los textos salen de src/content/demo-especialista.json (y los comunes, de demo.json).

import '../../styles/demo-especialista.css';
import d from '../../content/demo-especialista.json';
import demo from '../../content/demo.json';
import { registrarRol, type Motor } from './motor';
import { TARIFAS as TJSON, completar, pesosJuntos } from './util';
import {
  HOY,
  PRECIO_MINIMO,
  agregarPropuesta,
  agregarTrabajoAgenda,
  pedirFecha,
  pedirHora,
  reemplazarPropuesta,
  responderPropuesta,
  type DatoPropuesta,
  type OpcionesPropuesta,
} from './comunes';
import { desglose, formatoPesos, propuestaAdicional, validarMinimo, type Concepto, type Presupuesto, type Tarifas } from '../../demo/dinero';
import { diaDeSemana, esPasada, fechaCorta, fechaLarga, horaTexto, leerHora, partes, sumarDias, type FechaISO, type Hora } from '../../demo/fechas';
import { RECORRIDO_DEMO, siguiente as siguienteLlegada, type EstadoLlegada, type EventoLlegada } from '../../demo/llegada';
import type { EstadoPropuesta } from '../../demo/propuestas';

// ── Datos ─────────────────────────────────────────────────────────────────

interface Mensaje {
  de: string;
  texto: string;
  foto: boolean;
}
interface ChatD {
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
interface TrabajoAg {
  id: string;
  fecha: FechaISO;
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

const CHATS = d.chats as Record<string, ChatD>;
const TRABAJOS = d.turnos.trabajos as TrabajoAg[];
const C = d.comun;
const T: Tarifas = { cliente: TJSON.normal.cliente, especialista: TJSON.normal.especialista };
const VARS = { tarifaEspecialista: `${T.especialista}%`, tarifaCliente: `${T.cliente}%` };
const SUGERIDO = d.inicio.pedido.sugerido;
/** Presupuesto del recorrido (el que escribe la guía): el de ejemplo de tarifas.json. */
const PRECIO = TJSON.ejemplo.presupuesto;
const MATERIALES = d.precio.materiales;
const NUEVO = d.solicitud.chat;
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const RESORTE = 'cubic-bezier(0.34, 1.45, 0.64, 1)';
/** Lo que tarda el cliente (mock) en responder una propuesta. */
const RESPUESTA_MS = 2600;
/** Cada cuánto llega una posición del viaje simulado. */
const PASO_VIAJE_MS = 1500;
const pesos = formatoPesos;

// ── Estado ────────────────────────────────────────────────────────────────

type Sim = 'acepta' | 'rechaza';
type HojaPrecio = 'e-precio' | 'e-precio-programado' | 'e-propuesta';
type ModoPropuesta = 'programar' | 'ahora' | 'cotizar';

interface Borrador {
  base: number;
  precio: number;
  /** Lo que se está escribiendo con el teclado (null = teclado cerrado). */
  tecleo: string | null;
  materiales: number;
  franja: number;
  fecha?: FechaISO;
  hora?: Hora;
  horaElegida?: boolean;
}

type Efecto =
  | { tipo: 'turno'; fecha: FechaISO; hora: string; precio: number; detalle: string; pedido: string }
  | { tipo: 'adicional' }
  | { tipo: 'cambio'; turno: string }
  | { tipo: 'solicitud' };

interface Tarjeta {
  id: string;
  chat: string;
  opciones: Omit<OpcionesPropuesta, 'alResponder'>;
  estado: EstadoPropuesta;
  efecto: Efecto;
  /** Qué va a responder el cliente (mock). Sin esto, la tarjeta la responde quien mira (la solicitud). */
  respuesta?: Sim;
  /** Cuándo vence la espera (ms desde que se mandó): la respuesta mock llega después. */
}

type Item = { t: 'rapida'; i: number } | { t: 'foto' } | { t: 'sistema'; texto: string } | { t: 'msg'; texto: string; propia: boolean } | { t: 'card'; id: string };

interface Adicional {
  id: string;
  concepto: Concepto;
  estado: EstadoPropuesta;
}

interface Cambio {
  turno: string;
  fecha: FechaISO;
  franja: number | null;
  hora: Hora | null;
  motivo: number | null;
  mensaje: boolean;
  fechaCal: boolean;
  enviado: boolean;
  estado: EstadoPropuesta;
  card?: string;
}

interface Llegada {
  estado: EstadoLlegada;
  /** Próximo evento de RECORRIDO_DEMO. */
  i: number;
  modo: string;
  tok: number;
  navego?: boolean;
}

interface Estado {
  disponible?: boolean;
  pedido?: 'nada' | 'visible';
  rechazado?: boolean;
  atendido?: boolean;
  token?: number;
  precio?: number;
  horario?: string;
  fechaHoy?: FechaISO;
  respuestaHoy?: Sim;
  aceptado?: 'esperando' | 'elegido' | 'rechazado';
  borradores?: Partial<Record<HojaPrecio, Borrador>>;
  elegido?: boolean;
  trabajo?: 'enviado' | 'terminado' | 'cancelado';
  inicioTrabajo?: number;
  adicionales?: Adicional[];
  adSel?: { op: string | null; tipo: 'material' | 'mano'; tecleo: string; desc: string };
  chat?: string;
  chatDesdeTurno?: boolean;
  borradorChat?: Record<string, number>;
  hilos?: Record<string, Item[]>;
  cards?: Record<string, Tarjeta>;
  seq?: number;
  leidos?: string[];
  turno?: string;
  cancelados?: string[];
  cambios?: Record<string, Cambio>;
  reprogramados?: Record<string, { fecha: FechaISO; hora: string }>;
  programado?: 'enviado' | 'rechazado' | 'aceptado' | 'rechazadoCliente';
  precioProgramado?: number;
  cuandoProgramado?: string;
  fechaProgramado?: FechaISO;
  horaProgramado?: string;
  respuestaProgramado?: Sim;
  rubros?: string[];
  zonas?: number[];
  recordatorio?: boolean;
  festejado?: boolean;
  cbu?: string;
  sim?: Sim;
  llegada?: Llegada;
  prop?: { modo: ModoPropuesta; chat: string; pantalla: string; solicitud?: string };
  solicitudLista?: boolean;
  nuevoAceptado?: boolean;
  nuevos?: TrabajoAg[];
  guiaFecha?: FechaISO;
  guiaHora?: number;
}

const est = (m: Motor) => m.estado as Estado;
const sim = (m: Motor): Sim => est(m).sim ?? 'acepta';

// ── Utilidades ────────────────────────────────────────────────────────────

const $ = <T extends Element = HTMLElement>(raiz: ParentNode, sel: string) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(raiz: ParentNode, sel: string) => [...raiz.querySelectorAll<T>(sel)];

function poner(raiz: ParentNode | null, sel: string, texto: string) {
  const el = raiz && $(raiz, sel);
  if (el && el.textContent !== texto) el.textContent = texto;
}

function fijar(el: HTMLElement | null, n: number, prefijo = '') {
  if (!el) return;
  el.dataset.hdMonto = String(n);
  el.textContent = prefijo + pesos(n);
}

function contarA(m: Motor, el: HTMLElement | null, n: number, ms?: number) {
  if (!el) return;
  if (el.dataset.hdMonto === undefined) fijar(el, n);
  else m.contar(el, n, ms ? { ms } : undefined);
}

function animar(m: Motor, el: Element | null | undefined, frames: Keyframe[], ms = 380, easing = CURVA) {
  if (!el || m.reducido || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(frames, { duration: ms, easing });
}

const aparecer = (m: Motor, el: Element | null | undefined) =>
  animar(m, el, [{ opacity: 0, transform: 'translateY(0.8em) scale(0.96)' }, { opacity: 1, transform: 'none' }], 460, RESORTE);

const latido = (m: Motor, el: Element | null | undefined) => animar(m, el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], 340);

function iconoDe(nombre: string): Node | null {
  const t = document.querySelector<HTMLTemplateElement>('template[data-demo-iconos]');
  return t?.content.querySelector(`[data-icono="${nombre}"] svg`)?.cloneNode(true) ?? null;
}

const dos = (n: number) => String(n).padStart(2, '0');
const pantallaDe = (el: Element) => el.closest<HTMLElement>('[data-pantalla]');
const idDe = (el: Element) => pantallaDe(el)?.dataset.pantalla ?? '';

function dato(izq: string, der: string, clase = ''): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = `hd-dato ${clase}`.trim();
  const a = document.createElement('span');
  a.textContent = izq;
  const b = document.createElement('span');
  b.textContent = der;
  p.append(a, b);
  return p;
}

/** Guía de una pantalla: saca las marcas que maneja el script y pone una (o ninguna). */
function guiar(raiz: HTMLElement, sel: string, objetivo: Element | null) {
  $$(raiz, sel).forEach((x) => x.removeAttribute('data-guia'));
  objetivo?.setAttribute('data-guia', '');
}

// ── Plata (siempre con src/demo/dinero.ts) ───────────────────────────────

const presupuestoDe = (precio: number, materiales = MATERIALES): Presupuesto => {
  const mat = Math.min(materiales, precio);
  return { manoDeObra: precio - mat, materiales: mat };
};
const netoDe = (p: Presupuesto, aprobados: Concepto[] = []) => desglose(p, T, aprobados).netoEspecialista;

/** Igual que el build: mano de obra + materiales (+ adicionales aceptados) = tu presupuesto − tarifa = lo que queda. */
function filasDesglose(cont: HTMLElement, p: Presupuesto, ultimo: string, aprobados: Concepto[] = [], m?: Motor) {
  const anterior = Number($(cont, '[data-de-total]')?.dataset.hdMonto);
  const x = desglose(p, T, aprobados);
  const filas: HTMLElement[] = [dato(C.manoDeObra, pesos(p.manoDeObra))];
  if (p.materiales) filas.push(dato(C.materiales, pesos(p.materiales)));
  aprobados.forEach((a) => filas.push(dato(a.descripcion, `+ ${pesos(a.monto)}`, 'de-dato--extra')));
  filas.push(dato(C.presupuesto, pesos(x.subtotal), 'de-dato--sub'));
  filas.push(dato(completar(C.tarifa, VARS), `− ${pesos(x.tarifaEspecialista)}`, 'de-dato--resta'));
  const total = dato(ultimo, '', 'hd-dato--total');
  const valor = document.createElement('span');
  valor.dataset.deTotal = '';
  if (m && Number.isFinite(anterior) && anterior !== x.netoEspecialista) {
    fijar(valor, anterior);
    m.contar(valor, x.netoEspecialista, { ms: 700 });
  } else fijar(valor, x.netoEspecialista);
  total.lastElementChild!.replaceWith(valor);
  filas.push(total);
  cont.replaceChildren(...filas);
}

// ── El trabajo de hoy ─────────────────────────────────────────────────────

const precioHoy = (m: Motor) => est(m).precio ?? PRECIO;
const presupuestoHoy = (m: Motor) => presupuestoDe(precioHoy(m));
const aprobadosHoy = (m: Motor) => (est(m).adicionales ?? []).filter((a) => a.estado === 'aceptada').map((a) => a.concepto);
const pendienteHoy = (m: Motor) => (est(m).adicionales ?? []).find((a) => a.estado === 'pendiente');
const netoHoy = (m: Motor) => netoDe(presupuestoHoy(m), aprobadosHoy(m));
const horarioHoy = (m: Motor) => est(m).horario ?? d.precio.franjas[0].texto;
const terminado = (m: Motor) => est(m).trabajo === 'terminado';

/** "Miércoles 18/11 · 03:00 h" o "Miércoles 18/11, de 16 a 18 h". */
function cuandoTexto(fecha: FechaISO, hora: Hora | null | undefined, franja: string): string {
  if (hora) return completar(C.horaA, { fecha: fechaLarga(fecha), hora: horaTexto(hora) });
  return `${fechaLarga(fecha)}, ${franja}`;
}

function nuevoTrabajo(e: Estado) {
  e.elegido = false;
  e.aceptado = 'esperando';
  e.inicioTrabajo = undefined;
  e.adicionales = [];
  e.pedido = 'nada';
  e.festejado = false;
  e.llegada = undefined;
  if (e.hilos) delete e.hilos.perla;
  if (e.borradorChat) delete e.borradorChat.perla;
}

function enviarPresupuesto(m: Motor, b: Borrador) {
  const e = est(m);
  e.precio = b.precio;
  e.fechaHoy = b.fecha ?? HOY;
  e.horario = b.fecha || b.hora ? cuandoTexto(b.fecha ?? HOY, b.hora, d.precio.franjas[b.franja]?.corto ?? '') : d.precio.franjas[b.franja]?.texto;
  e.respuestaHoy = sim(m);
  e.atendido = true;
  e.trabajo = 'enviado';
  nuevoTrabajo(e);
  if (e.borradores) delete e.borradores['e-precio'];
  pintarDependientes(m);
}

/** Si estás en camino, en el chat o trabajando, el cliente ya te eligió (también al saltar a ese paso). */
function yaElegido(m: Motor) {
  const e = est(m);
  e.elegido = true;
  e.aceptado = 'elegido';
  e.atendido = true;
  e.disponible ??= true;
  if (e.trabajo !== 'terminado') e.trabajo = 'enviado';
  agregarHoy(m);
}

// ── Inicio: apagado → buscando → pedido ──────────────────────────────────

function pintarDisponible(m: Motor) {
  const on = !!est(m).disponible;
  $$(document, '.demo-pantalla[data-rol="especialista"] [data-accion="disponible"][role="switch"]').forEach((sw) => {
    sw.setAttribute('aria-checked', String(on));
    poner(sw, '[data-de-disp-texto]', on ? C.disponible : C.noDisponible);
  });
  $(m.pantalla('e-inicio'), '[data-accion="disponible"][role="switch"]')?.toggleAttribute('data-guia', !on);
}

function pintarInicio(m: Motor, nuevo = false) {
  const el = m.pantalla('e-inicio');
  const e = est(m);
  const on = !!e.disponible;
  const conPedido = on && e.pedido === 'visible';
  pintarDisponible(m);
  const app = $(el, '[data-de-inicio]');
  const antes = app?.dataset.estado;
  const ahora = !on ? 'apagado' : conPedido ? 'pedido' : 'buscando';
  if (app) app.dataset.estado = ahora;
  poner(el, '[data-de-buscando-texto]', e.rechazado ? d.inicio.rechazadoTexto : d.inicio.buscandoTexto);
  if (antes === ahora && !nuevo) return;
  const panel = $(el, `[data-de-panel="${ahora}"]`);
  if (ahora === 'pedido' && nuevo) animar(m, panel, [{ transform: 'translateY(115%)' }, { transform: 'none' }], 720, RESORTE);
  else if (antes && antes !== ahora) aparecer(m, panel);
}

function programarPedido(m: Motor) {
  const e = est(m);
  const token = (e.token = (e.token ?? 0) + 1);
  m.timeout(() => {
    if (est(m) !== e || e.token !== token || !e.disponible) return;
    e.pedido = 'visible';
    e.rechazado = false;
    pintarInicio(m, true);
    m.isla({ titulo: d.inicio.isla.titulo, texto: completar(d.inicio.isla.texto, { monto: pesosJuntos(SUGERIDO) }), icono: d.inicio.pedido.icono, tono: 'amarillo' });
    m.guia(null);
  }, 2400);
}

const esperaPedido = (e: Estado) => !!e.disponible && e.pedido !== 'visible' && !e.atendido && !e.rechazado;

// ── Precio (Tu precio, pedido programado y propuesta del chat) ───────────

const HOJAS_PRECIO: HojaPrecio[] = ['e-precio', 'e-precio-programado', 'e-propuesta'];
const esHojaPrecio = (id: string): id is HojaPrecio => (HOJAS_PRECIO as string[]).includes(id);

function nuevoBorrador(m: Motor, h: HojaPrecio): Borrador {
  if (h === 'e-precio') return { base: SUGERIDO, precio: SUGERIDO, tecleo: null, materiales: MATERIALES, franja: 0 };
  if (h === 'e-precio-programado') return { base: d.programado.sugerido, precio: d.programado.sugerido, tecleo: null, materiales: 0, franja: 0 };
  const pr = est(m).prop ?? { modo: 'programar' as const, chat: 'perla', pantalla: 'e-chat' };
  const ch = CHATS[pr.chat] ?? CHATS.perla;
  const b: Borrador = { base: ch.sugerido, precio: ch.sugerido, tecleo: null, materiales: 0, franja: 0 };
  if (pr.modo === 'cotizar') {
    b.fecha = d.solicitud.fecha;
    b.hora = leerHora(d.solicitud.hora);
  } else if (pr.modo === 'programar') {
    b.fecha = sumarDias(HOY, 1);
    b.hora = { h: 10, m: 0 };
  }
  return b;
}

function borrador(m: Motor, h: HojaPrecio): Borrador {
  const bs = (est(m).borradores ??= {});
  return (bs[h] ??= nuevoBorrador(m, h));
}

const precioValido = (b: Borrador) => validarMinimo(b.precio, PRECIO_MINIMO).ok;

/** Qué se propone en la hoja (si se eligió otra fecha u otro horario). */
function cuandoBorrador(h: HojaPrecio, b: Borrador): string {
  if (h === 'e-precio') return b.fecha || b.hora ? cuandoTexto(b.fecha ?? HOY, b.hora, d.precio.franjas[b.franja]?.corto ?? '') : d.precio.franjas[b.franja].texto;
  if (h === 'e-precio-programado') return b.fecha || b.hora ? cuandoTexto(b.fecha ?? d.programado.fecha, b.hora, d.programado.franja) : `${d.programado.dia}, ${d.programado.franja}`;
  if (!b.fecha && !b.hora) return d.precio.franjas[b.franja].texto;
  return cuandoTexto(b.fecha ?? HOY, b.hora, '');
}

function pintarPrecio(m: Motor, h: HojaPrecio, contar = false) {
  const el = m.pantalla(h);
  const b = borrador(m, h);
  const p = d.precio;
  poner(el, '[data-de-sugerido]', pesos(b.base));
  const precio = $(el, '[data-de-precio]');
  const recibis = $(el, '[data-de-recibis]');
  const pres = presupuestoDe(b.precio, b.materiales);
  const x = desglose(pres, T);
  if (b.tecleo !== null) {
    if (precio) {
      precio.textContent = b.tecleo ? pesos(b.precio) : pesos(0);
      precio.dataset.hdMonto = String(b.precio);
    }
    fijar(recibis, x.netoEspecialista);
  } else if (contar) {
    contarA(m, precio, b.precio, 420);
    contarA(m, recibis, x.netoEspecialista, 700);
  } else {
    fijar(precio, b.precio);
    fijar(recibis, x.netoEspecialista);
  }
  $(el, '.de-precio__valor')?.classList.toggle('de-precio__valor--tecleando', b.tecleo !== null);
  poner(el, '[data-de-retiene]', completar(p.retiene, { ...VARS, monto: pesosJuntos(x.tarifaEspecialista) }));
  poner(el, '[data-de-materiales] span', completar(p.materialesNota, { monto: pesosJuntos(pres.materiales) }));

  // Mínimo de la demo (LEG-14): el aviso va pegado al importe y el envío queda frenado.
  const ok = precioValido(b);
  const conValor = b.tecleo === null || b.tecleo !== '';
  const aviso = $(el, '[data-de-minimo]');
  if (aviso) {
    const mostrar = !ok && conValor;
    if (mostrar && aviso.hidden) aparecer(m, aviso);
    aviso.hidden = !mostrar;
  }
  $(el, '.de-precio__caja')?.classList.toggle('de-precio__caja--bajo', !ok && conValor);
  // Escribiendo: el teclado queda pegado al importe (sin los chips en el medio).
  $(el, '.de-precio__caja')?.classList.toggle('de-precio__caja--teclado', b.tecleo !== null);
  const enviar = $<HTMLButtonElement>(el, '[data-de-enviar]');
  if (enviar) enviar.disabled = !ok;

  $$(el, '[data-accion="precioSugerido"]').forEach((btn) => btn.setAttribute('aria-pressed', String(b.tecleo === null && b.precio === b.base)));
  $$(el, '[data-accion="precioSumar"]').forEach((btn) => btn.setAttribute('aria-pressed', String(b.tecleo === null && b.precio === b.base + Number(btn.dataset.valor))));

  // Teclado
  const abierto = b.tecleo !== null;
  const caja = $(el, '[data-de-teclado-caja]');
  if (caja) {
    if (abierto && caja.hidden) aparecer(m, caja);
    caja.hidden = !abierto;
  }
  const tbtn = $(el, '[data-de-teclado-btn]');
  if (tbtn) {
    tbtn.setAttribute('aria-expanded', String(abierto));
    poner(tbtn, '[data-de-teclado-texto]', abierto ? p.escribirListo : p.escribir);
  }

  // Cuándo: franjas sugeridas o la fecha/hora elegidas.
  $$(el, '[data-accion="franja"]').forEach((btn) => btn.setAttribute('aria-pressed', String(!b.hora && Number(btn.dataset.valor) === b.franja)));
  const fecha = $(el, '[data-de-elegir="fecha"]');
  if (fecha) {
    fecha.setAttribute('aria-pressed', String(!!b.fecha));
    poner(fecha, 'span', b.fecha ? fechaLarga(b.fecha) : p.elegirFecha);
  }
  const hora = $(el, '[data-de-elegir="hora"]');
  if (hora) {
    hora.setAttribute('aria-pressed', String(!!b.hora));
    poner(hora, 'span', b.hora ? `${horaTexto(b.hora)} h` : p.elegirHora);
  }
  const propones = $(el, '[data-de-propones]');
  if (propones) {
    propones.hidden = !(b.fecha || b.hora);
    poner(propones, '[data-de-propones-texto]', `${p.propuestaLabel}: ${cuandoBorrador(h, b)}. ${p.pendienteNota}`);
  }
  if (h === 'e-propuesta') {
    poner(el, '[data-de-prop-valor="fecha"]', b.fecha ? fechaLarga(b.fecha) : '');
    poner(el, '[data-de-prop-valor="hora"]', b.hora ? `${horaTexto(b.hora)} h` : '');
  }
  guiaPrecio(el, h, b, ok);
}

/** Lo próximo para tocar en el recorrido: escribir el presupuesto de ejemplo (pasa por el aviso del mínimo) y mandarlo. */
function guiaPrecio(el: HTMLElement, h: HojaPrecio, b: Borrador, ok: boolean) {
  let objetivo: Element | null = null;
  if (h === 'e-precio') {
    const meta = d.precio.tecleo;
    if (b.tecleo === null && b.precio !== Number(meta)) objetivo = $(el, '[data-de-teclado-btn]');
    else if (b.tecleo !== null && b.tecleo !== meta && meta.startsWith(b.tecleo)) objetivo = $(el, `[data-accion="tecla"][data-valor="${meta[b.tecleo.length]}"]`);
  } else if (h === 'e-propuesta' && b.hora && !b.horaElegida && $(el, '[data-de-prop]')?.dataset.modo === 'cotizar') {
    objetivo = $(el, '[data-de-prop-campo="hora"]');
  }
  if (!objetivo && ok) objetivo = $(el, '[data-de-enviar]');
  guiar(el, '[data-guia]', objetivo);
}

function cambiarPrecio(m: Motor, h: HojaPrecio, precio: number) {
  const b = borrador(m, h);
  b.tecleo = null;
  b.precio = Math.max(0, Math.round(precio));
  pintarPrecio(m, h, true);
  latido(m, $(m.pantalla(h), '.de-recibis'));
  m.anunciar(completar(d.precio.anuncio, { precio: pesos(b.precio), recibis: pesos(netoDe(presupuestoDe(b.precio, b.materiales))) }));
}

function tecla(m: Motor, h: HojaPrecio, valor: string) {
  const b = borrador(m, h);
  let t = b.tecleo ?? '';
  if (valor === 'borrar') t = t.slice(0, -1);
  else if (t.length < 7) t = (t + valor).replace(/^0+/, '');
  b.tecleo = t;
  b.precio = Number(t || 0);
  pintarPrecio(m, h);
  latido(m, $(m.pantalla(h), '.de-recibis'));
}

/** Elegir otra fecha / otro horario desde una hoja de precio (abren las hojas comunes). */
function elegirFecha(m: Motor, h: HojaPrecio) {
  const b = borrador(m, h);
  pedirFecha(m, {
    valor: b.fecha,
    alElegir: (f) => {
      b.fecha = f;
      pintarPrecio(m, h);
    },
  });
}

function elegirHora(m: Motor, h: HojaPrecio) {
  const b = borrador(m, h);
  const e = est(m);
  if (h === 'e-propuesta' && est(m).prop?.modo === 'cotizar' && !b.horaElegida && b.hora) e.guiaHora = (b.hora.h + 2) % 24;
  pedirHora(m, {
    valor: b.hora,
    alElegir: (hh) => {
      b.hora = hh;
      b.horaElegida = true;
      delete est(m).guiaHora;
      pintarPrecio(m, h);
    },
  });
}

// ── Presupuesto enviado → el cliente elige ───────────────────────────────

function pintarAceptado(m: Motor) {
  const el = m.pantalla('e-aceptado');
  const e = est(m);
  const estado = e.aceptado === 'rechazado' ? 'rechazado' : e.elegido ? 'elegido' : 'esperando';
  const app = $(el, '[data-de-aceptado]');
  if (app) app.dataset.estado = estado;
  const costo = $(el, '[data-de-costo]');
  if (costo) filasDesglose(costo, presupuestoHoy(m), C.recibis);
  poner(el, '[data-de-franja]', horarioHoy(m));
  const ir = $<HTMLButtonElement>(el, '[data-de-ir-alla]');
  const chat = $(el, '[data-de-aceptado-chat]');
  const inicio = $(el, '[data-de-aceptado-inicio]');
  if (ir) {
    ir.disabled = estado !== 'elegido';
    ir.hidden = estado === 'rechazado';
    poner(ir, '[data-de-ir-texto]', estado === 'elegido' ? d.aceptado.irAlla : d.aceptado.esperandoBoton);
  }
  if (chat) chat.hidden = estado !== 'elegido';
  if (inicio) inicio.hidden = estado !== 'rechazado';
  // La guía: primero el chat con el cliente, después "Ir para allá".
  const usoChat = hilo(m, 'perla').some((x) => x.t === 'rapida');
  guiar(el, '[data-guia]', estado === 'elegido' ? (usoChat ? ir : chat) : estado === 'esperando' ? ir : inicio);
}

function elegir(m: Motor) {
  const e = est(m);
  if (e.elegido) return;
  e.elegido = true;
  e.aceptado = 'elegido';
  agregarHoy(m);
  pintarAceptado(m);
  aparecer(m, $(m.pantalla('e-aceptado'), '[data-de-ir-alla]'));
  m.isla({ titulo: d.aceptado.isla.titulo, texto: d.aceptado.isla.texto, icono: 'check', tono: 'exito' });
  m.confeti();
  m.guia(null);
}

function noElegido(m: Motor) {
  const e = est(m);
  if (e.elegido) return;
  e.aceptado = 'rechazado';
  e.trabajo = undefined;
  pintarAceptado(m);
  m.isla({ titulo: d.aceptado.islaRechazo.titulo, texto: d.aceptado.islaRechazo.texto, icono: 'info' });
}

// ── Llegada automática (geocerca simulada) ───────────────────────────────

const seguidos: EstadoLlegada[] = ['en-camino', 'senal-imprecisa', 'sin-senal'];
const llegada = (m: Motor): Llegada => (est(m).llegada ??= { estado: 'pidiendo-permiso', i: 0, modo: 'normal', tok: 0 });

function pintarLlegada(m: Motor) {
  const el = m.pantalla('e-en-camino');
  const l = llegada(m);
  const u = d.camino.ubicacion;
  const caja = $(el, '[data-de-llegada]');
  if (caja) caja.dataset.estado = l.estado;
  const pedir = $(el, '[data-de-llegada-pedir]');
  const panel = $(el, '[data-de-llegada-estado]');
  if (pedir) pedir.hidden = l.estado !== 'pidiendo-permiso';
  if (panel) {
    const antes = panel.hidden;
    panel.hidden = l.estado === 'pidiendo-permiso';
    if (antes && !panel.hidden) aparecer(m, panel);
    const txt = (u.estados as Record<string, { titulo: string; texto: string }>)[l.estado];
    if (txt) {
      poner(panel, '[data-de-llegada-titulo]', txt.titulo);
      poner(panel, '[data-de-llegada-texto]', txt.texto);
    }
    $$(panel, '[data-de-llegada-ico]').forEach((x) => (x.hidden = x.dataset.deLlegadaIco !== l.estado));
    const activar = $(panel, '[data-de-llegada-activar]');
    if (activar) activar.hidden = l.estado !== 'sin-permiso';
  }
  const seg = $(el, '[data-de-seguimiento]');
  if (seg) seg.dataset.etapa = l.estado === 'llego' ? '3' : seguidos.includes(l.estado) ? (l.i >= 3 ? '2' : '1') : '0';
  $$(el, '[data-accion="simularUbicacion"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === l.modo)));
}

function aplicarLlegada(m: Motor, ev: EventoLlegada) {
  const l = llegada(m);
  const antes = l.estado;
  l.estado = siguienteLlegada(l.estado, ev);
  pintarLlegada(m);
  if (l.estado !== antes) {
    const txt = (d.camino.ubicacion.estados as Record<string, { titulo: string }>)[l.estado];
    if (txt) m.anunciar(txt.titulo);
  }
  if (l.estado === 'llego') alLlegar(m);
}

/** El viaje mock: una posición cada tanto (con un rato de señal imprecisa) hasta entrar en la zona. */
function programarViaje(m: Motor) {
  const l = llegada(m);
  const tok = ++l.tok;
  const paso = () => {
    if (llegada(m) !== l || l.tok !== tok || l.modo !== 'normal' || !seguidos.includes(l.estado)) return;
    const ev = RECORRIDO_DEMO[l.i];
    if (!ev) return;
    l.i++;
    aplicarLlegada(m, ev);
    if (l.estado !== 'llego') m.timeout(paso, PASO_VIAJE_MS);
  };
  m.timeout(paso, PASO_VIAJE_MS);
}

function alLlegar(m: Motor) {
  const l = llegada(m);
  if (l.navego) return;
  l.navego = true;
  const u = d.camino.ubicacion;
  m.isla({ titulo: u.isla.titulo, texto: u.isla.texto, icono: 'pin', tono: 'exito' });
  m.timeout(() => m.ir('e-trabajo'), 1500);
}

// ── Chats ─────────────────────────────────────────────────────────────────

const hilo = (m: Motor, id: string): Item[] => ((est(m).hilos ??= {})[id] ??= []);
const usadasDe = (m: Motor, id: string) => hilo(m, id).flatMap((x) => (x.t === 'rapida' ? [x.i] : []));
const chatDe = (pantalla: HTMLElement): string => $(pantalla, '[data-de-chat]')?.dataset.deChat ?? 'perla';
const PANTALLAS_CHAT = ['e-chat', 'e-conversacion', 'e-chat-nuevo'];

function burbuja(texto: string, propia: boolean): HTMLDivElement {
  const b = document.createElement('div');
  b.className = `de-burbuja ${propia ? 'de-burbuja--propia' : 'de-burbuja--otra'}`;
  const s = document.createElement('span');
  s.textContent = texto;
  b.append(s);
  return b;
}

function sistema(texto: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'de-chat__sistema';
  p.textContent = texto;
  return p;
}

function alFondo(m: Motor, cont: HTMLElement | null) {
  if (!cont) return;
  cont.scrollTo({ top: cont.scrollHeight, behavior: m.reducido ? 'auto' : 'smooth' });
}

function marcarLeido(m: Motor, id: string) {
  const e = est(m);
  e.leidos = [...new Set([...(e.leidos ?? []), id])];
}

function yaLlegaste(m: Motor) {
  const e = est(m);
  return !!e.inicioTrabajo || e.trabajo === 'terminado' || e.trabajo === 'cancelado';
}

function libresDe(m: Motor, id: string): number[] {
  const usadas = usadasDe(m, id);
  const llego = id === 'perla' && yaLlegaste(m);
  return CHATS[id].rapidas
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !usadas.includes(i) && !(llego && r.antesDeLlegar))
    .map(({ i }) => i);
}

/** Tarjeta de propuesta ya guardada (al volver a dibujar el chat): el mismo molde de la base común. */
function tarjetaEstatica(cg: Tarjeta): HTMLElement | null {
  const molde = document.querySelector<HTMLTemplateElement>('template[data-hd-molde="propuesta"]');
  const el = molde?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (!el) return null;
  const o = cg.opciones;
  el.dataset.hdPropuesta = cg.id;
  el.dataset.tipo = o.tipo;
  el.dataset.responde = 'false';
  el.removeAttribute('data-entra');
  el.classList.add(o.propia ? 'hd-propuesta--propia' : 'hd-propuesta--otra');
  const ico = iconoDe(o.icono ?? (o.tipo === 'adicional' ? 'mas' : 'calendario'));
  if (ico) $(el, '[data-slot="icono"]')?.append(ico);
  poner(el, '[data-slot="tipo"]', o.titulo ?? '');
  const dl = $(el, '[data-slot="datos"]')!;
  o.datos.forEach((x) => {
    const fila = document.createElement('div');
    if (x.destacado) fila.className = 'hd-propuesta__destacado';
    const dt = document.createElement('dt');
    dt.textContent = x.etiqueta;
    const dd = document.createElement('dd');
    dd.textContent = x.valor;
    fila.append(dt, dd);
    dl.append(fila);
  });
  poner(el, '[data-slot="nota"]', o.nota ?? demo.chatTurnos.noEsTurno);
  pintarEstadoTarjeta(el, cg.estado);
  return el;
}

function pintarEstadoTarjeta(el: HTMLElement, estado: EstadoPropuesta) {
  el.dataset.estado = estado;
  const acc = $(el, '[data-slot="acciones"]');
  if (acc) acc.hidden = true;
  poner(el, '[data-slot="estado"]', demo.chatTurnos.estados[estado]);
}

/** Botón "Responder con tu propuesta" debajo de una solicitud pendiente. */
function filaResponder(pantalla: HTMLElement, cardId: string): HTMLElement | null {
  const t = $<HTMLTemplateElement>(pantalla, 'template[data-de-plantilla-responder]');
  const fila = t?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (!fila) return null;
  fila.dataset.deResponder = cardId;
  const b = $(fila, '[data-accion="cotizar"]');
  if (b) {
    b.dataset.valor = cardId;
    b.setAttribute('data-guia', '');
  }
  return fila;
}

function nodosItem(m: Motor, pantalla: HTMLElement, id: string, it: Item): HTMLElement[] {
  const ch = CHATS[id];
  switch (it.t) {
    case 'rapida':
      return [burbuja(ch.rapidas[it.i].texto, true), burbuja(ch.rapidas[it.i].respuesta, false)];
    case 'foto': {
      const t = $<HTMLTemplateElement>(pantalla, 'template[data-de-plantilla-foto]');
      const n = t?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      return n ? [n] : [];
    }
    case 'sistema':
      return [sistema(it.texto)];
    case 'msg':
      return [burbuja(it.texto, it.propia)];
    case 'card': {
      const cg = est(m).cards?.[it.id];
      if (!cg) return [];
      const el = tarjetaEstatica(cg);
      const r = cg.efecto.tipo === 'solicitud' && cg.estado === 'pendiente' ? filaResponder(pantalla, cg.id) : null;
      return [el, r].filter((x): x is HTMLElement => !!x);
    }
  }
}

/** Pantallas de chat que muestran ahora ese chat. */
const pantallasConChat = (m: Motor, id: string) => PANTALLAS_CHAT.map((p) => m.pantalla(p)).filter((p) => chatDe(p) === id);

/** Suma algo al chat (y lo muestra en vivo si ese chat está a la vista). */
function alChat(m: Motor, id: string, it: Item) {
  hilo(m, id).push(it);
  pantallasConChat(m, id).forEach((p) => {
    const lista = $(p, '[data-de-mensajes]');
    if (!lista) return;
    const nodos = nodosItem(m, p, id, it);
    lista.append(...nodos);
    if (!p.hidden) {
      nodos.forEach((n) => aparecer(m, n));
      alFondo(m, lista);
    }
  });
}

function pintarControlesChat(m: Motor, el: HTMLElement, id: string) {
  const e = est(m);
  const ch = CHATS[id];
  const usadas = usadasDe(m, id);
  const libres = libresDe(m, id);
  const pid = el.dataset.pantalla;

  const rapidas = $(el, '[data-de-rapidas]');
  if (rapidas) {
    rapidas.replaceChildren(
      ...libres.map((i, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hd-chip hd-chip--tinte';
        b.dataset.accion = 'rapida';
        b.dataset.valor = String(i);
        if (pid === 'e-chat' && n === 0 && usadas.length === 0) b.setAttribute('data-guia', '');
        b.textContent = ch.rapidas[i].chip;
        return b;
      }),
    );
    rapidas.hidden = libres.length === 0;
  }
  // "Ver el turno" (en la cabecera): no si ya venís del turno.
  const verTurno = $(el, '[data-de-ver-turno]');
  if (verTurno) {
    verTurno.hidden = !ch.turno || !!e.chatDesdeTurno || pid === 'e-chat-nuevo';
    verTurno.dataset.valor = ch.turno;
  }
  const borr = e.borradorChat?.[id];
  const escrito = borr !== undefined && libres.includes(borr) ? ch.rapidas[borr].texto : '';
  const campo = $<HTMLButtonElement>(el, '[data-de-campo-chat]');
  if (campo) {
    poner(campo, '[data-de-campo-texto]', escrito || d.chat.input);
    campo.classList.toggle('de-chat__campo--lleno', !!escrito);
    campo.disabled = libres.length === 0;
  }
  const enviar = $<HTMLButtonElement>(el, '[data-de-enviar-chat]');
  if (enviar) enviar.disabled = libres.length === 0;
  // "Agregar a contactos" (chat nuevo): la guía, después de que el cliente aceptó el turno.
  const contacto = $(el, '[data-hd-contacto-btn]');
  if (contacto) contacto.toggleAttribute('data-guia', !!e.nuevoAceptado);
}

function pintarChat(m: Motor, el: HTMLElement, id: string) {
  const ch = CHATS[id];
  const caja = $(el, '[data-de-chat]');
  if (!caja || !ch) return;
  caja.dataset.deChat = id;
  poner(el, '.hd-chat-cabecera__quien strong', ch.nombre);
  poner(el, '.hd-chat-cabecera__quien small', ch.sub);
  const avatar = $(el, '[data-de-chat-avatar]');
  if (avatar) {
    avatar.style.setProperty('--tono', ch.tono);
    poner(avatar, 'span', ch.inicial);
  }
  const mensajes = $(el, '[data-de-mensajes]');
  const plantilla = $<HTMLTemplateElement>(el, `template[data-de-plantilla="${id}"]`);
  if (mensajes) {
    mensajes.replaceChildren();
    if (plantilla) mensajes.append(plantilla.content.cloneNode(true));
    if (!ch.mensajes.length && !hilo(m, id).length) mensajes.append(sistema(d.chat.sinMensajes));
    hilo(m, id).forEach((it) => mensajes.append(...nodosItem(m, el, id, it)));
    mensajes.scrollTop = mensajes.scrollHeight;
  }
  pintarControlesChat(m, el, id);
}

function responderRapida(m: Motor, el: HTMLElement, id: string, i: number) {
  const e = est(m);
  const r = CHATS[id].rapidas[i];
  if (!r || usadasDe(m, id).includes(i)) return;
  hilo(m, id).push({ t: 'rapida', i });
  if (e.borradorChat) delete e.borradorChat[id];
  const mensajes = $(el, '[data-de-mensajes]');
  const propia = burbuja(r.texto, true);
  mensajes?.append(propia);
  aparecer(m, propia);
  alFondo(m, mensajes);
  pintarControlesChat(m, el, id);
  m.timeout(() => {
    const plantilla = $<HTMLTemplateElement>(el, 'template[data-de-plantilla-escribiendo]');
    const escribiendo = plantilla?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    if (escribiendo) {
      mensajes?.append(escribiendo);
      aparecer(m, escribiendo);
      alFondo(m, mensajes);
    }
    m.timeout(() => {
      const respuesta = burbuja(r.respuesta, false);
      if (escribiendo) escribiendo.replaceWith(respuesta);
      else mensajes?.append(respuesta);
      aparecer(m, respuesta);
      alFondo(m, mensajes);
      m.anunciar(completar(d.chat.anuncio, { texto: r.respuesta }));
    }, 1100);
  }, 500);
}

// ── Tarjetas (propuestas, solicitud, cambio, adicional) ──────────────────

function nuevaTarjeta(m: Motor, chat: string, o: Omit<OpcionesPropuesta, 'alResponder' | 'id'>, efecto: Efecto, respuesta?: Sim): string {
  const e = est(m);
  const id = `de-p${(e.seq = (e.seq ?? 0) + 1)}`;
  const cg: Tarjeta = { id, chat, opciones: { ...o, id }, estado: 'pendiente', efecto, respuesta };
  (e.cards ??= {})[id] = cg;
  const vista = pantallasConChat(m, chat).find((p) => !p.hidden);
  if (vista) {
    // A la vista: la arma la base común (con su animación y su estado).
    hilo(m, chat).push({ t: 'card', id });
    const lista = $(vista, '[data-de-mensajes]');
    if (lista) {
      agregarPropuesta(lista, m, { ...o, id });
      if (efecto.tipo === 'solicitud') {
        const fila = filaResponder(vista, id);
        if (fila) {
          lista.append(fila);
          aparecer(m, fila);
        }
      }
    }
    // Las otras pantallas del mismo chat (ocultas) se redibujan al entrar.
  } else {
    alChat(m, chat, { t: 'card', id });
  }
  return id;
}

/** La otra persona responde (mock): actualiza todas las copias de la tarjeta y aplica el efecto. */
function responderTarjeta(m: Motor, id: string, r: 'aceptar' | 'rechazar') {
  const cg = est(m).cards?.[id];
  if (!cg || cg.estado !== 'pendiente') return;
  responderPropuesta(m, id, r);
  cg.estado = r === 'aceptar' ? 'aceptada' : 'rechazada';
  document.querySelectorAll<HTMLElement>(`[data-hd-propuesta="${id}"]`).forEach((x) => pintarEstadoTarjeta(x, cg.estado));
  efectoRespuesta(m, cg, r === 'aceptar');
}

function reemplazarTarjeta(m: Motor, id: string) {
  const cg = est(m).cards?.[id];
  if (!cg || cg.estado !== 'pendiente') return;
  reemplazarPropuesta(m, id);
  cg.estado = 'reemplazada';
  document.querySelectorAll<HTMLElement>(`[data-hd-propuesta="${id}"]`).forEach((x) => pintarEstadoTarjeta(x, 'reemplazada'));
  document.querySelectorAll(`[data-de-responder="${id}"]`).forEach((x) => x.remove());
}

/** Programa la respuesta mock de las tarjetas que mandó el especialista (y vuelve a programarla al volver a una pantalla). */
function asegurarRespuestas(m: Motor, ms = RESPUESTA_MS) {
  Object.values(est(m).cards ?? {}).forEach((cg) => {
    if (cg.estado !== 'pendiente' || !cg.respuesta) return;
    m.timeout(() => responderTarjeta(m, cg.id, cg.respuesta === 'acepta' ? 'aceptar' : 'rechazar'), ms);
  });
}

function efectoRespuesta(m: Motor, cg: Tarjeta, acepto: boolean) {
  const e = est(m);
  const ch = CHATS[cg.chat];
  const ef = cg.efecto;
  if (ef.tipo === 'turno') {
    const cuando = cuandoDeTurno(ef.fecha, ef.hora);
    if (acepto) {
      const t: TrabajoAg = {
        id: `t-${cg.id}`,
        fecha: ef.fecha,
        hora: ef.hora,
        rubro: ch.rubro,
        icono: ch.icono,
        detalle: ef.detalle,
        barrio: ch.barrio,
        manoDeObra: ef.precio,
        materiales: 0,
        chat: cg.chat,
        pedido: ef.pedido,
        estado: 'confirmado',
      };
      (e.nuevos ??= []).push(t);
      const li = liTrabajo(m, t);
      if (li) agregarTrabajoAgenda('especialista', li);
      alChat(m, cg.chat, { t: 'sistema', texto: completar(d.chat.acepto, { cuando }) });
      if (cg.chat === NUEVO) e.nuevoAceptado = true;
      m.isla({ titulo: d.chat.islaTurno.titulo, texto: completar(d.chat.islaTurno.texto, { cliente: ch.nombre, cuando }), icono: 'calendario', tono: 'exito' });
      m.confeti();
    } else {
      alChat(m, cg.chat, { t: 'sistema', texto: d.chat.rechazo });
      m.isla({ titulo: d.chat.islaRechazo.titulo, texto: d.chat.islaRechazo.texto, icono: 'info' });
    }
    pantallasConChat(m, cg.chat).forEach((p) => pintarControlesChat(m, p, cg.chat));
    pintarMensajes(m);
  } else if (ef.tipo === 'adicional') {
    const ad = (e.adicionales ?? []).find((a) => a.id === cg.id);
    if (ad) ad.estado = acepto ? 'aceptada' : 'rechazada';
    const a = d.adicional;
    if (acepto) {
      alChat(m, cg.chat, { t: 'sistema', texto: completar(d.chat.aceptoAdicional, { concepto: ad?.concepto.descripcion ?? '' }) });
      m.isla({ titulo: a.isla.titulo, texto: completar(a.isla.texto, { concepto: ad?.concepto.descripcion ?? '', monto: pesosJuntos(netoHoy(m)) }), icono: 'check', tono: 'exito' });
    } else {
      alChat(m, cg.chat, { t: 'sistema', texto: d.chat.rechazoAdicional });
      m.isla({ titulo: a.islaRechazo.titulo, texto: a.islaRechazo.texto, icono: 'info' });
    }
    pintarTrabajo(m, true);
    latido(m, $(m.pantalla('e-trabajo'), '.hd-dato--total'));
    pintarFin(m);
    pintarCaja(m);
    pintarHoyAgenda(m);
  } else if (ef.tipo === 'cambio') {
    const c = est(m).cambios?.[ef.turno];
    if (!c) return;
    const actual = vigente(m, ef.turno);
    const nuevo = cuandoCambio(c);
    c.estado = acepto ? 'aceptada' : 'rechazada';
    const x = d.cambio;
    if (acepto) {
      (e.reprogramados ??= {})[ef.turno] = { fecha: c.fecha, hora: c.hora ? `${horaTexto(c.hora)} h` : x.franjas[c.franja ?? 0] };
      moverEnAgenda(m, ef.turno);
      alChat(m, cg.chat, { t: 'sistema', texto: completar(d.chat.aceptoCambio, { cuando: nuevo }) });
      m.isla({ titulo: x.islaAcepto.titulo, texto: completar(x.islaAcepto.texto, { cuando: nuevo }), icono: 'calendario', tono: 'exito' });
    } else {
      alChat(m, cg.chat, { t: 'sistema', texto: d.chat.rechazoCambio });
      m.isla({ titulo: x.islaRechazo.titulo, texto: completar(x.islaRechazo.texto, { cuando: cuandoDeTurno(actual.fecha, actual.hora) }), icono: 'info' });
    }
    pintarCambio(m);
    pintarDetalle(m);
  }
}

// ── Propuesta desde el chat ───────────────────────────────────────────────

function abrirPropuesta(m: Motor, modo: ModoPropuesta, chat: string, pantalla: string, solicitud?: string) {
  const e = est(m);
  e.prop = { modo, chat, pantalla, solicitud };
  if (e.borradores) delete e.borradores['e-propuesta'];
  pintarPropuesta(m);
  m.ir('e-propuesta');
}

function pintarPropuesta(m: Motor) {
  const el = m.pantalla('e-propuesta');
  const pr = est(m).prop ?? { modo: 'programar' as const, chat: 'perla', pantalla: 'e-chat' };
  const p = d.propuesta;
  const caja = $(el, '[data-de-prop]');
  if (caja) caja.dataset.modo = pr.modo;
  poner(el, '[data-de-prop-modo]', p.modos[pr.modo]);
  poner(el, '[data-de-prop-para]', completar(p.para, { cliente: CHATS[pr.chat]?.nombre ?? '' }));
  const pidio = $(el, '[data-de-prop-pidio]');
  if (pidio) {
    pidio.hidden = pr.modo !== 'cotizar';
    poner(pidio, '[data-de-prop-pidio-texto]', completar(p.pidio, { cuando: cuandoTexto(d.solicitud.fecha, leerHora(d.solicitud.hora), '') }));
  }
  const programar = $(el, '[data-de-prop-programar]');
  if (programar) programar.hidden = pr.modo === 'ahora';
  const ahora = $(el, '[data-de-prop-ahora]');
  if (ahora) ahora.hidden = pr.modo !== 'ahora';
  poner(el, '[data-de-prop-cuando-label]', pr.modo === 'ahora' ? p.franjaLabel : p.cuandoLabel);
  pintarPrecio(m, 'e-propuesta');
}

function mandarPropuesta(m: Motor) {
  const e = est(m);
  const pr = e.prop;
  if (!pr) return;
  const b = borrador(m, 'e-propuesta');
  if (!precioValido(b)) return;
  const p = d.propuesta;
  const fecha = pr.modo === 'ahora' ? HOY : b.fecha ?? HOY;
  const hora = pr.modo === 'ahora' ? d.precio.franjas[b.franja].corto : b.hora ? `${horaTexto(b.hora)} h` : '';
  const cuando = pr.modo === 'ahora' ? d.precio.franjas[b.franja].texto : cuandoTexto(fecha, b.hora, '');
  const datos: DatoPropuesta[] = [
    { etiqueta: demo.chatTurnos.cuando, valor: cuando },
    { etiqueta: p.precioLabel, valor: pesos(b.precio), destacado: true },
  ];
  const detalle = pr.modo === 'cotizar' ? d.solicitud.problema : p.detalleTurno;
  const pedido = pr.modo === 'cotizar' ? `«${d.solicitud.problema}»` : '';
  if (pr.solicitud) reemplazarTarjeta(m, pr.solicitud);
  m.volver();
  nuevaTarjeta(
    m,
    pr.chat,
    { tipo: 'propuesta', titulo: p.tituloCard, datos, nota: p.notaCard, responde: false, propia: true },
    { tipo: 'turno', fecha, hora, precio: b.precio, detalle, pedido },
    sim(m),
  );
  m.anunciar(completar(p.anuncio, { precio: pesos(b.precio), cuando }));
  asegurarRespuestas(m);
}

// ── Trabajo en curso y adicionales ───────────────────────────────────────

function pintarCrono(m: Motor) {
  const e = est(m);
  const s = Math.max(0, Math.floor((Date.now() - (e.inicioTrabajo ?? Date.now())) / 1000));
  poner(m.pantalla('e-trabajo'), '[data-de-crono]', `${dos(Math.floor(s / 60))}:${dos(s % 60)}`);
}

function pintarTrabajo(m: Motor, contar = false) {
  const el = m.pantalla('e-trabajo');
  const e = est(m);
  const t = d.trabajo;
  poner(el, '[data-de-franja]', horarioHoy(m));
  const costo = $(el, '[data-de-costo]');
  if (costo) filasDesglose(costo, presupuestoHoy(m), C.recibis, aprobadosHoy(m), contar ? m : undefined);
  const pend = pendienteHoy(m);
  const agregar = $(el, '[data-de-agregar]');
  if (agregar) agregar.hidden = !!pend;
  const bloque = $(el, '[data-de-pendiente]');
  if (bloque) {
    const antes = bloque.hidden;
    bloque.hidden = !pend;
    if (pend) {
      const despues = netoDe(presupuestoHoy(m), [...aprobadosHoy(m), pend.concepto]);
      poner(bloque, '[data-de-pendiente-texto]', `${pend.concepto.descripcion} · + ${pesos(pend.concepto.monto)}. ${completar(t.siAcepta, { monto: pesosJuntos(despues) })} ${t.noCuenta}`);
      if (antes) aparecer(m, bloque);
    }
  }
  const lista = e.adicionales ?? [];
  const ultimo = lista[lista.length - 1];
  const rechazo = $(el, '[data-de-adicional-rechazo]');
  if (rechazo) {
    rechazo.hidden = !(ultimo && ultimo.estado === 'rechazada');
    if (ultimo) poner(rechazo, '[data-de-adicional-rechazo-texto]', completar(t.rechazado, { concepto: ultimo.concepto.descripcion }));
  }
  // Guía: primero un adicional; cuando el cliente responde, terminar.
  guiar(el, '[data-guia]', !lista.length ? agregar : !pend ? $(el, '[data-de-terminar]') : null);
}

const adSel = (m: Motor) => (est(m).adSel ??= { op: null, tipo: 'material', tecleo: '', desc: '' });

function conceptoElegido(m: Motor): Concepto | null {
  const s = adSel(m);
  if (!s.op) return null;
  if (s.op === 'personalizada') return { tipo: s.tipo, descripcion: s.desc.trim(), monto: Number(s.tecleo || 0) };
  const o = d.adicional.opciones.find((x) => x.id === s.op);
  return o ? { tipo: o.tipo as Concepto['tipo'], descripcion: o.descripcion, monto: o.monto } : null;
}

function pintarAdicional(m: Motor) {
  const el = m.pantalla('e-adicional');
  const s = adSel(m);
  const a = d.adicional;
  $$(el, '[data-accion="adicionalOp"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === s.op)));
  const form = $(el, '[data-de-personalizada]');
  if (form) {
    const antes = form.hidden;
    form.hidden = s.op !== 'personalizada';
    if (antes && !form.hidden) aparecer(m, form);
  }
  $$(el, '[data-accion="adicionalTipo"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === s.tipo)));
  const monto = $(el, '[data-de-adicional-monto]');
  if (monto) fijar(monto, Number(s.tecleo || 0));
  const input = $<HTMLInputElement>(el, '[data-de-adicional-desc]');
  if (input && input.value !== s.desc) input.value = s.desc;

  const c = conceptoElegido(m);
  const valido = !!c && !!c.descripcion && c.monto > 0;
  const falta = $(el, '[data-de-adicional-falta]');
  if (falta) {
    const texto = s.op === 'personalizada' && c ? (!c.descripcion && c.monto > 0 ? a.faltaDescripcion : c.descripcion && !c.monto ? a.faltaPrecio : '') : '';
    falta.hidden = !texto;
    poner(falta, 'span', texto);
  }
  const resumen = $(el, '[data-de-adicional-resumen]');
  if (resumen) {
    const antes = resumen.hidden;
    resumen.hidden = !valido;
    if (valido && c) {
      const x = propuestaAdicional(presupuestoHoy(m), T, aprobadosHoy(m), c);
      const filas: [string, string, boolean][] = [
        [a.concepto, `${c.descripcion} (${a.tipos[c.tipo === 'mano' ? 'mano' : 'material']})`, false],
        [a.importe, pesos(c.monto), false],
        [completar(C.tarifaCliente, VARS), pesos(x.tarifaCliente), false],
        [a.totalAntes, pesos(x.totalAntes), false],
        [a.totalNuevo, pesos(x.totalDespues), true],
      ];
      const dl = $(resumen, '[data-de-adicional-cliente]');
      dl?.replaceChildren(
        ...filas.map(([k, v, dest]) => {
          const f = document.createElement('div');
          if (dest) f.className = 'de-dl__destacado';
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          f.append(dt, dd);
          return f;
        }),
      );
      fijar($(resumen, '[data-de-adicional-neto]'), x.netoEspecialistaDespues);
      if (antes) aparecer(m, resumen);
    }
  }
  const enviar = $<HTMLButtonElement>(el, '[data-de-enviar]');
  if (enviar) enviar.disabled = !valido || !!pendienteHoy(m);
  guiar(el, '[data-guia]', !s.op ? $(el, `[data-accion="adicionalOp"][data-valor="${a.guia}"]`) : valido ? enviar : null);
}

function mandarAdicional(m: Motor) {
  const c = conceptoElegido(m);
  if (!c || !c.descripcion || c.monto <= 0 || pendienteHoy(m)) return;
  const e = est(m);
  const a = d.adicional;
  const x = propuestaAdicional(presupuestoHoy(m), T, aprobadosHoy(m), c);
  m.volver();
  alChat(m, 'perla', { t: 'msg', texto: c.descripcion === d.adicional.opciones[0].descripcion ? a.chat : c.descripcion, propia: true });
  const id = nuevaTarjeta(
    m,
    'perla',
    {
      tipo: 'adicional',
      titulo: a.tituloCard,
      datos: [
        { etiqueta: a.concepto, valor: c.descripcion },
        { etiqueta: a.importe, valor: pesos(c.monto) },
        { etiqueta: completar(C.tarifaCliente, VARS), valor: pesos(x.tarifaCliente) },
        { etiqueta: a.totalNuevo, valor: pesos(x.totalDespues), destacado: true },
      ],
      nota: a.notaCard,
      responde: false,
      propia: true,
    },
    { tipo: 'adicional' },
    sim(m),
  );
  (e.adicionales ??= []).push({ id, concepto: c, estado: 'pendiente' });
  e.adSel = undefined;
  pintarTrabajo(m);
  m.anunciar(completar(a.anuncio, { concepto: c.descripcion, monto: pesos(c.monto) }));
  asegurarRespuestas(m);
}

// ── Fin y cobros ──────────────────────────────────────────────────────────

function pintarFin(m: Motor) {
  const el = m.pantalla('e-fin');
  fijar($(el, '[data-de-ganaste]'), netoHoy(m));
  const costo = $(el, '[data-de-costo]');
  if (costo) filasDesglose(costo, presupuestoHoy(m), C.aTuCuenta, aprobadosHoy(m));
}

function abrirTarjeta(tarjeta: HTMLElement, abrir: boolean) {
  const detalle = $(tarjeta, '[data-de-mov-desglose]');
  const btn = $(tarjeta, '[data-accion="verMas"]');
  if (!detalle || !btn) return;
  detalle.hidden = !abrir;
  btn.setAttribute('aria-expanded', String(abrir));
  poner(btn, '[data-de-ver-mas-texto]', abrir ? C.verMenos : C.verMas);
}

function pintarCaja(m: Motor) {
  const el = m.pantalla('e-caja');
  const hoy = $(el, '[data-de-mov-hoy]');
  if (hoy) {
    hoy.hidden = !terminado(m);
    poner(hoy, '[data-de-mov-neto]', `+ ${pesos(netoHoy(m))}`);
    const costo = $(hoy, '[data-de-mov-desglose]');
    if (costo) filasDesglose(costo, presupuestoHoy(m), C.aTuCuenta, aprobadosHoy(m));
  }
  const visibles = $$(el, '.de-mov').filter((t) => !t.hidden);
  if (hoy && !hoy.hidden) {
    visibles.forEach((t) => {
      if (t.dataset.deAuto === undefined) return;
      abrirTarjeta(t, false);
      delete t.dataset.deAuto;
    });
  }
  if (visibles.length && !visibles.some((t) => $(t, '[data-de-mov-desglose]')?.hidden === false)) {
    abrirTarjeta(visibles[0], true);
    if (visibles[0] !== hoy) visibles[0].dataset.deAuto = '';
  }
  const cbu = est(m).cbu;
  if (cbu && cbu.length === 22) poner(el, '[data-de-cbu-mostrado]', `•••• •••• •••• •••• ${cbu.slice(-4)}`);
}

function pintarDependientes(m: Motor) {
  pintarAceptado(m);
  poner(m.pantalla('e-en-camino'), '[data-de-franja]', horarioHoy(m));
  pintarTrabajo(m);
  pintarCrono(m);
  pintarFin(m);
  pintarCaja(m);
  poner(m.pantalla('e-notificaciones'), '[data-de-neto]', pesos(netoHoy(m)));
  pintarHoyAgenda(m);
}

// ── Agenda y detalle ──────────────────────────────────────────────────────

const ESTADOS = d.turnos.estados as Record<string, string>;
const cuandoDeTurno = (fecha: FechaISO, hora: string) =>
  /^\d{2}:\d{2} h$/.test(hora) ? completar(C.horaA, { fecha: fechaLarga(fecha), hora: hora.slice(0, 5) }) : `${fechaLarga(fecha)}, ${hora}`;

/** El trabajo de hoy (La Perla) como trabajo de la agenda. */
function trabajoHoy(m: Motor): TrabajoAg {
  const p = presupuestoHoy(m);
  const h = d.turnos.hoyTrabajo;
  return {
    id: h.id,
    fecha: est(m).fechaHoy ?? HOY,
    hora: horarioHoy(m).replace(/^Hoy, /, ''),
    rubro: d.inicio.pedido.rubro,
    icono: d.inicio.pedido.icono,
    detalle: h.detalle,
    barrio: CHATS.perla.barrio,
    manoDeObra: p.manoDeObra,
    materiales: p.materiales,
    chat: 'perla',
    pedido: h.pedido,
    estado: terminado(m) ? 'hecho' : 'hoy',
  };
}

function trabajoPorId(m: Motor, id: string): TrabajoAg | undefined {
  if (id === d.turnos.hoyTrabajo.id) return trabajoHoy(m);
  return TRABAJOS.find((t) => t.id === id) ?? est(m).nuevos?.find((t) => t.id === id);
}

/** Fecha y hora vigentes de un turno (si el cliente aceptó un cambio, las nuevas). */
function vigente(m: Motor, id: string): { fecha: FechaISO; hora: string } {
  const r = est(m).reprogramados?.[id];
  const t = trabajoPorId(m, id);
  return r ?? { fecha: t?.fecha ?? HOY, hora: t?.hora ?? '' };
}

function llenarTarjeta(m: Motor, card: HTMLElement, t: TrabajoAg) {
  const v = vigente(m, t.id);
  card.dataset.deTurno = t.id;
  card.className = `de-turno de-turno--${t.estado}${(est(m).cancelados ?? []).includes(t.id) ? ' de-turno--cancelado' : ''}`;
  const ico = iconoDe(t.icono);
  const caja = $(card, '[data-de-t="icono"]');
  if (ico && caja) caja.replaceChildren(ico);
  poner(card, '[data-de-t="detalle"]', t.detalle);
  poner(card, '[data-de-t="lugar"]', `${t.rubro} · ${t.barrio}`);
  poner(card, '[data-de-t="hora"] span', v.hora);
  const aprob = t.id === d.turnos.hoyTrabajo.id ? aprobadosHoy(m) : [];
  poner(card, '[data-de-t="neto"]', `+ ${pesos(netoDe({ manoDeObra: t.manoDeObra, materiales: t.materiales }, aprob))}`);
  poner(card, '[data-de-t="estado"]', (est(m).cancelados ?? []).includes(t.id) ? d.turnos.estados.cancelado : ESTADOS[t.estado] ?? '');
  poner(card, '[data-de-t="contexto"]', `: ${t.detalle}, ${cuandoDeTurno(v.fecha, v.hora)}`);
  const b = $(card, '[data-accion="verTurno"]');
  if (b) {
    b.dataset.valor = t.id;
    b.removeAttribute('data-guia');
  }
}

function liTrabajo(m: Motor, t: TrabajoAg): HTMLElement | null {
  const molde = $<HTMLTemplateElement>(m.pantalla('e-turnos'), 'template[data-de-molde-trabajo]');
  const card = molde?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (!card) return null;
  llenarTarjeta(m, card, t);
  const li = document.createElement('li');
  li.className = 'hd-agenda__trabajo';
  li.dataset.hdTrabajo = t.id;
  li.dataset.fecha = vigente(m, t.id).fecha;
  li.dataset.entra = '';
  li.hidden = true;
  li.append(card);
  return li;
}

/** El trabajo de hoy aparece en la agenda cuando el cliente te eligió. */
function agregarHoy(m: Motor) {
  const id = d.turnos.hoyTrabajo.id;
  if (document.querySelector(`[data-pantalla="e-turnos"] [data-hd-trabajo="${id}"]`)) return pintarHoyAgenda(m);
  const li = liTrabajo(m, trabajoHoy(m));
  if (li) agregarTrabajoAgenda('especialista', li);
}

function pintarHoyAgenda(m: Motor) {
  const li = document.querySelector<HTMLElement>(`[data-pantalla="e-turnos"] [data-hd-trabajo="${d.turnos.hoyTrabajo.id}"]`);
  const card = li && $(li, '.de-turno');
  if (li && card) {
    const t = trabajoHoy(m);
    li.dataset.fecha = t.fecha;
    llenarTarjeta(m, card, t);
  }
}

function moverEnAgenda(m: Motor, id: string) {
  const li = document.querySelector<HTMLElement>(`[data-pantalla="e-turnos"] [data-hd-trabajo="${id}"]`);
  const t = trabajoPorId(m, id);
  if (!li || !t) return;
  li.dataset.fecha = vigente(m, id).fecha;
  const card = $(li, '.de-turno');
  if (card) llenarTarjeta(m, card, t);
}

function pintarTurnos(m: Motor) {
  const el = m.pantalla('e-turnos');
  const cancelados = est(m).cancelados ?? [];
  $$(el, '[data-hd-trabajo]').forEach((li) => {
    const card = $(li, '.de-turno');
    const no = cancelados.includes(li.dataset.hdTrabajo ?? '');
    card?.classList.toggle('de-turno--cancelado', no);
    if (no) poner(card, '[data-de-t="estado"]', ESTADOS.cancelado ?? '');
  });
}

/** Guía de la agenda: tocar el día con varios trabajos y después uno de ellos. */
function guiaAgenda(el: HTMLElement, m: Motor) {
  const dia = d.turnos.guiaDia;
  const elegido = $(el, '.hd-cal__dia[aria-pressed="true"]')?.dataset.valor;
  if (elegido !== dia) {
    const b = $(el, `.hd-cal__dia[data-valor="${dia}"]`);
    if (b) m.guia(b);
  }
}

const turnoActual = (m: Motor) => est(m).turno ?? TRABAJOS.find((t) => t.estado === 'confirmado')!.id;
const cancelado = (m: Motor, id: string) => (est(m).cancelados ?? []).includes(id);

function pintarDetalle(m: Motor) {
  const el = m.pantalla('e-turno-detalle');
  const id = turnoActual(m);
  const t = trabajoPorId(m, id);
  if (!t) return;
  const v = vigente(m, id);
  const ch = CHATS[t.chat];
  const x = d.detalle;
  const { dia, mes } = partes(v.fecha);
  poner(el, '[data-de-d="dow"]', fechaCorta(v.fecha).split(' ')[0]);
  poner(el, '[data-de-d="num"]', String(dia));
  poner(el, '[data-de-d="mes"]', C.meses[mes - 1]);
  poner(el, '[data-de-d="rubro"]', t.rubro);
  poner(el, '[data-de-d="detalle"]', t.detalle);
  poner(el, '[data-de-d="franja"]', v.hora);
  poner(el, '[data-de-d="barrio"]', t.barrio);
  poner(el, '[data-de-d="pedido"]', t.pedido || d.propuesta.sinPedido);
  poner(el, '[data-de-d="cliente"]', ch.nombre);
  const avatar = $(el, '[data-de-d="avatar"]');
  if (avatar) {
    avatar.style.setProperty('--tono', ch.tono);
    poner(avatar, 'span', ch.inicial);
  }
  $$(el, '[data-de-icono]').forEach((s) => (s.hidden = s.dataset.deIcono !== t.icono));
  const no = cancelado(m, id);
  const hecho = t.estado === 'hecho';
  const costo = $(el, '[data-de-d="costo"]');
  if (costo) filasDesglose(costo, { manoDeObra: t.manoDeObra, materiales: t.materiales }, C.recibis, id === d.turnos.hoyTrabajo.id ? aprobadosHoy(m) : []);
  $(el, '.de-detalle')?.classList.toggle('de-detalle--cancelado', no);
  $(el, '.de-detalle')?.classList.toggle('de-detalle--hecho', hecho);
  poner(el, '[data-de-d="estado"] span', no ? ESTADOS.cancelado ?? '' : ESTADOS[t.estado] ?? x.confirmado);
  const linea = $(el, '[data-de-d="cancelado"]');
  if (linea) linea.hidden = !no;
  const fin = $(el, '[data-de-d="hecho"]');
  if (fin) fin.hidden = !hecho;
  const acciones = $(el, '[data-de-d="acciones"]');
  if (acciones) acciones.hidden = no || hecho || t.estado === 'hoy';
  const c = est(m).cambios?.[id];
  const pend = $(el, '[data-de-d="pendiente"]');
  if (pend) {
    pend.hidden = !(c && c.enviado && c.estado === 'pendiente');
    if (c) poner(pend, 'span', completar(x.pendiente, { cuando: cuandoCambio(c) }));
  }
  const chat = $(el, '[data-de-d="chat"]');
  if (chat) chat.dataset.valor = t.chat;
}

// ── Cambiar la fecha ──────────────────────────────────────────────────────

function cambio(m: Motor): Cambio {
  const e = est(m);
  const id = turnoActual(m);
  const cs = (e.cambios ??= {});
  if (!cs[id]) {
    const v = vigente(m, id);
    const i = d.cambio.franjas.indexOf(v.hora);
    cs[id] = { turno: id, fecha: sumarDias(v.fecha, 1), franja: i >= 0 ? i : 0, hora: null, motivo: null, mensaje: false, fechaCal: false, enviado: false, estado: 'pendiente' };
  }
  return cs[id];
}

const cuandoCambio = (c: Cambio) => (c.hora ? completar(C.horaA, { fecha: fechaLarga(c.fecha), hora: horaTexto(c.hora) }) : `${fechaLarga(c.fecha)}, ${d.cambio.franjas[c.franja ?? 0]}`);

/** Tira de la semana (domingo a sábado) del día propuesto. */
function pintarSemana(cont: HTMLElement, nuevo: FechaISO, actual: FechaISO) {
  const domingo = sumarDias(nuevo, -diaDeSemana(nuevo));
  const celdas: HTMLElement[] = [];
  for (let n = 0; n < 7; n++) {
    const f = sumarDias(domingo, n);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `de-semana__dia${f === actual ? ' de-semana__dia--actual' : ''}`;
    b.dataset.accion = 'elegirDia';
    b.dataset.valor = f;
    b.setAttribute('aria-label', completar(d.cambio.elegirDia, { fecha: fechaLarga(f) }));
    b.setAttribute('aria-pressed', String(f === nuevo));
    b.disabled = esPasada(f, HOY);
    const [dow, num] = fechaCorta(f).split(' ');
    const ini = document.createElement('small');
    ini.textContent = dow;
    const numero = document.createElement('strong');
    numero.textContent = num;
    b.append(ini, numero);
    celdas.push(b);
  }
  cont.replaceChildren(...celdas);
}

function pintarCambio(m: Motor) {
  const el = m.pantalla('e-cambiar-fecha');
  const c = cambio(m);
  const x = d.cambio;
  const v = vigente(m, c.turno);
  const actualTexto = cuandoDeTurno(v.fecha, v.hora);
  poner(el, '[data-de-cambio-actual] span', completar(x.actual, { cuando: actualTexto }));
  const tira = $(el, '[data-de-semana]');
  if (tira) pintarSemana(tira, c.fecha, v.fecha);
  $$(el, '[data-accion="franjaElegir"]').forEach((b) => b.setAttribute('aria-pressed', String(c.hora === null && Number(b.dataset.valor) === c.franja)));
  const fecha = $(el, '[data-de-elegir="fecha"]');
  if (fecha) {
    fecha.setAttribute('aria-pressed', String(c.fechaCal));
    poner(fecha, 'span', c.fechaCal ? fechaLarga(c.fecha) : x.elegirFecha);
  }
  const hora = $(el, '[data-de-elegir="hora"]');
  if (hora) {
    hora.setAttribute('aria-pressed', String(!!c.hora));
    poner(hora, 'span', c.hora ? `${horaTexto(c.hora)} h` : x.elegirHora);
  }
  const nuevo = cuandoCambio(c);
  poner(el, '[data-de-cambio-resumen]', completar(x.resumen, { cuando: nuevo }));
  $$(el, '[data-accion="motivo"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.valor) === c.motivo)));
  const mensaje = $(el, '[data-accion="mensajeCambio"]');
  if (mensaje) {
    const texto = c.mensaje ? (x.mensajes[c.motivo ?? x.mensajes.length - 1] ?? x.mensajes[x.mensajes.length - 1]) : x.mensaje;
    poner(mensaje, '[data-de-mensaje-texto]', texto);
    mensaje.classList.toggle('de-campo--lleno', c.mensaje);
  }
  const proponer = $(el, '[data-accion="proponerFecha"]');
  if (proponer) proponer.hidden = c.enviado;
  const volver = $(el, '[data-de-cambio-volver]');
  if (volver) volver.hidden = !c.enviado;
  const form = $(el, '[data-de-cambio-form]');
  if (form) form.hidden = c.enviado;
  const ok = $(el, '[data-de-cambio-ok]');
  if (ok) {
    const antes = ok.hidden;
    ok.hidden = !c.enviado;
    ok.dataset.estado = c.estado;
    $$(ok, '[data-de-cambio-ico]').forEach((s) => (s.hidden = s.dataset.deCambioIco !== c.estado));
    $$(ok, '[data-de-cambio-titulo]').forEach((s) => (s.hidden = s.dataset.deCambioTitulo !== c.estado));
    const texto =
      c.estado === 'aceptada' ? completar(x.aceptado, { cuando: nuevo }) : c.estado === 'rechazada' ? completar(x.rechazado, { cuando: actualTexto }) : `${completar(x.resumen, { cuando: nuevo })} ${x.enviado}`;
    poner(ok, '[data-de-cambio-ok-texto]', texto);
    if (antes && c.enviado) aparecer(m, ok);
  }
  const resumen = $(el, '[data-de-cambio-resumen]');
  if (resumen) resumen.hidden = c.enviado;
  // Guía: motivo → elegir la fecha en el calendario → proponer; con la respuesta del cliente, tus avisos.
  const objetivo = c.enviado
    ? c.estado !== 'pendiente'
      ? $(el, '.app-cabecera [data-ir="e-notificaciones"]')
      : null
    : c.motivo === null
      ? $(el, '[data-accion="motivo"][data-valor="0"]')
      : !c.fechaCal
        ? fecha
        : proponer;
  guiar(el, '[data-guia]', objetivo);
}

function proponerCambio(m: Motor) {
  const c = cambio(m);
  if (c.enviado) return;
  const t = trabajoPorId(m, c.turno);
  if (!t) return;
  const x = d.cambio;
  const v = vigente(m, c.turno);
  c.enviado = true;
  c.estado = 'pendiente';
  c.card = nuevaTarjeta(
    m,
    t.chat,
    {
      tipo: 'cambio',
      titulo: x.tituloCard,
      datos: [
        { etiqueta: x.antes, valor: cuandoDeTurno(v.fecha, v.hora) },
        { etiqueta: x.propone, valor: cuandoCambio(c), destacado: true },
      ],
      nota: x.enviado,
      responde: false,
      propia: true,
    },
    { tipo: 'cambio', turno: c.turno },
    sim(m),
  );
  pintarCambio(m);
  m.isla({ titulo: x.isla.titulo, texto: completar(x.isla.texto, { cuando: cuandoCambio(c) }), icono: 'calendario', tono: 'azul' });
  asegurarRespuestas(m);
}

// ── Avisos, pedido programado, cuenta, mensajes y cobro ──────────────────

function pintarAvisos(m: Motor) {
  const el = m.pantalla('e-notificaciones');
  poner(el, '[data-de-neto]', pesos(netoHoy(m)));
  const cobro = $(el, '[data-de-cobro-hoy]');
  if (cobro && cobro.dataset.deBorrado === undefined) cobro.hidden = !terminado(m);
  $$(el, '[data-de-grupo]').forEach((g) => (g.hidden = !$$(g, '.de-notif').some((n) => !n.hidden)));
  const hay = $$(el, '.de-notif').some((n) => !n.hidden);
  const pie = $(el, '[data-de-hay]');
  if (pie) pie.hidden = !hay;
  const vacio = $(el, '[data-de-vacio]');
  if (vacio) {
    if (vacio.hidden && !hay) aparecer(m, vacio);
    vacio.hidden = hay;
  }
}

function pintarProgramado(m: Motor, nuevo = false) {
  const el = m.pantalla('e-pedido-programado');
  const e = est(m);
  const p = d.programado;
  const tarjeta = $(el, '[data-de-programado]');
  if (tarjeta) tarjeta.hidden = !!e.programado;
  const resp = $(el, '[data-de-programado-respuesta]');
  if (resp) {
    resp.hidden = !e.programado;
    $$(resp, '[data-de-resp]').forEach((x) => (x.hidden = x.dataset.deResp !== e.programado));
    const ico = e.programado === 'enviado' ? 'espera' : e.programado === 'aceptado' ? 'ok' : 'no';
    $$(resp, '[data-de-resp-ico]').forEach((x) => (x.hidden = x.dataset.deRespIco !== ico));
    const cuando = e.cuandoProgramado ?? `${p.dia}, ${p.franja}`;
    const texto =
      e.programado === 'enviado'
        ? completar(p.enviadoTexto, { monto: pesosJuntos(e.precioProgramado ?? p.sugerido), cuando })
        : e.programado === 'aceptado'
          ? completar(p.aceptadoTexto, { cuando })
          : e.programado === 'rechazadoCliente'
            ? p.rechazadoClienteTexto
            : p.rechazadoTexto;
    poner(resp, '[data-de-resp-texto]', texto);
    if (nuevo) animar(m, resp, [{ transform: 'translateY(110%)' }, { transform: 'none' }], 640, RESORTE);
  }
  guiar(el, '.app-nav [data-guia]', e.programado && e.programado !== 'enviado' ? $(el, '.app-nav [data-ir-raiz="e-mensajes"]') : null);
}

function enviarProgramado(m: Motor, monto: number, b?: Borrador) {
  const e = est(m);
  const p = d.programado;
  e.precioProgramado = monto;
  e.fechaProgramado = b?.fecha ?? p.fecha;
  e.horaProgramado = b?.hora ? `${horaTexto(b.hora)} h` : p.franja;
  e.cuandoProgramado = b ? cuandoBorrador('e-precio-programado', b) : `${p.dia}, ${p.franja}`;
  e.respuestaProgramado = sim(m);
  e.programado = 'enviado';
  pintarProgramado(m, true);
  m.isla({ titulo: p.isla.titulo, texto: p.isla.texto, icono: p.icono, tono: 'azul' });
  programarRespuestaProgramado(m);
}

function programarRespuestaProgramado(m: Motor) {
  m.timeout(() => {
    const e = est(m);
    if (e.programado !== 'enviado') return;
    const p = d.programado;
    if (e.respuestaProgramado === 'rechaza') {
      e.programado = 'rechazadoCliente';
      m.isla({ titulo: p.islaRechazo.titulo, texto: p.islaRechazo.texto, icono: 'info' });
    } else {
      e.programado = 'aceptado';
      const t: TrabajoAg = {
        id: 't-programado',
        fecha: e.fechaProgramado ?? p.fecha,
        hora: e.horaProgramado ?? p.franja,
        rubro: p.rubro,
        icono: p.icono,
        detalle: p.trabajo,
        barrio: p.barrio,
        manoDeObra: e.precioProgramado ?? p.sugerido,
        materiales: 0,
        chat: 'troncos',
        pedido: p.detalle,
        estado: 'confirmado',
      };
      (e.nuevos ??= []).push(t);
      const li = liTrabajo(m, t);
      if (li) agregarTrabajoAgenda('especialista', li);
      m.isla({ titulo: p.islaAcepto.titulo, texto: completar(p.islaAcepto.texto, { cuando: e.cuandoProgramado ?? '' }), icono: 'calendario', tono: 'exito' });
      m.confeti();
    }
    pintarProgramado(m, true);
  }, RESPUESTA_MS);
}

const rubrosActivos = (m: Motor) => est(m).rubros ?? (d.rubrosHoja.rubrosActivos as string[]);
const zonasActivas = (m: Motor) => est(m).zonas ?? d.rubrosHoja.zonasActivas;

function pintarCuenta(m: Motor) {
  const activos = rubrosActivos(m);
  $$(m.pantalla('e-cuenta'), '[data-de-mi-rubro]').forEach((s) => (s.hidden = !activos.includes(s.dataset.deMiRubro ?? '')));
}

function pintarRubros(m: Motor) {
  const el = m.pantalla('e-rubros');
  const activos = rubrosActivos(m);
  const zonas = zonasActivas(m);
  $$(el, '[data-accion="toggleRubro"]').forEach((b) => b.setAttribute('aria-pressed', String(activos.includes(b.dataset.valor ?? ''))));
  $$(el, '[data-accion="toggleZona"]').forEach((b) => b.setAttribute('aria-pressed', String(zonas.includes(Number(b.dataset.valor)))));
}

function ultimoMensaje(m: Motor, id: string): string {
  const h = hilo(m, id);
  const it = h[h.length - 1];
  const ch = CHATS[id];
  if (!it) return ch.mensajes[ch.mensajes.length - 1]?.texto ?? '';
  switch (it.t) {
    case 'rapida':
      return ch.rapidas[it.i].respuesta;
    case 'foto':
      return d.chat.fotoTexto;
    case 'sistema':
    case 'msg':
      return it.texto;
    case 'card':
      return est(m).cards?.[it.id]?.opciones.titulo ?? '';
  }
}

function pintarMensajes(m: Motor) {
  const el = m.pantalla('e-mensajes');
  const e = est(m);
  const leidos = e.leidos ?? [];
  d.mensajes.orden.forEach((id) => {
    poner(el, `[data-de-ultimo="${id}"]`, ultimoMensaje(m, id));
    const badge = $(el, `[data-de-badge="${id}"]`);
    if (badge) badge.hidden = leidos.includes(id);
  });
  $$(el, '[data-de-chat-fila="perla"]').forEach((f) => (f.hidden = !e.elegido));
  // Guía: la solicitud nueva; con el turno confirmado, tus contactos.
  guiar(el, '[data-guia]', e.nuevoAceptado ? $(el, '[data-de-contactos-btn]') : $(el, `[data-de-chat-fila="${NUEVO}"]`));
}

const CBU_LARGO = 22;

function pintarCobro(m: Motor) {
  const el = m.pantalla('e-editar-cobro');
  const x = d.cobro;
  const cbu = est(m).cbu ?? '';
  const valor = $(el, '[data-de-cbu]');
  if (valor) {
    valor.textContent = cbu ? cbu.replace(/(\d{4})(?=\d)/g, '$1 ') : x.cbuVacio;
    valor.classList.toggle('de-cbu__valor--vacio', !cbu);
  }
  poner(el, '[data-de-cbu-contador]', completar(x.contador, { n: cbu.length }));
  const barra = $(el, '[data-de-cbu-barra]');
  if (barra) barra.style.transform = `scaleX(${cbu.length / CBU_LARGO})`;
  $(el, '[data-de-cbu-caja]')?.classList.toggle('de-cbu--completo', cbu.length === CBU_LARGO);
  const borrar = $(el, '[data-de-cbu-borrar]');
  if (borrar) borrar.hidden = !cbu;
}

function errorCbu(m: Motor, mostrar: boolean) {
  const el = m.pantalla('e-editar-cobro');
  const linea = $(el, '[data-de-cbu-error]');
  if (!linea) return;
  if (mostrar) {
    poner(linea, '[data-de-cbu-error-texto]', completar(d.cobro.error, { n: (est(m).cbu ?? '').length }));
    linea.hidden = true;
    void linea.offsetWidth;
    linea.hidden = false;
    $(el, '[data-de-cbu-caja]')?.classList.add('de-cbu--error');
  } else {
    linea.hidden = true;
    $(el, '[data-de-cbu-caja]')?.classList.remove('de-cbu--error');
  }
}

function pintarSimuladores(m: Motor) {
  const s = sim(m);
  $$(document, '.demo-pantalla[data-rol="especialista"] [data-accion="simular"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === s)));
}

/** La solicitud del cliente nuevo llega al abrir su chat (con el "escribiendo" antes). */
function llegaSolicitud(m: Motor, el: HTMLElement) {
  const e = est(m);
  if (e.solicitudLista) return;
  const mensajes = $(el, '[data-de-mensajes]');
  const plantilla = $<HTMLTemplateElement>(el, 'template[data-de-plantilla-escribiendo]');
  const escribiendo = plantilla?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (escribiendo && mensajes) {
    mensajes.append(escribiendo);
    aparecer(m, escribiendo);
    alFondo(m, mensajes);
  }
  m.timeout(() => {
    escribiendo?.remove();
    if (e.solicitudLista) return;
    e.solicitudLista = true;
    const s = d.solicitud;
    nuevaTarjeta(
      m,
      NUEVO,
      {
        tipo: 'solicitud',
        datos: [
          { etiqueta: demo.chatTurnos.problema, valor: s.problema },
          { etiqueta: demo.chatTurnos.cuando, valor: cuandoTexto(s.fecha, leerHora(s.hora), ''), destacado: true },
        ],
        nota: s.nota,
        responde: false,
        propia: false,
      },
      { tipo: 'solicitud' },
    );
    m.anunciar(s.isla.texto);
  }, 1200);
}

// ── Registro ──────────────────────────────────────────────────────────────

let originales: Map<string, string> | null = null;

const hojaDe = (el: Element) => idDe(el) as HojaPrecio;

registrarRol('especialista', {
  acciones: {
    disponible(el, m) {
      const e = est(m);
      const enInicio = idDe(el) === 'e-inicio';
      e.disponible = !e.disponible;
      e.token = (e.token ?? 0) + 1;
      if (!e.disponible) e.pedido = 'nada';
      if (enInicio) {
        e.rechazado = false;
        if (e.disponible) e.atendido = false;
      }
      pintarInicio(m);
      m.anunciar(e.disponible ? d.inicio.anuncioBuscando : d.inicio.anuncioApagado);
      if (enInicio && e.disponible) programarPedido(m);
    },
    rechazar(_el, m) {
      const e = est(m);
      e.pedido = 'nada';
      e.rechazado = true;
      pintarInicio(m);
      m.anunciar(d.inicio.rechazadoTexto);
    },
    aceptarSugerido(_el, m) {
      enviarPresupuesto(m, { base: SUGERIDO, precio: SUGERIDO, tecleo: null, materiales: MATERIALES, franja: 0 });
    },

    // Precio
    precioSugerido(el, m) {
      const h = hojaDe(el);
      cambiarPrecio(m, h, borrador(m, h).base);
    },
    precioSumar(el, m) {
      const h = hojaDe(el);
      cambiarPrecio(m, h, borrador(m, h).base + Number(el.dataset.valor));
    },
    precioPaso(el, m) {
      const h = hojaDe(el);
      cambiarPrecio(m, h, borrador(m, h).precio + Number(el.dataset.valor));
    },
    teclado(el, m) {
      const h = hojaDe(el);
      const b = borrador(m, h);
      b.tecleo = b.tecleo === null ? '' : null;
      if (b.tecleo === '') b.precio = 0;
      if (b.tecleo === null && b.precio === 0) b.precio = b.base;
      pintarPrecio(m, h);
      // En pantallas bajas, que el teclado quede a la vista (con el importe arriba).
      if (b.tecleo === '') $(m.pantalla(h), '[data-de-teclado-caja]')?.scrollIntoView({ block: 'nearest', behavior: m.reducido ? 'auto' : 'smooth' });
    },
    tecla(el, m) {
      const id = idDe(el);
      if (id === 'e-adicional') {
        const s = adSel(m);
        const v = el.dataset.valor ?? '';
        s.tecleo = v === 'borrar' ? s.tecleo.slice(0, -1) : s.tecleo.length < 7 ? (s.tecleo + v).replace(/^0+/, '') : s.tecleo;
        pintarAdicional(m);
        return;
      }
      if (esHojaPrecio(id)) tecla(m, id, el.dataset.valor ?? '');
    },
    franja(el, m) {
      const h = hojaDe(el);
      const b = borrador(m, h);
      b.franja = Number(el.dataset.valor);
      b.hora = undefined;
      if (h === 'e-precio') b.fecha = undefined;
      pintarPrecio(m, h);
    },
    cuandoFecha(el, m) {
      const id = idDe(el);
      if (id === 'e-cambiar-fecha') {
        const c = cambio(m);
        const t = vigente(m, c.turno);
        est(m).guiaFecha = sumarDias(t.fecha, 7);
        pedirFecha(m, {
          valor: c.fechaCal ? c.fecha : undefined,
          alElegir: (f) => {
            c.fecha = f;
            c.fechaCal = true;
            delete est(m).guiaFecha;
            pintarCambio(m);
          },
        });
        return;
      }
      if (esHojaPrecio(id)) elegirFecha(m, id);
    },
    cuandoHora(el, m) {
      const id = idDe(el);
      if (id === 'e-cambiar-fecha') {
        const c = cambio(m);
        pedirHora(m, {
          valor: c.hora ?? { h: 9, m: 0 },
          alElegir: (h) => {
            c.hora = h;
            pintarCambio(m);
          },
        });
        return;
      }
      if (esHojaPrecio(id)) elegirHora(m, id);
    },
    ponerPrecio(el, m) {
      const h = hojaDe(el);
      const b = borrador(m, h);
      if (!precioValido(b)) return;
      if (h === 'e-precio-programado') {
        const e = est(m);
        if (e.borradores) delete e.borradores['e-precio-programado'];
        m.volver();
        enviarProgramado(m, b.precio, b);
        return;
      }
      enviarPresupuesto(m, b);
      m.ir('e-aceptado');
    },
    simular(el, m) {
      est(m).sim = el.dataset.valor === 'rechaza' ? 'rechaza' : 'acepta';
      pintarSimuladores(m);
    },

    // Llegada
    ubicacion(el, m) {
      const l = llegada(m);
      if (el.dataset.valor === 'no') {
        l.modo = 'sin-permiso';
        aplicarLlegada(m, { tipo: 'permiso', concedido: false });
        return;
      }
      l.modo = 'normal';
      aplicarLlegada(m, { tipo: 'permiso', concedido: true });
      l.i = Math.max(l.i, 1);
      programarViaje(m);
    },
    simularUbicacion(el, m) {
      const l = llegada(m);
      if (l.estado === 'llego') return;
      const v = el.dataset.valor ?? 'normal';
      l.modo = v;
      l.tok++;
      if (v === 'sin-permiso') {
        l.estado = 'pidiendo-permiso';
        aplicarLlegada(m, { tipo: 'permiso', concedido: false });
        return;
      }
      if (v === 'normal') {
        if (l.estado === 'sin-permiso' || l.estado === 'pidiendo-permiso') {
          l.estado = 'pidiendo-permiso';
          pintarLlegada(m);
          return;
        }
        aplicarLlegada(m, { tipo: 'posicion', dentroDeLaZona: false, precisa: true });
        l.i = Math.max(l.i, 1);
        programarViaje(m);
        return;
      }
      if (!seguidos.includes(l.estado)) aplicarLlegada(m, { tipo: 'permiso', concedido: true });
      l.i = Math.max(l.i, 1);
      aplicarLlegada(m, v === 'sin-senal' ? { tipo: 'sin-senal' } : { tipo: 'posicion', dentroDeLaZona: false, precisa: false });
    },

    // Chat
    abrirChat(el, m) {
      const id = el.dataset.valor ?? 'perla';
      if (!(id in CHATS)) return;
      const e = est(m);
      e.chat = id;
      e.chatDesdeTurno = idDe(el) === 'e-turno-detalle';
      marcarLeido(m, id);
      const destino = el.dataset.ir ?? 'e-conversacion';
      if (destino !== 'e-chat-nuevo') pintarChat(m, m.pantalla(destino), id);
    },
    rapida(el, m) {
      const p = pantallaDe(el);
      if (p) responderRapida(m, p, chatDe(p), Number(el.dataset.valor));
    },
    escribirChat(el, m) {
      const p = pantallaDe(el);
      if (!p) return;
      const id = chatDe(p);
      const libres = libresDe(m, id);
      if (!libres.length) return;
      const e = est(m);
      const actual = e.borradorChat?.[id];
      const sig = actual !== undefined && libres.includes(actual) ? libres[(libres.indexOf(actual) + 1) % libres.length] : libres[0];
      e.borradorChat = { ...e.borradorChat, [id]: sig };
      pintarControlesChat(m, p, id);
    },
    enviarChat(el, m) {
      const p = pantallaDe(el);
      if (!p) return;
      const id = chatDe(p);
      const libres = libresDe(m, id);
      const borr = est(m).borradorChat?.[id];
      const i = borr !== undefined && libres.includes(borr) ? borr : libres[0];
      if (i !== undefined) responderRapida(m, p, id, i);
    },
    adjuntar(el, m) {
      const p = pantallaDe(el);
      if (p) alChat(m, chatDe(p), { t: 'foto' });
    },
    'chat-programar'(el, m) {
      const p = pantallaDe(el);
      if (p) abrirPropuesta(m, 'programar', chatDe(p), p.dataset.pantalla ?? 'e-chat');
    },
    'chat-ahora'(el, m) {
      const p = pantallaDe(el);
      if (p) abrirPropuesta(m, 'ahora', chatDe(p), p.dataset.pantalla ?? 'e-chat');
    },
    cotizar(el, m) {
      const p = pantallaDe(el);
      if (p) abrirPropuesta(m, 'cotizar', chatDe(p), p.dataset.pantalla ?? 'e-chat-nuevo', el.dataset.valor);
    },
    mandarPropuesta(_el, m) {
      mandarPropuesta(m);
    },

    // Trabajo
    abrirAdicional(_el, m) {
      est(m).adSel = { op: null, tipo: 'material', tecleo: '', desc: '' };
    },
    adicionalOp(el, m) {
      const s = adSel(m);
      s.op = el.dataset.valor ?? null;
      pintarAdicional(m);
      if (s.op === 'personalizada') m.timeout(() => $<HTMLInputElement>(m.pantalla('e-adicional'), '[data-de-adicional-desc]')?.focus({ preventScroll: false }), 50);
    },
    adicionalTipo(el, m) {
      adSel(m).tipo = el.dataset.valor === 'mano' ? 'mano' : 'material';
      pintarAdicional(m);
    },
    mandarAdicional(_el, m) {
      mandarAdicional(m);
    },
    confirmarCancelar(_el, m) {
      const e = est(m);
      if (!m.pantalla('e-trabajo').hidden) {
        e.trabajo = 'cancelado';
        nuevoTrabajo(e);
        m.raiz('e-inicio');
        pintarDependientes(m);
      } else if (!m.pantalla('e-turno-detalle').hidden) {
        e.cancelados = [...new Set([...(e.cancelados ?? []), turnoActual(m)])];
        m.volver();
        pintarDetalle(m);
        pintarTurnos(m);
      } else {
        m.volver();
      }
    },

    // Agenda y fecha
    verTurno(el, m) {
      const id = el.dataset.valor ?? '';
      if (!trabajoPorId(m, id)) return;
      est(m).turno = id;
      pintarDetalle(m);
    },
    motivo(el, m) {
      cambio(m).motivo = Number(el.dataset.valor);
      pintarCambio(m);
    },
    mensajeCambio(_el, m) {
      cambio(m).mensaje = true;
      pintarCambio(m);
    },
    semanaPaso(el, m) {
      const c = cambio(m);
      const dir = Number(el.dataset.valor) > 0 ? 1 : -1;
      let n = sumarDias(c.fecha, 7 * dir);
      if (esPasada(n, HOY)) n = HOY;
      if (n === c.fecha) return;
      c.fecha = n;
      pintarCambio(m);
      animar(m, $(m.pantalla('e-cambiar-fecha'), '[data-de-semana]'), [{ opacity: 0, transform: `translateX(${dir * 1.5}em)` }, { opacity: 1, transform: 'none' }], 320);
    },
    elegirDia(el, m) {
      const f = el.dataset.valor ?? '';
      if (!f || esPasada(f, HOY)) return;
      cambio(m).fecha = f;
      pintarCambio(m);
    },
    franjaElegir(el, m) {
      const c = cambio(m);
      c.franja = Number(el.dataset.valor);
      c.hora = null;
      pintarCambio(m);
    },
    proponerFecha(_el, m) {
      proponerCambio(m);
    },

    // Notificaciones
    quitarNotif(el, m) {
      const n = el.closest<HTMLElement>('.de-notif');
      if (!n) return;
      const fin = () => {
        n.hidden = true;
        n.dataset.deBorrado = '';
        pintarAvisos(m);
      };
      if (m.reducido || typeof n.animate !== 'function') return fin();
      n.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(60%)' }], { duration: 260, easing: CURVA }).finished.then(fin, () => undefined);
    },
    borrarNotifs(_el, m) {
      $$(m.pantalla('e-notificaciones'), '.de-notif').forEach((n) => {
        n.hidden = true;
        n.dataset.deBorrado = '';
      });
      pintarAvisos(m);
    },
    notifToggle(el) {
      el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true'));
    },
    notifTodas(el, m) {
      const on = el.dataset.valor === '1';
      $$(m.pantalla('e-config-notificaciones'), '[data-accion="notifToggle"]').forEach((b) => b.setAttribute('aria-checked', String(on)));
    },

    // Pedido programado
    aceptarProgramado(_el, m) {
      enviarProgramado(m, d.programado.sugerido);
    },
    rechazarProgramado(_el, m) {
      est(m).programado = 'rechazado';
      pintarProgramado(m, true);
      m.anunciar(d.programado.rechazadoTexto);
    },

    // Cuenta
    toggleRubro(el, m) {
      const activos = $$(m.pantalla('e-rubros'), '[data-accion="toggleRubro"][aria-pressed="true"]');
      const activo = el.getAttribute('aria-pressed') === 'true';
      if (activo && activos.length <= 1) {
        latido(m, el);
        return;
      }
      el.setAttribute('aria-pressed', String(!activo));
    },
    toggleZona(el) {
      el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true'));
    },
    guardarRubros(_el, m) {
      const el = m.pantalla('e-rubros');
      const e = est(m);
      e.rubros = $$(el, '[data-accion="toggleRubro"][aria-pressed="true"]').map((b) => b.dataset.valor ?? '');
      e.zonas = $$(el, '[data-accion="toggleZona"][aria-pressed="true"]').map((b) => Number(b.dataset.valor));
      pintarCuenta(m);
    },
    salir(_el, m) {
      const e = est(m);
      e.disponible = false;
      e.pedido = 'nada';
      e.token = (e.token ?? 0) + 1;
      m.raiz('e-inicio');
    },

    // Cobros y ayuda
    verMas(el) {
      const tarjeta = el.closest<HTMLElement>('.de-mov');
      const detalle = tarjeta && $(tarjeta, '[data-de-mov-desglose]');
      if (tarjeta && detalle) abrirTarjeta(tarjeta, detalle.hidden !== false);
    },
    pregunta(el) {
      const respuesta = el.nextElementSibling as HTMLElement | null;
      if (!respuesta) return;
      const abrir = respuesta.hidden;
      respuesta.hidden = !abrir;
      el.setAttribute('aria-expanded', String(abrir));
    },
    escribirCbu(_el, m) {
      const e = est(m);
      const actual = e.cbu ?? '';
      if (actual.length >= CBU_LARGO) return;
      e.cbu = d.cobro.cbuEjemplo.slice(0, Math.min(CBU_LARGO, actual.length + d.cobro.cbuTramo));
      errorCbu(m, false);
      pintarCobro(m);
    },
    borrarCbu(_el, m) {
      est(m).cbu = '';
      errorCbu(m, false);
      pintarCobro(m);
    },
    guardarCobro(_el, m) {
      const cbu = est(m).cbu ?? '';
      if (cbu.length && cbu.length !== CBU_LARGO) {
        errorCbu(m, true);
        m.anunciar(completar(d.cobro.error, { n: cbu.length }));
        return;
      }
      errorCbu(m, false);
      pintarCaja(m);
      m.volver();
      m.isla({ titulo: d.cobro.listo, texto: d.cobro.listoTexto, icono: 'billetera', tono: 'exito' });
    },
    verErrorCobro(_el, m) {
      m.error('cobro');
    },
  },

  entrar: {
    'e-inicio'(_el, m) {
      pintarInicio(m);
      if (esperaPedido(est(m))) programarPedido(m);
    },
    'e-precio'(_el, m) {
      const e = est(m);
      if (!(e.disponible && e.pedido === 'visible')) {
        e.disponible = true;
        e.pedido = 'visible';
        e.token = (e.token ?? 0) + 1;
        pintarInicio(m);
      }
      pintarPrecio(m, 'e-precio');
    },
    'e-precio-programado'(_el, m) {
      pintarPrecio(m, 'e-precio-programado');
    },
    'e-propuesta'(_el, m) {
      pintarPropuesta(m);
    },
    'e-aceptado'(_el, m) {
      const e = est(m);
      e.disponible ??= true;
      e.atendido = true;
      if (!e.trabajo || e.trabajo === 'cancelado') e.trabajo = 'enviado';
      pintarDisponible(m);
      pintarAceptado(m);
      if (!e.elegido && e.aceptado !== 'rechazado') m.timeout(() => ((e.respuestaHoy ?? 'acepta') === 'rechaza' ? noElegido(m) : elegir(m)), 2800);
    },
    'e-en-camino'(el, m) {
      yaElegido(m);
      poner(el, '[data-de-franja]', horarioHoy(m));
      const l = llegada(m);
      pintarLlegada(m);
      if (l.modo === 'normal' && seguidos.includes(l.estado)) programarViaje(m);
    },
    'e-chat'(el, m) {
      yaElegido(m);
      est(m).chatDesdeTurno = false;
      marcarLeido(m, 'perla');
      pintarChat(m, el, 'perla');
    },
    'e-conversacion'(el, m) {
      const id = est(m).chat ?? 'perla';
      marcarLeido(m, id);
      pintarChat(m, el, id === NUEVO ? 'perla' : id);
    },
    'e-chat-nuevo'(el, m) {
      marcarLeido(m, NUEVO);
      est(m).chatDesdeTurno = false;
      pintarChat(m, el, NUEVO);
      llegaSolicitud(m, el);
    },
    'e-trabajo'(_el, m) {
      const e = est(m);
      yaElegido(m);
      const l = llegada(m);
      l.estado = 'llego';
      l.navego = true;
      if (!e.inicioTrabajo) e.inicioTrabajo = Date.now();
      pintarTrabajo(m);
      pintarCrono(m);
      m.intervalo(() => pintarCrono(m), 1000);
    },
    'e-adicional'(el, m) {
      pintarAdicional(m);
      const input = $<HTMLInputElement>(el, '[data-de-adicional-desc]');
      if (!input) return;
      const alEscribir = () => {
        adSel(m).desc = input.value;
        pintarAdicional(m);
      };
      input.addEventListener('input', alEscribir);
      return () => input.removeEventListener('input', alEscribir);
    },
    'e-fin'(el, m) {
      const e = est(m);
      yaElegido(m);
      e.trabajo = 'terminado';
      pintarFin(m);
      pintarCaja(m);
      pintarAvisos(m);
      pintarHoyAgenda(m);
      const ganaste = $(el, '[data-de-ganaste]');
      if (ganaste) m.contar(ganaste, netoHoy(m), { desde: 0, ms: 1500 });
      if (!e.festejado) {
        e.festejado = true;
        m.timeout(() => m.confeti(), 450);
        m.timeout(() => m.isla({ titulo: d.fin.isla.titulo, texto: completar(d.fin.isla.texto, { monto: pesosJuntos(netoHoy(m)) }), icono: 'billetera', tono: 'exito' }), 1300);
      }
    },
    'e-turnos'(_el, m) {
      const e = est(m);
      pintarTurnos(m);
      pintarHoyAgenda(m);
      if (!e.recordatorio) {
        e.recordatorio = true;
        m.timeout(() => m.isla({ titulo: d.turnos.isla.titulo, texto: d.turnos.isla.texto, icono: 'calendario' }), 1100);
      }
    },
    'e-turno-detalle'(_el, m) {
      pintarDetalle(m);
    },
    'e-cambiar-fecha'(_el, m) {
      const e = est(m);
      const id = turnoActual(m);
      const t = trabajoPorId(m, id);
      // Un turno cancelado o terminado no se reprograma: se usa el primero que sigue en pie.
      if (!t || cancelado(m, id) || t.estado !== 'confirmado') {
        const libre = TRABAJOS.find((x) => x.estado === 'confirmado' && !cancelado(m, x.id));
        if (libre) e.turno = libre.id;
      }
      pintarCambio(m);
    },
    'e-notificaciones'(_el, m) {
      pintarAvisos(m);
    },
    'e-pedido-programado'(_el, m) {
      pintarDisponible(m);
      pintarProgramado(m);
      if (est(m).programado === 'enviado') programarRespuestaProgramado(m);
    },
    'e-cuenta'(_el, m) {
      pintarCuenta(m);
    },
    'e-rubros'(_el, m) {
      pintarRubros(m);
    },
    'e-caja'(_el, m) {
      pintarCaja(m);
    },
    'e-mensajes'(_el, m) {
      pintarMensajes(m);
    },
    'e-editar-cobro'(_el, m) {
      errorCbu(m, false);
      pintarCobro(m);
    },
  },

  // Después de las piezas comunes: la guía de las hojas de fecha y hora, la de la agenda y las respuestas pendientes.
  cualquiera(el, m) {
    const id = el.dataset.pantalla;
    if (el.querySelector('[data-accion="simular"]')) pintarSimuladores(m);
    asegurarRespuestas(m, 1800);
    if (id === 'e-turnos') guiaAgenda(el, m);
    if (id === 'e-elegir-fecha') {
      const f = est(m).guiaFecha;
      const b = f ? $(el, `.hd-cal__dia[data-valor="${f}"]:not(:disabled)`) : null;
      if (b && b.getAttribute('aria-pressed') !== 'true') m.guia(b);
    }
    if (id === 'e-elegir-hora') {
      const listo = $(el, '[data-hd-sel-listo]');
      const h = est(m).guiaHora;
      const op = h !== undefined ? $(el, `[data-accion="hd-hora-op"][data-tipo="h"][data-valor="${h}"]`) : null;
      m.guia(op && op.getAttribute('aria-selected') !== 'true' ? op : listo);
      const alTocar = (ev: Event) => {
        if ((ev.target as Element).closest?.('[data-accion="hd-hora-op"]')) window.setTimeout(() => m.guia(listo), 0);
      };
      el.addEventListener('click', alTocar);
      return () => el.removeEventListener('click', alTocar);
    }
  },

  // "Volver a empezar": todas las pantallas del especialista vuelven a como salieron del build.
  reiniciar() {
    const pantallas = document.querySelectorAll<HTMLElement>('.demo-pantalla[data-rol="especialista"]');
    if (!originales) {
      originales = new Map();
      pantallas.forEach((p) => originales!.set(p.dataset.pantalla ?? '', p.innerHTML));
      return;
    }
    pantallas.forEach((p) => {
      const html = originales!.get(p.dataset.pantalla ?? '');
      if (html !== undefined) p.innerHTML = html;
    });
  },
});
