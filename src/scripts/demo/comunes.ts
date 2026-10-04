// Comportamiento de las piezas comunes a los dos lados (ver src/render/demo/comunes.ts):
// elegir fecha y hora, agenda por día, contactos y tarjetas de solicitud/propuesta en los chats.
//
// API para los módulos de cada rol:
//   pedirFecha(m, { valor?, alElegir })   abre la hoja del calendario; alElegir(fecha) corre al cerrarla.
//   pedirHora(m, { valor?, alElegir })    abre la hoja de la hora (00:00 a 23:59).
//   agregarPropuesta(lista, m, opciones)  suma una tarjeta al chat (solicitud, propuesta, cambio o adicional).
//   responderPropuesta(m, id, r)          la otra persona responde (los eventos mock de la demo).
//   agregarTrabajoAgenda(rol, li)         suma un trabajo a la agenda (p. ej., un turno aceptado en el chat).
//   agregarContacto(m, id)                lo mismo que tocar "Agregar a contactos".
// Las fechas son de Argentina y la demo transcurre en demo.json → config.hoy: no se eligen fechas pasadas.

import demo from '../../content/demo.json';
import { registrarRol, type Motor, type Rol } from './motor';
import { esPasada, fechaLarga, grillaMes, horaTexto, nombreMes, partes, sumarMeses, type FechaISO, type Hora } from '../../demo/fechas';
import { responder, type EstadoPropuesta } from '../../demo/propuestas';

export const HOY: FechaISO = demo.config.hoy;
export const PRECIO_MINIMO: number = demo.config.precioMinimo;

const completar = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const pre = (rol: Rol) => (rol === 'usuario' ? 'u' : 'e');

interface Comun {
  fecha?: { valor?: FechaISO; mes: { anio: number; mes: number }; alElegir: (f: FechaISO, m: Motor) => void };
  hora?: { valor: Hora; alElegir: (h: Hora, m: Motor) => void };
  agenda?: { mes: { anio: number; mes: number }; dia: FechaISO };
  contactos?: string[];
  propuestas?: Record<string, { estado: EstadoPropuesta; alResponder?: (r: 'aceptar' | 'rechazar', m: Motor) => void }>;
}

/** Estado de las piezas comunes (se vacía con "Volver a empezar", como el resto de m.estado). */
const comun = (m: Motor): Comun => ((m.estado.__comun as Comun | undefined) ?? (m.estado.__comun = {})) as Comun;

/** Después de cerrar una hoja: la navegación que pida alElegir se hace sobre la pantalla de abajo. */
const despues = (fn: () => void) => window.setTimeout(fn, 0);

// ── Calendario (lo usan la hoja de fecha y la agenda) ─────────────────────

function pintarGrilla(
  grilla: HTMLElement,
  titulo: HTMLElement | null,
  anio: number,
  mes: number,
  o: { elegido?: FechaISO; accion: string; bloquearPasadas: boolean; cantidad?: Record<string, number> },
) {
  const s = demo.selectorFecha;
  const a = demo.agenda;
  if (titulo) titulo.textContent = nombreMes(anio, mes);
  grilla.replaceChildren(
    ...grillaMes(anio, mes).map((f) => {
      if (!f) {
        const vacio = document.createElement('span');
        vacio.className = 'hd-cal__hueco';
        return vacio;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hd-cal__dia';
      b.dataset.accion = o.accion;
      b.dataset.valor = f;
      const n = o.cantidad?.[f] ?? 0;
      const pasada = esPasada(f, HOY);
      b.classList.toggle('hd-cal__dia--hoy', f === HOY);
      b.classList.toggle('hd-cal__dia--con', n > 0);
      b.classList.toggle('hd-cal__dia--pasado', pasada);
      b.setAttribute('aria-pressed', String(f === o.elegido));
      const num = document.createElement('span');
      num.textContent = String(partes(f).dia);
      b.append(num);
      if (n > 0) {
        const puntos = document.createElement('i');
        puntos.className = 'hd-cal__puntos';
        puntos.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < Math.min(n, 3); i++) puntos.append(document.createElement('b'));
        b.append(puntos);
      }
      const texto = fechaLarga(f);
      if (o.bloquearPasadas && pasada) {
        b.disabled = true;
        b.setAttribute('aria-label', completar(s.pasadaAria, { fecha: texto }));
      } else if (o.cantidad) {
        b.setAttribute('aria-label', completar(a.diaAria, { fecha: texto, cantidad: n === 0 ? a.ninguno : n === 1 ? a.uno : completar(a.varios, { n }) }));
      } else {
        b.setAttribute('aria-label', f === HOY ? `${s.hoy}, ${texto}` : texto);
      }
      return b;
    }),
  );
}

