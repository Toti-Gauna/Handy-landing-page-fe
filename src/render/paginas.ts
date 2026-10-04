import sitio from '../content/sitio.json' with { type: 'json' };
import inicio from '../content/inicio.json' with { type: 'json' };
import especialistas from '../content/especialistas.json' with { type: 'json' };
import rubros from '../content/rubros.json' with { type: 'json' };
import preguntasJson from '../content/preguntas.json' with { type: 'json' };
import tarifas from '../content/tarifas.json' with { type: 'json' };
import registro from '../content/registro.json' with { type: 'json' };
import privacidad from '../content/privacidad.json' with { type: 'json' };
import demo from '../content/demo.json' with { type: 'json' };
import { RUBROS, OPCIONES_CUIT } from '../schema/preregistro.ts';
import { icono } from './iconos.ts';
import {
  bandaDemo,
  bandaFinal,
  boton,
  canoConGota,
  cuentaRegresiva,
  encabezado,
  etiqueta,
  handy,
  preguntas,
  telefono,
  type PantallaTelefono,
  trailer,
  vitrina,
} from './componentes.ts';
import { type Ctx, emailContacto, esc, formatoPesos, plano, rico, titular, url, variables } from './util.ts';
import type { Meta } from './layout.ts';

export interface PaginaRender {
  meta: Meta;
  cuerpo: string;
  header?: 'claro' | 'azul';
  /** Etiquetas extra para el <head> (ya escapadas). */
  headExtra?: string;
}

// Los ids de rubros del contenido tienen que ser los mismos que acepta el esquema.
const idsContenido = rubros.rubros.map((r) => r.id).join(',');
if (idsContenido !== RUBROS.join(',')) {
  throw new Error(`rubros.json (${idsContenido}) no coincide con RUBROS del esquema (${RUBROS.join(',')})`);
}

// ── Inicio ────────────────────────────────────────────────────────────────

