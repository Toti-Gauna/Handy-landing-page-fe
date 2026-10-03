// Demo · lado del usuario. Pantallas navegables de la app (se arman en build, como el resto del sitio).
// Diseño v2: kit .hd-* (src/styles/demo-app.css) + lo propio en src/styles/demo-usuario.css (.du-*).
//
// Lo que cambia según lo que se elige (rubro, día, franja, presupuesto…) se marca con atributos que
// completa src/scripts/demo/usuario.ts en el navegador:
//   data-du-tpl="{esp} va para tu casa"  → texto con variables (se vuelve a armar con cada cambio)
//   data-du-icono="rubro"                → ícono del rubro elegido
//   data-du-ver="cond" / "!cond"         → visible solo si se cumple la condición
//   data-du-guia="cond"                  → lleva data-guia (lo próximo para tocar) solo si se cumple
//   data-du-habilitar="cond"             → botón habilitado solo si se cumple
//   data-du-clase="cond:clase …"         → clase puesta solo si se cumple
//   data-du-grupo="dia"                  → opción de un grupo (aria-pressed o clase du-sel)
//   data-du-monto="total"                → monto que cuenta (m.contar) cuando cambia o al entrar
//   data-du-tono="esp"                   → color del avatar del especialista (du-tono-0…2)
//   data-du-etapa="seg" / "busq"         → etapa de la barra de tres tramos (.hd-seguimiento)
//   data-du-dia / data-du-aria           → días del calendario de turnos
//
// Cada pantalla tiene un contexto (demo-usuario.json → contextos): las del pedido muestran el pedido en curso
// y el presupuesto elegido; las del turno, el turno confirmado (al principio, uno de ejemplo armado con
// "inicial"); HandIA, lo que se le contó. Así, armar un pedido nuevo no cambia el turno que ya está confirmado.
// El HTML sale con el estado inicial, así que sin JS se ve igual.

import d from '../../content/demo-usuario.json' with { type: 'json' };
import demo from '../../content/demo.json' with { type: 'json' };
import rubrosJson from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, formatoPesos, variables } from '../util.ts';
import { avatar, boton, cabeceraDemo, iniciales, navDemo, salirDeLaDemo, tildeExito, tituloHoja, tituloMarcado, type Toque } from './piezas.ts';
import { mapaVivo } from './mapa.ts';
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
const T = d.titulos;

if (d.programar.momentos.length !== franjas.length) throw new Error('Demo usuario: programar.momentos tiene que tener uno por franja');

type Contexto = 'pedido' | 'turno' | 'ia';
const CONTEXTOS = d.contextos as Record<string, string>;
const contextoDe = (id: string): Contexto => (CONTEXTOS[id] as Contexto | undefined) ?? 'turno';
for (const [id, ctx] of Object.entries(CONTEXTOS)) {
  if (!(id in T)) throw new Error(`Demo usuario: contextos menciona "${id}", que no es una pantalla`);
  if (!['pedido', 'turno', 'ia'].includes(ctx)) throw new Error(`Demo usuario: contexto desconocido "${ctx}" en "${id}"`);
}

const tarifaDe = (p: number) => Math.round((p * tarifas.normal.cliente) / 100);
const totalDe = (p: number) => p + tarifaDe(p);
const precioDe = (i: number) => {
  const it = items[i];
  return 'precio' in it && typeof it.precio === 'number' ? it.precio : tarifas.ejemplo.presupuesto;
};

items.forEach((it) => {
  const { franja, urgencia } = it.propone;
  if ((franja !== null && !franjas[franja]) || !franjas[urgencia]) throw new Error(`Demo usuario: "${it.nombre}" propone una franja que no existe`);
});

/** Horario que propone el presupuesto i para un pedido (índices de día y franja). Igual que en el navegador. */
function propuesta(tipo: number, dia: number, franja: number, i: number) {
  const pr = items[i].propone;
  if (tipo === 0) return { dia: 0, franja: pr.urgencia };
  return { dia: Math.min(dia + pr.dia, dias.length - 1), franja: pr.franja ?? franja };
}

/** Reemplaza {clave} con los valores dados; las variables globales ({tarifaCliente}…) también valen. */
function completar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k in vars) return vars[k];
    if (k in variables) return variables[k];
    throw new Error(`Demo usuario: variable sin definir ${m} (en "${texto}")`);
  });
}

// Turno confirmado de ejemplo (el navegador lo reemplaza al confirmar uno).
const pIni = propuesta(ini.tipo, ini.dia, ini.franja, ini.presupuesto);
const turnoIni = { rubro: ini.rubro, tipo: ini.tipo, dia: pIni.dia, franja: pIni.franja, pres: ini.presupuesto, pago: ini.pago };
const cambioDiaIni = Math.min(turnoIni.dia + 1, dias.length - 1);
/** Condiciones que dependen del estado inicial (las demás arrancan como dice cada pantalla). */
const condIni: Record<string, boolean> = { pagoHecho: turnoIni.pago === 0 };
const avisosIni = d.notificaciones.avisos.filter((a) => !('si' in a) || condIni[a.si as string]).length;

/** Igual que en el navegador: valores del pedido en curso y del presupuesto elegido. */
function valoresPedido(): Record<string, string> {
  const r = rubro(ini.rubro);
  const urgencia = ini.tipo === 0;
  const dia = dias[urgencia ? 0 : ini.dia];
  const it = items[ini.presupuesto];
  const p = precioDe(ini.presupuesto);
  const v: Record<string, string> = {
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[ini.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    fecha: dia.fecha,
    franja: urgencia ? d.urgencia.franja : franjas[ini.franja],
    problema: d.problemas[ini.rubro as keyof typeof d.problemas],
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    declaro: it.declaro,
    otro: it.otros.find((o) => o !== r.nombre) ?? '',
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaDe(p)),
    total: formatoPesos(totalDe(p)),
  };
  items.forEach((_, i) => {
    const pr = propuesta(ini.tipo, ini.dia, ini.franja, i);
    v[`horario${i}`] = completar(f.cuando, { diaCorto: dias[pr.dia].corto, franja: franjas[pr.franja] });
  });
  Object.assign(v, {
    horarioEsp: v[`horario${ini.presupuesto}`],
    propDia: dias[pIni.dia].largo,
    propFecha: dias[pIni.dia].fecha,
    propFranja: franjas[pIni.franja],
  });
  return v;
}

/** Igual que en el navegador: valores del turno confirmado (y del que se ve en "Tu turno"). */
function valoresTurno(): Record<string, string> {
  const t = turnoIni;
  const r = rubro(t.rubro);
  const dia = dias[t.dia];
  const it = items[t.pres];
  const p = precioDe(t.pres);
  const v: Record<string, string> = {
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[t.tipo].texto,
    dia: dia.largo,
    diaCorto: dia.corto,
    fecha: dia.fecha,
    franja: franjas[t.franja],
    problema: d.problemas[t.rubro as keyof typeof d.problemas],
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    precio: formatoPesos(p),
    tarifa: formatoPesos(tarifaDe(p)),
    total: formatoPesos(totalDe(p)),
    estado: d.turnos.estados.confirmado,
  };
  v.cuando = completar(f.cuando, v);
  Object.assign(v, {
    tRubro: v.rubro,
    tTipo: v.tipo,
    tDia: v.dia,
    tFecha: v.fecha,
    tFranja: v.franja,
    tEsp: v.esp,
    tEspIni: v.espIni,
    tPrecio: v.precio,
    tTarifa: v.tarifa,
    tTotal: v.total,
    tEstado: v.estado,
    cambio: completar(f.cuando, { diaCorto: dias[cambioDiaIni].corto, franja: v.franja }),
  });
  return v;
}

const VALORES: Record<Contexto, Record<string, string>> = {
  pedido: valoresPedido(),
  turno: valoresTurno(),
  // Al principio HandIA no sabe nada: mismos valores que el pedido.
  ia: valoresPedido(),
};
/** Valores del contexto de la pantalla que se está armando (ver demoUsuario()). */
let V = VALORES.pedido;
let CTX: Contexto = 'pedido';
const rellenar = (texto: string) => completar(texto, V);
/** Deja resueltas solo las variables globales; las de la demo las completa el navegador. */
const soloGlobales = (texto: string) => texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in variables ? variables[k] : m));

/** Texto (del JSON) que puede cambiar en el navegador. `extra`: atributos ya escapados. */
function tpl(texto: string, tag = 'span', clase = '', extra = ''): string {
  const a = `${clase ? ` class="${clase}"` : ''}${extra ? ' ' + extra : ''}`;
  if (!/\{\w+\}/.test(soloGlobales(texto))) return `<${tag}${a}>${esc(rellenar(texto))}</${tag}>`;
  return `<${tag}${a} data-du-tpl="${esc(soloGlobales(texto))}">${esc(rellenar(texto))}</${tag}>`;
}