// ── Elegir fecha ──────────────────────────────────────────────────────────

export function pedirFecha(m: Motor, o: { valor?: FechaISO; alElegir: (f: FechaISO, m: Motor) => void }) {
  const valor = o.valor && !esPasada(o.valor, HOY) ? o.valor : undefined;
  const { anio, mes } = partes(valor ?? HOY);
  comun(m).fecha = { valor, mes: { anio, mes }, alElegir: o.alElegir };
  m.ir(`${pre(m.rol)}-elegir-fecha`);
}

function pintarFecha(hoja: HTMLElement, m: Motor) {
  const st = comun(m).fecha;
  const raiz = hoja.querySelector<HTMLElement>('[data-hd-sel-fecha]');
  if (!st || !raiz) return;
  pintarGrilla(raiz.querySelector('[data-hd-sel-grilla]')!, raiz.querySelector('[data-hd-sel-titulo]'), st.mes.anio, st.mes.mes, {
    elegido: st.valor,
    accion: 'hd-fecha-dia',
    bloquearPasadas: true,
  });
  const hoyMes = partes(HOY);
  const anterior = raiz.querySelector<HTMLButtonElement>('[data-accion="hd-fecha-mes"][data-valor="-1"]');
  if (anterior) anterior.disabled = st.mes.anio * 12 + st.mes.mes <= hoyMes.anio * 12 + hoyMes.mes;
  const listo = raiz.querySelector<HTMLButtonElement>('[data-hd-sel-listo]')!;
  listo.disabled = !st.valor;
  listo.textContent = st.valor ? completar(demo.selectorFecha.listo, { fecha: fechaLarga(st.valor) }) : demo.selectorFecha.sinElegir;
  m.guia(st.valor ? listo : raiz.querySelector('.hd-cal__dia:not(:disabled)'));
}

// ── Elegir hora ───────────────────────────────────────────────────────────

export function pedirHora(m: Motor, o: { valor?: Hora; alElegir: (h: Hora, m: Motor) => void }) {
  comun(m).hora = { valor: o.valor ?? { h: 9, m: 0 }, alElegir: o.alElegir };
  m.ir(`${pre(m.rol)}-elegir-hora`);
}

function opcion(rueda: HTMLElement, v: number) {
  return rueda.querySelector<HTMLElement>(`.hd-rueda__op[data-valor="${v}"]`);
}

function centrar(rueda: HTMLElement, v: number, suave: boolean) {
  const op = opcion(rueda, v);
  if (!op) return;
  rueda.scrollTo({ top: op.offsetTop - (rueda.clientHeight - op.offsetHeight) / 2, behavior: suave ? 'smooth' : 'auto' });
}

function pintarHora(hoja: HTMLElement, m: Motor) {
  const st = comun(m).hora;
  if (!st) return;
  hoja.querySelectorAll<HTMLElement>('.hd-rueda').forEach((r) => {
    const v = r.dataset.hdRueda === 'h' ? st.valor.h : st.valor.m;
    r.querySelectorAll<HTMLElement>('.hd-rueda__op').forEach((op) => op.setAttribute('aria-selected', String(Number(op.dataset.valor) === v)));
  });
  const listo = hoja.querySelector<HTMLButtonElement>('[data-hd-sel-listo]');
  if (listo) listo.textContent = completar(demo.selectorHora.listo, { hora: horaTexto(st.valor) });
}

