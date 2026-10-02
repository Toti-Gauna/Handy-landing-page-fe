// Demo · comportamiento del lado del usuario (acciones y pantallas dinámicas).
//
// El HTML sale de src/render/demo/usuario.ts con el estado inicial. Acá se guarda lo que se va eligiendo
// (en m.estado, que el motor vacía al reiniciar) y se vuelve a pintar todo lo marcado con data-du-*:
//   data-du-tpl, data-du-icono, data-du-ver, data-du-guia, data-du-habilitar, data-du-clase, data-du-grupo,
//   data-du-rueda, data-du-dia.
// Hay tres juegos de valores (ver "contextos" en demo-usuario.json):
//   - pedido: lo que se está pidiendo ahora (rubro, tipo, día, franja, presupuesto elegido);
//   - turno: el turno confirmado (arranca con uno de ejemplo; se reemplaza al tocar "Confirmar turno");
//   - ia: lo que se le contó a HandIA (pasa al pedido recién al tocar "Pedir para hoy" o "Programar turno").
// Todo lo temporizado usa m.timeout (se cancela solo al salir de la pantalla).

import '../../styles/demo-usuario.css';
import d from '../../content/demo-usuario.json';
import rubrosJson from '../../content/rubros.json';
import { registrarRol, type Motor } from './motor';
import { completar, formatoPesos, TARIFAS, tarifaCliente, totalCliente } from './util';

// ── Estado ────────────────────────────────────────────────────────────────

type IdChat = 'u-chat' | 'u-handia' | 'u-soporte';
type Contexto = 'pedido' | 'turno' | 'ia';

interface Msg {
  de: string;
  texto: string;
  foto?: boolean;
}

interface EstadoChat {
  etapa: number;
  cola: Msg[];
  escribiendo: boolean;
  /** Ya se agregaron los mensajes finales (en el chat con el especialista, "Listo, ya quedó"). */
  final: boolean;
}

/** Turno confirmado (el del recorrido). Día y franja son los que propuso el especialista elegido. */
interface Turno {
  rubro: string;
  problema: string;
  tipo: number;
  dia: number;
  franja: number;
  pres: number;
  pago: number;
  seg: number;
  terminado: boolean;
  cancelado: boolean;
  cambio: boolean;
}

interface Estado {
  // Pedido en curso
  rubro: string;
  problema: string;
  tipo: number;
  dia: number;
  franja: number;
  diaTocado: boolean;
  fotos: number;
  pres: number;
  pago: number;
  buscado: boolean;
  llegados: number;
  // Lo que se le contó a HandIA
  ia: { rubro: string; problema: string; foto: boolean };
  // Turno confirmado
  tc: Turno;
  estrellas: number;
  resEnviada: boolean;
  /** Turno que se ve en "Tu turno": 0 = el confirmado; 1… = los pasados. */
  turno: number;
  /** Desde dónde se abrió "Tu turno" (la guía vuelve al seguimiento o sigue a "Ver el pago"). */
  origen: 'seg' | 'turnos';
  /** Movimiento para desplegar al llegar a "Tus pagos" desde "Ver el pago" (-1: ninguno). */
  verPago: number;
  desde: string;
  cambioDia: number;
  cambioFranja: number;
  pregunta: number;
  sirvio: boolean;
  avisos: number[];
  chatLeido: boolean;
  chats: Record<string, EstadoChat>;
}

const ini = d.inicial;
const dias = d.programar.dias;
const franjas = d.programar.franjas;
const items = d.presupuestos.items;
const pasados = d.turnos.pasados;
const fm = d.formatos;
const RUBROS = new Map(rubrosJson.rubros.map((r) => [r.id, r]));
const problemaDe = (id: string) => (d.problemas as Record<string, string>)[id] ?? '';
const CONTEXTOS = d.contextos as Record<string, string>;
const contextoDe = (id: string): Contexto => (CONTEXTOS[id] as Contexto | undefined) ?? 'turno';

const CHATS: Record<IdChat, { etapas: { rapidas: { texto: string; respuestas: string[]; foto?: boolean; propia?: string; rubro?: string; problema?: string }[] }[]; final?: string[] }> = {
  'u-chat': { etapas: d.chat.etapas, final: d.chat.final },
  'u-handia': { etapas: d.handia.etapas },
  'u-soporte': { etapas: d.soporte.etapas },
};

/** Horario que propone el presupuesto i para un pedido (índices de día y franja). Igual que en el build. */
function propuesta(tipo: number, dia: number, franja: number, i: number) {
  const pr = items[i].propone;
  if (tipo === 0) return { dia: 0, franja: pr.urgencia };
  return { dia: Math.min(dia + pr.dia, dias.length - 1), franja: pr.franja ?? franja };
}