/** Monto que cuenta en el navegador (data-du-monto): sale con el valor final. */
const monto = (clave: string, clase = 'hd-precio') => `<span class="${clase}" data-du-monto="${clave}">${esc(V[clave])}</span>`;

const iconoRubro = (clave = 'rubro', id = ini.rubro, clase = 'du-ico') =>
  `<span class="${clase}" data-du-icono="${clave}">${icono(rubro(id).icono)}</span>`;

/** Atributo de visibilidad + hidden si arranca oculto. */
const ver = (cond: string, visible: boolean) => `data-du-ver="${cond}"${visible ? '' : ' hidden'}`;

const img = (nombre: string, w: number, h: number, clase = '') =>
  `<img${clase ? ` class="${clase}"` : ''} src="/src/img/${nombre}.webp" alt="" width="${w}" height="${h}" decoding="async" />`;
const lamparita = (clase = '') => img('handy-lamparita', 202, 346, clase);

const app = (contenido: string, clase = '', extra = '') => `<div class="app du-app${clase ? ' ' + clase : ''}"${extra ? ' ' + extra : ''}>${contenido}</div>`;
const pantalla = (id: keyof typeof T, html: string, tipo: 'pantalla' | 'hoja' = 'pantalla'): PantallaDemo => ({
  id,
  titulo: T[id],
  tipo,
  html,
});

const E = 'data-entra';
const POP = 'data-entra="pop"';
const sobre = (texto: string, extra = '') => `<p class="hd-sobre du-sobre"${extra ? ' ' + extra : ''}>${esc(texto)}</p>`;
const menos = (m: string) => completar(f.menos, { monto: m });
const dato = (izq: string, der: string, clase = '') => `<div class="hd-dato${clase ? ' ' + clase : ''}"><span>${izq}</span>${der}</div>`;

// ── Piezas propias ─────────────────────────────────────────────────────────

/** Cabecera con la campana (con la insignia de avisos sin leer) y el pin de la dirección. */
function cabecera(variante: 'blanca' | 'azul', conPin = true): string {
  const pin: Toque | false = conPin ? { accion: 'aviso', valor: 'ubicacion', etiqueta: d.comun.ubicacionAria } : false;
  const html = cabeceraDemo('usuario', variante, pin);
  const campana = `${icono('campana')}</button>`;
  const i = html.indexOf(campana);
  if (i < 0) throw new Error('Demo usuario: no encontré la campana de la cabecera');
  const insignia = `<span class="hd-insignia" data-du-insignia ${ver('!avisosVacio', avisosIni > 0)}>${avisosIni}</span>`;
  return html.slice(0, i) + icono('campana') + insignia + html.slice(i + icono('campana').length);
}

/** Fila "← Título" de las pantallas internas. `flecha`: otro botón para volver. */
function barra(titulo: string, o: { sub?: string; extra?: string; flecha?: string } = {}): string {
  const flecha = o.flecha ?? boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'du-atras');
  return `<div class="du-barra" ${E}>${flecha}<span class="du-barra__textos"><strong>${esc(titulo)}</strong>${o.sub ?? ''}</span>${o.extra ?? ''}</div>`;
}

/** Avatar del especialista elegido (iniciales y color cambian en el navegador). */
function avatarEsp(clave: 'esp' | 'tEsp', tamano?: 'chico' | 'grande', clase = ''): string {
  const idx = clave === 'tEsp' || CTX === 'turno' ? turnoIni.pres : ini.presupuesto;
  const c = ['hd-avatar', 'hd-avatar--verificado', `du-tono-${idx}`];
  if (tamano) c.push(`hd-avatar--${tamano}`);
  if (clase) c.push(clase);
  return `<span class="${c.join(' ')}" data-du-tono="${clave}" aria-hidden="true">${tpl(`{${clave}Ini}`)}</span>`;
}

/** Chip "Verificado" (verde). */
const verificado = (texto = d.comun.verificado) => `<span class="hd-chip hd-chip--exito hd-chip--mini du-verificado">${icono('verificado')}${esc(texto)}</span>`;

/** Fila de la dirección (en la demo no se puede cambiar: muestra un aviso). */
const direccion = () => {
  const x = d.describir;
  return boton(
    { accion: 'aviso', valor: 'ubicacion' },
    `<span class="hd-fila__ico">${icono('casa')}</span><span class="hd-fila__texto"><strong>${esc(x.casa)}</strong><small>${esc(x.calle)}</small></span><span class="hd-fila__fin">${icono('derecha')}</span>`,
    'hd-fila du-lugar',
  );
};

/** "Foto" del problema: ilustración con el ícono del rubro (cambia con el rubro elegido). */
const foto = (clase = '') =>
  `<span class="du-ilus${clase ? ' ' + clase : ''}" role="img" aria-label="${esc(d.comun.fotoAria)}">${iconoRubro('rubro', ini.rubro, 'du-ilus__icono')}</span>`;

/** Burbuja del chat (el texto puede llevar variables de la demo). */
const burbuja = (m: { de: string; texto: string; foto?: boolean }) =>
  `<div class="du-burbuja ${m.de === 'vos' ? 'du-burbuja--propia' : 'du-burbuja--otra'}${m.foto ? ' du-burbuja--foto' : ''}">${m.foto ? foto('du-ilus--chat') : ''}${tpl(m.texto)}</div>`;

type IdChat = 'u-chat' | 'u-handia' | 'u-soporte';

/** Barra de escritura: el avión de enviar manda la primera respuesta rápida. */
const entrada = (id: IdChat, texto: string) =>
  `<div class="du-escribir"><span class="du-escribir__campo">${esc(texto)}${icono('imagen')}</span>${boton(
    { accion: 'enviar', valor: id, etiqueta: d.comun.enviarAria },
    icono('enviar'),
    'du-escribir__enviar',
  )}</div>`;

function chat(o: {
  id: IdChat;
  cabecera: string;
  bienvenida: string;
  inicial: { de: string; texto: string; foto?: boolean }[];
  etapas: { rapidas: { texto: string }[] }[];
  final?: string;
  acciones?: string;
  input: string;
}): string {
  const rapidas = o.etapas
    .map(
      (e, n) =>
        `<div class="hd-chips hd-chips--carril du-rapidas" ${ver(`chat:${o.id}:${n}`, n === 0)}>${e.rapidas
          .map((r, i) => boton({ accion: 'chat', valor: `${o.id}:${n}:${i}`, guia: i === 0 }, esc(r.texto), 'hd-chip hd-chip--tinte du-rapida'))
          .join('')}</div>`,
    )
    .join('');
  const final = o.final ? `<div class="du-rapidas du-rapidas--final" ${ver(`final:${o.id}`, false)}>${o.final}</div>` : '';
  return `<div class="du-chat" data-du-chat="${o.id}">
  ${o.cabecera}
  <div class="du-chat__mensajes hd-scroll" role="log" aria-live="polite" data-du-mensajes><div class="du-chat__espacio"></div>${o.bienvenida}${o.inicial.map(burbuja).join('')}</div>
  <div class="du-chat__pie">${rapidas}${final}${o.acciones ?? ''}${entrada(o.id, o.input)}</div>
  <template data-du-foto>${foto('du-ilus--chat')}</template>
</div>`;
}

const chatCabecera = (cerrar: 'flecha' | 'x', avatarHtml: string, nombre: string, sub: string) =>
  `<div class="du-chat__cabecera">${
    cerrar === 'x'
      ? boton({ volver: true, etiqueta: demo.ui.cerrar }, icono('cerrar'), 'du-atras du-atras--x')
      : boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'du-atras')
  }${avatarHtml}<span class="du-chat__nombre">${tpl(nombre, 'strong')}${tpl(sub, 'small')}</span></div>`;

/** Tarjeta con franja gris (la "Ver más información" de la app). */
const tarjetaFranja = (cuerpo: string, franja: string, extra = '') =>
  `<div class="du-tarjeta"${extra ? ' ' + extra : ''} ${E}><div class="du-tarjeta__cuerpo">${cuerpo}</div>${franja}</div>`;

/** Hoja azul con manija (como "Tus turnos" / "Tus movimientos"). */
const hojaAzul = (titulo: string, contenido: string, clase = '') =>
  `<div class="hd-hoja-azul du-hoja-azul${clase ? ' ' + clase : ''}"><span class="du-manija" aria-hidden="true"></span><p class="du-hoja-azul__titulo">${titulo}</p>${contenido}</div>`;

/** Pie fijo con el botón principal. */
const pie = (contenido: string, clase = '') => `<div class="du-pie${clase ? ' ' + clase : ''}">${contenido}</div>`;

// ── Pantallas ─────────────────────────────────────────────────────────────