function montarRuedas(hoja: HTMLElement, m: Motor) {
  const st = comun(m).hora;
  if (!st) return;
  pintarHora(hoja, m);
  const ruedas = [...hoja.querySelectorAll<HTMLElement>('.hd-rueda')];
  // Centrar después de que la hoja tenga tamaño.
  requestAnimationFrame(() => ruedas.forEach((r) => centrar(r, r.dataset.hdRueda === 'h' ? st.valor.h : st.valor.m, false)));
  const limpiezas = ruedas.map((r) => {
    let t = 0;
    // Al soltar la rueda, queda elegido el valor del medio (como en el celular).
    const alScrollear = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const medio = r.scrollTop + r.clientHeight / 2;
        let mejor: HTMLElement | null = null;
        let dist = Infinity;
        r.querySelectorAll<HTMLElement>('.hd-rueda__op').forEach((op) => {
          const d = Math.abs(op.offsetTop + op.offsetHeight / 2 - medio);
          if (d < dist) {
            dist = d;
            mejor = op;
          }
        });
        if (!mejor) return;
        const v = Number((mejor as HTMLElement).dataset.valor);
        const actual = comun(m).hora;
        if (!actual) return;
        actual.valor = r.dataset.hdRueda === 'h' ? { ...actual.valor, h: v } : { ...actual.valor, m: v };
        pintarHora(hoja, m);
      }, 120);
    };
    // Teclado: flechas arriba/abajo cambian el valor.
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      e.stopPropagation();
      const actual = comun(m).hora;
      if (!actual) return;
      const max = r.dataset.hdRueda === 'h' ? 24 : 60;
      const paso = e.key === 'ArrowUp' ? -1 : 1;
      const v = ((r.dataset.hdRueda === 'h' ? actual.valor.h : actual.valor.m) + paso + max) % max;
      actual.valor = r.dataset.hdRueda === 'h' ? { ...actual.valor, h: v } : { ...actual.valor, m: v };
      pintarHora(hoja, m);
      centrar(r, v, !m.reducido);
    };
    r.addEventListener('scroll', alScrollear, { passive: true });
    r.addEventListener('keydown', alTeclado);
    return () => {
      window.clearTimeout(t);
      r.removeEventListener('scroll', alScrollear);
      r.removeEventListener('keydown', alTeclado);
    };
  });
  return () => limpiezas.forEach((f) => f());
}

// ── Agenda ────────────────────────────────────────────────────────────────

const agendas = (raiz: ParentNode) => [...raiz.querySelectorAll<HTMLElement>('[data-hd-agenda]')];

function cantidadPorDia(pantalla: HTMLElement): Record<string, number> {
  const r: Record<string, number> = {};
  pantalla.querySelectorAll<HTMLElement>('[data-hd-trabajo]').forEach((li) => {
    const f = li.dataset.fecha!;
    r[f] = (r[f] ?? 0) + 1;
  });
  return r;
}

function pintarAgenda(pantalla: HTMLElement, m: Motor) {
  const raiz = pantalla.querySelector<HTMLElement>('[data-hd-agenda]');
  if (!raiz) return;
  const st = (comun(m).agenda ??= (() => {
    const dia = raiz.dataset.inicial ?? HOY;
    const { anio, mes } = partes(dia);
    return { mes: { anio, mes }, dia };
  })());
  pintarGrilla(raiz.querySelector('[data-hd-agenda-grilla]')!, raiz.querySelector('[data-hd-agenda-titulo]'), st.mes.anio, st.mes.mes, {
    elegido: st.dia,
    accion: 'hd-agenda-dia',
    bloquearPasadas: false,
    cantidad: cantidadPorDia(pantalla),
  });
  const items = [...pantalla.querySelectorAll<HTMLElement>('[data-hd-trabajo]')];
  let n = 0;
  items.forEach((li) => {
    const ver = li.dataset.fecha === st.dia;
    li.hidden = !ver;
    if (ver) n++;
  });
  const a = demo.agenda;
  const fecha = pantalla.querySelector<HTMLElement>('[data-hd-agenda-fecha]');
  if (fecha) fecha.textContent = `${fechaLarga(st.dia)} · ${n === 0 ? a.ninguno : n === 1 ? a.uno : completar(a.varios, { n })}`;
  const vacio = pantalla.querySelector<HTMLElement>('[data-hd-agenda-vacio]');
  if (vacio) vacio.hidden = n > 0;
}

