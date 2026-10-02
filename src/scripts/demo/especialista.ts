// Demo · comportamiento del lado del especialista: el interruptor "Disponible" y el pedido que entra,
// el precio que elegís (fluye al aviso, al trabajo, al fin y a los cobros), el cliente que te elige,
// el chat con respuestas rápidas, el cronómetro y los repuestos, la agenda, el cambio de fecha,
// los avisos y la cuenta. Todos los textos salen de src/content/demo-especialista.json.

import '../../styles/demo-especialista.css';
import d from '../../content/demo-especialista.json';
import { registrarRol, type Motor } from './motor';
import { TARIFAS, completar, formatoPesos, netoEspecialista, pesosJuntos, retencionEspecialista } from './util';

type IdChat = keyof typeof d.chats;
type Origen = 'inicio' | 'programado';

interface Borrador {
  base: number;
  precio: number;
  franja: number;
}

interface Cambio {
  turno: number;
  dia: number;
  franja: number;
  motivo: number | null;
  mensaje: boolean;
  enviado: boolean;
}

interface Estado {
  disponible?: boolean;
  pedido?: 'nada' | 'visible';
  /** Rechazaste el pedido de urgencia: no vuelve a entrar solo (sí si apagás y prendés "Disponible"). */
  rechazado?: boolean;
  /** Ya mandaste presupuesto por el pedido de urgencia: no vuelve a entrar solo al volver al inicio. */
  atendido?: boolean;
  token?: number;
  toast?: number;
  precio?: number;
  franja?: number;
  borradores?: Partial<Record<Origen, Borrador>>;
  elegido?: boolean;
  /** Estado del trabajo de hoy. Sin estado (recién empezado o salto del panel) no hay cobro de hoy. */
  trabajo?: 'enviado' | 'terminado' | 'cancelado';
  inicioTrabajo?: number;
  extras?: number[];
  chat?: IdChat;
  chatDesdeTurno?: boolean;
  borradorChat?: Partial<Record<IdChat, number>>;
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
/** Precio que sugiere Handy para el pedido principal. */
const SUGERIDO = d.inicio.pedido.sugerido;
/** Presupuesto del recorrido (el sugerido más lo que suma la guía, igual que en el build): el de ejemplo de tarifas.json. */
const PRECIO = TARIFAS.ejemplo.presupuesto;
const VARS = { tarifaEspecialista: `${TARIFAS.normal.especialista}%` };
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const pesos = formatoPesos;
/** Lo que te queda: el presupuesto menos la tarifa de Handy, más los repuestos enteros. */
const netoConRepuestos = (presupuesto: number, repuestos: number) => netoEspecialista(presupuesto) + repuestos;

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
/** Id de la pantalla (u hoja) que contiene a un elemento. */
const pantallaDe = (el: Element) => el.closest<HTMLElement>('[data-pantalla]');

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

/** Igual que el desglose del build: presupuesto − tarifa (+ repuestos, enteros) = recibís / a tu cuenta. */
function desglose(cont: HTMLElement, presupuesto: number, extras: number, ultimo: string) {
  const filas = [
    fila(C.presupuesto, pesos(presupuesto)),
    fila(completar(C.tarifa, VARS), `− ${pesos(retencionEspecialista(presupuesto))}`, 'de-fila--resta'),
  ];
  if (extras) filas.push(fila(C.repuestos, `+ ${pesos(extras)}`));
  filas.push(fila(ultimo, pesos(netoConRepuestos(presupuesto, extras)), 'de-fila--total'));
  cont.replaceChildren(...filas);
}

/** Abre o cierra el desglose de una tarjeta con "Ver más información". */
function abrirTarjeta(tarjeta: HTMLElement, abrir: boolean) {
  const detalle = $(tarjeta, '[data-de-mov-desglose]');
  const btn = $(tarjeta, '[data-accion="verMas"]');
  if (!detalle || !btn) return;
  detalle.hidden = !abrir;
  btn.setAttribute('aria-expanded', String(abrir));
  poner(btn, '[data-de-ver-mas-texto]', abrir ? C.verMenos : C.verMas);
}

// ── El trabajo de hoy (lo que eligió el especialista) ─────────────────────

const precioHoy = (m: Motor) => est(m).precio ?? PRECIO;
const franjaHoy = (m: Motor) => d.precio.franjas[est(m).franja ?? 0] ?? d.precio.franjas[0];
const extrasHoy = (m: Motor) => (est(m).extras ?? []).reduce((s, i) => s + (d.trabajo.extras[i]?.monto ?? 0), 0);
const netoHoy = (m: Motor) => netoConRepuestos(precioHoy(m), extrasHoy(m));
const terminado = (m: Motor) => est(m).trabajo === 'terminado';

function nuevoTrabajo(e: Estado) {
  e.elegido = false;
  e.inicioTrabajo = undefined;
  e.extras = [];
  e.pedido = 'nada';
  // El chat con el cliente de hoy arranca de cero.
  if (e.usadas) delete e.usadas.perla;
  if (e.borradorChat) delete e.borradorChat.perla;
}

/** Mandaste presupuesto por el pedido de urgencia (con el sugerido o con tu precio). */
function enviarPresupuesto(m: Motor, precio: number, franja: number) {
  const e = est(m);
  e.precio = precio;
  e.franja = franja;
  e.atendido = true;
  e.trabajo = 'enviado';
  nuevoTrabajo(e);
  if (e.borradores) e.borradores.inicio = undefined;
  pintarDependientes(m);
}

/** Si estás en camino, en el chat o trabajando, el cliente ya te eligió (también al saltar a ese paso). */
function yaElegido(m: Motor) {
  const e = est(m);
  e.elegido = true;
  e.atendido = true;
  if (e.trabajo !== 'terminado') e.trabajo = 'enviado';
}

// ── Inicio: disponible → buscando → pedido ───────────────────────────────

/** La pastilla "Disponible" es la misma en todas las pantallas del mapa: refleja el estado real. */
function pintarDisponible(m: Motor) {
  const on = !!est(m).disponible;
  $$(document, '.demo-pantalla[data-rol="especialista"] [data-accion="disponible"]').forEach((sw) => {
    sw.setAttribute('aria-checked', String(on));
    sw.classList.toggle('de-disponible--apagado', !on);
    poner(sw, '[data-de-disp-texto]', on ? C.disponible : C.noDisponible);
  });
  // En el inicio, apagado, es lo próximo para tocar.
  $(m.pantalla('e-inicio'), '[data-accion="disponible"]')?.toggleAttribute('data-guia', !on);
}

function pintarInicio(m: Motor, nuevo = false) {
  const el = m.pantalla('e-inicio');
  const e = est(m);
  const i = d.inicio;
  const on = !!e.disponible;
  const conPedido = on && e.pedido === 'visible';

  pintarDisponible(m);
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
  // El aviso amarillo solo se ve cuando entra un pedido nuevo (y se va solo).
  const toast = $(el, '[data-de-toast]');
  if (toast && (!conPedido || !nuevo)) toast.hidden = true;

  if (nuevo && conPedido) {
    animar(m, tarjeta, [{ transform: 'translateY(115%)' }, { transform: 'none' }], 520);
    animar(m, $(el, '[data-de-pin-cliente]'), [
      { transform: 'translateY(-36px)', opacity: 0 },
      { transform: 'translateY(2px)', opacity: 1, offset: 0.75 },
      { transform: 'none', opacity: 1 },
    ], 560);
    if (toast) {
      const n = (e.toast = (e.toast ?? 0) + 1);
      toast.hidden = false;
      aparecer(m, toast);
      m.timeout(() => {
        if (est(m).toast === n) toast.hidden = true;
      }, 2800);
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

/** Al volver al inicio: el pedido entra solo si no lo atendiste ni lo rechazaste. */
const esperaPedido = (e: Estado) => !!e.disponible && e.pedido !== 'visible' && !e.atendido && !e.rechazado;

// ── Hojas de precio (pedido de urgencia y pedido programado) ─────────────

const hojaPrecio = (o: Origen) => (o === 'programado' ? 'e-precio-programado' : 'e-precio');
const origenDe = (el: Element): Origen => (pantallaDe(el)?.dataset.pantalla === 'e-precio-programado' ? 'programado' : 'inicio');

/** Lo que vas armando en la hoja. Se descarta al mandar el presupuesto. */
function borrador(m: Motor, o: Origen): Borrador {
  const e = est(m);
  const bs = (e.borradores ??= {});
  let b = bs[o];
  if (!b) {
    const base = o === 'inicio' ? SUGERIDO : d.programado.sugerido;
    b = bs[o] = { base, precio: base, franja: 0 };
  }
  return b;
}

function pintarPrecio(m: Motor, o: Origen) {
  const el = m.pantalla(hojaPrecio(o));
  const b = borrador(m, o);
  poner(el, '[data-de-sugerido]', pesos(b.base));
  poner(el, '[data-de-precio]', pesos(b.precio));
  poner(el, '[data-de-recibis]', pesos(netoEspecialista(b.precio)));
  poner(el, '[data-de-retiene]', completar(d.precio.retiene, { ...VARS, monto: pesosJuntos(retencionEspecialista(b.precio)) }));

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
  $$(el, '[data-accion="franja"]').forEach((btn) => marcar(btn, Number(btn.dataset.valor) === b.franja));
}

function cambiarPrecio(m: Motor, o: Origen, precio: number) {
  const b = borrador(m, o);
  b.precio = Math.max(d.precio.minimo, Math.round(precio));
  pintarPrecio(m, o);
  latido(m, $(m.pantalla(hojaPrecio(o)), '[data-de-recibis]'));
  m.anunciar(completar(d.precio.anuncio, { precio: pesos(b.precio), recibis: pesos(netoEspecialista(b.precio)) }));
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
// Dos pantallas con el mismo chat: "e-chat" (la del recorrido, siempre con el cliente de hoy)
// y "e-conversacion" (desde Mensajes, el trabajo o un turno).

const usadasDe = (m: Motor, id: IdChat) => est(m).usadas?.[id] ?? [];
const chatDe = (pantalla: HTMLElement): IdChat => ($(pantalla, '[data-de-chat]')?.dataset.deChat as IdChat) ?? 'perla';

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

/** Ya llegaste al domicilio del cliente de hoy (o el trabajo terminó o se canceló). */
function yaLlegaste(m: Motor) {
  const e = est(m);
  return !!e.inicioTrabajo || e.trabajo === 'terminado' || e.trabajo === 'cancelado';
}

/** Respuestas rápidas que tienen sentido ahora (las de "voy para allá" no, si ya llegaste). */
function libresDe(m: Motor, id: IdChat): number[] {
  const usadas = usadasDe(m, id);
  const llego = id === 'perla' && yaLlegaste(m);
  return d.chats[id].rapidas
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !usadas.includes(i) && !(llego && 'antesDeLlegar' in r && r.antesDeLlegar))
    .map(({ i }) => i);
}

/** Todo lo que se toca en el chat (sin volver a dibujar los mensajes). */
function pintarControlesChat(m: Motor, el: HTMLElement, id: IdChat) {
  const e = est(m);
  const ch = d.chats[id];
  const usadas = usadasDe(m, id);
  const libres = libresDe(m, id);

  const rapidas = $(el, '[data-de-rapidas]');
  if (rapidas) {
    rapidas.replaceChildren(
      ...libres.map((i, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'app-accion de-rapida';
        b.dataset.accion = 'rapida';
        b.dataset.valor = String(i);
        if (n === 0 && usadas.length === 0) b.setAttribute('data-guia', '');
        b.textContent = ch.rapidas[i].chip;
        return b;
      }),
    );
    rapidas.hidden = libres.length === 0;
  }

  // "Llegué al domicilio": solo con el cliente de hoy y antes de llegar.
  const llegue = $(el, '[data-de-llegue]');
  if (llegue) {
    const ver = id === 'perla' && !yaLlegaste(m);
    llegue.hidden = !ver;
    llegue.toggleAttribute('data-guia', ver && usadas.length > 0);
  }
  // "Ver el turno": no si ya venís del turno (evita el ida y vuelta).
  const verTurno = $(el, '[data-de-ver-turno]');
  if (verTurno) {
    verTurno.hidden = id === 'perla' || !!e.chatDesdeTurno;
    verTurno.dataset.valor = String(Math.max(0, ch.turno));
  }

  // Campo y botón de enviar: escriben y mandan la próxima respuesta rápida.
  const borr = e.borradorChat?.[id];
  const escrito = borr !== undefined && libres.includes(borr) ? ch.rapidas[borr].texto : '';
  const campo = $<HTMLButtonElement>(el, '[data-de-campo-chat]');
  if (campo) {
    poner(campo, '[data-de-campo-texto]', escrito || d.chat.input);
    campo.classList.toggle('de-input__campo--lleno', !!escrito);
    campo.disabled = libres.length === 0;
  }
  const enviar = $<HTMLButtonElement>(el, '[data-de-enviar]');
  if (enviar) enviar.disabled = libres.length === 0;
}

function pintarChat(m: Motor, el: HTMLElement, id: IdChat) {
  const ch = d.chats[id];
  const caja = $(el, '[data-de-chat]');
  if (!caja) return;
  caja.dataset.deChat = id;
  poner(el, '[data-de-chat-nombre]', ch.nombre);
  poner(el, '[data-de-chat-sub]', ch.sub);
  const mensajes = $(el, '[data-de-mensajes]');
  const plantilla = $<HTMLTemplateElement>(el, `template[data-de-plantilla="${id}"]`);
  if (mensajes && plantilla) {
    mensajes.replaceChildren(plantilla.content.cloneNode(true));
    usadasDe(m, id).forEach((i) => mensajes.append(burbuja(ch.rapidas[i].texto, true), burbuja(ch.rapidas[i].respuesta, false)));
  }
  pintarControlesChat(m, el, id);
}

/** Mandás una respuesta rápida: aparece tu mensaje, el cliente escribe y contesta. */
function responder(m: Motor, el: HTMLElement, id: IdChat, i: number) {
  const e = est(m);
  const r = d.chats[id].rapidas[i];
  if (!r || usadasDe(m, id).includes(i)) return;
  e.usadas = { ...e.usadas, [id]: [...usadasDe(m, id), i] };
  if (e.borradorChat) delete e.borradorChat[id];
  const mensajes = $(el, '[data-de-mensajes]');
  const propia = burbuja(r.texto, true);
  mensajes?.append(propia);
  aparecer(m, propia);
  pintarControlesChat(m, el, id);
  m.timeout(() => {
    const plantilla = $<HTMLTemplateElement>(el, 'template[data-de-plantilla-escribiendo]');
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
  const precio = precioHoy(m);
  const filas: HTMLElement[] = [
    fila(C.presupuesto, pesos(precio)),
    fila(completar(C.tarifa, VARS), `− ${pesos(retencionEspecialista(precio))}`, 'de-fila--resta'),
  ];
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
  filas.push(fila(C.recibis, pesos(netoHoy(m)), 'de-fila--total'));
  costo.replaceChildren(...filas);
}

// ── Fin y cobros ──────────────────────────────────────────────────────────

function pintarFin(m: Motor) {
  const el = m.pantalla('e-fin');
  poner(el, '[data-de-ganaste]', pesos(netoHoy(m)));
  const costo = $(el, '[data-de-costo]');
  if (costo) desglose(costo, precioHoy(m), extrasHoy(m), C.aTuCuenta);
}

function pintarCaja(m: Motor) {
  const el = m.pantalla('e-caja');
  const hoy = $(el, '[data-de-mov-hoy]');
  if (hoy) {
    // El cobro de hoy aparece cuando terminaste el trabajo (no antes, ni si lo cancelaste).
    hoy.hidden = !terminado(m);
    poner(hoy, '[data-de-mov-neto]', `+ ${pesos(netoHoy(m))}`);
    const costo = $(hoy, '[data-de-mov-desglose]');
    if (costo) desglose(costo, precioHoy(m), extrasHoy(m), C.aTuCuenta);
  }
  // Siempre hay un movimiento abierto, así se ve el desglose: el de hoy o, si no hay, el más reciente.
  const auto = $$(el, '[data-de-auto-abierto]');
  if (hoy && !hoy.hidden) {
    auto.forEach((t) => {
      abrirTarjeta(t, false);
      t.removeAttribute('data-de-auto-abierto');
    });
  }
  const visibles = $$(el, '.de-movimiento').filter((t) => !t.hidden);
  if (visibles.length && !visibles.some((t) => $(t, '[data-de-mov-desglose]')?.hidden === false)) {
    abrirTarjeta(visibles[0], true);
    if (visibles[0] !== hoy) visibles[0].setAttribute('data-de-auto-abierto', '');
  }
}

/**
 * Lo que depende del trabajo de hoy (precio, franja, repuestos) se pinta apenas cambia,
 * así las pantallas ya muestran los montos correctos mientras entran deslizándose.
 */
function pintarDependientes(m: Motor) {
  pintarAceptado(m);
  poner(m.pantalla('e-en-camino'), '[data-de-franja]', franjaHoy(m).texto);
  pintarTrabajo(m);
  pintarCrono(m);
  pintarFin(m);
  pintarCaja(m);
  poner(m.pantalla('e-notificaciones'), '[data-de-neto]', pesos(netoHoy(m)));
}

// ── Agenda, detalle y cambio de fecha ────────────────────────────────────

const turnoActual = (m: Motor) => Math.min(Math.max(est(m).turno ?? 0, 0), d.turnos.items.length - 1);
const cancelado = (m: Motor, i: number) => (est(m).cancelados ?? []).includes(i);
const primerLibre = (m: Motor) => d.turnos.items.findIndex((_, i) => !cancelado(m, i));

function pintarTurnos(m: Motor) {
  const el = m.pantalla('e-turnos');
  const libre = primerLibre(m);
  $$(el, '[data-de-turno]').forEach((card) => {
    const i = Number(card.dataset.deTurno);
    const no = cancelado(m, i);
    card.classList.toggle('de-tarjeta--cancelada', no);
    const tag = $(card, '[data-de-cancelado]');
    if (tag) tag.hidden = !no;
    const programado = $(card, '[data-de-programado-tag]');
    if (programado) programado.hidden = no;
    // La guía va al primer turno que sigue en pie.
    $(card, '.app-tarjeta__franja')?.toggleAttribute('data-guia', i === libre);
  });
  // En el calendario, el día de un turno cancelado deja de estar marcado.
  d.turnos.items.forEach((t, i) => {
    const dia = $(el, `.app-dia[data-dia="${t.dia}"]`);
    if (!dia) return;
    const no = cancelado(m, i);
    dia.classList.toggle('app-dia--azul', !no);
    dia.classList.toggle('de-dia--cancelado', no);
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
  poner(el, '[data-de-d="pedido"]', t.pedido);
  $$(el, '[data-de-icono]').forEach((s) => (s.hidden = s.dataset.deIcono !== t.icono));
  const no = cancelado(m, i);
  const costo = $(el, '[data-de-d="costo"]');
  if (costo) {
    desglose(costo, t.presupuesto, 0, C.recibis);
    costo.classList.toggle('de-costo--cancelado', no);
  }
  $(el, '.de-pie')?.classList.toggle('de-pie--cancelado', no);
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
      mensaje: false,
      enviado: false,
    };
  }
  return e.cambio;
}

/** Tira de la semana del día propuesto (igual que en el build). */
function pintarSemana(cont: HTMLElement, nuevo: number, actual: number) {
  const lunes = nuevo - ((fecha(nuevo).getDay() + 6) % 7);
  const celdas: HTMLElement[] = [];
  for (let n = lunes; n < lunes + 7; n++) {
    if (n < 1 || n > 30) {
      const vacio = document.createElement('span');
      vacio.className = 'de-semana__dia de-semana__dia--vacio';
      vacio.setAttribute('aria-hidden', 'true');
      celdas.push(vacio);
      continue;
    }
    const nombre = diaSemana(n);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `de-semana__dia${n === actual ? ' de-semana__dia--actual' : ''}${n === nuevo ? ' de-semana__dia--nueva' : ''}`;
    b.dataset.accion = 'elegirDia';
    b.dataset.valor = String(n);
    b.setAttribute('aria-label', completar(d.cambio.elegirDia, { dia: nombre, fecha: fechaCorta(n) }));
    b.setAttribute('aria-pressed', String(n === nuevo));
    b.disabled = n <= C.hoy || esDomingo(n);
    const inicial = document.createElement('small');
    inicial.textContent = nombre.charAt(0).toUpperCase();
    const numero = document.createElement('strong');
    numero.textContent = String(n);
    b.append(inicial, numero);
    celdas.push(b);
  }
  cont.replaceChildren(...celdas);
}

function pintarCambio(m: Motor) {
  const el = m.pantalla('e-cambiar-fecha');
  const c = cambio(m);
  const x = d.cambio;
  const t = d.turnos.items[c.turno];
  poner(el, '[data-de-cambio-actual] span', completar(x.actual, { dia: diaSemana(t.dia), fecha: fechaCorta(t.dia), franja: t.franja }));
  poner(el, '[data-de-cambio-dia]', String(c.dia));
  const tira = $(el, '[data-de-semana]');
  if (tira) pintarSemana(tira, c.dia, t.dia);
  poner(el, '[data-de-cambio-franja]', x.franjas[c.franja]);
  poner(el, '[data-de-cambio-resumen]', completar(x.resumen, { dia: diaSemana(c.dia), fecha: fechaCorta(c.dia), franja: x.franjas[c.franja] }));
  $$(el, '[data-accion="motivo"]').forEach((b, i) => {
    const activo = Number(b.dataset.valor) === c.motivo;
    b.setAttribute('aria-pressed', String(activo));
    b.classList.toggle('de-motivo--activo', activo);
    b.toggleAttribute('data-guia', i === 0 && c.motivo === null);
  });
  // El mensaje para el cliente: la app te sugiere uno según el motivo.
  const mensaje = $(el, '[data-accion="mensajeCambio"]');
  if (mensaje) {
    const texto = c.mensaje ? (x.mensajes[c.motivo ?? x.mensajes.length - 1] ?? x.mensajes[x.mensajes.length - 1]) : x.mensaje;
    poner(mensaje, '[data-de-mensaje-texto]', texto);
    mensaje.classList.toggle('de-campo--lleno', c.mensaje);
  }
  const proponer = $<HTMLButtonElement>(el, '[data-accion="proponerFecha"]');
  if (proponer) {
    proponer.disabled = c.enviado;
    proponer.toggleAttribute('data-guia', !c.enviado);
    proponer.textContent = c.enviado ? x.enviadoBoton : x.proponer;
  }
  // Con la propuesta enviada, la confirmación ocupa el lugar del resumen.
  const ok = $(el, '[data-de-cambio-ok]');
  if (ok) ok.hidden = !c.enviado;
  const resumen = $(el, '[data-de-cambio-resumen]');
  if (resumen) resumen.hidden = c.enviado;
  // Con la propuesta enviada, el recorrido sigue por tus avisos (la campana).
  $(el, '.app-cabecera [data-ir="e-notificaciones"]')?.toggleAttribute('data-guia', c.enviado);
}

// ── Avisos, pedido programado, cuenta y mensajes ─────────────────────────

function pintarAvisos(m: Motor) {
  const el = m.pantalla('e-notificaciones');
  poner(el, '[data-de-neto]', pesos(netoHoy(m)));
  // El aviso de cobro de hoy, solo con el trabajo terminado.
  const cobro = $(el, '[data-de-cobro-hoy]');
  if (cobro) cobro.hidden = !terminado(m);
  const hay = $$(el, '.de-notif').some((n) => !n.hidden);
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
      poner(aviso, '[data-de-aviso-titulo]', p.enviadoTitulo);
      poner(aviso, '[data-de-aviso-texto]', completar(p.enviadoTexto, { monto: pesosJuntos(e.precioProgramado ?? p.sugerido) }));
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

/** El chat con el cliente de hoy aparece cuando te eligió. */
function pintarFilasChat(m: Motor, el: HTMLElement) {
  $$(el, '[data-de-chat-fila="perla"]').forEach((f) => (f.hidden = !est(m).elegido));
}

function pintarMensajes(m: Motor) {
  const el = m.pantalla('e-mensajes');
  const leidos = est(m).leidos ?? [];
  (d.mensajes.orden as IdChat[]).forEach((id) => {
    poner(el, `[data-de-ultimo="${id}"]`, ultimoMensaje(m, id));
    const badge = $(el, `[data-de-badge="${id}"]`);
    if (badge) badge.hidden = leidos.includes(id);
  });
  pintarFilasChat(m, el);
}

// ── Registro ──────────────────────────────────────────────────────────────

let originales: Map<string, string> | null = null;

registrarRol('especialista', {
  acciones: {
    // Inicio (y la misma pastilla en las otras pantallas del mapa)
    disponible(el, m) {
      const e = est(m);
      const enInicio = pantallaDe(el)?.dataset.pantalla === 'e-inicio';
      e.disponible = !e.disponible;
      e.token = (e.token ?? 0) + 1;
      if (!e.disponible) e.pedido = 'nada';
      if (enInicio) {
        // Prenderlo en el inicio es una búsqueda nueva.
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
      enviarPresupuesto(m, SUGERIDO, 0);
    },

    // Precio
    precioSugerido(el, m) {
      const o = origenDe(el);
      cambiarPrecio(m, o, borrador(m, o).base);
    },
    precioSumar(el, m) {
      const o = origenDe(el);
      cambiarPrecio(m, o, borrador(m, o).base + Number(el.dataset.valor));
    },
    precioPaso(el, m) {
      const o = origenDe(el);
      cambiarPrecio(m, o, borrador(m, o).precio + Number(el.dataset.valor));
    },
    franja(el, m) {
      const o = origenDe(el);
      borrador(m, o).franja = Number(el.dataset.valor);
      pintarPrecio(m, o);
    },
    ponerPrecio(el, m) {
      const e = est(m);
      const o = origenDe(el);
      const b = borrador(m, o);
      if (o === 'programado') {
        e.precioProgramado = b.precio;
        e.programado = 'enviado';
        if (e.borradores) e.borradores.programado = undefined;
        m.volver();
        pintarProgramado(m, true);
        m.anunciar(`${d.programado.enviadoTitulo} ${completar(d.programado.enviadoTexto, { monto: pesos(b.precio) })}`);
        return;
      }
      enviarPresupuesto(m, b.precio, b.franja);
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
      const e = est(m);
      e.chat = id;
      e.chatDesdeTurno = pantallaDe(el)?.dataset.pantalla === 'e-turno-detalle';
      marcarLeido(m, id);
      // Se pinta antes de entrar, así la pantalla llega lista mientras se desliza.
      pintarChat(m, m.pantalla(el.dataset.ir ?? 'e-conversacion'), id);
    },
    rapida(el, m) {
      const pantalla = pantallaDe(el);
      if (pantalla) responder(m, pantalla, chatDe(pantalla), Number(el.dataset.valor));
    },
    escribirChat(el, m) {
      const pantalla = pantallaDe(el);
      if (!pantalla) return;
      const id = chatDe(pantalla);
      const libres = libresDe(m, id);
      if (!libres.length) return;
      const e = est(m);
      const actual = e.borradorChat?.[id];
      // Cada toque escribe la próxima respuesta sugerida.
      const sig = actual !== undefined && libres.includes(actual) ? libres[(libres.indexOf(actual) + 1) % libres.length] : libres[0];
      e.borradorChat = { ...e.borradorChat, [id]: sig };
      pintarControlesChat(m, pantalla, id);
    },
    enviarChat(el, m) {
      const pantalla = pantallaDe(el);
      if (!pantalla) return;
      const id = chatDe(pantalla);
      const libres = libresDe(m, id);
      const borr = est(m).borradorChat?.[id];
      const i = borr !== undefined && libres.includes(borr) ? borr : libres[0];
      if (i !== undefined) responder(m, pantalla, id, i);
    },

    // Trabajo
    agregarExtra(_el, m) {
      const e = est(m);
      const extras = e.extras ?? [];
      const siguiente = d.trabajo.extras.findIndex((_, i) => !extras.includes(i));
      if (siguiente < 0) return;
      e.extras = [...extras, siguiente];
      pintarDependientes(m);
      const el = m.pantalla('e-trabajo');
      aparecer(m, $$(el, '.de-fila--extra').pop());
      latido(m, $(el, '.de-fila--total strong'));
      m.anunciar(completar(d.trabajo.anuncioExtra, { nombre: d.trabajo.extras[siguiente].nombre, monto: pesos(netoHoy(m)) }));
    },
    quitarExtra(el, m) {
      const e = est(m);
      const i = Number(el.dataset.valor);
      e.extras = (e.extras ?? []).filter((x) => x !== i);
      pintarDependientes(m);
      const x = d.trabajo.extras[i];
      if (x) m.anunciar(completar(d.trabajo.anuncioQuitar, { nombre: x.nombre, monto: pesos(netoHoy(m)) }));
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
      const i = Number(el.dataset.valor) || 0;
      est(m).turno = i;
      pintarDetalle(m);
      if (!cancelado(m, i)) pintarCambio(m);
    },
    motivo(el, m) {
      const c = cambio(m);
      c.motivo = Number(el.dataset.valor);
      c.enviado = false;
      pintarCambio(m);
    },
    mensajeCambio(_el, m) {
      const c = cambio(m);
      c.mensaje = true;
      pintarCambio(m);
    },
    diaPaso(el, m) {
      const c = cambio(m);
      c.dia = moverDia(c.dia, Number(el.dataset.valor) > 0 ? 1 : -1);
      c.enviado = false;
      pintarCambio(m);
    },
    elegirDia(el, m) {
      const c = cambio(m);
      const n = Number(el.dataset.valor);
      if (!n || n <= C.hoy || n > 30 || esDomingo(n)) return;
      c.dia = n;
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
      m.anunciar(`${d.programado.enviadoTitulo} ${completar(d.programado.enviadoTexto, { monto: pesos(d.programado.sugerido) })}`);
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

    // Cobros y ayuda
    verMas(el) {
      const tarjeta = el.closest<HTMLElement>('.app-tarjeta');
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
  },

  entrar: {
    'e-inicio'(_el, m) {
      pintarInicio(m);
      if (esperaPedido(est(m))) programarPedido(m);
    },
    'e-precio'(_el, m) {
      const e = est(m);
      // Si se llega directo a esta hoja, el pedido tiene que estar a la vista debajo.
      if (!(e.disponible && e.pedido === 'visible')) {
        e.disponible = true;
        e.pedido = 'visible';
        e.token = (e.token ?? 0) + 1;
        pintarInicio(m);
      }
      pintarPrecio(m, 'inicio');
    },
    'e-precio-programado'(_el, m) {
      pintarPrecio(m, 'programado');
    },
    'e-aceptado'(_el, m) {
      const e = est(m);
      // Mandaste un presupuesto: estabas disponible (también si se salta directo a este paso).
      if (e.disponible === undefined) e.disponible = true;
      e.atendido = true;
      if (!e.trabajo || e.trabajo === 'cancelado') e.trabajo = 'enviado';
      pintarDisponible(m);
      pintarAceptado(m);
      if (!e.elegido) m.timeout(() => elegir(m), 2600);
    },
    'e-en-camino'(el, m) {
      yaElegido(m);
      poner(el, '[data-de-franja]', franjaHoy(m).texto);
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
      pintarChat(m, el, id);
    },
    'e-trabajo'(_el, m) {
      const e = est(m);
      yaElegido(m);
      if (!e.inicioTrabajo) e.inicioTrabajo = Date.now();
      pintarTrabajo(m);
      pintarCrono(m);
      m.intervalo(() => pintarCrono(m), 1000);
    },
    'e-fin'(el, m) {
      const e = est(m);
      yaElegido(m);
      e.trabajo = 'terminado';
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
      // Un turno cancelado no se reprograma: se usa el primero que sigue en pie.
      const e = est(m);
      const libre = primerLibre(m);
      if (cancelado(m, turnoActual(m)) && libre >= 0) e.turno = libre;
      pintarCambio(m);
    },
    'e-notificaciones'(_el, m) {
      pintarAvisos(m);
    },
    'e-pedido-programado'(_el, m) {
      pintarDisponible(m);
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
    'e-contactos'(el, m) {
      pintarFilasChat(m, el);
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
