// Cálculos de plata de la demo (puros: sin DOM ni JSON). Los usan el build (src/render/demo) y el navegador
// (src/scripts/demo), así una propuesta muestra el mismo total en la lista, el detalle, la aceptación y el pago.
//
// Reglas (CLAUDE.md y tarifas.json):
// - El especialista pone su precio; Handy sugiere.
// - Cliente: paga el subtotal (mano de obra + materiales) + la tarifa de Handy del cliente (tarifas.normal.cliente, 5%).
// - Especialista: recibe el subtotal menos la tarifa de Handy del especialista (tarifas.normal.especialista, 10%).
//   Las dos tarifas no se mezclan: la del especialista nunca se suma a lo que paga el cliente.
// - Tope de la tarifa: solo si el contrato de datos lo define (hoy tarifas.json no tiene tope).

export interface Tarifas {
  /** Tarifa de Handy que paga el cliente, en %. */
  cliente: number;
  /** Tarifa de Handy que se descuenta al especialista, en %. */
  especialista: number;
  /** Tope de la tarifa del cliente en pesos (opcional; si no está, no hay tope). */
  topeCliente?: number | null;
}

export type TipoConcepto = 'mano' | 'material';

export interface Concepto {
  tipo: TipoConcepto;
  descripcion: string;
  monto: number;
}

export interface Presupuesto {
  manoDeObra: number;
  materiales: number;
}

export interface Desglose {
  manoDeObra: number;
  materiales: number;
  /** Mano de obra + materiales (+ adicionales aprobados). */
  subtotal: number;
  tarifaCliente: number;
  /** Lo que paga el cliente: subtotal + tarifa del cliente. */
  totalCliente: number;
  tarifaEspecialista: number;
  /** Lo que le queda al especialista: subtotal − tarifa del especialista. */
  netoEspecialista: number;
}

/** Pesos enteros (los montos de la demo no llevan centavos). */
export const redondear = (n: number) => Math.round(n);

export function tarifaCliente(subtotal: number, t: Tarifas): number {
  const tarifa = redondear((subtotal * t.cliente) / 100);
  return t.topeCliente != null ? Math.min(tarifa, t.topeCliente) : tarifa;
}

export const tarifaEspecialista = (subtotal: number, t: Tarifas) => redondear((subtotal * t.especialista) / 100);

/** Desglose completo de un presupuesto, con los adicionales que el cliente ya aceptó. */
export function desglose(p: Presupuesto, t: Tarifas, adicionalesAprobados: Concepto[] = []): Desglose {
  const extraMano = adicionalesAprobados.filter((c) => c.tipo === 'mano').reduce((s, c) => s + c.monto, 0);
  const extraMaterial = adicionalesAprobados.filter((c) => c.tipo === 'material').reduce((s, c) => s + c.monto, 0);
  const manoDeObra = redondear(p.manoDeObra + extraMano);
  const materiales = redondear(p.materiales + extraMaterial);
  const subtotal = manoDeObra + materiales;
  const tc = tarifaCliente(subtotal, t);
  const te = tarifaEspecialista(subtotal, t);
  return { manoDeObra, materiales, subtotal, tarifaCliente: tc, totalCliente: subtotal + tc, tarifaEspecialista: te, netoEspecialista: subtotal - te };
}

/** Lo que ve el cliente en la propuesta de un adicional: el concepto, su tarifa y el total final nuevo. */
export function propuestaAdicional(p: Presupuesto, t: Tarifas, aprobados: Concepto[], nuevo: Concepto) {
  const antes = desglose(p, t, aprobados);
  const despues = desglose(p, t, [...aprobados, nuevo]);
  return {
    concepto: nuevo,
    /** Tarifa del cliente que agrega este concepto. */
    tarifaCliente: despues.tarifaCliente - antes.tarifaCliente,
    /** Lo que suma este concepto al total del cliente (concepto + su tarifa). */
    sumaAlTotal: despues.totalCliente - antes.totalCliente,
    totalAntes: antes.totalCliente,
    totalDespues: despues.totalCliente,
    netoEspecialistaDespues: despues.netoEspecialista,
  };
}

/** Mínimo de la demo para mandar un presupuesto (configurable; ver LEG-14). */
export function validarMinimo(monto: number, minimo: number): { ok: boolean; minimo: number } {
  return { ok: Number.isFinite(monto) && monto >= minimo, minimo };
}

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** "$ 45.000" (con espacio común, como el resto del sitio). */
export const formatoPesos = (n: number) => pesos.format(redondear(n)).replace(/\s/g, ' ');
