// Demo · comportamiento del lado del especialista: el interruptor "Disponible" y el pedido que entra,
// el precio que elegís (fluye al aviso, al trabajo, al fin y a la caja), el cliente que te elige,
// el chat con respuestas rápidas, el cronómetro y los repuestos, la agenda, el cambio de fecha,
// los avisos y la cuenta. Todos los textos salen de src/content/demo-especialista.json.

import '../../styles/demo-especialista.css';
import d from '../../content/demo-especialista.json';
import { registrarRol, type Motor } from './motor';
import { TARIFAS, completar, formatoPesos, netoEspecialista, retencionEspecialista } from './util';

type IdChat = keyof typeof d.chats;

interface Borrador {
  origen: 'inicio' | 'programado';
  base: number;
  precio: number;
  franja: number;
}

interface Cambio {
  turno: number;
  dia: number;
  franja: number;
  motivo: number | null;
  enviado: boolean;
}

interface Estado {
  disponible?: boolean;
  pedido?: 'nada' | 'visible';
  rechazado?: boolean;
  token?: number;
  precio?: number;
  franja?: number;
  borrador?: Borrador;
  elegido?: boolean;
  inicioTrabajo?: number;
  extras?: number[];
  chat?: IdChat;
  usadas?: Partial<Record<IdChat, number[]>>;
  leidos?: IdChat[];
  turno?: number;
  cancelados?: number[];
  cambio?: Cambio;
  programado?: 'enviado' | 'rechazado';
  precioProgramado?: number;
  rubros?: string[];
  zonas?: number[];
}

const est = (m: Motor) => m.estado as Estado;
const C = d.comun;
const SUGERIDO = TARIFAS.ejemplo.presupuesto;
const VARS = { tarifaEspecialista: `${TARIFAS.normal.especialista}%` };
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const pesos = formatoPesos;

// ── Utilidades ────────────────────────────────────────────────────────────

const $ = <T extends Element = HTMLElement>(raiz: ParentNode, sel: string) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(raiz: ParentNode, sel: string) => [...raiz.querySelectorAll<T>(sel)];

function poner(raiz: ParentNode, sel: string, texto: string) {
  const el = $(raiz, sel);
  if (el && el.textContent !== texto) el.textContent = texto;
}

function animar(m: Motor, el: Element | null | undefined, frames: Keyframe[], ms = 380) {
  if (!el || m.reducido || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(frames, { duration: ms, easing: CURVA });
}

const aparecer = (m: Motor, el: Element | null | undefined) =>
  animar(m, el, [
    { opacity: 0, transform: 'translateY(0.7em) scale(0.98)' },
    { opacity: 1, transform: 'none' },
  ]);

const latido = (m: Motor, el: Element | null | undefined) =>
  animar(m, el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], 320);

const dos = (n: number) => String(n).padStart(2, '0');
const fecha = (dia: number) => new Date(Number(C.anio), C.mesNumero - 1, dia);
const diaSemana = (dia: number) => C.dias[fecha(dia).getDay()];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaCorta = (dia: number) => `${dos(dia)}/${dos(C.mesNumero)}`;
const fechaLarga = (dia: number) => `${fechaCorta(dia)}/${C.anio}`;
const esDomingo = (dia: number) => fecha(dia).getDay() === 0;

/** Día hábil (lunes a sábado) siguiente o anterior a `dia`, dentro del mes y después de hoy. */
function moverDia(dia: number, paso: 1 | -1): number {
  let n = dia + paso;
  while (n > C.hoy && n <= 30 && esDomingo(n)) n += paso;
  return n > C.hoy && n <= 30 ? n : dia;
}

function fila(izq: string, der: string, clase = ''): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = `de-fila ${clase}`.trim();
  const a = document.createElement('span');
  a.textContent = izq;
  const b = document.createElement('strong');
  b.textContent = der;
  p.append(a, b);
  return p;
}

/** Igual que el desglose del build: presupuesto (+ repuestos) − tarifa = recibís / a tu cuenta. */
function desglose(cont: HTMLElement, presupuesto: number, extras: number, ultimo: string) {
  const total = presupuesto + extras;
  const filas = [fila(C.presupuesto, pesos(presupuesto))];
  if (extras) filas.push(fila(C.repuestos, `+ ${pesos(extras)}`));
  filas.push(fila(completar(C.tarifa, VARS), `− ${pesos(retencionEspecialista(total))}`, 'de-fila--resta'));
  filas.push(fila(ultimo, pesos(netoEspecialista(total)), 'de-fila--total'));
  cont.replaceChildren(...filas);
}