/** Día de la rueda que toca la guía: el siguiente al elegido (se ve cómo gira). Igual que en el build. */
const diaGuia = (dia: number) => (dia + 1 < dias.length ? dia + 1 : dia - 1);

function turnoInicial(): Turno {
  const pr = propuesta(ini.tipo, ini.dia, ini.franja, ini.presupuesto);
  return {
    rubro: ini.rubro,
    problema: problemaDe(ini.rubro),
    tipo: ini.tipo,
    dia: pr.dia,
    franja: pr.franja,
    pres: ini.presupuesto,
    pago: ini.pago,
    seg: 0,
    terminado: false,
    cancelado: false,
    cambio: false,
  };
}

function S(m: Motor): Estado {
  const e = m.estado as Partial<Estado> & { _listo?: boolean };
  if (!e._listo) {
    const tc = turnoInicial();
    const base: Estado = {
      rubro: ini.rubro,
      problema: problemaDe(ini.rubro),
      tipo: ini.tipo,
      dia: ini.dia,
      franja: ini.franja,
      diaTocado: false,
      fotos: 0,
      pres: ini.presupuesto,
      pago: ini.pago,
      buscado: false,
      llegados: 0,
      ia: { rubro: ini.rubro, problema: problemaDe(ini.rubro), foto: false },
      tc,
      estrellas: 0,
      resEnviada: false,
      turno: 0,
      origen: 'turnos',
      verPago: -1,
      desde: 'detalle',
      cambioDia: Math.min(tc.dia + 1, dias.length - 1),
      cambioFranja: tc.franja,
      pregunta: 0,
      sirvio: false,
      avisos: [],
      chatLeido: false,
      chats: {},
    };
    Object.assign(e, base, { _listo: true });
  }
  return e as Estado;
}

const chatDe = (e: Estado, id: string) => (e.chats[id] ??= { etapa: 0, cola: [], escribiendo: false, final: false });

const precioDe = (i: number) => {
  const it = items[i];
  return 'precio' in it && typeof it.precio === 'number' ? it.precio : TARIFAS.ejemplo.presupuesto;
};

const rubroDe = (id: string) => RUBROS.get(id)!;

// ── Valores y condiciones (lo que se pinta) ───────────────────────────────

/** Pedido en curso y presupuesto elegido. */
function valoresPedido(e: Estado): Record<string, string> {
  const r = rubroDe(e.rubro);
  const urgencia = e.tipo === 0;
  const dia = dias[urgencia ? 0 : e.dia];
  const it = items[e.pres];
  const p = precioDe(e.pres);
  const v: Record<string, string> = {
    tarifaCliente: `${TARIFAS.normal.cliente}%`,
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[e.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    fecha: dia.fecha,
    // En una urgencia el usuario no elige franja: cada especialista dice a qué hora puede ir.
    franja: urgencia ? d.urgencia.franja : franjas[e.franja],
    problema: e.problema,
    esp: it.nombre,
    zona: it.zona,
    declaro: it.declaro,
    otro: it.otros.find((o) => o !== r.nombre) ?? '',
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaCliente(p)),
    total: formatoPesos(totalCliente(p)),
  };
  items.forEach((_, i) => {
    const pr = propuesta(e.tipo, e.dia, e.franja, i);
    v[`horario${i}`] = completar(fm.cuando, { diaCorto: dias[pr.dia].corto, franja: franjas[pr.franja] });
  });
  const pr = propuesta(e.tipo, e.dia, e.franja, e.pres);
  Object.assign(v, {
    horarioEsp: v[`horario${e.pres}`],
    propDia: dias[pr.dia].largo,
    propFecha: dias[pr.dia].fecha,
    propFranja: franjas[pr.franja],
  });
  return v;
}

/** Turno confirmado (y el que se ve en "Tu turno"). */
function valoresTurno(e: Estado): Record<string, string> {
  const t = e.tc;
  const r = rubroDe(t.rubro);
  const dia = dias[t.dia];
  const it = items[t.pres];
  const p = precioDe(t.pres);
  const est = d.turnos.estados;
  const v: Record<string, string> = {
    tarifaCliente: `${TARIFAS.normal.cliente}%`,
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[t.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    fecha: dia.fecha,
    franja: franjas[t.franja],
    problema: t.problema,
    esp: it.nombre,
    zona: it.zona,
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaCliente(p)),
    total: formatoPesos(totalCliente(p)),
    estado: t.cancelado ? est.cancelado : t.terminado ? est.terminado : est.confirmado,
  };
  v.cuando = completar(fm.cuando, v);
  v.cambio = completar(fm.cuando, { diaCorto: dias[e.cambioDia].corto, franja: franjas[e.cambioFranja] });

  if (e.turno === 0) {
    Object.assign(v, {
      tRubro: v.rubro,
      tTipo: v.tipo,
      tDia: v.dia,
      tFecha: v.fecha,
      tFranja: v.franja,
      tEsp: v.esp,
      tPrecio: v.precio,
      tTarifa: v.tarifa,
      tTotal: v.total,
      tEstado: v.estado,
    });
  } else {
    const x = pasados[e.turno - 1];
    Object.assign(v, {
      tRubro: rubroDe(x.rubro).nombre,
      tTipo: x.tipo,
      tDia: x.largo,
      tFecha: x.fecha,
      tFranja: x.franja,
      tEsp: x.especialista,
      tPrecio: formatoPesos(x.precio),
      tTarifa: formatoPesos(tarifaCliente(x.precio)),
      tTotal: formatoPesos(totalCliente(x.precio)),
      tEstado: est.terminado,
    });
  }
  return v;
}

