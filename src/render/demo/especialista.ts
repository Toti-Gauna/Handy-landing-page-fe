// Demo · lado del especialista. (Base mínima: la completa el armado de pantallas.)

import d from '../../content/demo-especialista.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc } from '../util.ts';
import { boton, cabeceraDemo, navDemo, volverDemo } from './piezas.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

const simple = (id: string, titulo: string, activo: number): PantallaDemo => ({
  id,
  titulo,
  html: `<div class="app">${cabeceraDemo('especialista', 'azul')}
<div class="app-cuerpo">${volverDemo(titulo)}${boton({ raiz: 'e-inicio' }, `${icono('casa')} ${esc(titulo)}`, 'app-boton')}</div>
${navDemo('especialista', activo)}</div>`,
});

export function demoEspecialista(): DemoRol {
  const t = d.pantallas;
  return {
    inicio: 'e-inicio',
    pantallas: [
      simple('e-inicio', t.inicio, 0),
      simple('e-turnos', t.turnos, 1),
      simple('e-mensajes', t.mensajes, 2),
      simple('e-cuenta', t.cuenta, 3),
      simple('e-notificaciones', t.notificaciones, -1),
    ],
    recorrido: d.recorrido,
  };
}
