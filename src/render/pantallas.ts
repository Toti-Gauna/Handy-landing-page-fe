// Pantallas de la app recreadas en HTML, fieles a las originales de assets/fotos
// (header con botones cuadrados, mosaicos grises, hojas azules con manija, tarjetas con franja gris),
// pero en español, en pesos y con los seis rubros.
// Cada función devuelve el contenido de la pantalla; el marco del celular lo pone telefono().

import p from '../content/pantallas.json' with { type: 'json' };
import sitio from '../content/sitio.json' with { type: 'json' };
import rubros from '../content/rubros.json' with { type: 'json' };
import tarifas from '../content/tarifas.json' with { type: 'json' };
import { icono } from './iconos.ts';
import { esc, formatoPesos, porcentaje } from './util.ts';

const { ejemplo, normal } = tarifas;
const conTarifaCliente = (n: number) => Math.round(n * (1 + normal.cliente / 100));
const retencion = (ejemplo.presupuesto * normal.especialista) / 100;
const recibis = ejemplo.presupuesto - retencion;

// ── Piezas comunes ────────────────────────────────────────────────────────

const estado = (claro = false) => `<div class="app-estado${claro ? ' app-estado--claro' : ''}">
  <span>${esc(p.estado.hora)}</span>
  <span class="app-estado__iconos"><i class="app-senal"></i><i class="app-wifi"></i><i class="app-bateria"></i></span>
</div>`;

const logo = `<span class="app-logo"><img src="/src/img/logo-handy.webp" alt="" width="720" height="194" loading="lazy" decoding="async" /><small>${esc(sitio.bajada)}</small></span>`;

function cabecera(variante: 'blanca' | 'azul', botones: string[] = ['campana', 'pin']): string {
  const bs = botones.map((b) => `<span class="app-cuadrado">${icono(b)}</span>`).join('');
  return `<div class="app-cabecera app-cabecera--${variante}">
  ${estado(variante === 'azul')}
  <div class="app-cabecera__fila">${logo}<span class="app-cabecera__botones">${bs}</span></div>
</div>`;
}

function nav(activo: number): string {
  return `<div class="app-nav">${p.nav
    .map(
      (n, i) =>
        `<span class="app-nav__item${i === activo ? ' app-nav__item--activo' : ''}">${icono(n.icono)}${esc(n.texto)}</span>`,
    )
    .join('')}</div>`;
}

const volver = (titulo: string) => `<p class="app-volver"><span class="app-volver__flecha">${icono('atras')}</span>${esc(titulo)}</p>`;

const hoja = (titulo: string, contenido: string, clase = '') =>
  `<div class="app-hoja ${clase}"><span class="app-hoja__manija"></span><p class="app-hoja__titulo">${esc(titulo)}</p>${contenido}</div>`;

/** Tarjeta blanca con franja gris abajo, como "Last Meetups" en la app. */
const tarjeta = (cuerpo: string, franja: string) =>
  `<div class="app-tarjeta"><div class="app-tarjeta__cuerpo">${cuerpo}</div><div class="app-tarjeta__franja">${esc(franja)}</div></div>`;

const fila = (izq: string, der: string, claseDer = '') =>
  `<div class="app-fila"><span>${izq}</span><span class="${claseDer}">${der}</span></div>`;

const mosaico = (texto: string, ic: string) => `<span class="app-mosaico">${icono(ic)}<span>${esc(texto)}</span></span>`;

