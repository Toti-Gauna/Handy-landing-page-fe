// Fechas y horas de la demo (puras). Todo en la zona horaria de Argentina.
// La demo transcurre en un "hoy" fijo (demo.json → config.hoy) para que el recorrido sea siempre igual;
// no se puede elegir una fecha anterior a ese día.

export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';

/** Fecha sin hora: "2026-11-17". */
export type FechaISO = string;

export interface Hora {
  h: number;
  m: number;
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function partes(f: FechaISO): { anio: number; mes: number; dia: number } {
  const m = RE_FECHA.exec(f);
  if (!m) throw new Error(`Fecha inválida: "${f}"`);
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) throw new Error(`Fecha inválida: "${f}"`);
  return { anio, mes, dia };
}

const dos = (n: number) => String(n).padStart(2, '0');
export const iso = (anio: number, mes: number, dia: number): FechaISO => `${anio}-${dos(mes)}-${dos(dia)}`;

export const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** 0 = domingo … 6 = sábado. */
export function diaDeSemana(f: FechaISO): number {
  const { anio, mes, dia } = partes(f);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

export const comparar = (a: FechaISO, b: FechaISO) => (a < b ? -1 : a > b ? 1 : 0);
export const esPasada = (f: FechaISO, hoy: FechaISO) => comparar(f, hoy) < 0;

export function sumarDias(f: FechaISO, n: number): FechaISO {
  const { anio, mes, dia } = partes(f);
  const d = new Date(Date.UTC(anio, mes - 1, dia + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Mes siguiente / anterior: { anio, mes }. */
export function sumarMeses(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** Grilla de un mes que empieza el domingo: null en los huecos del principio y del final (semanas completas). */
export function grillaMes(anio: number, mes: number): (FechaISO | null)[] {
  const inicio = diaDeSemana(iso(anio, mes, 1));
  const n = diasDelMes(anio, mes);
  const celdas: (FechaISO | null)[] = Array.from({ length: inicio }, () => null);
  for (let d = 1; d <= n; d++) celdas.push(iso(anio, mes, d));
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}

/** "Hoy" en Argentina para un instante dado (fuera de la demo, con el reloj real). */
export function hoyEnArgentina(ahora: Date): FechaISO {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_ARGENTINA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
  return p;
}

const fmt = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-AR', { timeZone: ZONA_ARGENTINA, ...opciones });
/** Mediodía de esa fecha en Argentina (UTC−3): así el formato nunca cambia de día. */
const instante = (f: FechaISO) => {
  const { anio, mes, dia } = partes(f);
  return new Date(Date.UTC(anio, mes - 1, dia, 15));
};
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Miércoles 18/11" */
export const fechaLarga = (f: FechaISO) => {
  const { dia, mes } = partes(f);
  return `${mayuscula(fmt({ weekday: 'long' }).format(instante(f)))} ${dos(dia)}/${dos(mes)}`;
};
/** "Mié 18" */
export const fechaCorta = (f: FechaISO) => `${mayuscula(fmt({ weekday: 'short' }).format(instante(f)).replace('.', ''))} ${partes(f).dia}`;
/** "noviembre 2026" → "Noviembre 2026" */
export const nombreMes = (anio: number, mes: number) => mayuscula(fmt({ month: 'long', year: 'numeric' }).format(instante(iso(anio, mes, 1)))).replace(' de ', ' ');

export function horaValida(h: Hora): boolean {
  return Number.isInteger(h.h) && Number.isInteger(h.m) && h.h >= 0 && h.h <= 23 && h.m >= 0 && h.m <= 59;
}

/** "03:00" */
export function horaTexto(h: Hora): string {
  if (!horaValida(h)) throw new Error(`Hora inválida: ${h.h}:${h.m}`);
  return `${dos(h.h)}:${dos(h.m)}`;
}

/** "03:00" → { h: 3, m: 0 } */
export function leerHora(texto: string): Hora {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto);
  const h = m ? { h: Number(m[1]), m: Number(m[2]) } : { h: NaN, m: NaN };
  if (!horaValida(h)) throw new Error(`Hora inválida: "${texto}"`);
  return h;
}
