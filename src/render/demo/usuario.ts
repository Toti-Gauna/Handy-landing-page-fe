// Demo · lado del usuario. Pantallas navegables de la app (se arman en build, como el resto del sitio).
//
// Lo que cambia según lo que se elige (rubro, día, franja, presupuesto…) se marca con atributos que
// completa src/scripts/demo/usuario.ts en el navegador:
//   data-du-tpl="{esp} va para tu casa"  → texto con variables (se vuelve a armar con cada cambio)
//   data-du-icono="rubro"                → ícono del rubro elegido
//   data-du-ver="cond" / "!cond"         → visible solo si se cumple la condición
//   data-du-habilitar="cond"             → botón habilitado solo si se cumple
//   data-du-grupo="dia"                  → opción de un grupo (aria-pressed o clase du-sel)
// El HTML sale con el estado inicial (demo-usuario.json → inicial), así que sin JS se ve igual.

import d from '../../content/demo-usuario.json' with { type: 'json' };
import demo from '../../content/demo.json' with { type: 'json' };
import rubrosJson from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, formatoPesos, variables } from '../util.ts';
import { fotoCano, inputChat, mapa, pin } from '../pantallas.ts';
import { boton, cabeceraDemo, navDemo, tituloHoja, volverDemo, type Toque } from './piezas.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

// ── Datos y estado inicial ────────────────────────────────────────────────

const RUBROS = new Map(rubrosJson.rubros.map((r) => [r.id, r]));
const rubro = (id: string) => {
  const r = RUBROS.get(id);
  if (!r) throw new Error(`Demo usuario: rubro inexistente "${id}"`);
  return r;
};

const ini = d.inicial;
const dias = d.programar.dias;
const franjas = d.programar.franjas;
const items = d.presupuestos.items;
const pasados = d.turnos.pasados;
const f = d.formatos;

const tarifaDe = (p: number) => Math.round((p * tarifas.normal.cliente) / 100);
const totalDe = (p: number) => p + tarifaDe(p);
const precioDe = (i: number) => {
  const it = items[i];
  return 'precio' in it && typeof it.precio === 'number' ? it.precio : tarifas.ejemplo.presupuesto;
};

/** Reemplaza {clave} con los valores dados; las variables globales ({tarifaCliente}…) también valen. */
function completar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k in vars) return vars[k];
    if (k in variables) return variables[k];
    throw new Error(`Demo usuario: variable sin definir ${m} (en "${texto}")`);
  });
}

/** Igual que en el navegador: valores de los textos dinámicos para el estado inicial. */
function valoresIniciales(): Record<string, string> {
  const r = rubro(ini.rubro);
  const dia = dias[ini.dia];
  const sig = dias[Math.min(ini.dia + 1, dias.length - 1)];
  const it = items[ini.presupuesto];
  const p = precioDe(ini.presupuesto);
  const v: Record<string, string> = {
    rubro: r.nombre,
    tipo: d.opciones.items[ini.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    diaSiguiente: sig.corto,
    fecha: dia.fecha,
    franja: franjas[ini.franja],
    esp: it.nombre,
    zona: it.zona,
    declaro: it.declaro,
    otro: it.otros.find((o) => o !== r.nombre) ?? '',
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaDe(p)),
    total: formatoPesos(totalDe(p)),
    problema: d.problemas[ini.rubro as keyof typeof d.problemas],
    estado: d.turnos.estados.confirmado,
  };
  v.cuando = completar(f.cuando, v);
  v.horarioEsp = completar(it.horario, v);
  items.forEach((x, i) => (v[`horario${i}`] = completar(x.horario, v)));
  // Turno que se ve en "Tu turno" (al principio, el del recorrido).
  Object.assign(v, {
    tRubro: v.rubro,
    tTipo: v.tipo,
    tDia: v.dia,
    tFecha: v.fecha,
    tFranja: v.franja,
    tEsp: v.esp,
    tPrecio: v.precio,
    tTarifa: v.tarifa,
    tTotal: v.total,
    tEstado: v.estado,
    cambio: completar(f.cuando, { diaCorto: dias[Math.min(ini.dia + 1, dias.length - 1)].corto, franja: v.franja }),
  });
  return v;
}

const V = valoresIniciales();
const rellenar = (texto: string) => completar(texto, V);
/** Deja resueltas solo las variables globales; las de la demo las completa el navegador. */
const soloGlobales = (texto: string) => texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in variables ? variables[k] : m));

/** Texto (del JSON) que puede cambiar en el navegador. */
function tpl(texto: string, tag = 'span', clase = ''): string {
  const c = clase ? ` class="${clase}"` : '';
  if (!/\{\w+\}/.test(soloGlobales(texto))) return `<${tag}${c}>${esc(rellenar(texto))}</${tag}>`;
  return `<${tag}${c} data-du-tpl="${esc(soloGlobales(texto))}">${esc(rellenar(texto))}</${tag}>`;
}

const iconoRubro = (clave = 'rubro', id = ini.rubro, clase = 'du-ico') =>
  `<span class="${clase}" data-du-icono="${clave}">${icono(rubro(id).icono)}</span>`;

/** Atributo de visibilidad + hidden si arranca oculto. */
const ver = (cond: string, visible: boolean) => `data-du-ver="${cond}"${visible ? '' : ' hidden'}`;

const img = (nombre: string, w: number, h: number, clase = '') =>
  `<img${clase ? ` class="${clase}"` : ''} src="/src/img/${nombre}.webp" alt="" width="${w}" height="${h}" decoding="async" />`;
const lamparita = (clase = '') => img('handy-lamparita', 202, 346, clase);

const ESTRELLA =
  '<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/></svg>';

const T = d.titulos;
const app = (contenido: string, clase = '') => `<div class="app${clase ? ' ' + clase : ''}">${contenido}</div>`;
const pantalla = (id: keyof typeof T, html: string, tipo: 'pantalla' | 'hoja' = 'pantalla'): PantallaDemo => ({
  id,
  titulo: T[id],
  tipo,
  html,
});

const label = (texto: string) => `<p class="du-label">${esc(texto)}</p>`;
const fila = (izq: string, der: string, clase = '') => `<div class="du-costo__fila${clase ? ' ' + clase : ''}"><span>${izq}</span><span>${der}</span></div>`;

// ── Piezas propias ─────────────────────────────────────────────────────────