/** Suma un trabajo a la agenda de un rol (un <li data-hd-trabajo data-fecha> ya armado). */
export function agregarTrabajoAgenda(rol: Rol, li: HTMLElement) {
  const lista = document.querySelector(`[data-hd-agenda][data-rol-agenda="${rol}"]`)?.closest('.demo-pantalla')?.querySelector('.hd-agenda__lista');
  lista?.append(li);
}

// ── Contactos ─────────────────────────────────────────────────────────────

function pintarContactos(m: Motor) {
  const lista = comun(m).contactos ?? [];
  const p = pre(m.rol);
  document.querySelectorAll<HTMLElement>(`[data-pantalla="${p}-contactos"] [data-hd-contacto]`).forEach((li) => {
    li.hidden = !(li.dataset.guardado === 'true' || lista.includes(li.dataset.hdContacto!));
  });
  const pantalla = document.querySelector<HTMLElement>(`[data-pantalla="${p}-contactos"]`);
  const vacio = pantalla?.querySelector<HTMLElement>('[data-hd-contactos-vacio]');
  if (vacio) vacio.hidden = !!pantalla?.querySelector('[data-hd-contacto]:not([hidden])');
  document.querySelectorAll<HTMLButtonElement>(`[data-rol="${m.rol}"] [data-hd-contacto-btn]`).forEach((b) => {
    const id = b.dataset.hdContactoBtn!;
    const ya = lista.includes(id) || !!document.querySelector(`[data-pantalla="${p}-contactos"] [data-hd-contacto="${id}"][data-guardado="true"]`);
    b.setAttribute('aria-pressed', String(ya));
    b.disabled = ya;
  });
}

/** Lo mismo que tocar "Agregar a contactos" (no duplica). */
export function agregarContacto(m: Motor, id: string) {
  const st = comun(m);
  const lista = st.contactos ?? [];
  const li = document.querySelector<HTMLElement>(`[data-pantalla="${pre(m.rol)}-contactos"] [data-hd-contacto="${id}"]`);
  if (lista.includes(id) || li?.dataset.guardado === 'true') return;
  st.contactos = [...lista, id];
  pintarContactos(m);
  const nombre = li?.querySelector('strong')?.textContent ?? '';
  m.isla({ titulo: demo.contactos.agregado, texto: completar(demo.contactos.agregadoIsla, { nombre }), icono: 'contactos', tono: 'exito' });
}

// ── Tarjetas de solicitud / propuesta en el chat ──────────────────────────

export type TipoPropuesta = 'solicitud' | 'propuesta' | 'cambio' | 'adicional';

export interface DatoPropuesta {
  etiqueta: string;
  valor: string;
  /** Resaltado (el total, el precio). */
  destacado?: boolean;
}

export interface OpcionesPropuesta {
  id: string;
  tipo: TipoPropuesta;
  /** Título de la tarjeta (por defecto, el del tipo). */
  titulo?: string;
  icono?: string;
  datos: DatoPropuesta[];
  nota?: string;
  /** Quien mira la demo es quien responde: muestra Aceptar / Rechazar. */
  responde: boolean;
  /** Lado de la burbuja: la mandó quien mira (derecha) o la otra persona (izquierda). */
  propia: boolean;
  alResponder?: (r: 'aceptar' | 'rechazar', m: Motor) => void;
}

const TITULOS: Record<TipoPropuesta, string> = {
  solicitud: demo.chatTurnos.solicitud,
  propuesta: demo.chatTurnos.propuesta,
  cambio: demo.chatTurnos.cambio,
  adicional: demo.chatTurnos.adicional,
};

