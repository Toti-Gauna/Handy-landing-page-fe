import { iniciarComun } from './comun';
// Los celulares de la landing muestran las pantallas de la demo (src/render/demo/estaticas.ts): sus estilos.
import '../styles/demo-app.css';
import '../styles/demo-usuario.css';


iniciarComun();

// En el inicio, "Cómo funciona" y "Preguntas" se marcan en el header mientras estás en esa sección.
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')].filter((a) =>
  a.getAttribute('href')?.startsWith('#'),
);
const secciones = [...document.querySelectorAll<HTMLElement>('[data-espiar]')];

if (links.length && secciones.length && 'IntersectionObserver' in window) {
  const marcar = (id: string | null) => {
    links.forEach((a) => {
      const activo = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('nav__link--activo', activo);
      if (activo) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  const visibles = new Set<string>();
  const io = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => (e.isIntersecting ? visibles.add(e.target.id) : visibles.delete(e.target.id)));
      const actual = secciones.find((s) => visibles.has(s.id));
      marcar(actual ? actual.id : null);
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  secciones.forEach((s) => io.observe(s));
}
