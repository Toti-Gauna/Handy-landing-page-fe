// Comportamiento compartido por todas las páginas: header, menú, cuenta regresiva y animaciones base.

import '../styles/main.css';
import { iniciarAnimaciones } from './animaciones';
import { iniciarIntro } from './intro';

function header() {
  const h = document.querySelector<HTMLElement>('[data-header]');
  if (!h) return;
  const actualizar = () => h.classList.toggle('header--compacto', window.scrollY > 24);
  actualizar();
  window.addEventListener('scroll', actualizar, { passive: true });
}

function menu() {
  const boton = document.querySelector<HTMLButtonElement>('[data-menu]');
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  const h = document.querySelector<HTMLElement>('[data-header]');
  if (!boton || !nav || !h) return;

  const poner = (abierto: boolean) => {
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', (abierto ? boton.dataset.cerrar : boton.dataset.abrir) ?? '');
    h.classList.toggle('header--abierto', abierto);
  };

  boton.addEventListener('click', () => poner(boton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) poner(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') {
      poner(false);
      boton.focus();
    }
  });
  // Al pasar a escritorio el menú deja de ser desplegable.
  window.matchMedia('(min-width: 900px)').addEventListener('change', () => poner(false));
}

function cuentaRegresiva() {
  document.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((el) => {
    const fin = new Date(el.dataset.fecha ?? '').getTime();
    if (Number.isNaN(fin)) return;
    const nums = Object.fromEntries(
      [...el.querySelectorAll<HTMLElement>('[data-unidad]')].map((n) => [n.dataset.unidad, n]),
    );
    const dos = (n: number) => String(n).padStart(2, '0');
    let timer = 0;
    const tick = () => {
      const resto = fin - Date.now();
      if (resto <= 0) {
        el.querySelector<HTMLElement>('[data-cuenta-grilla]')?.setAttribute('hidden', '');
        el.querySelector<HTMLElement>('[data-cuenta-lanzado]')?.removeAttribute('hidden');
        el.classList.add('cuenta--lanzado');
        window.clearInterval(timer);
        return;
      }
      const s = Math.floor(resto / 1000);
      const valores: Record<string, string> = {
        dias: String(Math.floor(s / 86400)),
        horas: dos(Math.floor((s % 86400) / 3600)),
        minutos: dos(Math.floor((s % 3600) / 60)),
        segundos: dos(s % 60),
      };
      for (const [k, v] of Object.entries(valores)) {
        const n = nums[k];
        if (n && n.textContent !== v) n.textContent = v;
      }
    };
    tick();
    timer = window.setInterval(tick, 1000);
  });
}

export function iniciarComun() {
  iniciarIntro();
  header();
  menu();
  cuentaRegresiva();
  iniciarAnimaciones();
}