function iconoSvg(nombre: string): Node | null {
  const svg = document.querySelector<HTMLTemplateElement>('template[data-demo-iconos]')?.content.querySelector(`[data-icono="${nombre}"] svg`);
  return svg ? svg.cloneNode(true) : null;
}

function pintarEstado(el: HTMLElement, estado: EstadoPropuesta) {
  el.dataset.estado = estado;
  const acciones = el.querySelector<HTMLElement>('[data-slot="acciones"]');
  if (acciones) acciones.hidden = estado !== 'pendiente' || el.dataset.responde !== 'true';
  const txt = el.querySelector<HTMLElement>('[data-slot="estado"]');
  if (txt) txt.textContent = demo.chatTurnos.estados[estado];
}

/** Suma una tarjeta al chat (al final de `lista`) y la devuelve. */
export function agregarPropuesta(lista: HTMLElement, m: Motor, o: OpcionesPropuesta): HTMLElement {
  const molde = document.querySelector<HTMLTemplateElement>('template[data-hd-molde="propuesta"]');
  const el = molde!.content.firstElementChild!.cloneNode(true) as HTMLElement;
  el.dataset.hdPropuesta = o.id;
  el.dataset.tipo = o.tipo;
  el.dataset.responde = String(o.responde);
  el.classList.add(o.propia ? 'hd-propuesta--propia' : 'hd-propuesta--otra');
  const ico = iconoSvg(o.icono ?? (o.tipo === 'adicional' ? 'mas' : 'calendario'));
  if (ico) el.querySelector('[data-slot="icono"]')!.append(ico);
  el.querySelector('[data-slot="tipo"]')!.textContent = o.titulo ?? TITULOS[o.tipo];
  const dl = el.querySelector<HTMLElement>('[data-slot="datos"]')!;
  o.datos.forEach((d) => {
    const fila = document.createElement('div');
    if (d.destacado) fila.className = 'hd-propuesta__destacado';
    const dt = document.createElement('dt');
    dt.textContent = d.etiqueta;
    const dd = document.createElement('dd');
    dd.textContent = d.valor;
    fila.append(dt, dd);
    dl.append(fila);
  });
  const nota = el.querySelector<HTMLElement>('[data-slot="nota"]')!;
  nota.textContent = o.nota ?? demo.chatTurnos.noEsTurno;
  const st = comun(m);
  (st.propuestas ??= {})[o.id] = { estado: 'pendiente', alResponder: o.alResponder };
  pintarEstado(el, 'pendiente');
  lista.append(el);
  if (!m.reducido) el.animate([{ opacity: 0, transform: 'translateY(0.8em) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  el.scrollIntoView({ block: 'end', behavior: m.reducido ? 'auto' : 'smooth' });
  if (o.responde) m.guia(el.querySelector('[data-valor="aceptar"]'));
  return el;
}

/** Responde una propuesta (desde los botones o desde un evento mock de la otra persona). */
export function responderPropuesta(m: Motor, id: string, r: 'aceptar' | 'rechazar') {
  const st = comun(m).propuestas?.[id];
  if (!st || st.estado !== 'pendiente') return;
  const nuevo = responder({ id, estado: st.estado }, r);
  st.estado = nuevo.estado;
  document.querySelectorAll<HTMLElement>(`[data-hd-propuesta="${id}"]`).forEach((el) => pintarEstado(el, nuevo.estado));
  st.alResponder?.(r, m);
}

/** Una contraoferta deja la anterior como "reemplazada" (queda en el historial). */
export function reemplazarPropuesta(m: Motor, id: string) {
  const st = comun(m).propuestas?.[id];
  if (!st || st.estado !== 'pendiente') return;
  st.estado = 'reemplazada';
  document.querySelectorAll<HTMLElement>(`[data-hd-propuesta="${id}"]`).forEach((el) => pintarEstado(el, 'reemplazada'));
}

// ── Registro (los dos roles) ──────────────────────────────────────────────

function modulo(rol: Rol) {
  const p = pre(rol);
  return {
    acciones: {
      'hd-fecha-mes': (el: HTMLElement, m: Motor) => {
        const st = comun(m).fecha;
        if (!st) return;
        st.mes = sumarMeses(st.mes.anio, st.mes.mes, Number(el.dataset.valor));
        pintarFecha(m.pantalla(), m);
      },
      'hd-fecha-dia': (el: HTMLElement, m: Motor) => {
        const st = comun(m).fecha;
        if (!st || esPasada(el.dataset.valor!, HOY)) return;
        st.valor = el.dataset.valor!;
        pintarFecha(m.pantalla(), m);
      },
      'hd-fecha-listo': (_el: HTMLElement, m: Motor) => {
        const st = comun(m).fecha;
        if (!st?.valor) return;
        const f = st.valor;
        m.volver();
        despues(() => st.alElegir(f, m));
      },
      'hd-hora-op': (el: HTMLElement, m: Motor) => {
        const st = comun(m).hora;
        if (!st) return;
        const v = Number(el.dataset.valor);
        st.valor = el.dataset.tipo === 'h' ? { ...st.valor, h: v } : { ...st.valor, m: v };
        const hoja = m.pantalla();
        pintarHora(hoja, m);
        const rueda = el.closest<HTMLElement>('.hd-rueda');
        if (rueda) centrar(rueda, v, !m.reducido);
      },
      'hd-hora-listo': (_el: HTMLElement, m: Motor) => {
        const st = comun(m).hora;
        if (!st) return;
        const h = st.valor;
        m.volver();
        despues(() => st.alElegir(h, m));
      },
      'hd-agenda-mes': (el: HTMLElement, m: Motor) => {
        const st = comun(m).agenda;
        if (!st) return;
        st.mes = sumarMeses(st.mes.anio, st.mes.mes, Number(el.dataset.valor));
        pintarAgenda(el.closest<HTMLElement>('.demo-pantalla')!, m);
      },
      'hd-agenda-dia': (el: HTMLElement, m: Motor) => {
        const st = comun(m).agenda;
        if (!st) return;
        st.dia = el.dataset.valor!;
        const pantalla = el.closest<HTMLElement>('.demo-pantalla')!;
        pintarAgenda(pantalla, m);
        pantalla.querySelector<HTMLElement>(`.hd-cal__dia[data-valor="${st.dia}"]`)?.focus({ preventScroll: true });
      },
      'hd-contacto-agregar': (el: HTMLElement, m: Motor) => agregarContacto(m, el.dataset.valor!),
      'hd-propuesta': (el: HTMLElement, m: Motor) => {
        const id = el.closest<HTMLElement>('[data-hd-propuesta]')?.dataset.hdPropuesta;
        if (id) responderPropuesta(m, id, el.dataset.valor === 'aceptar' ? 'aceptar' : 'rechazar');
      },
    },
    entrar: {
      [`${p}-elegir-fecha`]: (hoja: HTMLElement, m: Motor) => pintarFecha(hoja, m),
      [`${p}-elegir-hora`]: (hoja: HTMLElement, m: Motor) => montarRuedas(hoja, m),
    },
    cualquiera: (pantalla: HTMLElement, m: Motor) => {
      if (agendas(pantalla).length) pintarAgenda(pantalla, m);
      if (pantalla.dataset.pantalla === `${p}-contactos` || pantalla.querySelector('[data-hd-contacto-btn]')) pintarContactos(m);
    },
    reiniciar: () => {
      // Lo que se agregó en la demo (tarjetas del chat, trabajos nuevos) lo limpia cada rol; acá, los contactos.
      document.querySelectorAll<HTMLElement>(`[data-pantalla="${p}-contactos"] [data-hd-contacto]`).forEach((li) => (li.hidden = li.dataset.guardado !== 'true'));
      document.querySelectorAll<HTMLButtonElement>(`[data-rol="${rol}"] [data-hd-contacto-btn]`).forEach((b) => {
        b.setAttribute('aria-pressed', 'false');
        b.disabled = false;
      });
    },
  };
}

registrarRol('usuario', modulo('usuario'));
registrarRol('especialista', modulo('especialista'));