/** Lo que se le contó a HandIA. */
function valoresIa(e: Estado): Record<string, string> {
  const r = rubroDe(e.ia.rubro);
  return { ...valoresPedido(e), rubro: r.nombre, rubroCorto: r.corto ?? r.nombre, problema: e.ia.problema };
}

const valoresDe = (e: Estado, ctx: Contexto) => (ctx === 'pedido' ? valoresPedido(e) : ctx === 'ia' ? valoresIa(e) : valoresTurno(e));

/** Rubro (id) de cada ícono dinámico, según el contexto de la pantalla. */
const iconos = (e: Estado, ctx: Contexto): Record<string, string> => ({
  rubro: ctx === 'pedido' ? e.rubro : ctx === 'ia' ? e.ia.rubro : e.tc.rubro,
  tRubro: e.turno === 0 ? e.tc.rubro : pasados[e.turno - 1].rubro,
});

function condiciones(e: Estado): Record<string, boolean> {
  const t = e.tc;
  const flujo = e.turno === 0;
  const pagoHecho = t.pago === 0 && !t.cancelado;
  const c: Record<string, boolean> = {
    foto1: e.fotos >= 1,
    foto2: e.fotos >= 2,
    puedeFoto: e.fotos < 2,
    fotoGuia: e.fotos === 0,
    buscListo: e.llegados >= items.length,
    hayOtro: items[e.pres].otros.some((o) => o !== rubroDe(e.rubro).nombre),
    segAntes: t.seg < 2,
    segLlego: t.seg === 2,
    segTrabajando: t.seg >= 3,
    pagoAhora: t.pago === 0,
    pagoDespues: t.pago === 1,
    pagoHecho,
    flujoAPagar: !pagoHecho && !t.cancelado,
    resSin: e.estrellas === 0,
    resBien: e.estrellas >= 4,
    resMal: e.estrellas > 0 && e.estrellas < 4,
    resConEstrellas: e.estrellas > 0,
    resEnviada: e.resEnviada,
    tFlujo: flujo,
    tActivo: flujo && !t.terminado && !t.cancelado,
    tPagado: !flujo || pagoHecho,
    tPorPagar: flujo && t.terminado && !t.cancelado && t.pago === 1,
    tTerminado: !flujo || (t.terminado && !t.cancelado),
    tCambio: flujo && t.cambio && !t.cancelado && !t.terminado,
    tCancelado: flujo && t.cancelado,
    origenSeg: e.origen === 'seg',
    origenTurnos: e.origen === 'turnos',
    chatLeido: e.chatLeido,
    sirvio: e.sirvio,
  };
  d.buscando.estados.forEach((_, i) => (c[`busc${i}`] = e.llegados === i));
  items.forEach((_, i) => (c[`llego${i + 1}`] = e.llegados >= i + 1));
  d.seguimiento.estados.forEach((_, i) => (c[`seg${i}`] = t.seg === i));
  d.ayuda.preguntas.forEach((_, i) => (c[`resp${i}`] = e.pregunta === i));
  dias.forEach((_, i) => (c[`guiaDia${i}`] = !e.diaTocado && i === diaGuia(e.dia)));
  // Avisos: los que no se borraron y que corresponden (el de "Pagaste" solo si se pagó).
  d.notificaciones.avisos.forEach((a, i) => {
    const si = (a as { si?: string }).si;
    c[`aviso${i}`] = !e.avisos.includes(i) && (!si || !!c[si]);
  });
  c.avisosVacio = d.notificaciones.avisos.every((_, i) => !c[`aviso${i}`]);
  (Object.keys(CHATS) as IdChat[]).forEach((id) => {
    const ch = chatDe(e, id);
    const libre = ch.cola.length === 0 && !ch.escribiendo;
    // El chat con el especialista no sigue si el turno se canceló o ya terminó.
    const activo = id !== 'u-chat' || (!t.cancelado && !t.terminado);
    CHATS[id].etapas.forEach((_, n) => (c[`chat:${id}:${n}`] = libre && activo && ch.etapa === n));
    c[`final:${id}`] = libre && activo && ch.etapa >= CHATS[id].etapas.length && (id !== 'u-chat' || ch.final);
  });
  return c;
}

