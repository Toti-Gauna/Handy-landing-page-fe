// Demo · comportamiento del lado del usuario (acciones y pantallas dinámicas).
//
// El HTML sale de src/render/demo/usuario.ts con el estado inicial. Acá se guarda lo que se va eligiendo
// (en m.estado, que el motor vacía al reiniciar) y se vuelve a pintar todo lo marcado con data-du-*:
//   data-du-tpl, data-du-icono, data-du-ver, data-du-habilitar, data-du-grupo, data-du-rueda, data-du-dia.
// Todo lo temporizado usa m.timeout (se cancela solo al salir de la pantalla).

import '../../styles/demo-usuario.css';
import d from '../../content/demo-usuario.json';
import rubrosJson from '../../content/rubros.json';
import { registrarRol, type Motor } from './motor';
import { completar, formatoPesos, TARIFAS, tarifaCliente, totalCliente } from './util';

// ── Estado ────────────────────────────────────────────────────────────────

type IdChat = 'u-chat' | 'u-handia' | 'u-soporte';

interface Msg {
  de: string;
  texto: string;
  foto?: boolean;
}

interface EstadoChat {
  etapa: number;
  cola: Msg[];
  escribiendo: boolean;
}

interface Estado {
  rubro: string;
  problema: string;
  tipo: number;
  dia: number;
  franja: number;
  fotos: number;
  pres: number;
  pago: number;
  buscado: boolean;
  llegados: number;
  seg: number;
  terminado: boolean;
  cancelado: boolean;
  estrellas: number;
  resEnviada: boolean;
  turno: number;
  desde: string;
  cambioDia: number;
  cambioFranja: number;
  cambio: boolean;
  pregunta: number;
  sirvio: boolean;
  avisos: number[];
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

const CHATS: Record<IdChat, { etapas: { rapidas: { texto: string; respuestas: string[]; foto?: boolean; propia?: string; rubro?: string; problema?: string }[] }[]; final?: string[] }> = {
  'u-chat': { etapas: d.chat.etapas, final: d.chat.final },
  'u-handia': { etapas: d.handia.etapas },
  'u-soporte': { etapas: d.soporte.etapas },
};

function S(m: Motor): Estado {
  const e = m.estado as Partial<Estado> & { _listo?: boolean };
  if (!e._listo) {
    const base: Estado = {
      rubro: ini.rubro,
      problema: problemaDe(ini.rubro),
      tipo: ini.tipo,
      dia: ini.dia,
      franja: ini.franja,
      fotos: 0,
      pres: ini.presupuesto,
      pago: ini.pago,
      buscado: false,
      llegados: 0,
      seg: 0,
      terminado: false,
      cancelado: false,
      estrellas: 0,
      resEnviada: false,
      turno: 0,
      desde: 'detalle',
      cambioDia: Math.min(ini.dia + 1, dias.length - 1),
      cambioFranja: ini.franja,
      cambio: false,
      pregunta: 0,
      sirvio: false,
      avisos: [],
      chats: {},
    };
    Object.assign(e, base, { _listo: true });
  }
  return e as Estado;
}

const chatDe = (e: Estado, id: string) => (e.chats[id] ??= { etapa: 0, cola: [], escribiendo: false });

const precioDe = (i: number) => {
  const it = items[i];
  return 'precio' in it && typeof it.precio === 'number' ? it.precio : TARIFAS.ejemplo.presupuesto;
};

// ── Valores y condiciones (lo que se pinta) ───────────────────────────────

function valores(e: Estado): Record<string, string> {
  const r = RUBROS.get(e.rubro)!;
  const dia = dias[e.dia];
  const sig = dias[Math.min(e.dia + 1, dias.length - 1)];
  const it = items[e.pres];
  const p = precioDe(e.pres);
  const v: Record<string, string> = {
    tarifaCliente: `${TARIFAS.normal.cliente}%`,
    rubro: r.nombre,
    tipo: d.opciones.items[e.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    diaSiguiente: sig.corto,
    fecha: dia.fecha,
    franja: franjas[e.franja],
    esp: it.nombre,
    zona: it.zona,
    declaro: it.declaro,
    otro: it.otros.find((o) => o !== r.nombre) ?? '',
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaCliente(p)),
    total: formatoPesos(totalCliente(p)),
    problema: e.problema,
    estado: e.cancelado ? d.turnos.estados.cancelado : e.terminado ? d.turnos.estados.terminado : d.turnos.estados.confirmado,
  };
  v.cuando = completar(fm.cuando, v);
  v.horarioEsp = completar(it.horario, v);
  items.forEach((x, i) => (v[`horario${i}`] = completar(x.horario, v)));
  v.cambio = completar(fm.cuando, { diaCorto: dias[e.cambioDia].corto, franja: franjas[e.cambioFranja] });

  // Turno elegido en Turnos (0 = el del recorrido).
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
    const t = pasados[e.turno - 1];
    Object.assign(v, {
      tRubro: RUBROS.get(t.rubro)!.nombre,
      tTipo: t.tipo,
      tDia: t.largo,
      tFecha: t.fecha,
      tFranja: t.franja,
      tEsp: t.especialista,
      tPrecio: formatoPesos(t.precio),
      tTarifa: formatoPesos(tarifaCliente(t.precio)),
      tTotal: formatoPesos(totalCliente(t.precio)),
      tEstado: d.turnos.estados.terminado,
    });
  }
  return v;
}

