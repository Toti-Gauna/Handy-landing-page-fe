// Animaciones con GSAP. Los Handys son la personalidad: se mueven solos, reaccionan al scroll
// y festejan el envío del formulario. Con "reducir movimiento" activado no se anima nada.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { colores } from '../brand/tokens';
import { despuesDeIntro } from './intro';

gsap.registerPlugin(ScrollTrigger);

export const movimientoReducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

// Animaciones "en reposo" que aceleran cuando se scrollea.
const reposo: gsap.core.Animation[] = [];

function revelar() {
  const items = $$('[data-revelar]');
  if (!items.length) return;
  gsap.set(items, { autoAlpha: 0, y: 32 });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (lote) => gsap.to(lote, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });
}

function hero() {
  const textos = $$('[data-hero]');
  const escena = $('[data-escena]');
  const tel = escena ? $('.telefono', escena) : null;
  const handys = escena ? $$(':scope > .handy, :scope > .cano-gota', escena) : [];
  if (!textos.length && !escena) return;
  // Ocultos hasta que termine la pantalla de carga.
  if (textos.length) gsap.set(textos, { autoAlpha: 0, y: 26 });
  if (tel) gsap.set(tel, { autoAlpha: 0, y: 80, rotation: 4 });
  if (handys.length) gsap.set(handys, { autoAlpha: 0, scale: 0.3 });

  despuesDeIntro(() => {
    const tl = gsap.timeline();
    if (textos.length) tl.to(textos, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09 });
    if (tel) tl.to(tel, { autoAlpha: 1, y: 0, rotation: 0, duration: 1, ease: 'power3.out' }, 0.1);
    if (handys.length) tl.to(handys, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'back.out(1.9)', stagger: 0.1 }, 0.45);
  });

  if (!escena) return;
  // Parallax: cada Handy se va a distinta velocidad al scrollear el hero.
  const velocidades: Record<string, number> = { cano: -50, lamparita: -130, engranaje: -80, llave: -170 };
  handys.forEach((h) => {
    const clave = Object.keys(velocidades).find((k) => h.className.includes(`escena__${k}`));
    if (!clave) return;
    gsap.to(h, {
      y: velocidades[clave],
      ease: 'none',
      scrollTrigger: { trigger: escena, start: 'top top+=80', end: 'bottom top', scrub: 0.6 },
    });
  });
  if (tel) {
    gsap.to(tel, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: escena, start: 'top top+=80', end: 'bottom top', scrub: 0.6 } });
  }
}

