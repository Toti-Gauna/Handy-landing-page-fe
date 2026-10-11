import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { renderizarPagina } from './src/render/index.ts';

// Por defecto, GitHub Pages: https://<usuario>.github.io/Handy-landing-page-fe/ (nombre del repo).
// Para publicar en la raíz de un dominio (Hostinger, https://handyc.com) se construye con VITE_BASE=/.
const BASE_GITHUB_PAGES = '/Handy-landing-page-fe/';

/** Base pública del sitio: empieza y termina con "/". VITE_BASE es público (nunca va un secreto). */
function resolverBase(valor: string | undefined): string {
  const v = (valor ?? '').trim();
  if (v === '') return BASE_GITHUB_PAGES;
  if (!/^\/([\w.-]+\/)*$/.test(v)) {
    throw new Error(`VITE_BASE inválida: "${v}". Usá una ruta que empiece y termine con "/", por ejemplo "/" o "/Handy-landing-page-fe/".`);
  }
  return v;
}

const raiz = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

export default defineConfig(({ mode }) => {
  // process.env (CI, línea de comandos) tiene prioridad sobre .env.local.
  const BASE = resolverBase(loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE);
  return {
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
          demo: raiz('./demo/index.html'),
          '404': raiz('./404.html'),
        },
      },
    },
  };
});