function inicio(): PantallaDemo {
  const a = d.inicio;
  const rubros = rubrosJson.rubros
    .map((r) =>
      boton(
        { accion: 'rubro', valor: r.id, ir: 'u-opciones', guia: r.id === ini.rubro, extra: POP },
        `${icono(r.icono)}<span>${esc(r.corto ?? r.nombre)}</span>`,
        'hd-mosaico du-rubro',
      ),
    )
    .join('');
  const tareas = a.tareas
    .map((t, i) => boton({ accion: 'tarea', valor: String(i), ir: 'u-opciones' }, `<span class="du-quiero__ico">${icono(t.icono)}</span><span>${esc(t.texto)}</span>`, 'du-quiero'))
    .join('');
  const p = a.proximo;
  const proximo = `<div class="du-proximo" ${E} ${ver('tcActivo', true)}>
    ${sobre(p.sobre)}
    ${boton(
      { accion: 'turno', valor: '0', ir: 'u-turno-detalle', etiqueta: p.ver },
      `<span class="hd-ticket__papel du-proximo__papel">
        <span class="du-proximo__arriba">${avatarEsp('esp')}<span class="du-proximo__quien">${tpl('{esp}', 'strong')}<small>${iconoRubro()}${tpl('{rubro}')}</small></span><span class="hd-chip hd-chip--exito hd-chip--mini">${esc(p.estado)}</span></span>
        <span class="hd-ticket__corte"></span>
        <span class="du-proximo__abajo">${icono('calendario')}${tpl('{cuando}', 'strong')}<span class="du-proximo__ver">${esc(p.ver)}${icono('derecha')}</span></span>
      </span>`,
      'hd-ticket du-proximo__ticket',
    )}
  </div>`;
  return pantalla(
    'u-inicio',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-inicio">
  ${boton({ accion: 'aviso', valor: 'ubicacion', extra: E }, `${icono('pin')}<span>${esc(a.direccion)}</span>${icono('abajo')}`, 'hd-chip hd-chip--tinte du-direccion')}
  <div ${E}>${tituloMarcado(a.titulo, 'hd-titulo hd-titulo--grande du-inicio__titulo', 'h2')}</div>
  <div class="hd-mosaicos du-rubros" role="group" aria-label="${esc(a.rubrosAria)}">${rubros}</div>
  ${boton(
    { ir: 'u-handia', extra: E },
    `<span class="du-handia__luz" aria-hidden="true"><i></i>${lamparita('hd-handy du-handia__img')}</span><span class="du-handia__textos"><small>${esc(a.handia.titulo)}</small><strong>${esc(a.handia.texto)}</strong><span>${icono('chispas')}${esc(a.handia.detalle)}</span></span><span class="du-handia__flecha">${icono('flecha')}</span>`,
    'hd-tarjeta hd-tarjeta--azul du-handia',
  )}
  <div ${E}>${tituloMarcado(a.quieroTitulo, 'hd-titulo hd-titulo--chico hd-titulo--azul du-inicio__sub', 'h3')}</div>
  <div class="hd-chips hd-chips--carril du-carril" ${E}>${tareas}</div>
  ${proximo}
</div>
${navDemo('usuario', 0)}`),
  );
}

function opciones(): PantallaDemo {
  const o = d.opciones;
  const lista = o.items
    .map((it, i) =>
      boton(
        {
          accion: 'tipo',
          valor: String(i),
          ir: i === 0 ? 'u-describir' : 'u-programar',
          guia: i === ini.tipo,
          extra: `data-du-grupo="tipo" aria-pressed="${i === ini.tipo}" ${E}`,
        },
        `<span class="du-opcion__ico">${icono(it.icono)}</span><span class="du-opcion__textos"><strong>${esc(it.texto)}<span class="hd-chip hd-chip--mini du-opcion__chip">${esc(it.etiqueta)}</span></strong><small>${esc(it.detalle)}</small></span>${icono('derecha')}`,
        `du-opcion du-opcion--${i}`,
      ),
    )
    .join('');
  return pantalla(
    'u-opciones',
    `${tituloHoja(o.titulo)}
<p class="du-hoja-sub" ${E}>${esc(o.para)} <span class="hd-chip hd-chip--tinte">${iconoRubro()}${tpl('{rubro}', 'strong')}</span></p>
<div class="du-opciones">${lista}</div>
<p class="du-hoja-nota" ${E}>${icono('info')}<span>${esc(o.nota)}</span></p>`,
    'hoja',
  );
}

/** Día que toca la guía: el siguiente al elegido (se ve cómo cambia). Igual que en el navegador. */
const diaGuia = (dia: number) => (dia + 1 < dias.length ? dia + 1 : dia - 1);

/** Franjas en mosaicos (programar y cambiar la fecha). */
const mosaicosFranjas = (accion: string, grupo: string, elegida: number) =>
  franjas
    .map((x, i) =>
      boton(
        { accion, valor: String(i), extra: `data-du-grupo="${grupo}" aria-pressed="${i === elegida}"` },
        `<small>${esc(d.programar.momentos[i])}</small><strong>${esc(x)}</strong>`,
        'hd-mosaico du-franja',
      ),
    )
    .join('');

/** Días en un carril de chips (programar y cambiar la fecha). */
const carrilDias = (accion: string, grupo: string, elegido: number, desde = 0, guia?: (i: number) => string) =>
  dias
    .map((x, i) =>
      i < desde
        ? ''
        : boton(
            { accion, valor: String(i), guia: guia ? i === diaGuia(ini.dia) : false, extra: `${guia ? guia(i) + ' ' : ''}data-du-grupo="${grupo}" aria-pressed="${i === elegido}"` },
            `<small>${esc(x.rueda.split(' ')[0])}</small><strong>${x.num}</strong>`,
            'du-dia',
          ),
    )
    .join('');

function programar(): PantallaDemo {
  const g = d.programar;
  return pantalla(
    'u-programar',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-programar">
  ${barra(g.titulo, { sub: `<small>${iconoRubro()}${tpl(f.rubroTipo)}</small>` })}
  <section class="du-bloque" ${E}>
    <div class="du-bloque__titulo">${sobre(g.dia)}<span class="hd-chip hd-chip--mini">${icono('calendario')}${esc(g.mes)}</span></div>
    <div class="hd-chips hd-chips--carril du-dias" role="group" aria-label="${esc(g.ruedaAria)}">${carrilDias('dia', 'dia', ini.dia, 0, (i) => `data-du-guia="guiaDia${i}"`)}</div>
  </section>
  <section class="du-bloque" ${E}>
    ${sobre(g.franja)}
    <div class="hd-mosaicos du-franjas" role="group" aria-label="${esc(g.franjasAria)}">${mosaicosFranjas('franja', 'franja', ini.franja)}</div>
  </section>
  <p class="du-info" ${E}>${icono('reloj')}<span>${esc(g.info)}</span></p>
</div>
${pie(`<p class="du-resumen-linea">${icono('calendario')}<span>${esc(g.resumen)}</span>${tpl('{dia} · {franja}', 'strong')}</p>${boton({ ir: 'u-describir', guia: true }, `${esc(g.siguiente)}${icono('flecha')}`, 'hd-boton')}`)}`),
  );
}