function goteo(gota: HTMLElement, i: number) {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1, delay: 1 + i * 0.4 });
  tl.set(gota, { yPercent: -70, scale: 0.25, autoAlpha: 0, transformOrigin: '50% 0%' })
    .to(gota, { autoAlpha: 1, scale: 1, yPercent: 0, duration: 0.9, ease: 'back.out(1.6)' })
    .to(gota, { scaleY: 1.08, scaleX: 0.94, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' })
    .to(gota, { yPercent: 160, autoAlpha: 0, duration: 0.65, ease: 'power2.in' });
  reposo.push(tl);
}

function enReposo() {
  $$('[data-handy="gota"]').forEach(goteo);
  $$('[data-handy="lamparita"], [data-handy="lamparita-faq"], [data-handy="lamparita-handia"], [data-handy="lamparita-footer"]').forEach((el, i) => {
    reposo.push(
      gsap.to(el, { yPercent: -5, rotation: 4, duration: 1.6 + i * 0.2, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 100%' }),
    );
  });
  $$('[data-handy="llave"], [data-handy="llave-rubros"], [data-handy="llave-vitrina"]').forEach((el, i) => {
    gsap.set(el, { rotation: -6, transformOrigin: '60% 90%' });
    reposo.push(gsap.to(el, { rotation: 6, duration: 1.3 + i * 0.15, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  });
  $$('[data-handy="engranaje"], [data-handy="engranaje-banda"], [data-handy="engranaje-footer"], [data-handy="engranaje-vitrina"]').forEach((el, i) => {
    reposo.push(gsap.to(el, { rotation: i % 2 ? '-=360' : '+=360', duration: 14, ease: 'none', repeat: -1 }));
  });
  $$('[data-handy="cano"]').forEach((el) => {
    reposo.push(gsap.to(el, { scaleY: 0.97, scaleX: 1.02, transformOrigin: '50% 100%', duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  });

  // Reacción al scroll: cuanto más rápido scrolleás, más rápido se mueven.
  let volver: gsap.core.Tween | null = null;
  const ritmo = { v: 1 };
  ScrollTrigger.create({
    onUpdate: (st) => {
      const objetivo = gsap.utils.clamp(1, 6, 1 + Math.abs(st.getVelocity()) / 400);
      if (objetivo > ritmo.v) ritmo.v = objetivo;
      reposo.forEach((a) => a.timeScale(ritmo.v));
      volver?.kill();
      volver = gsap.to(ritmo, { v: 1, duration: 1.2, ease: 'power2.out', onUpdate: () => reposo.forEach((a) => a.timeScale(ritmo.v)) });
    },
  });
}

function alScrollear() {
  // La llave de los rubros se asoma por arriba de la grilla.
  const llave = $('[data-handy="llave-rubros"]');
  if (llave) {
    gsap.from(llave, { yPercent: 60, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.8)', scrollTrigger: { trigger: llave, start: 'top 92%', once: true } });
  }

  // El engranaje de la banda rueda hasta su lugar.
  const engranajeBanda = $('[data-handy="engranaje-banda"]');
  if (engranajeBanda) {
    gsap.from(engranajeBanda, { x: -160, rotation: -360, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: engranajeBanda, start: 'top 95%', once: true } });
  }

  // Los Handys de las bandas finales saltan al entrar.
  $$('[data-handy="grupo-final"]').forEach((g) => {
    gsap.from(g, { yPercent: 40, scale: 0.85, autoAlpha: 0, ease: 'back.out(1.7)', duration: 0.9, scrollTrigger: { trigger: g, start: 'top 95%', once: true } });
  });

  // Los del footer se asoman por el borde.
  $$('.footer__handys .handy').forEach((h, i) => {
    gsap.from(h, { yPercent: 80, autoAlpha: 0, duration: 0.8, delay: i * 0.15, ease: 'back.out(2)', scrollTrigger: { trigger: '.footer', start: 'top 98%', once: true } });
  });

  // La lamparita de HandIA se prende cuando aparece la sección.
  const lampIa = $('[data-handy="lamparita-handia"]');
  if (lampIa) {
    gsap.from(lampIa, { scale: 0.4, autoAlpha: 0, duration: 0.8, ease: 'back.out(2.2)', scrollTrigger: { trigger: lampIa, start: 'top 85%', once: true } });
  }

  // Caño del cupón de la camada fundadora.
  $$('.cupon__handy').forEach((c) => {
    gsap.from(c, { xPercent: 40, rotation: 12, autoAlpha: 0, duration: 1, ease: 'back.out(1.5)', scrollTrigger: { trigger: c, start: 'top 95%', once: true } });
  });

  // Los celulares de "por dentro" entran inclinándose.
  $$('.por-dentro__item .telefono').forEach((t, i) => {
    gsap.from(t, { y: 90, rotation: i ? 10 : -10, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: t, start: 'top 92%', once: true } });
  });
}

/** Lamparita de las preguntas: se prende cuando abrís una. */
function preguntas() {
  $$('.ayuda').forEach((faq) => {
    const lamp = $('.ayuda__lamparita', faq);
    if (!lamp) return;
    const items = $$<HTMLDetailsElement>('details', faq);
    const actualizar = (saltar: boolean) => {
      const prendida = items.some((d) => d.open);
      lamp.classList.toggle('ayuda__lamparita--prendida', prendida);
      if (saltar && prendida && !movimientoReducido()) {
        gsap.fromTo(lamp, { y: 0 }, { y: -18, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 });
      }
    };
    items.forEach((d) => d.addEventListener('toggle', () => actualizar(d.open)));
  });
}

/** Vitrina: el celular fijo muestra la pantalla del paso que estás leyendo. */
function vitrinas() {
  $$('[data-vitrina]').forEach((v) => {
    const pasos = $$('[data-paso]', v);
    const capas = $$('.vitrina__fijo .telefono__capa', v);
    const puntos = $$('.vitrina__punto', v);
    let actual = -1;
    const activar = (i: number) => {
      if (i === actual) return;
      actual = i;
      pasos.forEach((p, j) => p.classList.toggle('vitrina__paso--activo', j === i));
      capas.forEach((c, j) => c.classList.toggle('telefono__capa--activa', j === i));
      puntos.forEach((p, j) => p.classList.toggle('vitrina__punto--activo', j === i));
    };
    activar(0);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) activar(Number((e.target as HTMLElement).dataset.paso));
        });
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    pasos.forEach((p) => io.observe(p));
  });
}

export function iniciarAnimaciones() {
  preguntas();
  vitrinas();
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    revelar();
    hero();
    enReposo();
    alScrollear();
    return () => {
      reposo.length = 0;
    };
  });
  // Las imágenes lazy cambian alturas: recalcular posiciones cuando terminan de cargar.
  window.addEventListener('load', () => ScrollTrigger.refresh());
  despuesDeIntro(() => ScrollTrigger.refresh());
}

// ── Formulario ────────────────────────────────────────────────────────────

/** El engranaje gira rápido mientras se envía. Devuelve la función para frenarlo. */
export function girar(el: HTMLElement | null): () => void {
  if (!el || movimientoReducido()) return () => {};
  const t = gsap.to(el, { rotation: '+=360', duration: 0.7, ease: 'none', repeat: -1 });
  return () => {
    t.kill();
    gsap.to(el, { rotation: '+=90', duration: 0.6, ease: 'power3.out' });
  };
}

/** La llave niega con la cabeza cuando algo falla. */
export function sacudir(el: HTMLElement | null) {
  if (!el || movimientoReducido()) return;
  gsap.fromTo(el, { rotation: 0 }, { keyframes: { rotation: [0, -14, 12, -10, 8, -4, 0] }, duration: 0.8, ease: 'power1.inOut', transformOrigin: '60% 90%' });
}

/** Los Handys festejan: salto + papelitos con los colores de la marca. */
export function festejar(escena: HTMLElement | null) {
  if (!escena || movimientoReducido()) return;
  const handys = $('.exito__handys', escena);
  if (handys) {
    gsap.fromTo(handys, { y: 40, scale: 0.8, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)' });
    gsap.to(handys, { y: -22, duration: 0.28, ease: 'power2.out', yoyo: true, repeat: 5, delay: 0.6 });
  }
  const paleta = [colores.amarillo, colores.azulPersonajes, colores.azul, colores.gris, colores.azulUi];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('span');
    p.className = 'papelito';
    p.style.background = paleta[i % paleta.length];
    escena.appendChild(p);
    gsap.set(p, { left: '50%', top: '55%', width: gsap.utils.random(6, 11), height: gsap.utils.random(8, 16), rotation: gsap.utils.random(0, 360) });
    gsap.to(p, {
      x: gsap.utils.random(-220, 220),
      y: gsap.utils.random(-230, -60),
      rotation: '+=' + gsap.utils.random(180, 720),
      duration: gsap.utils.random(0.7, 1.1),
      ease: 'power3.out',
    });
    gsap.to(p, {
      y: '+=' + gsap.utils.random(200, 320),
      autoAlpha: 0,
      duration: gsap.utils.random(1.2, 1.8),
      delay: gsap.utils.random(0.7, 1.0),
      ease: 'power1.in',
      onComplete: () => p.remove(),
    });
  }
}

export { gsap, ScrollTrigger };