/** Ficha azul (como "Specialist"/"Date" en la pantalla de confirmar). */
const ficha = (clase: string, ...lineas: string[]) => `<div class="du-ficha du-ficha--${clase}">${lineas.join('')}</div>`;

const direccion = () => {
  const x = d.describir;
  return `<div class="du-lugar">${icono('casa')}<span><strong>${esc(x.casa)}</strong><small>${esc(x.calle)}</small></span>${icono('derecha')}</div>`;
};

/** Burbuja del chat (el texto puede llevar variables de la demo). */
const burbuja = (m: { de: string; texto: string; foto?: boolean }) =>
  `<div class="app-burbuja ${m.de === 'vos' ? 'app-burbuja--propia' : 'app-burbuja--otra'}${m.foto ? ' app-burbuja--foto' : ''}">${m.foto ? fotoCano : ''}${tpl(m.texto)}</div>`;

function chat(opciones: {
  id: 'u-chat' | 'u-handia' | 'u-soporte';
  cabecera: string;
  bienvenida?: string;
  inicial: { de: string; texto: string; foto?: boolean }[];
  etapas: { rapidas: { texto: string }[] }[];
  final?: string;
  input: string;
}): string {
  const { id, etapas } = opciones;
  const rapidas = etapas
    .map(
      (e, n) =>
        `<div class="du-rapidas" ${ver(`chat:${id}:${n}`, n === 0)}>${e.rapidas
          .map((r, i) => boton({ accion: 'chat', valor: `${id}:${n}:${i}`, guia: i === 0 }, esc(r.texto), 'app-accion du-rapida'))
          .join('')}</div>`,
    )
    .join('');
  const final = opciones.final ? `<div class="du-rapidas du-rapidas--final" ${ver(`final:${id}`, false)}>${opciones.final}</div>` : '';
  return `<div class="app-chat du-chat" data-du-chat="${id}">
  ${opciones.cabecera}
  <div class="app-chat__mensajes" data-du-mensajes>${opciones.bienvenida ?? ''}${opciones.inicial.map(burbuja).join('')}</div>
  ${rapidas}${final}
  ${inputChat(opciones.input)}
  <template data-du-foto>${fotoCano}</template>
</div>`;
}

const chatCabecera = (cerrar: 'flecha' | 'x', nombre: string, sub: string, avatar: string) =>
  `<div class="app-chat__cabecera">${
    cerrar === 'x'
      ? boton({ volver: true, etiqueta: demo.ui.cerrar }, icono('cerrar'), 'app-x du-x-chat')
      : boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-volver__flecha')
  }<span class="app-chat__nombre">${tpl(nombre, 'strong')}${tpl(sub, 'small')}</span>${avatar}</div>`;

/** Tarjeta blanca con franja gris partida en dos botones. */
const tarjetaDoble = (cuerpo: string, izq: [Toque, string], der: [Toque, string]) =>
  `<div class="app-tarjeta"><div class="app-tarjeta__cuerpo">${cuerpo}</div><div class="du-franja-doble">${boton(izq[0], esc(izq[1]), 'app-tarjeta__franja')}${boton(der[0], esc(der[1]), 'app-tarjeta__franja du-franja--azul')}</div></div>`;

const hojaAzul = (titulo: string, contenido: string) =>
  `<div class="app-hoja app-hoja--llena"><span class="app-hoja__manija"></span><p class="app-hoja__titulo">${esc(titulo)}</p>${contenido}</div>`;

// ── Pantallas ─────────────────────────────────────────────────────────────

function inicio(): PantallaDemo {
  const a = d.inicio;
  const rubros = rubrosJson.rubros
    .map((r) =>
      boton(
        { accion: 'rubro', valor: r.id, ir: 'u-opciones', guia: r.id === ini.rubro },
        `${icono(r.icono)}<span>${esc(r.corto ?? r.nombre)}</span>`,
        'app-mosaico',
      ),
    )
    .join('');
  const tareas = a.tareas
    .map((t, i) => boton({ accion: 'tarea', valor: String(i), ir: 'u-opciones' }, `${icono(t.icono)}<span>${esc(t.texto)}</span>`, 'app-mosaico'))
    .join('');
  return pantalla(
    'u-inicio',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-inicio">
  <p class="app-titulo">${esc(a.titulo)}</p>
  <div class="app-grilla">${rubros}</div>
  ${boton(
    { ir: 'u-handia' },
    `<span class="du-handia__ia">${lamparita()}</span><span class="du-handia__textos"><small>${esc(a.handia.titulo)}</small><strong>${esc(a.handia.texto)}</strong></span>${icono('flecha')}`,
    'du-handia',
  )}
  <p class="app-titulo app-titulo--chico">${esc(a.quieroTitulo)}</p>
  <div class="app-grilla du-tareas">${tareas}</div>
  ${boton({ ir: 'u-urgencia', etiqueta: a.urgencia }, icono('alerta'), 'app-urgencia')}
</div>
${navDemo('usuario', 0)}`),
  );
}

function urgencia(): PantallaDemo {
  const u = d.urgencia;
  const rubros = rubrosJson.rubros
    .map((r) => boton({ accion: 'urgencia', valor: r.id, ir: 'u-describir' }, `${icono(r.icono)}<span>${esc(r.corto ?? r.nombre)}</span>`, 'app-mosaico du-mini'))
    .join('');
  return pantalla(
    'u-urgencia',
    `${tituloHoja(u.titulo)}
<p class="du-hoja-sub">${icono('alerta')}${esc(u.texto)}</p>
<div class="app-grilla du-urgencia">${rubros}</div>
<p class="app-sheet__nota">${esc(u.nota)}</p>`,
    'hoja',
  );
}

function opciones(): PantallaDemo {
  const o = d.opciones;
  const items = o.items
    .map((it, i) =>
      boton(
        {
          accion: 'tipo',
          valor: String(i),
          ir: i === 0 ? 'u-describir' : 'u-programar',
          guia: i === ini.tipo,
          extra: `data-du-grupo="tipo" aria-pressed="${i === ini.tipo}"`,
        },
        `${icono(it.icono)}<span><strong>${esc(it.texto)}</strong><small>${esc(it.detalle)}</small></span>${icono('derecha')}`,
        'app-opcion du-opcion',
      ),
    )
    .join('');
  return pantalla(
    'u-opciones',
    `${tituloHoja(o.titulo)}
<p class="du-hoja-sub">${esc(o.para)} ${iconoRubro()}${tpl('{rubro}', 'strong')}</p>
${items}`,
    'hoja',
  );
}

function programar(): PantallaDemo {
  const g = d.programar;
  // La guía toca el día siguiente al inicial: se ve cómo gira la rueda.
  const guiaDia = Math.min(ini.dia + 1, dias.length - 1);
  const ruedaDias = dias
    .map((x, i) =>
      boton(
        { accion: 'dia', valor: String(i), guia: i === guiaDia, extra: `data-du-grupo="dia" aria-pressed="${i === ini.dia}"` },
        esc(x.rueda),
        'du-rueda__op',
      ),
    )
    .join('');
  const ruedaFranjas = franjas
    .map((x, i) =>
      boton({ accion: 'franja', valor: String(i), extra: `data-du-grupo="franja" aria-pressed="${i === ini.franja}"` }, esc(x), 'du-rueda__op'),
    )
    .join('');
  const pastilla = (titulo: string, valor: string) => `<span class="du-pastilla"><small>${esc(titulo)}</small>${valor}</span>`;
  return pantalla(
    'u-programar',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
<div class="app-cuerpo du-programar">
  ${volverDemo(g.titulo)}
  <p class="app-subtitulo">${iconoRubro()}${tpl(f.rubroTipo)}</p>
  <div class="du-rueda">
    <div class="du-rueda__col" role="group" aria-label="${esc(g.ruedaAria)}"><div class="du-rueda__lista" data-du-rueda="dia" style="--du-i: ${ini.dia}">${ruedaDias}</div></div>
    <div class="du-rueda__col du-rueda__col--franja" role="group" aria-label="${esc(g.franjasAria)}"><div class="du-rueda__lista" data-du-rueda="franja" style="--du-i: ${ini.franja}">${ruedaFranjas}</div></div>
  </div>
  <p class="du-info">${icono('calendario')}<span>${esc(g.info)}</span></p>
  <div class="du-pastillas">
    ${pastilla(g.dia, tpl('{dia}', 'strong'))}
    ${pastilla(g.franja, tpl('{franja}', 'strong'))}
    ${pastilla(g.mes, `<strong>${esc(g.mesValor)}</strong>`)}
    ${pastilla(g.anio, `<strong>${esc(g.anioValor)}</strong>`)}
  </div>
  ${boton({ ir: 'u-describir', guia: true }, esc(g.siguiente), 'app-boton du-abajo')}
</div>`),
  );
}

