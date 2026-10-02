import sitio from '../content/sitio.json' with { type: 'json' };
import { icono } from './iconos.ts';
import { ETIQUETAS, type NombrePantalla, PANTALLAS } from './pantallas.ts';
import { type Ctx, type Enlace, esc, plano, rico, sinMarcas, titular, url } from './util.ts';

type Variante = 'azul' | 'amarillo' | 'blanco' | 'contorno' | 'contorno-blanco';

/** Botón "táctil": tiene una base que se hunde al tocarlo, como una tecla. */
export function boton(ctx: Ctx, e: Enlace, variante: Variante = 'azul', extra = '', conFlecha = false): string {
  const flecha = conFlecha ? `<span class="boton__flecha">${icono('flecha')}</span>` : '';
  return `<a class="boton boton--${variante} ${extra}" href="${esc(url(ctx, e.href))}"><span>${esc(e.texto)}</span>${flecha}</a>`;
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

export function encabezado(titulo: string, id: string, bajada?: string, clase = ''): string {
  return `<div class="encabezado ${clase}" data-revelar>
  <h2 class="titulo-seccion" id="${esc(id)}">${titular(titulo)}</h2>
  ${bajada ? `<p class="encabezado__bajada">${plano(bajada)}</p>` : ''}
</div>`;
}

export const etiqueta = (texto: string, ic = 'pin', clase = '') =>
  `<p class="etiqueta ${clase}">${icono(ic)}<span>${plano(texto)}</span></p>`;

/** Celular con proporción real (9:19.5). Recibe una pantalla por nombre o varias para la vitrina. */
export function telefono(pantallas: NombrePantalla | NombrePantalla[], clase = '', activa = 0): string {
  const lista = Array.isArray(pantallas) ? pantallas : [pantallas];
  const capas = lista
    .map(
      (n, i) =>
        `<div class="telefono__capa${i === activa ? ' telefono__capa--activa' : ''}" data-capa="${i}">${PANTALLAS[n]()}</div>`,
    )
    .join('');
  const etiquetas = lista.map((n) => ETIQUETAS[n]).join(' · ');
  return `<figure class="telefono ${clase}">
  <div class="telefono__marco" aria-hidden="true">
    <span class="telefono__boton telefono__boton--a"></span><span class="telefono__boton telefono__boton--b"></span><span class="telefono__boton telefono__boton--c"></span>
    <div class="telefono__pantalla">${capas}<span class="telefono__isla"></span></div>
  </div>
  <figcaption class="sr">${esc(sitio.pantallaIlustrativa)}: ${esc(etiquetas)}</figcaption>
</figure>`;
}

export interface ItemVitrina {
  titulo: string;
  texto: string;
  pantalla: string;
  icono?: string;
  tipos?: { nombre: string; texto: string; icono: string }[];
}

/**
 * Lista de pasos + un celular. En pantallas anchas el celular queda fijo y cambia de pantalla
 * a medida que scrolleás; en el celular cada paso trae su propia pantalla.
 */
export function vitrina(items: ItemVitrina[], opciones: { numerada?: boolean; decorado?: string } = {}): string {
  const nombres = items.map((it) => it.pantalla as NombrePantalla);
  const pasos = items
    .map((it, i) => {
      const marca = opciones.numerada
        ? `<span class="vitrina__numero" aria-hidden="true">${i + 1}</span>`
        : it.icono
          ? `<span class="vitrina__icono">${icono(it.icono)}</span>`
          : '';
      const tipos = it.tipos
        ? `<ul class="tipos">${it.tipos
            .map((t) => `<li class="tipos__item">${icono(t.icono)}<span><strong>${plano(t.nombre)}</strong><small>${plano(t.texto)}</small></span></li>`)
            .join('')}</ul>`
        : '';
      return `<li class="vitrina__paso" data-paso="${i}">
  <div class="vitrina__texto">
    ${marca}
    <h3 class="vitrina__titulo">${plano(it.titulo)}</h3>
    <p>${plano(it.texto)}</p>
    ${tipos}
  </div>
  <div class="vitrina__movil">${telefono(nombres[i])}</div>
</li>`;
    })
    .join('');
  const puntos = items.map((_, i) => `<span class="vitrina__punto${i === 0 ? ' vitrina__punto--activo' : ''}"></span>`).join('');
  return `<div class="vitrina" data-vitrina>
  <ol class="vitrina__pasos">${pasos}</ol>
  <div class="vitrina__escenario">
    <div class="vitrina__fijo">
      <div class="mosaicos-fondo" aria-hidden="true"></div>
      ${telefono(nombres, 'telefono--vitrina')}
      <div class="vitrina__puntos" aria-hidden="true">${puntos}</div>
      ${opciones.decorado ?? ''}
    </div>
  </div>
</div>
<p class="nota-ilustrativa">${esc(sitio.pantallasIlustrativas)}</p>`;
}

export function cuentaRegresiva(clase = ''): string {
  const c = sitio.cuentaRegresiva;
  const unidad = (id: string, label: string) =>
    `<div class="cuenta__item"><span class="cuenta__num" data-unidad="${id}">--</span><span class="cuenta__label">${esc(label)}</span></div>`;
  return `<div class="cuenta ${clase}" data-cuenta data-fecha="${esc(sitio.lanzamiento.fecha)}" role="timer">
  <p class="cuenta__titulo">${icono('calendario')}${esc(c.titulo)}</p>
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
    medio = `<video class="trailer__video" controls playsinline preload="none" poster="${esc(poster)}" aria-label="${esc(sinMarcas(t.titulo))}">
      <source src="${esc(asset(t.video))}" type="video/mp4" />
      ${esc(sitio.trailer.noSoportado)}
    </video>`;
  } else {
    medio = `<div class="trailer__portada">
      <div class="mosaicos-fondo mosaicos-fondo--oscuro" aria-hidden="true"></div>
      ${handy('grupo', { alt: t.portadaAlt, clase: 'trailer__handys', data: 'grupo-trailer' })}
      <span class="trailer__play" aria-hidden="true">${icono('play')}</span>
      <span class="trailer__proximamente">${esc(sitio.trailer.proximamente)}</span>
    </div>`;
  }
  return `<section class="seccion seccion--trailer" aria-labelledby="${id}-titulo">
  <div class="contenedor">
    ${encabezado(t.titulo, `${id}-titulo`, t.bajada)}
    <div class="trailer ${t.video ? '' : 'trailer--placeholder'}" data-revelar>${medio}</div>
  </div>
</section>`;
}

export interface Pregunta {
  pregunta: string;
  respuesta: string;
  estado?: string;
}

/** Preguntas con el formato del "Centro de ayuda" de la app: pastilla azul que se abre en tarjeta. */
export function preguntas(ctx: Ctx, d: { id: string; titulo: string; bajada?: string }, items: Pregunta[]): string {
  const lista = items
    .map(
      (p) => `<details class="ayuda__item" data-faq${p.estado ? ` data-estado="${esc(p.estado)}"` : ''}>
  <summary class="ayuda__pregunta"><span>${plano(p.pregunta)}</span><span class="ayuda__signo" aria-hidden="true">${icono('abajo')}</span></summary>
  <div class="ayuda__respuesta"><p>${rico(ctx, p.respuesta)}</p></div>
</details>`,
    )
    .join('\n');
  return `<section class="seccion seccion--preguntas" id="${esc(d.id)}" aria-labelledby="${esc(d.id)}-titulo" data-espiar>
  <div class="contenedor ayuda">
    <div class="ayuda__lado">
      ${encabezado(d.titulo, `${d.id}-titulo`, d.bajada)}
      ${handy('lamparita', { clase: 'ayuda__lamparita', data: 'lamparita-faq' })}
    </div>
    <div class="ayuda__lista" data-revelar>${lista}</div>
  </div>
</section>`;
}

/** Banda que invita a probar la demo interactiva (inicio y especialistas). */
export function bandaDemo(ctx: Ctx, b: { texto: string; link: string; href: string }): string {
  return `<aside class="contenedor banda-especialista banda-demo" aria-label="${plano(b.link)}">
  <a class="banda-especialista__link" href="${esc(url(ctx, b.href))}" data-revelar>
    <span class="banda-demo__play" aria-hidden="true">${icono('play')}</span>
    <span class="banda-especialista__texto"><small>${plano(b.texto)}</small><strong>${plano(b.link)}</strong></span>
    <span class="banda-especialista__boton" aria-hidden="true">${icono('flecha')}</span>
  </a>
</aside>`;
}

export function bandaFinal(ctx: Ctx, b: { titulo: string; texto: string; cta: Enlace }): string {
  return `<section class="banda-final" aria-labelledby="banda-final-titulo">
  <div class="contenedor">
    <div class="banda-final__caja" data-revelar>
      <div class="banda-final__texto">
        <h2 class="titulo-seccion" id="banda-final-titulo">${titular(b.titulo)}</h2>
        <p>${plano(b.texto)}</p>
        ${boton(ctx, b.cta, 'azul', 'boton--grande', true)}
      </div>
      <div class="banda-final__handys">${handy('grupo', { data: 'grupo-final' })}</div>
    </div>
  </div>
</section>`;
}

/** Pantalla de carga con los Handys. Solo se ve con JS, sin "reducir movimiento" y una vez por sesión. */
export function intro(): string {
  const i = sitio.intro;
  const letras = [...sitio.bajada].map((c) => `<span>${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  return `<div class="intro" data-intro role="status" aria-label="${esc(i.aria)}">
  <div class="intro__escena">
    <div class="intro__cano">${handy('cano', { eager: true, data: 'intro-cano' })}</div>
    ${handy('gota', { eager: true, clase: 'intro__gota', data: 'intro-gota' })}
    <span class="intro__charco"></span>
    <span class="intro__salpicadura" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <div class="intro__logo">
      <img class="intro__marca" src="/src/img/logo-handy.webp" alt="" width="720" height="194" />
      <span class="intro__bajada" aria-hidden="true">${letras}</span>
    </div>
    <div class="intro__piso">
      ${handy('engranaje', { eager: true, clase: 'intro__engranaje', data: 'intro-engranaje' })}
      <span class="intro__luz"></span>
      ${handy('lamparita', { eager: true, clase: 'intro__lamparita', data: 'intro-lamparita' })}
      ${handy('llave', { eager: true, clase: 'intro__llave', data: 'intro-llave' })}
    </div>
    <div class="intro__progreso"><span class="intro__barra"><i data-intro-barra></i></span><span class="intro__numero" data-intro-numero>0</span></div>
  </div>
  <button class="intro__saltar" type="button" data-intro-saltar>${esc(i.saltar)}</button>
</div>`;
}