function describir(): PantallaDemo {
  const x = d.describir;
  return pantalla(
    'u-describir',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-describir">
  ${barra(x.titulo, { sub: `<small>${esc(x.paso)}</small>` })}
  <div class="du-resumen" ${E}>
    <div class="du-resumen__tile du-resumen__tile--azul"><small>${esc(x.rubro)}</small><strong>${iconoRubro()}${tpl('{rubro}')}</strong>${tpl('{tipo}')}</div>
    <div class="du-resumen__tile"><small>${esc(x.cuando)}</small>${tpl('{dia}', 'strong')}${tpl('{franja}')}</div>
  </div>
  <section class="du-bloque" ${E}>
    ${sobre(x.pedido)}
    <div class="du-campo">${tpl('{problema}', 'p')}<small>${icono('editar')}${esc(x.ayuda)}</small></div>
  </section>
  <section class="du-bloque" ${E}>
    ${sobre(x.fotos)}
    <div class="du-fotos">
      <span class="du-foto" ${ver('foto1', false)}>${foto()}</span>
      <span class="du-foto" ${ver('foto2', false)}>${foto()}</span>
      ${boton(
        { accion: 'foto', guia: true, extra: `data-du-guia="fotoGuia" ${ver('puedeFoto', true)}` },
        `${icono('camara')}<span>${esc(x.agregarFoto)}</span>`,
        'du-foto du-foto--agregar',
      )}
    </div>
  </section>
  <section class="du-bloque" ${E}>
    ${sobre(x.direccion)}
    <div class="hd-tarjeta hd-tarjeta--gris hd-tarjeta--compacta">${direccion()}</div>
  </section>
</div>
${pie(`${boton({ accion: 'pedir', ir: 'u-buscando', guia: true }, `${icono('enviar')}${esc(x.pedir)}`, 'hd-boton')}<p class="du-pie__nota">${esc(x.nota)}</p>`)}`),
  );
}

/** Zona del mapa a pantalla completa (debajo de la cabecera y de la hoja azul). */
const zonaMapa = (mapa: string, extra = '') => `<div class="du-mapa-zona">${mapa}${extra}</div>`;

function buscando(): PantallaDemo {
  const b = d.buscando;
  const llegan = items
    .map(
      (it, i) => `<div class="du-llega" data-du-clase="llego${i + 1}:du-llega--si">
      <span class="du-llega__vacio"><i class="hd-esqueleto"></i><i class="hd-esqueleto"></i><i class="hd-esqueleto"></i></span>
      <span class="du-llega__lleno">${avatar(it.nombre, { verificado: true, tamano: 'chico', clase: `du-tono-${i}` })}<small>${esc(it.nombre)}</small><strong class="hd-precio">${esc(formatoPesos(precioDe(i)))}</strong></span>
    </div>`,
    )
    .join('');
  return pantalla(
    'u-buscando',
    app(
      `${cabecera('azul', false)}
${zonaMapa(
  mapaVivo({ id: 'du-busq', radar: true, otros: true }),
  `${boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'du-flotante')}<span class="hd-chip hd-chip--noche hd-vivo du-mapa-chip" ${POP}>${esc(b.vivo)}</span>`,
)}
${hojaAzul(
  `<span class="du-estados" aria-live="polite">${b.estados.map((e, i) => `<span ${ver(`busc${i}`, i === 0)}>${esc(e)}</span>`).join('')}</span><span class="du-contador" aria-label="${esc(b.contadorAria)}"><span data-du-contador>0</span><small>/${items.length}</small></span>`,
  `<div class="hd-seguimiento du-barra-tramos" data-du-etapa="busq" data-etapa="0" aria-hidden="true"><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__quien">${icono('lupa')}</span></div>
  <p class="du-hoja-azul__nota">${esc(b.nota)}</p>
  <div class="du-llegan">${llegan}</div>
  ${boton({ ir: 'u-presupuestos', guia: true, extra: 'data-du-habilitar="buscListo" disabled' }, `${esc(b.ver)}${icono('flecha')}`, 'hd-boton hd-boton--blanco')}`,
  'du-hoja-azul--mapa',
)}`,
      'du-mapa-pantalla du-buscando',
    ),
  );
}

function presupuestos(): PantallaDemo {
  const q = d.presupuestos;
  const tarjetas = items
    .map(
      (it, i) => `<article class="du-oferta${i === ini.presupuesto ? ' du-sel' : ''}" data-du-grupo="pres" data-valor="${i}" ${E}>
      <div class="du-oferta__cuerpo">
        <div class="du-oferta__arriba">${avatar(it.nombre, { verificado: true, clase: `du-tono-${i}` })}<span class="du-oferta__quien"><strong>${esc(it.nombre)}</strong>${verificado()}</span><span class="hd-precio du-oferta__precio">${esc(formatoPesos(precioDe(i)))}</span></div>
        <div class="du-oferta__datos"><span>${icono('reloj')}${tpl(`{horario${i}}`)}</span><span>${icono('pin')}${esc(it.zona)}</span></div>
      </div>
      <div class="du-oferta__franja">${boton({ accion: 'presupuesto', valor: String(i), ir: 'u-perfil', guia: i === ini.presupuesto }, esc(q.verPerfil), 'du-oferta__btn')}${boton(
        { accion: 'presupuesto', valor: String(i), ir: 'u-confirmar' },
        `${esc(q.elegir)}${icono('check')}`,
        'du-oferta__btn du-oferta__btn--azul',
      )}</div>
    </article>`,
    )
    .join('');
  return pantalla(
    'u-presupuestos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo du-cuerpo--ajustado">${barra(q.titulo, { sub: `<small>${iconoRubro()}${tpl(f.pedido)}</small>` })}</div>
${hojaAzul(
  `${esc(q.panel)}<span class="hd-chip hd-chip--claro hd-chip--mini">${esc(q.sub)}</span>`,
  `<div class="hd-scroll du-lista">${tarjetas}<p class="du-hoja-azul__nota du-hoja-azul__nota--fin">${icono('info')}${esc(q.nota)}</p></div>`,
  'du-hoja-azul--llena',
)}`),
  );
}

function perfil(): PantallaDemo {
  const x = d.perfil;
  const fila = (ic: string, titulo: string, valor: string) =>
    `<div class="hd-fila"><span class="hd-fila__ico">${icono(ic)}</span><span class="hd-fila__texto"><small>${esc(titulo)}</small>${valor}</span></div>`;
  return pantalla(
    'u-perfil',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-perfil">
  ${barra(x.titulo)}
  <div class="du-heroe" ${E}>
    ${avatarEsp('esp', 'grande', 'du-avatar-blanco')}
    ${tpl('{esp}', 'p', 'hd-titulo hd-titulo--claro du-heroe__nombre')}
    <span class="hd-chip hd-chip--claro">${icono('verificado')}${esc(x.verificado)}</span>
  </div>
  <section class="du-bloque" ${E}>
    ${sobre(x.rubros)}
    <div class="hd-chips"><span class="hd-chip hd-chip--azul">${iconoRubro()}${tpl('{rubro}')}</span>${tpl('{otro}', 'span', 'hd-chip', ver('hayOtro', V.otro !== ''))}</div>
  </section>
  <div class="hd-tarjeta hd-tarjeta--gris hd-tarjeta--compacta hd-lista" ${E}>
    ${fila('pin', x.zona, tpl('{zona}', 'strong'))}
    ${fila('reloj', x.horario, tpl('{declaro}', 'strong'))}
  </div>
  <div class="hd-ticket hd-ticket--azul du-precio" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-precio__arriba"><small class="hd-sobre">${esc(x.presupuesto)}</small>${monto('precio', 'hd-precio hd-precio--grande')}</div>
      <div class="hd-ticket__corte"></div>
      <p class="du-precio__abajo">${icono('calendario')}${tpl(x.propone)}</p>
    </div>
  </div>
</div>
${pie(`<p class="du-pie__nota">${icono('info')}${esc(x.nota)}</p>${boton({ ir: 'u-confirmar', guia: true }, esc(x.elegir), 'hd-boton')}`)}`),
  );
}

function confirmar(): PantallaDemo {
  const c = d.confirmar;
  const pagos = c.pagos
    .map((p, i) =>
      boton(
        { accion: 'pago', valor: String(i), extra: `data-du-grupo="pago" aria-pressed="${i === ini.pago}"` },
        `<span class="du-pago__ico">${icono(p.icono)}</span><strong>${esc(p.texto)}</strong><small>${esc(p.detalle)}</small>`,
        'du-pago',
      ),
    )
    .join('');
  return pantalla(
    'u-confirmar',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-confirmar">
  ${barra(c.titulo, { sub: `<small>${esc(c.sub)}</small>` })}
  <div class="hd-ticket du-ticket" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-ticket__arriba">
        <div class="du-ticket__quien">${avatarEsp('esp')}<span>${tpl('{esp}', 'strong')}<small>${iconoRubro()}${tpl(f.rubroTipo)}</small></span></div>
        <div class="du-ticket__grilla">
          <div class="du-ticket__dato">${icono('calendario')}<small>${esc(c.cuando)}</small>${tpl('{propDia}', 'strong')}${tpl('{propFranja}')}</div>
          <div class="du-ticket__dato">${icono('casa')}<small>${esc(c.donde)}</small><strong>${esc(d.describir.casa)}</strong><span>${esc(d.describir.calle)}</span></div>
        </div>
      </div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">
        ${dato(tpl(c.presupuestoDe), tpl('{precio}'))}
        ${dato(tpl(c.tarifa), tpl('{tarifa}'))}
        ${dato(esc(c.total), monto('total', 'hd-precio du-total'), 'hd-dato--total')}
      </div>
    </div>
  </div>
  <p class="du-nota" ${E}>${icono('billetera')}<span>${esc(c.nota)}</span></p>
  <section class="du-bloque" ${E}>
    ${sobre(c.pagoTitulo)}
    <div class="du-pagos">${pagos}</div>
  </section>
</div>
${pie(`<div class="hd-botones hd-botones--fila">${boton({ raiz: 'u-inicio' }, esc(c.cancelar), 'hd-boton hd-boton--claro du-boton-angosto')}${boton({ accion: 'confirmar', ir: 'u-seguimiento', guia: true }, `${icono('check')}${esc(c.confirmar)}`, 'hd-boton hd-boton--exito')}</div>`)}`),
  );
}

