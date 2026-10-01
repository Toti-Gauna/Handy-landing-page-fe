import { iniciarComun } from './comun';
import { gsap, ScrollTrigger, movimientoReducido } from './animaciones';

iniciarComun();

// El "Recibís" del ejemplo cuenta hasta el monto cuando aparece en pantalla.
const total = document.querySelector<HTMLElement>('[data-contar]');
if (total && !movimientoReducido()) {
  const destino = Number(total.dataset.contar);
  const final = total.textContent;
  const formato = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const valor = { n: 0 };
  ScrollTrigger.create({
    trigger: total,
    start: 'top 85%',
    once: true,
    onEnter: () =>
      gsap.to(valor, {
        n: destino,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => (total.textContent = formato.format(Math.round(valor.n)).replace(/ /g, ' ')),
        onComplete: () => (total.textContent = final),
      }),
  });
}
