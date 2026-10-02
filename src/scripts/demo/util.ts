// Utilidades compartidas por los módulos de la demo (navegador).

import tarifas from '../../content/tarifas.json';

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$ 45.000" (igual que en el build). */
export const formatoPesos = (n: number) => pesos.format(Math.round(n)).replace(/ /g, ' ');

/** "$ 45.000" sin corte entre "$" y el número (para montos dentro de oraciones). */
export const pesosJuntos = (n: number) => formatoPesos(n).replace(/ /g, '\u00a0');

export const TARIFAS = tarifas;

/** Lo que paga el cliente: presupuesto + tarifa de servicio. */
export const totalCliente = (presupuesto: number) => Math.round(presupuesto * (1 + tarifas.normal.cliente / 100));

/** Tarifa de servicio que ve el cliente. */
export const tarifaCliente = (presupuesto: number) => Math.round((presupuesto * tarifas.normal.cliente) / 100);

/** Lo que retiene Handy al especialista. */
export const retencionEspecialista = (monto: number) => Math.round((monto * tarifas.normal.especialista) / 100);

/** Lo que le queda al especialista. */
export const netoEspecialista = (monto: number) => monto - retencionEspecialista(monto);

/** Reemplaza {clave} por valores. */
export const completar = (texto: string, vars: Record<string, string | number>) =>
  texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