function seguimiento(): PantallaDemo {
  const s = d.seguimiento;
  const k = d.confirmado;
  // La flecha lleva al inicio: el turno ya está confirmado, no se vuelve a "Confirmá el turno".
  return pantalla(
    'u-seguimiento',
    app(
      `${cabecera('azul', false)}
${zonaMapa(
  mapaVivo({ id: 'du-seg', ruta: true, especialista: V.espIni, viaje: 4.6 }),
  `${boton({ raiz: 'u-inicio', etiqueta: s.inicioAria }, icono('atras'), 'du-flotante')}<span class="hd-chip hd-chip--noche du-mapa-chip" ${POP}>${icono('reloj')}${tpl('{cuando}')}</span>`,
)}
${hojaAzul(
  boton(
    { accion: 'seg-avanzar', guia: true, extra: 'data-du-guia="segAntes" data-du-habilitar="segAntes"' },
    `<span class="du-estados" aria-live="polite">${s.estados.map((e, i) => tpl(e, 'span', '', ver(`seg${i}`, i === 0))).join('')}</span><span class="sr">${esc(s.avanzar)}</span>`,
    'du-seg-titulo',
  ),
  `<div class="hd-seguimiento du-barra-tramos" data-du-etapa="seg" data-etapa="1" aria-hidden="true"><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__quien">${icono('caminar')}</span></div>
  <div class="du-etapas" aria-hidden="true">${s.etapas.map((e, i) => `<span data-du-clase="segEtapa${i}:du-etapa--hecha">${esc(e)}</span>`).join('')}</div>
  <div class="du-seg-horario" ${ver('segAntes', true)}>
    <span class="du-seg-horario__textos"><small>${esc(s.horarioLabel)}</small>${tpl('{cuando}', 'strong')}</span>
    ${boton({ accion: 'turno-seg', ir: 'u-turno-detalle', etiqueta: s.infoAria }, icono('info'), 'hd-circulo hd-circulo--claro')}
    ${boton({ accion: 'desde', valor: 'seg', ir: 'u-cancelar', etiqueta: s.cancelarAria }, icono('prohibido'), 'hd-circulo hd-circulo--rojo')}
  </div>
  <div class="du-llegada" ${ver('segLlego', false)}>
    ${boton({ accion: 'llegada', guia: true }, `${icono('check')}${esc(s.llegada)}`, 'hd-boton hd-boton--amarillo')}
    <small>${esc(s.llegadaNota)}</small>
  </div>
  <div class="du-seg-pie">${avatarEsp('esp', 'chico', 'du-avatar-blanco')}<span><small>${esc(s.especialistaLabel)}</small>${tpl(s.especialista, 'strong')}</span>${boton(
    { ir: 'u-chat', etiqueta: s.chatAria, extra: 'data-du-guia="segTrabajando"' },
    `${icono('chat')}<span class="hd-insignia" ${ver('!chatLeido', true)}>1</span>`,
    'app-cuadrado du-seg-chat',
  )}</div>`,
  'du-hoja-azul--mapa',
)}
<div class="du-festejo" data-du-festejo hidden>
  ${tildeExito}
  ${tituloMarcado(k.titulo, 'hd-titulo du-festejo__titulo')}
  ${tpl(k.texto, 'p', 'du-festejo__texto')}
</div>`,
      'du-mapa-pantalla du-seguimiento',
      'data-du-seg="0"',
    ),
  );
}

function chatEspecialista(): PantallaDemo {
  const c = d.chat;
  return pantalla(
    'u-chat',
    app(`${cabecera('blanca', false)}
${chat({
  id: 'u-chat',
  cabecera: chatCabecera('flecha', avatarEsp('esp'), '{esp}', c.subtitulo),
  bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ico">${icono('escudo')}</span><small>${esc(c.bienvenida)}</small></div>`,
  inicial: c.inicial,
  etapas: c.etapas,
  final: boton({ accion: 'terminar', ir: 'u-terminado', guia: true }, `${icono('check')}${esc(c.terminar)}`, 'hd-boton hd-boton--exito'),
  acciones: `<div class="du-chat__acciones">${boton({ accion: 'turno-seg', ir: 'u-turno-detalle' }, `${icono('calendario')}${esc(c.verTurno)}`, 'hd-chip du-accion')}${boton(
    { accion: 'aviso', valor: 'foto' },
    `${icono('camara')}${esc(c.foto)}`,
    'hd-chip du-accion',
  )}</div>`,
  input: c.input,
})}`, 'du-chat-pantalla'),
  );
}

function terminado(): PantallaDemo {
  const t = d.terminado;
  return pantalla(
    'u-terminado',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-terminado">
  <div class="du-escena" ${POP}>
    <span class="du-escena__fondo" aria-hidden="true"></span>
    ${img('handys-grupo', 600, 311, 'hd-handy du-escena__handys')}
    ${tildeExito}
  </div>
  <div ${E}>${tituloMarcado(t.titulo, 'hd-titulo du-centro')}</div>
  <div class="hd-tarjeta hd-tarjeta--compacta du-esp-fila" ${E}>${avatarEsp('esp')}<span class="du-esp-fila__datos">${tpl('{esp}', 'strong')}${verificado()}</span><span class="du-esp-fila__der"><strong>${iconoRubro()}${tpl('{rubroCorto}')}</strong>${tpl('{cuando}', 'small')}</span></div>
  <div class="hd-ticket du-ticket du-ticket--pago" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-ticket__total"><small class="hd-sobre"><span ${ver('pagoAhora', turnoIni.pago === 0)}>${esc(t.pagaste)}</span><span ${ver('pagoDespues', turnoIni.pago === 1)}>${esc(t.aPagar)}</span></small>${monto('total', 'hd-precio hd-precio--grande du-positivo')}</div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">
        ${dato(tpl(t.alEspecialista), tpl('{precio}'))}
        ${dato(esc(t.tarifa), tpl('{tarifa}'))}
      </div>
    </div>
  </div>
  <p class="du-nota" ${E}>${icono('billetera')}<span>${esc(t.nota)}</span></p>
</div>
${pie(`${boton({ accion: 'pagar', guia: true, extra: ver('pagoDespues', turnoIni.pago === 1) }, tpl(t.pagar), 'hd-boton hd-boton--exito')}
  ${boton({ ir: 'u-resena', guia: true }, `${icono('estrella')}${tpl(t.calificar)}`, 'hd-boton')}
  ${boton({ raiz: 'u-inicio' }, esc(t.inicio), 'hd-boton hd-boton--fantasma')}`, 'du-pie--compacto')}`),
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
          extra: `data-du-grupo="estrellas" aria-pressed="false"`,
        },
        icono('estrella'),
        'du-estrella',
      ),
    )
    .join('');
  const chips = (lista: string[]) =>
    `<div class="hd-chips du-chips-centro">${lista.map((c) => boton({ accion: 'chip', extra: 'aria-pressed="false"' }, esc(c), 'hd-chip du-chip-voto')).join('')}</div>`;
  return pantalla(
    'u-resena',
    `${tituloHoja(r.titulo)}
<div class="du-resena" ${ver('!resEnviada', true)}>
  <div class="du-resena__quien" ${E}>${avatarEsp('esp', 'grande')}${tpl('{esp}', 'p', 'hd-titulo hd-titulo--chico')}<span class="hd-chip hd-chip--tinte">${iconoRubro('rubro', turnoIni.rubro)}${tpl('{rubro}')}</span></div>
  <div class="du-estrellas" role="group" aria-label="${esc(r.titulo)}" ${E}>${estrellas}</div>
  <p class="du-resena__ayuda" ${ver('resSin', true)}>${esc(r.elegi)}</p>
  <div class="du-resena__extra" ${ver('resBien', false)}><p class="hd-sobre">${esc(r.bien)}</p>${chips(r.chipsBien)}</div>
  <div class="du-resena__extra" ${ver('resMal', false)}><p class="hd-sobre">${esc(r.mal)}</p>${chips(r.chipsMal)}</div>
  <div class="du-campo du-campo--vacio" ${E}><small>${icono('editar')}${esc(r.comentario)}</small></div>
  ${boton({ accion: 'enviar-resena', guia: true, extra: 'data-du-habilitar="resConEstrellas" disabled' }, `${icono('enviar')}${esc(r.enviar)}`, 'hd-boton')}
</div>
<div class="du-resena du-resena--gracias" ${ver('resEnviada', false)}>
  <div class="du-resena__fiesta">${lamparita('hd-handy hd-handy--salta du-resena__handy')}${tildeExito}</div>
  <p class="hd-titulo hd-titulo--chico">${esc(r.gracias)}</p>
  <p class="hd-texto hd-texto--suave">${esc(r.graciasTexto)}</p>
  ${boton({ raiz: 'u-inicio' }, esc(r.inicio), 'hd-boton')}
</div>`,
    'hoja',
  );
}