function mapa(ruta = true): string {
  const c = p.seguimiento.calles;
  return `<svg class="app-mapa" viewBox="0 0 240 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="240" height="300" fill="#EDEFF2"/>
  <g fill="#E1E4E9">
    <rect x="8" y="8" width="58" height="46" rx="3"/><rect x="80" y="8" width="62" height="46" rx="3"/><rect x="156" y="8" width="76" height="46" rx="3"/>
    <rect x="8" y="68" width="58" height="56" rx="3"/><rect x="156" y="68" width="76" height="56" rx="3"/>
    <rect x="8" y="138" width="58" height="50" rx="3"/><rect x="80" y="138" width="62" height="50" rx="3"/><rect x="156" y="138" width="76" height="50" rx="3"/>
    <rect x="8" y="232" width="58" height="60" rx="3"/><rect x="80" y="232" width="62" height="60" rx="3"/><rect x="156" y="232" width="76" height="60" rx="3"/>
  </g>
  <rect x="80" y="68" width="62" height="56" rx="3" fill="#CDE8C9"/>
  <g stroke="#fff" stroke-width="9"><path d="M73 0v300M149 0v300M0 61h240M0 131h240M0 196h240"/></g>
  <path d="M0 214 L240 206" stroke="#FBD999" stroke-width="13"/>
  <g font-family="DM Sans, sans-serif" font-size="8" fill="#7B8496" font-weight="600">
    <text x="160" y="226" transform="rotate(-2 160 226)">${esc(c[0])}</text>
    <text x="77" y="40" transform="rotate(90 77 40)">${esc(c[1])}</text>
    <text x="88" y="100" fill="#5E8E5A">${esc(c[2])}</text>
    <text x="10" y="128">${esc(c[3])}</text>
    <text x="153" y="160" transform="rotate(90 153 160)">${esc(c[4])}</text>
  </g>
  ${ruta ? '<path d="M111 252 V196 H149 V96" fill="none" stroke="#0E1D36" stroke-width="3.5" stroke-linejoin="round"/>' : ''}
</svg>`;
}

const pin = (clase: string) => `<span class="app-pin ${clase}"><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31s10-11.6 10-19A10 10 0 0 0 2 12c0 7.4 10 19 10 19Z"/><circle cx="12" cy="12" r="4" fill="#fff"/></svg></span>`;

/** Foto ilustrada de un caño debajo de la pileta (en lugar de una foto real). */
const fotoCano = `<svg class="app-foto" viewBox="0 0 120 90" aria-hidden="true">
  <rect width="120" height="90" rx="8" fill="#DCE3EC"/><rect x="0" y="0" width="120" height="22" fill="#C9D2DE"/>
  <path d="M60 22v20a10 10 0 0 0 10 10h14v18" fill="none" stroke="#F4F6F9" stroke-width="11" stroke-linecap="round"/>
  <path d="M60 22v20a10 10 0 0 0 10 10h14v18" fill="none" stroke="#9AA6B6" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 0"/>
  <circle cx="84" cy="78" r="3" fill="#6FB5FF"/><circle cx="78" cy="84" r="2" fill="#6FB5FF"/>
</svg>`;

function burbuja(m: { de: string; texto: string; foto?: boolean }, propias: string[]): string {
  const propia = propias.includes(m.de);
  return `<div class="app-burbuja ${propia ? 'app-burbuja--propia' : 'app-burbuja--otra'}${m.foto ? ' app-burbuja--foto' : ''}">${m.foto ? fotoCano : ''}<span>${esc(m.texto)}</span></div>`;
}

function inputChat(texto: string): string {
  return `<div class="app-input"><span class="app-input__campo">${esc(texto)}${icono('imagen')}</span><span class="app-input__enviar">${icono('enviar')}</span></div>`;
}

// ── Usuario ───────────────────────────────────────────────────────────────

function inicioContenido(): string {
  const a = p.inicioApp;
  return `${cabecera('blanca')}
<div class="app-cuerpo">
  <p class="app-titulo">${esc(a.titulo)}</p>
  <div class="app-grilla">${rubros.rubros.map((r) => mosaico(r.corto ?? r.nombre, r.icono)).join('')}</div>
  <p class="app-titulo app-titulo--chico">${esc(a.quieroTitulo)}</p>
  <div class="app-grilla">${a.quiero.map((q) => mosaico(q.texto, q.icono)).join('')}</div>
  <span class="app-urgencia" title="${esc(a.urgencia)}">${icono('alerta')}</span>
</div>
${nav(0)}`;
}

export const inicioApp = () => `<div class="app">${inicioContenido()}</div>`;

export function opciones(): string {
  const o = p.opciones;
  return `<div class="app app--atenuada">${inicioContenido()}
<div class="app-velo"></div>
<div class="app-sheet">
  <p class="app-sheet__titulo">${esc(o.titulo)}<span class="app-x">${icono('cerrar')}</span></p>
  ${o.items
    .map(
      (it, i) =>
        `<span class="app-opcion${i === 1 ? ' app-opcion--activa' : ''}">${icono(it.icono)}<span><strong>${esc(it.texto)}</strong><small>${esc(it.detalle)}</small></span></span>`,
    )
    .join('')}
</div></div>`;
}

