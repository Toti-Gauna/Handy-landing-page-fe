// Utilidades de render: se ejecutan en Node (plugin de Vite), no en el navegador.

import sitio from '../content/sitio.json' with { type: 'json' };
import tarifas from '../content/tarifas.json' with { type: 'json' };

export type Pagina = 'inicio' | 'especialistas' | 'registro' | 'privacidad' | '404';

export interface Ctx {
  base: string;
  pagina: Pagina;
}

export interface Enlace {
  texto: string;
  href: string;
  pagina?: string;
}

export function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$ 45.000" (pesos argentinos, sin decimales). */
export function formatoPesos(n: number): string {
  return pesos.format(n).replace(/ /g, ' ');
}

export const porcentaje = (n: number) => `${n}%`;

export const emailContacto = (): string | null =>
  sitio.contacto.email.includes('@') ? sitio.contacto.email : null;

const { normal, camadaFundadora, ejemplo } = tarifas;

/** Valores que pueden aparecer entre llaves en cualquier texto de src/content. */
export const variables: Record<string, string> = {
  tarifaEspecialista: porcentaje(normal.especialista),
  tarifaCliente: porcentaje(normal.cliente),
  tarifaFundadora: porcentaje(camadaFundadora.especialista),
  lugares: String(camadaFundadora.lugares),
  meses: String(camadaFundadora.meses),
  fechaCorta: sitio.lanzamiento.corta,
  fechaLarga: sitio.lanzamiento.larga,
  presupuesto: formatoPesos(ejemplo.presupuesto),
  recibis: formatoPesos(ejemplo.presupuesto * (1 - normal.especialista / 100)),
  montoFundador: formatoPesos(ejemplo.presupuesto * (1 - camadaFundadora.especialista / 100)),
};

export function interpolar(texto: string, extra: Record<string, string> = {}): string {
  const vars = { ...variables, ...extra };
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in vars)) throw new Error(`Variable sin definir en el contenido: ${m} (en "${texto}")`);
    return vars[k];
  });
}

/** Convierte una ruta del contenido ("/registro/?tipo=usuario", "/#preguntas", "#x") en un href con la base. */
export function url(ctx: Ctx, href: string): string {
  if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith('#')) return href;
  if (href.startsWith('/#') && ctx.pagina === 'inicio') return href.slice(1);
  return ctx.base + href.replace(/^\//, '');
}

/** Texto plano del contenido → HTML seguro. Admite [texto](/ruta/), **negrita** y {variables}. */
export function rico(ctx: Ctx, texto: string, extra: Record<string, string> = {}): string {
  return esc(interpolar(texto, extra))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, h: string) => `<a href="${esc(url(ctx, h.replace(/&amp;/g, '&')))}">${t}</a>`);
}

/** Igual que rico() pero sin markup: para atributos y meta tags. */
export const plano = (texto: string, extra: Record<string, string> = {}) => esc(interpolar(texto, extra));
