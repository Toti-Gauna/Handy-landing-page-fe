// Pantalla de carga con los Handys. La activa un script en <head> (clase .con-intro en <html>)
// solo la primera vez de la sesión y sin "reducir movimiento". Acá se anima y se va cuando
// terminó la secuencia y cargaron las fuentes y las imágenes principales.

import { gsap } from 'gsap';

const html = document.documentElement;
const FIN = 'handy:intro-fin';

export const introActiva = () => html.classList.contains('con-intro');

/** Ejecuta fn cuando termina la intro (o enseguida si no hay intro). */
export function despuesDeIntro(fn: () => void) {
  if (introActiva()) window.addEventListener(FIN, fn, { once: true });
  else fn();
}

function terminar(raiz: HTMLElement | null) {
  try {
    sessionStorage.setItem('handy-intro', '1');
  } catch {
    // Sin sessionStorage la intro vuelve a aparecer en la próxima página: no pasa nada.
  }
  html.classList.remove('con-intro');
  raiz?.remove();
  window.dispatchEvent(new Event(FIN));
}

/** Progreso real: fuentes + imágenes que se cargan de entrada. */
function progresoDeCarga(alCambiar: (p: number) => void) {
  const imgs = [...document.images].filter((i) => i.loading !== 'lazy');
  const total = imgs.length + 1;
  let listos = 0;
  const sumar = () => alCambiar(++listos / total);
  imgs.forEach((img) => {
    if (img.complete) sumar();
    else {
      img.addEventListener('load', sumar, { once: true });
      img.addEventListener('error', sumar, { once: true });
    }
  });
  document.fonts?.ready.then(sumar) ?? sumar();
}

export function iniciarIntro() {
  const raiz = document.querySelector<HTMLElement>('[data-intro]');
  if (!raiz || !introActiva()) {
    raiz?.remove();
    return;
  }

  const $ = (sel: string) => raiz.querySelector<HTMLElement>(sel)!;
  const cano = $('.intro__cano');
  const gota = $('.intro__gota');
  const charco = $('.intro__charco');
  const gotitas = [...raiz.querySelectorAll<HTMLElement>('.intro__salpicadura i')];
  const marca = $('.intro__marca');
  const letras = [...raiz.querySelectorAll<HTMLElement>('.intro__bajada span')];
  const engranaje = $('.intro__engranaje');
  const lamparita = $('.intro__lamparita');
  const luz = $('.intro__luz');
  const llave = $('.intro__llave');
  const barra = $('[data-intro-barra]');
  const numero = $('[data-intro-numero]');

  // Progreso mostrado: avanza suave hacia el real, nunca hacia atrás.
  const mostrado = { v: 0 };
  let real = 0;
  const pintar = () => {
    barra.style.transform = `scaleX(${mostrado.v})`;
    numero.textContent = String(Math.round(mostrado.v * 100));
  };
  progresoDeCarga((p) => {
    real = Math.max(real, p);
    gsap.to(mostrado, { v: real, duration: 0.6, ease: 'power2.out', onUpdate: pintar, overwrite: true });
  });

  let secuenciaLista = false;
  let salio = false;

  const salir = () => {
    if (salio) return;
    salio = true;
    const handys = [engranaje, lamparita, llave];
    gsap
      .timeline({ onComplete: () => terminar(raiz) })
      .to(mostrado, { v: 1, duration: 0.3, onUpdate: pintar })
      .to(handys, { y: -26, duration: 0.22, ease: 'power2.out', stagger: 0.06, yoyo: true, repeat: 1 }, '<')
      .to(raiz.querySelector('.intro__escena'), { y: -40, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, '+=0.05')
      .fromTo(
        raiz,
        { clipPath: 'inset(0% 0% 0% 0% round 0% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 100% 0% round 0% 0% 50% 50%)', duration: 0.85, ease: 'power4.inOut' },
        '-=0.25',
      );
  };

  const intentarSalir = () => {
    if (secuenciaLista && (real >= 1 || performance.now() > 4200)) salir();
  };

  // Secuencia: cae el caño, gotea, salpica y aparece el logo; llegan los Handys.
  const tl = gsap.timeline({ delay: 0.15, onComplete: () => ((secuenciaLista = true), intentarSalir()) });
  tl.fromTo(cano, { y: 0, yPercent: -160, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.6)' })
    .to(cano, { scaleY: 0.92, scaleX: 1.05, transformOrigin: '50% 0%', duration: 0.12, yoyo: true, repeat: 1 })
    .fromTo(gota, { autoAlpha: 0, scale: 0.2, transformOrigin: '50% 0%' }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' })
    .to(gota, { scaleY: 1.12, scaleX: 0.9, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' })
    .to(gota, { top: '41%', duration: 0.42, ease: 'power2.in' })
    .to(gota, { scaleY: 0.4, scaleX: 1.5, transformOrigin: '50% 100%', autoAlpha: 0, duration: 0.14, ease: 'power1.out' })
    .fromTo(charco, { autoAlpha: 0.9, scaleX: 0 }, { scaleX: 1, autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, '<')
    .add(() => {
      gotitas.forEach((g, i) => {
        const ang = -150 + i * 30;
        const r = 40 + (i % 2) * 18;
        gsap.fromTo(
          g,
          { x: 0, y: 0, autoAlpha: 1, scale: 1 },
          {
            keyframes: [
              { x: Math.cos((ang * Math.PI) / 180) * r * 0.6, y: Math.sin((ang * Math.PI) / 180) * r, duration: 0.28, ease: 'power2.out' },
              { x: Math.cos((ang * Math.PI) / 180) * r, y: 18, autoAlpha: 0, scale: 0.5, duration: 0.32, ease: 'power2.in' },
            ],
          },
        );
      });
    }, '<')
    .fromTo(marca, { clipPath: 'inset(100% 0% 0% 0%)', y: 24 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.7, ease: 'expo.out' }, '<0.05')
    .fromTo(letras, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.018, ease: 'power2.out' }, '<0.25')
    .fromTo(engranaje, { autoAlpha: 0, x: '-60vw', rotation: -900 }, { autoAlpha: 1, x: 0, rotation: 0, duration: 0.95, ease: 'power3.out' }, '<-0.2')
    .fromTo(lamparita, { autoAlpha: 0, yPercent: 120, scale: 0.6 }, { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, '<0.35')
    .fromTo(luz, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1.25, duration: 0.25, ease: 'power2.out' })
    .to(luz, { scale: 1, autoAlpha: 0.75, duration: 0.4, ease: 'power2.inOut' })
    .fromTo(llave, { autoAlpha: 0, x: '50vw', rotation: 40 }, { autoAlpha: 1, x: 0, rotation: -6, duration: 0.7, ease: 'back.out(1.4)' }, '<-0.4')
    .to(cano, { rotation: -3, duration: 0.18, yoyo: true, repeat: 1, transformOrigin: '80% 100%' }, '<0.2');

  tl.timeScale(1.2);

  // Si la carga se demora, la secuencia espera; si se completa, sale.
  const espera = window.setInterval(() => {
    intentarSalir();
    if (salio) window.clearInterval(espera);
  }, 120);
  // Límite duro: nunca más de 5 s.
  window.setTimeout(() => {
    secuenciaLista = true;
    salir();
  }, 5000);
}
