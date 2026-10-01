// Punto de entrada del render en build: arma el HTML de cada página a partir de src/content.
// Lo usa el plugin "handy-paginas" de vite.config.ts.

import { documento, head } from './layout.ts';
import {
  type PaginaRender,
  pagina404,
  paginaEspecialistas,
  paginaInicio,
  paginaPrivacidad,
  paginaRegistro,
} from './paginas.ts';
import type { Ctx, Pagina } from './util.ts';

const PAGINAS: Record<Pagina, (ctx: Ctx) => PaginaRender> = {
  inicio: paginaInicio,
  especialistas: paginaEspecialistas,
  registro: paginaRegistro,
  privacidad: paginaPrivacidad,
  '404': pagina404,
};

/**
 * Recibe el HTML "cáscara" (index.html de cada carpeta) y reemplaza
 * <!--handy:head--> y <!--handy:pagina--> según <body data-pagina="...">.
 */
export function renderizarPagina(html: string, base: string): string {
  const m = html.match(/<body[^>]*data-pagina="([^"]+)"/);
  if (!m) return html;
  const pagina = m[1] as Pagina;
  const render = PAGINAS[pagina];
  if (!render) throw new Error(`Página desconocida: ${pagina}`);
  const ctx: Ctx = { base, pagina };
  const r = render(ctx);
  return html
    .replace('<!--handy:head-->', head(ctx, r.meta))
    .replace('<!--handy:pagina-->', documento(ctx, r.cuerpo, { header: r.header }));
}
