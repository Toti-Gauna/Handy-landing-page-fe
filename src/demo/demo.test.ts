// Tests de la lógica de la demo (node --test, sin dependencias): npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desglose, formatoPesos, propuestaAdicional, tarifaCliente, validarMinimo, type Tarifas } from './dinero.ts';
import { comparar, diaDeSemana, esPasada, fechaLarga, grillaMes, horaTexto, hoyEnArgentina, leerHora, nombreMes, sumarDias, sumarMeses } from './fechas.ts';
import { cantidadPorDia, trabajosDelDia } from './agenda.ts';
import { agregarContacto } from './contactos.ts';
import { contraofertar, responder, vigente, type ItemChat } from './propuestas.ts';
import { RECORRIDO_DEMO, recorrer, seSigueUbicacion, siguiente } from './llegada.ts';

const T: Tarifas = { cliente: 5, especialista: 10 };

test('desglose: el cliente paga subtotal + 5% y el especialista recibe subtotal − 10%', () => {
  const d = desglose({ manoDeObra: 32000, materiales: 13000 }, T);
  assert.equal(d.subtotal, 45000);
  assert.equal(d.tarifaCliente, 2250);
  assert.equal(d.totalCliente, 47250);
  assert.equal(d.tarifaEspecialista, 4500);
  assert.equal(d.netoEspecialista, 40500);
});

test('desglose: la tarifa del especialista nunca se suma a lo que paga el cliente', () => {
  const d = desglose({ manoDeObra: 10000, materiales: 0 }, T);
  assert.equal(d.totalCliente, 10500);
  assert.notEqual(d.totalCliente, 10000 + 500 + 1000);
});

test('tope de la tarifa del cliente solo si está definido', () => {
  assert.equal(tarifaCliente(1_000_000, T), 50000);
  assert.equal(tarifaCliente(1_000_000, { ...T, topeCliente: 20000 }), 20000);
});

test('adicional: suma el concepto con su tarifa y no cambia nada hasta que se aprueba', () => {
  const base = { manoDeObra: 32000, materiales: 13000 };
  const flexible = { tipo: 'material' as const, descripcion: 'Flexible', monto: 3500 };
  const p = propuestaAdicional(base, T, [], flexible);
  assert.equal(p.tarifaCliente, 175);
  assert.equal(p.sumaAlTotal, 3675);
  assert.equal(p.totalAntes, 47250);
  assert.equal(p.totalDespues, 50925);
  assert.equal(desglose(base, T).totalCliente, 47250);
  assert.equal(desglose(base, T, [flexible]).materiales, 16500);
});

test('mínimo de la demo para mandar un presupuesto', () => {
  assert.equal(validarMinimo(4999, 5000).ok, false);
  assert.equal(validarMinimo(5000, 5000).ok, true);
  assert.equal(validarMinimo(NaN, 5000).ok, false);
});

test('formato de pesos', () => {
  assert.equal(formatoPesos(45000), '$ 45.000');
  assert.equal(formatoPesos(3675.4), '$ 3.675');
});

test('fechas: pasado, semana, grilla y meses', () => {
  assert.equal(esPasada('2026-11-16', '2026-11-17'), true);
  assert.equal(esPasada('2026-11-17', '2026-11-17'), false);
  assert.equal(comparar('2026-12-01', '2026-11-30'), 1);
  assert.equal(diaDeSemana('2026-11-17'), 2); // martes
  const g = grillaMes(2026, 11);
  assert.equal(g[0], '2026-11-01'); // noviembre 2026 empieza domingo
  assert.equal(g.length % 7, 0);
  assert.equal(g.filter(Boolean).length, 30);
  assert.deepEqual(sumarMeses(2026, 12, 1), { anio: 2027, mes: 1 });
  assert.deepEqual(sumarMeses(2026, 1, -1), { anio: 2025, mes: 12 });
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(fechaLarga('2026-11-18'), 'Miércoles 18/11');
  assert.equal(nombreMes(2026, 11), 'Noviembre 2026');
});

test('fechas: hoy en Argentina (UTC−3) aunque en UTC ya sea mañana', () => {
  assert.equal(hoyEnArgentina(new Date('2026-11-18T01:30:00Z')), '2026-11-17');
});

test('horas: cualquier hora del día, incluida las 03:00', () => {
  assert.equal(horaTexto({ h: 3, m: 0 }), '03:00');
  assert.equal(horaTexto({ h: 23, m: 59 }), '23:59');
  assert.deepEqual(leerHora('00:00'), { h: 0, m: 0 });
  assert.throws(() => horaTexto({ h: 24, m: 0 }));
  assert.throws(() => leerHora('7:5'));
});

test('agenda: todos los trabajos de un día y cuántos hay por día', () => {
  const t = [
    { id: 'a', fecha: '2026-11-19' },
    { id: 'b', fecha: '2026-11-19' },
    { id: 'c', fecha: '2026-11-23' },
    { id: 'd', fecha: '2026-12-01' },
  ];
  assert.deepEqual(trabajosDelDia(t, '2026-11-19').map((x) => x.id), ['a', 'b']);
  assert.deepEqual(trabajosDelDia(t, '2026-11-20'), []);
  assert.deepEqual(cantidadPorDia(t, 2026, 11), { '2026-11-19': 2, '2026-11-23': 1 });
});

test('contactos: sin duplicados', () => {
  const a = agregarContacto([], { id: 'e1', nombre: 'Especialista 1' });
  assert.equal(a.agregado, true);
  const b = agregarContacto(a.lista, { id: 'e1', nombre: 'Especialista 1' });
  assert.equal(b.agregado, false);
  assert.equal(b.lista.length, 1);
});

test('propuestas: se responden una vez, la contraoferta queda en el historial y lo pendiente no cuenta', () => {
  const p: ItemChat = { id: 'p1', estado: 'pendiente' };
  const aceptada = responder(p, 'aceptar');
  assert.equal(aceptada.estado, 'aceptada');
  assert.equal(responder(aceptada, 'rechazar').estado, 'aceptada');
  const h = contraofertar<ItemChat>([p], 'p1', { id: 'p2', estado: 'pendiente' });
  assert.deepEqual(h.map((x) => x.estado), ['reemplazada', 'pendiente']);
  const original: ItemChat = { id: 'turno', estado: 'aceptada' };
  assert.equal(vigente(original, h).id, 'turno');
  assert.equal(vigente(original, [responder(h[1], 'aceptar')]).id, 'p2');
});

test('llegada: automática solo con permiso, precisión y dentro de la zona', () => {
  assert.equal(recorrer('pidiendo-permiso', RECORRIDO_DEMO), 'llego');
  assert.equal(siguiente('pidiendo-permiso', { tipo: 'permiso', concedido: false }), 'sin-permiso');
  assert.equal(siguiente('sin-permiso', { tipo: 'posicion', dentroDeLaZona: true, precisa: true }), 'sin-permiso');
  assert.equal(siguiente('en-camino', { tipo: 'posicion', dentroDeLaZona: true, precisa: false }), 'senal-imprecisa');
  assert.equal(siguiente('en-camino', { tipo: 'sin-senal' }), 'sin-senal');
  assert.equal(siguiente('llego', { tipo: 'sin-senal' }), 'llego');
  assert.equal(seSigueUbicacion('en-camino', false), false);
  assert.equal(seSigueUbicacion('llego', true), false);
});