/** Rubro (id) de cada ícono dinámico. */
const iconos = (e: Estado): Record<string, string> => ({
  rubro: e.rubro,
  tRubro: e.turno === 0 ? e.rubro : pasados[e.turno - 1].rubro,
});

function condiciones(e: Estado): Record<string, boolean> {
  const flujo = e.turno === 0;
  const c: Record<string, boolean> = {
    foto1: e.fotos >= 1,
    foto2: e.fotos >= 2,
    puedeFoto: e.fotos < 2,
    buscListo: e.llegados >= items.length,
    segLlego: e.seg === 2,
    hayOtro: valores(e).otro !== '',
    pagoAhora: e.pago === 0,
    pagoDespues: e.pago === 1,
    resSin: e.estrellas === 0,
    resBien: e.estrellas >= 4,
    resMal: e.estrellas > 0 && e.estrellas < 4,
    resConEstrellas: e.estrellas > 0,
    resEnviada: e.resEnviada,
    tFlujo: flujo,
    tActivo: flujo && !e.terminado && !e.cancelado,
    tPagado: !flujo || (!e.cancelado && (e.pago === 0 || e.terminado)),
    tCambio: flujo && e.cambio && !e.cancelado && !e.terminado,
    tCancelado: flujo && e.cancelado,
    sirvio: e.sirvio,
    avisosVacio: e.avisos.length >= d.notificaciones.avisos.length,
  };
  d.buscando.estados.forEach((_, i) => (c[`busc${i}`] = e.llegados === i));
  items.forEach((_, i) => (c[`llego${i + 1}`] = e.llegados >= i + 1));
  d.seguimiento.estados.forEach((_, i) => (c[`seg${i}`] = e.seg === i));
  d.ayuda.preguntas.forEach((_, i) => (c[`resp${i}`] = e.pregunta === i));
  d.notificaciones.avisos.forEach((_, i) => (c[`aviso${i}`] = !e.avisos.includes(i)));
  (Object.keys(CHATS) as IdChat[]).forEach((id) => {
    const ch = chatDe(e, id);
    const libre = ch.cola.length === 0 && !ch.escribiendo;
    CHATS[id].etapas.forEach((_, n) => (c[`chat:${id}:${n}`] = libre && ch.etapa === n));
    c[`final:${id}`] = libre && ch.etapa >= CHATS[id].etapas.length;
  });
  return c;
}

// ── Pintar ────────────────────────────────────────────────────────────────

const mias = (sel: string) => document.querySelectorAll<HTMLElement>(`.demo-pantalla[data-rol="usuario"] ${sel}`);
const pantallaDe = (id: string) => document.querySelector<HTMLElement>(`.demo-pantalla[data-pantalla="${id}"]`)!;

function svgRubro(id: string): Node | null {
  const svg = pantallaDe('u-inicio')?.querySelector(`[data-accion="rubro"][data-valor="${id}"] svg`);
  return svg ? svg.cloneNode(true) : null;
}