function handia(): PantallaDemo {
  const h = d.handia;
  // "Pedir para hoy" arma una urgencia y busca presupuestos; "Programar turno" lleva a elegir el día.
  const acciones = `<div class="hd-botones hd-botones--fila">${h.acciones
    .map((a, i) =>
      boton(
        { accion: 'handia-pedir', valor: i === 0 ? 'hoy' : 'programar', ir: i === 0 ? 'u-buscando' : 'u-programar' },
        `${icono(i === 0 ? 'alerta' : 'calendario')}${esc(a)}`,
        `hd-boton${i === 0 ? '' : ' hd-boton--claro'}`,
      ),
    )
    .join('')}</div>`;
  return pantalla(
    'u-handia',
    app(`${cabecera('blanca', false)}
${chat({
  id: 'u-handia',
  cabecera: chatCabecera('flecha', `<span class="du-ia-avatar" aria-hidden="true">${lamparita()}</span>`, h.nombre, h.subtitulo),
  bienvenida: `<div class="du-bienvenida du-bienvenida--ia"><span class="du-bienvenida__luz" aria-hidden="true"><i></i>${lamparita('hd-handy')}</span><strong>${esc(h.nombre)}</strong><small>${esc(h.bienvenida)}</small></div>`,
  inicial: h.inicial,
  etapas: h.etapas,
  final: acciones,
  input: h.input,
})}
<template data-du-detectado><div class="du-detectado">${icono('chispas')}${iconoRubro('rubro', ini.rubro, 'du-detectado__ico')}${tpl(h.detectado, 'strong')}</div></template>`, 'du-chat-pantalla du-handia-pantalla'),
  );
}

/** Calendario de turnos: los días del recorrido (hoy en adelante) son botones; solo el del turno está habilitado. */
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
        `<span>${n}</span>${icono(rubro(x.rubro).icono)}`,
        `du-celda du-celda--${x.estilo}`,
      );
    } else if (i >= 0) {
      const sel = i === turnoIni.dia;
      const aria = completar(t.diaAria, { fecha: dias[i].fecha });
      celdas += boton(
        {
          accion: 'turno',
          valor: '0',
          ir: 'u-turno-detalle',
          etiqueta: sel ? aria : undefined,
          extra: `data-du-dia="${i}" data-num="${n}" data-du-aria="${esc(aria)}"${sel ? '' : ' disabled'}`,
        },
        `<span>${n}</span>${iconoRubro('rubro', turnoIni.rubro, 'du-celda__ico')}`,
        `du-celda${sel ? ' du-celda--azul' : n === t.hoy ? ' du-celda--hoy' : ''}`,
      );
    } else {
      celdas += `<span class="du-celda${n === t.hoy ? ' du-celda--hoy' : ''}"><span>${n}</span></span>`;
    }
  }
  const selector = (texto: string, aria: string) => boton({ accion: 'aviso', etiqueta: aria }, `${esc(texto)}${icono('abajo')}`, 'du-cal-sel');
  return `<div class="du-calendario" ${E}>
  <div class="du-calendario__cabecera">${selector(t.mes, t.mesAria)}${selector(t.anio, t.anioAria)}</div>
  <div class="du-calendario__dias">${celdas}</div>
</div>`;
}

/** Franja gris "Ver más información" de las tarjetas de turnos y pagos. */
const franjaVerMas = (toque: Toque) => boton(toque, `${esc(d.comun.verMas)}${icono('derecha')}`, 'du-tarjeta__franja');

function turnos(): PantallaDemo {
  const t = d.turnos;
  // El monto del turno del recorrido: pagado en rojo, "A pagar" si todavía no se pagó, nada si se canceló.
  const flujo = tarjetaFranja(
    `<span class="du-tarjeta__ico du-tarjeta__ico--azul">${iconoRubro()}</span>
     <span class="du-tarjeta__datos">${tpl('{rubro}', 'strong')}${tpl(f.fechaEstado, 'small')}</span>
     <span class="du-tarjeta__der">${tpl(menos('{total}'), 'strong', 'hd-precio hd-negativo', ver('pagoHecho', condIni.pagoHecho))}${tpl(
       t.aPagar,
       'strong',
       'hd-precio du-a-pagar',
       ver('flujoAPagar', !condIni.pagoHecho),
     )}${tpl('{tipo}', 'small')}</span>`,
    franjaVerMas({ accion: 'turno', valor: '0', ir: 'u-turno-detalle', guia: true }),
  );
  const otros = pasados
    .map((x, i) =>
      tarjetaFranja(
        `<span class="du-tarjeta__ico du-tarjeta__ico--${x.estilo}">${icono(rubro(x.rubro).icono)}</span>
         <span class="du-tarjeta__datos"><strong>${esc(rubro(x.rubro).nombre)}</strong><small>${esc(completar(f.fechaEstado, { fecha: x.fecha, estado: t.estados.terminado }))}</small></span>
         <span class="du-tarjeta__der"><strong class="hd-precio hd-negativo">${esc(menos(formatoPesos(totalDe(x.precio))))}</strong><small>${esc(x.tipo)}</small></span>`,
        franjaVerMas({ accion: 'turno', valor: String(i + 1), ir: 'u-turno-detalle' }),
      ),
    )
    .join('');
  return pantalla(
    'u-turnos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo du-cuerpo--ajustado du-turnos">${calendarioTurnos()}</div>
${hojaAzul(esc(t.panel), `<div class="hd-scroll du-lista">${flujo}${otros}</div>`, 'du-hoja-azul--llena du-hoja-azul--nav')}
${navDemo('usuario', 1)}`),
  );
}

function turnoDetalle(): PantallaDemo {
  const x = d.turnoDetalle;
  // La guía depende de dónde se abrió: desde el seguimiento vuelve a él; desde Turnos sigue a "Ver el pago".
  const flecha = boton({ volver: true, etiqueta: demo.ui.volver, extra: 'data-du-guia="origenSeg"' }, icono('atras'), 'du-atras');
  const estado = tpl('{tEstado}', 'span', 'hd-chip hd-chip--tinte du-estado', 'data-du-clase="tTerminado:hd-chip--exito tCancelado:du-estado--rojo"');
  return pantalla(
    'u-turno-detalle',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-detalle">
  ${barra(x.titulo, { flecha, extra: estado })}
  <div class="hd-ticket du-ticket" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-ticket__arriba">
        <div class="du-ticket__quien"><span class="du-tarjeta__ico du-tarjeta__ico--azul">${iconoRubro('tRubro')}</span><span>${tpl('{tRubro}', 'strong')}${tpl('{tTipo}', 'small')}</span></div>
        <div class="du-ticket__grilla">
          <div class="du-ticket__dato">${icono('calendario')}<small>${esc(x.fecha)}</small>${tpl('{tDia}', 'strong')}${tpl('{tFranja}')}</div>
          <div class="du-ticket__dato">${icono('casa')}<small>${esc(x.direccion)}</small><strong>${esc(d.describir.casa)}</strong><span>${esc(d.describir.calle)}</span></div>
        </div>
        <div class="du-ticket__esp">${avatarEsp('tEsp', 'chico')}<span><small>${esc(x.especialista)}</small>${tpl('{tEsp}', 'strong')}</span>${verificado()}</div>
      </div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">
        ${dato(esc(x.presupuesto), tpl('{tPrecio}'))}
        ${dato(tpl(x.tarifa), tpl('{tTarifa}'))}
        ${dato(`${esc(x.total)} <span class="hd-chip hd-chip--exito hd-chip--mini" ${ver('tPagado', true)}>${esc(x.pagado)}</span>`, tpl('{tTotal}', 'span', 'hd-precio'), 'hd-dato--total')}
      </div>
    </div>
  </div>
  ${tpl(x.cambioPedido, 'p', 'du-aviso', ver('tCambio', false))}
  ${tpl(x.cancelado, 'p', 'du-aviso du-aviso--rojo', ver('tCancelado', false))}
</div>
${pie(`<div class="hd-botones hd-botones--fila" ${ver('tActivo', true)}>${boton({ ir: 'u-chat' }, `${icono('chat')}${esc(x.chatear)}`, 'hd-boton hd-boton--claro du-boton-chico')}${boton({ ir: 'u-cambiar' }, `${icono('calendario')}${esc(x.cambiar)}`, 'hd-boton hd-boton--claro du-boton-chico')}</div>
  ${boton({ accion: 'desde', valor: 'detalle', ir: 'u-cancelar', extra: ver('tActivo', true) }, esc(x.cancelar), 'hd-boton hd-boton--fantasma du-rojo')}
  ${boton({ ir: 'u-chat', extra: ver('tChatSolo', false) }, `${icono('chat')}${esc(x.chatear)}`, 'hd-boton hd-boton--claro')}
  ${boton({ accion: 'pagar', guia: true, extra: `data-du-guia="origenTurnos" ${ver('tPorPagar', false)}` }, tpl(x.pagar), 'hd-boton hd-boton--exito')}
  ${boton({ accion: 'ver-pago', ir: 'u-pagos', guia: true, extra: `data-du-guia="origenTurnos" ${ver('tPagado', condIni.pagoHecho)}` }, `${icono('billetera')}${esc(x.verPago)}`, 'hd-boton')}`, 'du-pie--detalle')}`),
  );
}

