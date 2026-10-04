// Agenda de la demo (pura): qué trabajos hay cada día.

import type { FechaISO } from './fechas.ts';

export interface TrabajoAgenda {
  id: string;
  fecha: FechaISO;
}

/** Todos los trabajos de un día, en el orden en que vienen (los datos ya vienen ordenados por hora). */
export const trabajosDelDia = <T extends TrabajoAgenda>(trabajos: T[], fecha: FechaISO): T[] => trabajos.filter((t) => t.fecha === fecha);

/** Cuántos trabajos hay en cada día de un mes ("2026-11" → { "2026-11-17": 2 }). */
export function cantidadPorDia(trabajos: TrabajoAgenda[], anio: number, mes: number): Record<FechaISO, number> {
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}-`;
  const r: Record<FechaISO, number> = {};
  for (const t of trabajos) if (t.fecha.startsWith(prefijo)) r[t.fecha] = (r[t.fecha] ?? 0) + 1;
  return r;
}