export function paginaInicio(ctx: Ctx): PaginaRender {
  const h = inicio.hero;
  const cf = inicio.comoFunciona;
  const ia = inicio.handia;
  const apd = inicio.appPorDentro;

  const tarjetasRubros = rubros.rubros
    .map(
      (r) => `<li class="rubro" data-revelar>
  <span class="rubro__icono">${icono(r.icono)}</span>
  <h3 class="rubro__nombre">${plano(r.nombre)}</h3>
  <p class="rubro__ejemplo">${plano(r.ejemplo)}</p>
</li>`,
    )
    .join('');

  const confianza = inicio.confianza.items
    .map(
      (c) => `<li class="confianza__item" data-revelar>
  <span class="confianza__icono">${icono(c.icono)}</span>
  <div><h3>${plano(c.titulo)}</h3><p>${plano(c.texto)}</p></div>
</li>`,
    )
    .join('');

  const porDentro = apd.items
    .map(
      (it, i) => `<li class="por-dentro__item" data-revelar>
  ${telefono(it.pantalla as PantallaTelefono, i % 2 === 0 ? 'telefono--inclinado-izq' : 'telefono--inclinado-der')}
  <div class="por-dentro__texto"><h3>${plano(it.titulo)}</h3><p>${plano(it.texto)}</p></div>
</li>`,
    )
    .join('');

  const be = inicio.bandaEspecialista;

  const cuerpo = `
<section class="hero" aria-labelledby="hero-titulo">
  <div class="contenedor hero__grilla">
    <div class="hero__texto">
      <div data-hero>${etiqueta(h.etiqueta)}</div>
      <h1 class="hero__titulo" id="hero-titulo" data-hero>${titular(h.titulo)}</h1>
      <p class="hero__bajada" data-hero>${plano(h.bajada)}</p>
      <div class="hero__ctas" data-hero>
        ${boton(ctx, h.ctaPrimario, 'azul', 'boton--grande', true)}
        ${boton(ctx, h.ctaSecundario, 'contorno', 'boton--grande')}
      </div>
      <div data-hero>${cuentaRegresiva('hero__cuenta')}</div>
    </div>
    <div class="hero__escena" data-escena>
      <div class="mosaicos-fondo" aria-hidden="true"></div>
      ${telefono('u-inicio', 'telefono--hero')}
      ${canoConGota({ clase: 'escena__cano', eager: true })}
      ${handy('lamparita', { clase: 'escena__lamparita', eager: true })}
      ${handy('engranaje', { clase: 'escena__engranaje', eager: true })}
      ${handy('llave', { clase: 'escena__llave', eager: true })}
    </div>
  </div>
</section>

<section class="seccion seccion--como" id="${esc(cf.id)}" aria-labelledby="${esc(cf.id)}-titulo" data-espiar>
  <div class="contenedor">
    ${encabezado(cf.titulo, `${cf.id}-titulo`, cf.bajada)}
    ${vitrina(cf.pasos, { numerada: true, decorado: handy('engranaje', { clase: 'vitrina__handy', data: 'engranaje-vitrina' }) })}
  </div>
</section>

${bandaDemo(ctx, demo.banda.usuario)}

<section class="seccion seccion--handia" id="${esc(ia.id)}" aria-labelledby="${esc(ia.id)}-titulo">
  <div class="contenedor handia">
    <div class="handia__texto" data-revelar>
      ${etiqueta(ia.etiqueta, 'chat', 'etiqueta--amarilla')}
      <h2 class="titulo-seccion" id="${esc(ia.id)}-titulo">${titular(ia.titulo)}</h2>
      <p class="handia__bajada">${plano(ia.texto)}</p>
      <ul class="handia__puntos">${ia.puntos.map((t) => `<li>${icono('check')}<span>${plano(t)}</span></li>`).join('')}</ul>
    </div>
    <div class="handia__escena" data-revelar>
      <span class="handia__halo" aria-hidden="true"></span>
      ${telefono('u-handia', 'telefono--handia')}
      ${handy('lamparita', { clase: 'handia__lamparita', data: 'lamparita-handia' })}
    </div>
  </div>
</section>

<section class="seccion seccion--rubros" aria-labelledby="rubros-titulo">
  <div class="contenedor">
    ${encabezado(inicio.rubros.titulo, 'rubros-titulo', inicio.rubros.bajada)}
    <div class="rubros-caja">
      ${handy('llave', { clase: 'rubros__llave', data: 'llave-rubros' })}
      <ul class="rubros">${tarjetasRubros}</ul>
    </div>
  </div>
</section>

<section class="seccion seccion--por-dentro" aria-labelledby="por-dentro-titulo">
  <div class="contenedor">
    ${encabezado(apd.titulo, 'por-dentro-titulo')}
    <ul class="por-dentro">${porDentro}</ul>
    <p class="nota-ilustrativa">${esc(sitio.pantallasIlustrativas)}</p>
  </div>
</section>

${trailer(inicio.trailer, 'trailer-usuario')}

<section class="seccion seccion--confianza" aria-labelledby="confianza-titulo">
  <div class="contenedor confianza">
    ${encabezado(inicio.confianza.titulo, 'confianza-titulo')}
    <ul class="confianza__lista">${confianza}</ul>
  </div>
</section>

<aside class="contenedor banda-especialista" aria-label="${plano(be.texto)}">
  <a class="banda-especialista__link" href="${esc(url(ctx, be.href))}" data-revelar>
    ${handy('engranaje', { clase: 'banda-especialista__handy', data: 'engranaje-banda' })}
    <span class="banda-especialista__texto"><small>${plano(be.texto)}</small><strong>${plano(be.link)}</strong></span>
    <span class="banda-especialista__boton" aria-hidden="true">${icono('flecha')}</span>
  </a>
</aside>

${preguntas(ctx, inicio.preguntas, preguntasJson.usuario)}

${bandaFinal(ctx, inicio.bandaFinal)}
`;
  return { meta: inicio.meta, cuerpo };
}

// ── Especialistas ─────────────────────────────────────────────────────────