// ── El trabajo de hoy (lo que eligió el especialista) ─────────────────────

const precioHoy = (m: Motor) => est(m).precio ?? SUGERIDO;
const franjaHoy = (m: Motor) => d.precio.franjas[est(m).franja ?? 0] ?? d.precio.franjas[0];
const extrasHoy = (m: Motor) => (est(m).extras ?? []).reduce((s, i) => s + (d.trabajo.extras[i]?.monto ?? 0), 0);
const totalHoy = (m: Motor) => precioHoy(m) + extrasHoy(m);

function nuevoTrabajo(e: Estado) {
  e.elegido = false;
  e.inicioTrabajo = undefined;
  e.extras = [];
  e.pedido = 'nada';
}

// ── Inicio: disponible → buscando → pedido ───────────────────────────────

function pintarInicio(m: Motor, nuevo = false) {
  const el = m.pantalla('e-inicio');
  const e = est(m);
  const i = d.inicio;
  const on = !!e.disponible;
  const conPedido = on && e.pedido === 'visible';

  const sw = $(el, '[data-accion="disponible"]');
  if (sw) {
    sw.setAttribute('aria-checked', String(on));
    sw.classList.toggle('de-disponible--apagado', !on);
    sw.toggleAttribute('data-guia', !on);
    poner(sw, '[data-de-disp-texto]', on ? C.disponible : C.noDisponible);
  }
  const mapa = $(el, '[data-de-mapa]');
  mapa?.classList.toggle('de-mapa--apagado', !on);
  mapa?.classList.toggle('de-mapa--buscando', on && !conPedido);
  mapa?.classList.toggle('de-mapa--pedido', conPedido);

  const estado = $(el, '[data-de-estado]');
  if (estado) {
    estado.hidden = conPedido;
    estado.classList.toggle('de-estado--buscando', on && !conPedido);
    poner(estado, '[data-de-estado-titulo]', on ? i.buscandoTitulo : i.apagadoTitulo);
    poner(estado, '[data-de-estado-texto]', on ? (e.rechazado ? i.rechazadoTexto : i.buscandoTexto) : i.apagadoTexto);
  }
  const tarjeta = $(el, '[data-de-pedido]');
  if (tarjeta) tarjeta.hidden = !conPedido;
  const toast = $(el, '[data-de-toast]');
  if (toast && !conPedido) toast.hidden = true;

  if (nuevo && conPedido) {
    animar(m, tarjeta, [{ transform: 'translateY(115%)' }, { transform: 'none' }], 520);
    animar(m, $(el, '[data-de-pin-cliente]'), [
      { transform: 'translateY(-36px)', opacity: 0 },
      { transform: 'translateY(2px)', opacity: 1, offset: 0.75 },
      { transform: 'none', opacity: 1 },
    ], 560);
    if (toast) {
      toast.hidden = false;
      aparecer(m, toast);
      m.timeout(() => (toast.hidden = true), 2800);
    }
  }
}

/** El pedido entra un rato después de ponerte disponible (si seguís disponible). */
function programarPedido(m: Motor) {
  const e = est(m);
  const token = (e.token = (e.token ?? 0) + 1);
  m.timeout(() => {
    if (est(m) !== e || e.token !== token || !e.disponible) return;
    e.pedido = 'visible';
    e.rechazado = false;
    pintarInicio(m, true);
    m.anunciar(d.inicio.anuncio);
    m.guia(null);
  }, 1800);
}

// ── Hoja de precio ────────────────────────────────────────────────────────

const origenPrecio = (m: Motor): Borrador['origen'] => (m.pantalla('e-pedido-programado').hidden ? 'inicio' : 'programado');

function borrador(m: Motor): Borrador {
  const e = est(m);
  const origen = origenPrecio(m);
  if (!e.borrador || e.borrador.origen !== origen) {
    const base = origen === 'inicio' ? SUGERIDO : d.programado.sugerido;
    e.borrador = { origen, base, precio: base, franja: origen === 'inicio' ? (e.franja ?? 0) : 0 };
  }
  return e.borrador;
}