function describir(): PantallaDemo {
  const x = d.describir;
  return pantalla(
    'u-describir',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
<div class="app-cuerpo du-describir">
  ${volverDemo(x.titulo)}
  <div class="du-grilla2">
    ${ficha('azul', `<small>${esc(x.rubro)}</small>`, `<strong>${iconoRubro()}${tpl('{rubro}')}</strong>`, tpl('{tipo}'))}
    ${ficha('clara', `<small>${esc(x.cuando)}</small>`, tpl('{dia}', 'strong'), tpl('{franja}'))}
  </div>
  ${label(x.pedido)}
  <div class="du-campo">${tpl('{problema}', 'p')}<small>${esc(x.ayuda)}</small></div>
  ${label(x.fotos)}
  <div class="du-fotos">
    <span class="du-foto" ${ver('foto1', false)}>${fotoCano}</span>
    <span class="du-foto du-foto--2" ${ver('foto2', false)}>${fotoCano}</span>
    ${boton({ accion: 'foto', guia: true, extra: ver('puedeFoto', true) }, `${icono('camara')}<span>${esc(x.agregarFoto)}</span>`, 'du-foto du-foto--agregar')}
  </div>
  ${label(x.direccion)}
  ${direccion()}
  <div class="du-abajo">
    ${boton({ accion: 'pedir', ir: 'u-buscando', guia: true }, esc(x.pedir), 'app-boton')}
    <p class="du-nota">${esc(x.nota)}</p>
  </div>
</div>`),
  );
}

function buscando(): PantallaDemo {
  const b = d.buscando;
  return pantalla(
    'u-buscando',
    app(`${cabeceraDemo('usuario', 'azul', false)}
<div class="app-mapa-caja du-busqueda">${mapa(false)}<span class="du-radar" aria-hidden="true"><i></i><i></i></span>${pin('app-pin--rojo')}
  ${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-flotante')}
</div>
<div class="app-panel du-panel">
  <span class="app-hoja__manija du-manija"></span>
  <p class="app-panel__titulo">${esc(b.titulo)}</p>
  <div class="app-progreso"><span class="hecho actual">${icono('usuario')}</span><span></span><span></span></div>
  <p class="du-busqueda__estado" aria-live="polite">${b.estados.map((e, i) => `<span ${ver(`busc${i}`, i === 0)}>${esc(e)}</span>`).join('')}</p>
  <div class="du-avatares">${items
    .map((_, i) => `<span class="app-avatar app-avatar--chico" ${ver(`llego${i + 1}`, false)}>${icono('usuario')}</span>`)
    .join('')}</div>
  <p class="du-pedido-chip">${iconoRubro()}${tpl(f.pedido)}</p>
  <p class="du-nota du-nota--clara">${esc(b.nota)}</p>
  ${boton(
    { ir: 'u-presupuestos', guia: true, extra: 'data-du-habilitar="buscListo" disabled' },
    esc(b.ver),
    'app-boton du-boton-blanco',
  )}
</div>`),
  );
}

function presupuestos(): PantallaDemo {
  const q = d.presupuestos;
  const tarjetas = items
    .map((it, i) =>
      tarjetaDoble(
        `<span class="app-avatar">${icono('usuario')}</span>
        <span class="app-tarjeta__datos"><strong>${esc(it.nombre)}</strong><small class="app-verificado">${icono('verificado')}${esc(d.comun.verificado)}</small><small class="du-oferta__dato">${icono('reloj')}${tpl(`{horario${i}}`)}</small><small class="du-oferta__dato">${icono('pin')}${esc(it.zona)}</small></span>
        <span class="app-tarjeta__monto${i === ini.presupuesto ? ' du-sel' : ''}" data-du-grupo="pres" data-valor="${i}">${esc(formatoPesos(precioDe(i)))}</span>`,
        [{ accion: 'presupuesto', valor: String(i), ir: 'u-perfil', guia: i === ini.presupuesto }, q.verPerfil],
        [{ accion: 'presupuesto', valor: String(i), ir: 'u-confirmar' }, q.elegir],
      ),
    )
    .join('');
  return pantalla(
    'u-presupuestos',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${volverDemo(q.titulo)}<p class="app-subtitulo">${iconoRubro()}${tpl(f.pedido)}</p></div>
${hojaAzul(q.panel, `<div class="app-lista du-scroll">${tarjetas}</div><p class="app-hoja__nota">${esc(q.nota)}</p>`)}`),
  );
}

