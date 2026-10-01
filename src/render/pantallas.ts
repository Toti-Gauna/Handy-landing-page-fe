// Pantallas de la app recreadas en HTML (referencia: assets/fotos), con el contenido corregido.

import p from '../content/pantallas.json' with { type: 'json' };
import rubros from '../content/rubros.json' with { type: 'json' };
import inicio from '../content/inicio.json' with { type: 'json' };
import tarifas from '../content/tarifas.json' with { type: 'json' };
import { icono } from './iconos.ts';
import { telefono } from './componentes.ts';
import { esc, formatoPesos, variables } from './util.ts';

const barra = (extra = '') => `<div class="app-barra">
  <span class="app-barra__logo"><img src="/src/img/logo-handy.webp" alt="" width="720" height="194" loading="lazy" decoding="async" /></span>
  <span class="app-barra__acciones">${extra}<span class="app-barra__boton">${icono('campana')}</span></span>
</div>`;

const navApp = (activo = 0) => {
  const iconos = ['casa', 'calendario', 'chat', 'usuario'];
  return `<div class="app-nav">${p.nav
    .map((t, i) => `<span class="app-nav__item${i === activo ? ' app-nav__item--activo' : ''}">${icono(iconos[i])}${esc(t)}</span>`)
    .join('')}</div>`;
};

const mapa = `<svg class="app-mapa" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="200" height="260" fill="#EEF1F5"/>
  <g fill="#E3E8EF"><rect x="12" y="14" width="56" height="44" rx="4"/><rect x="84" y="14" width="44" height="60" rx="4"/><rect x="144" y="20" width="48" height="40" rx="4"/>
  <rect x="10" y="80" width="60" height="58" rx="4"/><rect x="140" y="86" width="52" height="54" rx="4"/><rect x="16" y="160" width="50" height="46" rx="4"/>
  <rect x="86" y="150" width="40" height="52" rx="4"/><rect x="142" y="164" width="50" height="70" rx="4"/><rect x="12" y="222" width="70" height="34" rx="4"/></g>
  <path d="M-10 70 L210 140" stroke="#fff" stroke-width="12"/><path d="M76 -10 L76 270" stroke="#fff" stroke-width="10"/>
  <path d="M134 -10 L134 270" stroke="#fff" stroke-width="9"/><path d="M-10 212 L210 206" stroke="#fff" stroke-width="10"/>
  <path d="M-10 150 L60 270" stroke="#CFE9D6" stroke-width="8"/>
  <path d="M100 196 C 100 160, 140 150, 134 110" stroke="#2F6BFF" stroke-width="4" fill="none" stroke-dasharray="2 7" stroke-linecap="round"/>
</svg>`;

export function pantallaInicio(): string {
  const grilla = rubros.rubros
    .map((r) => `<span class="app-rubro">${icono(r.icono)}<span>${esc(r.corto ?? r.nombre)}</span></span>`)
    .join('');
  return telefono(
    `${barra(`<span class="app-barra__boton">${icono('pin')}</span>`)}
    <div class="app-cuerpo">
      <p class="app-titulo">${esc(p.inicioApp.saludo)}</p>
      <div class="app-rubros">${grilla}</div>
      <p class="app-label">${esc(p.inicioApp.ejemplosTitulo)}</p>
      <div class="app-opciones">${p.inicioApp.ejemplos.map((t) => `<span class="app-opcion">${esc(t)}</span>`).join('')}</div>
      <span class="app-urgencia">${icono('alerta')}${esc(p.inicioApp.urgencia)}</span>
    </div>
    ${navApp(0)}`,
    p.inicioApp.saludo,
    'telefono--hero',
  );
}

export function pantallaPedido(): string {
  const tipos = inicio.comoFunciona.pasos[0].tipos ?? [];
  return telefono(
    `${barra()}
    <div class="app-cuerpo">
      <p class="app-subtitulo">${icono('atras')}${esc(p.pedido.titulo)}</p>
      <span class="app-chip">${icono('canilla')}${esc(p.pedido.rubro)}</span>
      <p class="app-label">${esc(p.pedido.queLabel)}</p>
      <p class="app-campo">${esc(p.pedido.que)}</p>
      <p class="app-label">${esc(p.pedido.tipoLabel)}</p>
      <div class="app-opciones">${tipos
        .map((t, i) => `<span class="app-opcion${i === 1 ? ' app-opcion--activa' : ''}">${esc(t.nombre)}</span>`)
        .join('')}</div>
      <p class="app-label">${esc(p.pedido.cuandoLabel)}</p>
      <p class="app-campo app-campo--icono">${icono('calendario')}${esc(p.pedido.cuando)}</p>
      <span class="app-adjunto">${icono('camara')}${esc(p.pedido.fotos)}</span>
      <span class="app-boton">${esc(p.pedido.boton)}</span>
    </div>`,
    p.pedido.titulo,
    'telefono--corto',
  );
}

