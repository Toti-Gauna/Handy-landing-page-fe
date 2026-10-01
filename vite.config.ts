import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { renderizarPagina } from './src/render/index.ts';

// Nombre del repo: GitHub Pages sirve el sitio en https://<usuario>.github.io/Handy-landing-page-fe/
const BASE = '/Handy-landing-page-fe/';

const raiz = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

export default defineConfig({
  base: BASE,
  plugins: [
    {
      // Arma el HTML de cada página desde src/content/*.json (ver src/render/index.ts).
      name: 'handy-paginas',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => renderizarPagina(html, BASE),
      },
    },
  ],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        inicio: raiz('./index.html'),
        especialistas: raiz('./especialistas/index.html'),
        registro: raiz('./registro/index.html'),
        privacidad: raiz('./privacidad/index.html'),
        '404': raiz('./404.html'),
      },
    },
  },
});