function perfil(): PantallaDemo {
  const x = d.perfil;
  const dato = (ic: string, titulo: string, valor: string) =>
    `<div class="du-dato-fila">${icono(ic)}<span><small>${esc(titulo)}</small>${valor}</span></div>`;
  return pantalla(
    'u-perfil',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
<div class="app-cuerpo du-perfil-pantalla">
  ${volverDemo(x.titulo)}
  <div class="du-perfil">
    <span class="du-perfil__avatar">${icono('usuario')}<span class="du-perfil__sello">${icono('verificado')}</span></span>
    ${tpl('{esp}', 'p', 'du-perfil__nombre')}
    <p class="app-verificado du-perfil__verificado">${icono('verificado')}${esc(x.verificado)}</p>
  </div>
  ${label(x.rubros)}
  <div class="du-chips"><span class="du-chip du-chip--azul">${iconoRubro()}${tpl('{rubro}')}</span><span class="du-chip" ${ver('hayOtro', V.otro !== '')}>${tpl('{otro}')}</span></div>
  ${dato('pin', x.zona, tpl('{zona}', 'strong'))}
  ${dato('reloj', x.horario, tpl('{declaro}', 'strong'))}
  <div class="du-precio"><small>${esc(x.presupuesto)}</small>${tpl('{precio}', 'strong')}${tpl(x.propone)}</div>
  <div class="du-abajo">
    <p class="du-nota">${esc(x.nota)}</p>
    ${boton({ ir: 'u-confirmar', guia: true }, esc(x.elegir), 'app-boton')}
  </div>
</div>`),
  );
}

function confirmar(): PantallaDemo {
  const c = d.confirmar;
  const pagos = c.pagos
    .map((p, i) =>
      boton(
        { accion: 'pago', valor: String(i), extra: `data-du-grupo="pago" aria-pressed="${i === ini.pago}"` },
        `<span>${esc(p.texto)}</span>${icono(p.icono)}`,
        'du-pago',
      ),
    )
    .join('');
  return pantalla(
    'u-confirmar',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
<div class="app-cuerpo du-confirmar">
  ${volverDemo(c.titulo)}
  <div class="du-grilla2 du-grilla2--ancha">
    <div>${label(c.especialista)}${ficha('azul', tpl('{esp}', 'strong'), `<span>${iconoRubro()}${tpl(f.rubroTipo)}</span>`)}</div>
    <div>${label(c.fecha)}${ficha('clara', tpl('{dia}', 'strong'), tpl('{fecha}'), tpl('{franja}'))}</div>
  </div>
  ${label(c.direccion)}
  ${direccion()}
  ${label(c.costo)}
  <div class="du-costo">
    ${fila(tpl(c.presupuestoDe), tpl('{precio}'))}
    ${fila(tpl(c.tarifa), tpl('{tarifa}'))}
    ${fila(esc(c.total), tpl('{total}'), 'du-costo__total')}
  </div>
  <p class="du-nota du-nota--izq">${icono('billetera')}<span>${esc(c.nota)}</span></p>
  ${label(c.pagoTitulo)}
  <div class="du-pagos-opciones">${pagos}</div>
  <div class="du-abajo du-botones">
    ${boton({ accion: 'confirmar', ir: 'u-seguimiento', guia: true }, esc(c.confirmar), 'app-boton du-boton-verde')}
    ${boton({ raiz: 'u-inicio' }, esc(c.cancelar), 'app-boton du-boton-rojo')}
  </div>
</div>`),
  );
}

function seguimiento(): PantallaDemo {
  const s = d.seguimiento;
  return pantalla(
    'u-seguimiento',
    app(
      `${cabeceraDemo('usuario', 'azul', false)}
<div class="app-mapa-caja du-seg-mapa">${mapa()}${pin('app-pin--a')}${pin('app-pin--b du-pin-esp')}
  ${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-flotante')}
</div>
<div class="app-panel du-panel">
  <span class="app-hoja__manija du-manija"></span>
  ${boton(
    { accion: 'seg-avanzar', etiqueta: s.avanzar },
    `<span class="app-panel__titulo du-seg-titulo" aria-live="polite">${s.estados.map((e, i) => tpl(e, 'span', '').replace('<span', `<span ${ver(`seg${i}`, i === 0)}`)).join('')}</span>
    <span class="app-progreso du-progreso"><span class="du-tramo du-tramo--1">${icono('check')}</span><span class="du-tramo du-tramo--2">${icono('caminar')}</span><span class="du-tramo du-tramo--3">${icono('casa')}</span></span>`,
    'du-seg-avanzar',
  )}
  <div ${ver('!segLlego', true)} class="du-seg-horario">
    <p class="app-panel__label">${esc(s.horarioLabel)}</p>
    <div class="app-panel__fila">${tpl('{franja}', 'span', 'app-horario')}${boton(
      { accion: 'turno', valor: '0', ir: 'u-turno-detalle', etiqueta: s.infoAria },
      icono('info'),
      'app-redondo',
    )}${boton({ accion: 'desde', valor: 'seg', ir: 'u-cancelar', etiqueta: s.cancelarAria }, icono('prohibido'), 'app-redondo app-redondo--rojo')}</div>
  </div>
  <div class="du-llegada" ${ver('segLlego', false)}>
    ${boton({ accion: 'llegada', guia: true }, `${icono('check')}<span>${esc(s.llegada)}</span>`, 'app-boton du-boton-amarillo')}
    <small>${esc(s.llegadaNota)}</small>
  </div>
  <div class="app-panel__pie"><span class="app-avatar app-avatar--chico">${icono('usuario')}</span><span><small>${esc(s.especialistaLabel)}</small>${tpl(s.especialista, 'strong')}</span>${boton(
    { ir: 'u-chat', etiqueta: s.chatAria, extra: 'data-du-chat-boton' },
    icono('chat'),
    'app-cuadrado app-cuadrado--claro',
  )}</div>
</div>`,
      'du-seguimiento',
    ).replace('class="app du-seguimiento"', 'class="app du-seguimiento" data-du-seg="0"'),
  );
}