export function pantallaPresupuestos(): string {
  const items = p.presupuestos.items
    .map(
      (it) => `<div class="app-presupuesto">
      <span class="app-avatar">${icono('usuario')}</span>
      <span class="app-presupuesto__datos">
        <strong>${esc(it.nombre)}</strong>
        <span class="app-verificado">${icono('verificado')}${esc(p.presupuestos.verificado)}</span>
        <span class="app-presupuesto__horario">${icono('reloj')}${esc(it.horario)}</span>
      </span>
      <span class="app-presupuesto__precio">${esc(formatoPesos(it.precio))}<span class="app-boton app-boton--mini">${esc(p.presupuestos.boton)}</span></span>
    </div>`,
    )
    .join('');
  return telefono(
    `${barra()}
    <div class="app-cuerpo">
      <p class="app-subtitulo">${icono('atras')}${esc(p.presupuestos.titulo)}</p>
      <p class="app-label">${esc(p.presupuestos.subtitulo)}</p>
      ${items}
      <p class="app-nota app-nota--centro">${esc(p.presupuestos.nota)}</p>
    </div>`,
    p.presupuestos.titulo,
    'telefono--corto',
  );
}

export function pantallaSeguimiento(): string {
  const s = p.seguimiento;
  return telefono(
    `${barra()}
    <div class="app-mapa-caja">${mapa}<span class="app-pin">${icono('pin')}</span><span class="app-casa">${icono('casa')}</span></div>
    <div class="app-hoja">
      <p class="app-hoja__titulo">${esc(s.estado)}</p>
      <div class="app-progreso">${s.pasos
        .map((t, i) => `<span class="app-progreso__paso${i <= 1 ? ' app-progreso__paso--hecho' : ''}">${esc(t)}</span>`)
        .join('')}</div>
      <p class="app-hoja__label">${esc(s.horarioLabel)}</p>
      <span class="app-hoja__horario">${icono('reloj')}${esc(s.horario)}</span>
      <span class="app-boton app-boton--amarillo">${esc(s.boton)}</span>
    </div>`,
    s.titulo,
    'telefono--corto',
  );
}

export function pantallaEspecialistaPedido(): string {
  const e = p.especialistaPedido;
  return telefono(
    `${barra()}
    <div class="app-mapa-caja app-mapa-caja--alta">${mapa}
      <span class="app-disponible">${esc(e.disponible)}<span class="app-switch"></span></span>
    </div>
    <div class="app-tarjeta">
      <p class="app-tarjeta__titulo">${esc(e.titulo)} · ${esc(e.rubro)} ${icono('canilla')}</p>
      <span class="app-tag">${esc(e.tipo)}</span>
      <p class="app-tarjeta__detalle">${esc(e.detalle)}</p>
      <p class="app-tarjeta__zona">${icono('pin')}${esc(e.zona)}</p>
      <p class="app-label">${esc(e.sugeridoLabel)}</p>
      <p class="app-precio">${esc(formatoPesos(tarifas.ejemplo.presupuesto))}</p>
      <p class="app-nota">${esc(e.nota)}</p>
      <span class="app-boton">${esc(e.aceptar)}</span>
      <span class="app-boton app-boton--contorno">${esc(e.cambiar)}</span>
    </div>`,
    e.titulo,
    'telefono--hero',
  );
}

export function pantallaCobro(): string {
  const c = p.cobro;
  const retencion = (tarifas.ejemplo.presupuesto * tarifas.normal.especialista) / 100;
  return telefono(
    `${barra()}
    <div class="app-cuerpo">
      <p class="app-subtitulo">${icono('atras')}${esc(c.titulo)}</p>
      <p class="app-label">${esc(c.cuentaLabel)}</p>
      <p class="app-campo">${esc(c.alias)}</p>
    </div>
    <div class="app-hoja app-hoja--alta">
      <p class="app-hoja__titulo">${esc(c.movimientosLabel)}</p>
      <p class="app-hoja__label">${esc(c.trabajo)}</p>
      <div class="app-filas">
        <span>${esc(c.presupuesto)}</span><span>${esc(variables.presupuesto)}</span>
        <span>${esc(c.tarifa)} (${esc(variables.tarifaEspecialista)})</span><span>− ${esc(formatoPesos(retencion))}</span>
        <strong>${esc(c.acreditado)}</strong><strong>${esc(variables.recibis)}</strong>
      </div>
      <img class="app-hoja__handy" src="/src/img/handy-lamparita.webp" alt="" width="202" height="346" loading="lazy" decoding="async" />
    </div>`,
    c.titulo,
    'telefono--corto',
  );
}
