// Animaciones con GSAP. Los Handys son la personalidad: se mueven solos, reaccionan al scroll
// y festejan el envío del formulario. Con "reducir movimiento" activado no se anima nada.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { colores } from '../brand/tokens';

gsap.registerPlugin(ScrollTrigger);

export const movimientoReducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

// Animaciones "en reposo" que aceleran cuando se scrollea.
const reposo: gsap.core.Animation[] = [];

function revelar() {
  const items = $$('[data-revelar]');
  if (!items.length) return;
  gsap.set(items, { autoAlpha: 0, y: 28 });
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (lote) => gsap.to(lote, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });
}

function hero() {
  const textos = $$('[data-hero]');
  if (textos.length) gsap.from(textos, { autoAlpha: 0, y: 20, duration: 0.7, ease: 'power3.out', stagger: 0.08 });
  const escena = $('[data-escena]');
  if (!escena) return;
  const tel = $('.telefono', escena);
  if (tel) gsap.from(tel, { y: 60, autoAlpha: 0, duration: 0.9, ease: 'power3.out', delay: 0.15 });
  const handys = $$(':scope > .handy, :scope > .cano-gota', escena);
  gsap.from(handys, { scale: 0.3, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.8)', stagger: 0.12, delay: 0.35 });

  // Parallax: cada Handy se va a distinta velocidad al scrollear el hero.
  const velocidades: Record<string, number> = { cano: -40, lamparita: -110, engranaje: -70, llave: -150 };
  handys.forEach((h) => {
    const clave = Object.keys(velocidades).find((k) => h.className.includes(`escena__${k}`));
    if (!clave) return;
    gsap.to(h, {
      y: velocidades[clave],
      ease: 'none',
      scrollTrigger: { trigger: escena, start: 'top top+=80', end: 'bottom top', scrub: 0.6 },
    });
  });
}

function goteo(gota: HTMLElement) {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9, delay: 1 });
  tl.set(gota, { yPercent: -70, scale: 0.25, autoAlpha: 0, transformOrigin: '50% 0%' })
    .to(gota, { autoAlpha: 1, scale: 1, yPercent: 0, duration: 0.9, ease: 'back.out(1.6)' })
    .to(gota, { scaleY: 1.08, scaleX: 0.94, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' })
    .to(gota, { yPercent: 160, autoAlpha: 0, duration: 0.65, ease: 'power2.in' });
  reposo.push(tl);
}

function enReposo() {
  $$('[data-handy="gota"]').forEach(goteo);
  $$('[data-handy="lamparita"], [data-handy="lamparita-faq"]').forEach((el, i) => {
    reposo.push(
      gsap.to(el, { yPercent: -5, rotation: 4, duration: 1.6 + i * 0.2, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 100%' }),
    );
  });
  $$('[data-handy="llave"]').forEach((el) => {
    gsap.set(el, { rotation: -6, transformOrigin: '60% 90%' });
    reposo.push(gsap.to(el, { rotation: 6, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  });
  $$('[data-handy="engranaje"], [data-handy="engranaje-banda"]').forEach((el) => {
    reposo.push(gsap.to(el, { rotation: '+=360', duration: 14, ease: 'none', repeat: -1 }));
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
  // Engranaje que rueda por el costado de los pasos de "Cómo funciona".
  const carril = $('.pasos-carril');
  const rueda = $('[data-handy="engranaje-carril"]');
  if (carril && rueda) {
    gsap.fromTo(
      rueda,
      { y: 0, rotation: 0 },
      {
        y: () => Math.max(0, carril.offsetHeight - rueda.offsetHeight),
        rotation: 720,
        ease: 'none',
        scrollTrigger: { trigger: carril, start: 'top 60%', end: 'bottom 70%', scrub: 0.5, invalidateOnRefresh: true },
      },
    );
  }

  // La llave se asoma cuando aparece "Confianza".
  const llave = $('[data-handy="llave-confianza"]');
  if (llave) {
    gsap.fromTo(
      llave,
      { xPercent: 60, rotation: 30, autoAlpha: 0 },
      { xPercent: 0, rotation: -8, autoAlpha: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: llave, start: 'top 95%', end: 'top 55%', scrub: 0.8 } },
    );
  }

  // Los Handys de las bandas finales saltan al entrar.
  $$('[data-handy="grupo-final"]').forEach((g) => {
    gsap.from(g, {
      yPercent: 30,
      scale: 0.85,
      autoAlpha: 0,
      ease: 'back.out(1.7)',
      duration: 0.9,
      scrollTrigger: { trigger: g, start: 'top 90%', once: true },
    });
  });

  // Caño de la camada fundadora.
  $$('.camada__handy').forEach((c) => {
    gsap.from(c, { xPercent: 40, rotation: 12, autoAlpha: 0, duration: 1, ease: 'back.out(1.5)', scrollTrigger: { trigger: c, start: 'top 90%', once: true } });
  });
}

/** Lamparita de las preguntas: se prende cuando abrís una. */
function preguntas() {
  $$('.faq').forEach((faq) => {
    const lamp = $('.faq__lamparita', faq);
    if (!lamp) return;
    const items = $$<HTMLDetailsElement>('details', faq);
    const actualizar = (saltar: boolean) => {
      const prendida = items.some((d) => d.open);
      lamp.classList.toggle('faq__lamparita--prendida', prendida);
      if (saltar && prendida && !movimientoReducido()) {
        gsap.fromTo(lamp, { y: 0 }, { y: -18, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 });
      }
    };
    items.forEach((d) => d.addEventListener('toggle', () => actualizar(d.open)));
  });
}

export function iniciarAnimaciones() {
  preguntas();
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
    gsap.fromTo(
      handys,
      { y: 40, scale: 0.8, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)' },
    );
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