function pintarPrecio(m: Motor) {
  const el = m.pantalla('e-precio');
  const b = borrador(m);
  poner(el, '[data-de-sugerido]', pesos(b.base));
  poner(el, '[data-de-precio]', pesos(b.precio));
  poner(el, '[data-de-recibis]', pesos(netoEspecialista(b.precio)));
  poner(el, '[data-de-retiene]', completar(d.precio.retiene, { ...VARS, monto: pesos(retencionEspecialista(b.precio)) }));

  const marcar = (btn: HTMLElement, activo: boolean) => {
    btn.setAttribute('aria-pressed', String(activo));
    btn.classList.toggle('app-chip--activo', activo);
  };
  $$(el, '[data-accion="precioSugerido"]').forEach((btn) => marcar(btn, b.precio === b.base));
  $$(el, '[data-accion="precioSumar"]').forEach((btn, i) => {
    marcar(btn, b.precio === b.base + Number(btn.dataset.valor));
    // La guía propone subir el precio mientras sigas con el sugerido.
    btn.toggleAttribute('data-guia', i === 0 && b.precio === b.base);
  });
  const franjas = $(el, '[data-de-franjas]');
  if (franjas) franjas.hidden = b.origen !== 'inicio';
  $$(el, '[data-accion="franja"]').forEach((btn) => marcar(btn, Number(btn.dataset.valor) === b.franja));
}

function cambiarPrecio(m: Motor, precio: number) {
  const b = borrador(m);
  b.precio = Math.max(d.precio.minimo, Math.round(precio));
  pintarPrecio(m);
  latido(m, $(m.pantalla('e-precio'), '[data-de-recibis]'));
}

// ── Presupuesto enviado → elegido ─────────────────────────────────────────

function pintarAceptado(m: Motor) {
  const el = m.pantalla('e-aceptado');
  const e = est(m);
  const a = d.aceptado;
  poner(el, '[data-de-precio]', pesos(precioHoy(m)));
  poner(el, '[data-de-franja]', franjaHoy(m).texto);
  poner(el, '[data-de-recibis]', pesos(netoEspecialista(precioHoy(m))));
  poner(el, '[data-de-enviado-titulo]', e.elegido ? a.elegidoTitulo : a.titulo);
  const esperando = $(el, '[data-de-esperando]');
  if (esperando) esperando.hidden = !!e.elegido;
  const ir = $(el, '[data-de-ir-alla]');
  if (ir) ir.hidden = !e.elegido;
  const aviso = $(el, '[data-de-elegido-aviso]');
  if (aviso) aviso.hidden = !e.elegido;
}

function elegir(m: Motor) {
  const e = est(m);
  if (e.elegido) return;
  e.elegido = true;
  pintarAceptado(m);
  const el = m.pantalla('e-aceptado');
  animar(m, $(el, '[data-de-elegido-aviso]'), [
    { opacity: 0, transform: 'translateY(-1.2em)' },
    { opacity: 1, transform: 'none' },
  ], 460);
  aparecer(m, $(el, '[data-de-ir-alla]'));
  m.anunciar(d.aceptado.anuncio);
  m.guia(null);
}

// ── Chat ──────────────────────────────────────────────────────────────────

const chatActual = (m: Motor): IdChat => est(m).chat ?? 'perla';
const usadasDe = (m: Motor, id: IdChat) => est(m).usadas?.[id] ?? [];

function burbuja(texto: string, propia: boolean): HTMLDivElement {
  const b = document.createElement('div');
  b.className = `app-burbuja ${propia ? 'app-burbuja--propia' : 'app-burbuja--otra'}`;
  const s = document.createElement('span');
  s.textContent = texto;
  b.append(s);
  return b;
}

function ultimoMensaje(m: Motor, id: IdChat): string {
  const usadas = usadasDe(m, id);
  const ch = d.chats[id];
  if (usadas.length) return ch.rapidas[usadas[usadas.length - 1]].respuesta;
  return ch.mensajes[ch.mensajes.length - 1].texto;
}

function marcarLeido(m: Motor, id: IdChat) {
  const e = est(m);
  e.leidos = [...new Set([...(e.leidos ?? []), id])];
}