export function presupuestos(): string {
  const q = p.presupuestos;
  const items = q.items
    .map((it, i) =>
      tarjeta(
        `<span class="app-avatar">${icono('usuario')}</span>
        <span class="app-tarjeta__datos"><strong>${esc(it.nombre)}</strong><small class="app-verificado">${icono('verificado')}${esc(q.verificado)}</small><small>${esc(it.horario)}</small></span>
        <span class="app-tarjeta__monto${i === 0 ? ' app-tarjeta__monto--elegido' : ''}">${esc(formatoPesos(it.precio))}</span>`,
        q.elegir,
      ),
    )
    .join('');
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${volver(q.titulo)}<p class="app-subtitulo">${icono('canilla')}${esc(q.pedido)}</p></div>
${hoja(q.panel, `<div class="app-lista">${items}</div><p class="app-hoja__nota">${esc(q.nota)}</p>`, 'app-hoja--llena')}
</div>`;
}

export function seguimiento(): string {
  const s = p.seguimiento;
  return `<div class="app">${cabecera('azul', ['campana'])}
<div class="app-mapa-caja">${mapa()}${pin('app-pin--a')}${pin('app-pin--b')}<span class="app-flotante">${icono('atras')}</span></div>
<div class="app-panel">
  <p class="app-panel__titulo">${esc(s.estado)}</p>
  <div class="app-progreso"><span class="hecho"></span><span class="hecho actual">${icono('caminar')}</span><span></span></div>
  <p class="app-panel__label">${esc(s.horarioLabel)}</p>
  <div class="app-panel__fila"><span class="app-horario">${esc(s.horario)}</span><span class="app-redondo">${icono('info')}</span><span class="app-redondo app-redondo--rojo">${icono('prohibido')}</span></div>
  <div class="app-panel__pie"><span class="app-avatar app-avatar--chico">${icono('usuario')}</span><span><small>${esc(s.especialistaLabel)}</small><strong>${esc(s.especialista)}</strong></span><span class="app-cuadrado app-cuadrado--claro">${icono('chat')}</span></div>
</div></div>`;
}

export function handia(): string {
  const h = p.handia;
  return `<div class="app">${cabecera('blanca', ['campana'])}
<div class="app-chat">
  <div class="app-chat__cabecera"><span class="app-volver__flecha">${icono('atras')}</span><span class="app-chat__nombre"><strong>${esc(h.nombre)}</strong><small>${esc(h.subtitulo)}</small></span><span class="app-chat__avatar"><img src="/src/img/handy-lamparita.webp" alt="" width="202" height="346" loading="lazy" decoding="async" /></span></div>
  <div class="app-chat__mensajes">${h.mensajes.map((m) => burbuja(m, ['vos'])).join('')}
    <div class="app-chat__acciones">${h.acciones.map((a, i) => `<span class="app-accion${i === 0 ? ' app-accion--principal' : ''}">${esc(a)}</span>`).join('')}</div>
  </div>
  ${inputChat(h.input)}
</div></div>`;
}

function calendario(t: typeof p.turnos): string {
  const marcados = new Map(t.marcados.map((m) => [m.dia, m]));
  let dias = '';
  for (let d = 1; d <= t.dias; d++) {
    const m = marcados.get(d);
    const clase = m ? ` app-dia--${m.estilo}` : d === t.hoy ? ' app-dia--hoy' : '';
    dias += `<span class="app-dia${clase}">${d}${m ? icono(m.icono) : ''}</span>`;
  }
  return `<div class="app-calendario">
  <p class="app-calendario__cabecera"><span>${esc(t.mes)}${icono('abajo')}</span><span>${esc(t.anio)}${icono('abajo')}</span></p>
  <div class="app-calendario__dias">${dias}</div>
</div>`;
}

export function turnos(): string {
  const t = p.turnos;
  const items = t.items
    .map((it) =>
      tarjeta(
        `<span class="app-tarjeta__datos"><strong>${esc(it.rubro)} ${icono(it.icono)}</strong><small>${esc(it.fecha)}</small></span>
         <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--rojo">− ${esc(formatoPesos(it.precio))}</span><small>${esc(it.tipo)}</small></span>`,
        p.verMas,
      ),
    )
    .join('');
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${calendario(t)}</div>
${hoja(t.panel, `<div class="app-lista">${items}</div>`, 'app-hoja--llena')}
${nav(1)}</div>`;
}

export function pagos(): string {
  const g = p.pagos;
  const items = g.items
    .map((it) => {
      const monto = it.presupuesto ? conTarifaCliente(ejemplo.presupuesto) : (it.precio ?? 0);
      return tarjeta(
        `<span class="app-tarjeta__datos"><strong>${esc(it.texto)}</strong><small>${esc(it.fecha)}</small></span>
         <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--rojo">− ${esc(formatoPesos(monto))}</span><small>${esc(it.medio)}</small></span>`,
        p.verMas,
      );
    })
    .join('');
  const tj = g.tarjeta;
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">
  ${volver(g.titulo)}
  <div class="app-tarjeta-banco"><span class="app-tarjeta-banco__chip"></span><span class="app-tarjeta-banco__numero">${esc(tj.numero)}</span><span class="app-tarjeta-banco__pie"><span>${esc(tj.titular)}</span><span>${esc(tj.vence)}</span></span><span class="app-tarjeta-banco__tipo">${esc(tj.tipo)}</span></div>
  <span class="app-boton app-boton--contorno">${esc(g.agregar)}</span>
