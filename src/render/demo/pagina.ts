// Página /demo/: panel con el selector de rol y el recorrido + el celular navegable.

import demo from '../../content/demo.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { boton as botonSitio, etiqueta } from '../componentes.ts';
import { type Ctx, esc, plano, titular, url } from '../util.ts';
import { ICONOS_CLIENTE } from './piezas.ts';
import type { PaginaRender } from '../paginas.ts';
import { demoUsuario } from './usuario.ts';
import { demoEspecialista } from './especialista.ts';
import type { DemoRol, PantallaDemo, RolDemo } from './tipos.ts';

const ROLES: RolDemo[] = ['usuario', 'especialista'];
type TipoError = keyof typeof demo.errores;

/** Título de la app con ==marcador==. */
const marcado = (t: string) => esc(t).replace(/==(.+?)==/g, '<mark>$1</mark>');

/** Pantalla de error con el Handy roto (una por tipo; el motor muestra la que corresponde). */
function pantallaError(tipo: TipoError): string {
  const e = demo.errores[tipo];
  const img = (lado: string) => `<img class="hd-error__pieza hd-error__pieza--${lado}" src="/src/img/${e.personaje}.webp" alt="" width="300" height="300" loading="lazy" decoding="async" />`;
  const otro = 'otro' in e ? e.otro : null;
  return `<div class="hd-error" data-demo-error="${tipo}" data-tipo="${tipo}" role="alertdialog" aria-modal="true" aria-labelledby="demo-error-${tipo}" tabindex="-1" hidden>
  <div class="hd-error__escena" aria-hidden="true">
    <div class="hd-error__personaje">${img('a')}${img('b')}<span class="hd-error__fx"><i></i><i></i><i></i><i></i></span></div>
  </div>
  <p class="hd-sobre hd-error__codigo">${esc(e.sobre)}</p>
  <p class="hd-titulo hd-error__titulo" id="demo-error-${tipo}">${marcado(e.titulo)}</p>
  <p class="hd-texto hd-texto--suave hd-error__texto">${esc(e.texto)}</p>
  <div class="hd-botones">
    <button type="button" class="hd-boton" data-demo-error-boton="reintentar">${icono('reintentar')}${esc(e.reintentar)}</button>
    ${otro ? `<button type="button" class="hd-boton hd-boton--claro" data-demo-error-boton="otro"${otro.ir ? ` data-ir-error="${esc(otro.ir)}"` : ''}>${esc(otro.texto)}</button>` : ''}
  </div>
</div>`;
}

function validar(rol: RolDemo, d: DemoRol) {
  const pre = rol === 'usuario' ? 'u-' : 'e-';
  const ids = new Set<string>();
  for (const p of d.pantallas) {
    if (!p.id.startsWith(pre)) throw new Error(`Demo ${rol}: el id "${p.id}" tiene que empezar con "${pre}"`);
    if (ids.has(p.id)) throw new Error(`Demo ${rol}: id repetido "${p.id}"`);
    ids.add(p.id);
  }
  for (const obligatorio of ['inicio', 'turnos', 'mensajes', 'cuenta', 'notificaciones']) {
    if (!ids.has(pre + obligatorio)) throw new Error(`Demo ${rol}: falta la pantalla obligatoria "${pre}${obligatorio}"`);
  }
  if (!ids.has(d.inicio)) throw new Error(`Demo ${rol}: la pantalla de inicio "${d.inicio}" no existe`);
  // Todo destino de navegación tiene que existir.
  for (const p of d.pantallas) {
    for (const m of p.html.matchAll(/data-ir(?:-raiz)?="([^"]+)"/g)) {
      if (!ids.has(m[1])) throw new Error(`Demo ${rol}: "${p.id}" apunta a "${m[1]}", que no existe`);
    }
  }
  const enRecorrido = new Set<string>();
  for (const paso of d.recorrido) {
    if (enRecorrido.has(paso.pantalla)) throw new Error(`Demo ${rol}: la pantalla "${paso.pantalla}" aparece en dos pasos del recorrido`);
    enRecorrido.add(paso.pantalla);
    if (!ids.has(paso.pantalla)) throw new Error(`Demo ${rol}: el recorrido usa "${paso.pantalla}", que no existe`);
    if (paso.base && !ids.has(paso.base)) throw new Error(`Demo ${rol}: el recorrido usa la base "${paso.base}", que no existe`);
    if (paso.pausa !== undefined && !(Number.isInteger(paso.pausa) && paso.pausa >= 1000 && paso.pausa <= 15000)) {
      throw new Error(`Demo ${rol}: la pausa del paso "${paso.pantalla}" tiene que ser un número entero de 1000 a 15000 (ms)`);
    }
  }
}

