// Interpretación de las respuestas del backend (solo del lado de la landing; el BE no tiene esta parte).
// Sin dependencias del navegador: se prueba con `npm test`.

import { CAMPOS, type Campo, errorValidacionSchema } from './preregistro.ts';

/** Qué le pasó al pedido de alta. Cada valor tiene su texto en registro.json → error.motivos. */
export type ResultadoAlta =
  | { tipo: 'ok' }
  | { tipo: 'validacion'; campos: Campo[] }
  | { tipo: 'error'; motivo: MotivoError };

export type MotivoError =
  | 'origen' // 403 origen_no_permitido
  | 'grande' // 413 payload_grande
  | 'limite' // 429 limite
  | 'no_disponible' // 503 no_disponible
  | 'red' // sin conexión
  | 'timeout' // más de TIMEOUT_MS sin respuesta
  | 'generico'; // cualquier otro estado o cuerpo inesperado

/** Campos que el formulario sabe marcar. `aviso` no es un campo visible: no se marca. */
const CAMPOS_VISIBLES = CAMPOS.filter((c) => c !== 'aviso');

/** Campos rechazados que el formulario sabe marcar. Cualquier otra respuesta da []. */
export function camposRechazados(respuesta: unknown): Campo[] {
  const r = errorValidacionSchema.safeParse(respuesta);
  if (!r.success) return [];
  return [...new Set(r.data.campos)].filter((c): c is Campo => (CAMPOS_VISIBLES as readonly string[]).includes(c));
}

/**
 * Traduce la respuesta de POST /preregistro. Éxito SOLO con 201 y `{ ok: true }`.
 * Cualquier otra cosa (incluso un 200 o un 2xx distinto) es un error: nunca se muestra éxito sin alta.
 */
export function clasificarAlta(status: number, cuerpo: unknown): ResultadoAlta {
  if (status === 201) {
    const ok = typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as { ok?: unknown }).ok === true;
    return ok ? { tipo: 'ok' } : { tipo: 'error', motivo: 'generico' };
  }
  if (status === 400) {
    const campos = camposRechazados(cuerpo);
    return campos.length ? { tipo: 'validacion', campos } : { tipo: 'error', motivo: 'generico' };
  }
  const porEstado: Record<number, MotivoError> = { 403: 'origen', 413: 'grande', 429: 'limite', 503: 'no_disponible' };
  return { tipo: 'error', motivo: porEstado[status] ?? 'generico' };
}

/** Motivo de un fallo del `fetch` (nunca llegó una respuesta). */
export function motivoDeFalla(error: unknown): MotivoError {
  return error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'red';
}