export function paginaEspecialistas(ctx: Ctx): PaginaRender {
  const e = especialistas;
  const h = e.hero;
  const cc = e.comoCobras;
  const cam = e.camada;
  const retencion = (tarifas.ejemplo.presupuesto * tarifas.normal.especialista) / 100;

  const cuerpo = `
<section class="hero hero--azul" aria-labelledby="hero-titulo">
  <div class="contenedor hero__grilla">
    <div class="hero__texto">
      <div data-hero>${etiqueta(h.etiqueta, 'maletin', 'etiqueta--amarilla')}</div>
      <h1 class="hero__titulo" id="hero-titulo" data-hero>${titular(h.titulo)}</h1>
      <p class="hero__bajada" data-hero>${plano(h.bajada)}</p>
      <div class="hero__ctas" data-hero>
        ${boton(ctx, h.ctaPrimario, 'amarillo', 'boton--grande', true)}
        ${boton(ctx, h.ctaSecundario, 'contorno-blanco', 'boton--grande')}
      </div>
      <div data-hero>${cuentaRegresiva('hero__cuenta cuenta--azul')}</div>
    </div>
    <div class="hero__escena" data-escena>
      <div class="mosaicos-fondo mosaicos-fondo--oscuro" aria-hidden="true"></div>
      ${telefono('e-precio', 'telefono--hero')}
      ${handy('llave', { clase: 'escena__llave escena__llave--esp', eager: true })}
      ${handy('engranaje', { clase: 'escena__engranaje escena__engranaje--esp', eager: true })}
    </div>
  </div>
</section>

<section class="seccion seccion--herramientas" aria-labelledby="herramientas-titulo">
  <div class="contenedor">
    ${encabezado(e.herramientas.titulo, 'herramientas-titulo', e.herramientas.bajada)}
    ${vitrina(e.herramientas.items, { decorado: handy('llave', { clase: 'vitrina__handy vitrina__handy--llave', data: 'llave-vitrina' }) })}
  </div>
</section>

${bandaDemo(ctx, demo.banda.especialista)}

${trailer(e.trailer, 'trailer-especialista')}

<section class="seccion seccion--cobro" id="${esc(cc.id)}" aria-labelledby="${esc(cc.id)}-titulo">
  <div class="contenedor cobro">
    <div class="cobro__texto" data-revelar>
      <h2 class="titulo-seccion" id="${esc(cc.id)}-titulo">${titular(cc.titulo)}</h2>
      <p class="encabezado__bajada">${plano(cc.texto)}</p>
      <div class="costo" role="group" aria-label="${plano(cc.ejemploTitulo)}">
        <p class="costo__titulo">${plano(cc.ejemploTitulo)}${icono('info')}</p>
        <dl class="costo__filas">
          <div><dt>${plano(cc.presupuesto)}</dt><dd>${esc(variables.presupuesto)}</dd></div>
          <div><dt>${plano(cc.tarifa)}</dt><dd>− ${esc(formatoPesos(retencion))}</dd></div>
          <div class="costo__total"><dt>${plano(cc.recibis)}</dt><dd data-contar="${tarifas.ejemplo.presupuesto - retencion}">${esc(variables.recibis)}</dd></div>
        </dl>
      </div>
      <p class="cobro__nota">${plano(cc.notaFundadora)}</p>
    </div>
    <div class="cobro__pantalla" data-revelar>${telefono('e-fin')}</div>
  </div>
</section>

<section class="seccion seccion--camada" aria-labelledby="camada-titulo">
  <div class="contenedor">
    <div class="cupon" data-revelar>
      <div class="cupon__izq">
        <span class="cupon__numero">${plano(cam.numero)}</span>
        <span class="cupon__numero-label">${plano(cam.numeroLabel)}</span>
      </div>
      <div class="cupon__der">
        ${etiqueta(cam.etiqueta, 'etiqueta', 'etiqueta--azul')}
        <h2 class="cupon__destacado" id="camada-titulo">${titular(cam.destacado)}</h2>
        <p class="cupon__texto">${plano(cam.texto)}</p>
        <p class="cupon__normal">${plano(cam.tarifaNormal)}</p>
        ${boton(ctx, cam.cta, 'azul', 'boton--grande', true)}
      </div>
      ${canoConGota({ clase: 'cupon__handy' })}
    </div>
  </div>
</section>

${preguntas(ctx, e.preguntas, preguntasJson.especialista)}

${bandaFinal(ctx, e.bandaFinal)}
`;
  return { meta: e.meta, cuerpo, header: 'azul' };
}

// ── Registro ──────────────────────────────────────────────────────────────

function campo(
  nombre: string,
  c: { label: string; placeholder?: string },
  opciones: { tipo?: string; opcional?: boolean; autocomplete?: string; inputmode?: string; area?: boolean; form: string },
): string {
  const id = `${opciones.form}-${nombre}`;
  const opcional = opciones.opcional ? ` <span class="campo__opcional">(${esc(registro.opcional)})</span>` : '';
  const comunes = `id="${id}" name="${nombre}" placeholder="${esc(c.placeholder ?? '')}" aria-describedby="${id}-error"${opciones.opcional ? '' : ' required'}${opciones.autocomplete ? ` autocomplete="${opciones.autocomplete}"` : ''}`;
  const control = opciones.area
    ? `<textarea ${comunes} rows="3" maxlength="500"></textarea>`
    : `<input ${comunes} type="${opciones.tipo ?? 'text'}"${opciones.inputmode ? ` inputmode="${opciones.inputmode}"` : ''} />`;
  return `<div class="campo" data-campo="${nombre}">
  <label class="campo__label" for="${id}">${esc(c.label)}${opcional}</label>
  ${control}
  <p class="campo__error" id="${id}-error" data-error-de="${nombre}"></p>
</div>`;
}

