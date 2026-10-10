import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { CAMPOS, contadorSchema, preregistroSchema } from './preregistro.ts';
import { camposRechazados, clasificarAlta, motivoDeFalla } from './respuesta.ts';

const AVISO_USUARIO = 'usr-leg09-borrador-2026-09-15';
const AVISO_ESPECIALISTA = 'esp-04a-borrador-2026-09-30';

const especialista = {
  tipo: 'especialista',
  nombre: 'Ana Prueba',
  whatsapp: '223 000-0001',
  rubros: ['gas'],
  zona: 'Centro, Güemes',
  acepta: true,
  aviso: AVISO_ESPECIALISTA,
};
const usuario = { tipo: 'usuario', email: 'ana@example.test', acepta: true, aviso: AVISO_USUARIO };

test('el cuerpo de especialista cumple el contrato (email opcional, sin cuit)', () => {
  assert.equal(preregistroSchema.safeParse(especialista).success, true);
  const conEmail = preregistroSchema.safeParse({ ...especialista, email: 'ANA@example.test ' });
  assert.equal(conEmail.success && 'email' in conEmail.data && conEmail.data.email, 'ana@example.test');
  assert.equal(preregistroSchema.safeParse({ ...especialista, email: 'no-es-un-email' }).success, false);
});

test('el cuerpo de usuario es solo email', () => {
  assert.equal(preregistroSchema.safeParse(usuario).success, true);
});

test('esquema estricto: campos extra o retirados se rechazan', () => {
  assert.equal(preregistroSchema.safeParse({ ...especialista, cuit: 'si' }).success, false);
  assert.equal(preregistroSchema.safeParse({ ...usuario, nombre: 'Ana' }).success, false);
  assert.equal(preregistroSchema.safeParse({ ...usuario, barrio: 'Centro' }).success, false);
  assert.equal(preregistroSchema.safeParse({ ...usuario, whatsapp: '223 000-0001' }).success, false);
  assert.equal(preregistroSchema.safeParse({ ...usuario, necesidad: 'x' }).success, false);
});

test('acepta y aviso son obligatorios', () => {
  assert.equal(preregistroSchema.safeParse({ ...usuario, acepta: false }).success, false);
  const { aviso: _a, ...sinAviso } = usuario;
  assert.equal(preregistroSchema.safeParse(sinAviso).success, false);
  assert.equal(preregistroSchema.safeParse({ ...usuario, aviso: 'Con Espacios' }).success, false);
});

test('zona: misma regla de barrio que el backend', () => {
  const ok = (zona: string) => preregistroSchema.safeParse({ ...especialista, zona }).success;
  assert.equal(ok('Centro'), true);
  assert.equal(ok("Punta Mogotes (Sur), Playa Grande / Los Troncos"), true);
  assert.equal(ok('=HYPERLINK("x")'), false);
  assert.equal(ok('<script>'), false);
  assert.equal(ok('@centro'), false);
  assert.equal(ok('Centro\nOtro'), false);
  assert.equal(ok('A'), false);
});

test('honeypot: el schema solo acepta sitio_web vacío (el front no lo manda)', () => {
  assert.equal(preregistroSchema.safeParse({ ...usuario, sitio_web: 'http://spam' }).success, false);
});

test('el 400 del backend se traduce solo a campos conocidos y visibles del formulario', () => {
  assert.deepEqual(camposRechazados({ error: 'validacion', campos: ['email', 'zona', 'email'] }), ['email', 'zona']);
  assert.deepEqual(camposRechazados({ error: 'validacion', campos: ['"]evil', 'sitio_web', 'cuit'] }), []);
  assert.deepEqual(camposRechazados({ error: 'validacion', campos: ['aviso'] }), []);
  assert.deepEqual(camposRechazados({ error: 'otro' }), []);
  assert.deepEqual(camposRechazados(null), []);
  assert.ok((CAMPOS as readonly string[]).includes('aviso'));
});

test('éxito SOLO con el 201 { ok: true }', () => {
  assert.deepEqual(clasificarAlta(201, { ok: true }), { tipo: 'ok' });
  for (const status of [200, 202, 204, 301]) {
    assert.equal(clasificarAlta(status, { ok: true }).tipo, 'error', `status ${status}`);
  }
  assert.deepEqual(clasificarAlta(201, null), { tipo: 'error', motivo: 'generico' });
  assert.deepEqual(clasificarAlta(201, { ok: false }), { tipo: 'error', motivo: 'generico' });
});

test('cada estado del contrato da su error', () => {
  assert.deepEqual(clasificarAlta(400, { error: 'validacion', campos: ['email'] }), { tipo: 'validacion', campos: ['email'] });
  assert.deepEqual(clasificarAlta(400, { error: 'validacion', campos: ['aviso'] }), { tipo: 'error', motivo: 'generico' });
  assert.deepEqual(clasificarAlta(400, 'basura'), { tipo: 'error', motivo: 'generico' });
  assert.deepEqual(clasificarAlta(403, { error: 'origen_no_permitido' }), { tipo: 'error', motivo: 'origen' });
  assert.deepEqual(clasificarAlta(413, { error: 'payload_grande' }), { tipo: 'error', motivo: 'grande' });
  assert.deepEqual(clasificarAlta(429, { error: 'limite' }), { tipo: 'error', motivo: 'limite' });
  assert.deepEqual(clasificarAlta(503, { error: 'no_disponible' }), { tipo: 'error', motivo: 'no_disponible' });
  assert.deepEqual(clasificarAlta(500, null), { tipo: 'error', motivo: 'generico' });
});

test('fallas del fetch: timeout y red', () => {
  assert.equal(motivoDeFalla(new DOMException('x', 'TimeoutError')), 'timeout');
  assert.equal(motivoDeFalla(new TypeError('Failed to fetch')), 'red');
});

test('el contador acepta la cota inferior del backend (0 o múltiplos de 5)', () => {
  assert.equal(contadorSchema.safeParse({ usuarios: 0, especialistas: 25 }).success, true);
  assert.equal(contadorSchema.safeParse({ usuarios: -1, especialistas: 0 }).success, false);
});

// Sincronía con el backend: se corre con HANDY_BE_SCHEMA=/ruta/a/Handy-landing-page-be/src/schemas/preregistro.ts
const rutaBE = process.env.HANDY_BE_SCHEMA;
test('copia sincronizada con el schema del backend', { skip: !rutaBE || !existsSync(rutaBE) }, () => {
  const local = readFileSync(new URL('./preregistro.ts', import.meta.url), 'utf8');
  assert.equal(local, readFileSync(rutaBE!, 'utf8'));
});
