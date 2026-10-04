// Demo · lado del usuario. Pantallas navegables de la app (se arman en build, como el resto del sitio).
// Diseño: kit .hd-* (src/styles/demo-app.css) + lo propio en src/styles/demo-usuario.css (.du-*).
// Piezas comunes a los dos roles (src/render/demo/comunes.ts): cabeceraChat, accionesChat, agenda y pantallasComunes.
//
// Lo que cambia según lo que se elige (rubro, día, propuesta, trabajo…) se marca con atributos que
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
//
// Contextos (demo-usuario.json → contextos): las pantallas del pedido muestran el pedido en curso y la propuesta
// elegida; las demás, el trabajo confirmado en el recorrido (y «Tu turno», el trabajo que se abrió). Toda la plata
// sale de src/demo/dinero.ts (desglose / propuestaAdicional): el mismo total en la lista, el perfil, la confirmación,
// el seguimiento, el trabajo terminado y los pagos. El HTML sale con el estado inicial, así que sin JS se ve igual.

import d from '../../content/demo-usuario.json' with { type: 'json' };
import demo from '../../content/demo.json' with { type: 'json' };
import rubrosJson from '../../content/rubros.json' with { type: 'json' };
import tarifas from '../../content/tarifas.json' with { type: 'json' };
import { icono } from '../iconos.ts';
import { esc, formatoPesos, variables } from '../util.ts';
import { avatar, boton, cabeceraDemo, iniciales, navDemo, salirDeLaDemo, tildeExito, tituloHoja, tituloMarcado, type Toque } from './piezas.ts';
import { accionesChat, agenda, cabeceraChat, pantallasComunes, type ContactoDemo } from './comunes.ts';
import { mapaVivo } from './mapa.ts';
import { desglose, propuestaAdicional, type Concepto, type Desglose, type Tarifas } from '../../demo/dinero.ts';
import { fechaCorta, fechaLarga, partes } from '../../demo/fechas.ts';
import type { DemoRol, PantallaDemo } from './tipos.ts';

// ── Datos ─────────────────────────────────────────────────────────────────

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
const fixtures = d.agenda.trabajos;
const f = d.formatos;
const T = d.titulos;
const $ = d.dinero;
const TARIFAS: Tarifas = { cliente: tarifas.normal.cliente, especialista: tarifas.normal.especialista };

// Validaciones de los datos (el build falla si algo no cierra).
if (d.programar.momentos.length !== franjas.length) throw new Error('Demo usuario: programar.momentos tiene que tener uno por franja');
if (items[0].manoDeObra + items[0].materiales !== tarifas.ejemplo.presupuesto) {
  throw new Error('Demo usuario: mano de obra + materiales de Especialista 1 tiene que ser el ejemplo de tarifas.json (el mismo pedido que ve el especialista)');
}
items.forEach((it) => {
  const { franja, urgencia } = it.propone;
  if ((franja !== null && !franjas[franja]) || !franjas[urgencia]) throw new Error(`Demo usuario: "${it.nombre}" propone una franja que no existe`);
  if (!(it.chat in T)) throw new Error(`Demo usuario: el chat "${it.chat}" de ${it.nombre} no es una pantalla`);
});
dias.forEach((x) => {
  const { dia } = partes(x.iso);
  if (dia !== x.num) throw new Error(`Demo usuario: el día ${x.rueda} no coincide con ${x.iso}`);
});
fixtures.forEach((x) => {
  rubro(x.rubro);
  if (!items[x.esp]) throw new Error(`Demo usuario: el trabajo ${x.id} usa un especialista que no existe`);
  partes(x.fecha);
});
for (const t of [...d.inicio.tareas, ...d.inicio.mas]) if (t.rubro) rubro(t.rubro);
if (d.contextos && Object.keys(d.contextos).some((id) => !(id in T))) throw new Error('Demo usuario: contextos menciona una pantalla que no existe');

const precio = (i: number): Desglose => desglose({ manoDeObra: items[i].manoDeObra, materiales: items[i].materiales }, TARIFAS);
const precioFixture = (x: (typeof fixtures)[number]): Desglose => desglose({ manoDeObra: x.manoDeObra, materiales: x.materiales }, TARIFAS);
const conceptoAdicional: Concepto = {
  tipo: d.seguimiento.adicional.tipo as Concepto['tipo'],
  descripcion: d.seguimiento.adicional.concepto,
  monto: d.seguimiento.adicional.monto,
};

/** Reemplaza {clave} con los valores dados; las variables globales ({tarifaCliente}…) también valen. */
function completar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k in vars) return vars[k];
    if (k in variables) return variables[k];
    throw new Error(`Demo usuario: variable sin definir ${m} (en "${texto}")`);
  });
}