function chatEspecialista(): PantallaDemo {
  const c = d.chat;
  return pantalla(
    'u-chat',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
${chat({
  id: 'u-chat',
  cabecera: chatCabecera('flecha', '{esp}', c.subtitulo, `<span class="app-chat__avatar app-chat__avatar--icono">${icono('usuario')}</span>`),
  bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__icono">${icono('escudo')}</span>${tpl('{esp}', 'strong')}<small>${esc(c.bienvenida)}</small></div>`,
  inicial: c.inicial,
  etapas: c.etapas,
  final: boton({ accion: 'terminar', ir: 'u-terminado', guia: true }, `${icono('check')}${esc(c.terminar)}`, 'app-accion app-accion--principal du-rapida'),
  input: c.input,
})}`),
  );
}

function terminado(): PantallaDemo {
  const t = d.terminado;
  return pantalla(
    'u-terminado',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo app-cuerpo--centro du-terminado">
  <p class="app-titulo app-titulo--negro">${esc(t.titulo)}</p>
  ${img('handys-grupo', 600, 311, 'du-terminado__handys')}
  <div class="du-esp-fila du-esp-fila--blanca"><span class="app-avatar">${icono('usuario')}</span><span class="du-esp-fila__datos">${tpl('{esp}', 'strong')}<small class="app-verificado">${icono('verificado')}${esc(d.comun.verificado)}</small></span><span class="du-esp-fila__der"><strong>${iconoRubro()}${tpl('{rubro}')}</strong>${tpl('{cuando}', 'small')}</span></div>
  <p class="app-ganaste"><span ${ver('pagoAhora', ini.pago === 0)}>${esc(t.pagaste)}</span><span ${ver('pagoDespues', ini.pago === 1)}>${esc(t.aPagar)}</span> ${tpl('{total}', 'strong')}</p>
  <div class="du-costo du-costo--claro">
    ${fila(tpl(t.alEspecialista), tpl('{precio}'))}
    ${fila(esc(t.tarifa), tpl('{tarifa}'))}
    ${fila(esc(t.total), tpl('{total}'), 'du-costo__total')}
  </div>
  <p class="app-nota-fin">${esc(t.nota)}</p>
  <div class="du-botones">
    ${boton({ ir: 'u-resena', guia: true }, tpl(t.calificar), 'app-boton')}
    ${boton({ raiz: 'u-inicio' }, esc(t.inicio), 'app-boton app-boton--contorno')}
  </div>
</div>`),
  );
}

function resena(): PantallaDemo {
  const r = d.resena;
  const estrellas = [1, 2, 3, 4, 5]
    .map((n) =>
      boton(
        {
          accion: 'estrellas',
          valor: String(n),
          guia: n === 5,
          etiqueta: completar(n === 1 ? r.estrella : r.estrellas, { n: String(n) }),
          extra: 'data-du-grupo="estrellas" aria-pressed="false"',
        },
        ESTRELLA,
        'du-estrella',
      ),
    )
    .join('');
  const chips = (lista: string[]) =>
    `<div class="du-chips du-chips--centro">${lista.map((c) => boton({ accion: 'chip', extra: 'aria-pressed="false"' }, esc(c), 'du-chip du-chip--boton')).join('')}</div>`;
  return pantalla(
    'u-resena',
    `${tituloHoja(r.titulo)}
<div class="du-resena" ${ver('!resEnviada', true)}>
  <span class="du-perfil__avatar du-perfil__avatar--chico">${icono('usuario')}</span>
  ${tpl('{esp}', 'p', 'du-resena__nombre')}
  <p class="du-resena__rubro">${tpl('{rubro}')}${iconoRubro()}</p>
  <div class="du-estrellas" role="group" aria-label="${esc(r.titulo)}">${estrellas}</div>
  <p class="du-resena__ayuda" ${ver('resSin', true)}>${esc(r.elegi)}</p>
  <div class="du-resena__extra" ${ver('resBien', false)}><p class="du-resena__pregunta">${esc(r.bien)}</p>${chips(r.chipsBien)}</div>
  <div class="du-resena__extra" ${ver('resMal', false)}><p class="du-resena__pregunta">${esc(r.mal)}</p>${chips(r.chipsMal)}</div>
  <div class="du-campo du-campo--vacio"><small>${esc(r.comentario)}</small></div>
  ${boton({ accion: 'enviar-resena', guia: true, extra: 'data-du-habilitar="resConEstrellas" disabled' }, esc(r.enviar), 'app-boton du-boton-blanco')}
</div>
<div class="du-resena du-resena--gracias" ${ver('resEnviada', false)}>
  ${lamparita('du-resena__handy')}
  <p class="du-resena__nombre">${esc(r.gracias)}</p>
  <p class="du-resena__texto">${esc(r.graciasTexto)}</p>
  ${boton({ raiz: 'u-inicio' }, esc(r.inicio), 'app-boton')}
</div>`,
    'hoja',
  );
}