function pantalla(rol: RolDemo, p: PantallaDemo, visible: boolean): string {
  const comunes = `data-pantalla="${esc(p.id)}" data-rol="${rol}" data-titulo="${esc(p.titulo)}"${visible ? '' : ' hidden'}`;
  if (p.tipo === 'hoja') {
    return `<div class="demo-pantalla demo-pantalla--hoja" data-tipo="hoja" ${comunes}>
  <button type="button" class="demo-velo" data-volver tabindex="-1" aria-label="${esc(demo.ui.cerrar)}"></button>
  <div class="app-sheet demo-hoja" role="dialog" aria-modal="true" aria-label="${esc(p.titulo)}" tabindex="-1">${p.html}</div>
</div>`;
  }
  return `<div class="demo-pantalla" data-tipo="pantalla" tabindex="-1" ${comunes}>${p.html}</div>`;
}

function recorrido(rol: RolDemo, d: DemoRol, visible: boolean): string {
  const pasos = d.recorrido
    .map(
      (paso, i) => `<li><button type="button" class="demo-paso" data-demo-paso="${i}" data-pantalla="${esc(paso.pantalla)}"${paso.base ? ` data-base="${esc(paso.base)}"` : ''}${paso.pausa ? ` data-pausa="${paso.pausa}"` : ''}>
  <span class="demo-paso__numero">${i + 1}</span>
  <span class="demo-paso__texto"><strong>${plano(paso.titulo)}</strong><small>${plano(paso.texto)}</small></span>
</button></li>`,
    )
    .join('');
  return `<ol class="demo__pasos" data-demo-recorrido="${rol}" data-inicio="${esc(d.inicio)}"${visible ? '' : ' hidden'}>${pasos}</ol>`;
}

