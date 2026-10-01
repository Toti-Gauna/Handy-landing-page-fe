import sitio from '../content/sitio.json' with { type: 'json' };
import { icono } from './iconos.ts';
import { type Ctx, type Enlace, esc, plano, rico, url } from './util.ts';

type Variante = 'azul' | 'amarillo' | 'blanco' | 'contorno' | 'contorno-blanco';

export function boton(ctx: Ctx, e: Enlace, variante: Variante = 'azul', extra = ''): string {
  return `<a class="boton boton--${variante} ${extra}" href="${esc(url(ctx, e.href))}">${esc(e.texto)}</a>`;
}

// ── Handys ────────────────────────────────────────────────────────────────
// Imágenes de assets/brand convertidas a webp (npm run imagenes).
const HANDYS = {
  cano: { src: 'handy-cano', w: 354, h: 405 },
  gota: { src: 'handy-gota', w: 93, h: 125 },
  engranaje: { src: 'handy-engranaje', w: 338, h: 339 },
  lamparita: { src: 'handy-lamparita', w: 202, h: 346 },
  llave: { src: 'handy-llave', w: 581, h: 547 },
  grupo: { src: 'handys-grupo', w: 600, h: 311 },
} as const;

export type NombreHandy = keyof typeof HANDYS;

export function handy(
  nombre: NombreHandy,
  opciones: { clase?: string; eager?: boolean; alt?: string; data?: string } = {},
): string {
  const h = HANDYS[nombre];
  const carga = opciones.eager ? 'eager' : 'lazy';
  return `<img class="handy handy--${nombre} ${opciones.clase ?? ''}" src="/src/img/${h.src}.webp" alt="${esc(opciones.alt ?? '')}" width="${h.w}" height="${h.h}" loading="${carga}" decoding="async" data-handy="${opciones.data ?? nombre}" />`;
}

/** Caño con la gota aparte, para que la gota caiga en loop. */
export function canoConGota(opciones: { clase?: string; eager?: boolean } = {}): string {
  return `<div class="cano-gota ${opciones.clase ?? ''}" data-handy="cano-gota">
  ${handy('cano', { eager: opciones.eager, data: 'cano' })}
  ${handy('gota', { eager: opciones.eager, clase: 'cano-gota__gota', data: 'gota' })}
</div>`;
}

// ── Estructura ─────────────────────────────────────────────────────────────

export function encabezado(titulo: string, id: string, bajada?: string): string {
  return `<div class="encabezado" data-revelar>
  <h2 class="encabezado__titulo" id="${esc(id)}">${plano(titulo)}</h2>
  ${bajada ? `<p class="encabezado__bajada">${plano(bajada)}</p>` : ''}
</div>`;
}

export function telefono(contenido: string, etiqueta: string, clase = ''): string {
  return `<figure class="telefono ${clase}">
  <div class="telefono__marco" aria-hidden="true">
    <div class="telefono__isla"></div>
    <div class="telefono__pantalla">${contenido}</div>
  </div>
  <figcaption class="sr">${esc(sitio.pantallaIlustrativa)}: ${esc(etiqueta)}</figcaption>
</figure>`;
}

export function cuentaRegresiva(clase = ''): string {
  const c = sitio.cuentaRegresiva;
  const unidad = (id: string, label: string) =>
    `<div class="cuenta__item"><span class="cuenta__num" data-unidad="${id}">--</span><span class="cuenta__label">${esc(label)}</span></div>`;
  return `<div class="cuenta ${clase}" data-cuenta data-fecha="${esc(sitio.lanzamiento.fecha)}" role="timer">
  <p class="cuenta__titulo">${esc(c.titulo)}</p>
  <div class="cuenta__grilla" data-cuenta-grilla>
    ${unidad('dias', c.dias)}${unidad('horas', c.horas)}${unidad('minutos', c.minutos)}${unidad('segundos', c.segundos)}
  </div>
  <p class="cuenta__lanzado" data-cuenta-lanzado hidden>${esc(c.lanzado)}</p>
</div>`;
}

export interface Trailer {
  titulo: string;
  bajada: string;
  video: string;
  poster: string;
  portadaAlt: string;
}

/** Ruta de assets/ del contenido → ruta absoluta que Vite procesa (hash + base). */
const asset = (ruta: string) => '/' + ruta.replace(/^\/+/, '');

export function trailer(t: Trailer, id: string): string {
  let medio: string;
  if (t.video) {
    const poster = t.poster ? asset(t.poster) : '/src/img/handys-grupo.webp';
    medio = `<video class="trailer__video" controls playsinline preload="none" poster="${esc(poster)}" aria-label="${esc(t.titulo)}">
      <source src="${esc(asset(t.video))}" type="video/mp4" />
      ${esc(sitio.trailer.noSoportado)}
    </video>`;
  } else {
    medio = `<div class="trailer__portada">
      ${handy('grupo', { alt: t.portadaAlt, clase: 'trailer__handys' })}
      <span class="trailer__play" aria-hidden="true">${icono('play')}</span>
      <span class="trailer__proximamente">${esc(sitio.trailer.proximamente)}</span>
    </div>`;
  }
  return `<section class="seccion seccion--trailer" aria-labelledby="${id}-titulo">
  <div class="contenedor">
    <div class="encabezado" data-revelar>
      <h2 class="encabezado__titulo" id="${id}-titulo">${plano(t.titulo)}</h2>
      <p class="encabezado__bajada">${plano(t.bajada)}</p>
    </div>
    <div class="trailer ${t.video ? '' : 'trailer--placeholder'}" data-revelar>${medio}</div>
  </div>
</section>`;
}

export interface Pregunta {
  pregunta: string;
  respuesta: string;
  estado?: string;
}

export function preguntas(ctx: Ctx, id: string, titulo: string, items: Pregunta[]): string {
  const lista = items
    .map(
      (p) => `<details class="faq__item" data-faq${p.estado ? ` data-estado="${esc(p.estado)}"` : ''}>
  <summary class="faq__pregunta"><span>${plano(p.pregunta)}</span><span class="faq__signo" aria-hidden="true"></span></summary>
  <div class="faq__respuesta"><p>${rico(ctx, p.respuesta)}</p></div>
</details>`,
    )
    .join('\n');
  return `<section class="seccion seccion--preguntas" id="${esc(id)}" aria-labelledby="${esc(id)}-titulo" data-espiar>
  <div class="contenedor faq">
    <div class="faq__lado">
      <h2 class="encabezado__titulo" id="${esc(id)}-titulo" data-revelar>${plano(titulo)}</h2>
      ${handy('lamparita', { clase: 'faq__lamparita', data: 'lamparita-faq' })}
    </div>
    <div class="faq__lista" data-revelar>${lista}</div>
  </div>
</section>`;
}

export function bandaFinal(ctx: Ctx, b: { titulo: string; texto: string; cta: Enlace }): string {
  return `<section class="banda-final" aria-labelledby="banda-final-titulo">
  <div class="contenedor banda-final__caja" data-revelar>
    <div class="banda-final__texto">
      <h2 id="banda-final-titulo">${plano(b.titulo)}</h2>
      <p>${plano(b.texto)}</p>
      ${boton(ctx, b.cta, 'amarillo', 'boton--grande')}
    </div>
    ${handy('grupo', { clase: 'banda-final__handys', data: 'grupo-final' })}
  </div>
</section>`;
}
