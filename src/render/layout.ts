import sitio from '../content/sitio.json' with { type: 'json' };
import { tipografia, variablesCss } from '../brand/tokens.ts';
import { icono } from './iconos.ts';
import { handy, intro } from './componentes.ts';
import { type Ctx, type Enlace, emailContacto, esc, plano, url } from './util.ts';

export interface Meta {
  titulo: string;
  descripcion: string;
}

export function head(_ctx: Ctx, meta: Meta): string {
  return `
<title>${plano(meta.titulo)}</title>
<meta name="description" content="${plano(meta.descripcion)}" />
<meta name="theme-color" content="#1F57A8" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="es_AR" />
<meta property="og:title" content="${plano(meta.titulo)}" />
<meta property="og:description" content="${plano(meta.descripcion)}" />
<link rel="icon" type="image/png" href="/src/img/icono.png" />
<link rel="apple-touch-icon" href="/src/img/icono.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="${esc(tipografia.googleFonts)}" onload="this.onload=null;this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="${esc(tipografia.googleFonts)}" /></noscript>
<style>${variablesCss()}</style>
<script>
  // Pantalla de carga: una vez por sesión, solo si no se pidió reducir el movimiento.
  // Si algo falla, a los 7 s se saca sola para no tapar la página.
  try {
    if (!sessionStorage.getItem('handy-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('con-intro');
      setTimeout(function () { document.documentElement.classList.remove('con-intro'); }, 7000);
    }
  } catch (e) {}
</script>`;
}

function logo(ctx: Ctx, clase = ''): string {
  return `<a class="logo ${clase}" href="${esc(url(ctx, '/'))}" aria-label="${esc(sitio.header.inicioAria)}">
  <img class="logo__marca" src="/src/img/logo-handy.webp" alt="" width="720" height="194" />
  <span class="logo__bajada">${esc(sitio.bajada)}</span>
</a>`;
}

function actual(ctx: Ctx, e: Enlace): string {
  return e.pagina === ctx.pagina ? ' aria-current="page"' : '';
}

export function header(ctx: Ctx, variante: 'claro' | 'azul' = 'claro'): string {
  const h = sitio.header;
  const items = h.nav
    .map(
      (e: Enlace) =>
        `<li><a class="nav__link" href="${esc(url(ctx, e.href))}"${actual(ctx, e)} data-nav-link>${esc(e.texto)}</a></li>`,
    )
    .join('');
  return `<a class="saltar" href="#contenido">${esc(h.saltar)}</a>
<header class="header header--${variante}" data-header>
  <div class="header__barra contenedor">
    ${logo(ctx, 'header__logo')}
    <nav class="nav" id="nav-principal" aria-label="${esc(h.navAria)}" data-nav>
      <ul class="nav__lista">${items}</ul>
    </nav>
    <a class="boton boton--amarillo boton--chico header__cta" href="${esc(url(ctx, h.cta.href))}"${actual(ctx, h.cta)}>${esc(h.cta.texto)}</a>
    <button class="header__menu" type="button" aria-expanded="false" aria-controls="nav-principal" data-menu
      data-abrir="${esc(h.menuAbrir)}" data-cerrar="${esc(h.menuCerrar)}" aria-label="${esc(h.menuAbrir)}">
      ${icono('menu', 'icono icono--abrir')}${icono('cerrar', 'icono icono--cerrar')}
    </button>
  </div>
</header>`;
}

export function footer(ctx: Ctx): string {
  const f = sitio.footer;
  const email = emailContacto();
  const contacto = email
    ? `<a href="mailto:${esc(email)}">${esc(f.contacto)}: ${esc(email)}</a>`
    : `<span>${esc(f.contactoPendiente)}</span>`;
  return `<footer class="footer">
  <div class="footer__handys" aria-hidden="true">
    ${handy('engranaje', { clase: 'footer__engranaje', data: 'engranaje-footer' })}
    ${handy('lamparita', { clase: 'footer__lamparita', data: 'lamparita-footer' })}
  </div>
  <div class="contenedor footer__grilla">
    <div class="footer__marca">
      <img class="footer__wordmark" src="/src/img/logo-handy.webp" alt="" width="720" height="194" loading="lazy" decoding="async" />
      <span class="footer__bajada">${esc(sitio.bajada)}</span>
    </div>
    <div class="footer__info">
      <p class="footer__producto">${esc(f.producto)}</p>
      <ul class="footer__links">
        <li>${contacto}</li>
        <li><a href="${esc(url(ctx, '/privacidad/'))}"${ctx.pagina === 'privacidad' ? ' aria-current="page"' : ''}>${esc(f.privacidad)}</a></li>
        <li><span>${esc(f.lugar)}</span></li>
      </ul>
    </div>
  </div>
</footer>`;
}

export function documento(ctx: Ctx, cuerpo: string, opciones: { header?: 'claro' | 'azul' } = {}): string {
  return `${intro()}
${header(ctx, opciones.header)}
<main id="contenido" tabindex="-1">
${cuerpo}
</main>
${footer(ctx)}`;
}

export { plano };