function cambiar(): PantallaDemo {
  const c = d.cambiar;
  return pantalla(
    'u-cambiar',
    `${tituloHoja(c.titulo)}
<section class="du-bloque" ${E}>${sobre(c.dia)}<div class="hd-chips hd-chips--carril du-dias du-dias--hoja">${carrilDias('cambio-dia', 'cambioDia', cambioDiaIni, 1)}</div></section>
<section class="du-bloque" ${E}>${sobre(c.franja)}<div class="hd-mosaicos du-franjas">${mosaicosFranjas('cambio-franja', 'cambioFranja', turnoIni.franja)}</div></section>
${boton({ accion: 'pedir-cambio', volver: true, extra: E }, esc(c.pedir), 'hd-boton')}
<p class="du-hoja-nota" ${E}>${icono('info')}<span>${esc(c.nota)}</span></p>`,
    'hoja',
  );
}

function cancelar(): PantallaDemo {
  const c = d.cancelar;
  return pantalla(
    'u-cancelar',
    `${tituloHoja(c.titulo)}
<div class="du-cancelar">
  ${img('handy-cano-roto', 354, 405, 'hd-handy du-cancelar__handy')}
  ${tpl(c.texto, 'p', 'hd-texto du-cancelar__texto')}
  <div class="hd-botones">
    ${boton({ accion: 'cancelar-turno', volver: true }, esc(c.si), 'hd-boton hd-boton--peligro')}
    ${boton({ volver: true }, esc(c.no), 'hd-boton hd-boton--claro')}
  </div>
</div>`,
    'hoja',
  );
}

function mensajes(): PantallaDemo {
  const x = d.mensajes;
  const filas = x.items
    .map((it) => {
      const av =
        it.icono === 'lamparita'
          ? `<span class="du-ia-avatar" aria-hidden="true">${lamparita()}</span>`
          : it.ir === 'u-chat'
            ? avatarEsp('esp')
            : `<span class="hd-avatar du-avatar-icono" aria-hidden="true">${icono(it.icono)}</span>`;
      // La insignia del chat con el especialista se va cuando se lee.
      const badge = 'badge' in it && it.badge ? `<span class="du-badge" ${ver('!chatLeido', true)}>${esc(it.badge)}</span>` : '';
      return boton(
        { ir: it.ir, extra: E },
        `${av}<span class="hd-fila__texto">${tpl(it.nombre, 'strong')}${tpl(it.ultimo, 'small')}</span><span class="hd-fila__fin">${badge}${icono('derecha')}</span>`,
        'hd-fila du-chat-fila',
      );
    })
    .join('');
  return pantalla(
    'u-mensajes',
    app(`${cabecera('azul')}
<div class="du-cuerpo hd-scroll du-mensajes">
  <div ${E}>${tituloMarcado(x.titulo, 'hd-titulo du-mensajes__titulo', 'h2')}</div>
  <div class="hd-lista du-chats">${filas}</div>
  <div class="hd-tarjeta hd-tarjeta--gris du-mensajes__nota" ${E}>${lamparita('hd-handy du-mensajes__handy')}<p>${icono('escudo')}<span>${esc(x.nota)}</span></p></div>
</div>
${navDemo('usuario', 2)}`),
  );
}

function filasLista(lista: { texto: string; icono: string; ir?: string; raiz?: string }[]): string {
  return lista
    .map((x) =>
      boton({ ir: x.ir, raiz: x.raiz }, `<span class="hd-fila__ico">${icono(x.icono)}</span><span class="hd-fila__texto"><strong>${esc(x.texto)}</strong></span><span class="hd-fila__fin">${icono('derecha')}</span>`, 'hd-fila'),
    )
    .join('');
}

function cuenta(): PantallaDemo {
  const c = d.cuenta;
  return pantalla(
    'u-cuenta',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-cuenta">
  <div class="du-yo" ${E}>
    <span class="du-yo__avatar">${`<span class="hd-avatar hd-avatar--grande" aria-hidden="true"><span>${esc(c.iniciales)}</span></span>`}${boton({ accion: 'aviso', etiqueta: c.fotoAria }, icono('camara'), 'du-yo__camara')}</span>
    <span class="du-yo__textos"><strong class="hd-titulo hd-titulo--chico">${esc(c.nombre)}</strong><span class="hd-chip hd-chip--tinte hd-chip--mini">${icono('pin')}${esc(c.zona)}</span></span>
  </div>
  ${boton(
    { extra: `data-demo-cambiar-rol="especialista" ${E}` },
    `${img('handy-llave', 581, 547, 'hd-handy du-modo__handy')}<span class="du-modo__textos"><strong>${esc(c.modo.texto)}</strong><small>${esc(c.modo.detalle)}</small></span><span class="du-modo__flecha">${icono('flecha')}</span>`,
    'hd-tarjeta hd-tarjeta--amarillo du-modo',
  )}
  <section class="du-bloque" ${E}>${sobre(c.cuenta)}<div class="hd-tarjeta hd-tarjeta--gris hd-tarjeta--compacta hd-lista">${filasLista(c.filasCuenta)}</div></section>
  <section class="du-bloque" ${E}>${sobre(c.configuracion)}<div class="hd-tarjeta hd-tarjeta--gris hd-tarjeta--compacta hd-lista">${filasLista(c.filasConfiguracion)}</div></section>
  ${salirDeLaDemo()}
  ${boton({ accion: 'aviso', extra: E }, `${icono('salir')}${esc(c.cerrarSesion)}`, 'hd-boton hd-boton--fantasma du-rojo')}
</div>
${navDemo('usuario', 3)}`),
  );
}

function datos(): PantallaDemo {
  const x = d.datos;
  return pantalla(
    'u-datos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-datos">
  ${barra(T['u-datos'])}
  <div class="du-yo du-yo--centro" ${E}><span class="hd-avatar hd-avatar--grande" aria-hidden="true"><span>${esc(x.iniciales)}</span></span></div>
  <div class="hd-tarjeta hd-tarjeta--gris hd-tarjeta--compacta hd-lista" ${E}>${x.campos
    .map((c) => `<div class="hd-fila"><span class="hd-fila__texto"><small>${esc(c.label)}</small><strong>${esc(c.valor)}</strong></span></div>`)
    .join('')}</div>
  <p class="du-nota" ${E}>${icono('escudo')}<span>${esc(x.nota)}</span></p>
</div>
${pie(boton({ accion: 'aviso' }, `${icono('editar')}${esc(x.editar)}`, 'hd-boton'))}`),
  );
}