function pintarChat(m: Motor) {
  const el = m.pantalla('e-chat');
  const id = chatActual(m);
  const ch = d.chats[id];
  const caja = $(el, '[data-de-chat]');
  if (!caja) return;
  caja.dataset.deChat = id;
  poner(el, '[data-de-chat-nombre]', ch.nombre);
  poner(el, '[data-de-chat-sub]', ch.sub);

  const usadas = usadasDe(m, id);
  const mensajes = $(el, '[data-de-mensajes]');
  const plantilla = $<HTMLTemplateElement>(el, `template[data-de-plantilla="${id}"]`);
  if (mensajes && plantilla) {
    mensajes.replaceChildren(plantilla.content.cloneNode(true));
    usadas.forEach((i) => mensajes.append(burbuja(ch.rapidas[i].texto, true), burbuja(ch.rapidas[i].respuesta, false)));
  }

  const rapidas = $(el, '[data-de-rapidas]');
  if (rapidas) {
    const libres = ch.rapidas.map((r, i) => ({ r, i })).filter(({ i }) => !usadas.includes(i));
    rapidas.replaceChildren(
      ...libres.map(({ r, i }, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'app-accion de-rapida';
        b.dataset.accion = 'rapida';
        b.dataset.valor = String(i);
        if (n === 0 && usadas.length === 0) b.setAttribute('data-guia', '');
        b.textContent = r.chip;
        return b;
      }),
    );
    rapidas.hidden = libres.length === 0;
  }

  const llegue = $(el, '[data-de-llegue]');
  if (llegue) {
    llegue.hidden = id !== 'perla';
    llegue.toggleAttribute('data-guia', id === 'perla' && usadas.length > 0);
  }
  const verTurno = $(el, '[data-de-ver-turno]');
  if (verTurno) {
    verTurno.hidden = id === 'perla';
    verTurno.dataset.valor = String(Math.max(0, ch.turno));
  }
}

// ── Trabajo en curso ──────────────────────────────────────────────────────

function pintarCrono(m: Motor) {
  const e = est(m);
  const s = Math.max(0, Math.floor((Date.now() - (e.inicioTrabajo ?? Date.now())) / 1000));
  poner(m.pantalla('e-trabajo'), '[data-de-crono]', `${dos(Math.floor(s / 60))}:${dos(s % 60)}`);
}

function pintarTrabajo(m: Motor) {
  const el = m.pantalla('e-trabajo');
  const e = est(m);
  const t = d.trabajo;
  const f = franjaHoy(m);
  poner(el, '[data-de-franja-dia]', f.dia);
  poner(el, '[data-de-franja-corta]', f.corto);

  const extras = e.extras ?? [];
  const siguiente = t.extras.findIndex((_, i) => !extras.includes(i));
  poner(el, '[data-de-extra-nombre]', siguiente >= 0 ? t.extras[siguiente].nombre : t.sinMas);
  poner(el, '[data-de-extra-monto]', siguiente >= 0 ? pesos(t.extras[siguiente].monto) : '');
  const monto = $(el, '[data-de-extra-monto]');
  if (monto) monto.hidden = siguiente < 0;
  const agregar = $<HTMLButtonElement>(el, '[data-accion="agregarExtra"]');
  if (agregar) {
    agregar.disabled = siguiente < 0;
    agregar.toggleAttribute('data-guia', extras.length === 0);
  }

  const costo = $(el, '[data-de-costo]');
  const plantilla = $<HTMLTemplateElement>(el, 'template[data-de-plantilla-quitar]');
  if (!costo) return;
  const total = totalHoy(m);
  const filas: HTMLElement[] = [fila(C.presupuesto, pesos(precioHoy(m)))];
  extras.forEach((i) => {
    const x = t.extras[i];
    const p = fila(x.nombre, `+ ${pesos(x.monto)}`, 'de-fila--extra');
    const quitar = plantilla?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    if (quitar) {
      quitar.dataset.valor = String(i);
      quitar.setAttribute('aria-label', completar(t.quitar, { nombre: x.nombre }));
      p.firstElementChild?.prepend(quitar);
    }
    filas.push(p);
  });
  filas.push(fila(completar(C.tarifa, VARS), `− ${pesos(retencionEspecialista(total))}`, 'de-fila--resta'));
  filas.push(fila(C.recibis, pesos(netoEspecialista(total)), 'de-fila--total'));
  costo.replaceChildren(...filas);
}

// ── Fin y caja ────────────────────────────────────────────────────────────

function pintarFin(m: Motor) {
  const el = m.pantalla('e-fin');
  poner(el, '[data-de-ganaste]', pesos(netoEspecialista(totalHoy(m))));
  const costo = $(el, '[data-de-costo]');
  if (costo) desglose(costo, precioHoy(m), extrasHoy(m), C.aTuCuenta);
}

