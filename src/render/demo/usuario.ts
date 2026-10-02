// Demo · lado del usuario. (Base mínima: la completa el armado de pantallas.)

import d from '../../content/demo-usuario.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc } from '../util.ts';
import { boton, cabeceraDemo, navDemo, volverDemo } from './piezas.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

const simple = (id: string, titulo: string, activo: number): PantallaDemo => ({
  id,
  titulo,
  html: `<div class="app">${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo">${volverDemo(titulo)}${boton({ raiz: 'u-inicio' }, `${icono('casa')} ${esc(titulo)}`, 'app-boton')}</div>
${navDemo('usuario', activo)}</div>`,
});

export function demoUsuario(): DemoRol {
  const t = d.pantallas;
  return {
    inicio: 'u-inicio',
    pantallas: [
      simple('u-inicio', t.inicio, 0),
      simple('u-turnos', t.turnos, 1),
      simple('u-mensajes', t.mensajes, 2),
      simple('u-cuenta', t.cuenta, 3),
      simple('u-notificaciones', t.notificaciones, -1),
    ],
    recorrido: d.recorrido,
  };
}