function handia(): PantallaDemo {
  const h = d.handia;
  const acciones = h.acciones
    .map((a, i) =>
      boton({ accion: 'handia-pedir', ir: i === 0 ? 'u-buscando' : 'u-programar' }, esc(a), `app-accion du-rapida${i === 0 ? ' app-accion--principal' : ''}`),
    )
    .join('');
  return pantalla(
    'u-handia',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
${chat({
  id: 'u-handia',
  cabecera: chatCabecera('flecha', h.nombre, h.subtitulo, `<span class="app-chat__avatar">${lamparita()}</span>`),
  bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ia">${lamparita()}</span><strong>${esc(h.nombre)}</strong><small>${esc(h.bienvenida)}</small></div>`,
  inicial: h.inicial,
  etapas: h.etapas,
  final: acciones,
  input: h.input,
})}`),
  );
}

/** Calendario de turnos: los días del recorrido (hoy en adelante) son botones que se habilitan si el turno cae ahí. */
function calendarioTurnos(): string {
  const t = d.turnos;
  let celdas = '';
  for (let n = 1; n <= t.dias; n++) {
    const p = pasados.findIndex((x) => x.num === n);
    const i = dias.findIndex((x) => x.num === n);
    if (p >= 0) {
      const x = pasados[p];
      celdas += boton(
        { accion: 'turno', valor: String(p + 1), ir: 'u-turno-detalle', etiqueta: completar(t.diaAria, { fecha: x.fecha }) },
        `${n}${icono(rubro(x.rubro).icono)}`,
        `app-dia app-dia--${x.estilo}`,
      );
    } else if (i >= 0) {
      const sel = i === ini.dia;
      celdas += boton(
        {
          accion: 'turno',
          valor: '0',
          ir: 'u-turno-detalle',
          etiqueta: completar(t.diaAria, { fecha: dias[i].fecha }),
          extra: `data-du-dia="${i}" data-num="${n}"${sel ? '' : ' disabled'}`,
        },
        `${n}${iconoRubro('rubro', ini.rubro, 'du-dia__icono')}`,
        `app-dia${sel ? ' app-dia--azul' : n === t.hoy ? ' app-dia--hoy' : ''}`,
      );
    } else {
      celdas += `<span class="app-dia${n === t.hoy ? ' app-dia--hoy' : ''}">${n}</span>`;
    }
  }
  return `<div class="app-calendario du-calendario">
  <p class="app-calendario__cabecera"><span>${esc(t.mes)}${icono('abajo')}</span><span>${esc(t.anio)}${icono('abajo')}</span></p>
  <div class="app-calendario__dias">${celdas}</div>
</div>`;
}

function turnos(): PantallaDemo {
  const t = d.turnos;
  const tarjeta = (cuerpo: string, toque: Toque) =>
    `<div class="app-tarjeta"><div class="app-tarjeta__cuerpo">${cuerpo}</div>${boton(toque, esc(d.comun.verMas), 'app-tarjeta__franja')}</div>`;
  const flujo = tarjeta(
    `<span class="app-tarjeta__datos"><strong>${tpl('{rubro}')}${iconoRubro()}</strong>${tpl(f.fechaEstado, 'small')}</span>
     <span class="app-tarjeta__derecha">${tpl(completar(f.menos, { monto: '{total}' }), 'span', 'app-tarjeta__monto app-tarjeta__monto--rojo')}${tpl('{tipo}', 'small')}</span>`,
    { accion: 'turno', valor: '0', ir: 'u-turno-detalle', guia: true },
  );
  const otros = pasados
    .map((x, i) =>
      tarjeta(
        `<span class="app-tarjeta__datos"><strong>${esc(rubro(x.rubro).nombre)}${icono(rubro(x.rubro).icono)}</strong><small>${esc(completar(f.fechaEstado, { fecha: x.fecha, estado: t.estados.terminado }))}</small></span>
         <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--rojo">${esc(completar(f.menos, { monto: formatoPesos(totalDe(x.precio)) }))}</span><small>${esc(x.tipo)}</small></span>`,
        { accion: 'turno', valor: String(i + 1), ir: 'u-turno-detalle' },
      ),
    )
    .join('');
  return pantalla(
    'u-turnos',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${calendarioTurnos()}</div>
${hojaAzul(t.panel, `<div class="app-lista du-scroll">${flujo}${otros}</div>`)}
${navDemo('usuario', 1)}`),
  );
}

function turnoDetalle(): PantallaDemo {
  const x = d.turnoDetalle;
  return pantalla(
    'u-turno-detalle',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
<div class="app-cuerpo du-detalle">
  ${volverDemo(x.titulo)}
  <div class="du-grilla2 du-grilla2--ancha">
    <div>${label(x.rubro)}${ficha('azul', `<strong>${iconoRubro('tRubro')}${tpl('{tRubro}')}</strong>`, tpl('{tTipo}'))}</div>
    <div>${label(x.fecha)}${ficha('clara', tpl('{tDia}', 'strong'), tpl('{tFecha}'), tpl('{tFranja}'))}</div>
  </div>
  ${label(x.especialista)}
  <div class="du-esp-fila"><span class="app-avatar">${icono('usuario')}</span><span class="du-esp-fila__datos">${tpl('{tEsp}', 'strong')}<small class="app-verificado">${icono('verificado')}${esc(d.comun.verificado)}</small></span>${tpl('{tEstado}', 'span', 'du-estado')}</div>
  ${label(x.direccion)}
  ${direccion()}
  ${label(x.costo)}
  <div class="du-costo">
    ${fila(esc(x.presupuesto), tpl('{tPrecio}'))}
    ${fila(tpl(x.tarifa), tpl('{tTarifa}'))}
    ${fila(`${esc(x.total)} <span class="du-pagado" ${ver('tPagado', true)}>${esc(x.pagado)}</span>`, tpl('{tTotal}'), 'du-costo__total')}
  </div>
  ${tpl(x.cambioPedido, 'p', 'du-aviso').replace('<p', `<p ${ver('tCambio', false)}`)}
  ${tpl(x.cancelado, 'p', 'du-aviso du-aviso--rojo').replace('<p', `<p ${ver('tCancelado', false)}`)}
  <div class="du-abajo du-botones">
    ${boton({ ir: 'u-chat', extra: ver('tFlujo', true) }, esc(x.chatear), 'app-boton app-boton--contorno')}
    ${boton({ ir: 'u-cambiar', extra: ver('tActivo', true) }, esc(x.cambiar), 'app-boton du-boton-celeste')}
    ${boton({ accion: 'desde', valor: 'detalle', ir: 'u-cancelar', extra: ver('tActivo', true) }, esc(x.cancelar), 'app-boton du-boton-rojo')}
    ${boton({ ir: 'u-pagos', guia: true, extra: ver('tPagado', true) }, esc(x.verPago), 'app-boton')}
  </div>
</div>`),
  );
}