function pintarCaja(m: Motor) {
  const hoy = $(m.pantalla('e-caja'), '[data-de-mov-hoy]');
  if (!hoy) return;
  poner(hoy, '[data-de-mov-neto]', `+ ${pesos(netoEspecialista(totalHoy(m)))}`);
  const costo = $(hoy, '[data-de-mov-desglose]');
  if (costo) desglose(costo, precioHoy(m), extrasHoy(m), C.aTuCuenta);
}

// ── Agenda, detalle y cambio de fecha ────────────────────────────────────

const turnoActual = (m: Motor) => Math.min(Math.max(est(m).turno ?? 0, 0), d.turnos.items.length - 1);
const cancelado = (m: Motor, i: number) => (est(m).cancelados ?? []).includes(i);

function pintarTurnos(m: Motor) {
  $$(m.pantalla('e-turnos'), '[data-de-turno]').forEach((card) => {
    const i = Number(card.dataset.deTurno);
    const no = cancelado(m, i);
    card.classList.toggle('de-tarjeta--cancelada', no);
    const tag = $(card, '[data-de-cancelado]');
    if (tag) tag.hidden = !no;
  });
}

function pintarDetalle(m: Motor) {
  const el = m.pantalla('e-turno-detalle');
  const i = turnoActual(m);
  const t = d.turnos.items[i];
  const x = d.detalle;
  poner(el, '[data-de-d="rubro"]', t.rubro);
  poner(el, '[data-de-d="detalle"]', t.detalle);
  poner(el, '[data-de-d="dia"]', mayuscula(diaSemana(t.dia)));
  poner(el, '[data-de-d="fecha"]', fechaLarga(t.dia));
  poner(el, '[data-de-d="franja"]', t.franja);
  poner(el, '[data-de-d="barrio"]', t.barrio);
  $$(el, '[data-de-icono]').forEach((s) => (s.hidden = s.dataset.deIcono !== t.icono));
  const costo = $(el, '[data-de-d="costo"]');
  if (costo) desglose(costo, t.presupuesto, 0, C.recibis);
  const no = cancelado(m, i);
  const estado = $(el, '[data-de-d="estado"]');
  if (estado) {
    estado.textContent = no ? x.cancelado : x.pendiente;
    estado.classList.toggle('de-estado-turno--cancelado', no);
  }
  $$(el, '[data-de-d="acciones"] .app-boton').forEach((b) => (b.hidden = no && !b.matches('[data-de-d="chat"]')));
  const chat = $(el, '[data-de-d="chat"]');
  if (chat) chat.dataset.valor = t.chat;
}

function cambio(m: Motor): Cambio {
  const e = est(m);
  const i = turnoActual(m);
  if (!e.cambio || e.cambio.turno !== i) {
    const t = d.turnos.items[i];
    e.cambio = {
      turno: i,
      dia: moverDia(t.dia, 1),
      franja: Math.max(0, d.cambio.franjas.indexOf(t.franja)),
      motivo: null,
      enviado: false,
    };
  }
  return e.cambio;
}

function pintarCambio(m: Motor) {
  const el = m.pantalla('e-cambiar-fecha');
  const c = cambio(m);
  const x = d.cambio;
  poner(el, '[data-de-cambio-dia]', String(c.dia));
  poner(el, '[data-de-cambio-franja]', x.franjas[c.franja]);
  poner(el, '[data-de-cambio-resumen]', completar(x.resumen, { dia: diaSemana(c.dia), fecha: fechaCorta(c.dia), franja: x.franjas[c.franja] }));
  $$(el, '[data-accion="motivo"]').forEach((b, i) => {
    const activo = Number(b.dataset.valor) === c.motivo;
    b.setAttribute('aria-pressed', String(activo));
    b.classList.toggle('de-motivo--activo', activo);
    b.toggleAttribute('data-guia', i === 0 && c.motivo === null);
  });
  const proponer = $<HTMLButtonElement>(el, '[data-accion="proponerFecha"]');
  if (proponer) {
    proponer.disabled = c.enviado;
    proponer.toggleAttribute('data-guia', !c.enviado);
    proponer.textContent = c.enviado ? x.enviadoBoton : x.proponer;
  }
  const ok = $(el, '[data-de-cambio-ok]');
  if (ok) ok.hidden = !c.enviado;
}

// ── Avisos, pedido programado, cuenta y mensajes ─────────────────────────