function pagos(): PantallaDemo {
  const g = d.pagos;
  const tj = g.tarjeta;
  const mov = (i: number, cuerpo: string, desglose: string, extra = '') =>
    `<div class="du-tarjeta du-mov-tarjeta"${extra ? ' ' + extra : ''} ${E}><div class="du-tarjeta__cuerpo">${cuerpo}</div>
    <div class="du-mov" data-du-mov="${i}"${i === 0 ? '' : ' hidden'}>${desglose}</div>
    ${boton(
      { accion: 'mov', valor: String(i), extra: `aria-expanded="${i === 0}"` },
      `<span data-du-mas${i === 0 ? ' hidden' : ''}>${esc(d.comun.verMas)}</span><span data-du-menos${i === 0 ? '' : ' hidden'}>${esc(g.verMenos)}</span>${icono('abajo')}`,
      'du-tarjeta__franja du-tarjeta__franja--plegable',
    )}</div>`;
  // El pago del turno del recorrido aparece solo si de verdad se pagó.
  const flujo = mov(
    0,
    `<span class="du-tarjeta__ico du-tarjeta__ico--azul">${iconoRubro()}</span>
     <span class="du-tarjeta__datos">${tpl(g.pagaste, 'strong')}${tpl('{fecha}', 'small')}</span>
     <span class="du-tarjeta__der">${tpl(menos('{total}'), 'strong', 'hd-precio hd-negativo')}<small>${esc(g.medio)}</small></span>`,
    `${dato(tpl(g.alEspecialista), tpl('{precio}'))}${dato(tpl(g.tarifa), tpl('{tarifa}'))}`,
    ver('pagoHecho', condIni.pagoHecho),
  );
  const otros = pasados
    .map((x, i) => {
      const vars = { rubro: rubro(x.rubro).nombre, esp: x.especialista };
      return mov(
        i + 1,
        `<span class="du-tarjeta__ico du-tarjeta__ico--${x.estilo}">${icono(rubro(x.rubro).icono)}</span>
         <span class="du-tarjeta__datos"><strong>${esc(completar(g.pagaste, vars))}</strong><small>${esc(x.fecha)}</small></span>
         <span class="du-tarjeta__der"><strong class="hd-precio hd-negativo">${esc(menos(formatoPesos(totalDe(x.precio))))}</strong><small>${esc(g.medio)}</small></span>`,
        `${dato(esc(completar(g.alEspecialista, vars)), `<span>${esc(formatoPesos(x.precio))}</span>`)}${dato(esc(completar(g.tarifa, vars)), `<span>${esc(formatoPesos(tarifaDe(x.precio)))}</span>`)}`,
      );
    })
    .join('');
  return pantalla(
    'u-pagos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo du-cuerpo--ajustado du-pagos-pantalla">
  ${barra(T['u-pagos'], { extra: boton({ accion: 'aviso', etiqueta: g.agregar }, icono('mas'), 'hd-circulo du-pagos__mas') })}
  <div class="du-banco" ${POP}>
    <span class="du-banco__tipo">${esc(tj.tipo)}</span>
    <span class="du-banco__chip" aria-hidden="true"></span>
    <span class="du-banco__numero">${esc(tj.numero)}</span>
    <span class="du-banco__pie"><span>${esc(tj.titular)}</span><span>${esc(tj.vence)}</span></span>
  </div>
</div>
${hojaAzul(esc(g.panel), `<div class="hd-scroll du-lista">${flujo}${otros}</div>`, 'du-hoja-azul--llena')}`),
  );
}

function ayuda(): PantallaDemo {
  const a = d.ayuda;
  return pantalla(
    'u-ayuda',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-ayuda">
  ${barra(T['u-ayuda'], { sub: `<small>${esc(a.subtitulo)}</small>` })}
  <div class="du-pastillas">${a.preguntas
    .map((q, i) => boton({ accion: 'pregunta', valor: String(i), ir: 'u-ayuda-detalle', extra: E }, `<span>${esc(q.pregunta)}</span>${icono('derecha')}`, 'du-pastilla'))
    .join('')}</div>
  <div class="du-ayuda__pie" ${E}>
    ${lamparita('hd-handy du-ayuda__handy')}
    <p class="du-separador"><span>${esc(a.otra)}</span></p>
    ${boton({ ir: 'u-soporte' }, `${icono('chat')}${esc(a.chatear)}`, 'hd-boton hd-boton--blanco du-boton-borde')}
  </div>
</div>`),
  );
}

function ayudaDetalle(): PantallaDemo {
  const a = d.ayuda;
  const respuestas = a.preguntas
    .map((q, i) => {
      let accion = '';
      if ('raiz' in q && q.raiz) accion = boton({ raiz: q.raiz }, `${esc(q.boton)}${icono('flecha')}`, 'hd-boton hd-boton--blanco du-boton-borde');
      else if ('ir' in q && q.ir) accion = boton({ ir: q.ir }, `${esc(q.boton)}${icono('flecha')}`, 'hd-boton hd-boton--blanco du-boton-borde');
      return `<div class="du-respuesta" ${ver(`resp${i}`, i === 0)} ${E}><p class="du-respuesta__pregunta">${icono('pregunta')}<span>${esc(q.pregunta)}</span></p><div class="du-respuesta__cuerpo"><p>${esc(rellenar(q.respuesta))}</p>${accion}</div></div>`;
    })
    .join('');
  return pantalla(
    'u-ayuda-detalle',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-ayuda">
  ${barra(T['u-ayuda-detalle'])}
  ${respuestas}
  <div class="du-sirvio" ${E}>
    <p class="hd-sobre">${esc(a.sirvio)}</p>
    <div class="du-sirvio__botones" ${ver('!sirvio', true)}>${boton({ accion: 'sirvio' }, esc(a.no), 'hd-boton hd-boton--chico hd-boton--peligro')}${boton(
      { accion: 'sirvio' },
      esc(a.si),
      'hd-boton hd-boton--chico hd-boton--exito',
    )}</div>
    <p class="hd-chip hd-chip--exito du-sirvio__gracias" ${ver('sirvio', false)}>${icono('check')}${esc(a.gracias)}</p>
  </div>
  <section class="du-bloque du-otras" ${E}>
    ${sobre(a.otras)}
    ${a.preguntas.map((q, i) => boton({ accion: 'pregunta', valor: String(i), extra: ver(`!resp${i}`, i !== 0) }, `<span>${esc(q.pregunta)}</span>${icono('derecha')}`, 'du-pastilla du-pastilla--chica')).join('')}
  </section>
</div>`),
  );
}

function soporte(): PantallaDemo {
  const s = d.soporte;
  return pantalla(
    'u-soporte',
    app(`${cabecera('blanca', false)}
${chat({
  id: 'u-soporte',
  cabecera: chatCabecera('x', `<span class="hd-avatar du-avatar-icono" aria-hidden="true">${icono('chat')}</span>`, s.nombre, s.subtitulo),
  bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ico">${icono('chat')}</span><small>${esc(s.bienvenida)}</small></div>`,
  inicial: s.inicial,
  etapas: s.etapas,
  input: s.input,
})}`, 'du-chat-pantalla'),
  );
}

function notificaciones(): PantallaDemo {
  const n = d.notificaciones;
  const avisos = n.avisos
    .map((a, i) => {
      const si = 'si' in a ? a.si : undefined;
      if (si !== undefined && !(si in condIni)) throw new Error(`Demo usuario: condición desconocida "${si}" en un aviso`);
      return `<div class="du-aviso-card du-aviso-card--${a.estilo}" ${ver(`aviso${i}`, si === undefined || condIni[si])} ${E}><span class="du-aviso-card__ico">${icono(a.icono)}</span>${tpl(
        a.texto,
        'span',
        'du-aviso-card__texto',
      )}${boton({ accion: 'aviso-borrar', valor: String(i), etiqueta: n.borrarAria }, icono('cerrar'), 'du-aviso-card__x')}</div>`;
    })
    .join('');
  return pantalla(
    'u-notificaciones',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-avisos">
  ${barra(T['u-notificaciones'])}
  ${boton({ accion: 'avisos-borrar', extra: `${ver('!avisosVacio', true)} ${E}` }, `${icono('tacho')}${esc(n.borrar)}`, 'hd-chip du-borrar')}
  <div class="du-avisos__lista">${avisos}</div>
  <p class="du-avisos__fin" ${ver('!avisosVacio', true)}>${esc(n.vacio)}</p>
  <div class="du-vacio" ${ver('avisosVacio', false)}>${lamparita('hd-handy du-vacio__handy')}<p class="hd-titulo hd-titulo--chico">${esc(n.vacioTitulo)}</p><p class="hd-texto hd-texto--suave">${esc(n.vacioTodo)}</p></div>
</div>
${navDemo('usuario', -1)}`),
  );
}

const CONSTRUCTORES: [keyof typeof T, () => PantallaDemo][] = [
  ['u-inicio', inicio],
  ['u-opciones', opciones],
  ['u-programar', programar],
  ['u-describir', describir],
  ['u-buscando', buscando],
  ['u-presupuestos', presupuestos],
  ['u-perfil', perfil],
  ['u-confirmar', confirmar],
  ['u-seguimiento', seguimiento],
  ['u-chat', chatEspecialista],
  ['u-terminado', terminado],
  ['u-resena', resena],
  ['u-handia', handia],
  ['u-turnos', turnos],
  ['u-turno-detalle', turnoDetalle],
  ['u-cambiar', cambiar],
  ['u-cancelar', cancelar],
  ['u-mensajes', mensajes],
  ['u-cuenta', cuenta],
  ['u-datos', datos],
  ['u-pagos', pagos],
  ['u-ayuda', ayuda],
  ['u-ayuda-detalle', ayudaDetalle],
  ['u-soporte', soporte],
  ['u-notificaciones', notificaciones],
];

export function demoUsuario(): DemoRol {
  const pantallas = CONSTRUCTORES.map(([id, construir]) => {
    // Cada pantalla se arma con los valores de su contexto (pedido, turno o HandIA).
    CTX = contextoDe(id);
    V = VALORES[CTX];
    const p = construir();
    if (p.id !== id) throw new Error(`Demo usuario: la pantalla "${p.id}" está anotada como "${id}"`);
    return p;
  });
  CTX = 'pedido';
  V = VALORES.pedido;
  return { inicio: 'u-inicio', pantallas, recorrido: d.recorrido };
}