// ── Pintar ────────────────────────────────────────────────────────────────

const pantallasRol = () => document.querySelectorAll<HTMLElement>('.demo-pantalla[data-rol="usuario"]');
const mias = (sel: string) => document.querySelectorAll<HTMLElement>(`.demo-pantalla[data-rol="usuario"] ${sel}`);
const pantallaDe = (id: string) => document.querySelector<HTMLElement>(`.demo-pantalla[data-pantalla="${id}"]`)!;

function svgRubro(id: string): Node | null {
  const svg = pantallaDe('u-inicio')?.querySelector(`[data-accion="rubro"][data-valor="${id}"] svg`);
  return svg ? svg.cloneNode(true) : null;
}

function pintar(m: Motor) {
  const e = S(m);
  const c = condiciones(e);
  const cache: Partial<Record<Contexto, Record<string, string>>> = {};
  const valores = (ctx: Contexto) => (cache[ctx] ??= valoresDe(e, ctx));

  pantallasRol().forEach((p) => {
    const ctx = contextoDe(p.dataset.pantalla ?? '');
    p.querySelectorAll<HTMLElement>('[data-du-tpl]').forEach((el) => {
      const t = completar(el.dataset.duTpl!, valores(ctx));
      if (el.textContent !== t) el.textContent = t;
    });
    const ic = iconos(e, ctx);
    p.querySelectorAll<HTMLElement>('[data-du-icono]').forEach((el) => {
      const id = ic[el.dataset.duIcono!];
      // El build pinta todos los íconos con el rubro inicial.
      if (!id || (el.dataset.duActual ?? ini.rubro) === id) return;
      const svg = svgRubro(id);
      if (!svg) return;
      el.replaceChildren(svg);
      el.dataset.duActual = id;
    });
  });
  const cumple = (cond: string) => (cond.startsWith('!') ? !c[cond.slice(1)] : !!c[cond]);
  mias('[data-du-ver]').forEach((el) => {
    const oculto = !cumple(el.dataset.duVer!);
    if (el.hidden !== oculto) el.hidden = oculto;
  });
  mias('[data-du-guia]').forEach((el) => el.toggleAttribute('data-guia', cumple(el.dataset.duGuia!)));
  mias('[data-du-clase]').forEach((el) =>
    el.dataset.duClase!.split(' ').forEach((par) => {
      const [cond, clase] = par.split(':');
      el.classList.toggle(clase, cumple(cond));
    }),
  );
  mias('[data-du-habilitar]').forEach((el) => {
    (el as HTMLButtonElement).disabled = !cumple(el.dataset.duHabilitar!);
  });
  const grupos: Record<string, number> = {
    tipo: e.tipo,
    dia: e.dia,
    franja: e.franja,
    pres: e.pres,
    pago: e.pago,
    cambioDia: e.cambioDia,
    cambioFranja: e.cambioFranja,
  };
  mias('[data-du-grupo]').forEach((el) => {
    const g = el.dataset.duGrupo!;
    const valor = Number(el.dataset.valor);
    const activo = g === 'estrellas' ? valor <= e.estrellas : grupos[g] === valor;
    if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(activo));
    else el.classList.toggle('du-sel', activo);
  });
  mias('[data-du-rueda]').forEach((el) => {
    el.style.setProperty('--du-i', String(el.dataset.duRueda === 'dia' ? e.dia : e.franja));
  });
  // Calendario: solo el día del turno confirmado se puede tocar. Si el trabajo ya terminó, "hoy" es ese día.
  const t = e.tc;
  const hoy = t.terminado && !t.cancelado ? dias[t.dia].num : d.turnos.hoy;
  mias('[data-du-dia]').forEach((el) => {
    const b = el as HTMLButtonElement;
    const sel = Number(b.dataset.duDia) === t.dia && !t.cancelado;
    b.disabled = !sel;
    b.classList.toggle('app-dia--azul', sel);
    b.classList.toggle('app-dia--hoy', !sel && Number(b.dataset.num) === hoy);
    if (sel) b.setAttribute('aria-label', b.dataset.duAria ?? '');
    else b.removeAttribute('aria-label');
  });
  // Chats: ocupados mientras el otro escribe (el recorrido espera a que terminen).
  mias('[data-du-chat]').forEach((el) => {
    const ch = chatDe(e, el.dataset.duChat!);
    if (ch.escribiendo || ch.cola.length) el.setAttribute('aria-busy', 'true');
    else el.removeAttribute('aria-busy');
  });
  const seg = pantallaDe('u-seguimiento')?.querySelector<HTMLElement>('[data-du-seg]');
  if (seg) seg.dataset.duSeg = String(t.seg);
}