function pintarAvisos(m: Motor) {
  const el = m.pantalla('e-notificaciones');
  poner(el, '[data-de-neto]', pesos(netoEspecialista(totalHoy(m))));
  const hay = $$(el, '.de-notif').length > 0;
  const nadaMas = $(el, '[data-de-nada-mas]');
  if (nadaMas) nadaMas.hidden = !hay;
  const vacio = $(el, '[data-de-vacio]');
  if (vacio) vacio.hidden = hay;
  const borrar = $(el, '[data-accion="borrarNotifs"]');
  if (borrar) borrar.hidden = !hay;
}

function pintarProgramado(m: Motor, nuevo = false) {
  const el = m.pantalla('e-pedido-programado');
  const e = est(m);
  const p = d.programado;
  const tarjeta = $(el, '[data-de-programado]');
  if (tarjeta) tarjeta.hidden = !!e.programado;
  const aviso = $(el, '[data-de-programado-aviso]');
  if (aviso) {
    aviso.hidden = !e.programado;
    aviso.classList.toggle('de-aviso--rechazo', e.programado === 'rechazado');
    if (e.programado === 'enviado') {
      poner(aviso, '[data-de-aviso-titulo]', completar(p.enviadoTitulo, { monto: pesos(e.precioProgramado ?? p.sugerido) }));
      poner(aviso, '[data-de-aviso-texto]', p.enviadoTexto);
    } else if (e.programado === 'rechazado') {
      poner(aviso, '[data-de-aviso-titulo]', p.rechazadoTitulo);
      poner(aviso, '[data-de-aviso-texto]', p.rechazadoTexto);
    }
    if (nuevo) aparecer(m, aviso);
  }
  // Después de responder el pedido, la guía sigue por tu cuenta.
  $(el, '.app-nav [data-ir-raiz="e-cuenta"]')?.toggleAttribute('data-guia', !!e.programado);
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
  $$(el, '[data-accion="toggleZona"]').forEach((b) => {
    const activo = zonas.includes(Number(b.dataset.valor));
    b.setAttribute('aria-pressed', String(activo));
    b.classList.toggle('app-chip--activo', activo);
  });
}

function pintarMensajes(m: Motor) {
  const el = m.pantalla('e-mensajes');
  const leidos = est(m).leidos ?? [];
  (d.mensajes.orden as IdChat[]).forEach((id) => {
    poner(el, `[data-de-ultimo="${id}"]`, ultimoMensaje(m, id));
    const badge = $(el, `[data-de-badge="${id}"]`);
    if (badge) badge.hidden = leidos.includes(id);
  });
}

// ── Registro ──────────────────────────────────────────────────────────────

let originales: Map<string, string> | null = null;

