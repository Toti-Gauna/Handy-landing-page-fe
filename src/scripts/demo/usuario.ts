// Demo · comportamiento del lado del usuario (acciones y pantallas dinámicas).
//
// El HTML sale de src/render/demo/usuario.ts con el estado inicial. Acá se guarda lo que se va eligiendo
// (en m.estado, que el motor vacía al reiniciar) y se vuelve a pintar todo lo marcado con data-du-*:
//   data-du-tpl, data-du-icono, data-du-ver, data-du-guia, data-du-habilitar, data-du-clase, data-du-grupo,
//   data-du-monto, data-du-tono, data-du-etapa, data-du-insignia.
// Hay tres juegos de valores (ver "contextos" en demo-usuario.json):
//   - pedido: lo que se está pidiendo ahora (rubro, tipo, día u otra fecha, franja u otro horario, propuesta elegida);
//   - turno: el trabajo confirmado en el recorrido, el que se abrió en «Tu turno» ({t…}) y el próximo turno ({px…});
//   - ia: lo que se le contó a HandIA (pasa al pedido recién al tocar "Pedir para hoy" o "Programar turno").
// Plata: siempre con src/demo/dinero.ts. Fechas: src/demo/fechas.ts (zona Argentina, "hoy" = demo.json → config.hoy).
// Llegada: la marca la geocerca simulada (src/demo/llegada.ts) con eventos mock; nadie la confirma a mano.
// Las piezas comunes (elegir fecha/hora, agenda, contactos, tarjetas de propuesta del chat) están en ./comunes.
// Todo lo temporizado usa m.timeout (se cancela solo al salir de la pantalla).
// La demo no guarda nada fuera de la memoria de la página: ni localStorage ni cookies (tampoco la tarjeta de prueba).

import '../../styles/demo-usuario.css';
import d from '../../content/demo-usuario.json';
import demo from '../../content/demo.json';
import rubrosJson from '../../content/rubros.json';
import tarifas from '../../content/tarifas.json';
import { registrarRol, type AvisoIsla, type Motor } from './motor';
import { completar, formatoPesos } from './util';
import { agregarPropuesta, agregarTrabajoAgenda, HOY, pedirFecha, pedirHora, reemplazarPropuesta, responderPropuesta, type DatoPropuesta } from './comunes';
import { desglose, propuestaAdicional, type Concepto, type Desglose, type Tarifas } from '../../demo/dinero';
import { fechaCorta, fechaLarga, horaTexto, partes, sumarDias, type FechaISO, type Hora } from '../../demo/fechas';
import { siguiente as pasoLlegada, type EstadoLlegada, type EventoLlegada } from '../../demo/llegada';

// ── Datos ─────────────────────────────────────────────────────────────────

type IdChat = 'u-chat' | 'u-chat2' | 'u-chat3' | 'u-handia' | 'u-soporte';
type Contexto = 'pedido' | 'turno' | 'ia';
type ChatEsp = 'u-chat' | 'u-chat2' | 'u-chat3';

const ini = d.inicial;
const dias = d.programar.dias;
const franjas = d.programar.franjas;
const items = d.presupuestos.items;
const fixtures = d.agenda.trabajos;
const fm = d.formatos;
const ct = d.chatTurnos;
const ctComun = demo.chatTurnos;
const $ = d.dinero;
const TARIFAS: Tarifas = { cliente: tarifas.normal.cliente, especialista: tarifas.normal.especialista };
const RUBROS = new Map(rubrosJson.rubros.map((r) => [r.id, r]));
const rubroDe = (id: string) => RUBROS.get(id)!;
const problemaDe = (id: string) => (d.problemas as Record<string, string>)[id] ?? '';
const CONTEXTOS = d.contextos as Record<string, Contexto>;
const contextoDe = (id: string): Contexto => CONTEXTOS[id] ?? 'turno';
const ADICIONAL: Concepto = { tipo: d.seguimiento.adicional.tipo as Concepto['tipo'], descripcion: d.seguimiento.adicional.concepto, monto: d.seguimiento.adicional.monto };
/** Recorrido mock del especialista hasta tu casa: sale, se pierde la señal, llega imprecisa y entra en la zona. */
const EVENTOS: EventoLlegada[] = [
  { tipo: 'permiso', concedido: true },
  { tipo: 'sin-senal' },
  { tipo: 'posicion', dentroDeLaZona: false, precisa: false },
  { tipo: 'posicion', dentroDeLaZona: false, precisa: true },
  { tipo: 'posicion', dentroDeLaZona: true, precisa: true },
];

const CHATS: Record<IdChat, { etapas: { rapidas: { texto: string; respuestas: string[]; foto?: boolean; propia?: string; rubro?: string; problema?: string }[] }[]; final?: string[] }> = {
  'u-chat': { etapas: d.chat.etapas, final: d.chat.final },
  'u-chat2': { etapas: d.chat2.etapas },
  'u-chat3': { etapas: d.chat3.etapas },
  'u-handia': { etapas: d.handia.etapas },
  'u-soporte': { etapas: d.soporte.etapas },
};

/** Iniciales para un avatar (igual que iniciales() de src/render/demo/piezas.ts). */
function iniciales(nombre: string): string {
  const partesN = nombre.split(/[\s·-]+/).filter((p) => /[\p{L}\d]/u.test(p));
  const ultima = partesN[partesN.length - 1] ?? '';
  if (partesN.length > 1 && /^\d+$/.test(ultima)) return (partesN[0][0] + ultima).toUpperCase();
  const dos = partesN.length > 2 ? partesN.slice(-2) : partesN.slice(0, 2);
  return dos.map((p) => p[0]).join('').toUpperCase();
}

interface Dia {
  largo: string;
  corto: string;
  fecha: string;
  iso: FechaISO;
}