export function paginaDemo(ctx: Ctx): PaginaRender {
  const datos: Record<RolDemo, DemoRol> = { usuario: demoUsuario(), especialista: demoEspecialista() };
  ROLES.forEach((r) => validar(r, datos[r]));

  const c = demo.controles;
  const tabs = ROLES.map(
    (r, i) => `<button type="button" class="demo-rol" role="tab" id="demo-tab-${r}" aria-controls="demo-recorrido-${r}" aria-selected="${i === 0}" ${i ? 'tabindex="-1"' : ''} data-demo-rol="${r}">
  <strong>${esc(demo.roles[r].texto)}</strong><small>${esc(demo.roles[r].detalle)}</small>
</button>`,
  ).join('');

  const pantallas = ROLES.flatMap((r) =>
    datos[r].pantallas.map((p) => pantalla(r, p, r === 'usuario' && p.id === datos.usuario.inicio)),
  ).join('\n');

  // Aviso de fin del recorrido (se ve con .demo--fin): sumarse o pasar al otro lado.
  const f = demo.finAviso;
  const fin = `<div class="demo-fin" data-demo-fin>${ROLES.map((r) => {
    const otro = ROLES.find((x) => x !== r)!;
    return `<div class="demo-fin__caja" data-demo-fin-rol="${r}"${r === 'usuario' ? '' : ' hidden'}>
  <p class="demo-fin__titulo">${icono('check')}<span>${esc(f.titulo)}</span></p>
  <p class="demo-fin__texto">${esc(f.texto)}</p>
  <div class="demo-fin__acciones">
    <a class="demo-fin__cta" href="${esc(url(ctx, demo.cta[r].href))}">${esc(demo.cta[r].texto)}</a>
    <button type="button" class="demo-fin__otro" data-demo-otro-rol="${otro}">${esc(f.otro[otro])}${icono('flecha')}</button>
  </div>
</div>`;
  }).join('')}</div>`;

  const control = (accion: string, ic: string, texto: string, clase = '') =>
    `<button type="button" class="demo-control ${clase}" data-demo-control="${accion}" aria-label="${esc(texto)}" title="${esc(texto)}">${
      accion === 'reproducir' ? `${icono('play', 'icono icono--play')}${icono('pausa', 'icono icono--pausa')}` : icono(ic)
    }</button>`;

  const cuerpo = `
<section class="demo" data-demo data-rol="usuario" aria-labelledby="demo-titulo">
  <div class="contenedor demo__grilla">
    <div class="demo__panel">
      ${etiqueta(demo.etiqueta, 'play', 'etiqueta--amarilla')}
      <h1 class="demo__titulo" id="demo-titulo">${titular(demo.titulo)}</h1>
      <p class="demo__bajada">${plano(demo.bajada)}</p>

      <div class="demo__roles" role="tablist" aria-label="${esc(demo.rolesAria)}">${tabs}</div>

      <div class="demo__recorrido">
        <p class="demo__recorrido-titulo">${esc(demo.recorridoTitulo)} <span data-demo-progreso></span></p>
        ${ROLES.map((r, i) => `<div role="tabpanel" id="demo-recorrido-${r}" aria-labelledby="demo-tab-${r}"${i ? ' hidden' : ''}>${recorrido(r, datos[r], true)}</div>`).join('')}
      </div>

      <div class="demo__cta">
        ${ROLES.map((r, i) => `<div data-demo-cta="${r}"${i ? ' hidden' : ''}>${botonSitio(ctx, demo.cta[r], 'azul', 'boton--grande', true)}</div>`).join('')}
      </div>
      <div class="demo__simular">
        <p class="demo__recorrido-titulo">${esc(demo.simular.titulo)}</p>
        <p class="demo__simular-bajada">${esc(demo.simular.bajada)}</p>
        ${ROLES.map((r, i) => `<div class="demo__simular-botones" data-demo-simular-rol="${r}"${i ? ' hidden' : ''}>${(demo.simular.roles[r] as TipoError[])
          .map((t) => `<button type="button" class="demo-simular" data-demo-simular="${t}"><img src="/src/img/${demo.errores[t].personaje}.webp" alt="" width="40" height="40" loading="lazy" decoding="async" />${esc(demo.errores[t].boton)}</button>`)
          .join('')}</div>`).join('')}
      </div>
      <p class="demo__aviso">${plano(demo.aviso)}</p>
    </div>

    <div class="demo__escenario">
      <div class="demo__fijo">
        <figure class="telefono telefono--demo" aria-label="${esc(demo.ui.pantalla)}">
          <div class="telefono__marco">
            <span class="telefono__boton telefono__boton--a" aria-hidden="true"></span><span class="telefono__boton telefono__boton--b" aria-hidden="true"></span><span class="telefono__boton telefono__boton--c" aria-hidden="true"></span>
            <div class="telefono__pantalla" data-demo-pantallas>
              ${pantallas}
              ${(Object.keys(demo.errores) as TipoError[]).map(pantallaError).join('')}
              <div class="hd-confeti" data-demo-confeti aria-hidden="true"></div>
              <span class="telefono__isla" aria-hidden="true"></span>
              <div class="hd-isla" data-demo-isla aria-hidden="true"><span class="hd-isla__ico"></span><span class="hd-isla__texto"><strong></strong><small></small></span></div>
              <span class="demo-dedo" aria-hidden="true" data-demo-dedo></span>
              ${fin}
            </div>
          </div>
        </figure>
        <div class="demo__controles">
          ${control('anterior', 'izquierda', c.anterior)}
          ${control('reproducir', 'play', c.reproducir, 'demo-control--play')}
          ${control('siguiente', 'derecha', c.siguiente, 'demo-control--siguiente')}
          ${control('reiniciar', 'reintentar', c.reiniciar)}
          ${control('presentacion', 'expandir', c.presentacion)}
        </div>
        <button type="button" class="demo-app-boton" data-demo-control="app">${icono('telefono')}<span><strong>${esc(demo.app.boton)}</strong><small>${esc(demo.app.detalle)}</small></span></button>
        <p class="demo__ayuda">${plano(demo.ayuda)}</p>
        <noscript><p class="demo__ayuda">${plano(demo.sinJs)}</p></noscript>
      </div>
    </div>
  </div>
  <p class="sr" aria-live="polite" data-demo-anuncio></p>
  <button type="button" class="demo-app-salir" data-demo-salir-app aria-label="${esc(demo.app.salirAria)}">${icono('cerrar')}<span>${esc(demo.app.salir)}</span></button>
  <template data-demo-iconos>${ICONOS_CLIENTE.map((n) => `<span data-icono="${n}">${icono(n)}</span>`).join('')}</template>
</section>`;
  const headExtra = `
<link rel="manifest" href="${esc(url(ctx, '/demo.webmanifest'))}" />
<link rel="apple-touch-icon" href="${esc(url(ctx, '/icono-app-180.png'))}" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="${esc(demo.app.nombre)}" />`;
  return { meta: demo.meta, cuerpo, headExtra };
}