/** Día a partir de la fecha: los del carril tienen su texto; los demás salen de fechas.ts. Igual que en el navegador. */
function diaInfo(iso: string) {
  const chip = dias.find((x) => x.iso === iso);
  if (chip) return chip;
  const p = partes(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return { largo: fechaLarga(iso), corto: fechaCorta(iso), fecha: `${dos(p.dia)}/${dos(p.mes)}/${p.anio}`, iso };
}

/** Horario que propone cada especialista para el pedido inicial (una urgencia: hoy, en su franja). */
const horarioIni = (i: number) => completar(f.cuando, { diaCorto: dias[0].corto, franja: franjas[items[i].propone.urgencia] });

// Estado inicial: el pedido del recorrido (todavía sin confirmar) y el próximo turno de la agenda.
const pres = ini.presupuesto;
const proximo = fixtures.find((x) => x.estado === 'confirmado' && x.fecha >= demo.config.hoy)!;

const plata = (p: Desglose, pre = '') => ({
  [`${pre}mano`]: formatoPesos(p.manoDeObra),
  [`${pre}materiales`]: formatoPesos(p.materiales),
  [`${pre}subtotal`]: formatoPesos(p.subtotal),
  [`${pre}tarifa`]: formatoPesos(p.tarifaCliente),
  [`${pre}total`]: formatoPesos(p.totalCliente),
});

function valoresPedido(): Record<string, string> {
  const r = rubro(ini.rubro);
  const it = items[pres];
  const v: Record<string, string> = {
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[ini.tipo].texto,
    dia: dias[0].largo,
    diaCorto: dias[0].corto,
    fecha: dias[0].fecha,
    franja: d.urgencia.franja,
    problema: d.problemas[ini.rubro as keyof typeof d.problemas],
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    declaro: it.declaro,
    otro: it.rubros.find((o) => o !== r.nombre) ?? '',
    trabajo: it.trabajo,
    ...plata(precio(pres)),
    horarioEsp: horarioIni(pres),
    propDia: dias[0].largo,
    propFranja: franjas[it.propone.urgencia],
    progFecha: '',
    progHora: '',
    historialN: completar(d.historial.cantidad, { n: String(it.historial.length) }),
  };
  items.forEach((_, i) => {
    v[`horario${i}`] = horarioIni(i);
    v[`prop${i}`] = '';
  });
  return v;
}

function valoresTrabajo(): Record<string, string> {
  const r = rubro(ini.rubro);
  const it = items[pres];
  const p = precio(pres);
  const ad = propuestaAdicional({ manoDeObra: p.manoDeObra, materiales: p.materiales }, TARIFAS, [], conceptoAdicional);
  const cuando = completar(f.cuando, { diaCorto: dias[0].corto, franja: franjas[it.propone.urgencia] });
  const px = proximo;
  const pxEsp = items[px.esp];
  const pxDia = diaInfo(px.fecha);
  const tp = precioFixture(px);
  const v: Record<string, string> = {
    rubro: r.nombre,
    rubroCorto: r.corto ?? r.nombre,
    tipo: d.opciones.items[ini.tipo].texto,
    dia: dias[0].largo,
    diaCorto: dias[0].corto,
    fecha: dias[0].fecha,
    franja: franjas[it.propone.urgencia],
    cuando,
    problema: d.problemas[ini.rubro as keyof typeof d.problemas],
    esp: it.nombre,
    espIni: iniciales(it.nombre),
    zona: it.zona,
    trabajo: it.trabajo,
    ...plata(p),
    adicional: formatoPesos(0),
    resta: formatoPesos(p.totalCliente),
    estado: d.agenda.estados.confirmado,
    segTitulo: completar(d.seguimiento.titulos.confirmado, { esp: it.nombre }),
    segEstado: d.seguimiento.etapas[0],
    ubicacion: d.seguimiento.ubicacion.confirmado,
    adConcepto: conceptoAdicional.descripcion,
    adMonto: formatoPesos(conceptoAdicional.monto),
    adTarifa: formatoPesos(ad.tarifaCliente),
    adAntes: formatoPesos(ad.totalAntes),
    adDespues: formatoPesos(ad.totalDespues),
    pxEsp: pxEsp.nombre,
    pxEspIni: iniciales(pxEsp.nombre),
    pxRubro: rubro(px.rubro).nombre,
    pxCuando: completar(f.cuando, { diaCorto: pxDia.corto, franja: px.franja }),
    pxEstado: d.agenda.estados.confirmado,
    tRubro: rubro(px.rubro).nombre,
    tTipo: px.tipo,
    tDia: pxDia.largo,
    tFecha: pxDia.fecha,
    tFranja: px.franja,
    tCuando: completar(f.cuando, { diaCorto: pxDia.corto, franja: px.franja }),
    tEsp: pxEsp.nombre,
    tEspIni: iniciales(pxEsp.nombre),
    tTrabajo: px.trabajo,
    ...plata(tp, 't'),
    tAdicional: formatoPesos(0),
    tResta: formatoPesos(0),
    tEstado: d.agenda.estados.confirmado,
    tCambio: '',
    cambioTexto: '',
    pagado: formatoPesos(0),
    tarjetaUltimos: '',
    tarjetaNombre: '',
    tarjetaVence: '',
  };
  for (const k of ['mano', 'materiales', 'subtotal', 'tarifa', 'total']) v[`t${k.charAt(0).toUpperCase()}${k.slice(1)}`] = v[`t${k}`];
  return v;
}

const VALORES: Record<'pedido' | 'turno' | 'ia', Record<string, string>> = {
  pedido: valoresPedido(),
  turno: valoresTrabajo(),
  ia: valoresPedido(),
};
type Contexto = keyof typeof VALORES;
const CONTEXTOS = d.contextos as Record<string, Contexto>;
const contextoDe = (id: string): Contexto => CONTEXTOS[id] ?? 'turno';

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

const iconoRubro = (clave = 'rubro', id = ini.rubro, clase = 'du-ico') => `<span class="${clase}" data-du-icono="${clave}">${icono(rubro(id).icono)}</span>`;

/** Atributo de visibilidad + hidden si arranca oculto. */
const ver = (cond: string, visible: boolean) => `data-du-ver="${cond}"${visible ? '' : ' hidden'}`;

const img = (nombre: string, w: number, h: number, clase = '') =>
  `<img${clase ? ` class="${clase}"` : ''} src="/src/img/${nombre}.webp" alt="" width="${w}" height="${h}" decoding="async" />`;
const lamparita = (clase = '') => img('handy-lamparita', 202, 346, clase);

const app = (contenido: string, clase = '', extra = '') => `<div class="app du-app${clase ? ' ' + clase : ''}"${extra ? ' ' + extra : ''}>${contenido}</div>`;
const pantalla = (id: keyof typeof T, html: string, tipo: 'pantalla' | 'hoja' = 'pantalla'): PantallaDemo => ({ id, titulo: T[id], tipo, html });

const E = 'data-entra';
const POP = 'data-entra="pop"';
const sobre = (texto: string, extra = '') => `<p class="hd-sobre du-sobre"${extra ? ' ' + extra : ''}>${esc(texto)}</p>`;
const menos = (m: string) => completar(f.menos, { monto: m });
const dato = (izq: string, der: string, clase = '', extra = '') => `<div class="hd-dato${clase ? ' ' + clase : ''}"${extra ? ' ' + extra : ''}><span>${izq}</span>${der}</div>`;

// ── Piezas propias ─────────────────────────────────────────────────────────

/** Cabecera con la campana (con la insignia de avisos sin leer) y el pin de la dirección. */
function cabecera(variante: 'blanca' | 'azul', conPin = true): string {
  const pin: Toque | false = conPin ? { accion: 'aviso', valor: 'ubicacion', etiqueta: d.comun.ubicacionAria } : false;
  const html = cabeceraDemo('usuario', variante, pin);
  const campana = `${icono('campana')}</button>`;
  const i = html.indexOf(campana);
  if (i < 0) throw new Error('Demo usuario: no encontré la campana de la cabecera');
  const n = d.notificaciones.avisos.filter((a) => !('si' in a)).length;
  const insignia = `<span class="hd-insignia" data-du-insignia ${ver('!avisosVacio', n > 0)}>${n}</span>`;
  return html.slice(0, i) + icono('campana') + insignia + html.slice(i + icono('campana').length);
}

/** Fila "← Título" de las pantallas internas. `flecha`: otro botón para volver. */
function barra(titulo: string, o: { sub?: string; extra?: string; flecha?: string } = {}): string {
  const flecha = o.flecha ?? boton({ volver: true, etiqueta: demo.ui.volver }, icono('atras'), 'du-atras');
  return `<div class="du-barra" ${E}>${flecha}<span class="du-barra__textos"><strong>${esc(titulo)}</strong>${o.sub ?? ''}</span>${o.extra ?? ''}</div>`;
}

/** Avatar de un especialista dinámico (iniciales y color cambian en el navegador). */
function avatarEsp(clave: 'esp' | 'tEsp' | 'pxEsp', tamano?: 'chico' | 'grande', clase = ''): string {
  const idx = clave === 'tEsp' || clave === 'pxEsp' ? proximo.esp : pres;
  const c = ['hd-avatar', 'hd-avatar--verificado', `du-tono-${idx}`];
  if (tamano) c.push(`hd-avatar--${tamano}`);
  if (clase) c.push(clase);
  return `<span class="${c.join(' ')}" data-du-tono="${clave}" aria-hidden="true">${tpl(`{${clave}Ini}`)}</span>`;
}

/** Avatar fijo de un especialista de los datos. */
const avatarFijo = (i: number, tamano?: 'chico' | 'grande') => avatar(items[i].nombre, { verificado: true, tamano, clase: `du-tono-${i}` });

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

type IdChat = 'u-chat' | 'u-chat2' | 'u-chat3' | 'u-handia' | 'u-soporte';

/** Compositor: adjuntar foto, campo y enviar (el avión manda la primera respuesta rápida). */
const entrada = (id: IdChat, texto: string, foto: boolean) =>
  `<div class="du-escribir">${
    foto ? boton({ accion: 'adjuntar', valor: id, etiqueta: d.comun.adjuntarAria }, icono('camara'), 'du-escribir__adjuntar') : ''
  }<span class="du-escribir__campo">${esc(texto)}</span>${boton({ accion: 'enviar', valor: id, etiqueta: d.comun.enviarAria }, icono('enviar'), 'du-escribir__enviar')}</div>`;

/** Pantalla de chat: cabecera común (sin logo ni campana), mensajes, acciones y compositor. */
function chat(o: {
  id: IdChat;
  cabecera: string;
  bienvenida: string;
  inicial: { de: string; texto: string; foto?: boolean }[];
  etapas: { rapidas: { texto: string }[] }[];
  final?: string;
  acciones?: string;
  input: string;
  guiaRapidas?: boolean;
  foto?: boolean;
  clase?: string;
  /** HTML extra dentro del chat (moldes). */
  extra?: string;
}): string {
  const rapidas = o.etapas
    .map(
      (e, n) =>
        `<div class="hd-chips hd-chips--carril du-rapidas" ${ver(`chat:${o.id}:${n}`, n === 0)}>${e.rapidas
          .map((r, i) => boton({ accion: 'chat', valor: `${o.id}:${n}:${i}`, guia: o.guiaRapidas !== false && i === 0 }, esc(r.texto), 'hd-chip hd-chip--tinte du-rapida'))
          .join('')}</div>`,
    )
    .join('');
  const final = o.final ? `<div class="du-rapidas du-rapidas--final" ${ver(`final:${o.id}`, false)}>${o.final}</div>` : '';
  return app(
    `${o.cabecera}
<div class="du-chat" data-du-chat="${o.id}">
  <div class="du-chat__mensajes hd-scroll" role="log" aria-live="polite" aria-label="${esc(T[o.id])}" data-du-mensajes><div class="du-chat__espacio"></div>${o.bienvenida}${o.inicial.map(burbuja).join('')}</div>
  <div class="du-chat__pie">${o.acciones ?? ''}${rapidas}${final}${entrada(o.id, o.input, o.foto !== false)}</div>
  <template data-du-foto>${foto('du-ilus--chat')}</template>${o.extra ?? ''}
</div>`,
    `du-chat-pantalla${o.clase ? ' ' + o.clase : ''}`,
  );
}

/** Tarjeta con franja gris (la "Ver más información" de la app). */
const tarjetaFranja = (cuerpo: string, franja: string, extra = '') =>
  `<div class="du-tarjeta"${extra ? ' ' + extra : ''}><div class="du-tarjeta__cuerpo">${cuerpo}</div>${franja}</div>`;

/** Hoja azul con manija (como "Tus turnos" / "Tus movimientos"). */
const hojaAzul = (titulo: string, contenido: string, clase = '') =>
  `<div class="hd-hoja-azul du-hoja-azul${clase ? ' ' + clase : ''}"><span class="du-manija" aria-hidden="true"></span><p class="du-hoja-azul__titulo">${titulo}</p>${contenido}</div>`;

/** Pie fijo con el botón principal. */
const pie = (contenido: string, clase = '') => `<div class="du-pie${clase ? ' ' + clase : ''}">${contenido}</div>`;

/** Desglose de la plata (dinero.ts): mano de obra, materiales, [adicional], subtotal, tarifa y total final. */
function lineasPlata(o: { pre?: string; conAdicional?: string; total?: string; claseTotal?: string } = {}): string {
  const p = o.pre ?? '';
  const k = (x: string) => (p ? `${p}${x.charAt(0).toUpperCase()}${x.slice(1)}` : x);
  return `${dato(esc($.mano), tpl(`{${k('mano')}}`))}
${dato(esc($.materiales), tpl(`{${k('materiales')}}`))}
${o.conAdicional ? dato(esc($.adicional), tpl(`{${k('adicional')}}`), 'du-dato-adicional', ver(o.conAdicional, false)) : ''}
${dato(esc($.subtotal), tpl(`{${k('subtotal')}}`), 'du-dato-sub')}
${dato(esc(rellenar($.tarifa)), tpl(`{${k('tarifa')}}`))}
${dato(esc($.total), o.total ?? tpl(`{${k('total')}}`, 'span', 'hd-precio'), `hd-dato--total${o.claseTotal ? ' ' + o.claseTotal : ''}`)}`;
}

// ── Inicio ────────────────────────────────────────────────────────────────

/** Tarjeta de prioridad: el trabajo en curso (si hay) o el próximo turno de la agenda (IMG_0183). */
function prioridad(): string {
  const p = d.inicio.proximo;
  const c = d.inicio.enCurso;
  const enCurso = `<div class="du-proximo" ${E} ${ver('hayEnCurso', false)}>
    ${sobre(c.sobre)}
    ${boton(
      { ir: 'u-seguimiento', etiqueta: c.aria, extra: 'data-du-guia="hayEnCurso"' },
      `<span class="hd-ticket__papel du-proximo__papel du-proximo__papel--vivo">
        <span class="du-proximo__arriba">${avatarEsp('esp')}<span class="du-proximo__quien">${tpl('{esp}', 'strong')}<small>${iconoRubro()}${tpl('{rubro}')}</small></span><span class="hd-chip hd-chip--azul hd-chip--mini hd-vivo">${tpl('{segEstado}')}</span></span>
        <span class="hd-ticket__corte"></span>
        <span class="du-proximo__abajo">${icono('reloj')}${tpl('{cuando}', 'strong')}<span class="du-proximo__ver">${esc(c.ver)}${icono('derecha')}</span></span>
      </span>`,
      'hd-ticket du-proximo__ticket',
    )}
  </div>`;
  const prox = `<div class="du-proximo" ${E} ${ver('!hayEnCurso', true)}>
    ${sobre(p.sobre)}
    ${boton(
      { accion: 'turno-proximo', ir: 'u-turno-detalle', etiqueta: p.ver },
      `<span class="hd-ticket__papel du-proximo__papel">
        <span class="du-proximo__arriba">${avatarEsp('pxEsp')}<span class="du-proximo__quien">${tpl('{pxEsp}', 'strong')}<small>${iconoRubro('pxRubro', proximo.rubro)}${tpl('{pxRubro}')}</small></span>${tpl('{pxEstado}', 'span', 'hd-chip hd-chip--exito hd-chip--mini', 'data-du-clase="pxCambio:hd-chip--amarillo"')}</span>
        <span class="hd-ticket__corte"></span>
        <span class="du-proximo__abajo">${icono('calendario')}${tpl('{pxCuando}', 'strong')}<span class="du-proximo__ver">${esc(p.ver)}${icono('derecha')}</span></span>
      </span>`,
      'hd-ticket du-proximo__ticket',
    )}
  </div>`;
  return enCurso + prox;
}

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
  const tarea = (t: { texto: string; icono: string; rubro: string | null }, valor: string) =>
    boton(
      t.rubro ? { accion: 'tarea', valor, ir: 'u-opciones' } : { accion: 'tarea-sin', valor, ir: 'u-sin-especialistas' },
      `<span class="du-quiero__ico">${icono(t.icono)}</span><span>${esc(t.texto)}</span>`,
      'hd-mosaico du-quiero',
    );
  const tareas = a.tareas.map((t, i) => tarea(t, `t${i}`)).join('');
  const mas = a.mas.map((t, i) => tarea(t, `m${i}`)).join('');
  return pantalla(
    'u-inicio',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-inicio">
  ${boton({ accion: 'aviso', valor: 'ubicacion', extra: E }, `${icono('pin')}<span>${esc(a.direccion)}</span>${icono('abajo')}`, 'hd-chip hd-chip--tinte du-direccion')}
  ${prioridad()}
  <div ${E}>${tituloMarcado(a.titulo, 'hd-titulo hd-titulo--grande du-inicio__titulo', 'h2')}</div>
  <div class="hd-mosaicos du-rubros" role="group" aria-label="${esc(a.rubrosAria)}">${rubros}</div>
  ${boton(
    { ir: 'u-handia', extra: E },
    `<span class="du-handia__luz" aria-hidden="true"><i></i>${lamparita('hd-handy du-handia__img')}</span><span class="du-handia__textos"><small>${esc(a.handia.titulo)}</small><strong>${esc(a.handia.texto)}</strong><span>${icono('chispas')}${esc(a.handia.detalle)}</span></span><span class="du-handia__flecha">${icono('flecha')}</span>`,
    'hd-tarjeta hd-tarjeta--azul du-handia',
  )}
  <div ${E}>${tituloMarcado(a.quieroTitulo, 'hd-titulo hd-titulo--chico hd-titulo--azul du-inicio__sub', 'h3')}</div>
  <div class="hd-mosaicos du-quieros" role="group" aria-label="${esc(a.quieroAria)}" ${E}>${tareas}</div>
  <div class="du-bloque" ${E}>
    ${sobre(a.masTitulo)}
    <div class="hd-mosaicos du-quieros" role="group" aria-label="${esc(a.masAria)}">${mas}</div>
    <p class="du-info">${icono('info')}<span>${esc(a.masNota)}</span></p>
  </div>
</div>
${navDemo('usuario', 0)}`),
  );
}

function sinEspecialistas(): PantallaDemo {
  const s = d.sinEspecialistas;
  return pantalla(
    'u-sin-especialistas',
    `${tituloHoja(T['u-sin-especialistas'])}
<div class="du-sin">
  ${img('handy-engranaje-roto', 300, 300, 'hd-handy du-sin__handy')}
  <p class="hd-titulo hd-titulo--chico du-centro" ${E}>${esc(s.titulo)}</p>
  ${tpl(s.texto, 'p', 'hd-texto du-centro', E)}
  <p class="du-hoja-nota" ${E}>${icono('info')}<span>${esc(s.nota)}</span></p>
  ${boton({ volver: true, extra: E }, esc(s.volver), 'hd-boton')}
</div>`,
    'hoja',
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
const carrilDias = (accion: string, grupo: string, elegido: number, desde = 0) =>
  dias
    .map((x, i) =>
      i < desde
        ? ''
        : boton(
            { accion, valor: String(i), etiqueta: x.largo, extra: `data-du-grupo="${grupo}" aria-pressed="${i === elegido}"` },
            `<small>${esc(x.rueda.split(' ')[0])}</small><strong>${x.num}</strong>`,
            'du-dia',
          ),
    )
    .join('');

/** Botón "Quiero elegir otra fecha / otro horario" y el pedido que quedó (la otra parte lo acepta o propone otro). */
const otraOpcion = (accion: string, texto: string, guia: string) =>
  boton({ accion, extra: `data-du-guia="${guia}"` }, `${icono(accion.includes('hora') ? 'reloj' : 'calendario')}<span>${esc(texto)}</span>${icono('derecha')}`, 'du-otra');

function programar(): PantallaDemo {
  const g = d.programar;
  return pantalla(
    'u-programar',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-programar">
  ${barra(g.titulo, { sub: `<small>${iconoRubro()}${tpl(f.rubroTipo)}</small>` })}
  <section class="du-bloque" ${E}>
    <div class="du-bloque__titulo">${sobre(g.dia)}<span class="hd-chip hd-chip--mini">${icono('calendario')}${esc(g.mes)}</span></div>
    <div class="hd-chips hd-chips--carril du-dias" role="group" aria-label="${esc(g.ruedaAria)}">${carrilDias('dia', 'dia', ini.dia)}</div>
    ${otraOpcion('prog-fecha', g.otraFecha, 'guiaOtraFecha')}
    <p class="du-pedis" ${ver('progFecha', false)}>${icono('calendario')}${tpl(g.pedisFecha, 'strong')}${boton({ accion: 'prog-quitar', valor: 'fecha', etiqueta: g.quitar }, icono('cerrar'), 'du-pedis__x')}</p>
  </section>
  <section class="du-bloque" ${E}>
    ${sobre(g.franja)}
    <div class="hd-mosaicos du-franjas" role="group" aria-label="${esc(g.franjasAria)}">${mosaicosFranjas('franja', 'franja', ini.franja)}</div>
    ${otraOpcion('prog-hora', g.otroHorario, 'guiaOtraHora')}
    <p class="du-pedis" ${ver('progHora', false)}>${icono('reloj')}${tpl(g.pedisHora, 'strong')}${boton({ accion: 'prog-quitar', valor: 'hora', etiqueta: g.quitar }, icono('cerrar'), 'du-pedis__x')}</p>
  </section>
  <p class="du-info" ${E}>${icono('info')}<span ${ver('!progPedido', true)}>${esc(g.info)}</span><span ${ver('progPedido', false)}>${esc(g.pedidoNota)}</span></p>
</div>
${pie(`<p class="du-resumen-linea">${icono('calendario')}<span>${esc(g.resumen)}</span>${tpl('{dia} · {franja}', 'strong')}</p>${boton({ ir: 'u-describir', extra: 'data-du-guia="guiaSiguiente"' }, `${esc(g.siguiente)}${icono('flecha')}`, 'hd-boton')}`)}`),
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
      ${boton({ accion: 'foto', guia: true, extra: `data-du-guia="fotoGuia" ${ver('puedeFoto', true)}` }, `${icono('camara')}<span>${esc(x.agregarFoto)}</span>`, 'du-foto du-foto--agregar')}
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
      <span class="du-llega__lleno">${avatarFijo(i, 'chico')}<small>${esc(it.nombre)}</small><strong class="hd-precio">${esc(formatoPesos(precio(i).totalCliente))}</strong></span>
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
    .map((it, i) => {
      const p = precio(i);
      const fila = (izq: string, der: string, clase = '') => `<div class="du-oferta__fila${clase ? ' ' + clase : ''}"><dt>${izq}</dt><dd>${der}</dd></div>`;
      const consultar =
        it.chat !== 'u-chat'
          ? boton({ ir: it.chat }, `${icono('chat')}<span>${esc(q.consultar)}</span>${icono('derecha')}`, 'du-oferta__consultar')
          : '';
      return `<article class="du-oferta${i === pres ? ' du-sel' : ''}" data-du-grupo="pres" data-valor="${i}" aria-label="${esc(it.nombre)}" ${E}>
      <div class="du-oferta__cabeza">${avatarFijo(i)}<span class="du-oferta__quien"><strong>${esc(it.nombre)}</strong><span class="du-oferta__chips">${verificado()}<small>${esc(it.rubros.join(' · '))}</small></span></span></div>
      <div class="du-oferta__cuerpo">
        <p class="du-oferta__sobre">${icono('llave')}${esc(q.sobre)}</p>
        <p class="du-oferta__trabajo"><small>${esc($.trabajo)}</small><strong>${esc(it.trabajo)}</strong></p>
        <dl class="du-oferta__plata">
          ${fila(esc($.mano), esc(formatoPesos(p.manoDeObra)))}
          ${fila(esc($.materiales), esc(formatoPesos(p.materiales)))}
          ${fila(esc($.subtotal), esc(formatoPesos(p.subtotal)), 'du-oferta__fila--sub')}
          ${fila(esc(rellenar($.tarifa)), esc(formatoPesos(p.tarifaCliente)))}
        </dl>
        <p class="du-oferta__total"><span>${esc($.total)}</span><strong class="hd-precio">${esc(formatoPesos(p.totalCliente))}</strong></p>
        <div class="du-oferta__cuando">
          <p>${icono('reloj')}<span><small>${esc(q.propone)}</small>${tpl(`{horario${i}}`, 'strong')}</span>${tpl(`{prop${i}}`, 'span', 'hd-chip hd-chip--mini du-oferta__acepta', `data-du-clase="acepta${i}:hd-chip--exito noAcepta${i}:hd-chip--amarillo" ${ver('esProgramado', false)}`)}</p>
          <p>${icono('reloj')}<span><small>${esc(q.vence)}</small><strong>${esc(it.vence)}</strong></span></p>
        </div>
        ${consultar}
      </div>
      <div class="du-oferta__franja">${boton({ accion: 'presupuesto', valor: String(i), ir: 'u-perfil', guia: i === pres }, esc(q.verPerfil), 'du-oferta__btn')}${boton(
        { accion: 'presupuesto', valor: String(i), ir: 'u-confirmar' },
        `${esc(q.elegir)}${icono('check')}`,
        'du-oferta__btn du-oferta__btn--azul',
      )}</div>
    </article>`;
    })
    .join('');
  return pantalla(
    'u-presupuestos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo du-cuerpo--ajustado">${barra(q.titulo, { sub: `<small>${iconoRubro()}${tpl(f.pedido)}</small>` })}</div>
${hojaAzul(
  `${esc(q.panel)}<span class="hd-chip hd-chip--claro hd-chip--mini">${esc(q.sub)}</span>`,
  `<div class="hd-scroll du-lista">${tarjetas}<p class="du-hoja-azul__nota du-hoja-azul__nota--fin">${icono('info')}${esc(rellenar(q.nota))}</p></div>`,
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
  ${boton(
    { ir: 'u-historial', extra: `data-du-guia="!historialVisto" ${E}` },
    `<span class="hd-fila__ico">${icono('calendario')}</span><span class="hd-fila__texto"><strong>${esc(x.historial)}</strong>${tpl('{historialN}', 'small')}</span><span class="hd-fila__fin">${icono('derecha')}</span>`,
    'hd-fila du-historial-btn',
  )}
  <div class="hd-ticket hd-ticket--azul du-precio" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-precio__arriba"><small class="hd-sobre">${esc($.total)}</small>${monto('total', 'hd-precio hd-precio--grande')}<small class="du-precio__sub">${tpl(`${$.subtotal} {subtotal} + ${rellenar($.tarifa)} {tarifa}`)}</small></div>
      <div class="hd-ticket__corte"></div>
      <p class="du-precio__abajo">${icono('calendario')}${tpl(x.propone)}</p>
    </div>
  </div>
</div>
${pie(`<p class="du-pie__nota">${icono('info')}${esc(x.nota)}</p>${boton({ ir: 'u-confirmar', extra: 'data-du-guia="historialVisto"' }, esc(x.elegir), 'hd-boton')}`)}`),
  );
}

function historial(): PantallaDemo {
  const h = d.historial;
  const listas = items
    .map(
      (it, i) => `<ul class="du-historial" ${ver(`esp${i}`, i === pres)} aria-label="${esc(it.nombre)}">${it.historial
        .map(
          (x) =>
            `<li class="du-historial__item" ${E}><span class="du-tarjeta__ico du-tarjeta__ico--azul">${icono(rubro(x.rubro).icono)}</span><span class="du-historial__textos"><small>${esc(rubro(x.rubro).nombre)}</small><strong>${esc(x.descripcion)}</strong></span><span class="du-historial__fecha">${esc(x.fecha)}</span></li>`,
        )
        .join('')}</ul>`,
    )
    .join('');
  return pantalla(
    'u-historial',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-historial-pantalla">
  ${barra(h.titulo, { sub: `<small>${tpl('{esp} · {historialN}')}</small>`, flecha: boton({ volver: true, etiqueta: demo.ui.volver, guia: true }, icono('atras'), 'du-atras') })}
  <p class="du-nota" ${E}>${icono('escudo')}<span>${esc(h.nota)}</span></p>
  ${listas}
</div>`),
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
        <p class="du-ticket__trabajo">${tpl('{trabajo}')}</p>
        <div class="du-ticket__grilla">
          <div class="du-ticket__dato">${icono('calendario')}<small>${esc(c.cuando)}</small>${tpl('{propDia}', 'strong')}${tpl('{propFranja}')}</div>
          <div class="du-ticket__dato">${icono('casa')}<small>${esc(c.donde)}</small><strong>${esc(d.describir.casa)}</strong><span>${esc(d.describir.calle)}</span></div>
        </div>
      </div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">${lineasPlata({ total: monto('total', 'hd-precio du-total') })}</div>
    </div>
  </div>
  <p class="du-nota" ${E}>${icono('billetera')}<span>${esc($.nota)}</span></p>
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
  const etapas = s.etapas.map((e, i) => `<span data-du-clase="segEtapa${i}:du-etapa--hecha segActual${i}:du-etapa--actual">${esc(e)}</span>`).join('');
  // La flecha lleva al inicio: el turno ya está confirmado, no se vuelve a "Confirmá el turno".
  return pantalla(
    'u-seguimiento',
    app(
      `${cabecera('azul', false)}
${zonaMapa(
  mapaVivo({ id: 'du-seg', ruta: true, especialista: V.espIni, viaje: 6.5 }),
  `${boton({ raiz: 'u-inicio', etiqueta: s.inicioAria }, icono('atras'), 'du-flotante')}<span class="hd-chip hd-chip--noche du-mapa-chip" ${POP}>${icono('reloj')}${tpl('{cuando}')}</span>`,
)}
<div class="hd-hoja-azul du-hoja-azul du-hoja-azul--mapa du-seg-hoja">
  <span class="du-manija" aria-hidden="true"></span>
  <div class="hd-scroll du-seg-scroll">
    <p class="du-seg-titulo" aria-live="polite">${tpl('{segTitulo}')}</p>
    <div class="hd-seguimiento du-barra-tramos" data-du-etapa="seg" data-etapa="1" aria-hidden="true"><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__tramo"></span><span class="hd-seguimiento__quien">${icono('caminar')}</span></div>
    <div class="du-etapas" aria-hidden="true">${etapas}</div>
    <p class="du-seg-ubicacion" data-du-clase="segEspera:du-seg-ubicacion--espera segLlego:du-seg-ubicacion--ok" role="status">${icono('pin')}${tpl('{ubicacion}')}</p>
    <div class="du-seg-horario">
      <span class="du-seg-horario__textos"><small>${esc(s.horarioLabel)}</small>${tpl('{cuando}', 'strong')}</span>
      ${boton({ accion: 'turno-seg', ir: 'u-turno-detalle', etiqueta: s.infoAria }, icono('info'), 'hd-circulo hd-circulo--claro')}
      ${boton({ accion: 'desde', valor: 'seg', ir: 'u-cancelar', etiqueta: s.cancelarAria, extra: ver('segAntes', true) }, icono('prohibido'), 'hd-circulo hd-circulo--rojo')}
    </div>
    <div class="du-seg-adicional" data-du-adicional ${ver('adicionalVisto', false)}><p class="du-seg-sobre">${esc(s.adicionalesLabel)}</p></div>
    ${boton(
      { accion: 'turno-seg', ir: 'u-turno-detalle' },
      `<span class="du-seg-precio__textos"><small>${esc(s.precioLabel)}</small>${monto('total', 'hd-precio du-seg-precio__monto')}</span><span class="du-seg-precio__ver">${esc(s.precioDetalle)}${icono('derecha')}</span>`,
      'du-seg-precio',
    )}
    <p class="du-hoja-azul__nota">${icono('escudo')}<span>${esc(s.privacidad)}</span></p>
  </div>
  <div class="du-seg-pie">${avatarEsp('esp', 'chico', 'du-avatar-blanco')}<span><small>${esc(s.especialistaLabel)}</small>${tpl('{esp}', 'strong')}</span>${boton(
    { ir: 'u-chat', etiqueta: s.chatAria, extra: 'data-du-guia="segChatGuia"' },
    `${icono('chat')}<span class="hd-insignia" ${ver('!chatLeido', true)}>1</span>`,
    'app-cuadrado du-seg-chat',
  )}</div>
</div>
<div class="du-festejo" data-du-festejo hidden>
  ${tildeExito}
  ${tituloMarcado(k.titulo, 'hd-titulo du-festejo__titulo')}
  ${tpl(k.texto, 'p', 'du-festejo__texto')}
</div>`,
      'du-mapa-pantalla du-seguimiento',
    ),
  );
}

/** Cabecera de los chats con un especialista (la común: sin logo ni campana). */
const cabeceraEsp = (nombre: string, detalle: string, i: number | 'esp', extra = '') =>
  cabeceraChat(
    {
      nombre,
      detalle,
      avatar: i === 'esp' ? avatarEsp('esp', 'chico') : avatarFijo(i, 'chico'),
    },
    { volver: true },
    extra,
  );

function chatEspecialista(): PantallaDemo {
  const c = d.chat;
  const v = rellenar(c.subtitulo);
  const cab = cabeceraEsp(V.esp, v, 'esp', boton({ accion: 'turno-seg', ir: 'u-turno-detalle', etiqueta: c.verTrabajo }, icono('info'), 'hd-circulo hd-circulo--claro du-chat__info'));
  // El nombre y el rubro cambian con el trabajo: se marcan para el navegador.
  const cabDinamica = cab
    .replace(`<strong>${esc(V.esp)}</strong>`, tpl('{esp}', 'strong'))
    .replace(`<small>${esc(v)}</small>`, tpl(c.subtitulo, 'small'));
  return pantalla(
    'u-chat',
    chat({
      id: 'u-chat',
      cabecera: cabDinamica,
      bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ico">${icono('escudo')}</span><small>${esc(c.bienvenida)}</small></div>`,
      inicial: c.inicial,
      etapas: c.etapas,
      final: boton({ accion: 'terminar', ir: 'u-terminado', guia: true }, `${icono('check')}${esc(c.terminar)}`, 'hd-boton hd-boton--exito'),
      acciones: accionesChat(),
      input: c.input,
    }),
  );
}

function chatOtro(id: 'u-chat2' | 'u-chat3', i: number): PantallaDemo {
  const c = id === 'u-chat2' ? d.chat2 : d.chat3;
  const contacto = d.contactos.find((x) => x.esp === i)!;
  let acciones = accionesChat(contacto.guardado ? {} : { contacto: contacto.id, guia: 'contacto' });
  // En el recorrido, después de agregarlo a contactos, la guía sigue a "Programar turno".
  if (id === 'u-chat2') acciones = acciones.replace('data-accion="chat-programar"', 'data-accion="chat-programar" data-du-guia="c2Programar"');
  return pantalla(
    id,
    chat({
      id,
      cabecera: cabeceraEsp(items[i].nombre, c.subtitulo, i),
      bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ico">${icono('escudo')}</span><small>${esc(c.bienvenida)}</small></div>`,
      inicial: c.inicial,
      etapas: c.etapas,
      acciones,
      input: c.input,
      guiaRapidas: false,
    }),
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
      <div class="du-ticket__total"><small class="hd-sobre"><span ${ver('pagoCompleto', false)}>${esc(t.pagaste)}</span><span ${ver('!pagoCompleto', true)}>${esc(t.aPagar)}</span></small>${monto('total', 'hd-precio hd-precio--grande du-positivo')}</div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">${lineasPlata({ conAdicional: 'adicionalAceptado', total: tpl('{total}', 'span'), claseTotal: 'du-dato--chico' })}</div>
    </div>
  </div>
  <p class="du-nota" ${E}>${icono('billetera')}<span>${esc($.nota)} ${esc(d.pagos.demo)}</span></p>
</div>
${pie(`${boton({ accion: 'pagar', guia: true, extra: ver('!pagoCompleto', true) }, tpl(t.pagar), 'hd-boton hd-boton--exito')}
  ${boton({ ir: 'u-resena', guia: true }, `${icono('estrella')}${tpl(t.calificar)}`, 'hd-boton')}
  ${boton({ raiz: 'u-inicio' }, esc(t.inicio), 'hd-boton hd-boton--fantasma')}`, 'du-pie--compacto')}`),
  );
}

function resena(): PantallaDemo {
  const r = d.resena;
  const estrellas = [1, 2, 3, 4, 5]
    .map((n) =>
      boton(
        { accion: 'estrellas', valor: String(n), guia: n === 5, etiqueta: completar(n === 1 ? r.estrella : r.estrellas, { n: String(n) }), extra: `data-du-grupo="estrellas" aria-pressed="false"` },
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
  <div class="du-resena__quien" ${E}>${avatarEsp('esp', 'grande')}${tpl('{esp}', 'p', 'hd-titulo hd-titulo--chico')}<span class="hd-chip hd-chip--tinte">${iconoRubro()}${tpl('{rubro}')}</span></div>
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
    chat({
      id: 'u-handia',
      cabecera: cabeceraChat({ nombre: h.nombre, detalle: h.subtitulo, avatar: `<span class="du-ia-avatar" aria-hidden="true">${lamparita()}</span>` }),
      bienvenida: `<div class="du-bienvenida du-bienvenida--ia"><span class="du-bienvenida__luz" aria-hidden="true"><i></i>${lamparita('hd-handy')}</span><strong>${esc(h.nombre)}</strong><small>${esc(h.bienvenida)}</small></div>`,
      inicial: h.inicial,
      etapas: h.etapas,
      final: acciones,
      input: h.input,
      clase: 'du-handia-pantalla',
      extra: `<template data-du-detectado><div class="du-detectado">${icono('chispas')}${iconoRubro('rubro', ini.rubro, 'du-detectado__ico')}${tpl(h.detectado, 'strong')}</div></template>`,
    }),
  );
}

// ── Agenda ────────────────────────────────────────────────────────────────

/** Tarjeta de un trabajo de la agenda (el navegador completa los [data-slot] cuando cambia algo). */
function tarjetaTrabajo(o: { id: string; rubro: string; detalle: string; trabajo: string; estado: string; claseEstado: string; total: string; guia?: boolean }): string {
  const a = d.agenda;
  return tarjetaFranja(
    `<span class="du-tarjeta__ico du-tarjeta__ico--azul" data-slot="icono">${o.rubro ? icono(rubro(o.rubro).icono) : ''}</span>
     <span class="du-tarjeta__datos"><strong data-slot="rubro">${o.rubro ? esc(rubro(o.rubro).nombre) : ''}</strong><small data-slot="detalle">${esc(o.detalle)}</small><small data-slot="trabajo">${esc(o.trabajo)}</small></span>
     <span class="du-tarjeta__der"><span class="hd-chip hd-chip--mini ${o.claseEstado}" data-slot="estado">${esc(o.estado)}</span><strong class="hd-precio" data-slot="total">${esc(o.total)}</strong></span>`,
    boton({ accion: 'turno', valor: o.id, ir: 'u-turno-detalle', guia: o.guia, extra: 'data-slot="ver"' }, `${esc(a.verDetalle)}${icono('derecha')}`, 'du-tarjeta__franja'),
    'data-du-agenda-tarjeta',
  );
}

const claseEstado = (estado: string) => (estado === 'terminado' ? 'hd-chip--exito' : estado === 'cancelado' ? 'du-chip--rojo' : 'hd-chip--tinte');

function turnos(): PantallaDemo {
  const a = d.agenda;
  // La guía del recorrido abre el primer trabajo del día con dos trabajos.
  const dobles = fixtures.filter((x) => fixtures.filter((y) => y.fecha === x.fecha).length > 1);
  const trabajos = fixtures.map((x) => ({
    id: x.id,
    fecha: x.fecha,
    html: tarjetaTrabajo({
      id: x.id,
      rubro: x.rubro,
      detalle: completar(a.detalle, { franja: x.franja, esp: items[x.esp].nombre }),
      trabajo: x.trabajo,
      estado: a.estados[x.estado as keyof typeof a.estados],
      claseEstado: claseEstado(x.estado),
      total: formatoPesos(precioFixture(x).totalCliente),
      guia: x.id === dobles[0]?.id,
    }),
  }));
  const molde = tarjetaTrabajo({ id: '', rubro: '', detalle: '', trabajo: '', estado: '', claseEstado: '', total: '' });
  return pantalla(
    'u-turnos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo hd-scroll du-agenda" data-du-agenda-guia="${esc(dobles[0]?.fecha ?? '')}">
  <div ${E}>${tituloMarcado(a.titulo, 'hd-titulo du-agenda__titulo', 'h2')}</div>
  ${agenda('usuario', trabajos)}
</div>
<template data-du-molde-trabajo>${molde}</template>
${navDemo('usuario', 1)}`),
  );
}

function turnoDetalle(): PantallaDemo {
  const x = d.turnoDetalle;
  const estado = tpl('{tEstado}', 'span', 'hd-chip hd-chip--tinte du-estado', 'data-du-clase="tTerminado:hd-chip--exito tCancelado:du-chip--rojo tCambioPend:hd-chip--amarillo"');
  const chats = items.map((it, i) => boton({ ir: it.chat, extra: ver(`tChat${i}`, i === proximo.esp) }, `${icono('chat')}${esc(x.chatear)}`, 'hd-boton hd-boton--claro du-boton-chico')).join('');
  return pantalla(
    'u-turno-detalle',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-detalle">
  ${barra(x.titulo, { extra: estado })}
  <div class="hd-ticket du-ticket" ${E}>
    <div class="hd-ticket__papel">
      <div class="du-ticket__arriba">
        <div class="du-ticket__quien"><span class="du-tarjeta__ico du-tarjeta__ico--azul">${iconoRubro('tRubro', proximo.rubro)}</span><span>${tpl('{tRubro}', 'strong')}${tpl('{tTipo}', 'small')}</span></div>
        <p class="du-ticket__trabajo">${tpl('{tTrabajo}')}</p>
        <div class="du-ticket__grilla">
          <div class="du-ticket__dato">${icono('calendario')}<small>${esc(x.fecha)}</small>${tpl('{tDia}', 'strong')}${tpl('{tFranja}')}</div>
          <div class="du-ticket__dato">${icono('casa')}<small>${esc(x.direccion)}</small><strong>${esc(d.describir.casa)}</strong><span>${esc(d.describir.calle)}</span></div>
        </div>
        <div class="du-ticket__esp">${avatarEsp('tEsp', 'chico')}<span><small>${esc(x.especialista)}</small>${tpl('{tEsp}', 'strong')}</span>${verificado()}</div>
      </div>
      <div class="hd-ticket__corte"></div>
      <div class="du-ticket__abajo">${lineasPlata({ pre: 't', conAdicional: 'tConAdicional' })}
        <p class="du-pagado" ${ver('tPagado', false)}>${icono('check')}${esc(x.pagado)}</p>
      </div>
    </div>
  </div>
  ${tpl(x.cambioPendiente, 'p', 'du-aviso du-aviso--pendiente', ver('tCambioPend', false))}
  ${tpl(x.cambioAceptado, 'p', 'du-aviso du-aviso--ok', ver('tCambioOk', false))}
  ${tpl(x.cancelado, 'p', 'du-aviso du-aviso--rojo', ver('tCancelado', false))}
</div>
${pie(`${boton({ ir: 'u-seguimiento', extra: ver('tEnCurso', false) }, `${icono('caminar')}${esc(x.seguir)}`, 'hd-boton')}
  <div class="hd-botones hd-botones--fila" ${ver('tActivo', true)}>${chats}${boton({ ir: 'u-cambiar', extra: 'data-du-guia="tGuiaCambiar" data-du-habilitar="!tCambioPend"' }, `${icono('calendario')}${esc(x.cambiar)}`, 'hd-boton hd-boton--claro du-boton-chico')}</div>
  ${boton({ accion: 'desde', valor: 'detalle', ir: 'u-cancelar', extra: ver('tActivo', true) }, esc(x.cancelar), 'hd-boton hd-boton--fantasma du-rojo')}
  ${boton({ accion: 'pagar', extra: ver('tPorPagar', false) }, tpl(x.pagar), 'hd-boton hd-boton--exito')}
  ${boton({ accion: 'ver-pago', ir: 'u-pagos', extra: ver('tVerPago', false) }, `${icono('billetera')}${esc(x.verPago)}`, 'hd-boton')}`, 'du-pie--detalle')}`),
  );
}

function cambiar(): PantallaDemo {
  const c = d.cambiar;
  return pantalla(
    'u-cambiar',
    `${tituloHoja(c.titulo)}
<section class="du-bloque" ${E}>${sobre(c.dia)}<div class="hd-chips hd-chips--carril du-dias du-dias--hoja">${carrilDias('cambio-dia', 'cambioDia', 1, 1)}</div>${otraOpcion('cambio-fecha', c.elegirFecha, 'guiaCambioFecha')}</section>
<section class="du-bloque" ${E}>${sobre(c.franja)}<div class="hd-mosaicos du-franjas">${mosaicosFranjas('cambio-franja', 'cambioFranja', ini.franja)}</div>${otraOpcion('cambio-hora', c.elegirHora, 'guiaCambioHora')}</section>
${tpl(c.pedis, 'p', 'du-pedis du-pedis--hoja', E)}
${boton({ accion: 'pedir-cambio', volver: true, extra: `data-du-guia="guiaPedirCambio" ${E}` }, esc(c.pedir), 'hd-boton')}
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

// ── Mensajes, cuenta y pagos ──────────────────────────────────────────────

function mensajes(): PantallaDemo {
  const x = d.mensajes;
  const filas = x.items
    .map((it) => {
      const esp = 'esp' in it ? (it.esp as number) : -1;
      const ic = 'icono' in it ? (it.icono as string) : '';
      const av =
        ic === 'lamparita'
          ? `<span class="du-ia-avatar" aria-hidden="true">${lamparita()}</span>`
          : it.ir === 'u-chat'
            ? avatarEsp('esp')
            : esp >= 0
              ? avatarFijo(esp)
              : `<span class="hd-avatar du-avatar-icono" aria-hidden="true">${icono(ic)}</span>`;
      const badge = 'badge' in it && it.badge ? `<span class="du-badge" ${it.ir === 'u-chat' ? ver('!chatLeido', true) : ver(`!leido:${it.ir}`, true)}>${esc(it.badge)}</span>` : '';
      return boton(
        { ir: it.ir, guia: it.ir === 'u-chat2', extra: E },
        `${av}<span class="hd-fila__texto">${tpl(it.nombre, 'strong')}${tpl(it.ultimo, 'small')}</span><span class="hd-fila__fin">${badge}${icono('derecha')}</span>`,
        'hd-fila du-chat-fila',
      );
    })
    .join('');
  return pantalla(
    'u-mensajes',
    app(`${cabecera('azul')}
<div class="du-cuerpo hd-scroll du-mensajes">
  <div class="du-mensajes__cabeza" ${E}>${tituloMarcado(x.titulo, 'hd-titulo du-mensajes__titulo', 'h2')}${boton({ ir: 'u-contactos', etiqueta: x.contactosAria }, `${icono('contactos')}<span>${esc(x.contactos)}</span>`, 'hd-chip hd-chip--azul du-contactos-btn')}</div>
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
    <span class="du-yo__avatar"><span class="hd-avatar hd-avatar--grande" aria-hidden="true"><span>${esc(c.iniciales)}</span></span>${boton({ accion: 'aviso', etiqueta: c.fotoAria }, icono('camara'), 'du-yo__camara')}</span>
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

/** Tarjeta (plástico) de Tus pagos y de la vista previa. */
const plastico = (o: { tipo: string; numero: string; titular: string; vence: string; clase?: string; extra?: string }) =>
  `<div class="du-banco${o.clase ? ' ' + o.clase : ''}"${o.extra ? ' ' + o.extra : ''}>
    <span class="du-banco__tipo">${o.tipo}</span>
    <span class="du-banco__chip" aria-hidden="true"></span>
    <span class="du-banco__numero">${o.numero}</span>
    <span class="du-banco__pie"><span>${o.titular}</span><span>${o.vence}</span></span>
  </div>`;

function pagos(): PantallaDemo {
  const g = d.pagos;
  const tj = g.tarjeta;
  const mov = (id: string, cuerpo: string, lineas: string, extra = '') =>
    `<div class="du-tarjeta du-mov-tarjeta"${extra ? ' ' + extra : ''} ${E}><div class="du-tarjeta__cuerpo">${cuerpo}</div>
    <div class="du-mov" data-du-mov="${id}" hidden>${lineas}</div>
    ${boton(
      { accion: 'mov', valor: id, extra: 'aria-expanded="false"' },
      `<span data-du-mas>${esc(d.comun.verMas)}</span><span data-du-menos hidden>${esc(g.verMenos)}</span>${icono('abajo')}`,
      'du-tarjeta__franja du-tarjeta__franja--plegable',
    )}</div>`;
  const lineasFijas = (p: Desglose, esp: string) =>
    `${dato(esc(completar(g.alEspecialista, { esp })), `<span>${esc(formatoPesos(p.subtotal))}</span>`)}${dato(esc(rellenar($.tarifa)), `<span>${esc(formatoPesos(p.tarifaCliente))}</span>`)}`;
  // El pago del trabajo del recorrido aparece solo si de verdad se pagó.
  const flujo = mov(
    'flujo',
    `<span class="du-tarjeta__ico du-tarjeta__ico--azul">${iconoRubro()}</span>
     <span class="du-tarjeta__datos">${tpl(completar(g.pagaste, { rubro: '{rubro}' }), 'strong')}${tpl('{fecha}', 'small')}</span>
     <span class="du-tarjeta__der">${tpl(menos('{pagado}'), 'strong', 'hd-precio hd-negativo')}<small>${esc(g.medio)}</small></span>`,
    `${dato(tpl(completar(g.alEspecialista, { esp: '{esp}' })), tpl('{subtotal}'))}${dato(esc(rellenar($.tarifa)), tpl('{tarifa}'))}`,
    ver('pagoHecho', false),
  );
  const otros = fixtures
    .filter((x) => x.estado === 'terminado')
    .map((x) => {
      const p = precioFixture(x);
      return mov(
        x.id,
        `<span class="du-tarjeta__ico du-tarjeta__ico--azul">${icono(rubro(x.rubro).icono)}</span>
         <span class="du-tarjeta__datos"><strong>${esc(completar(g.pagaste, { rubro: rubro(x.rubro).nombre }))}</strong><small>${esc(diaInfo(x.fecha).fecha)}</small></span>
         <span class="du-tarjeta__der"><strong class="hd-precio hd-negativo">${esc(menos(formatoPesos(p.totalCliente)))}</strong><small>${esc(g.medio)}</small></span>`,
        lineasFijas(p, items[x.esp].nombre),
      );
    })
    .join('');
  return pantalla(
    'u-pagos',
    app(`${cabecera('blanca')}
<div class="du-cuerpo du-cuerpo--ajustado du-pagos-pantalla">
  ${barra(T['u-pagos'], { extra: boton({ ir: 'u-agregar-tarjeta', etiqueta: g.agregar, extra: 'data-du-guia="!tarjetaNueva"' }, icono('mas'), 'hd-circulo du-pagos__mas') })}
  <div class="du-tarjetas hd-scroll" role="group" aria-label="${esc(g.tarjetasAria)}" ${POP}>
    ${plastico({ tipo: esc(tj.tipo), numero: esc(tj.numero), titular: esc(tj.titular), vence: esc(tj.vence) })}
    ${plastico({ tipo: esc(g.nueva.tipo), numero: tpl(g.nueva.numero.replace('{ultimos}', '{tarjetaUltimos}')), titular: tpl('{tarjetaNombre}'), vence: tpl('{tarjetaVence}'), clase: 'du-banco--nueva', extra: `${ver('tarjetaNueva', false)} data-du-tarjeta-nueva` })}
  </div>
  <p class="du-demo-aviso">${icono('info')}<span>${esc(g.demo)}</span></p>
</div>
${hojaAzul(esc(g.panel), `<div class="hd-scroll du-lista">${flujo}${otros}</div>`, 'du-hoja-azul--llena')}`),
  );
}

function agregarTarjeta(): PantallaDemo {
  const a = d.agregarTarjeta;
  const campo = (id: string, etiqueta: string, ayuda: string, attrs: string) =>
    `<label class="du-campo-form" ${E}><span class="du-campo-form__etiqueta">${esc(etiqueta)}</span><input class="du-campo-form__input" data-du-campo="${id}" ${attrs} /><small>${esc(ayuda)}</small></label>`;
  return pantalla(
    'u-agregar-tarjeta',
    app(`${cabecera('blanca', false)}
<div class="du-cuerpo hd-scroll du-agregar">
  ${barra(a.titulo, { sub: `<small>${esc(a.sub)}</small>` })}
  ${plastico({
    tipo: esc(a.vista.tipo),
    numero: `<span data-du-vista="numero">${esc(a.vista.numero)}</span>`,
    titular: `<span data-du-vista="nombre">${esc(a.vista.titular)}</span>`,
    vence: `<span data-du-vista="vence">${esc(a.vista.vence)}</span>`,
    clase: 'du-banco--vista',
    extra: `${POP} aria-hidden="true"`,
  })}
  ${boton({ accion: 'tarjeta-prueba', extra: `data-du-guia="tarjetaVacia" ${E}` }, `${icono('chispas')}${esc(a.prueba)}`, 'hd-chip hd-chip--amarillo du-prueba')}
  <div class="du-form">
    ${campo('numero', a.numero, a.numeroAyuda, 'inputmode="numeric" autocomplete="off" maxlength="19" placeholder="0000 0000 0000 0000"')}
    ${campo('nombre', a.nombre, '', 'autocomplete="off" maxlength="26" placeholder="Como figura en la tarjeta"')}
    <div class="du-form__fila">
      ${campo('vence', a.vence, a.venceAyuda, 'inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/AA"')}
      ${campo('codigo', a.codigo, a.codigoAyuda, 'inputmode="numeric" autocomplete="off" maxlength="4" placeholder="•••"')}
    </div>
  </div>
  <p class="du-demo-aviso du-demo-aviso--fuerte" ${E}>${icono('escudo')}<span>${esc(a.demo)}</span></p>
</div>
${pie(boton({ accion: 'tarjeta-guardar', extra: 'data-du-tarjeta-guardar data-du-guia="tarjetaLista" disabled' }, `<span data-du-guardar-si hidden>${icono('check')}${esc(a.guardar)}</span><span data-du-guardar-no>${esc(a.faltan)}</span>`, 'hd-boton'))}`),
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
    <div class="du-sirvio__botones" ${ver('!sirvio', true)}>${boton({ accion: 'sirvio' }, esc(a.no), 'hd-boton hd-boton--chico hd-boton--peligro')}${boton({ accion: 'sirvio' }, esc(a.si), 'hd-boton hd-boton--chico hd-boton--exito')}</div>
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
    chat({
      id: 'u-soporte',
      cabecera: cabeceraChat({ nombre: s.nombre, detalle: s.subtitulo, avatar: `<span class="hd-avatar hd-avatar--chico du-avatar-icono" aria-hidden="true">${icono('chat')}</span>` }),
      bienvenida: `<div class="du-bienvenida"><span class="du-bienvenida__ico">${icono('chat')}</span><small>${esc(s.bienvenida)}</small></div>`,
      inicial: s.inicial,
      etapas: s.etapas,
      input: s.input,
    }),
  );
}

function notificaciones(): PantallaDemo {
  const n = d.notificaciones;
  const avisos = n.avisos
    .map((a, i) => {
      const si = 'si' in a ? a.si : undefined;
      return `<div class="du-aviso-card du-aviso-card--${a.estilo}" ${ver(`aviso${i}`, si === undefined)} ${E}><span class="du-aviso-card__ico">${icono(a.icono)}</span>${tpl(a.texto, 'span', 'du-aviso-card__texto')}${boton(
        { accion: 'aviso-borrar', valor: String(i), etiqueta: n.borrarAria },
        icono('cerrar'),
        'du-aviso-card__x',
      )}</div>`;
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
  ['u-sin-especialistas', sinEspecialistas],
  ['u-opciones', opciones],
  ['u-programar', programar],
  ['u-describir', describir],
  ['u-buscando', buscando],
  ['u-presupuestos', presupuestos],
  ['u-perfil', perfil],
  ['u-historial', historial],
  ['u-confirmar', confirmar],
  ['u-seguimiento', seguimiento],
  ['u-chat', chatEspecialista],
  ['u-chat2', () => chatOtro('u-chat2', 1)],
  ['u-chat3', () => chatOtro('u-chat3', 2)],
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
  ['u-agregar-tarjeta', agregarTarjeta],
  ['u-ayuda', ayuda],
  ['u-ayuda-detalle', ayudaDetalle],
  ['u-soporte', soporte],
  ['u-notificaciones', notificaciones],
];

/** Contactos de la demo (pantalla común u-contactos): solo los agregados desde un chat, sin números. */
const contactos: ContactoDemo[] = d.contactos.map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.detalle, chat: c.chat, guardado: c.guardado, tono: `var(--du-tono-${c.esp})` }));

export function demoUsuario(): DemoRol {
  const faltan = Object.keys(T).filter((id) => !CONSTRUCTORES.some(([x]) => x === id));
  if (faltan.length) throw new Error(`Demo usuario: falta armar ${faltan.join(', ')}`);
  const pantallas = CONSTRUCTORES.map(([id, construir]) => {
    // Cada pantalla se arma con los valores de su contexto (pedido, trabajo o HandIA).
    CTX = contextoDe(id);
    V = VALORES[CTX];
    const p = construir();
    if (p.id !== id) throw new Error(`Demo usuario: la pantalla "${p.id}" está anotada como "${id}"`);
    return p;
  });
  CTX = 'pedido';
  V = VALORES.pedido;
  return { inicio: 'u-inicio', pantallas: [...pantallas, ...pantallasComunes('usuario', contactos)], recorrido: d.recorrido };
}
