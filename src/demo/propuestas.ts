// Solicitudes y propuestas dentro del chat (puras).
//
// - Solicitud (la inicia el cliente): pide un turno programado (fecha y hora) o "ahora" (urgencia), con el problema.
//   El especialista la cotiza o le propone otro horario/precio.
// - Propuesta (la inicia el especialista, o responde a una solicitud): precio, fecha y hora.
//   El cliente la acepta o la rechaza explícitamente. Nada es un turno confirmado antes de esa aceptación.
// - Cambio de turno y adicionales: también son propuestas pendientes; mientras tanto vale lo anterior.
// El historial queda en el chat: una respuesta no borra la tarjeta, le cambia el estado.

export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada' | 'reemplazada';

export interface ItemChat {
  id: string;
  estado: EstadoPropuesta;
}

/** Responder una propuesta pendiente. Una ya respondida no cambia. */
export function responder<T extends ItemChat>(p: T, respuesta: 'aceptar' | 'rechazar'): T {
  if (p.estado !== 'pendiente') return p;
  return { ...p, estado: respuesta === 'aceptar' ? 'aceptada' : 'rechazada' };
}

/** Una contraoferta deja la anterior como "reemplazada" (sigue en el historial) y suma la nueva, pendiente. */
export function contraofertar<T extends ItemChat>(historial: T[], idAnterior: string, nueva: T): T[] {
  return [...historial.map((x) => (x.id === idAnterior && x.estado === 'pendiente' ? { ...x, estado: 'reemplazada' as const } : x)), { ...nueva, estado: 'pendiente' as const }];
}

/** Lo vigente de un turno: el último aceptado; si no hay, el original. Lo pendiente no cuenta. */
export function vigente<T extends ItemChat>(original: T, historial: T[]): T {
  const aceptadas = historial.filter((x) => x.estado === 'aceptada');
  return aceptadas.length ? aceptadas[aceptadas.length - 1] : original;
}