function cambiar(): PantallaDemo {
  const c = d.cambiar;
  const diaIni = Math.min(ini.dia + 1, dias.length - 1);
  const chipsDias = dias
    .map((x, i) =>
      i === 0
        ? ''
        : boton({ accion: 'cambio-dia', valor: String(i), extra: `data-du-grupo="cambioDia" aria-pressed="${i === diaIni}"` }, esc(x.corto), 'du-chip du-chip--boton'),
    )
    .join('');
  const chipsFranjas = franjas
    .map((x, i) =>
      boton({ accion: 'cambio-franja', valor: String(i), extra: `data-du-grupo="cambioFranja" aria-pressed="${i === ini.franja}"` }, esc(x), 'du-chip du-chip--boton'),
    )
    .join('');
  return pantalla(
    'u-cambiar',
    `${tituloHoja(c.titulo)}
${label(c.dia)}<div class="du-chips">${chipsDias}</div>
${label(c.franja)}<div class="du-chips">${chipsFranjas}</div>
${boton({ accion: 'pedir-cambio', volver: true }, esc(c.pedir), 'app-boton')}
<p class="app-sheet__nota">${esc(c.nota)}</p>`,
    'hoja',
  );
}

function cancelar(): PantallaDemo {
  const c = d.cancelar;
  return pantalla(
    'u-cancelar',
    `${tituloHoja(c.titulo)}
${tpl(c.texto, 'p', 'du-hoja-texto')}
<div class="du-botones">
  ${boton({ accion: 'cancelar-turno', volver: true }, esc(c.si), 'app-boton du-boton-rojo')}
  ${boton({ volver: true }, esc(c.no), 'app-boton app-boton--contorno')}
</div>`,
    'hoja',
  );
}

function mensajes(): PantallaDemo {
  const x = d.mensajes;
  const filas = x.items
    .map((it) => {
      const avatar = it.icono === 'lamparita' ? `<span class="du-chats__avatar du-chats__avatar--ia">${lamparita()}</span>` : `<span class="du-chats__avatar">${icono(it.icono)}</span>`;
      const badge = 'badge' in it && it.badge ? `<span class="du-badge">${esc(it.badge)}</span>` : '';
      return boton({ ir: it.ir }, `${avatar}<span class="du-chats__textos">${tpl(it.nombre, 'strong')}${tpl(it.ultimo, 'small')}</span>${badge}`, 'du-chats__fila');
    })
    .join('');
  return pantalla(
    'u-mensajes',
    app(`${cabeceraDemo('usuario', 'azul')}
<div class="app-cuerpo du-mensajes">
  <div class="du-chats">${filas}</div>
  <div class="du-mensajes__pie">${lamparita('du-mensajes__handy')}<p class="du-mensajes__nota">${icono('escudo')}<span>${esc(x.nota)}</span></p></div>
</div>
${navDemo('usuario', 2)}`),
  );
}

function cuenta(): PantallaDemo {
  const c = d.cuenta;
  const filas = (lista: { texto: string; icono: string; ir?: string; raiz?: string }[]) =>
    `<div class="du-filas">${lista
      .map((x) => boton({ ir: x.ir, raiz: x.raiz }, `${icono(x.icono)}<span>${esc(x.texto)}</span>${icono('flecha')}`, 'du-fila'))
      .join('')}</div>`;
  return pantalla(
    'u-cuenta',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-cuenta">
  <div class="du-perfil">
    <span class="du-perfil__avatar">${icono('usuario')}${boton({ accion: 'aviso', etiqueta: c.fotoAria }, icono('camara'), 'du-perfil__camara')}</span>
    <p class="du-perfil__nombre">${esc(c.nombre)}</p>
    <p class="du-perfil__zona">${icono('pin')}${esc(c.zona)}</p>
  </div>
  <p class="du-seccion">${esc(c.cuenta)}</p>
  ${filas(c.filasCuenta)}
  <p class="du-seccion">${esc(c.configuracion)}</p>
  ${filas(c.filasConfiguracion)}
  ${boton({ accion: 'aviso' }, esc(c.cerrarSesion), 'app-boton du-boton-rojo du-abajo')}
</div>
${navDemo('usuario', 3)}`),
  );
}

function datos(): PantallaDemo {
  const x = d.datos;
  return pantalla(
    'u-datos',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-datos">
  ${volverDemo(T['u-datos'])}
  <div class="du-campos">${x.campos.map((c) => `<div class="du-dato"><small>${esc(c.label)}</small><span>${esc(c.valor)}</span></div>`).join('')}</div>
  <p class="du-nota du-nota--izq">${icono('escudo')}<span>${esc(x.nota)}</span></p>
  ${lamparita('du-datos__handy')}
  ${boton({ accion: 'aviso' }, esc(x.editar), 'app-boton du-abajo')}
</div>`),
  );
}