function comunesFinales(form: string, ctx: Ctx): string {
  const r = registro.campos;
  return `<div class="campo campo--check" data-campo="acepta">
  <label class="check">
    <input type="checkbox" name="acepta" id="${form}-acepta" required aria-describedby="${form}-acepta-error" />
    <span class="check__caja" aria-hidden="true">${icono('check')}</span>
    <span>${esc(r.acepta.texto)} <a href="${esc(url(ctx, '/privacidad/'))}" target="_blank" rel="noopener">${esc(r.acepta.link)}</a></span>
  </label>
  <p class="campo__error" id="${form}-acepta-error" data-error-de="acepta"></p>
</div>
<div class="trampa" aria-hidden="true">
  <label for="${form}-sitio_web">${esc(r.honeypot.label)}</label>
  <input type="text" id="${form}-sitio_web" name="sitio_web" tabindex="-1" autocomplete="off" />
</div>
<p class="form__resumen" role="alert" data-resumen></p>
<div class="form__enviar">
  <button class="boton boton--azul boton--grande form__boton" type="submit" data-enviar
    data-texto="${esc(registro.enviar)}" data-enviando="${esc(registro.enviando)}" data-deshabilitado="${esc(registro.deshabilitado.boton)}">
    <span data-enviar-texto>${esc(registro.enviar)}</span>
  </button>
  ${handy('engranaje', { clase: 'form__engranaje', data: 'engranaje-form', eager: true })}
</div>`;
}

export function paginaRegistro(ctx: Ctx): PaginaRender {
  const r = registro;
  const c = r.campos;
  const rubrosChecks = rubros.rubros
    .map(
      (ru) => `<label class="opcion">
  <input type="checkbox" name="rubros" value="${esc(ru.id)}" />
  <span class="opcion__caja">${icono(ru.icono)}${esc(ru.nombre)}</span>
</label>`,
    )
    .join('');
  const cuit = OPCIONES_CUIT.map(
    (o) => `<label class="opcion opcion--radio">
  <input type="radio" name="cuit" value="${o}" required />
  <span class="opcion__caja">${esc(c.cuit.opciones[o])}</span>
</label>`,
  ).join('');

  const cuerpo = `
<section class="registro" aria-labelledby="registro-titulo">
  <div class="contenedor registro__caja">
    <div class="registro__cabecera">
      <h1 class="registro__titulo" id="registro-titulo">${titular(r.titulo)}</h1>
      <p class="registro__bajada">${plano(r.bajada)}</p>
      <p class="registro__contador" data-contador hidden></p>
    </div>

    <div class="aviso aviso--info" data-deshabilitado hidden>
      <strong>${esc(r.deshabilitado.titulo)}</strong>
      <span>${esc(r.deshabilitado.texto)}</span>
    </div>

    <div class="tarjeta-form" data-tarjeta>
      <div class="pestanas" role="tablist" aria-label="${esc(r.pestanasAria)}">
        <button class="pestanas__boton" type="button" role="tab" id="tab-usuario" aria-controls="panel-usuario" aria-selected="true" data-tab="usuario">${esc(r.pestanas.usuario)}</button>
        <button class="pestanas__boton" type="button" role="tab" id="tab-especialista" aria-controls="panel-especialista" aria-selected="false" tabindex="-1" data-tab="especialista">${esc(r.pestanas.especialista)}</button>
      </div>

      <form class="form" id="panel-usuario" role="tabpanel" aria-labelledby="tab-usuario" data-form="usuario" novalidate>
        ${campo('nombre', c.nombre, { form: 'u', autocomplete: 'given-name' })}
        ${campo('email', c.email, { form: 'u', tipo: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${campo('whatsapp', c.whatsapp, { form: 'u', tipo: 'tel', opcional: true, autocomplete: 'tel', inputmode: 'tel' })}
        ${campo('barrio', c.barrio, { form: 'u', autocomplete: 'address-level3' })}
        ${campo('necesidad', c.necesidad, { form: 'u', opcional: true, area: true })}
        ${comunesFinales('u', ctx)}
      </form>

      <form class="form" id="panel-especialista" role="tabpanel" aria-labelledby="tab-especialista" data-form="especialista" novalidate hidden>
        ${campo('nombre', c.nombre, { form: 'e', autocomplete: 'name' })}
        ${campo('whatsapp', c.whatsapp, { form: 'e', tipo: 'tel', autocomplete: 'tel', inputmode: 'tel' })}
        ${campo('email', c.email, { form: 'e', tipo: 'email', autocomplete: 'email', inputmode: 'email' })}
        <fieldset class="campo campo--grupo" data-campo="rubros" aria-describedby="e-rubros-ayuda e-rubros-error">
          <legend class="campo__label">${esc(c.rubros.label)}</legend>
          <p class="campo__ayuda" id="e-rubros-ayuda">${esc(c.rubros.ayuda)}</p>
          <div class="opciones opciones--rubros">${rubrosChecks}</div>
          <p class="campo__error" id="e-rubros-error" data-error-de="rubros"></p>
        </fieldset>
        ${campo('zona', c.zona, { form: 'e' })}
        <fieldset class="campo campo--grupo" data-campo="cuit" aria-describedby="e-cuit-error">
          <legend class="campo__label">${esc(c.cuit.label)}</legend>
          <div class="opciones opciones--cuit">${cuit}</div>
          <p class="campo__error" id="e-cuit-error" data-error-de="cuit"></p>
        </fieldset>
        ${comunesFinales('e', ctx)}
      </form>

      <div class="estado estado--error" data-estado-error hidden role="alert">
        ${handy('llave', { clase: 'estado__handy', data: 'llave-error' })}
        <div>
          <p class="estado__titulo">${esc(r.error.titulo)}</p>
          <p>${esc(r.error.texto)}</p>
          <button class="boton boton--azul" type="button" data-reintentar>${icono('reintentar')}${esc(r.error.reintentar)}</button>
        </div>
      </div>
    </div>

    <div class="exito" data-exito hidden tabindex="-1" aria-live="polite">
      <div class="exito__escena" data-festejo>
        ${handy('grupo', { clase: 'exito__handys', data: 'grupo-exito' })}
      </div>
      <h2 class="exito__titulo" data-exito-titulo data-plantilla="${esc(r.exito.titulo)}"></h2>
      <p class="exito__texto" data-exito-texto data-usuario="${esc(r.exito.texto)}" data-especialista="${esc(r.exito.textoEspecialista)}"></p>
      <div class="exito__acciones">
        <a class="boton boton--whatsapp boton--grande" data-compartir target="_blank" rel="noopener" data-mensaje="${esc(r.exito.mensajeWhatsapp)}" href="https://wa.me/">${icono('whatsapp')}${esc(r.exito.compartir)}</a>
        ${boton(ctx, { texto: r.exito.volver, href: '/' }, 'contorno', 'boton--grande')}
      </div>
    </div>
  </div>
</section>`;
  return { meta: r.meta, cuerpo };
}