// ── Utilidades ────────────────────────────────────────────────────────────

/** Saca la marca de guía de un grupo (después de tocarlo, la guía pasa a lo siguiente). */
function sinGuia(el: HTMLElement, selector: string) {
  el.closest('.demo-pantalla')
    ?.querySelectorAll(selector)
    .forEach((x) => x.removeAttribute('data-guia'));
}

function avisar(m: Motor, texto: string) {
  const p = m.pantalla();
  const caja = p.querySelector<HTMLElement>('.app') ?? p.querySelector<HTMLElement>('.demo-hoja') ?? p;
  p.querySelectorAll('.du-toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'du-toast';
  t.textContent = texto;
  caja.append(t);
  m.anunciar(texto);
  m.timeout(() => t.remove(), 2600);
}

// ── Reiniciar: el DOM vuelve a como salió del build ────────────────────────

const originales = new Map<HTMLElement, string>();

function fotografiar() {
  if (originales.size) return;
  pantallasRol().forEach((p) => originales.set(p, p.innerHTML));
}

fotografiar();

/** Vuelve una pantalla a como salió del build. */
function restaurar(id: string) {
  const p = pantallaDe(id);
  const html = p ? originales.get(p) : undefined;
  if (p && html !== undefined && p.innerHTML !== html) p.innerHTML = html;
}

/** Despliega (o pliega) el detalle de un movimiento de "Tus pagos". */
function desplegar(tarjeta: Element | null, abierto: boolean) {
  if (!tarjeta) return;
  tarjeta.querySelector<HTMLElement>('[data-du-mov]')?.toggleAttribute('hidden', !abierto);
  const b = tarjeta.querySelector<HTMLElement>('[data-accion="mov"]');
  b?.setAttribute('aria-expanded', String(abierto));
  b?.querySelector<HTMLElement>('[data-du-mas]')?.toggleAttribute('hidden', abierto);
  b?.querySelector<HTMLElement>('[data-du-menos]')?.toggleAttribute('hidden', !abierto);
}

// ── Chats guionados ───────────────────────────────────────────────────────

function burbuja(id: IdChat, msg: Msg, nueva: boolean): HTMLElement {
  const pantalla = pantallaDe(id);
  const div = document.createElement('div');
  div.className = `app-burbuja app-burbuja--${msg.de === 'vos' ? 'propia' : 'otra'}${msg.foto ? ' app-burbuja--foto' : ''}${nueva ? ' du-nueva' : ''}`;
  if (msg.foto) {
    // La "foto" es la ilustración del rubro (pintar() le pone el ícono que corresponde).
    const tpl = pantalla.querySelector<HTMLTemplateElement>('template[data-du-foto]');
    const foto = tpl?.content.firstElementChild?.cloneNode(true);
    if (foto) div.append(foto);
  }
  const span = document.createElement('span');
  span.textContent = msg.texto;
  div.append(span);
  pantalla.querySelector('[data-du-mensajes]')!.append(div);
  return div;
}

function quitarEscribiendo(pantalla: HTMLElement) {
  pantalla.querySelectorAll('.du-escribiendo').forEach((x) => x.remove());
}

function escribiendo(pantalla: HTMLElement) {
  const div = document.createElement('div');
  div.className = 'app-burbuja app-burbuja--otra du-escribiendo';
  div.innerHTML = '<i></i><i></i><i></i>';
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = d.comun.escribiendo;
  div.append(sr);
  pantalla.querySelector('[data-du-mensajes]')!.append(div);
}

const textoDe = (e: Estado, id: IdChat, msg: Msg): Msg => ({ ...msg, texto: completar(msg.texto, valoresDe(e, contextoDe(id))) });

/** Muestra los mensajes en cola de a uno, con "escribiendo…" antes de cada uno. */
function seguirChat(m: Motor, id: IdChat) {
  const e = S(m);
  const ch = chatDe(e, id);
  const p = pantallaDe(id);
  if (ch.escribiendo) return;
  if (!ch.cola.length) {
    pintar(m);
    m.guia(null);
    return;
  }
  ch.escribiendo = true;
  escribiendo(p);
  pintar(m);
  m.timeout(
    () => {
      quitarEscribiendo(p);
      ch.escribiendo = false;
      const msg = ch.cola.shift()!;
      burbuja(id, textoDe(e, id, msg), !m.reducido);
      if (ch.cola.length) m.timeout(() => seguirChat(m, id), m.reducido ? 150 : 450);
      else seguirChat(m, id);
    },
    m.reducido ? 500 : 1200,
  );
}

/** Al volver a un chat que quedó a mitad de camino (se salió antes de que terminara): mostrar todo de una. */
function completarChat(m: Motor, id: IdChat) {
  const e = S(m);
  const ch = chatDe(e, id);
  const p = pantallaDe(id);
  if (!ch.cola.length && !ch.escribiendo) return;
  quitarEscribiendo(p);
  ch.escribiendo = false;
  ch.cola.splice(0).forEach((msg) => burbuja(id, textoDe(e, id, msg), false));
}

/**
 * Agrega los mensajes finales del chat. En el del especialista ("Listo, ya quedó"), solo cuando ya está
 * trabajando en tu casa (después de "Confirmar llegada") y el turno sigue activo.
 */
function agregarFinal(e: Estado, id: IdChat) {
  const conf = CHATS[id];
  const ch = chatDe(e, id);
  if (!conf.final || ch.final || ch.etapa < conf.etapas.length) return;
  if (id === 'u-chat' && (e.tc.seg < 3 || e.tc.terminado || e.tc.cancelado)) return;
  ch.final = true;
  ch.cola.push(...conf.final.map((texto) => ({ de: 'otro', texto })));
}

function responder(m: Motor, id: IdChat, etapa: number, i: number) {
  const conf = CHATS[id];
  const e = S(m);
  const ch = chatDe(e, id);
  if (!conf || etapa !== ch.etapa || ch.escribiendo || ch.cola.length) return;
  const r = conf.etapas[ch.etapa]?.rapidas[i];
  if (!r) return;
  // Lo de HandIA queda aparte: no toca el pedido en curso ni el turno confirmado.
  if (id === 'u-handia') {
    if (r.rubro) {
      e.ia.rubro = r.rubro;
      e.ia.problema = r.problema ?? problemaDe(r.rubro);
    }
    if (r.foto) e.ia.foto = true;
  }
  ch.etapa++;
  burbuja(id, { de: 'vos', texto: r.propia ?? r.texto, foto: r.foto }, !m.reducido);
  ch.cola = r.respuestas.map((texto) => ({ de: 'otro', texto }));
  agregarFinal(e, id);
  seguirChat(m, id);
}

// ── Pantallas con tiempo ──────────────────────────────────────────────────

function entrarBuscando(_p: HTMLElement, m: Motor) {
  const e = S(m);
  if (e.buscado) {
    e.llegados = items.length;
    return;
  }
  e.llegados = 0;
  pintar(m);
  const tiempos = m.reducido ? [700, 1300, 1900] : [1100, 2000, 2800];
  tiempos.forEach((t, i) =>
    m.timeout(() => {
      e.llegados = i + 1;
      if (e.llegados >= items.length) e.buscado = true;
      pintar(m);
      if (e.buscado) m.guia(pantallaDe('u-buscando').querySelector('[data-guia]'));
    }, t),
  );
  // Si nadie toca nada, pasa solo a los presupuestos.
  m.timeout(() => {
    if (m.actual === 'u-buscando') m.ir('u-presupuestos');
  }, tiempos[tiempos.length - 1] + 2800);
}

function entrarSeguimiento(_p: HTMLElement, m: Motor) {
  const e = S(m);
  // Saltando a este paso desde el recorrido, el seguimiento se cuenta desde el principio
  // (aunque el turno se haya cancelado, terminado o el especialista ya haya llegado).
  if (m.saltando && (e.tc.cancelado || e.tc.terminado || e.tc.seg > 0)) {
    empezarTurno(e, { ...e.tc, seg: 0, terminado: false, cancelado: false, cambio: false });
    pintar(m);
  }
  // Un turno cancelado ya no se sigue: a Turnos (pasa si se vuelve acá después de cancelarlo).
  if (e.tc.cancelado) {
    m.timeout(() => m.raiz('u-turnos'), 0);
    return;
  }
  // Si el trabajo ya había terminado (se volvió a este paso del recorrido), el seguimiento arranca de nuevo.
  if (e.tc.terminado) empezarTurno(e, { ...e.tc, seg: 0, terminado: false, cambio: false });
  // Confirmado → en camino → llegó: avanza solo (o al tocar la barra de estados).
  const avanzar = () => {
    const t = S(m).tc;
    if (t.seg >= 2) return;
    t.seg++;
    pintar(m);
    m.guia(null);
    if (t.seg < 2) m.timeout(avanzar, 2200);
  };
  if (e.tc.seg < 2) m.timeout(avanzar, 2000);
}

function entrarChat(_p: HTMLElement, m: Motor) {
  const e = S(m);
  e.chatLeido = true;
  completarChat(m, 'u-chat');
  // Si ya se contestó y el especialista llegó después, ahora avisa que terminó.
  agregarFinal(e, 'u-chat');
  if (chatDe(e, 'u-chat').cola.length) seguirChat(m, 'u-chat');
}

function entrarTerminado(_p: HTMLElement, m: Motor) {
  // Esta pantalla es el trabajo terminado (también si se llega saltando al paso del recorrido).
  const e = S(m);
  Object.assign(e.tc, { terminado: true, cancelado: false, cambio: false, seg: 3 });
  // La calificación arranca de cero cada vez que se llega acá.
  Object.assign(e, { estrellas: 0, resEnviada: false });
  restaurar('u-resena');
}

function entrarPagos(p: HTMLElement, m: Motor) {
  const e = S(m);
  if (e.verPago < 0) return;
  // Desde "Ver el pago": se despliega el movimiento de ese turno y se pliegan los demás.
  const i = e.verPago;
  e.verPago = -1;
  p.querySelectorAll<HTMLElement>('[data-du-mov]').forEach((mov) => desplegar(mov.closest('.app-tarjeta'), Number(mov.dataset.duMov) === i));
  const tarjeta = p.querySelector(`[data-du-mov="${i}"]`)?.closest<HTMLElement>('.app-tarjeta');
  const lista = tarjeta?.closest<HTMLElement>('.du-scroll');
  if (tarjeta && lista) lista.scrollTop += tarjeta.getBoundingClientRect().top - lista.getBoundingClientRect().top;
}

// ── Acciones ──────────────────────────────────────────────────────────────

const num = (el: HTMLElement) => Number(el.dataset.valor);

/** Arranca un pedido nuevo (el turno confirmado no cambia). */
function nuevoPedido(e: Estado, rubro: string, problema: string) {
  Object.assign(e, {
    rubro,
    problema,
    tipo: ini.tipo,
    dia: ini.dia,
    franja: ini.franja,
    diaTocado: false,
    fotos: 0,
    pres: ini.presupuesto,
    pago: ini.pago,
    buscado: false,
    llegados: 0,
  });
}

/** Pone un turno como el confirmado: el chat con el especialista, los avisos y la calificación arrancan de cero. */
function empezarTurno(e: Estado, tc: Turno) {
  e.tc = tc;
  Object.assign(e, {
    turno: 0,
    origen: 'turnos',
    cambioDia: Math.min(tc.dia + 1, dias.length - 1),
    cambioFranja: tc.franja,
    avisos: [],
    chatLeido: false,
    estrellas: 0,
    resEnviada: false,
  });
  delete e.chats['u-chat'];
  restaurar('u-chat');
  restaurar('u-resena');
}

/** El pedido pasa a ser el turno confirmado, con el día y la franja que propuso el especialista elegido. */
function confirmarTurno(e: Estado) {
  const pr = propuesta(e.tipo, e.dia, e.franja, e.pres);
  empezarTurno(e, {
    rubro: e.rubro,
    problema: e.problema,
    tipo: e.tipo,
    dia: pr.dia,
    franja: pr.franja,
    pres: e.pres,
    pago: e.pago,
    seg: 0,
    terminado: false,
    cancelado: false,
    cambio: false,
  });
}

const acciones: Record<string, (el: HTMLElement, m: Motor) => void> = {
  rubro(el, m) {
    nuevoPedido(S(m), el.dataset.valor!, problemaDe(el.dataset.valor!));
  },
  tarea(el, m) {
    const t = d.inicio.tareas[num(el)];
    nuevoPedido(S(m), t.rubro, t.problema);
  },
  urgencia(el, m) {
    const e = S(m);
    nuevoPedido(e, el.dataset.valor!, problemaDe(el.dataset.valor!));
    e.tipo = 0;
    e.dia = 0;
  },
  tipo(el, m) {
    const e = S(m);
    e.tipo = num(el);
    if (e.tipo === 0) e.dia = 0;
  },
  dia(el, m) {
    const e = S(m);
    e.dia = num(el);
    e.diaTocado = true;
  },
  franja(el, m) {
    S(m).franja = num(el);
  },
  foto(_el, m) {
    const e = S(m);
    e.fotos = Math.min(2, e.fotos + 1);
  },
  pedir(_el, m) {
    S(m).buscado = false;
  },
  presupuesto(el, m) {
    S(m).pres = num(el);
  },
  pago(el, m) {
    S(m).pago = num(el);
  },
  confirmar(_el, m) {
    confirmarTurno(S(m));
  },
  'seg-avanzar'(_el, m) {
    const t = S(m).tc;
    if (t.seg < 2) t.seg++;
  },
  llegada(_el, m) {
    S(m).tc.seg = 3;
  },
  pagar(_el, m) {
    S(m).tc.pago = 0;
  },
  chat(el, m) {
    const [id, etapa, i] = (el.dataset.valor ?? '').split(':');
    responder(m, id as IdChat, Number(etapa), Number(i));
  },
  /** El avión de enviar: manda la primera respuesta rápida, si hay. */
  enviar(el, m) {
    const id = el.dataset.valor as IdChat;
    const e = S(m);
    const etapa = chatDe(e, id).etapa;
    if (condiciones(e)[`chat:${id}:${etapa}`]) responder(m, id, etapa, 0);
    else avisar(m, d.comun.enviarDemo);
  },
  terminar(_el, m) {
    const t = S(m).tc;
    t.terminado = true;
    t.seg = 3;
  },
  estrellas(el, m) {
    S(m).estrellas = num(el);
    sinGuia(el, '[data-du-grupo="estrellas"]');
  },
  chip(el) {
    el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true'));
  },
  'enviar-resena'(_el, m) {
    S(m).resEnviada = true;
  },
  'handia-pedir'(el, m) {
    // Recién acá lo que se le contó a HandIA pasa a ser el pedido.
    const e = S(m);
    nuevoPedido(e, e.ia.rubro, e.ia.problema);
    e.fotos = e.ia.foto ? 1 : 0;
    if (el.dataset.valor === 'hoy') {
      e.tipo = 0;
      e.dia = 0;
    } else {
      e.tipo = 1;
    }
  },
  turno(el, m) {
    const e = S(m);
    e.turno = num(el);
    e.origen = 'turnos';
  },
  'turno-seg'(_el, m) {
    const e = S(m);
    e.turno = 0;
    e.origen = 'seg';
  },
  'ver-pago'(_el, m) {
    const e = S(m);
    e.verPago = e.turno;
  },
  desde(el, m) {
    const e = S(m);
    e.desde = el.dataset.valor ?? 'detalle';
    if (e.desde === 'seg') e.turno = 0;
  },
  'cambio-dia'(el, m) {
    S(m).cambioDia = num(el);
  },
  'cambio-franja'(el, m) {
    S(m).cambioFranja = num(el);
  },
  'pedir-cambio'(_el, m) {
    S(m).tc.cambio = true;
  },
  'cancelar-turno'(_el, m) {
    const e = S(m);
    e.tc.cancelado = true;
    e.tc.cambio = false;
    // Si se canceló desde el seguimiento, el turno ya no se sigue: a Turnos.
    if (e.desde === 'seg') m.raiz('u-turnos');
  },
  mov(el) {
    desplegar(el.closest('.app-tarjeta'), el.getAttribute('aria-expanded') !== 'true');
  },
  pregunta(el, m) {
    const e = S(m);
    e.pregunta = num(el);
    e.sirvio = false;
  },
  sirvio(_el, m) {
    S(m).sirvio = true;
  },
  aviso(el, m) {
    const clave = el.dataset.valor;
    const avisos = d.comun.avisos as Record<string, string>;
    avisar(m, (clave && avisos[clave]) || d.comun.avisoDemo);
  },
  'aviso-borrar'(el, m) {
    const e = S(m);
    if (!e.avisos.includes(num(el))) e.avisos.push(num(el));
  },
  'avisos-borrar'(_el, m) {
    S(m).avisos = d.notificaciones.avisos.map((_, i) => i);
  },
};

// Después de cada acción se vuelve a pintar (antes de que el motor busque lo próximo para tocar).
const conPintar = Object.fromEntries(
  Object.entries(acciones).map(([k, fn]) => [
    k,
    (el: HTMLElement, m: Motor) => {
      fn(el, m);
      pintar(m);
    },
  ]),
);

// ── Entrar a cada pantalla ────────────────────────────────────────────────

const especiales: Record<string, (p: HTMLElement, m: Motor) => void> = {
  'u-buscando': entrarBuscando,
  'u-seguimiento': entrarSeguimiento,
  'u-chat': entrarChat,
  'u-handia': (_p, m) => completarChat(m, 'u-handia'),
  'u-soporte': (_p, m) => completarChat(m, 'u-soporte'),
  'u-terminado': entrarTerminado,
  'u-pagos': entrarPagos,
};

const entrar: Record<string, (p: HTMLElement, m: Motor) => void> = Object.fromEntries(
  Object.keys(d.titulos).map((id) => [
    id,
    (p: HTMLElement, m: Motor) => {
      p.querySelectorAll('.du-toast').forEach((t) => t.remove());
      especiales[id]?.(p, m);
      pintar(m);
    },
  ]),
);

registrarRol('usuario', {
  acciones: conPintar,
  entrar,
  reiniciar() {
    fotografiar();
    originales.forEach((html, p) => {
      if (p.innerHTML !== html) p.innerHTML = html;
    });
  },
});