function pagos(): PantallaDemo {
  const g = d.pagos;
  const tj = g.tarjeta;
  const mov = (i: number, cuerpo: string, desglose: string) =>
    `<div class="app-tarjeta"><div class="app-tarjeta__cuerpo">${cuerpo}</div>
    <div class="du-mov" data-du-mov="${i}"${i === 0 ? '' : ' hidden'}>${desglose}</div>
    ${boton(
      { accion: 'mov', valor: String(i), extra: `aria-expanded="${i === 0}"` },
      `<span data-du-mas${i === 0 ? ' hidden' : ''}>${esc(d.comun.verMas)}</span><span data-du-menos${i === 0 ? '' : ' hidden'}>${esc(g.verMenos)}</span>`,
      'app-tarjeta__franja',
    )}</div>`;
  const flujo = mov(
    0,
    `<span class="app-tarjeta__datos">${tpl(g.pagaste, 'strong')}${tpl('{fecha}', 'small')}</span>
     <span class="app-tarjeta__derecha">${tpl(completar(f.menos, { monto: '{total}' }), 'span', 'app-tarjeta__monto app-tarjeta__monto--rojo')}<small>${esc(g.medio)}</small></span>`,
    `${fila(tpl(g.alEspecialista), tpl('{precio}'))}${fila(tpl(g.tarifa), tpl('{tarifa}'))}`,
  );
  const otros = pasados
    .map((x, i) => {
      const vars = { rubro: rubro(x.rubro).nombre, esp: x.especialista };
      return mov(
        i + 1,
        `<span class="app-tarjeta__datos"><strong>${esc(completar(g.pagaste, vars))}</strong><small>${esc(x.fecha)}</small></span>
         <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--rojo">${esc(completar(f.menos, { monto: formatoPesos(totalDe(x.precio)) }))}</span><small>${esc(g.medio)}</small></span>`,
        `${fila(esc(completar(g.alEspecialista, vars)), esc(formatoPesos(x.precio)))}${fila(esc(completar(g.tarifa, vars)), esc(formatoPesos(tarifaDe(x.precio))))}`,
      );
    })
    .join('');
  return pantalla(
    'u-pagos',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo app-cuerpo--ajustado du-pagos">
  ${volverDemo(T['u-pagos'])}
  <div class="app-tarjeta-banco du-tarjeta"><span class="app-tarjeta-banco__chip"></span><span class="app-tarjeta-banco__numero">${esc(tj.numero)}</span><span class="app-tarjeta-banco__pie"><span>${esc(tj.titular)}</span><span>${esc(tj.vence)}</span></span><span class="app-tarjeta-banco__tipo">${esc(tj.tipo)}</span></div>
  ${boton({ accion: 'aviso' }, esc(g.agregar), 'app-boton app-boton--contorno du-agregar')}
</div>
${hojaAzul(g.panel, `<div class="app-lista du-scroll">${flujo}${otros}</div>`)}`),
  );
}

function ayuda(): PantallaDemo {
  const a = d.ayuda;
  return pantalla(
    'u-ayuda',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-ayuda">
  <div class="du-ayuda__cabecera">${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-volver__flecha')}<span><strong>${esc(T['u-ayuda'])}</strong><small>${esc(a.subtitulo)}</small></span></div>
  <div class="du-preguntas">${a.preguntas
    .map((q, i) => boton({ accion: 'pregunta', valor: String(i), ir: 'u-ayuda-detalle' }, esc(q.pregunta), 'du-pregunta'))
    .join('')}</div>
  <div class="du-abajo du-ayuda__pie">
    ${lamparita('du-ayuda__handy')}
    <p class="du-separador"><span>${esc(a.otra)}</span></p>
    ${boton({ ir: 'u-soporte' }, `${icono('chat')}<span>${esc(a.chatear)}</span>`, 'app-boton app-boton--contorno du-boton-icono')}
  </div>
</div>`),
  );
}

function ayudaDetalle(): PantallaDemo {
  const a = d.ayuda;
  const respuestas = a.preguntas
    .map((q, i) => {
      let accion = '';
      if ('raiz' in q && q.raiz) accion = boton({ raiz: q.raiz }, esc(q.boton), 'app-boton app-boton--contorno');
      else if ('ir' in q && q.ir) accion = boton({ ir: q.ir }, esc(q.boton), 'app-boton app-boton--contorno');
      return `<div class="du-respuesta" ${ver(`resp${i}`, i === 0)}><p class="du-respuesta__pregunta">${esc(q.pregunta)}</p><div class="du-respuesta__cuerpo"><p>${esc(rellenar(q.respuesta))}</p>${accion}</div></div>`;
    })
    .join('');
  return pantalla(
    'u-ayuda-detalle',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-ayuda">
  <p class="du-ayuda__cabecera">${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'app-volver__flecha')}</p>
  ${respuestas}
  <div class="du-sirvio">
    <p>${esc(a.sirvio)}</p>
    <div class="du-sirvio__botones" ${ver('!sirvio', true)}>${boton({ accion: 'sirvio' }, esc(a.no), 'du-pill du-pill--rojo')}${boton(
      { accion: 'sirvio' },
      esc(a.si),
      'du-pill du-pill--verde',
    )}</div>
    <p class="du-sirvio__gracias" ${ver('sirvio', false)}>${icono('check')}${esc(a.gracias)}</p>
  </div>
  <div class="du-abajo du-otras">
    ${label(a.otras)}
    ${a.preguntas.map((q, i) => boton({ accion: 'pregunta', valor: String(i), extra: ver(`!resp${i}`, i !== 0) }, esc(q.pregunta), 'du-pregunta du-pregunta--chica')).join('')}
  </div>
</div>`),
  );
}

function soporte(): PantallaDemo {
  const s = d.soporte;
  return pantalla(
    'u-soporte',
    app(`${cabeceraDemo('usuario', 'blanca', false)}
${chat({
  id: 'u-soporte',
  cabecera: chatCabecera('x', s.nombre, s.subtitulo, `<span class="app-chat__avatar app-chat__avatar--icono">${icono('usuario')}</span>`),
  bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__icono">${icono('chat')}</span><strong>${esc(s.nombre)}</strong><small>${esc(s.bienvenida)}</small></div>`,
  inicial: s.inicial,
  etapas: s.etapas,
  input: s.input,
})}`),
  );
}

function notificaciones(): PantallaDemo {
  const n = d.notificaciones;
  const avisos = n.avisos
    .map(
      (a, i) =>
        `<div class="du-aviso-card du-aviso-card--${a.estilo}" ${ver(`aviso${i}`, true)}><span class="du-aviso-card__icono">${icono(a.icono)}</span>${tpl(
          a.texto,
          'span',
          'du-aviso-card__texto',
        )}${boton({ accion: 'aviso-borrar', valor: String(i), etiqueta: n.borrarAria }, icono('cerrar'), 'du-aviso-card__x')}</div>`,
    )
    .join('');
  return pantalla(
    'u-notificaciones',
    app(`${cabeceraDemo('usuario', 'blanca')}
<div class="app-cuerpo du-avisos">
  ${volverDemo(T['u-notificaciones'])}
  ${boton({ accion: 'avisos-borrar', extra: ver('!avisosVacio', true) }, `<span>${esc(n.borrar)}</span>${icono('cerrar')}`, 'du-borrar')}
  <div class="du-avisos__lista">${avisos}</div>
  <p class="du-avisos__vacio">${esc(n.vacio)}</p>
</div>
${navDemo('usuario', -1)}`),
  );
}

export function demoUsuario(): DemoRol {
  return {
    inicio: 'u-inicio',
    pantallas: [
      inicio(),
      urgencia(),
      opciones(),
      programar(),
      describir(),
      buscando(),
      presupuestos(),
      perfil(),
      confirmar(),
      seguimiento(),
      chatEspecialista(),
      terminado(),
      resena(),
      handia(),
      turnos(),
      turnoDetalle(),
      cambiar(),
      cancelar(),
      mensajes(),
      cuenta(),
      datos(),
      pagos(),
      ayuda(),
      ayudaDetalle(),
      soporte(),
      notificaciones(),
    ],
    recorrido: d.recorrido,
  };
}