/** Día a partir de la fecha: los del carril tienen su texto; los demás salen de fechas.ts. Igual que en el build. */
function diaInfo(iso: FechaISO): Dia {
  const chip = dias.find((x) => x.iso === iso);
  if (chip) return chip;
  const p = partes(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return { largo: fechaLarga(iso), corto: fechaCorta(iso), fecha: `${dos(p.dia)}/${dos(p.mes)}/${p.anio}`, iso };
}

const horaPedida = (h: Hora) => completar(fm.hora, { hora: horaTexto(h) });
const precioEsp = (i: number) => desglose({ manoDeObra: items[i].manoDeObra, materiales: items[i].materiales }, TARIFAS);

// ── Estado ────────────────────────────────────────────────────────────────

interface Msg {
  /** 'vos', 'otro' o 'detectado' (la pastilla de HandIA con el rubro que detectó). */
  de: string;
  texto: string;
  foto?: boolean;
}

interface EstadoChat {
  etapa: number;
  cola: Msg[];
  escribiendo: boolean;
  /** Ya se agregaron los mensajes finales (en el chat del trabajo, "Listo, ya quedó"). */
  final: boolean;
}

/** El trabajo del recorrido: lo que se confirmó al elegir una propuesta. */
interface Turno {
  rubro: string;
  problema: string;
  tipo: number;
  dia: Dia;
  franja: string;
  pres: number;
  pago: number;
  /** Se confirmó en esta demo (antes, las pantallas del trabajo muestran el pedido de ejemplo). */
  activo: boolean;
  /** 0 confirmado · 1 en camino · 2 llegó · 3 trabajando. */
  seg: number;
  llegada: EstadoLlegada;
  /** Próximo evento mock de la llegada. */
  ev: number;
  terminado: boolean;
  cancelado: boolean;
  adicional: 'no' | 'pendiente' | 'aceptado' | 'rechazado';
  /** Cuánto se pagó (demo: no se cobra nada). */
  pagado: number;
}

/** Turno aceptado en un chat (se suma a la agenda). */
interface TurnoChat {
  id: string;
  iso: FechaISO;
  franja: string;
  rubro: string;
  esp: number;
  trabajo: string;
  manoDeObra: number;
  materiales: number;
}

/** Cambios sobre un trabajo de la agenda (cambio de horario pedido, cancelado). */
interface Ajuste {
  cancelado?: boolean;
  /** Cambio de horario pedido: pendiente hasta que el especialista responda (acepta o propone otro horario). */
  cambio?: { dia: Dia; franja: string; h: number; estado: 'pendiente' | 'aceptado' | 'propuesta'; propuesta?: string };
  dia?: Dia;
  franja?: string;
}

interface Estado {
  // Pedido en curso
  rubro: string;
  problema: string;
  tipo: number;
  dia: number;
  franja: number;
  fechaOtra: FechaISO | null;
  horaOtra: Hora | null;
  /** Se llegó a "Programá el turno" saltando desde el recorrido (la guía muestra otra fecha y otro horario). */
  progSalto: boolean;
  fotos: number;
  pres: number;
  pago: number;
  buscado: boolean;
  llegados: number;
  historialVisto: boolean;
  ia: { rubro: string; problema: string; foto: boolean };
  tc: Turno;
  festejo: boolean;
  estrellas: number;
  resEnviada: boolean;
  /** Trabajo que se ve en "Tu turno": 'flujo' (el del recorrido), un id de la agenda o de un chat. */
  turno: string;
  verPago: string | null;
  desde: string;
  cambioDia: number;
  cambioFranja: number;
  cambioFechaOtra: FechaISO | null;
  cambioHoraOtra: Hora | null;
  ajustes: Record<string, Ajuste>;
  extras: TurnoChat[];
  nSol: number;
  c2Pedido: boolean;
  c3Prop: boolean;
  tarjeta: { ultimos: string; nombre: string; vence: string } | null;
  pregunta: number;
  sirvio: boolean;
  avisos: number[];
  chatLeido: boolean;
  leidos: string[];
  chats: Record<string, EstadoChat>;
}

function turnoBase(): Turno {
  return {
    rubro: ini.rubro,
    problema: problemaDe(ini.rubro),
    tipo: ini.tipo,
    dia: dias[0],
    franja: franjas[items[ini.presupuesto].propone.urgencia],
    pres: ini.presupuesto,
    pago: ini.pago,
    activo: false,
    seg: 0,
    llegada: 'pidiendo-permiso',
    ev: 0,
    terminado: false,
    cancelado: false,
    adicional: 'no',
    pagado: 0,
  };
}

function S(m: Motor): Estado {
  const e = m.estado as Partial<Estado> & { _listo?: boolean };
  if (!e._listo) {
    const base: Estado = {
      rubro: ini.rubro,
      problema: problemaDe(ini.rubro),
      tipo: ini.tipo,
      dia: ini.dia,
      franja: ini.franja,
      fechaOtra: null,
      horaOtra: null,
      progSalto: false,
      fotos: 0,
      pres: ini.presupuesto,
      pago: ini.pago,
      buscado: false,
      llegados: 0,
      historialVisto: false,
      ia: { rubro: ini.rubro, problema: problemaDe(ini.rubro), foto: false },
      tc: turnoBase(),
      festejo: false,
      estrellas: 0,
      resEnviada: false,
      turno: '',
      verPago: null,
      desde: 'detalle',
      cambioDia: 1,
      cambioFranja: 0,
      cambioFechaOtra: null,
      cambioHoraOtra: null,
      ajustes: {},
      extras: [],
      nSol: 0,
      c2Pedido: false,
      c3Prop: false,
      tarjeta: null,
      pregunta: 0,
      sirvio: false,
      avisos: [],
      chatLeido: false,
      leidos: [],
      chats: {},
    };
    Object.assign(e, base, { _listo: true });
    (e as Estado).turno = proximo(e as Estado)?.id ?? 'flujo';
  }
  return e as Estado;
}

const chatDe = (e: Estado, id: string) => (e.chats[id] ??= { etapa: 0, cola: [], escribiendo: false, final: false });

// ── Pedido, propuestas y trabajos ─────────────────────────────────────────

const diaPedido = (e: Estado): Dia => (e.tipo === 0 ? dias[0] : e.fechaOtra ? diaInfo(e.fechaOtra) : dias[e.dia]);
const franjaPedida = (e: Estado) => (e.tipo === 0 ? d.urgencia.franja : e.horaOtra ? horaPedida(e.horaOtra) : franjas[e.franja]);

/**
 * Horario que propone el especialista i para el pedido. Programado: acepta lo pedido si es su día y entra en lo que
 * declaró; si no, propone su franja (y otro día, si trabaja otro día). Urgencia: hoy, en su franja. Igual que en el build.
 */
function propuestaDe(e: Estado, i: number): { dia: Dia; franja: string; acepta: boolean | null } {
  const it = items[i];
  const pr = it.propone;
  if (e.tipo === 0) return { dia: dias[0], franja: franjas[pr.urgencia], acepta: null };
  const base = diaPedido(e);
  const acepta = e.horaOtra
    ? pr.dia === 0 && e.horaOtra.h >= it.horas[0] && e.horaOtra.h < it.horas[1]
    : pr.dia === 0 && (pr.franja === null || pr.franja === e.franja);
  if (acepta) return { dia: base, franja: franjaPedida(e), acepta };
  return { dia: diaInfo(sumarDias(base.iso, pr.dia)), franja: franjas[pr.franja ?? pr.urgencia], acepta };
}

/** Plata del trabajo del recorrido: la propuesta elegida + el adicional, si se aceptó. */
const precioTurno = (t: Turno): Desglose =>
  desglose({ manoDeObra: items[t.pres].manoDeObra, materiales: items[t.pres].materiales }, TARIFAS, t.adicional === 'aceptado' ? [ADICIONAL] : []);

type EstadoTrabajo = 'confirmado' | 'en-curso' | 'terminado' | 'cancelado';

interface Vista {
  id: string;
  flujo: boolean;
  rubro: string;
  tipo: string;
  dia: Dia;
  franja: string;
  esp: number;
  trabajo: string;
  p: Desglose;
  adicional: number;
  estado: EstadoTrabajo;
  pagado: number;
  cambio?: Ajuste['cambio'];
}

/** Lo que se muestra de un trabajo (el del recorrido, uno de la agenda o uno aceptado en un chat). */
function vista(e: Estado, id: string): Vista {
  const aj = e.ajustes[id] ?? {};
  if (id === 'flujo') {
    const t = e.tc;
    const p = precioTurno(t);
    return {
      id,
      flujo: true,
      rubro: t.rubro,
      tipo: d.opciones.items[t.tipo].texto,
      dia: t.dia,
      franja: t.franja,
      esp: t.pres,
      trabajo: items[t.pres].trabajo,
      p,
      adicional: t.adicional === 'aceptado' ? ADICIONAL.monto : 0,
      estado: t.cancelado ? 'cancelado' : t.terminado ? 'terminado' : t.activo && t.seg >= 1 ? 'en-curso' : 'confirmado',
      pagado: t.pagado,
      cambio: aj.cambio,
    };
  }
  const x = fixtures.find((f) => f.id === id);
  const c = x ? null : e.extras.find((f) => f.id === id);
  const fuente = x ?? c ?? fixtures[0];
  const p = desglose({ manoDeObra: fuente.manoDeObra, materiales: fuente.materiales }, TARIFAS);
  const estado: EstadoTrabajo = aj.cancelado ? 'cancelado' : x ? (x.estado as EstadoTrabajo) : 'confirmado';
  return {
    id,
    flujo: false,
    rubro: fuente.rubro,
    tipo: x ? x.tipo : d.opciones.items[1].texto,
    dia: aj.dia ?? diaInfo(x ? x.fecha : (c as TurnoChat).iso),
    franja: aj.franja ?? fuente.franja,
    esp: fuente.esp,
    trabajo: fuente.trabajo,
    p,
    adicional: 0,
    estado,
    pagado: estado === 'terminado' ? p.totalCliente : 0,
    cambio: aj.cambio,
  };
}

/** Próximo turno confirmado de la agenda (sin contar el trabajo del recorrido). */
function proximo(e: Estado): Vista | null {
  const ids = [...fixtures.map((x) => x.id), ...e.extras.map((x) => x.id)];
  const vs = ids.map((id) => vista(e, id)).filter((v) => v.estado === 'confirmado' && v.dia.iso >= HOY);
  vs.sort((a, b) => (a.dia.iso < b.dia.iso ? -1 : a.dia.iso > b.dia.iso ? 1 : 0));
  return vs[0] ?? null;
}

const cuandoDe = (dia: Dia, franja: string) => completar(fm.cuando, { diaCorto: dia.corto, franja });

// ── Valores y condiciones (lo que se pinta) ───────────────────────────────

const plata = (p: Desglose, pre = '') => {
  const k = (x: string) => (pre ? `${pre}${x.charAt(0).toUpperCase()}${x.slice(1)}` : x);
  return {
    [k('mano')]: formatoPesos(p.manoDeObra),
    [k('materiales')]: formatoPesos(p.materiales),
    [k('subtotal')]: formatoPesos(p.subtotal),
    [k('tarifa')]: formatoPesos(p.tarifaCliente),
    [k('total')]: formatoPesos(p.totalCliente),
  };
};

/** Plata de un trabajo con adicional: el adicional va en su línea (no se mezcla en mano de obra ni materiales). */
function plataConAdicional(p: Desglose, adicional: number, pre = '') {
  const v = plata(p, pre);
  if (adicional > 0) {
    const k = ADICIONAL.tipo === 'mano' ? 'mano' : 'materiales';
    const clave = pre ? `${pre}${k.charAt(0).toUpperCase()}${k.slice(1)}` : k;
    v[clave] = formatoPesos((ADICIONAL.tipo === 'mano' ? p.manoDeObra : p.materiales) - adicional);
  }
  return v;
}

const cambioAbierto = (c: Ajuste['cambio']) => c?.estado === 'pendiente' || c?.estado === 'propuesta';

function valoresPedido(e: Estado): Record<string, string> {
  const r = rubroDe(e.rubro);
  const it = items[e.pres];
  const dia = diaPedido(e);
  const pr = propuestaDe(e, e.pres);
  const v: Record<string, string> = {
    tarifaCliente: `${TARIFAS.cliente}%`,
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[e.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    fecha: dia.fecha,
    franja: franjaPedida(e),
    problema: e.problema,
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    declaro: it.declaro,
    otro: it.rubros.find((o) => o !== r.nombre) ?? '',
    trabajo: it.trabajo,
    ...plata(precioEsp(e.pres)),
    horarioEsp: cuandoDe(pr.dia, pr.franja),
    propDia: pr.dia.largo,
    propFranja: pr.franja,
    progFecha: e.fechaOtra ? diaInfo(e.fechaOtra).largo : '',
    progHora: e.horaOtra ? horaTexto(e.horaOtra) : '',
    historialN: completar(d.historial.cantidad, { n: it.historial.length }),
  };
  items.forEach((_, i) => {
    const p = propuestaDe(e, i);
    v[`horario${i}`] = cuandoDe(p.dia, p.franja);
    v[`prop${i}`] = p.acepta === null ? '' : p.acepta ? d.presupuestos.acepta : d.presupuestos.otro;
  });
  return v;
}

function valoresTrabajo(e: Estado): Record<string, string> {
  const t = e.tc;
  const r = rubroDe(t.rubro);
  const it = items[t.pres];
  const p = precioTurno(t);
  const ad = propuestaAdicional({ manoDeObra: it.manoDeObra, materiales: it.materiales }, TARIFAS, [], ADICIONAL);
  const s = d.seguimiento;
  const claveSeg = (['confirmado', 'en-camino', 'llego', 'trabajando'] as const)[t.seg];
  const ubic = t.seg === 1 && (t.llegada === 'senal-imprecisa' || t.llegada === 'sin-senal') ? t.llegada : claveSeg;
  const cambioDia = e.cambioFechaOtra ? diaInfo(e.cambioFechaOtra) : dias[e.cambioDia];
  const cambioFranja = e.cambioHoraOtra ? horaPedida(e.cambioHoraOtra) : franjas[e.cambioFranja];
  const v: Record<string, string> = {
    tarifaCliente: `${TARIFAS.cliente}%`,
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[t.tipo].texto,
    dia: t.dia.largo,
    diaCorto: t.dia.corto,
    fecha: t.dia.fecha,
    franja: t.franja,
    cuando: cuandoDe(t.dia, t.franja),
    problema: t.problema,
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    trabajo: it.trabajo,
    ...plataConAdicional(p, t.adicional === 'aceptado' ? ADICIONAL.monto : 0),
    adicional: formatoPesos(t.adicional === 'aceptado' ? ADICIONAL.monto : 0),
    resta: formatoPesos(Math.max(0, p.totalCliente - t.pagado)),
    pagado: formatoPesos(t.pagado),
    segTitulo: completar(s.titulos[claveSeg], { esp: it.nombre }),
    segEstado: s.etapas[t.seg],
    ubicacion: (s.ubicacion as Record<string, string>)[ubic],
    adConcepto: ADICIONAL.descripcion,
    adMonto: formatoPesos(ADICIONAL.monto),
    adTarifa: formatoPesos(ad.tarifaCliente),
    adAntes: formatoPesos(ad.totalAntes),
    adDespues: formatoPesos(ad.totalDespues),
    cambioTexto: cuandoDe(cambioDia, cambioFranja),
    tarjetaUltimos: e.tarjeta?.ultimos ?? '',
    tarjetaNombre: e.tarjeta?.nombre ?? '',
    tarjetaVence: e.tarjeta?.vence ?? '',
  };
  const px = proximo(e);
  if (px) {
    Object.assign(v, {
      pxEsp: items[px.esp].nombre,
      pxEspIni: iniciales(items[px.esp].nombre),
      pxRubro: rubroDe(px.rubro).nombre,
      pxCuando: cuandoDe(px.dia, px.franja),
      pxEstado: cambioAbierto(px.cambio) ? d.agenda.estados.cambio : d.agenda.estados.confirmado,
    });
  }
  const tv = vista(e, e.turno);
  const ag = d.agenda.estados;
  Object.assign(v, {
    tRubro: rubroDe(tv.rubro).nombre,
    tTipo: tv.tipo,
    tDia: tv.dia.largo,
    tFecha: tv.dia.fecha,
    tFranja: tv.franja,
    tCuando: cuandoDe(tv.dia, tv.franja),
    tEsp: items[tv.esp].nombre,
    tEspIni: iniciales(items[tv.esp].nombre),
    tTrabajo: tv.trabajo,
    ...plataConAdicional(tv.p, tv.adicional, 't'),
    tAdicional: formatoPesos(tv.adicional),
    tResta: formatoPesos(Math.max(0, tv.p.totalCliente - tv.pagado)),
    tEstado: cambioAbierto(tv.cambio) && tv.estado === 'confirmado' ? ag.cambio : ag[tv.estado],
    tCambio: tv.cambio ? cuandoDe(tv.cambio.dia, tv.cambio.franja) : '',
    tPropuesta: tv.cambio?.propuesta ? cuandoDe(tv.cambio.dia, tv.cambio.propuesta) : '',
  });
  return v;
}

/** Lo que se le contó a HandIA. */
function valoresIa(e: Estado): Record<string, string> {
  const r = rubroDe(e.ia.rubro);
  return { ...valoresPedido(e), rubro: r.nombre, rubroCorto: r.corto ?? r.nombre, problema: e.ia.problema };
}

const valoresDe = (e: Estado, ctx: Contexto) => (ctx === 'pedido' ? valoresPedido(e) : ctx === 'ia' ? valoresIa(e) : valoresTrabajo(e));

/** Montos que cuentan (data-du-monto), según el contexto de la pantalla. */
function montosDe(e: Estado, ctx: Contexto): Record<string, number> {
  const p = ctx === 'turno' ? precioTurno(e.tc) : precioEsp(e.pres);
  return { subtotal: p.subtotal, tarifa: p.tarifaCliente, total: p.totalCliente };
}

/** Rubro (id) de cada ícono dinámico, según el contexto de la pantalla. */
function iconos(e: Estado, ctx: Contexto): Record<string, string> {
  return {
    rubro: ctx === 'pedido' ? e.rubro : ctx === 'ia' ? e.ia.rubro : e.tc.rubro,
    tRubro: vista(e, e.turno).rubro,
    pxRubro: proximo(e)?.rubro ?? '',
  };
}

/** Índice del especialista (color del avatar) de cada avatar dinámico. */
function tonos(e: Estado, ctx: Contexto): Record<string, number> {
  return { esp: ctx === 'turno' ? e.tc.pres : e.pres, tEsp: vista(e, e.turno).esp, pxEsp: proximo(e)?.esp ?? 0 };
}

/** Datos de la tarjeta nueva que se está cargando (solo del formulario: no se guardan). */
function formulario(): { numero: string; nombre: string; vence: string; codigo: string } {
  const p = pantallaDe('u-agregar-tarjeta');
  const v = (k: string) => p?.querySelector<HTMLInputElement>(`[data-du-campo="${k}"]`)?.value ?? '';
  return { numero: v('numero').replace(/\D/g, ''), nombre: v('nombre').trim(), vence: v('vence'), codigo: v('codigo').replace(/\D/g, '') };
}

function venceValido(texto: string): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(texto);
  if (!m) return false;
  const hoy = partes(HOY);
  const anio = 2000 + Number(m[2]);
  return anio > hoy.anio || (anio === hoy.anio && Number(m[1]) >= hoy.mes);
}

const formularioListo = (f: ReturnType<typeof formulario>) => f.numero.length === 16 && f.nombre.length >= 3 && venceValido(f.vence) && f.codigo.length >= 3;

function condiciones(e: Estado): Record<string, boolean> {
  const t = e.tc;
  const p = precioTurno(t);
  const tv = vista(e, e.turno);
  const px = proximo(e);
  const form = formulario();
  const tActivo = tv.estado === 'confirmado';
  const conChat = tv.estado === 'confirmado' || tv.estado === 'en-curso';
  const c: Record<string, boolean> = {
    foto1: e.fotos >= 1,
    foto2: e.fotos >= 2,
    puedeFoto: e.fotos < 2,
    fotoGuia: e.fotos === 0,
    buscListo: e.llegados >= items.length,
    hayOtro: items[e.pres].rubros.some((o) => o !== rubroDe(e.rubro).nombre),
    esProgramado: e.tipo !== 0,
    progFecha: !!e.fechaOtra,
    progHora: !!e.horaOtra,
    progPedido: !!(e.fechaOtra || e.horaOtra),
    guiaOtraFecha: e.progSalto && !e.fechaOtra,
    guiaOtraHora: e.progSalto && !!e.fechaOtra && !e.horaOtra,
    guiaSiguiente: !e.progSalto,
    historialVisto: e.historialVisto,
    hayEnCurso: t.activo && !t.terminado && !t.cancelado,
    pxCambio: cambioAbierto(px?.cambio),
    segAntes: t.seg < 1,
    segEspera: t.seg === 1 && (t.llegada === 'senal-imprecisa' || t.llegada === 'sin-senal'),
    segLlego: t.seg >= 2,
    adicionalVisto: t.adicional !== 'no',
    adicionalAceptado: t.adicional === 'aceptado',
    segChatGuia: t.activo && t.seg >= 3 && t.adicional !== 'pendiente' && t.adicional !== 'no',
    pagoCompleto: t.pagado >= p.totalCliente,
    pagoHecho: t.pagado > 0 && !t.cancelado,
    resSin: e.estrellas === 0,
    resBien: e.estrellas >= 4,
    resMal: e.estrellas > 0 && e.estrellas < 4,
    resConEstrellas: e.estrellas > 0,
    resEnviada: e.resEnviada,
    tActivo,
    tConChat: conChat,
    tEnCurso: tv.estado === 'en-curso',
    tTerminado: tv.estado === 'terminado',
    tCancelado: tv.estado === 'cancelado',
    tCambioPend: tv.cambio?.estado === 'pendiente' && tActivo,
    tCambioOk: tv.cambio?.estado === 'aceptado' && tActivo,
    tCambioProp: tv.cambio?.estado === 'propuesta' && tActivo,
    tCambioAbierto: cambioAbierto(tv.cambio),
    tConAdicional: tv.adicional > 0,
    tPagado: tv.pagado > 0 && tv.pagado >= tv.p.totalCliente,
    tPorPagar: tv.estado === 'terminado' && tv.pagado < tv.p.totalCliente,
    tVerPago: tv.estado === 'terminado' && tv.pagado >= tv.p.totalCliente,
    tGuiaCambiar: tActivo && !tv.cambio,
    guiaCambioFecha: false,
    guiaCambioHora: !e.cambioHoraOtra,
    guiaPedirCambio: !!e.cambioHoraOtra,
    c2Programar: !e.c2Pedido,
    tarjetaNueva: !!e.tarjeta,
    tarjetaVacia: !form.numero && !form.nombre,
    tarjetaLista: formularioListo(form),
    chatLeido: e.chatLeido,
    sirvio: e.sirvio,
  };
  items.forEach((_, i) => {
    const pr = propuestaDe(e, i);
    c[`acepta${i}`] = pr.acepta === true;
    c[`noAcepta${i}`] = pr.acepta === false;
    c[`esp${i}`] = e.pres === i;
    c[`tChat${i}`] = conChat && (tv.flujo ? i === 0 : tv.esp === i);
  });
  (['u-chat2', 'u-chat3'] as const).forEach((id) => (c[`leido:${id}`] = e.leidos.includes(id)));
  d.buscando.estados.forEach((_, i) => (c[`busc${i}`] = e.llegados === i));
  items.forEach((_, i) => (c[`llego${i + 1}`] = e.llegados >= i + 1));
  d.seguimiento.etapas.forEach((_, i) => {
    c[`segEtapa${i}`] = t.seg >= i;
    c[`segActual${i}`] = t.seg === i;
  });
  d.ayuda.preguntas.forEach((_, i) => (c[`resp${i}`] = e.pregunta === i));
  // Avisos: los que no se borraron y que corresponden (el de "Pagaste" solo si se pagó).
  d.notificaciones.avisos.forEach((a, i) => {
    const si = (a as { si?: string }).si;
    c[`aviso${i}`] = !e.avisos.includes(i) && (!si || !!c[si]);
  });
  c.avisosVacio = d.notificaciones.avisos.every((_, i) => !c[`aviso${i}`]);
  (Object.keys(CHATS) as IdChat[]).forEach((id) => {
    const ch = chatDe(e, id);
    const libre = ch.cola.length === 0 && !ch.escribiendo;
    // El chat del trabajo no sigue si se canceló o ya terminó.
    const activoChat = id !== 'u-chat' || (!t.cancelado && !t.terminado);
    CHATS[id].etapas.forEach((_, n) => (c[`chat:${id}:${n}`] = libre && activoChat && ch.etapa === n));
    c[`final:${id}`] = libre && activoChat && ch.etapa >= CHATS[id].etapas.length && (id !== 'u-chat' || ch.final);
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

/** Etapa de la barra de tres tramos: búsqueda (propuestas que llegaron) y seguimiento. */
function etapa(e: Estado, cual: string): number {
  if (cual === 'busq') return Math.min(3, e.llegados);
  return Math.min(3, e.tc.seg + 1);
}

/** Completa una tarjeta de la agenda con lo que dice el trabajo ahora (estado, cambio, total, fecha). */
function llenarTarjeta(li: HTMLElement, v: Vista) {
  const ag = d.agenda;
  const set = (slot: string, texto: string) => {
    const el = li.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    if (el && el.textContent !== texto) el.textContent = texto;
  };
  set('rubro', rubroDe(v.rubro).nombre);
  set('detalle', completar(ag.detalle, { franja: v.franja, esp: items[v.esp].nombre }));
  set('trabajo', v.trabajo);
  const pend = cambioAbierto(v.cambio) && v.estado === 'confirmado';
  set('estado', pend ? ag.estados.cambio : ag.estados[v.estado]);
  set('total', formatoPesos(v.p.totalCliente));
  const chip = li.querySelector<HTMLElement>('[data-slot="estado"]');
  chip?.classList.toggle('hd-chip--exito', v.estado === 'terminado');
  chip?.classList.toggle('du-chip--rojo', v.estado === 'cancelado');
  chip?.classList.toggle('hd-chip--amarillo', pend);
  chip?.classList.toggle('hd-chip--azul', v.estado === 'en-curso');
  chip?.classList.toggle('hd-chip--tinte', v.estado === 'confirmado' && !pend);
  const ico = li.querySelector<HTMLElement>('[data-slot="icono"]');
  if (ico && ico.dataset.rubro !== v.rubro) {
    const svg = svgRubro(v.rubro);
    if (svg) ico.replaceChildren(svg);
    ico.dataset.rubro = v.rubro;
  }
  const btn = li.querySelector<HTMLElement>('[data-slot="ver"]');
  if (btn) btn.dataset.valor = v.id;
  if (li.dataset.fecha !== v.dia.iso) li.dataset.fecha = v.dia.iso;
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
      // El build deja anotado en data-du-actual el rubro con el que pintó el ícono.
      if (!id || el.dataset.duActual === id) return;
      const svg = svgRubro(id);
      if (!svg) return;
      el.replaceChildren(svg);
      el.dataset.duActual = id;
    });
    const tn = tonos(e, ctx);
    p.querySelectorAll<HTMLElement>('[data-du-tono]').forEach((el) => {
      const i = tn[el.dataset.duTono!] ?? 0;
      items.forEach((_, j) => el.classList.toggle(`du-tono-${j}`, j === i));
    });
    // Montos: si cambian, cuentan del valor anterior al nuevo.
    const mt = montosDe(e, ctx);
    p.querySelectorAll<HTMLElement>('[data-du-monto]').forEach((el) => {
      const n = mt[el.dataset.duMonto!];
      if (n === undefined) return;
      if (el.dataset.hdMonto === undefined) el.dataset.hdMonto = String(n);
      if (el.dataset.hdMonto !== String(n)) m.contar(el, n);
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
    dia: e.fechaOtra ? -1 : e.dia,
    franja: e.horaOtra ? -1 : e.franja,
    pres: e.pres,
    pago: e.pago,
    cambioDia: e.cambioFechaOtra ? -1 : e.cambioDia,
    cambioFranja: e.cambioHoraOtra ? -1 : e.cambioFranja,
  };
  mias('[data-du-grupo]').forEach((el) => {
    const g = el.dataset.duGrupo!;
    const valor = Number(el.dataset.valor);
    const activo = g === 'estrellas' ? valor <= e.estrellas : grupos[g] === valor;
    if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(activo));
    else el.classList.toggle('du-sel', activo);
  });
  mias('[data-du-etapa]').forEach((el) => {
    const n = String(etapa(e, el.dataset.duEtapa!));
    if (el.dataset.etapa !== n) el.dataset.etapa = n;
  });
  // La campana: cuántos avisos quedan sin leer.
  const sinLeer = d.notificaciones.avisos.filter((_, i) => c[`aviso${i}`]).length;
  mias('[data-du-insignia]').forEach((el) => {
    if (el.textContent !== String(sinLeer)) el.textContent = String(sinLeer);
  });
  // Agenda: cada tarjeta con el estado de su trabajo.
  pantallaDe('u-turnos')
    ?.querySelectorAll<HTMLElement>('[data-hd-trabajo]')
    .forEach((li) => llenarTarjeta(li, vista(e, li.dataset.hdTrabajo!)));
  // Chats: ocupados mientras el otro escribe (el recorrido espera a que terminen).
  mias('[data-du-chat]').forEach((el) => {
    const ch = chatDe(e, el.dataset.duChat!);
    if (ch.escribiendo || ch.cola.length) el.setAttribute('aria-busy', 'true');
    else el.removeAttribute('aria-busy');
  });
  // Formulario de la tarjeta: el botón se habilita con los datos completos.
  const guardar = pantallaDe('u-agregar-tarjeta')?.querySelector<HTMLButtonElement>('[data-du-tarjeta-guardar]');
  if (guardar) {
    guardar.disabled = !c.tarjetaLista;
    guardar.querySelector<HTMLElement>('[data-du-guardar-si]')?.toggleAttribute('hidden', !c.tarjetaLista);
    guardar.querySelector<HTMLElement>('[data-du-guardar-no]')?.toggleAttribute('hidden', c.tarjetaLista);
  }
  // El especialista del mapa lleva sus iniciales.
  const marca = pantallaDe('u-seguimiento')?.querySelector<SVGTextElement>('.hd-mapa__esp text');
  const ini2 = iniciales(items[e.tc.pres].nombre);
  if (marca && marca.textContent !== ini2) marca.textContent = ini2;
}

// ── Utilidades ────────────────────────────────────────────────────────────

/** Saca la marca de guía de un grupo (después de tocarlo, la guía pasa a lo siguiente). */
function sinGuia(el: HTMLElement, selector: string) {
  el.closest('.demo-pantalla')
    ?.querySelectorAll(selector)
    .forEach((x) => x.removeAttribute('data-guia'));
}

/** Aviso de la isla con textos del contenido (las variables salen del contexto dado). */
function isla(m: Motor, a: { titulo: string; texto?: string; icono?: string }, ctx: Contexto, extra: Partial<AvisoIsla> = {}, vars: Record<string, string> = {}) {
  const v = { ...valoresDe(S(m), ctx), ...vars };
  m.isla({ titulo: completar(a.titulo, v), texto: a.texto ? completar(a.texto, v) : undefined, icono: a.icono, ...extra });
}

function avisar(m: Motor, texto: string) {
  m.isla({ titulo: d.comun.avisoIsla, texto, icono: 'info' });
}

/** Cuenta desde cero los montos de una pantalla (al entrar). */
function contarDesdeCero(p: HTMLElement, m: Motor) {
  const mt = montosDe(S(m), contextoDe(p.dataset.pantalla ?? ''));
  p.querySelectorAll<HTMLElement>('[data-du-monto]').forEach((el) => {
    const n = mt[el.dataset.duMonto!];
    if (n !== undefined) m.contar(el, n, { desde: 0, ms: 1100 });
  });
}

/** El troquel de los tickets va justo donde está el corte (depende de lo que tenga arriba). */
function ajustarTickets(p: HTMLElement) {
  p.querySelectorAll<HTMLElement>('.hd-ticket').forEach((tk) => {
    const papel = tk.querySelector<HTMLElement>('.hd-ticket__papel');
    const corte = tk.querySelector<HTMLElement>('.hd-ticket__corte');
    if (!papel || !corte || !papel.offsetHeight) return;
    const y = corte.offsetTop + corte.offsetHeight / 2;
    tk.style.setProperty('--corte', `${((y / papel.offsetHeight) * 100).toFixed(2)}%`);
  });
}

/** Corre algo apenas termina el toque (cuando una hoja ya se cerró, sus temporizadores son de la pantalla de abajo). */
const despues = (fn: () => void) => window.setTimeout(fn, 0);

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

// ── Chats ─────────────────────────────────────────────────────────────────

const listaDe = (id: string) => pantallaDe(id).querySelector<HTMLElement>('[data-du-mensajes]')!;

function alFondo(lista: HTMLElement, suave: boolean) {
  lista.scrollTo({ top: lista.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
}

function burbuja(id: IdChat, msg: Msg, nueva: boolean): HTMLElement {
  const pantalla = pantallaDe(id);
  const lista = listaDe(id);
  let div: HTMLElement;
  if (msg.de === 'detectado') {
    // Pastilla de HandIA con el rubro que detectó (pintar() le pone el ícono y el texto).
    const tpl = pantalla.querySelector<HTMLTemplateElement>('template[data-du-detectado]');
    div = (tpl?.content.firstElementChild?.cloneNode(true) as HTMLElement) ?? document.createElement('div');
    if (nueva) div.classList.add('du-nueva');
  } else {
    div = document.createElement('div');
    div.className = `du-burbuja du-burbuja--${msg.de === 'vos' ? 'propia' : 'otra'}${msg.foto ? ' du-burbuja--foto' : ''}${nueva ? ' du-nueva' : ''}`;
    if (msg.foto) {
      // La "foto" es la ilustración del rubro (pintar() le pone el ícono que corresponde).
      const tpl = pantalla.querySelector<HTMLTemplateElement>('template[data-du-foto]');
      const f = tpl?.content.firstElementChild?.cloneNode(true);
      if (f) div.append(f);
    }
    const span = document.createElement('span');
    span.textContent = msg.texto;
    div.append(span);
  }
  lista.append(div);
  alFondo(lista, nueva);
  return div;
}

function quitarEscribiendo(pantalla: HTMLElement) {
  pantalla.querySelectorAll('.du-escribiendo').forEach((x) => x.remove());
}

function escribiendo(pantalla: HTMLElement) {
  const div = document.createElement('div');
  div.className = 'hd-escribiendo du-escribiendo';
  div.innerHTML = '<i></i><i></i><i></i>';
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = d.comun.escribiendo;
  div.append(sr);
  const lista = pantalla.querySelector<HTMLElement>('[data-du-mensajes]')!;
  lista.append(div);
  alFondo(lista, true);
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
  const rapido = ch.cola[0].de === 'detectado';
  ch.escribiendo = true;
  if (!rapido) escribiendo(p);
  pintar(m);
  m.timeout(
    () => {
      quitarEscribiendo(p);
      ch.escribiendo = false;
      const msg = ch.cola.shift()!;
      burbuja(id, textoDe(e, id, msg), !m.reducido);
      pintar(m);
      if (ch.cola.length) m.timeout(() => seguirChat(m, id), m.reducido ? 150 : 450);
      else seguirChat(m, id);
    },
    m.reducido ? 400 : rapido ? 650 : 1200,
  );
}

/** Al volver a un chat que quedó a mitad de camino (se salió antes de que terminara): mostrar todo de una. */
function completarChat(m: Motor, id: IdChat) {
  const e = S(m);
  const ch = chatDe(e, id);
  const p = pantallaDe(id);
  if (ch.cola.length || ch.escribiendo) {
    quitarEscribiendo(p);
    ch.escribiendo = false;
    ch.cola.splice(0).forEach((msg) => burbuja(id, textoDe(e, id, msg), false));
  }
  alFondo(listaDe(id), false);
}

/** Mensajes finales del chat del trabajo ("Listo, ya quedó"): cuando ya está trabajando y el trabajo sigue activo. */
function agregarFinal(e: Estado, id: IdChat) {
  const conf = CHATS[id];
  const ch = chatDe(e, id);
  if (!conf.final || ch.final || ch.etapa < conf.etapas.length) return;
  if (id === 'u-chat' && (e.tc.seg < 3 || e.tc.terminado || e.tc.cancelado)) return;
  ch.final = true;
  ch.cola.push(...conf.final.map((texto) => ({ de: 'otro', texto })));
}

function responder(m: Motor, id: IdChat, etapaN: number, i: number) {
  const conf = CHATS[id];
  const e = S(m);
  const ch = chatDe(e, id);
  if (!conf || etapaN !== ch.etapa || ch.escribiendo || ch.cola.length) return;
  const r = conf.etapas[ch.etapa]?.rapidas[i];
  if (!r) return;
  let detecto = false;
  // Lo de HandIA queda aparte: no toca el pedido en curso ni el trabajo confirmado.
  if (id === 'u-handia') {
    if (r.rubro) {
      e.ia.rubro = r.rubro;
      e.ia.problema = r.problema ?? problemaDe(r.rubro);
      detecto = true;
    }
    if (r.foto) e.ia.foto = true;
  }
  ch.etapa++;
  burbuja(id, { de: 'vos', texto: r.propia ?? r.texto, foto: r.foto }, !m.reducido);
  ch.cola = [...(detecto ? [{ de: 'detectado', texto: '' }] : []), ...r.respuestas.map((texto) => ({ de: 'otro', texto }))];
  agregarFinal(e, id);
  seguirChat(m, id);
}

/** Especialista de cada chat: el del trabajo en u-chat; Especialista 2 y 3 en los otros. */
const espDeChat = (e: Estado, id: ChatEsp) => (id === 'u-chat' ? e.tc.pres : id === 'u-chat2' ? 1 : 2);

/** Filas de una propuesta con precio (siempre con dinero.ts). */
function datosPrecio(trabajo: string, dia: Dia, franja: string, p: Desglose): DatoPropuesta[] {
  return [
    { etiqueta: $.trabajo, valor: trabajo },
    { etiqueta: ct.fecha, valor: dia.largo },
    { etiqueta: ct.horario, valor: franja },
    { etiqueta: $.mano, valor: formatoPesos(p.manoDeObra) },
    { etiqueta: $.materiales, valor: formatoPesos(p.materiales) },
    { etiqueta: completar($.tarifa, { tarifaCliente: `${TARIFAS.cliente}%` }), valor: formatoPesos(p.tarifaCliente) },
    { etiqueta: $.total, valor: formatoPesos(p.totalCliente), destacado: true },
  ];
}

/** Turno aceptado en un chat: queda en la agenda (y es un turno confirmado recién ahora). */
function turnoAceptado(m: Motor, id: ChatEsp, t: TurnoChat) {
  const e = S(m);
  if (e.extras.some((x) => x.id === t.id)) return;
  e.extras.push(t);
  const molde = pantallaDe('u-turnos').querySelector<HTMLTemplateElement>('template[data-du-molde-trabajo]');
  const li = document.createElement('li');
  li.className = 'hd-agenda__trabajo';
  li.dataset.hdTrabajo = t.id;
  li.dataset.fecha = t.iso;
  li.hidden = true;
  if (molde) li.append(molde.content.cloneNode(true));
  agregarTrabajoAgenda('usuario', li);
  const dia = diaInfo(t.iso);
  const cuando = cuandoDe(dia, t.franja);
  burbuja(id, { de: 'otro', texto: completar(ct.aceptada, { cuando }) }, !m.reducido);
  m.confeti();
  m.isla({ titulo: ct.isla.titulo, texto: completar(ct.isla.texto, { esp: items[t.esp].nombre, cuando }), icono: 'calendario', tono: 'exito' });
  pintar(m);
}

/** "Programar turno" / "Quiero un turno ahora": la solicitud propia y la respuesta del especialista (mock). */
function enviarSolicitud(m: Motor, id: ChatEsp, pedido: { fecha: FechaISO; hora: Hora } | null) {
  const e = S(m);
  const ch = chatDe(e, id);
  const p = pantallaDe(id);
  const lista = listaDe(id);
  const i = espDeChat(e, id);
  const it = items[i];
  const cot = ct.cotizaciones[i];
  const n = ++e.nSol;
  const solId = `u-sol-${n}`;
  const dia = pedido ? diaInfo(pedido.fecha) : dias[0];
  agregarPropuesta(lista, m, {
    id: solId,
    tipo: 'solicitud',
    titulo: pedido ? undefined : ctComun.solicitudAhora,
    datos: [
      { etiqueta: ctComun.problema, valor: cot.trabajo },
      { etiqueta: ctComun.cuando, valor: pedido ? completar(ct.cuandoPedido, { fecha: dia.largo, hora: horaTexto(pedido.hora) }) : ct.cuandoAhora },
    ],
    responde: false,
    propia: true,
  });
  if (id === 'u-chat2') e.c2Pedido = true;
  ch.escribiendo = true;
  escribiendo(p);
  pintar(m);
  m.timeout(
    () => {
      quitarEscribiendo(p);
      ch.escribiendo = false;
      let franja: string;
      let texto: string;
      if (!pedido) {
        franja = franjas[it.propone.urgencia];
        texto = ct.ahora;
        responderPropuesta(m, solId, 'aceptar');
      } else {
        const acepta = pedido.hora.h >= it.horas[0] && pedido.hora.h < it.horas[1];
        franja = acepta ? horaPedida(pedido.hora) : cot.contraFranja;
        texto = acepta ? ct.acepta : completar(ct.contra, { franja: cot.contraFranja });
        if (acepta) responderPropuesta(m, solId, 'aceptar');
        else reemplazarPropuesta(m, solId);
      }
      burbuja(id, { de: 'otro', texto }, !m.reducido);
      const precio = desglose({ manoDeObra: cot.manoDeObra, materiales: cot.materiales }, TARIFAS);
      const turno: TurnoChat = { id: `u-chat-turno-${n}`, iso: dia.iso, franja, rubro: cot.rubro, esp: i, trabajo: cot.trabajo, manoDeObra: cot.manoDeObra, materiales: cot.materiales };
      agregarPropuesta(lista, m, {
        id: `u-prop-${n}`,
        tipo: 'propuesta',
        datos: datosPrecio(cot.trabajo, dia, franja, precio),
        responde: true,
        propia: false,
        alResponder: (r, mm) => {
          if (r === 'aceptar') turnoAceptado(mm, id, turno);
          else {
            burbuja(id, { de: 'otro', texto: ct.rechazada }, !mm.reducido);
            pintar(mm);
          }
        },
      });
      pintar(m);
    },
    m.reducido ? 500 : 1600,
  );
}

/** Especialista 3 manda su propuesta por su cuenta (precio, fecha y hora): el usuario la acepta o la rechaza. */
function propuestaDelEspecialista(m: Motor) {
  const e = S(m);
  const ch = chatDe(e, 'u-chat3');
  if (e.c3Prop || ch.escribiendo) return;
  const pe = ct.propuestaEsp;
  const p = pantallaDe('u-chat3');
  ch.escribiendo = true;
  escribiendo(p);
  pintar(m);
  m.timeout(
    () => {
      quitarEscribiendo(p);
      ch.escribiendo = false;
      e.c3Prop = true;
      burbuja('u-chat3', { de: 'otro', texto: pe.mensaje }, !m.reducido);
      const dia = diaInfo(pe.fecha);
      const hora = (() => {
        const [h, mi] = pe.hora.split(':').map(Number);
        return { h, m: mi };
      })();
      const franja = horaPedida(hora);
      const precio = desglose({ manoDeObra: pe.manoDeObra, materiales: pe.materiales }, TARIFAS);
      const turno: TurnoChat = { id: 'u-chat-turno-esp', iso: dia.iso, franja, rubro: pe.rubro, esp: pe.esp, trabajo: pe.trabajo, manoDeObra: pe.manoDeObra, materiales: pe.materiales };
      agregarPropuesta(listaDe('u-chat3'), m, {
        id: 'u-prop-esp',
        tipo: 'propuesta',
        datos: datosPrecio(pe.trabajo, dia, franja, precio),
        responde: true,
        propia: false,
        alResponder: (r, mm) => {
          if (r === 'aceptar') turnoAceptado(mm, 'u-chat3', turno);
          else {
            burbuja('u-chat3', { de: 'otro', texto: ct.rechazada }, !mm.reducido);
            pintar(mm);
          }
        },
      });
      pintar(m);
    },
    m.reducido ? 500 : 1500,
  );
}

// ── Seguimiento del trabajo en curso ──────────────────────────────────────

/** El especialista manda un adicional (lo crea solo él): el usuario lo acepta o lo rechaza; hasta entonces no cuenta. */
function mandarAdicional(m: Motor) {
  const e = S(m);
  const t = e.tc;
  if (t.adicional !== 'no') return;
  t.adicional = 'pendiente';
  const it = items[t.pres];
  const a = d.seguimiento.adicional;
  const ad = propuestaAdicional({ manoDeObra: it.manoDeObra, materiales: it.materiales }, TARIFAS, [], ADICIONAL);
  const datos: DatoPropuesta[] = [
    { etiqueta: a.conceptoLabel, valor: ADICIONAL.descripcion },
    { etiqueta: a.importe, valor: formatoPesos(ADICIONAL.monto) },
    { etiqueta: completar(a.tarifa, { tarifaCliente: `${TARIFAS.cliente}%` }), valor: formatoPesos(ad.tarifaCliente) },
    { etiqueta: a.antes, valor: formatoPesos(ad.totalAntes) },
    { etiqueta: a.despues, valor: formatoPesos(ad.totalDespues), destacado: true },
  ];
  const alResponder = (r: 'aceptar' | 'rechazar', mm: Motor) => {
    const tt = S(mm).tc;
    tt.adicional = r === 'aceptar' ? 'aceptado' : 'rechazado';
    pintar(mm);
    const aviso = d.seguimiento.islas[r === 'aceptar' ? 'aceptado' : 'rechazado'];
    isla(mm, aviso, 'turno', { icono: aviso.icono, tono: r === 'aceptar' ? 'exito' : 'azul' });
  };
  // Queda en el chat (historial) y en el seguimiento: es la misma propuesta.
  burbuja('u-chat', { de: 'otro', texto: a.chat }, false);
  const op = { id: 'u-adicional', tipo: 'adicional' as const, titulo: a.titulo, datos, nota: a.nota, responde: true, propia: false, alResponder };
  agregarPropuesta(listaDe('u-chat'), m, op);
  pintar(m);
  const cont = pantallaDe('u-seguimiento').querySelector<HTMLElement>('[data-du-adicional]');
  if (cont) {
    const tarjeta = agregarPropuesta(cont, m, op);
    // Cuando terminó de entrar (y la hoja creció), que se vean los botones.
    m.timeout(() => tarjeta.scrollIntoView({ block: 'nearest', behavior: m.reducido ? 'auto' : 'smooth' }), m.reducido ? 50 : 480);
  }
  e.chatLeido = false;
  const aviso = d.seguimiento.islas.adicional;
  isla(m, aviso, 'turno', { icono: aviso.icono, tono: 'amarillo' });
  pintar(m);
}

/** Avanza el seguimiento con los eventos mock: en camino → sin señal / imprecisa → llegó → trabajando → adicional. */
function avanzarSeguimiento(m: Motor) {
  const e = S(m);
  const t = e.tc;
  if (!t.activo || t.terminado || t.cancelado) return;
  const ms = m.reducido ? 600 : 1200;
  const s = d.seguimiento.islas;
  if (t.seg >= 3) {
    if (t.adicional === 'no') mandarAdicional(m);
    return;
  }
  if (t.seg === 2) {
    t.seg = 3;
    pintar(m);
    isla(m, s.trabajando, 'turno', { icono: s.trabajando.icono, tono: 'azul' });
    // Si el chat ya estaba contestado, ahora el especialista avisa (al terminar).
    agregarFinal(e, 'u-chat');
    m.timeout(() => avanzarSeguimiento(m), ms);
    return;
  }
  const ev = EVENTOS[Math.min(t.ev, EVENTOS.length - 1)];
  t.ev++;
  t.llegada = pasoLlegada(t.llegada, ev);
  if (t.seg === 0 && t.llegada !== 'pidiendo-permiso') {
    t.seg = 1;
    isla(m, s['en-camino'], 'turno', { icono: s['en-camino'].icono, tono: 'azul' });
  }
  if (t.llegada === 'llego') {
    t.seg = 2;
    isla(m, s.llego, 'turno', { icono: s.llego.icono, tono: 'amarillo' });
  }
  pintar(m);
  m.timeout(() => avanzarSeguimiento(m), ms);
}

/** El pedido pasa a ser el trabajo confirmado, con el día y el horario que propuso el especialista elegido. */
function confirmarTurno(e: Estado) {
  const pr = propuestaDe(e, e.pres);
  e.tc = {
    ...turnoBase(),
    rubro: e.rubro,
    problema: e.problema,
    tipo: e.tipo,
    dia: pr.dia,
    franja: pr.franja,
    pres: e.pres,
    pago: e.pago,
    activo: true,
  };
  // "Pagar ahora": se registra el total de hoy (demo: no se cobra nada). Un adicional se paga al terminar.
  if (e.pago === 0) e.tc.pagado = precioTurno(e.tc).totalCliente;
  Object.assign(e, { turno: 'flujo', chatLeido: false, estrellas: 0, resEnviada: false, festejo: true });
  delete e.ajustes.flujo;
  delete e.chats['u-chat'];
  restaurar('u-chat');
  restaurar('u-resena');
  restaurar('u-seguimiento');
  // El trabajo queda en la agenda (el de un pedido anterior se reemplaza).
  pantallaDe('u-turnos').querySelectorAll('[data-hd-trabajo="flujo"]').forEach((x) => x.remove());
  const molde = pantallaDe('u-turnos').querySelector<HTMLTemplateElement>('template[data-du-molde-trabajo]');
  const li = document.createElement('li');
  li.className = 'hd-agenda__trabajo';
  li.dataset.hdTrabajo = 'flujo';
  li.dataset.fecha = e.tc.dia.iso;
  li.hidden = true;
  if (molde) li.append(molde.content.cloneNode(true));
  agregarTrabajoAgenda('usuario', li);
}

// ── Pantallas con tiempo ──────────────────────────────────────────────────

function contador(p: HTMLElement, m: Motor, n: number) {
  const el = p.querySelector<HTMLElement>('[data-du-contador]');
  if (el) m.contar(el, n, { ms: 500, formato: (x) => String(Math.round(x)) });
}

function entrarBuscando(p: HTMLElement, m: Motor) {
  const e = S(m);
  if (e.buscado) {
    e.llegados = items.length;
    contador(p, m, items.length);
    return;
  }
  e.llegados = 0;
  const cont = p.querySelector<HTMLElement>('[data-du-contador]');
  if (cont) {
    cont.dataset.hdMonto = '0';
    cont.textContent = '0';
  }
  pintar(m);
  const tiempos = m.reducido ? [700, 1300, 1900] : [1300, 2500, 3600];
  tiempos.forEach((t, i) =>
    m.timeout(() => {
      e.llegados = i + 1;
      if (e.llegados >= items.length) e.buscado = true;
      pintar(m);
      contador(p, m, e.llegados);
      isla(m, d.buscando.isla, 'pedido', { icono: 'billetera' }, { nombre: items[i].nombre, precio: formatoPesos(precioEsp(i).totalCliente) });
      if (e.buscado) m.guia(pantallaDe('u-buscando').querySelector('[data-guia]'));
    }, t),
  );
  // Si nadie toca nada, pasa solo a las propuestas.
  m.timeout(() => {
    if (m.actual === 'u-buscando') m.ir('u-presupuestos');
  }, tiempos[tiempos.length - 1] + 3200);
}

function entrarSeguimiento(p: HTMLElement, m: Motor) {
  const e = S(m);
  // Un trabajo cancelado ya no se sigue: a la agenda.
  if (e.tc.cancelado && !m.saltando) {
    m.timeout(() => m.raiz('u-turnos'), 0);
    return;
  }
  // Saltando a este paso, sin un trabajo confirmado o con el anterior terminado: se confirma el pedido en curso.
  if (m.saltando || !e.tc.activo || e.tc.terminado || e.tc.cancelado) {
    confirmarTurno(e);
    pintar(m);
  }
  // Recién confirmado: festejo con la tilde, confeti y el aviso de la isla.
  const festejo = p.querySelector<HTMLElement>('[data-du-festejo]');
  const conFestejo = e.festejo && e.tc.seg === 0;
  e.festejo = false;
  if (festejo) festejo.hidden = !conFestejo;
  if (conFestejo) {
    m.confeti();
    isla(m, d.confirmado.isla, 'turno', { icono: 'check', tono: 'exito' });
    m.timeout(() => festejo?.classList.add('du-festejo--sale'), m.reducido ? 500 : 1500);
    m.timeout(() => {
      if (festejo) {
        festejo.hidden = true;
        festejo.classList.remove('du-festejo--sale');
      }
    }, m.reducido ? 600 : 1850);
  }
  // Si ya llegó, el especialista queda en tu casa (el viaje no se repite).
  if (e.tc.seg >= 2) {
    m.timeout(
      () =>
        p.querySelectorAll<SVGAnimationElement>('[data-hd-viaje]').forEach((a) => {
          try {
            a.endElement();
          } catch {
            /* sin SMIL */
          }
        }),
      0,
    );
  }
  if (e.tc.seg < 3 || e.tc.adicional === 'no') m.timeout(() => avanzarSeguimiento(m), conFestejo ? (m.reducido ? 900 : 2000) : 900);
}

function entrarChat(_p: HTMLElement, m: Motor) {
  const e = S(m);
  e.chatLeido = true;
  // Saltando a este paso sin trabajo confirmado: se confirma el pedido en curso (y queda trabajando).
  if (m.saltando && !e.tc.activo) {
    confirmarTurno(e);
    Object.assign(e.tc, { seg: 3, llegada: 'llego' as EstadoLlegada, ev: EVENTOS.length });
    e.festejo = false;
  }
  completarChat(m, 'u-chat');
  // Si ya se contestó y el especialista está trabajando, ahora avisa que terminó.
  agregarFinal(e, 'u-chat');
  if (chatDe(e, 'u-chat').cola.length) seguirChat(m, 'u-chat');
}

function entrarTerminado(p: HTMLElement, m: Motor) {
  // Esta pantalla es el trabajo terminado (también si se llega saltando al paso del recorrido).
  const e = S(m);
  if (!e.tc.activo || e.tc.cancelado) confirmarTurno(e);
  Object.assign(e.tc, { terminado: true, cancelado: false, seg: 3, llegada: 'llego' });
  e.festejo = false;
  // Un adicional que quedó sin responder no se suma.
  if (e.tc.adicional === 'pendiente') {
    e.tc.adicional = 'rechazado';
    responderPropuesta(m, 'u-adicional', 'rechazar');
  }
  e.turno = 'flujo';
  // La calificación arranca de cero cada vez que se llega acá.
  Object.assign(e, { estrellas: 0, resEnviada: false });
  restaurar('u-resena');
  m.confeti();
  isla(m, d.terminado.isla, 'turno', { icono: 'check', tono: 'exito' });
  pintar(m);
  contarDesdeCero(p, m);
}

function entrarPagos(p: HTMLElement, m: Motor) {
  const e = S(m);
  if (e.verPago === null) return;
  // Desde "Ver el pago": se despliega el movimiento de ese trabajo y se pliegan los demás.
  const id = e.verPago;
  e.verPago = null;
  p.querySelectorAll<HTMLElement>('[data-du-mov]').forEach((mov) => desplegar(mov.closest('.du-mov-tarjeta'), mov.dataset.duMov === id));
  const tarjeta = p.querySelector(`[data-du-mov="${id}"]`)?.closest<HTMLElement>('.du-mov-tarjeta');
  const lista = tarjeta?.closest<HTMLElement>('.hd-scroll');
  if (tarjeta && lista) lista.scrollTop += tarjeta.getBoundingClientRect().top - lista.getBoundingClientRect().top;
}

function entrarProgramar(_p: HTMLElement, m: Motor) {
  const e = S(m);
  // En "Programá el turno" el pedido es programado (también si se llega saltando desde el recorrido).
  if (e.tipo === 0) e.tipo = 1;
  e.progSalto = m.saltando;
}

/** El cambio queda aceptado: el turno pasa al día y horario nuevos. */
function aplicarCambio(e: Estado, id: string, franja: string) {
  const aj = e.ajustes[id];
  if (!aj?.cambio) return;
  aj.cambio.estado = 'aceptado';
  aj.cambio.franja = franja;
  if (id === 'flujo') {
    e.tc.dia = aj.cambio.dia;
    e.tc.franja = franja;
  } else {
    aj.dia = aj.cambio.dia;
    aj.franja = franja;
  }
}

/** Respuesta mock del especialista al cambio de horario (un rato después). */
function esperarCambio(m: Motor, id: string) {
  m.timeout(() => {
    const e = S(m);
    const aj = e.ajustes[id];
    if (!aj?.cambio || aj.cambio.estado !== 'pendiente') return;
    const esp = vista(e, id).esp;
    const [desde, hasta] = items[esp].horas;
    // Acepta si la hora pedida entra en lo que declaró; si no, propone otra franja del mismo día.
    if (aj.cambio.h >= desde && aj.cambio.h < hasta) {
      aplicarCambio(e, id, aj.cambio.franja);
      pintar(m);
      isla(m, d.turnoDetalle.islaCambio, 'turno', { icono: 'calendario', tono: 'exito' });
    } else {
      aj.cambio.estado = 'propuesta';
      aj.cambio.propuesta = ct.cotizaciones[esp].contraFranja;
      pintar(m);
      isla(m, d.turnoDetalle.islaPropuesta, 'turno', { icono: 'calendario', tono: 'amarillo' });
      m.guia(pantallaDe('u-turno-detalle').querySelector('[data-accion="cambio-responder"][data-valor="aceptar"]'));
    }
  }, m.reducido ? 2500 : 5000);
}

function entrarDetalle(p: HTMLElement, m: Motor) {
  const e = S(m);
  if (!e.turno) e.turno = proximo(e)?.id ?? 'flujo';
  if (e.ajustes[e.turno]?.cambio?.estado === 'pendiente') esperarCambio(m, e.turno);
  contarDesdeCero(p, m);
}

/** Formulario de la tarjeta: vista previa en vivo; los datos quedan solo en los campos y se borran al salir. */
function entrarTarjeta(p: HTMLElement, m: Motor) {
  const campos = [...p.querySelectorAll<HTMLInputElement>('[data-du-campo]')];
  const vista = (k: string) => p.querySelector<HTMLElement>(`[data-du-vista="${k}"]`);
  const v = d.agregarTarjeta.vista;
  const limpiar = () => campos.forEach((c) => (c.value = ''));
  const actualizar = () => {
    const f = formulario();
    const num = (f.numero + '•'.repeat(16)).slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
    vista('numero')!.textContent = f.numero ? num : v.numero;
    vista('nombre')!.textContent = f.nombre ? f.nombre.toUpperCase() : v.titular;
    vista('vence')!.textContent = campos.find((c) => c.dataset.duCampo === 'vence')?.value || v.vence;
    pintar(m);
  };
  const alEscribir = (ev: Event) => {
    const c = ev.target as HTMLInputElement;
    const k = c.dataset.duCampo;
    if (k === 'numero') c.value = c.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
    if (k === 'codigo') c.value = c.value.replace(/\D/g, '').slice(0, 4);
    if (k === 'vence') {
      const dd = c.value.replace(/\D/g, '').slice(0, 4);
      c.value = dd.length > 2 ? `${dd.slice(0, 2)}/${dd.slice(2)}` : dd;
    }
    actualizar();
  };
  limpiar();
  actualizar();
  p.addEventListener('input', alEscribir);
  return () => {
    p.removeEventListener('input', alEscribir);
    limpiar();
  };
}

// ── Acciones ──────────────────────────────────────────────────────────────

const num = (el: HTMLElement) => Number(el.dataset.valor);

/** Arranca un pedido nuevo (el trabajo confirmado no cambia). */
function nuevoPedido(e: Estado, rubro: string, problema: string) {
  Object.assign(e, {
    rubro,
    problema,
    tipo: ini.tipo,
    dia: ini.dia,
    franja: ini.franja,
    fechaOtra: null,
    horaOtra: null,
    fotos: 0,
    pres: ini.presupuesto,
    pago: ini.pago,
    buscado: false,
    llegados: 0,
    historialVisto: false,
  });
}

const tareaDe = (valor: string) => (valor.startsWith('m') ? d.inicio.mas[Number(valor.slice(1))] : d.inicio.tareas[Number(valor.slice(1))]);

const acciones: Record<string, (el: HTMLElement, m: Motor) => void> = {
  rubro(el, m) {
    nuevoPedido(S(m), el.dataset.valor!, problemaDe(el.dataset.valor!));
  },
  tarea(el, m) {
    const t = tareaDe(el.dataset.valor!) as { rubro: string; problema: string };
    nuevoPedido(S(m), t.rubro, t.problema);
  },
  'tarea-sin'(el) {
    // "Armar muebles": no hay rubro que lo tome. No se arma pedido ni se avisa a nadie.
    const t = tareaDe(el.dataset.valor!);
    pantallaDe('u-sin-especialistas')
      .querySelectorAll<HTMLElement>('[data-du-sin]')
      .forEach((x) => (x.textContent = completar(x.dataset.duSin!, { tarea: t.texto })));
  },
  tipo(el, m) {
    const e = S(m);
    e.tipo = num(el);
  },
  dia(el, m) {
    const e = S(m);
    e.dia = num(el);
    e.fechaOtra = null;
    el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: m.reducido ? 'auto' : 'smooth' });
  },
  franja(el, m) {
    const e = S(m);
    e.franja = num(el);
    e.horaOtra = null;
  },
  'prog-fecha'(_el, m) {
    const e = S(m);
    pedirFecha(m, {
      valor: e.fechaOtra ?? sumarDias(dias[dias.length - 1].iso, 1),
      alElegir: (f, mm) => {
        S(mm).fechaOtra = f;
        pintar(mm);
      },
    });
  },
  'prog-hora'(_el, m) {
    const e = S(m);
    pedirHora(m, {
      valor: e.horaOtra ?? { h: 8, m: 0 },
      alElegir: (h, mm) => {
        S(mm).horaOtra = h;
        pintar(mm);
      },
    });
  },
  'prog-quitar'(el, m) {
    const e = S(m);
    if (el.dataset.valor === 'fecha') e.fechaOtra = null;
    else e.horaOtra = null;
  },
  foto(_el, m) {
    const e = S(m);
    e.fotos = Math.min(2, e.fotos + 1);
  },
  pedir(_el, m) {
    S(m).buscado = false;
  },
  presupuesto(el, m) {
    const e = S(m);
    e.pres = num(el);
  },
  pago(el, m) {
    S(m).pago = num(el);
  },
  confirmar(_el, m) {
    confirmarTurno(S(m));
  },
  pagar(_el, m) {
    const e = S(m);
    e.tc.pagado = precioTurno(e.tc).totalCliente;
    isla(m, d.terminado.islaPago, 'turno', { icono: 'billetera', tono: 'exito' });
  },
  chat(el, m) {
    const [id, et, i] = (el.dataset.valor ?? '').split(':');
    responder(m, id as IdChat, Number(et), Number(i));
  },
  /** El avión de enviar: manda la primera respuesta rápida, si hay. */
  enviar(el, m) {
    const id = el.dataset.valor as IdChat;
    const e = S(m);
    const et = chatDe(e, id).etapa;
    if (condiciones(e)[`chat:${id}:${et}`]) responder(m, id, et, 0);
    else avisar(m, d.comun.enviarDemo);
  },
  /** Adjuntar: en la demo, una foto de ejemplo. */
  adjuntar(el, m) {
    const id = el.dataset.valor as IdChat;
    burbuja(id, { de: 'vos', texto: d.comun.fotoDemo, foto: true }, !m.reducido);
  },
  'chat-programar'(el, m) {
    const id = el.closest<HTMLElement>('[data-pantalla]')?.dataset.pantalla as ChatEsp;
    pedirFecha(m, {
      valor: sumarDias(HOY, 3),
      alElegir: (f, mm) =>
        pedirHora(mm, {
          valor: { h: 8, m: 0 },
          alElegir: (h, m3) => enviarSolicitud(m3, id, { fecha: f, hora: h }),
        }),
    });
  },
  'chat-ahora'(el, m) {
    const id = el.closest<HTMLElement>('[data-pantalla]')?.dataset.pantalla as ChatEsp;
    enviarSolicitud(m, id, null);
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
    m.confeti();
    isla(m, d.resena.isla, 'turno', { icono: 'estrella', tono: 'exito' });
  },
  'handia-pedir'(el, m) {
    // Recién acá lo que se le contó a HandIA pasa a ser el pedido.
    const e = S(m);
    nuevoPedido(e, e.ia.rubro, e.ia.problema);
    e.fotos = e.ia.foto ? 1 : 0;
    e.tipo = el.dataset.valor === 'hoy' ? 0 : 1;
  },
  turno(el, m) {
    S(m).turno = el.dataset.valor ?? 'flujo';
  },
  'turno-proximo'(_el, m) {
    const e = S(m);
    e.turno = proximo(e)?.id ?? 'flujo';
  },
  'turno-seg'(_el, m) {
    S(m).turno = 'flujo';
  },
  'ver-pago'(_el, m) {
    const e = S(m);
    e.verPago = e.turno;
  },
  desde(el, m) {
    const e = S(m);
    e.desde = el.dataset.valor ?? 'detalle';
    if (e.desde === 'seg') e.turno = 'flujo';
  },
  'cambio-dia'(el, m) {
    const e = S(m);
    e.cambioDia = num(el);
    e.cambioFechaOtra = null;
  },
  'cambio-franja'(el, m) {
    const e = S(m);
    e.cambioFranja = num(el);
    e.cambioHoraOtra = null;
  },
  'cambio-fecha'(_el, m) {
    const e = S(m);
    pedirFecha(m, {
      valor: e.cambioFechaOtra ?? sumarDias(HOY, 8),
      alElegir: (f, mm) => {
        S(mm).cambioFechaOtra = f;
        pintar(mm);
      },
    });
  },
  'cambio-hora'(_el, m) {
    const e = S(m);
    pedirHora(m, {
      valor: e.cambioHoraOtra ?? { h: 8, m: 0 },
      alElegir: (h, mm) => {
        S(mm).cambioHoraOtra = h;
        pintar(mm);
      },
    });
  },
  'pedir-cambio'(_el, m) {
    // Es un pedido: el turno actual se conserva hasta que el especialista responda.
    const e = S(m);
    const dia = e.cambioFechaOtra ? diaInfo(e.cambioFechaOtra) : dias[e.cambioDia];
    const franja = e.cambioHoraOtra ? horaPedida(e.cambioHoraOtra) : franjas[e.cambioFranja];
    const id = e.turno;
    const h = e.cambioHoraOtra ? e.cambioHoraOtra.h : Number(/^\d+/.exec(franjas[e.cambioFranja])?.[0] ?? 0);
    (e.ajustes[id] ??= {}).cambio = { dia, franja, h, estado: 'pendiente' };
    isla(m, d.cambiar.isla, 'turno', { icono: 'calendario' });
    // La respuesta llega con "Tu turno" a la vista (la hoja se cierra con este toque).
    despues(() => {
      esperarCambio(m, id);
      pantallaDe('u-turno-detalle').querySelector('.du-aviso--pendiente:not([hidden])')?.scrollIntoView({ block: 'nearest', behavior: m.reducido ? 'auto' : 'smooth' });
    });
  },
  'cambio-responder'(el, m) {
    const e = S(m);
    const aj = e.ajustes[e.turno];
    if (!aj?.cambio || aj.cambio.estado !== 'propuesta') return;
    if (el.dataset.valor === 'aceptar') {
      aplicarCambio(e, e.turno, aj.cambio.propuesta ?? aj.cambio.franja);
      isla(m, d.turnoDetalle.islaCambio, 'turno', { icono: 'calendario', tono: 'exito' });
    } else {
      delete aj.cambio;
      isla(m, d.turnoDetalle.islaRechazo, 'turno', { icono: 'info' });
    }
  },
  'cancelar-turno'(_el, m) {
    const e = S(m);
    if (e.turno === 'flujo') e.tc.cancelado = true;
    else (e.ajustes[e.turno] ??= {}).cancelado = true;
    isla(m, d.cancelar.isla, 'turno', { icono: 'prohibido', tono: 'amarillo' });
    // Si se canceló desde el seguimiento, el trabajo ya no se sigue: a la agenda.
    if (e.desde === 'seg') m.raiz('u-turnos');
  },
  mov(el) {
    desplegar(el.closest('.du-mov-tarjeta'), el.getAttribute('aria-expanded') !== 'true');
  },
  'tarjeta-prueba'(_el, m) {
    const p = pantallaDe('u-agregar-tarjeta');
    const datos = d.agregarTarjeta.pruebaDatos as Record<string, string>;
    p.querySelectorAll<HTMLInputElement>('[data-du-campo]').forEach((c) => {
      c.value = datos[c.dataset.duCampo!] ?? '';
      c.dispatchEvent(new Event('input', { bubbles: true }));
    });
    pintar(m);
  },
  'tarjeta-guardar'(_el, m) {
    const f = formulario();
    if (!formularioListo(f)) return;
    // Solo los últimos 4 números (y nada del código): el resto se borra con el formulario.
    const e = S(m);
    e.tarjeta = { ultimos: f.numero.slice(-4), nombre: f.nombre.toUpperCase(), vence: f.vence };
    pantallaDe('u-agregar-tarjeta')
      .querySelectorAll<HTMLInputElement>('[data-du-campo]')
      .forEach((c) => (c.value = ''));
    isla(m, d.agregarTarjeta.isla, 'turno', { icono: 'tarjeta', tono: 'exito' }, { ultimos: e.tarjeta.ultimos });
    m.volver();
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

const especiales: Record<string, (p: HTMLElement, m: Motor) => void | (() => void)> = {
  'u-buscando': entrarBuscando,
  'u-programar': entrarProgramar,
  'u-seguimiento': entrarSeguimiento,
  'u-chat': entrarChat,
  'u-chat2': (_p, m) => {
    const e = S(m);
    if (!e.leidos.includes('u-chat2')) e.leidos.push('u-chat2');
    completarChat(m, 'u-chat2');
  },
  'u-chat3': (_p, m) => {
    const e = S(m);
    if (!e.leidos.includes('u-chat3')) e.leidos.push('u-chat3');
    completarChat(m, 'u-chat3');
    propuestaDelEspecialista(m);
  },
  'u-handia': (_p, m) => completarChat(m, 'u-handia'),
  'u-soporte': (_p, m) => completarChat(m, 'u-soporte'),
  'u-historial': (_p, m) => {
    S(m).historialVisto = true;
  },
  'u-terminado': entrarTerminado,
  'u-pagos': entrarPagos,
  'u-perfil': contarDesdeCero,
  'u-confirmar': contarDesdeCero,
  'u-turno-detalle': entrarDetalle,
  'u-agregar-tarjeta': entrarTarjeta,
  'u-cambiar': (_p, m) => {
    // Cada vez que se abre, el cambio arranca de cero (el día siguiente al del turno, en su franja).
    Object.assign(S(m), { cambioDia: 1, cambioFranja: 0, cambioFechaOtra: null, cambioHoraOtra: null });
  },
};

const entrar: Record<string, (p: HTMLElement, m: Motor) => void | (() => void)> = Object.fromEntries(
  Object.keys(d.titulos).map((id) => [
    id,
    (p: HTMLElement, m: Motor) => {
      const limpieza = especiales[id]?.(p, m);
      pintar(m);
      ajustarTickets(p);
      return limpieza;
    },
  ]),
);

registrarRol('usuario', {
  acciones: conPintar,
  entrar,
  // Después de las piezas comunes: la guía del recorrido en las hojas de hora y en la agenda.
  cualquiera(p, m) {
    const id = p.dataset.pantalla;
    if (id === 'u-elegir-hora') m.guia(p.querySelector('[data-hd-sel-listo]'));
    if (id === 'u-turnos') {
      const fecha = p.querySelector<HTMLElement>('[data-du-agenda-guia]')?.dataset.duAgendaGuia;
      const elegido = p.querySelector<HTMLElement>('.hd-cal__dia[aria-pressed="true"]')?.dataset.valor;
      if (fecha && elegido !== fecha) m.guia(p.querySelector(`.hd-cal__dia[data-valor="${fecha}"]`));
    }
  },
  reiniciar() {
    fotografiar();
    originales.forEach((html, p) => {
      if (p.innerHTML !== html) p.innerHTML = html;
    });
  },
});