</div>
${hoja(g.panel, `<div class="app-lista">${items}</div>`, 'app-hoja--llena')}
</div>`;
}

// ── Especialista ──────────────────────────────────────────────────────────

function pedidoContenido(): string {
  const e = p.espPedido;
  return `${cabecera('azul')}
<div class="app-mapa-caja">${mapa(false)}${pin('app-pin--rojo')}
  <span class="app-disponible">${esc(e.disponible)} ${icono('maletin')}<span class="app-switch"></span></span>
  <div class="app-pedido">
    <p class="app-pedido__titulo">${esc(e.titulo)} ${icono('canilla')}<span class="app-x app-x--gris">${icono('cerrar')}</span></p>
    <span class="app-tag">${esc(e.tipo)}</span>
    <small>${esc(e.sugeridoLabel)}</small>
    <p class="app-pedido__precio">${esc(formatoPesos(ejemplo.presupuesto))}</p>
    <div class="app-ruta"><span><i></i>${esc(e.desde)}</span><span><i></i>${esc(e.hasta)}</span></div>
    <span class="app-boton">${esc(e.aceptar)}</span>
    <span class="app-boton app-boton--contorno">${esc(e.cambiar)}</span>
  </div>
</div>
${nav(0)}`;
}

export const espPedido = () => `<div class="app">${pedidoContenido()}</div>`;

export function espPrecio(): string {
  const e = p.espPrecio;
  return `<div class="app app--atenuada">${pedidoContenido()}
<div class="app-velo"></div>
<div class="app-sheet">
  <p class="app-sheet__titulo">${esc(e.titulo)}<span class="app-x">${icono('cerrar')}</span></p>
  <div class="app-sheet__opciones">${e.opciones.map((o, i) => `<span class="app-chip${i === 1 ? ' app-chip--activo' : ''}">${esc(o)}</span>`).join('')}</div>
  <div class="app-sheet__fila"><span class="app-campo">${esc(e.input)}</span><span class="app-boton">${esc(e.boton)}</span></div>
  <p class="app-sheet__nota">${esc(e.nota)}</p>
</div></div>`;
}

export function espAgenda(): string {
  const a = p.espAgenda;
  const items = a.items
    .map((it) =>
      tarjeta(
        `<span class="app-tarjeta__datos"><strong>${esc(it.rubro)} ${icono(it.icono)}</strong><small>${esc(it.fecha)}</small></span>
         <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--verde">+ ${esc(formatoPesos(it.precio))}</span><small>${esc(it.tipo)}</small></span>`,
        p.verMas,
      ),
    )
    .join('');
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">${calendario(p.turnos)}</div>
${hoja(a.panel, `<div class="app-lista">${items}</div>`, 'app-hoja--llena')}
${nav(1)}</div>`;
}

export function espChat(): string {
  const c = p.espChat;
  return `<div class="app">${cabecera('blanca', ['campana'])}