function pintar(m: Motor) {
  const e = S(m);
  const v = valores(e);
  const c = condiciones(e);
  const ic = iconos(e);

  mias('[data-du-tpl]').forEach((el) => {
    const t = completar(el.dataset.duTpl!, v);
    if (el.textContent !== t) el.textContent = t;
  });
  mias('[data-du-icono]').forEach((el) => {
    const id = ic[el.dataset.duIcono!];
    // El build pinta todos los íconos con el rubro inicial.
    if (!id || (el.dataset.duActual ?? ini.rubro) === id) return;
    const svg = svgRubro(id);
    if (!svg) return;
    el.replaceChildren(svg);
    el.dataset.duActual = id;
  });
  const cumple = (cond: string) => (cond.startsWith('!') ? !c[cond.slice(1)] : !!c[cond]);
  mias('[data-du-ver]').forEach((el) => {
    const oculto = !cumple(el.dataset.duVer!);
    if (el.hidden !== oculto) el.hidden = oculto;
  });
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
  // Calendario: el día del turno del recorrido.
  mias('[data-du-dia]').forEach((el) => {
    const b = el as HTMLButtonElement;
    const sel = Number(b.dataset.duDia) === e.dia && !e.cancelado;
    b.disabled = !sel;
    b.classList.toggle('app-dia--azul', sel);
    b.classList.toggle('app-dia--hoy', !sel && Number(b.dataset.num) === d.turnos.hoy);
  });
  const seg = pantallaDe('u-seguimiento')?.querySelector<HTMLElement>('[data-du-seg]');
  if (seg) seg.dataset.duSeg = String(e.seg);
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

// ── Chats guionados ───────────────────────────────────────────────────────

function burbuja(pantalla: HTMLElement, msg: Msg, nueva: boolean): HTMLElement {
  const div = document.createElement('div');
  div.className = `app-burbuja app-burbuja--${msg.de === 'vos' ? 'propia' : 'otra'}${msg.foto ? ' app-burbuja--foto' : ''}${nueva ? ' du-nueva' : ''}`;
  if (msg.foto) {
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
      burbuja(p, { ...msg, texto: completar(msg.texto, valores(e)) }, !m.reducido);
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
  ch.cola.splice(0).forEach((msg) => burbuja(p, { ...msg, texto: completar(msg.texto, valores(e)) }, false));
}

function tocarRapida(el: HTMLElement, m: Motor) {
  const [id, etapa, i] = (el.dataset.valor ?? '').split(':') as [IdChat, string, string];
  const conf = CHATS[id];
  const e = S(m);
  const ch = chatDe(e, id);
  if (!conf || Number(etapa) !== ch.etapa || ch.escribiendo || ch.cola.length) return;
  const r = conf.etapas[ch.etapa].rapidas[Number(i)];
  if (!r) return;
  if (r.rubro) {
    e.rubro = r.rubro;
    e.problema = r.problema ?? problemaDe(r.rubro);
  }
  ch.etapa++;
  burbuja(pantallaDe(id), { de: 'vos', texto: r.propia ?? r.texto, foto: r.foto }, !m.reducido);
  ch.cola = r.respuestas.map((texto) => ({ de: 'otro', texto }));
  if (ch.etapa >= conf.etapas.length && conf.final) ch.cola.push(...conf.final.map((texto) => ({ de: 'otro', texto })));
  seguirChat(m, id);
}

// ── Pantallas con tiempo ──────────────────────────────────────────────────

function entrarBuscando(_p: HTMLElement, m: Motor) {
  const e = S(m);
  if (e.buscado) {
    e.llegados = items.length;
    pintar(m);
    return;
  }
  e.llegados = 0;
  pintar(m);
  const tiempos = m.reducido ? [700, 1300, 1900] : [1300, 2400, 3400];
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

function entrarSeguimiento(p: HTMLElement, m: Motor) {
  const e = S(m);
  pintar(m);
  if (e.seg >= 3) marcarChat(p);
  const avanzar = () => {
    if (e.seg >= 2) return;
    e.seg++;
    pintar(m);
    if (e.seg === 2) m.guia(p.querySelector('.du-llegada [data-guia]'));
    else m.timeout(avanzar, 2200);
  };
  if (e.seg < 2) m.timeout(avanzar, 2000);
}

/** Después de confirmar la llegada, lo próximo es el chat. */
function marcarChat(p: HTMLElement) {
  p.querySelector('[data-du-chat-boton]')?.setAttribute('data-guia', '');
}

// ── Acciones ──────────────────────────────────────────────────────────────

const num = (el: HTMLElement) => Number(el.dataset.valor);

const acciones: Record<string, (el: HTMLElement, m: Motor) => void> = {
  rubro(el, m) {
    const e = S(m);
    e.rubro = el.dataset.valor!;
    e.problema = problemaDe(e.rubro);
  },
  tarea(el, m) {
    const e = S(m);
    const t = d.inicio.tareas[num(el)];
    e.rubro = t.rubro;
    e.problema = t.problema;
  },
  urgencia(el, m) {
    const e = S(m);
    e.rubro = el.dataset.valor!;
    e.problema = problemaDe(e.rubro);
    e.tipo = 0;
    e.dia = 0;
  },
  tipo(el, m) {
    const e = S(m);
    e.tipo = num(el);
    if (e.tipo === 0) e.dia = 0;
  },
  dia(el, m) {
    S(m).dia = num(el);
    sinGuia(el, '[data-du-grupo="dia"]');
  },
  franja(el, m) {
    S(m).franja = num(el);
  },
  foto(el, m) {
    const e = S(m);
    e.fotos = Math.min(2, e.fotos + 1);
    el.removeAttribute('data-guia');
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
    const e = S(m);
    Object.assign(e, { seg: 0, terminado: false, cancelado: false, cambio: false, turno: 0 });
  },
  'seg-avanzar'(_el, m) {
    const e = S(m);
    if (e.seg < 2) e.seg++;
    if (e.seg === 2) m.guia(pantallaDe('u-seguimiento').querySelector('.du-llegada [data-guia]'));
  },
  llegada(_el, m) {
    S(m).seg = 3;
    marcarChat(pantallaDe('u-seguimiento'));
  },
  chat: tocarRapida,
  terminar(_el, m) {
    const e = S(m);
    e.terminado = true;
    e.seg = 3;
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
    const e = S(m);
    e.buscado = false;
    if (el.dataset.ir === 'u-programar') e.tipo = 1;
  },
  turno(el, m) {
    S(m).turno = num(el);
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
    S(m).cambio = true;
  },
  'cancelar-turno'(_el, m) {
    const e = S(m);
    e.cancelado = true;
    e.cambio = false;
    // Si se canceló desde el seguimiento, el turno ya no se sigue: a Turnos.
    if (e.desde === 'seg') m.raiz('u-turnos');
  },
  mov(el) {
    const abierto = el.getAttribute('aria-expanded') === 'true';
    const tarjeta = el.closest('.app-tarjeta');
    el.setAttribute('aria-expanded', String(!abierto));
    tarjeta?.querySelector<HTMLElement>('[data-du-mov]')?.toggleAttribute('hidden', abierto);
    el.querySelector<HTMLElement>('[data-du-mas]')?.toggleAttribute('hidden', !abierto);
    el.querySelector<HTMLElement>('[data-du-menos]')?.toggleAttribute('hidden', abierto);
  },
  pregunta(el, m) {
    const e = S(m);
    e.pregunta = num(el);
    e.sirvio = false;
  },
  sirvio(_el, m) {
    S(m).sirvio = true;
  },
  aviso(_el, m) {
    avisar(m, d.comun.avisoDemo);
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
  'u-chat': (_p, m) => completarChat(m, 'u-chat'),
  'u-handia': (_p, m) => completarChat(m, 'u-handia'),
  'u-soporte': (_p, m) => completarChat(m, 'u-soporte'),
};

const entrar: Record<string, (p: HTMLElement, m: Motor) => void> = Object.fromEntries(
  Object.keys(d.titulos).map((id) => [
    id,
    (p: HTMLElement, m: Motor) => {
      p.querySelectorAll('.du-toast').forEach((t) => t.remove());
      pintar(m);
      especiales[id]?.(p, m);
    },
  ]),
);

// ── Reiniciar: el DOM vuelve a como salió del build ────────────────────────

const originales = new Map<HTMLElement, string>();

function fotografiar() {
  if (originales.size) return;
  document.querySelectorAll<HTMLElement>('.demo-pantalla[data-rol="usuario"]').forEach((p) => originales.set(p, p.innerHTML));
}

fotografiar();

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