// ── Privacidad ────────────────────────────────────────────────────────────

export function paginaPrivacidad(ctx: Ctx): PaginaRender {
  const p = privacidad;
  const email = emailContacto();
  const extra = { email: email ? `[${email}](mailto:${email})` : p.emailPendiente };
  const secciones = p.secciones
    .map(
      (s: { id?: string; titulo: string; parrafos: string[] }) => `<section class="legal__seccion"${s.id ? ` id="${esc(s.id)}"` : ''}>
  <h2>${plano(s.titulo)}</h2>
  ${s.parrafos.map((t) => `<p>${rico(ctx, t, extra)}</p>`).join('\n  ')}
</section>`,
    )
    .join('\n');
  const cuerpo = `
<article class="legal contenedor">
  <header class="legal__cabecera">
    <h1>${titular(p.titulo)}</h1>
    <p>${plano(p.bajada)}</p>
  </header>
  ${secciones}
</article>`;
  return { meta: p.meta, cuerpo };
}

// ── 404 ───────────────────────────────────────────────────────────────────

export function pagina404(ctx: Ctx): PaginaRender {
  const n = sitio.noEncontrado;
  const cuerpo = `
<section class="no-encontrado contenedor">
  <div class="no-encontrado__roto" aria-hidden="true">
    <img class="no-encontrado__pieza no-encontrado__pieza--a" src="/src/img/handy-llave-rota.webp" alt="" width="600" height="565" />
    <img class="no-encontrado__pieza no-encontrado__pieza--b" src="/src/img/handy-llave-rota.webp" alt="" width="600" height="565" />
  </div>
  <h1>${titular(n.titulo)}</h1>
  <p>${plano(n.texto)}</p>
  ${boton(ctx, n.cta, 'azul', 'boton--grande')}
</section>`;
  return { meta: { titulo: `${n.titulo.replace(/==/g, '')} · Handy`, descripcion: n.texto }, cuerpo };
}