<div class="app-chat">
  <div class="app-chat__cabecera"><span class="app-volver__flecha">${icono('atras')}</span><span class="app-chat__nombre"><strong>${esc(c.contacto)}</strong></span><span class="app-chat__avatar app-chat__avatar--icono">${icono('usuario')}</span></div>
  <div class="app-chat__mensajes">${c.mensajes.map((m) => burbuja(m, ['esp'])).join('')}</div>
  <div class="app-chat__acciones app-chat__acciones--centro"><span class="app-accion app-accion--principal">${esc(c.turno)} ${icono('calendario')}</span></div>
  ${inputChat(c.input)}
</div></div>`;
}

export function espCaja(): string {
  const c = p.espCaja;
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--ajustado">
  ${volver(c.titulo)}
  <p class="app-label">${esc(c.cuentaLabel)}</p>
  <p class="app-valor">${esc(c.alias)}</p>
  <span class="app-boton">${esc(c.editar)}</span>
</div>
${hoja(
  c.panel,
  `<div class="app-desglose"><p class="app-desglose__titulo">${esc(c.trabajo)}</p>
    ${fila(esc(c.presupuesto), esc(formatoPesos(ejemplo.presupuesto)))}
    ${fila(`${esc(c.tarifa)} (${esc(porcentaje(normal.especialista))})`, `− ${esc(formatoPesos(retencion))}`)}
    ${fila(`<strong>${esc(c.acreditado)}</strong>`, `<strong>${esc(formatoPesos(recibis))}</strong>`, 'app-verde')}
  </div>
  ${tarjeta(
    `<span class="app-tarjeta__datos"><strong>${esc(c.otro.trabajo)} ${icono('llama')}</strong><small>${esc(c.otro.fecha)}</small></span>
     <span class="app-tarjeta__derecha"><span class="app-tarjeta__monto app-tarjeta__monto--verde">+ ${esc(formatoPesos(c.otro.neto))}</span><small>${esc(c.acreditado)}</small></span>`,
    p.verMas,
  )}
  <img class="app-hoja__handy" src="/src/img/handy-lamparita.webp" alt="" width="202" height="346" loading="lazy" decoding="async" />`,
  'app-hoja--llena',
)}
</div>`;
}

export function espFin(): string {
  const f = p.espFin;
  return `<div class="app">${cabecera('blanca')}
<div class="app-cuerpo app-cuerpo--centro">
  <p class="app-titulo app-titulo--negro">${esc(f.titulo)}</p>
  <div class="app-fin__handy" data-handy="cano-gota">
    <img class="handy--cano" src="/src/img/handy-cano.webp" alt="" width="354" height="405" loading="lazy" decoding="async" data-handy="cano" />
    <img class="cano-gota__gota" src="/src/img/handy-gota.webp" alt="" width="93" height="125" loading="lazy" decoding="async" data-handy="gota" />
  </div>
  <p class="app-ganaste">${esc(f.ganaste)} <strong>${esc(formatoPesos(recibis))}</strong></p>
  <p class="app-nota-fin">${esc(f.texto)}</p>
  <span class="app-boton app-boton--contorno">${esc(f.inicio)}</span>
  <span class="app-boton">${esc(f.ayuda)}</span>
</div></div>`;
}

export const PANTALLAS = {
  inicioApp,
  opciones,
  presupuestos,
  seguimiento,
  handia,
  turnos,
  pagos,
  espPedido,
  espPrecio,
  espAgenda,
  espChat,
  espCaja,
  espFin,
} as const;

export type NombrePantalla = keyof typeof PANTALLAS;

/** Título accesible de cada pantalla (va en el figcaption). */
export const ETIQUETAS: Record<NombrePantalla, string> = {
  inicioApp: p.inicioApp.titulo,
  opciones: p.opciones.titulo,
  presupuestos: p.presupuestos.titulo,
  seguimiento: p.seguimiento.estado,
  handia: p.handia.nombre,
  turnos: p.turnos.panel,
  pagos: p.pagos.titulo,
  espPedido: p.espPedido.titulo,
  espPrecio: p.espPrecio.titulo,
  espAgenda: p.espAgenda.panel,
  espChat: p.espChat.contacto,
  espCaja: p.espCaja.titulo,
  espFin: p.espFin.titulo,
};