registrarRol('especialista', {
  acciones: {
    // Inicio
    disponible(_el, m) {
      const e = est(m);
      e.disponible = !e.disponible;
      e.pedido = 'nada';
      e.rechazado = false;
      e.token = (e.token ?? 0) + 1;
      pintarInicio(m);
      m.anunciar(e.disponible ? d.inicio.anuncioBuscando : d.inicio.anuncioApagado);
      if (e.disponible) programarPedido(m);
    },
    rechazar(_el, m) {
      const e = est(m);
      e.pedido = 'nada';
      e.rechazado = true;
      pintarInicio(m);
      m.anunciar(d.inicio.rechazadoTexto);
      programarPedido(m);
    },
    aceptarSugerido(_el, m) {
      const e = est(m);
      e.precio = SUGERIDO;
      e.franja = 0;
      nuevoTrabajo(e);
    },

    // Precio
    precioSugerido(_el, m) {
      cambiarPrecio(m, borrador(m).base);
    },
    precioSumar(el, m) {
      cambiarPrecio(m, borrador(m).base + Number(el.dataset.valor));
    },
    precioPaso(el, m) {
      cambiarPrecio(m, borrador(m).precio + Number(el.dataset.valor));
    },
    franja(el, m) {
      borrador(m).franja = Number(el.dataset.valor);
      pintarPrecio(m);
    },
    ponerPrecio(_el, m) {
      const e = est(m);
      const b = borrador(m);
      if (b.origen === 'programado') {
        e.precioProgramado = b.precio;
        e.programado = 'enviado';
        m.volver();
        pintarProgramado(m, true);
        m.anunciar(completar(d.programado.enviadoTitulo, { monto: pesos(b.precio) }));
        return;
      }
      e.precio = b.precio;
      e.franja = b.franja;
      nuevoTrabajo(e);
      m.ir('e-aceptado');
    },

    // Avisos sueltos
    cerrarAviso(el) {
      const aviso = el.closest<HTMLElement>('.de-aviso');
      if (aviso) aviso.hidden = true;
    },

    // Chat
    abrirChat(el, m) {
      const id = (el.dataset.valor ?? 'perla') as IdChat;
      if (!(id in d.chats)) return;
      est(m).chat = id;
      marcarLeido(m, id);
      pintarChat(m);
    },
    rapida(el, m) {
      const e = est(m);
      const id = chatActual(m);
      const i = Number(el.dataset.valor);
      const r = d.chats[id].rapidas[i];
      if (!r || usadasDe(m, id).includes(i)) return;
      e.usadas = { ...e.usadas, [id]: [...usadasDe(m, id), i] };
      const pantalla = m.pantalla('e-chat');
      const mensajes = $(pantalla, '[data-de-mensajes]');
      const propia = burbuja(r.texto, true);
      mensajes?.append(propia);
      aparecer(m, propia);
      el.remove();
      const rapidas = $(pantalla, '[data-de-rapidas]');
      if (rapidas) {
        $$(rapidas, '[data-guia]').forEach((b) => b.removeAttribute('data-guia'));
        rapidas.hidden = rapidas.children.length === 0;
      }
      if (id === 'perla') $(pantalla, '[data-de-llegue]')?.setAttribute('data-guia', '');
      // El cliente escribe y responde.
      m.timeout(() => {
        const plantilla = $<HTMLTemplateElement>(pantalla, 'template[data-de-plantilla-escribiendo]');
        const escribiendo = plantilla?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
        if (escribiendo) {
          mensajes?.append(escribiendo);
          aparecer(m, escribiendo);
        }
        m.timeout(() => {
          const respuesta = burbuja(r.respuesta, false);
          if (escribiendo) escribiendo.replaceWith(respuesta);
          else mensajes?.append(respuesta);
          aparecer(m, respuesta);
          m.anunciar(completar(d.chat.anuncio, { texto: r.respuesta }));
        }, 900);
      }, 450);
    },

    // Trabajo
    agregarExtra(_el, m) {
      const e = est(m);
      const extras = e.extras ?? [];
      const siguiente = d.trabajo.extras.findIndex((_, i) => !extras.includes(i));
      if (siguiente < 0) return;
      e.extras = [...extras, siguiente];
      pintarTrabajo(m);
      const el = m.pantalla('e-trabajo');
      aparecer(m, $$(el, '.de-fila--extra').pop());
      latido(m, $(el, '.de-fila--total strong'));
      m.anunciar(completar(d.trabajo.anuncioExtra, { nombre: d.trabajo.extras[siguiente].nombre, monto: pesos(netoEspecialista(totalHoy(m))) }));
    },
    quitarExtra(el, m) {
      const e = est(m);
      const i = Number(el.dataset.valor);
      e.extras = (e.extras ?? []).filter((x) => x !== i);
      pintarTrabajo(m);
    },
    confirmarCancelar(_el, m) {
      const e = est(m);
      if (!m.pantalla('e-trabajo').hidden) {
        nuevoTrabajo(e);
        m.raiz('e-inicio');
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
      est(m).turno = Number(el.dataset.valor) || 0;
      pintarDetalle(m);
      pintarCambio(m);
    },
    motivo(el, m) {
      const c = cambio(m);
      c.motivo = Number(el.dataset.valor);
      c.enviado = false;
      pintarCambio(m);
    },
    diaPaso(el, m) {
      const c = cambio(m);
      c.dia = moverDia(c.dia, Number(el.dataset.valor) > 0 ? 1 : -1);
      c.enviado = false;
      pintarCambio(m);
    },
    franjaPaso(el, m) {
      const c = cambio(m);
      c.franja = Math.min(d.cambio.franjas.length - 1, Math.max(0, c.franja + (Number(el.dataset.valor) > 0 ? 1 : -1)));
      c.enviado = false;
      pintarCambio(m);
    },
    proponerFecha(_el, m) {
      const c = cambio(m);
      c.enviado = true;
      pintarCambio(m);
      aparecer(m, $(m.pantalla('e-cambiar-fecha'), '[data-de-cambio-ok]'));
      m.anunciar(d.cambio.enviado);
    },

    // Notificaciones
    quitarNotif(el, m) {
      const n = el.closest<HTMLElement>('.de-notif');
      if (!n) return;
      if (m.reducido || typeof n.animate !== 'function') {
        n.remove();
        pintarAvisos(m);
        return;
      }
      n.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(40%)' }], { duration: 240, easing: CURVA }).finished.then(
        () => {
          n.remove();
          pintarAvisos(m);
        },
        () => undefined,
      );
    },
    borrarNotifs(_el, m) {
      $$(m.pantalla('e-notificaciones'), '.de-notif').forEach((n) => n.remove());
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
      const e = est(m);
      e.precioProgramado = d.programado.sugerido;
      e.programado = 'enviado';
      pintarProgramado(m, true);
      m.anunciar(completar(d.programado.enviadoTitulo, { monto: pesos(d.programado.sugerido) }));
    },
    rechazarProgramado(_el, m) {
      est(m).programado = 'rechazado';
      pintarProgramado(m, true);
      m.anunciar(d.programado.rechazadoTitulo);
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
      const activo = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(activo));
      el.classList.toggle('app-chip--activo', activo);
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

    // Caja y ayuda
    verMas(el) {
      const tarjeta = el.closest<HTMLElement>('.app-tarjeta');
      const detalle = tarjeta && $(tarjeta, '[data-de-mov-desglose]');
      if (!detalle) return;
      const abrir = detalle.hidden;
      detalle.hidden = !abrir;
      el.setAttribute('aria-expanded', String(abrir));
      el.textContent = abrir ? C.verMenos : C.verMas;
    },
    pregunta(el) {
      const respuesta = el.nextElementSibling as HTMLElement | null;
      if (!respuesta) return;
      const abrir = respuesta.hidden;
      respuesta.hidden = !abrir;
      el.setAttribute('aria-expanded', String(abrir));
    },
  },

  entrar: {
    'e-inicio'(_el, m) {
      pintarInicio(m);
      const e = est(m);
      if (e.disponible && e.pedido !== 'visible') programarPedido(m);
    },
    'e-precio'(_el, m) {
      const e = est(m);
      // Si se llega directo a esta hoja, el pedido tiene que estar a la vista debajo.
      if (origenPrecio(m) === 'inicio' && !(e.disponible && e.pedido === 'visible')) {
        e.disponible = true;
        e.pedido = 'visible';
        e.token = (e.token ?? 0) + 1;
        pintarInicio(m);
      }
      pintarPrecio(m);
    },
    'e-aceptado'(_el, m) {
      pintarAceptado(m);
      if (!est(m).elegido) m.timeout(() => elegir(m), 2600);
    },
    'e-en-camino'(el, m) {
      poner(el, '[data-de-franja]', franjaHoy(m).texto);
    },
    'e-chat'(_el, m) {
      marcarLeido(m, chatActual(m));
      pintarChat(m);
    },
    'e-trabajo'(_el, m) {
      const e = est(m);
      if (!e.inicioTrabajo) e.inicioTrabajo = Date.now();
      pintarTrabajo(m);
      pintarCrono(m);
      m.intervalo(() => pintarCrono(m), 1000);
    },
    'e-fin'(el, m) {
      pintarFin(m);
      const gota = $(el, '[data-de-gota]');
      if (m.reducido || !gota || typeof gota.animate !== 'function') return;
      const a = gota.animate(
        [
          { opacity: 0, transform: 'translateY(-60%) scale(0.3)', offset: 0 },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.32 },
          { opacity: 1, transform: 'translateY(0) scale(0.94, 1.08)', offset: 0.42 },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.52 },
          { opacity: 0, transform: 'translateY(170%) scale(1)', offset: 0.82 },
          { opacity: 0, transform: 'translateY(170%) scale(1)', offset: 1 },
        ],
        { duration: 2800, iterations: Infinity, easing: 'ease-in-out' },
      );
      return () => a.cancel();
    },
    'e-turnos'(_el, m) {
      pintarTurnos(m);
    },
    'e-turno-detalle'(_el, m) {
      pintarDetalle(m);
    },
    'e-cambiar-fecha'(_el, m) {
      pintarCambio(m);
    },
    'e-notificaciones'(_el, m) {
      pintarAvisos(m);
    },
    'e-pedido-programado'(_el, m) {
      pintarProgramado(m);
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
