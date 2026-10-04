// Llegada automática del especialista (pura). En producción la marcaría una geocerca alrededor del domicilio del
// trabajo aceptado (mecanismo, radio y precisión los define el proyecto: PROD-11 / LEG-09). En la demo se simula
// con eventos mock deterministas: no hay radio fijo ni permisos nativos, y nadie confirma la llegada a mano.
//
// Solo se sigue la ubicación de un trabajo aceptado y durante el viaje; al llegar (o al cancelar) se deja de seguir.

export type EstadoLlegada =
  | 'pidiendo-permiso' // se explica para qué se usa la ubicación, antes de pedirla
  | 'sin-permiso' // la persona no dio permiso: no hay llegada automática, el trabajo sigue igual
  | 'en-camino'
  | 'senal-imprecisa' // la ubicación llega con poca precisión: no se marca la llegada hasta que mejore
  | 'sin-senal' // se perdió la ubicación un rato: se espera a que vuelva
  | 'llego';

export type EventoLlegada =
  | { tipo: 'permiso'; concedido: boolean }
  | { tipo: 'posicion'; dentroDeLaZona: boolean; precisa: boolean }
  | { tipo: 'sin-senal' }
  | { tipo: 'cancelado' };

export function siguiente(estado: EstadoLlegada, ev: EventoLlegada): EstadoLlegada {
  if (estado === 'llego') return estado; // una vez que llegó, no vuelve atrás
  switch (ev.tipo) {
    case 'permiso':
      return ev.concedido ? 'en-camino' : 'sin-permiso';
    case 'cancelado':
      return estado;
    case 'sin-senal':
      return estado === 'sin-permiso' || estado === 'pidiendo-permiso' ? estado : 'sin-senal';
    case 'posicion':
      if (estado === 'sin-permiso' || estado === 'pidiendo-permiso') return estado;
      if (!ev.precisa) return 'senal-imprecisa';
      return ev.dentroDeLaZona ? 'llego' : 'en-camino';
  }
}

/** ¿Se puede seguir la ubicación? Solo con permiso, con el trabajo aceptado y mientras no llegó. */
export const seSigueUbicacion = (estado: EstadoLlegada, trabajoAceptado: boolean) =>
  trabajoAceptado && (estado === 'en-camino' || estado === 'senal-imprecisa' || estado === 'sin-senal');

/** Recorrido mock de la demo: sale, pierde precisión un momento y llega. Siempre igual. */
export const RECORRIDO_DEMO: EventoLlegada[] = [
  { tipo: 'permiso', concedido: true },
  { tipo: 'posicion', dentroDeLaZona: false, precisa: true },
  { tipo: 'posicion', dentroDeLaZona: false, precisa: false },
  { tipo: 'posicion', dentroDeLaZona: false, precisa: true },
  { tipo: 'posicion', dentroDeLaZona: true, precisa: true },
];

/** Aplica una lista de eventos desde un estado. */
export const recorrer = (desde: EstadoLlegada, eventos: EventoLlegada[]) => eventos.reduce(siguiente, desde);
